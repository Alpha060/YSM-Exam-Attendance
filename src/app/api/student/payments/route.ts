import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface PaymentRow {
    id: string;
    student_id: string;
    amount: number;
    currency: string;
    status: string;
    payment_method: string | null;
    transaction_id: string | null;
    description: string;
    paid_at: string | null;
    created_at: string;
}

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyToken(token);

        if (!payload || payload.role !== 'student') {
            return NextResponse.json({ error: 'Access denied. Students only.' }, { status: 403 });
        }

        const payments = await query<PaymentRow>(
            `SELECT * FROM payments 
             WHERE student_id = $1 
             ORDER BY created_at DESC`,
            [payload.userId]
        );

        // Fetch Razorpay configuration
        const configRow = await queryOne<{ value: any }>(
            `SELECT value FROM application_settings WHERE key = 'razorpay_config'`
        );

        const razorpay = configRow?.value ? {
            enabled: configRow.value.enabled ?? false,
            keyId: configRow.value.keyId || '',
            merchantName: configRow.value.merchantName || 'YSM Ranchi',
            themeColor: configRow.value.themeColor || '#4f6dbc'
        } : {
            enabled: false,
            keyId: '',
            merchantName: 'YSM Ranchi',
            themeColor: '#4f6dbc'
        };

        return NextResponse.json({ payments, razorpay });
    } catch (error) {
        console.error('Fetch student payments error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyToken(token);

        if (!payload || payload.role !== 'student') {
            return NextResponse.json({ error: 'Access denied. Students only.' }, { status: 403 });
        }

        const body = await request.json();
        const { paymentId, paymentMethod, transactionId } = body;

        if (!paymentId) {
            return NextResponse.json({ error: 'Payment ID is required.' }, { status: 400 });
        }

        // Verify payment belongs to this student
        const payment = await queryOne<PaymentRow>(
            `SELECT * FROM payments WHERE id = $1 AND student_id = $2`,
            [paymentId, payload.userId]
        );

        if (!payment) {
            return NextResponse.json({ error: 'Payment record not found.' }, { status: 404 });
        }

        if (payment.status === 'completed') {
            return NextResponse.json({ error: 'Payment is already completed.' }, { status: 400 });
        }

        // Update payment status
        await query(
            `UPDATE payments 
             SET status = 'completed', 
                 payment_method = $1, 
                 transaction_id = $2, 
                 paid_at = CURRENT_TIMESTAMP 
             WHERE id = $3`,
            [paymentMethod || 'Razorpay Checkout', transactionId || `pay_${Math.random().toString(36).substr(2, 9)}`, paymentId]
        );

        return NextResponse.json({
            message: 'Payment completed successfully!',
            paymentId
        });
    } catch (error) {
        console.error('Complete payment error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
