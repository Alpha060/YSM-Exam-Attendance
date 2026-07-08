import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken, hashPassword } from '@/lib/auth';
import { parseCoachingId, extractRollNumber, matchBatchCode } from '@/lib/parseStudentId';

interface StudentRow {
    id: string;
    student_id: string;
    coaching_id: string | null;
    roll_number: number;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    dob: string | null;
    gender: string | null;
    guardian_name: string | null;
    address: string | null;
    state: string | null;
    pincode: string | null;
    batch_id: string;
    batch_name: string;
    batch_code: string;
    current_semester: number;
    batch_year: number;
    is_active: boolean;
}

// GET - List all students
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

        const { searchParams } = new URL(request.url);
        const batchId = searchParams.get('batchId');
        const subjectId = searchParams.get('subjectId');

        let queryStr = `
            SELECT s.*, d.name as batch_name, d.code as batch_code
            FROM students s
            LEFT JOIN batches d ON s.batch_id = d.id
            WHERE s.is_active = true
        `;
        const params: string[] = [];

        // Filter by batch (batch)
        if (batchId) {
            params.push(batchId);
            queryStr += ` AND s.batch_id = $${params.length}`;
        }

        // Filter by subject enrollment
        if (subjectId) {
            params.push(subjectId);
            queryStr += ` AND EXISTS (
                SELECT 1 FROM student_subjects ss 
                WHERE ss.student_id = s.id AND ss.subject_id = $${params.length}
            )`;
        }

        // Teachers only see students in their assigned batches
        if (payload.role === 'teacher') {
            params.push(payload.userId);
            queryStr += ` AND s.batch_id IN (
                SELECT batch_id FROM user_batches WHERE user_id = $${params.length}
                UNION
                SELECT batch_id FROM users WHERE id = $${params.length} AND batch_id IS NOT NULL
            )`;
        }

        queryStr += ' ORDER BY s.roll_number ASC, s.first_name ASC';

        const students = await query<StudentRow>(queryStr, params);

        return NextResponse.json({
            students: students.map(s => ({
                id: s.id,
                student_id: s.student_id,
                coaching_id: s.coaching_id,
                roll_number: s.roll_number,
                first_name: s.first_name,
                last_name: s.last_name,
                email: s.email,
                phone: s.phone,
                dob: s.dob,
                gender: s.gender,
                guardianName: s.guardian_name,
                address: s.address,
                state: s.state,
                pincode: s.pincode,
                batch_id: s.batch_id,
                batch_name: s.batch_name,
                batch_code: s.batch_code,
                current_semester: s.current_semester,
                batch_year: s.batch_year,
            }))
        });
    } catch (error) {
        console.error('Get students error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST - Create student (super_admin only)
export async function POST(request: NextRequest) {
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

        if (payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Only admins can add students' }, { status: 403 });
        }

        const body = await request.json();
        let studentId = body.studentId?.trim();
        const coachingId = body.coachingId?.trim()?.toUpperCase() || null;
        const firstName = body.firstName?.trim();
        const lastName = body.lastName?.trim() || '';
        const email = body.email?.trim() || null;
        let batchId = body.batchId;

        const phone = body.phone?.trim() || null;
        const dob = body.dob || null;
        const gender = body.gender || null;
        const guardianName = body.guardianName?.trim() || null;
        const address = body.address?.trim() || null;
        const state = body.state?.trim() || null;
        const pincode = body.pincode?.trim() || null;
        const password = body.password || 'Welcome@123';

        if (!firstName) {
            return NextResponse.json(
                { error: 'Student name is required' },
                { status: 400 }
            );
        }

        // Auto-detect batch from coaching ID if no explicit batchId
        if (!batchId && coachingId) {
            const allBatches = await query<{ id: string; code: string; status: string }>(
                'SELECT id, code, COALESCE(status, \'active\') as status FROM batches'
            );
            const batchCodes = allBatches.map(b => b.code);
            const matchedCode = matchBatchCode(coachingId, batchCodes);
            if (matchedCode) {
                const matchedBatch = allBatches.find(b => b.code.toUpperCase() === matchedCode.toUpperCase());
                if (matchedBatch) {
                    if (matchedBatch.status === 'completed') {
                        return NextResponse.json(
                            { error: `Batch "${matchedCode}" is completed. Cannot add students to a completed batch.` },
                            { status: 400 }
                        );
                    }
                    batchId = matchedBatch.id;
                }
            }
        }

        // If batchId provided directly, verify batch is not completed
        if (batchId) {
            const batch = await queryOne<{ status: string }>(
                'SELECT COALESCE(status, \'active\') as status FROM batches WHERE id = $1',
                [batchId]
            );
            if (batch?.status === 'completed') {
                return NextResponse.json(
                    { error: 'Cannot add students to a completed batch.' },
                    { status: 400 }
                );
            }
        }

        if (!batchId) {
            return NextResponse.json(
                { error: 'Could not determine batch. Please select a batch or use a valid coaching ID.' },
                { status: 400 }
            );
        }

        // Get batch year from coaching ID or body or current year
        let batchYear = body.batchYear ? parseInt(body.batchYear) : new Date().getFullYear();
        if (coachingId) {
            const parsed = parseCoachingId(coachingId);
            if (parsed.isValid && parsed.year) {
                batchYear = parsed.year;
            }
        }

        // Derive roll number
        let rollNumber = body.rollNumber ? parseInt(body.rollNumber) : 0;
        if (coachingId && rollNumber <= 0) {
            const extracted = extractRollNumber(coachingId);
            if (extracted !== null) {
                rollNumber = extracted;
            } else {
                return NextResponse.json(
                    { error: 'Invalid coaching ID format. Expected: prefix + year + number (e.g., LKS2026001)' },
                    { status: 400 }
                );
            }
        }

        // Auto-assign roll number based on registration order if not provided
        if (rollNumber <= 0) {
            const maxRoll = await queryOne<{ max_roll: number }>(
                'SELECT MAX(roll_number) as max_roll FROM students WHERE batch_id = $1 AND batch_year = $2',
                [batchId, batchYear]
            );
            rollNumber = (maxRoll?.max_roll || 0) + 1;
        }

        // Auto-generate student_id if not explicitly provided
        if (!studentId) {
            const configResult = await queryOne<{ value: any }>(
                "SELECT value FROM application_settings WHERE key = 'student_id_config'"
            );
            const prefix = configResult?.value?.prefix || 'YSM-COMP';
            const paddedRoll = rollNumber.toString().padStart(4, '0');
            studentId = `${prefix}-${batchYear}-${paddedRoll}`;
        }

        // Check for duplicate coaching ID
        if (coachingId) {
            const existingCoaching = await queryOne<{ id: string }>(
                'SELECT id FROM students WHERE coaching_id = $1',
                [coachingId]
            );
            if (existingCoaching) {
                return NextResponse.json(
                    { error: 'A student with this coaching ID already exists' },
                    { status: 400 }
                );
            }
        }

        let newStudentUuid = null;
        if (email) {
            // Check duplicate email in users
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

            const passwordHash = await hashPassword(password);
            const userResult = await queryOne<{ id: string }>(
                `INSERT INTO users (email, password_hash, first_name, last_name, role, batch_id)
                 VALUES ($1, $2, $3, $4, 'student', $5)
                 RETURNING id`,
                [email.toLowerCase(), passwordHash, firstName, lastName, batchId]
            );
            if (!userResult) {
                throw new Error('Failed to create user record.');
            }
            newStudentUuid = userResult.id;
        } else {
            const uuidResult = await queryOne<{ uuid: string }>(
                "SELECT uuid_generate_v4() as uuid"
            );
            newStudentUuid = uuidResult?.uuid;
        }

        const result = await query<{ id: string }>(
            `INSERT INTO students (
                id, student_id, coaching_id, roll_number, first_name, last_name, email,
                phone, dob, gender, guardian_name, address, state, pincode,
                batch_id, current_semester, batch_year
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 1, $16)
             RETURNING id`,
            [
                newStudentUuid, studentId, coachingId || null, rollNumber, firstName, lastName, email,
                phone, dob, gender, guardianName, address, state, pincode,
                batchId, batchYear
            ]
        );

        const newStudentId = result[0].id;

        // Auto-enroll student in ALL subjects of their batch
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
            [newStudentId, academicYear, batchId]
        );

        return NextResponse.json({
            student: { id: newStudentId },
            message: 'Student created successfully'
        }, { status: 201 });
    } catch (error: unknown) {
        console.error('Create student error:', error);
        if ((error as { code?: string }).code === '23505') {
            return NextResponse.json(
                { error: 'Student with this ID or coaching ID already exists' },
                { status: 400 }
            );
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// PUT - Update student (super_admin only)
export async function PUT(request: NextRequest) {
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

        if (payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Only admins can update students' }, { status: 403 });
        }

        const body = await request.json();
        const { id } = body;
        if (!id) {
            return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
        }

        // Check if updating to a completed batch
        if (body.batchId) {
            const batch = await queryOne<{ status: string }>(
                'SELECT COALESCE(status, \'active\') as status FROM batches WHERE id = $1',
                [body.batchId]
            );
            if (batch?.status === 'completed') {
                return NextResponse.json(
                    { error: 'Cannot move student to a completed batch.' },
                    { status: 400 }
                );
            }
        }

        // Get existing student first
        const existingStudent = await queryOne<{ email: string | null; first_name: string; last_name: string; batch_id: string }>(
            'SELECT email, first_name, last_name, batch_id FROM students WHERE id = $1',
            [id]
        );

        const email = body.email !== undefined ? (body.email?.trim() || null) : (existingStudent?.email || null);
        const firstName = body.firstName !== undefined ? body.firstName.trim() : (existingStudent?.first_name || '');
        const lastName = body.lastName !== undefined ? body.lastName.trim() : (existingStudent?.last_name || '');
        const batchId = body.batchId || (existingStudent?.batch_id || null);

        // Update or insert into users table if email exists
        if (email) {
            // Check if user row already exists
            const existingUser = await queryOne<{ id: string }>(
                'SELECT id FROM users WHERE id = $1',
                [id]
            );

            if (existingUser) {
                // Update user details
                await query(
                    `UPDATE users SET 
                        email = $2,
                        first_name = $3,
                        last_name = $4,
                        batch_id = $5,
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [id, email.toLowerCase(), firstName, lastName, batchId]
                );
            } else {
                // Check if the email is taken by another user
                const emailCheck = await queryOne<{ id: string }>(
                    'SELECT id FROM users WHERE email = $1',
                    [email.toLowerCase()]
                );
                if (emailCheck) {
                    return NextResponse.json(
                        { error: 'A user with this email address already exists.' },
                        { status: 400 }
                    );
                }

                // Insert new user
                const passwordHash = await hashPassword(body.password || 'Welcome@123');
                await query(
                    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, batch_id)
                     VALUES ($1, $2, $3, $4, $5, 'student', $6)`,
                    [id, email.toLowerCase(), passwordHash, firstName, lastName, batchId]
                );
            }

            // If a password was explicitly provided to reset
            if (body.password) {
                const passwordHash = await hashPassword(body.password);
                await query(
                    `UPDATE users SET password_hash = $2 WHERE id = $1`,
                    [id, passwordHash]
                );
            }
        } else {
            // If email is removed, delete corresponding user
            await query('DELETE FROM users WHERE id = $1', [id]);
        }

        const updateFields: string[] = [];
        const params: (string | number | null)[] = [id];
        let paramCount = 1;

        if (body.studentId) {
            updateFields.push(`student_id = $${++paramCount}`);
            params.push(body.studentId.trim());
        }
        if (body.coachingId !== undefined) {
            const cid = body.coachingId?.trim()?.toUpperCase() || null;
            updateFields.push(`coaching_id = $${++paramCount}`);
            params.push(cid);
            // Update roll number from coaching ID
            if (cid) {
                const extracted = extractRollNumber(cid);
                if (extracted !== null) {
                    updateFields.push(`roll_number = $${++paramCount}`);
                    params.push(extracted);
                }
            }
        }
        if (body.firstName !== undefined) {
            updateFields.push(`first_name = $${++paramCount}`);
            params.push(body.firstName.trim());
        }
        if (body.lastName !== undefined) {
            updateFields.push(`last_name = $${++paramCount}`);
            params.push(body.lastName?.trim() || '');
        }
        if (body.email !== undefined) {
            updateFields.push(`email = $${++paramCount}`);
            params.push(body.email?.trim() || null);
        }
        if (body.batchId) {
            updateFields.push(`batch_id = $${++paramCount}`);
            params.push(body.batchId);
        }
        if (body.batchYear !== undefined) {
            updateFields.push(`batch_year = $${++paramCount}`);
            params.push(body.batchYear ? parseInt(body.batchYear) : null);
        }
        if (body.phone !== undefined) {
            updateFields.push(`phone = $${++paramCount}`);
            params.push(body.phone?.trim() || null);
        }
        if (body.dob !== undefined) {
            updateFields.push(`dob = $${++paramCount}`);
            params.push(body.dob || null);
        }
        if (body.gender !== undefined) {
            updateFields.push(`gender = $${++paramCount}`);
            params.push(body.gender || null);
        }
        if (body.guardianName !== undefined) {
            updateFields.push(`guardian_name = $${++paramCount}`);
            params.push(body.guardianName?.trim() || null);
        }
        if (body.address !== undefined) {
            updateFields.push(`address = $${++paramCount}`);
            params.push(body.address?.trim() || null);
        }
        if (body.state !== undefined) {
            updateFields.push(`state = $${++paramCount}`);
            params.push(body.state?.trim() || null);
        }
        if (body.pincode !== undefined) {
            updateFields.push(`pincode = $${++paramCount}`);
            params.push(body.pincode?.trim() || null);
        }

        if (updateFields.length > 0) {
            await query(
                `UPDATE students SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                params
            );
        }

        // If batch (batchId) was changed, re-sync student subjects
        if (body.batchId && body.batchId !== existingStudent?.batch_id) {
            const academicYear = (() => {
                const now = new Date();
                const y = now.getFullYear();
                return now.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
            })();
            // Remove old subject enrollments
            await query(
                'DELETE FROM student_subjects WHERE student_id = $1 AND academic_year = $2',
                [id, academicYear]
            );
            // Auto-enroll in all subjects of the new batch
            await query(
                `INSERT INTO student_subjects (student_id, subject_id, academic_year)
                 SELECT $1, s.id, $2 FROM subjects s
                 WHERE s.batch_id = $3
                 ON CONFLICT (student_id, subject_id, academic_year) DO NOTHING`,
                [id, academicYear, body.batchId]
            );
        }

        return NextResponse.json({ message: 'Student updated successfully' });
    } catch (error: unknown) {
        console.error('Update student error:', error);
        if ((error as { code?: string }).code === '23505') {
            return NextResponse.json(
                { error: 'Duplicate student ID or coaching ID' },
                { status: 400 }
            );
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Delete student (super_admin only)
export async function DELETE(request: NextRequest) {
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

        if (payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Only admins can delete students' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
        }

        // Delete related records first
        await query('DELETE FROM student_subjects WHERE student_id = $1', [id]);
        await query('DELETE FROM attendance_records WHERE student_id = $1', [id]);
        await query('DELETE FROM students WHERE id = $1', [id]);
        await query('DELETE FROM users WHERE id = $1', [id]);

        return NextResponse.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Delete student error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
