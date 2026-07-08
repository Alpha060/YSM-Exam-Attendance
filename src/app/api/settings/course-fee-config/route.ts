import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface CourseFeeConfigRow {
    value: {
        registrationFee?: number;
        durationMonths?: number;
        academyName?: string;
        academySubName?: string;
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

        const row = await queryOne<CourseFeeConfigRow>(
            `SELECT value FROM application_settings WHERE key = 'course_fee_config'`
        );

        if (row && row.value) {
            return NextResponse.json({
                registrationFee: row.value.registrationFee ?? 500,
                durationMonths: row.value.durationMonths ?? 6,
                academyName: row.value.academyName ?? 'YSM Academy',
                academySubName: row.value.academySubName ?? 'Competition Wing',
            });
        }

        return NextResponse.json({
            registrationFee: 500,
            durationMonths: 6,
            academyName: 'YSM Academy',
            academySubName: 'Competition Wing',
        });
    } catch (error) {
        console.error('Course fee config fetch error:', error);
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
        const { registrationFee, durationMonths, academyName, academySubName } = body;

        const configValue = {
            registrationFee: Number(registrationFee) || 0,
            durationMonths: Number(durationMonths) || 0,
            academyName: String(academyName || 'YSM Academy').trim(),
            academySubName: String(academySubName || 'Competition Wing').trim(),
        };

        await query(
            `INSERT INTO application_settings (key, value, updated_at) 
             VALUES ('course_fee_config', $1::jsonb, CURRENT_TIMESTAMP) 
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [JSON.stringify(configValue)]
        );

        // Update all existing pending registration fee invoices to the newly set value
        await query(
            `UPDATE payments 
             SET amount = $1 
             WHERE status = 'pending' 
             AND description = 'Admission & Registration Fee'`,
            [configValue.registrationFee]
        );

        return NextResponse.json({
            message: 'Course configuration saved successfully',
            config: configValue,
        });
    } catch (error) {
        console.error('Course fee config save error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
