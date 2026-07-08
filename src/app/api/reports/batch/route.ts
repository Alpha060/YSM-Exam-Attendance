import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface BatchInfo {
    id: string;
    name: string;
    code: string;
}

interface SubjectStats {
    id: string;
    name: string;
    code: string;
    total_students: string;
    avg_attendance: string;
}

interface StudentAlert {
    id: string;
    student_id: string;
    roll_number: string;
    name: string;
    attendance_pct: string;
}

// GET - Batch Overview Data
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

        const { role, batchId: userDeptId, userId } = payload;

        // Teachers cannot access batch reports
        if (role === 'teacher') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const searchParams = request.nextUrl.searchParams;
        let selectedDeptId = searchParams.get('batchId') || userDeptId;

        // If still no dept, pick the first available batch for super_admin
        if (!selectedDeptId && role === 'super_admin') {
            const firstDept = await queryOne<{ id: string }>(
                `SELECT id FROM batches ORDER BY name LIMIT 1`,
                []
            );
            selectedDeptId = firstDept?.id || undefined;
        }

        if (!selectedDeptId) {
            return NextResponse.json({ error: 'No batches found' }, { status: 404 });
        }

        // Security check: super_admin has access to all batches

        const params: string[] = [selectedDeptId];
        const subjectParams: string[] = [selectedDeptId];

        // 1. Get batch info
        const deptInfo = await queryOne<BatchInfo>(
            `SELECT id, name, code FROM batches WHERE id = $1`,
            [selectedDeptId]
        );

        if (!deptInfo) {
            return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
        }



        // 2. Get total students in this batch
        const studentCountResult = await queryOne<{ count: string }>(
            `SELECT COUNT(DISTINCT id)::text as count FROM students WHERE batch_id = $1`,
            [selectedDeptId]
        );
        const totalStudents = parseInt(studentCountResult?.count || '0');

        // 3. Get subject-wise stats using batch_id to link subjects
        const subjectStats = await query<SubjectStats>(
            `SELECT 
                sub.id,
                sub.name,
                COALESCE(sub.paper_code, sub.code) as code,
                COUNT(DISTINCT ss.student_id) as total_students,
                COALESCE(
                    ROUND(
                        COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::numeric * 100 / 
                        NULLIF(COUNT(ar.id), 0),
                        1
                    ),
                    0
                ) as avg_attendance
            FROM subjects sub
            LEFT JOIN student_subjects ss ON ss.subject_id = sub.id
            LEFT JOIN students st ON ss.student_id = st.id AND st.batch_id = $1
            LEFT JOIN attendance_records ar ON ar.subject_id = sub.id AND ar.student_id = st.id
            WHERE sub.batch_id = $1
            GROUP BY sub.id, sub.name, sub.code
            ORDER BY sub.code, sub.name`,
            [selectedDeptId]
        );

        // 4. Get critical students (<60% attendance)
        const criticalStudents = await query<StudentAlert>(
            `SELECT 
                s.id,
                s.student_id,
                s.roll_number::text as roll_number,
                CONCAT(s.first_name, ' ', s.last_name) as name,
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
            WHERE s.batch_id = $1
            GROUP BY s.id, s.student_id, s.roll_number, s.first_name, s.last_name
            HAVING COUNT(ar.id) > 0 AND 
                COALESCE(
                    ROUND(
                        COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::numeric * 100 / 
                        NULLIF(COUNT(ar.id), 0),
                        1
                    ),
                    0
                ) < 60
            ORDER BY attendance_pct ASC
            LIMIT 20`,
            params
        );

        // 5. Get warning students (60-75% attendance)
        const warningStudents = await query<StudentAlert>(
            `SELECT 
                s.id,
                s.student_id,
                s.roll_number::text as roll_number,
                CONCAT(s.first_name, ' ', s.last_name) as name,
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
            WHERE s.batch_id = $1
            GROUP BY s.id, s.student_id, s.roll_number, s.first_name, s.last_name
            HAVING COUNT(ar.id) > 0 AND 
                COALESCE(
                    ROUND(
                        COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::numeric * 100 / 
                        NULLIF(COUNT(ar.id), 0),
                        1
                    ),
                    0
                ) BETWEEN 60 AND 74.9
            ORDER BY attendance_pct ASC
            LIMIT 20`,
            params
        );

        // Calculate totals
        const totalSubjects = subjectStats.length;

        return NextResponse.json({
            batch: {
                id: deptInfo.id,
                name: deptInfo.name,
                code: deptInfo.code,
            },

            overallStats: {
                totalStudents,
                totalSubjects,
                criticalCount: criticalStudents.length,
                warningCount: warningStudents.length,
            },
            subjectStats: subjectStats.map(s => ({
                id: s.id,
                name: s.name,
                code: s.code,
                totalStudents: parseInt(s.total_students || '0'),
                avgAttendance: Math.round(parseFloat(s.avg_attendance || '0')),
            })),
            criticalStudents: criticalStudents.map(s => ({
                id: s.id,
                studentId: s.student_id,
                rollNumber: s.roll_number,
                name: s.name,
                attendancePercentage: Math.round(parseFloat(s.attendance_pct || '0')),
            })),
            warningStudents: warningStudents.map(s => ({
                id: s.id,
                studentId: s.student_id,
                rollNumber: s.roll_number,
                name: s.name,
                attendancePercentage: Math.round(parseFloat(s.attendance_pct || '0')),
            })),
        });
    } catch (error) {
        console.error('Batch overview error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
