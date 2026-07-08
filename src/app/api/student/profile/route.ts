import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function PUT(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyToken(token);

        if (!payload || payload.role !== 'student') {
            return NextResponse.json({ error: 'Access denied. Students only.' }, { status: 403 });
        }

        const body = await request.json();
        const { phone, dob, gender, guardianName, address, state, pincode } = body;

        // Update student profile fields
        await query(
            `UPDATE students 
             SET phone = $1, 
                 dob = $2, 
                 gender = $3, 
                 guardian_name = $4, 
                 address = $5, 
                 state = $6, 
                 pincode = $7,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8`,
            [
                phone || null,
                dob || null,
                gender || null,
                guardianName || null,
                address || null,
                state || null,
                pincode || null,
                payload.userId
            ]
        );

        return NextResponse.json({
            message: 'Profile updated successfully!'
        });
    } catch (error) {
        console.error('Update student profile error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
