import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import crypto from 'crypto';

// Razorpay Webhook receiver — no JWT auth; uses signature verification
export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-razorpay-signature');

        if (!signature) {
            return NextResponse.json({ error: 'Missing signature header.' }, { status: 400 });
        }

        // Fetch webhook secret from database
        const configRow = await queryOne<{ value: any }>(
            `SELECT value FROM application_settings WHERE key = 'razorpay_config'`
        );

        const webhookSecret = configRow?.value?.webhookSecret;
        if (!webhookSecret) {
            console.error('[Razorpay Webhook] No webhook secret configured.');
            return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 });
        }

        // Verify HMAC SHA256 signature
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');

        if (expectedSignature !== signature) {
            console.error('[Razorpay Webhook] Signature mismatch.');
            return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
        }

        // Parse event
        const event = JSON.parse(rawBody);
        const eventType = event.event;

        console.log(`[Razorpay Webhook] Received event: ${eventType}`);

        if (eventType === 'payment.captured' || eventType === 'order.paid') {
            const paymentEntity = event.payload?.payment?.entity;
            if (!paymentEntity) {
                return NextResponse.json({ status: 'ignored', reason: 'No payment entity.' });
            }

            const razorpayPaymentId = paymentEntity.id; // e.g. pay_xxx
            const notes = paymentEntity.notes || {};
            const internalPaymentId = notes.payment_id; // Our internal payment ID passed during checkout

            if (internalPaymentId) {
                // Update internal payment record
                const existing = await queryOne<{ id: string; status: string }>(
                    `SELECT id, status FROM payments WHERE id = $1`,
                    [internalPaymentId]
                );

                if (existing && existing.status !== 'completed') {
                    await query(
                        `UPDATE payments 
                         SET status = 'completed', 
                             payment_method = 'Razorpay',
                             transaction_id = $1, 
                             paid_at = CURRENT_TIMESTAMP
                         WHERE id = $2`,
                        [razorpayPaymentId, internalPaymentId]
                    );
                    console.log(`[Razorpay Webhook] Payment ${internalPaymentId} marked as completed via ${razorpayPaymentId}.`);
                }
            } else {
                // Attempt to match by transaction_id if the student already submitted the Razorpay ID
                const existing = await queryOne<{ id: string }>(
                    `SELECT id FROM payments WHERE transaction_id = $1`,
                    [razorpayPaymentId]
                );
                if (existing) {
                    await query(
                        `UPDATE payments SET status = 'completed', paid_at = CURRENT_TIMESTAMP WHERE id = $1`,
                        [existing.id]
                    );
                }
            }

            return NextResponse.json({ status: 'ok' });
        }

        if (eventType === 'payment.failed') {
            const paymentEntity = event.payload?.payment?.entity;
            const notes = paymentEntity?.notes || {};
            const internalPaymentId = notes.payment_id;

            if (internalPaymentId) {
                await query(
                    `UPDATE payments SET status = 'failed' WHERE id = $1 AND status = 'pending'`,
                    [internalPaymentId]
                );
                console.log(`[Razorpay Webhook] Payment ${internalPaymentId} marked as failed.`);
            }

            return NextResponse.json({ status: 'ok' });
        }

        // Unhandled event type
        return NextResponse.json({ status: 'ignored', reason: `Unhandled event: ${eventType}` });
    } catch (error) {
        console.error('[Razorpay Webhook] Processing error:', error);
        return NextResponse.json({ error: 'Webhook processing error.' }, { status: 500 });
    }
}
