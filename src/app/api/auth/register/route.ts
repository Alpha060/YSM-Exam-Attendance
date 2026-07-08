import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        const firstName = body.firstName?.trim();
        const lastName = body.lastName?.trim() || '';
        const email = body.email?.trim()?.toLowerCase();
        const password = body.password;
        
        const studentId = body.studentId?.trim(); // College Roll
        const batchId = body.batchId;    // Selected Batch
        
        const phone = body.phone?.trim() || null;
        const dob = body.dob || null;
        const gender = body.gender || null;
        const guardianName = body.guardianName?.trim() || null;
        const address = body.address?.trim() || null;
        const state = body.state?.trim() || null;
        const pincode = body.pincode?.trim() || null;
        
        const batchYear = body.batchYear ? parseInt(body.batchYear) : new Date().getFullYear();

        // 1. Validations
        if (!firstName || !email || !password || !batchId) {
            return NextResponse.json(
                { error: 'First name, email, password, and batch are required.' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters.' },
                { status: 400 }
            );
        }

        // 2. Check duplicate email in users
        const existingUser = await queryOne<{ id: string }>(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        if (existingUser) {
            return NextResponse.json(
                { error: 'A user with this email address already exists.' },
                { status: 400 }
            );
        }

        // 3. Hash password
        const passwordHash = await hashPassword(password);

        // 4. Calculate automatic roll number for batch
        const rollResult = await queryOne<{ max_roll: any }>(
            'SELECT MAX(roll_number) as max_roll FROM students WHERE batch_id = $1 AND batch_year = $2',
            [batchId, batchYear]
        );
        const rollNumber = (parseInt(rollResult?.max_roll) || 0) + 1;

        // 5. Auto-generate studentId using Batch Code as prefix
        const batchResult = await queryOne<{ code: string, tuition_fee: string }>(
            'SELECT code, tuition_fee FROM batches WHERE id = $1',
            [batchId]
        );
        const prefix = batchResult?.code || 'BATCH';
        const paddedRoll = rollNumber.toString().padStart(4, '0');
        const generatedCoachingId = `${prefix}-${batchYear}-${paddedRoll}`;

        // 6. Insert User row (role = 'student')
        const userResult = await queryOne<{ id: string }>(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, batch_id)
             VALUES ($1, $2, $3, $4, 'student', $5)
             RETURNING id`,
            [email, passwordHash, firstName, lastName, batchId]
        );

        if (!userResult) {
            throw new Error('Failed to create user record.');
        }

        const newStudentUuid = userResult.id;

        // 7. Insert Student row (use same UUID)
        await query(
            `INSERT INTO students (
                id, student_id, coaching_id, roll_number, first_name, last_name, email, 
                phone, dob, gender, guardian_name, address, state, pincode, 
                batch_id, current_semester, batch_year
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 1, $16)`,
            [
                newStudentUuid, studentId, generatedCoachingId, rollNumber, firstName, lastName, email,
                phone, dob, gender, guardianName, address, state, pincode,
                batchId, batchYear
            ]
        );

        // 8. Auto-enroll in batch subjects
        const academicYear = (() => {
            const now = new Date();
            const y = now.getFullYear();
            return now.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
        })();
        await query(
            `INSERT INTO student_subjects (student_id, subject_id, academic_year)
             SELECT $1, s.id, $2 FROM subjects s
             WHERE s.batch_id = $3
             ON CONFLICT (student_id, subject_id, academic_year) DO NOTHING`,
            [newStudentUuid, academicYear, batchId]
        );

        // 9. Fetch dynamic fee settings and seed invoices
        const feeConfigRow = await queryOne<{ value: any }>(
            `SELECT value FROM application_settings WHERE key = 'course_fee_config'`
        );
        const registrationFee = feeConfigRow?.value?.registrationFee ?? 500;
        const tuitionFee = batchResult?.tuition_fee ? Number(batchResult.tuition_fee) : 0;

        await query(
            `INSERT INTO payments (student_id, amount, currency, status, description)
             VALUES 
             ($1, $2, 'INR', 'pending', 'Admission & Registration Fee'),
             ($1, $3, 'INR', 'pending', 'Course Tuition Fee')`,
            [newStudentUuid, registrationFee, tuitionFee]
        );

        return NextResponse.json({
            message: 'Student registered successfully!',
            studentId: newStudentUuid
        }, { status: 201 });

    } catch (error) {
        console.error('Student registration error:', error);
        return NextResponse.json(
            { error: 'Server error during registration. Please try again.' },
            { status: 500 }
        );
    }
}
