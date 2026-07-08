import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface CountResult {
    count: string;
}

interface AttendanceStats {
    total: string;
    present: string;
}

interface StudentAttendanceStatus {
    id: string;
    attendance_pct: string;
}

interface BatchStats {
    batch_id: string;
    batch_name: string;
    total_students: string;
    avg_attendance: string;
}

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { role, batchId, userId } = payload;

        // Allow HOD to view as teacher (for My Reports)
        const { searchParams } = new URL(request.url);
        const view = searchParams.get('view');
        const effectiveRole = (role === 'super_admin' && view === 'teacher') ? 'teacher' : role;

        // Build role-based filter conditions
        let studentFilter = '';
        let subjectFilter = '';
        let attendanceFilter = '';
        const studentParams: string[] = [];
        const subjectParams: string[] = [];
        const attendanceParams: string[] = [];

        if (effectiveRole === 'teacher') {
            // Teacher: filter by students in their assigned subjects
            // teacher_subjects.teacher_id references users.id directly
            studentFilter = `AND s.id IN (
                SELECT ss.student_id FROM student_subjects ss
                JOIN teacher_subjects ts ON ss.subject_id = ts.subject_id
                WHERE ts.teacher_id = $1
            ) AND s.batch_id IN (
                SELECT batch_id FROM users WHERE id = $1
                UNION
                SELECT batch_id FROM user_batches WHERE user_id = $1
            )`;
            studentParams.push(userId);

            subjectFilter = `WHERE id IN (
                SELECT ts.subject_id FROM teacher_subjects ts
                WHERE ts.teacher_id = $1
            )`;
            subjectParams.push(userId);

            attendanceFilter = `AND ar.student_id IN (
                SELECT ss.student_id FROM student_subjects ss
                JOIN teacher_subjects ts ON ss.subject_id = ts.subject_id
                WHERE ts.teacher_id = $1
            ) AND ar.teacher_id = $1`;
            attendanceParams.push(userId);
        }
        // super_admin: no filter, sees everything

        // Run all queries in parallel to improve performance
        const promises: Promise<void>[] = [];

        // Get total students
        let totalStudents = 0;
        promises.push((async () => {
            try {
                const studentQuery = `SELECT COUNT(*) as count FROM students s
                    WHERE s.is_active = true
                    AND s.batch_id IN (SELECT id FROM batches WHERE COALESCE(status, 'active') = 'active')
                    ${studentFilter}`;
                const studentCount = await queryOne<CountResult>(studentQuery, studentParams);
                totalStudents = parseInt(studentCount?.count || '0');
            } catch {
                // Table might not exist
            }
        })());

        // Get total subjects
        let totalSubjects = 0;
        promises.push((async () => {
            try {
                const subjectQuery = `SELECT COUNT(*) as count FROM subjects
                    WHERE batch_id IN (SELECT id FROM batches WHERE COALESCE(status, 'active') = 'active')
                    ${subjectFilter ? 'AND ' + subjectFilter.replace('WHERE', '') : ''}`;
                const subjectCount = await queryOne<CountResult>(subjectQuery, subjectParams);
                totalSubjects = parseInt(subjectCount?.count || '0');
            } catch {
                // Table might not exist
            }
        })());

        // Get total lectures (distinct date + subject + semester + lecture_number)
        let totalLectures = 0;
        let workingDays = 0;
        let todaySessions = 0;
        promises.push((async () => {
            try {
                // Get IST today
                const now = new Date();
                const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
                const todayStr = istTime.toISOString().split('T')[0];

                const lectureQuery = `SELECT 
                    COUNT(DISTINCT ar.teacher_id || '-' || ar.date::text || '-' || ar.subject_id::text || '-' || ar.lecture_number::text) as count,
                    COUNT(DISTINCT ar.date) as working_days
                    FROM attendance_records ar
                    WHERE ar.subject_id IN (SELECT id FROM subjects WHERE batch_id IN (SELECT id FROM batches WHERE COALESCE(status, 'active') = 'active'))
                    ${attendanceFilter}`;
                const lectureCount = await queryOne<CountResult & { working_days: string }>(lectureQuery, attendanceParams);
                totalLectures = parseInt(lectureCount?.count || '0');
                workingDays = parseInt(lectureCount?.working_days || '0');

                // Today's sessions
                const todayParams = [...attendanceParams, todayStr];
                const todayDateIdx = todayParams.length;
                const tQuery = `SELECT 
                    COUNT(DISTINCT ar.teacher_id || '-' || ar.subject_id::text || '-' || ar.lecture_number::text) as count
                    FROM attendance_records ar
                    WHERE ar.date = $${todayDateIdx}
                    AND ar.subject_id IN (SELECT id FROM subjects WHERE batch_id IN (SELECT id FROM batches WHERE COALESCE(status, 'active') = 'active'))
                    ${attendanceFilter}`;
                const tCount = await queryOne<CountResult>(tQuery, todayParams);
                todaySessions = parseInt(tCount?.count || '0');
            } catch (err) {
                console.error('Error counting lectures:', err);
            }
        })());

        // Calculate actual average attendance from attendance_records
        let averageAttendance = 0;
        promises.push((async () => {
            try {
                const statsQuery = `SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present
                     FROM attendance_records ar
                     WHERE ar.subject_id IN (SELECT id FROM subjects WHERE batch_id IN (SELECT id FROM batches WHERE COALESCE(status, 'active') = 'active'))
                     ${attendanceFilter}`;
                const stats = await queryOne<AttendanceStats>(statsQuery, attendanceParams);
                if (stats && parseInt(stats.total) > 0) {
                    averageAttendance = Math.round((parseInt(stats.present) / parseInt(stats.total)) * 100);
                }
            } catch {
                // Table might not exist
            }
        })());

        // For HOD and Super Admin: Get low attendance and warning counts
        let lowAttendanceCount = 0;
        let warningAttendanceCount = 0;

        if (effectiveRole === 'super_admin') {
            promises.push((async () => {
                try {
                    // Get student-wise attendance percentages
                    let studentAttendanceQuery = `
                        SELECT 
                            s.id,
                            COALESCE(
                                ROUND(
                                    COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::numeric * 100 / 
                                    NULLIF(COUNT(ar.id), 0),
                                    1
                                ),
                                0
                            ) as attendance_pct
                        FROM students s
                        LEFT JOIN attendance_records ar ON ar.student_id = s.id
                        WHERE 1=1 ${studentFilter}
                        GROUP BY s.id
                        HAVING COUNT(ar.id) > 0
                    `;

                    const studentStats = await query<StudentAttendanceStatus>(studentAttendanceQuery, studentParams);

                    for (const student of studentStats) {
                        const pct = parseFloat(student.attendance_pct);
                        if (pct < 60) {
                            lowAttendanceCount++;
                        } else if (pct < 75) {
                            warningAttendanceCount++;
                        }
                    }
                } catch (err) {
                    console.error('Error getting attendance counts:', err);
                }
            })());
        }

        // For Super Admin: Get batch-wise stats
        let batchStats: { batchId: string; batchName: string; totalStudents: number; avgAttendance: number }[] = [];

        if (effectiveRole === 'super_admin') {
            promises.push((async () => {
                try {
                    const deptQuery = `
                        SELECT 
                            d.id as batch_id,
                            d.name as batch_name,
                            COUNT(DISTINCT s.id) as total_students,
                            COALESCE(
                                ROUND(
                                    COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::numeric * 100 / 
                                    NULLIF(COUNT(ar.id), 0),
                                    1
                                ),
                                0
                            ) as avg_attendance
                        FROM batches d
                        LEFT JOIN students s ON s.batch_id = d.id
                        LEFT JOIN attendance_records ar ON ar.student_id = s.id
                        WHERE COALESCE(d.status, 'active') = 'active'
                        GROUP BY d.id, d.name
                        ORDER BY d.name
                    `;

                    const deptStats = await query<BatchStats>(deptQuery, []);
                    batchStats = deptStats.map(d => ({
                        batchId: d.batch_id,
                        batchName: d.batch_name,
                        totalStudents: parseInt(d.total_students) || 0,
                        avgAttendance: Math.round(parseFloat(d.avg_attendance) || 0)
                    }));
                } catch (err) {
                    console.error('Error getting batch stats:', err);
                }
            })());
        }

        // Wait for all queries to complete
        await Promise.all(promises);

        return NextResponse.json({
            stats: {
                totalStudents,
                totalSubjects,
                totalSessions: totalLectures,
                todaySessions,
                workingDays,
                averageAttendance,
                // Role-specific data
                ...(effectiveRole === 'super_admin' ? {
                    lowAttendanceCount,
                    warningAttendanceCount,
                } : {}),
                ...(effectiveRole === 'super_admin' && batchStats.length > 0 ? {
                    batchStats,
                } : {}),
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
