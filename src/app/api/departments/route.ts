import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface DepartmentRow {
    id: string;
    name: string;
    code: string;
    created_at: Date;
}

// GET - List all batches
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

        let departments;
        if (payload.role === 'super_admin') {
            departments = await query<DepartmentRow>(
                `SELECT d.id, d.name, d.code, d.created_at
                 FROM departments d
                 ORDER BY d.name ASC`
            );
        } else {
            // Teachers see batches they are assigned to
            departments = await query<DepartmentRow>(
                `SELECT d.id, d.name, d.code, d.created_at
                 FROM departments d
                 WHERE d.id IN (
                     SELECT department_id FROM user_departments WHERE user_id = $1
                     UNION
                     SELECT department_id FROM users WHERE id = $1
                 )
                 ORDER BY d.name ASC`,
                 [payload.userId]
            );
        }

        return NextResponse.json({ departments });
    } catch (error) {
        console.error('Get batches error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST - Create batch (super_admin only)
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
        const name = body.name?.trim();
        const code = body.code?.trim();

        if (!name || !code) {
            return NextResponse.json(
                { error: 'Batch name and code are required' },
                { status: 400 }
            );
        }

        if (name.length > 100 || code.length > 20) {
            return NextResponse.json(
                { error: 'Name must be under 100 characters, code under 20' },
                { status: 400 }
            );
        }

        const departments = await query<DepartmentRow>(
            `INSERT INTO departments (name, code)
             VALUES ($1, $2)
             RETURNING *`,
            [name, code.toUpperCase()]
        );

        return NextResponse.json({ department: departments[0] }, { status: 201 });
    } catch (error: unknown) {
        console.error('Create batch error:', error);
        if ((error as { code?: string }).code === '23505') {
            return NextResponse.json(
                { error: 'Batch name or code already exists' },
                { status: 400 }
            );
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// PUT - Update batch (super_admin only)
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

        const { id, name, code } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Batch ID required' }, { status: 400 });
        }

        const updateFields: string[] = [];
        const params: (string | number)[] = [id];
        let paramCount = 1;

        if (name) { updateFields.push(`name = $${++paramCount}`); params.push(name); }
        if (code) { updateFields.push(`code = $${++paramCount}`); params.push(code.toUpperCase()); }

        if (updateFields.length === 0) {
            return NextResponse.json({ message: 'No fields to update' });
        }

        await query(
            `UPDATE departments SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            params
        );

        return NextResponse.json({ message: 'Batch updated successfully' });
    } catch (error: unknown) {
        console.error('Update batch error:', error);
        if ((error as { code?: string }).code === '23505') {
            return NextResponse.json(
                { error: 'Batch name or code already exists' },
                { status: 400 }
            );
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Delete batch (super_admin only)
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
            return NextResponse.json({ error: 'Batch ID required' }, { status: 400 });
        }

        // Check for related records
        const studentsCheck = await query<{ count: string }>(
            'SELECT COUNT(*) as count FROM students WHERE department_id = $1',
            [id]
        );
        if (parseInt(studentsCheck[0].count) > 0) {
            return NextResponse.json(
                { error: 'Cannot delete batch with existing students' },
                { status: 400 }
            );
        }

        const teachersCheck = await query<{ count: string }>(
            'SELECT COUNT(*) as count FROM users WHERE department_id = $1 AND role = \'teacher\'',
            [id]
        );
        if (parseInt(teachersCheck[0].count) > 0) {
            return NextResponse.json(
                { error: 'Cannot delete batch with existing teachers' },
                { status: 400 }
            );
        }

        await query('DELETE FROM departments WHERE id = $1', [id]);

        return NextResponse.json({ message: 'Batch deleted successfully' });
    } catch (error) {
        console.error('Delete batch error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
