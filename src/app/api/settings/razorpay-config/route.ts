import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RazorpayConfigRow {
    value: {
        keyId?: string;
        keySecret?: string;
        webhookSecret?: string;
        currency?: string;
        merchantName?: string;
        themeColor?: string;
        enabled?: boolean;
    };
}

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyToken(token);

        if (!payload || payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const row = await queryOne<RazorpayConfigRow>(
            `SELECT value FROM application_settings WHERE key = 'razorpay_config'`
        );

        if (row && row.value) {
            return NextResponse.json({
                keyId: row.value.keyId || '',
                keyIdSet: !!row.value.keyId,
                keySecretSet: !!row.value.keySecret,
                webhookSecretSet: !!row.value.webhookSecret,
                currency: row.value.currency || 'INR',
                merchantName: row.value.merchantName || '',
                themeColor: row.value.themeColor || '#4f6dbc',
                enabled: row.value.enabled ?? false,
            });
        }

        return NextResponse.json({
            keyId: '',
            keyIdSet: false,
            keySecretSet: false,
            webhookSecretSet: false,
            currency: 'INR',
            merchantName: '',
            themeColor: '#4f6dbc',
            enabled: false,
        });
    } catch (error) {
        console.error('Razorpay config fetch error:', error);
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

        if (!payload || payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const body = await request.json();
        const { keyId, keySecret, webhookSecret, currency, merchantName, themeColor, enabled } = body;

        // Fetch existing config for secret preservation
        const existing = await queryOne<RazorpayConfigRow>(
            `SELECT value FROM application_settings WHERE key = 'razorpay_config'`
        );

        let finalKeyId = keyId;
        if (!keyId && existing?.value?.keyId) {
            finalKeyId = existing.value.keyId;
        }

        let finalKeySecret = keySecret;
        if (!keySecret && existing?.value?.keySecret) {
            finalKeySecret = existing.value.keySecret;
        }

        let finalWebhookSecret = webhookSecret;
        if (!webhookSecret && existing?.value?.webhookSecret) {
            finalWebhookSecret = existing.value.webhookSecret;
        }

        const configValue = {
            keyId: finalKeyId || '',
            keySecret: finalKeySecret || '',
            webhookSecret: finalWebhookSecret || '',
            currency: currency || 'INR',
            merchantName: merchantName || '',
            themeColor: themeColor || '#4f6dbc',
            enabled: !!enabled,
        };

        await query(
            `INSERT INTO application_settings (key, value, updated_at) 
             VALUES ('razorpay_config', $1::jsonb, CURRENT_TIMESTAMP) 
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [JSON.stringify(configValue)]
        );

        return NextResponse.json({
            message: 'Razorpay configuration saved successfully',
            enabled: configValue.enabled,
        });
    } catch (error) {
        console.error('Razorpay config save error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
