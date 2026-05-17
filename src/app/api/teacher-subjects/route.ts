import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface TeacherSubjectRow {
    id: string;
    teacher_id: string;
    teacher_first_name: string;
    teacher_last_name: string;
    subject_id: string;
    subject_code: string;
    subject_paper_code: string | null;
    subject_name: string;
    academic_year: string;
    assigned_date: string | null;
    unassigned_date: string | null;
    created_at: string;
}

// GET - List teacher-subject assignments
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

        const { searchParams } = new URL(request.url);
        const teacherId = searchParams.get('teacherId');
        const subjectId = searchParams.get('subjectId');
        const academicYear = searchParams.get('academicYear');
        const includeArchived = searchParams.get('includeArchived') === 'true';

        let queryStr = `
             SELECT ts.id, ts.teacher_id, ts.subject_id, ts.academic_year,
                    ts.assigned_date, ts.unassigned_date, ts.created_at, 
                    u.first_name as teacher_first_name, u.last_name as teacher_last_name,
                    s.code as subject_code, s.paper_code as subject_paper_code, s.name as subject_name,
                    s.department_id,
                    d.name as department_name, d.code as department_code,
                    COALESCE(d.status, 'active') as department_status
             FROM teacher_subjects ts
             JOIN users u ON u.id = ts.teacher_id
             JOIN subjects s ON s.id = ts.subject_id
             LEFT JOIN departments d ON s.department_id = d.id
            WHERE 1=1
        `;
        const params: string[] = [];

        // By default only return ACTIVE assignments (not archived)
        if (!includeArchived) {
            queryStr += ` AND ts.unassigned_date IS NULL`;
        }

        if (teacherId) {
            params.push(teacherId);
            queryStr += ` AND ts.teacher_id = $${params.length}`;
        }

        if (subjectId) {
            params.push(subjectId);
            queryStr += ` AND ts.subject_id = $${params.length}`;
        }

        if (academicYear) {
            params.push(academicYear);
            queryStr += ` AND ts.academic_year = $${params.length}`;
        }

        queryStr += ' ORDER BY ts.created_at DESC';

        const assignments = await query<TeacherSubjectRow & { department_id: string; department_name: string; department_code: string; department_status: string }>(queryStr, params);

        return NextResponse.json({
            assignments: assignments.map(a => ({
                id: a.id,
                teacherId: a.teacher_id,
                teacherName: `${a.teacher_first_name} ${a.teacher_last_name}`,
                subjectId: a.subject_id,
                subjectCode: a.subject_code,
                subjectPaperCode: a.subject_paper_code || null,
                subjectName: a.subject_name,
                departmentId: a.department_id,
                departmentName: a.department_name,
                departmentCode: a.department_code,
                departmentStatus: a.department_status,
                academicYear: a.academic_year,
                assignedDate: a.assigned_date,
                unassignedDate: a.unassigned_date,
                isActive: a.unassigned_date === null,
                createdAt: a.created_at
            }))
        });
    } catch (error) {
        console.error('Get teacher-subjects error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST - Assign teacher to subject(s)
// Supports: single subjectId OR subjectCode+departmentId (assigns all semesters)
export async function POST(request: NextRequest) {
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

        // Only super_admin can assign teachers
        if (payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { teacherId, subjectId, subjectCode, departmentId, academicYear } = await request.json();

        if (!teacherId || !academicYear) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get subject IDs
        let subjectIds: string[] = [];

        if (subjectCode && departmentId) {
            const subjects = await query<{ id: string }>(
                'SELECT id FROM subjects WHERE code = $1 AND department_id = $2',
                [subjectCode, departmentId]
            );
            subjectIds = subjects.map(s => s.id);
        } else if (subjectId) {
            subjectIds = [subjectId];
        } else {
            return NextResponse.json({ error: 'Subject ID or code+batch required' }, { status: 400 });
        }

        if (subjectIds.length === 0) {
            return NextResponse.json({ error: 'No subjects found' }, { status: 404 });
        }

        // Check if any subject is in a completed batch
        const batchCheck = await query<{ status: string }>(
            `SELECT COALESCE(d.status, 'active') as status FROM subjects s
             JOIN departments d ON s.department_id = d.id
             WHERE s.id = ANY($1::uuid[])`,
            [subjectIds]
        );
        
        if (batchCheck.some(b => b.status === 'completed')) {
            return NextResponse.json(
                { error: 'Cannot assign teachers to subjects in a completed batch' },
                { status: 400 }
            );
        }

        // Assign teacher to all subject IDs
        let assignedCount = 0;
        for (const sId of subjectIds) {
            const result = await query<{ id: string }>(
                `INSERT INTO teacher_subjects (teacher_id, subject_id, academic_year)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (teacher_id, subject_id, academic_year) DO NOTHING
                 RETURNING id`,
                [teacherId, sId, academicYear]
            );
            if (result.length > 0) assignedCount++;
        }

        return NextResponse.json({
            message: `Teacher assigned to ${assignedCount} subject(s) successfully`,
            assignedCount
        }, { status: 201 });
    } catch (error) {
        console.error('Assign teacher error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// PATCH - Soft-archive a teacher-subject assignment (preserves history)
export async function PATCH(request: NextRequest) {
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

        if (payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });
        }

        // Soft-archive: stamp unassigned_date instead of deleting
        await query(
            'UPDATE teacher_subjects SET unassigned_date = CURRENT_DATE WHERE id = $1 AND unassigned_date IS NULL',
            [id]
        );

        return NextResponse.json({ message: 'Assignment archived successfully' });
    } catch (error) {
        console.error('Archive assignment error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Hard delete (only for assignments with NO attendance records — i.e. mistakes)
export async function DELETE(request: NextRequest) {
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

        if (payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });
        }

        // Only hard-delete if no attendance records exist for this assignment
        const ts = await query<{ teacher_id: string; subject_id: string }>(
            'SELECT teacher_id, subject_id FROM teacher_subjects WHERE id = $1',
            [id]
        );

        if (ts.length === 0) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        const hasAttendance = await query<{ count: string }>(
            'SELECT COUNT(*) as count FROM attendance_records WHERE teacher_id = $1 AND subject_id = $2',
            [ts[0].teacher_id, ts[0].subject_id]
        );

        if (parseInt(hasAttendance[0]?.count || '0') > 0) {
            // Has attendance data — soft-archive instead of delete to preserve history
            await query(
                'UPDATE teacher_subjects SET unassigned_date = CURRENT_DATE WHERE id = $1',
                [id]
            );
            return NextResponse.json({ message: 'Assignment archived (has attendance records)' });
        }

        // Safe to hard delete — no attendance data exists
        await query('DELETE FROM teacher_subjects WHERE id = $1', [id]);

        return NextResponse.json({ message: 'Assignment removed successfully' });
    } catch (error) {
        console.error('Delete assignment error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
