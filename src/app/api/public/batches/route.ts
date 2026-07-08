import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const batches = await query<{ id: string; name: string; code: string }>(
            `SELECT id, name, code 
             FROM batches 
             WHERE COALESCE(status, 'active') = 'active'
             ORDER BY name ASC`
        );
        return NextResponse.json({ batches });
    } catch (error) {
        console.error('Fetch public batches error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
