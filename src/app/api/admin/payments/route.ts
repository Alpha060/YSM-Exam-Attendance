import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// ── Helper: Validate admin access ──
function getAdminPayload(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'super_admin') return null;
    return payload;
}

// ── GET: List all payment records with filters ──
export async function GET(request: NextRequest) {
    try {
        const payload = getAdminPayload(request);
        if (!payload) {
            return NextResponse.json({ error: 'Access denied. Admins only.' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const batchId = searchParams.get('batchId');
        const status = searchParams.get('status'); // 'pending' | 'completed' | 'failed' | 'refunded'
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params: unknown[] = [];
        let paramIdx = 1;

        if (batchId) {
            whereClause += ` AND s.batch_id = $${paramIdx++}`;
            params.push(batchId);
        }
        if (status) {
            whereClause += ` AND p.status = $${paramIdx++}`;
            params.push(status);
        }
        if (search) {
            whereClause += ` AND (
                LOWER(s.first_name || ' ' || s.last_name) LIKE $${paramIdx} OR
                LOWER(s.student_id) LIKE $${paramIdx} OR
                LOWER(s.coaching_id) LIKE $${paramIdx} OR
                CAST(s.roll_number AS TEXT) LIKE $${paramIdx}
            )`;
            params.push(`%${search.toLowerCase()}%`);
            paramIdx++;
        }

        // Count total for pagination
        const countResult = await queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM payments p
             JOIN students s ON p.student_id = s.id
             ${whereClause}`,
            params
        );
        const total = parseInt(countResult?.count || '0');

        // Get paginated records
        const payments = await query(
            `SELECT 
                p.id, p.student_id, p.amount, p.currency, p.status, 
                p.payment_method, p.transaction_id, p.description, 
                p.paid_at, p.created_at,
                s.first_name, s.last_name, s.roll_number, s.coaching_id,
                s.email, s.phone,
                b.name as batch_name, b.code as batch_code, s.batch_id
             FROM payments p
             JOIN students s ON p.student_id = s.id
             LEFT JOIN batches b ON s.batch_id = b.id
             ${whereClause}
             ORDER BY p.created_at DESC
             LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset]
        );

        // Summary stats
        const stats = await queryOne<{
            total_collected: string;
            total_pending: string;
            count_pending: string;
            count_paid: string;
        }>(
            `SELECT 
                COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as total_collected,
                COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END), 0) as total_pending,
                COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as count_pending,
                COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as count_paid
             FROM payments p
             JOIN students s ON p.student_id = s.id
             ${batchId ? 'WHERE s.batch_id = $1' : ''}`,
            batchId ? [batchId] : []
        );

        return NextResponse.json({
            payments,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            stats: {
                totalCollected: parseFloat(stats?.total_collected || '0'),
                totalPending: parseFloat(stats?.total_pending || '0'),
                countPending: parseInt(stats?.count_pending || '0'),
                countPaid: parseInt(stats?.count_paid || '0'),
            }
        });
    } catch (error) {
        console.error('Admin fetch payments error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── POST: Create new fee records (single or bulk) ──
export async function POST(request: NextRequest) {
    try {
        const payload = getAdminPayload(request);
        if (!payload) {
            return NextResponse.json({ error: 'Access denied. Admins only.' }, { status: 403 });
        }

        const body = await request.json();
        const { description, amount, currency, studentId, batchId } = body;

        if (!description || !amount || amount <= 0) {
            return NextResponse.json({ error: 'Description and a positive amount are required.' }, { status: 400 });
        }

        const cur = currency || 'INR';

        if (studentId) {
            // Single student billing
            const student = await queryOne<{ id: string }>(`SELECT id FROM students WHERE id = $1`, [studentId]);
            if (!student) {
                return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
            }

            await query(
                `INSERT INTO payments (student_id, amount, currency, status, description) 
                 VALUES ($1, $2, $3, 'pending', $4)`,
                [studentId, amount, cur, description]
            );

            return NextResponse.json({ message: 'Fee assigned to student successfully.', count: 1 });
        } else if (batchId) {
            // Bulk billing for all students in a batch
            const students = await query<{ id: string }>(`SELECT id FROM students WHERE batch_id = $1`, [batchId]);

            if (students.length === 0) {
                return NextResponse.json({ error: 'No students found in this batch.' }, { status: 404 });
            }

            // Build bulk insert
            const values: unknown[] = [];
            const placeholders: string[] = [];
            let idx = 1;
            for (const s of students) {
                placeholders.push(`($${idx++}, $${idx++}, $${idx++}, 'pending', $${idx++})`);
                values.push(s.id, amount, cur, description);
            }

            await query(
                `INSERT INTO payments (student_id, amount, currency, status, description)
                 VALUES ${placeholders.join(', ')}`,
                values
            );

            return NextResponse.json({ message: `Fee assigned to ${students.length} students.`, count: students.length });
        } else {
            return NextResponse.json({ error: 'Either studentId or batchId is required.' }, { status: 400 });
        }
    } catch (error) {
        console.error('Admin create payment error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── PUT: Update payment record (mark paid, fail, refund, edit amount) ──
export async function PUT(request: NextRequest) {
    try {
        const payload = getAdminPayload(request);
        if (!payload) {
            return NextResponse.json({ error: 'Access denied. Admins only.' }, { status: 403 });
        }

        const body = await request.json();
        const { paymentId, action, paymentMethod, transactionId, paidAt, remarks, amount } = body;

        if (!paymentId || !action) {
            return NextResponse.json({ error: 'paymentId and action are required.' }, { status: 400 });
        }

        const existing = await queryOne<{ id: string; status: string }>(`SELECT id, status FROM payments WHERE id = $1`, [paymentId]);
        if (!existing) {
            return NextResponse.json({ error: 'Payment record not found.' }, { status: 404 });
        }

        switch (action) {
            case 'mark_paid': {
                await query(
                    `UPDATE payments 
                     SET status = 'completed', 
                         payment_method = $1, 
                         transaction_id = $2, 
                         paid_at = $3,
                         description = CASE WHEN $4 != '' THEN description || ' [Admin: ' || $4 || ']' ELSE description END
                     WHERE id = $5`,
                    [
                        paymentMethod || 'Cash',
                        transactionId || null,
                        paidAt || new Date().toISOString(),
                        remarks || '',
                        paymentId
                    ]
                );
                return NextResponse.json({ message: 'Payment marked as paid.' });
            }
            case 'mark_failed': {
                await query(`UPDATE payments SET status = 'failed' WHERE id = $1`, [paymentId]);
                return NextResponse.json({ message: 'Payment marked as failed.' });
            }
            case 'mark_refunded': {
                await query(`UPDATE payments SET status = 'refunded' WHERE id = $1`, [paymentId]);
                return NextResponse.json({ message: 'Payment marked as refunded.' });
            }
            case 'edit_amount': {
                if (!amount || amount <= 0) {
                    return NextResponse.json({ error: 'A positive amount is required.' }, { status: 400 });
                }
                if (existing.status !== 'pending') {
                    return NextResponse.json({ error: 'Can only edit amount of pending bills.' }, { status: 400 });
                }
                await query(`UPDATE payments SET amount = $1 WHERE id = $2`, [amount, paymentId]);
                return NextResponse.json({ message: 'Amount updated.' });
            }
            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (error) {
        console.error('Admin update payment error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── DELETE: Remove a pending fee record ──
export async function DELETE(request: NextRequest) {
    try {
        const payload = getAdminPayload(request);
        if (!payload) {
            return NextResponse.json({ error: 'Access denied. Admins only.' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const paymentId = searchParams.get('id');

        if (!paymentId) {
            return NextResponse.json({ error: 'Payment ID is required.' }, { status: 400 });
        }

        const existing = await queryOne<{ id: string; status: string }>(`SELECT id, status FROM payments WHERE id = $1`, [paymentId]);
        if (!existing) {
            return NextResponse.json({ error: 'Payment record not found.' }, { status: 404 });
        }

        if (existing.status === 'completed') {
            return NextResponse.json({ error: 'Cannot delete a completed payment. Mark it as refunded instead.' }, { status: 400 });
        }

        await query(`DELETE FROM payments WHERE id = $1`, [paymentId]);
        return NextResponse.json({ message: 'Payment record deleted.' });
    } catch (error) {
        console.error('Admin delete payment error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
