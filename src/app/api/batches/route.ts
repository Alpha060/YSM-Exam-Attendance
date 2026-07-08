import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface BatchRow {
    id: string;
    name: string;
    code: string;
    status: string;
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

        let batches;
        if (payload.role === 'super_admin') {
            batches = await query<BatchRow>(
                `SELECT d.id, d.name, d.code, COALESCE(d.status, 'active') as status, d.tuition_fee, d.created_at
                 FROM batches d
                 ORDER BY d.name ASC`
            );
        } else {
            // Teachers only see ACTIVE batches they are assigned to
            batches = await query<BatchRow>(
                `SELECT d.id, d.name, d.code, COALESCE(d.status, 'active') as status, d.tuition_fee, d.created_at
                 FROM batches d
                 WHERE COALESCE(d.status, 'active') = 'active'
                 AND d.id IN (
                     SELECT batch_id FROM user_batches WHERE user_id = $1
                     UNION
                     SELECT batch_id FROM users WHERE id = $1
                 )
                 ORDER BY d.name ASC`,
                 [payload.userId]
            );
        }

        return NextResponse.json({ batches });
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
        const tuition_fee = Number(body.tuition_fee) || 0;

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

        const batches = await query<BatchRow>(
            `INSERT INTO batches (name, code, tuition_fee)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [name, code.toUpperCase(), tuition_fee]
        );

        return NextResponse.json({ batch: batches[0] }, { status: 201 });
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

        const { id, name, code, status, tuition_fee } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Batch ID required' }, { status: 400 });
        }

        const validStatuses = ['upcoming', 'active', 'completed'];
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
        }

        const updateFields: string[] = [];
        const params: (string | number)[] = [id];
        let paramCount = 1;

        if (name) { updateFields.push(`name = $${++paramCount}`); params.push(name); }
        if (code) { updateFields.push(`code = $${++paramCount}`); params.push(code.toUpperCase()); }
        if (status) { updateFields.push(`status = $${++paramCount}`); params.push(status); }
        if (tuition_fee !== undefined) { updateFields.push(`tuition_fee = $${++paramCount}`); params.push(Number(tuition_fee) || 0); }

        if (updateFields.length === 0) {
            return NextResponse.json({ message: 'No fields to update' });
        }

        await query(
            `UPDATE batches SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            params
        );

        // If the batch code was updated, update all student IDs in this batch to reflect the new code
        if (code) {
            await query(
                `UPDATE students 
                 SET coaching_id = $1 || '-' || batch_year || '-' || roll_number
                 WHERE batch_id = $2`,
                [code.toUpperCase(), id]
            );
        }

        if (tuition_fee !== undefined) {
            // Update all existing pending tuition invoices for students in this batch
            await query(
                `UPDATE payments 
                 SET amount = $1 
                 WHERE status = 'pending' 
                 AND description ILIKE '%Tuition Fee%' 
                 AND student_id IN (SELECT id FROM students WHERE batch_id = $2)`,
                [Number(tuition_fee) || 0, id]
            );
        }

        // When a batch is completed, soft-archive ALL active teacher assignments for subjects in that batch
        if (status === 'completed') {
            await query(
                `UPDATE teacher_subjects
                 SET unassigned_date = CURRENT_DATE
                 WHERE unassigned_date IS NULL
                 AND subject_id IN (
                     SELECT id FROM subjects WHERE batch_id = $1
                 )`,
                [id]
            );
        }

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
            'SELECT COUNT(*) as count FROM students WHERE batch_id = $1',
            [id]
        );
        if (parseInt(studentsCheck[0].count) > 0) {
            return NextResponse.json(
                { error: 'Cannot delete batch with existing students' },
                { status: 400 }
            );
        }

        const teachersCheck = await query<{ count: string }>(
            'SELECT COUNT(*) as count FROM users WHERE batch_id = $1 AND role = \'teacher\'',
            [id]
        );
        if (parseInt(teachersCheck[0].count) > 0) {
            return NextResponse.json(
                { error: 'Cannot delete batch with existing teachers' },
                { status: 400 }
            );
        }

        await query('DELETE FROM batches WHERE id = $1', [id]);

        return NextResponse.json({ message: 'Batch deleted successfully' });
    } catch (error) {
        console.error('Delete batch error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
