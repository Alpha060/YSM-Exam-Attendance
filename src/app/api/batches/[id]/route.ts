import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface BatchRow {
    id: string;
    name: string;
    code: string;
    hod_name: string | null;
}

// GET - Get single batch
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const batch = await queryOne<BatchRow>(
            `SELECT d.id, d.name, d.code,
                    CONCAT(u.first_name, ' ', u.last_name) as hod_name
             FROM batches d
             LEFT JOIN users u ON u.batch_id = d.id AND u.role = 'teacher'
             WHERE d.id = $1`,
            [id]
        );

        if (!batch) {
            return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
        }

        return NextResponse.json({ batch });
    } catch (error) {
        console.error('Get batch error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// PUT - Update batch (super_admin only)
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyToken(token);
        if (!payload || payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { name, code } = await request.json();

        const batches = await query<BatchRow>(
            `UPDATE batches SET name = $1, code = $2, updated_at = NOW()
             WHERE id = $3 RETURNING *, NULL as hod_name`,
            [name, code?.toUpperCase(), id]
        );

        if (batches.length === 0) {
            return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
        }

        return NextResponse.json({ batch: batches[0] });
    } catch (error) {
        console.error('Update batch error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Delete batch (super_admin only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyToken(token);
        if (!payload || payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const batches = await query<BatchRow>(
            'DELETE FROM batches WHERE id = $1 RETURNING *',
            [id]
        );

        if (batches.length === 0) {
            return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Batch deleted' });
    } catch (error) {
        console.error('Delete batch error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
