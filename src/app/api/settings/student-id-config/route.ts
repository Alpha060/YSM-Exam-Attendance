import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Default config if none is set
const DEFAULT_CONFIG = {
    prefix: 'YSM-COMP'
};

export async function GET(request: NextRequest) {
    try {
        const token = request.headers.get('Authorization')?.split(' ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const decoded = await verifyToken(token);
        if (!decoded || decoded.role !== 'super_admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const result = await queryOne<{ value: any }>(
            "SELECT value FROM application_settings WHERE key = 'student_id_config'"
        );

        if (result && result.value) {
            return NextResponse.json(result.value);
        }
        
        return NextResponse.json(DEFAULT_CONFIG);
    } catch (error) {
        console.error('Error fetching student ID config:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const token = request.headers.get('Authorization')?.split(' ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const decoded = await verifyToken(token);
        if (!decoded || decoded.role !== 'super_admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        
        // Validate
        if (!body.prefix || typeof body.prefix !== 'string') {
            return NextResponse.json({ error: 'Invalid config payload' }, { status: 400 });
        }

        // Clean up prefix
        const cleanPrefix = body.prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

        const config = { prefix: cleanPrefix || 'YSM-COMP' };

        await query(
            `INSERT INTO application_settings (key, value) 
             VALUES ('student_id_config', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
            [JSON.stringify(config)]
        );

        return NextResponse.json({ message: 'Config updated successfully', config });
    } catch (error) {
        console.error('Error updating student ID config:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
