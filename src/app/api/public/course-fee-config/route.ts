import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

interface CourseFeeConfigRow {
    value: {
        registrationFee?: number;
        monthlyFee?: number;
        durationMonths?: number;
        academyName?: string;
        academySubName?: string;
    };
}

export async function GET(request: NextRequest) {
    try {
        const row = await queryOne<CourseFeeConfigRow>(
            `SELECT value FROM application_settings WHERE key = 'course_fee_config'`
        );

        if (row && row.value) {
            return NextResponse.json({
                registrationFee: row.value.registrationFee ?? 500,
                monthlyFee: row.value.monthlyFee ?? 1500,
                durationMonths: row.value.durationMonths ?? 6,
                academyName: row.value.academyName ?? 'YSM Academy',
                academySubName: row.value.academySubName ?? 'Competition Wing',
            });
        }

        return NextResponse.json({
            registrationFee: 500,
            monthlyFee: 1500,
            durationMonths: 6,
            academyName: 'YSM Academy',
            academySubName: 'Competition Wing',
        });
    } catch (error) {
        console.error('Public course fee config fetch error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
