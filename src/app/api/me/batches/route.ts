import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface BatchRow {
    id: string;
    name: string;
    code: string;
}

// GET - Fetch only the authenticated user's batches (primary + additional)
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

        // Single query: Get primary batch + all additional batches (active only)
        const batches = await query<BatchRow>(
            `SELECT d.id, d.name, d.code
             FROM batches d
             WHERE d.id = (SELECT batch_id FROM users WHERE id = $1)
             AND COALESCE(d.status, 'active') = 'active'
             UNION
             SELECT d.id, d.name, d.code
             FROM batches d
             JOIN user_batches ud ON d.id = ud.batch_id
             WHERE ud.user_id = $1
             AND COALESCE(d.status, 'active') = 'active'`,
            [payload.userId]
        );

        return NextResponse.json({
            batches: batches.map(d => ({
                id: d.id,
                name: d.name,
                code: d.code,
            }))
        });
    } catch (error) {
        console.error('Get user batches error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
