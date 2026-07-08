import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { comparePassword, generateToken } from '@/lib/auth';

interface UserRow {
    id: string;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    role: 'super_admin' | 'teacher';
    batch_id: string | null;
}

export async function POST(request: NextRequest) {
    try {
        const { email, password, rememberMe } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        // Find user by email, coaching_id, or student_id
        const user = await queryOne<UserRow>(
            `SELECT u.* FROM users u 
             LEFT JOIN students s ON u.id = s.id 
             WHERE u.email = $1 OR s.coaching_id = $1 OR s.student_id = $1`,
            [email]
        );

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await comparePassword(password, user.password_hash);
        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Generate JWT token (30 days if rememberMe, else default 7 days)
        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            batchId: user.batch_id || undefined,
        }, !!rememberMe);

        return NextResponse.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                batchId: user.batch_id,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Server error' },
            { status: 500 }
        );
    }
}
