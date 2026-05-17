import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface DepartmentRow {
    id: string;
    name: string;
    code: string;
}

// GET - Fetch only the authenticated user's departments (primary + additional)
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

        // Single query: Get primary department + all additional departments (active only)
        const departments = await query<DepartmentRow>(
            `SELECT d.id, d.name, d.code
             FROM departments d
             WHERE d.id = (SELECT department_id FROM users WHERE id = $1)
             AND COALESCE(d.status, 'active') = 'active'
             UNION
             SELECT d.id, d.name, d.code
             FROM departments d
             JOIN user_departments ud ON d.id = ud.department_id
             WHERE ud.user_id = $1
             AND COALESCE(d.status, 'active') = 'active'`,
            [payload.userId]
        );

        return NextResponse.json({
            departments: departments.map(d => ({
                id: d.id,
                name: d.name,
                code: d.code,
            }))
        });
    } catch (error) {
        console.error('Get user departments error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
