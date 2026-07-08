import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET - Fetch assignments for a batch on a date
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const payload = verifyToken(authHeader.split(' ')[1]);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const batchId = searchParams.get('batchId');
        const date = searchParams.get('date');

        if (!date) {
            return NextResponse.json({ error: 'date required' }, { status: 400 });
        }

        let queryStr = `SELECT 
                dca.batch_id, dca.id, dca.semester, dca.slot_number, dca.teacher_id, dca.subject_id,
                u.first_name as teacher_first_name, u.last_name as teacher_last_name,
                s.name as subject_name, s.code as subject_code, s.paper_code
             FROM daily_class_assignments dca
             JOIN users u ON dca.teacher_id = u.id
             JOIN subjects s ON dca.subject_id = s.id
             WHERE dca.date = $1`;
             
        const params: any[] = [date];
        let paramIndex = 2;

        if (batchId) {
            queryStr += ` AND dca.batch_id = $${paramIndex}`;
            params.push(batchId);
            paramIndex++;
        } else if (payload.role === 'super_admin') {
            queryStr += ` AND dca.batch_id IN (
                SELECT batch_id FROM user_batches WHERE user_id = $${paramIndex}
                UNION
                SELECT batch_id FROM users WHERE id = $${paramIndex}
            )`;
            params.push(payload.userId);
            paramIndex++;
        }
        
        queryStr += ` ORDER BY dca.batch_id, dca.semester, dca.slot_number`;

        const assignments = await query<{
            batch_id: string;
            id: string;
            semester: number;
            slot_number: number;
            teacher_id: string;
            subject_id: string;
            teacher_first_name: string;
            teacher_last_name: string;
            subject_name: string;
            subject_code: string;
            paper_code: string | null;
        }>(queryStr, params);

        return NextResponse.json({ assignments });
    } catch (error) {
        console.error('Get assignments error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST - Upsert a single assignment (or batch)
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const payload = verifyToken(authHeader.split(' ')[1]);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        if (!['super_admin'].includes(payload.role)) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { batchId, date, assignments } = await request.json();

        if (!batchId || !date || !assignments || !Array.isArray(assignments)) {
            return NextResponse.json({ error: 'batchId, date, and assignments required' }, { status: 400 });
        }

        // Block assignments on Sundays
        const assignDate = new Date(date + 'T00:00:00');
        if (assignDate.getDay() === 0) {
            return NextResponse.json({ error: 'Cannot assign classes on Sunday' }, { status: 400 });
        }

        // Block assignments on holidays
        const holidayCheck = await query<{ id: string }>(
            `SELECT id FROM holidays
             WHERE date = $1 AND (batch_id IS NULL OR batch_id = $2)
             LIMIT 1`,
            [date, batchId]
        );
        if (holidayCheck.length > 0) {
            return NextResponse.json({ error: 'Cannot assign classes on a holiday' }, { status: 400 });
        }

        // HOD must own the batch
        if (payload.role === 'super_admin') {
            const owned = await query<{ batch_id: string }>(
                `SELECT batch_id FROM user_batches WHERE user_id = $1 AND batch_id = $2
                 UNION
                 SELECT batch_id FROM users WHERE id = $1 AND batch_id = $2`,
                [payload.userId, batchId]
            );
            if (owned.length === 0) {
                return NextResponse.json({ error: 'Access denied for this batch' }, { status: 403 });
            }
        }

        let upsertCount = 0;
        for (const a of assignments) {
            if (!a.semester || !a.slotNumber || !a.teacherId || !a.subjectId) continue;

            await query(
                `INSERT INTO daily_class_assignments (batch_id, semester, slot_number, teacher_id, subject_id, date, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (batch_id, semester, slot_number, date)
                 DO UPDATE SET teacher_id = $4, subject_id = $5, created_by = $7, created_at = CURRENT_TIMESTAMP`,
                [batchId, a.semester, a.slotNumber, a.teacherId, a.subjectId, date, payload.userId]
            );
            upsertCount++;
        }

        return NextResponse.json({ message: `${upsertCount} assignment(s) saved`, count: upsertCount });
    } catch (error) {
        console.error('Save assignments error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Remove a specific assignment or all for dept+date
export async function DELETE(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const payload = verifyToken(authHeader.split(' ')[1]);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        if (!['super_admin'].includes(payload.role)) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const batchId = searchParams.get('batchId');
        const date = searchParams.get('date');
        const semester = searchParams.get('semester');
        const slotNumber = searchParams.get('slotNumber');

        if (!batchId || !date) {
            return NextResponse.json({ error: 'batchId and date required' }, { status: 400 });
        }

        // HOD must own the batch
        if (payload.role === 'super_admin') {
            const owned = await query<{ batch_id: string }>(
                `SELECT batch_id FROM user_batches WHERE user_id = $1 AND batch_id = $2
                 UNION
                 SELECT batch_id FROM users WHERE id = $1 AND batch_id = $2`,
                [payload.userId, batchId]
            );
            if (owned.length === 0) {
                return NextResponse.json({ error: 'Access denied for this batch' }, { status: 403 });
            }
        }

        if (semester && slotNumber) {
            // Delete specific cell
            await query(
                `DELETE FROM daily_class_assignments
                 WHERE batch_id = $1 AND date = $2 AND semester = $3 AND slot_number = $4`,
                [batchId, date, parseInt(semester), parseInt(slotNumber)]
            );
        } else {
            // Clear all assignments for dept + date
            await query(
                `DELETE FROM daily_class_assignments WHERE batch_id = $1 AND date = $2`,
                [batchId, date]
            );
        }

        return NextResponse.json({ message: 'Assignment(s) deleted' });
    } catch (error) {
        console.error('Delete assignments error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
