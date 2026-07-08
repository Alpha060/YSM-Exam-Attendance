import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface TeacherData {
    teacher_id: string;
    first_name: string;
    last_name: string;
    email: string;
    batch_name: string;
    subject_names: string;
    total_sessions: string;
    working_days: string;
    avg_attendance: string;
}

// GET - Teacher-wise attendance report
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

        const { searchParams } = new URL(request.url);
        const batchId = searchParams.get('batchId');

        // Teachers are ALWAYS restricted to active batches — override any param sent
        const batchStatus = role === 'teacher' ? 'active' : (searchParams.get('batchStatus') || 'all');

        // Build role-based filter
        const filters: string[] = [];
        const params: string[] = [];

        // Batch Status Filter
        if (batchStatus === 'active') {
            filters.push(`EXISTS (
                SELECT 1 FROM teacher_subjects ts_filt 
                JOIN subjects s_filt ON ts_filt.subject_id = s_filt.id 
                JOIN batches d_filt ON s_filt.batch_id = d_filt.id 
                WHERE ts_filt.teacher_id = u.id AND (d_filt.status IS NULL OR d_filt.status = 'active' OR d_filt.status = 'upcoming')
            )`);
        } else if (batchStatus === 'completed') {
            filters.push(`EXISTS (
                SELECT 1 FROM teacher_subjects ts_filt 
                JOIN subjects s_filt ON ts_filt.subject_id = s_filt.id 
                JOIN batches d_filt ON s_filt.batch_id = d_filt.id 
                WHERE ts_filt.teacher_id = u.id AND d_filt.status = 'completed'
            )`);
        }

        if (role === 'super_admin') {
            // Super admin: see all teachers, optionally filter by batch
            if (batchId) {
                params.push(batchId);
                filters.push(`(u.batch_id = $${params.length} OR u.id IN (SELECT user_id FROM user_batches WHERE batch_id = $${params.length}))`);
            }
            // No batchId: super_admin sees ALL teachers
        } else if (role === 'teacher') {
            // Teacher: only see their own stats
            params.push(userId);
            filters.push(`u.id = $${params.length}`);
        }

        const filterClause = filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';

        // Teachers are stored in users table with role = 'teacher' or 'hod'
        const teachers = await query<TeacherData>(
            `SELECT 
                u.id as teacher_id,
                u.first_name,
                u.last_name,
                u.email,
                (
                    SELECT STRING_AGG(dept_code, ', ' ORDER BY dept_code)
                    FROM (
                        SELECT DISTINCT ud_d.code AS dept_code
                        FROM batches ud_d
                        WHERE ud_d.id = u.batch_id
                           OR ud_d.id IN (SELECT batch_id FROM user_batches ud WHERE ud.user_id = u.id)
                    ) dept_codes
                ) as batch_name,
                COALESCE(
                    (
                        SELECT STRING_AGG(sn, ', ' ORDER BY sn)
                        FROM (
                            SELECT DISTINCT s2.name AS sn
                            FROM teacher_subjects ts2
                            JOIN subjects s2 ON s2.id = ts2.subject_id
                            JOIN batches d2 ON d2.id = s2.batch_id
                            WHERE ts2.teacher_id = u.id
                            ${role === 'teacher' ? "AND COALESCE(d2.status, 'active') = 'active'" : ''}
                        ) sub_names
                    ),
                    ''
                ) as subject_names,
                ${role === 'teacher'
                    ? `COUNT(DISTINCT CASE WHEN COALESCE(sd.status, 'active') = 'active' THEN ar.date || '-' || ar.subject_id::text || '-' || ar.lecture_number END) as total_sessions,
                COUNT(DISTINCT CASE WHEN COALESCE(sd.status, 'active') = 'active' THEN ar.date END) as working_days,
                COALESCE(
                    ROUND(
                        COUNT(CASE WHEN ar.status = 'present' AND COALESCE(sd.status, 'active') = 'active' THEN 1 END)::numeric * 100 / 
                        NULLIF(COUNT(CASE WHEN COALESCE(sd.status, 'active') = 'active' THEN ar.id END), 0),
                        1
                    ),
                    0
                ) as avg_attendance`
                    : `COUNT(DISTINCT ar.date || '-' || ar.subject_id::text || '-' || ar.lecture_number) as total_sessions,
                COUNT(DISTINCT ar.date) as working_days,
                COALESCE(
                    ROUND(
                        COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::numeric * 100 / 
                        NULLIF(COUNT(ar.id), 0),
                        1
                    ),
                    0
                ) as avg_attendance`}
             FROM users u
             LEFT JOIN teacher_subjects ts ON ts.teacher_id = u.id
             LEFT JOIN subjects s ON s.id = ts.subject_id
             LEFT JOIN batches sd ON sd.id = s.batch_id
             LEFT JOIN attendance_records ar ON ar.subject_id = ts.subject_id AND ar.teacher_id = u.id
             WHERE u.role IN ('teacher') ${filterClause}
             GROUP BY u.id, u.first_name, u.last_name, u.email
             ORDER BY u.first_name ASC, u.last_name ASC`,
            params
        );

        const formattedTeachers = teachers.map(t => ({
            id: t.teacher_id,
            name: `${t.first_name} ${t.last_name}`,
            email: t.email,
            batch: t.batch_name || 'N/A',
            subjects: t.subject_names || '-',
            totalSessions: parseInt(t.total_sessions) || 0,
            workingDays: parseInt(t.working_days) || 0,
            averageAttendance: Math.round(parseFloat(t.avg_attendance) || 0)
        }));

        return NextResponse.json({ teachers: formattedTeachers });
    } catch (error) {
        console.error('Teacher report error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
