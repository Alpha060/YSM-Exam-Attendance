import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface SubjectRow {
    id: string;
    code: string;
    name: string;
    paper_code: string | null;
    department_id: string | null;
    department_name: string | null;
    department_code: string | null;
    credits: number;
    created_at: string;
}

// GET - List all subjects
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
        const departmentId = searchParams.get('departmentId');

        let queryStr = `
            SELECT s.id, s.code, s.paper_code, s.name, s.department_id, s.credits, s.created_at,
                   d.name as department_name, d.code as department_code
            FROM subjects s
            LEFT JOIN departments d ON s.department_id = d.id
            WHERE 1=1
        `;
        const params: (string | number)[] = [];

        // Filter by batch (department)
        if (departmentId) {
            params.push(departmentId);
            queryStr += ` AND s.department_id = $${params.length}`;
        }

        // Teacher: only show assigned subjects
        if (payload.role === 'teacher') {
            const teacherSubjects = await query<{ subject_id: string }>(
                'SELECT subject_id FROM teacher_subjects WHERE teacher_id = $1',
                [payload.userId]
            );

            if (teacherSubjects.length === 0) {
                return NextResponse.json({ subjects: [] });
            }

            const subjectIds = teacherSubjects.map(ts => ts.subject_id);
            const placeholders = subjectIds.map((_, i) => `$${params.length + i + 1}`).join(',');
            queryStr += ` AND s.id IN (${placeholders})`;
            params.push(...subjectIds);
        }

        queryStr += ' ORDER BY d.name ASC, s.code ASC';

        const subjects = await query<SubjectRow>(queryStr, params);

        return NextResponse.json({
            subjects: subjects.map(s => ({
                id: s.id,
                code: s.code,
                paperCode: s.paper_code || '',
                name: s.name,
                departmentId: s.department_id,
                departmentName: s.department_name,
                departmentCode: s.department_code,
                credits: s.credits,
                createdAt: s.created_at
            }))
        });
    } catch (error) {
        console.error('Get subjects error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST - Create new subject (super_admin only)
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

        if (payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const body = await request.json();
        const code = body.code?.trim();
        const paperCode = body.paperCode?.trim() || null;
        const name = body.name?.trim();
        const departmentId = body.departmentId;
        const credits = body.credits || 3;

        if (!code || !name || !departmentId) {
            return NextResponse.json(
                { error: 'Code, name, and batch are required' },
                { status: 400 }
            );
        }

        if (code.length > 20 || name.length > 200) {
            return NextResponse.json(
                { error: 'Code must be under 20 characters, name under 200' },
                { status: 400 }
            );
        }

        // Check if batch is completed
        const batchCheck = await query<{ status: string }>(
            'SELECT COALESCE(status, \'active\') as status FROM departments WHERE id = $1',
            [departmentId]
        );
        if (batchCheck.length > 0 && batchCheck[0].status === 'completed') {
            return NextResponse.json(
                { error: 'Cannot add subjects to a completed batch' },
                { status: 400 }
            );
        }

        // Check for existing subject in same batch
        const existing = await query<{ id: string }>(
            'SELECT id FROM subjects WHERE code = $1 AND department_id = $2',
            [code, departmentId]
        );

        let subjectId: string;
        if (existing.length > 0) {
            subjectId = existing[0].id;
            await query(
                'UPDATE subjects SET name = $1, paper_code = $2, credits = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
                [name, paperCode, credits, subjectId]
            );
        } else {
            const result = await query<{ id: string }>(
                `INSERT INTO subjects (code, paper_code, name, department_id, credits)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [code, paperCode, name, departmentId, credits]
            );
            subjectId = result[0].id;
        }

        // Auto-enroll all existing students in this batch into the new subject
        const academicYear = (() => {
            const now = new Date();
            const y = now.getFullYear();
            return now.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
        })();
        await query(
            `INSERT INTO student_subjects (student_id, subject_id, academic_year)
             SELECT s.id, $1, $2 FROM students s
             WHERE s.department_id = $3 AND s.is_active = true
             ON CONFLICT (student_id, subject_id, academic_year) DO NOTHING`,
            [subjectId, academicYear, departmentId]
        );

        return NextResponse.json({
            message: 'Subject created successfully',
            subject: { id: subjectId },
            count: 1
        }, { status: 201 });
    } catch (error) {
        console.error('Create subject error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// PUT - Update subject
export async function PUT(request: NextRequest) {
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

        const { id, code, paperCode, name, credits, departmentId } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Subject ID required' }, { status: 400 });
        }

        // Check if subject belongs to a completed batch
        const batchCheck = await query<{ status: string }>(
            `SELECT COALESCE(d.status, 'active') as status FROM subjects s
             JOIN departments d ON s.department_id = d.id
             WHERE s.id = $1`,
            [id]
        );
        if (batchCheck.length > 0 && batchCheck[0].status === 'completed') {
            return NextResponse.json(
                { error: 'Cannot update subjects in a completed batch' },
                { status: 400 }
            );
        }

        const updateFields: string[] = [];
        const params: (string | number | null)[] = [id];
        let paramCount = 1;

        if (code) { updateFields.push(`code = $${++paramCount}`); params.push(code); }
        if (paperCode !== undefined) { updateFields.push(`paper_code = $${++paramCount}`); params.push(paperCode?.trim() || null); }
        if (name) { updateFields.push(`name = $${++paramCount}`); params.push(name); }
        if (credits) { updateFields.push(`credits = $${++paramCount}`); params.push(parseInt(credits)); }
        if (departmentId) { updateFields.push(`department_id = $${++paramCount}`); params.push(departmentId); }

        if (updateFields.length > 0) {
            await query(
                `UPDATE subjects SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                params
            );
        }

        return NextResponse.json({ message: 'Subject updated successfully' });
    } catch (error) {
        console.error('Update subject error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Delete subject
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
            return NextResponse.json({ error: 'Subject ID required' }, { status: 400 });
        }

        // Check for attendance records
        const attendanceCheck = await query<{ count: string }>(
            'SELECT COUNT(*) as count FROM attendance_records WHERE subject_id = $1',
            [id]
        );

        if (parseInt(attendanceCheck[0].count) > 0) {
            return NextResponse.json(
                { error: 'Cannot delete subject with attendance records. Delete attendance records first.' },
                { status: 400 }
            );
        }

        await query('DELETE FROM teacher_subjects WHERE subject_id = $1', [id]);
        await query('DELETE FROM student_subjects WHERE subject_id = $1', [id]);
        await query('DELETE FROM subjects WHERE id = $1', [id]);

        return NextResponse.json({ message: 'Subject deleted successfully' });
    } catch (error) {
        console.error('Delete subject error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
