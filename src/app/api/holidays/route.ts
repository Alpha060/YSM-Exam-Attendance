import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface HolidayRow {
    id: string;
    name: string;
    date: string;
    description: string | null;
    batch_id: string | null;
}

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

        try {
            let queryStr = 'SELECT id, name, date, description, batch_id FROM holidays';
            const params: any[] = [];

            if (payload.role === 'super_admin' && payload.batchId) {
                queryStr += ' WHERE batch_id IS NULL OR batch_id = $1';
                params.push(payload.batchId);
            } else if (payload.role === 'teacher') {
                queryStr += ` WHERE batch_id IS NULL OR batch_id IN (
                    SELECT batch_id FROM user_batches WHERE user_id = $1
                )`;
                params.push(payload.userId);
            }
            
            queryStr += ' ORDER BY date ASC';

            const holidays = await query<HolidayRow>(queryStr, params);
            return NextResponse.json({ holidays });
        } catch (err) {
            console.error('Holidays query error:', err);
            return NextResponse.json({ holidays: [] });
        }
    } catch (error) {
        console.error('Get holidays error:', error);
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
        if (!payload || !['super_admin'].includes(payload.role)) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { name, date, description } = await request.json();

        if (!name || !date) {
            return NextResponse.json({ error: 'Name and date are required' }, { status: 400 });
        }

        const batchId = payload.role === 'super_admin' ? payload.batchId : null;

        const holidays = await query<HolidayRow>(
            `INSERT INTO holidays (name, date, description, batch_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, date, description || null, batchId]
        );

        return NextResponse.json({ holiday: holidays[0] }, { status: 201 });
    } catch (error) {
        console.error('Create holiday error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
