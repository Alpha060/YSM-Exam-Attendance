import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { parseCoachingId } from '@/lib/parseStudentId';
import { hashPassword } from '@/lib/auth';

export async function POST(req: Request) {
    const client = await pool.connect();
    try {
        const body = await req.json();
        const { students } = body;

        if (!Array.isArray(students) || students.length === 0) {
            return NextResponse.json({ error: 'No student data provided' }, { status: 400 });
        }

        if (students.length > 500) {
            return NextResponse.json({ error: 'Maximum 500 students per import' }, { status: 400 });
        }

        const results = {
            success: 0,
            updated: 0,
            failed: 0,
            errors: [] as { row: number, name: string, error: string }[]
        };

        // Cache batches (batches) for validation — include status
        const deptResult = await client.query(
            "SELECT id, code, name, COALESCE(status, 'active') as status FROM batches"
        );
        const batchMap = new Map(deptResult.rows.map((d: any) => [d.code.toUpperCase(), { id: d.id, name: d.name, status: d.status }]));

        // Get current academic year
        const now = new Date();
        const y = now.getFullYear();
        const academicYear = now.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;

        // Pre-hash the default password
        const defaultPasswordHash = await hashPassword('Welcome@123');

        // Batch: Fetch all existing student_ids
        const allStudentIds = students
            .filter((s: any) => s.student_id)
            .map((s: any) => s.student_id.toUpperCase());
        const allCoachingIds = students
            .filter((s: any) => s.coaching_id)
            .map((s: any) => s.coaching_id.toUpperCase());

        const existingResult = await client.query(
            `SELECT id, student_id, coaching_id, email, first_name, last_name, roll_number, batch_id FROM students 
             WHERE student_id = ANY($1) OR (coaching_id = ANY($2) AND coaching_id IS NOT NULL)`,
            [allStudentIds, allCoachingIds]
        );
        const existingStudentMap = new Map<string, any>();
        existingResult.rows.forEach((r: any) => {
            if (r.student_id) existingStudentMap.set(r.student_id.toUpperCase(), r);
        });

        // Use a single transaction for all inserts
        await client.query('BEGIN');

        // Collect valid NEW students for batch insert
        const studentBatch: any[] = [];
        const updateBatch: any[] = [];

        // Process each student
        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            const rowNum = i + 1;

            try {
                // Handle 'name' field: split into first_name/last_name if needed
                if (student.name && !student.first_name) {
                    const parts = student.name.trim().split(/\s+/);
                    student.first_name = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
                    student.last_name = parts.length > 1 ? parts[parts.length - 1] : '';
                }

                // 1. Basic Validation
                if (!student.student_id || !student.first_name) {
                    throw new Error('Missing required fields (College ID, Name)');
                }

                // 2. Find batch/batch
                let deptId: string | undefined;
                let deptStatus: string | undefined;
                let coachingId = student.coaching_id?.trim()?.toUpperCase() || null;
                if (coachingId) {
                    const parsed = parseCoachingId(coachingId);
                    if (parsed.isValid && parsed.normalizedId) {
                        coachingId = parsed.normalizedId;
                    }
                }

                // Try to find batch from batch_code or batch_code column
                if (student.batch_code) {
                    const entry = batchMap.get(student.batch_code.toUpperCase());
                    deptId = entry?.id;
                    deptStatus = entry?.status;
                }

                // If coaching ID provided, try to derive batch from prefix (longest match)
                if (!deptId && coachingId) {
                    const parsed = parseCoachingId(coachingId);
                    if (parsed.isValid && parsed.batchPrefix) {
                        // Try longest prefix match
                        const allCodes = Array.from(batchMap.keys());
                        const sortedCodes = allCodes.sort((a, b) => b.length - a.length);
                        for (const code of sortedCodes) {
                            if (coachingId.startsWith(code)) {
                                const rest = coachingId.slice(code.length);
                                if (/^20[2-9]\d\d{1,4}$/.test(rest)) {
                                    const entry = batchMap.get(code);
                                    deptId = entry?.id;
                                    deptStatus = entry?.status;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!deptId) {
                    throw new Error(`Could not find batch for: ${student.batch_code || 'unknown'}. Please provide a valid batch_code.`);
                }

                // Block completed batches
                if (deptStatus === 'completed') {
                    throw new Error(`Batch is completed. Cannot import students into a completed batch.`);
                }

                // 3. Derive roll number from coaching ID
                let rollNumber = student.roll_number ? parseInt(student.roll_number) : 0;
                let batchYear = student.batch_year || new Date().getFullYear();

                if (coachingId) {
                    const parsed = parseCoachingId(coachingId);
                    if (parsed.isValid) {
                        if (parsed.rollNumber) rollNumber = parsed.rollNumber;
                        if (parsed.year) batchYear = parsed.year;
                    }
                }

                // Extract all other profile fields
                const phone = student.phone ? String(student.phone).trim() : null;
                const dob = student.dob || null;
                const gender = student.gender ? String(student.gender).trim().toLowerCase() : null;
                const guardianName = student.guardian_name ? String(student.guardian_name).trim() : (student.guardianName ? String(student.guardianName).trim() : null);
                const address = student.address ? String(student.address).trim() : null;
                const state = student.state ? String(student.state).trim() : null;
                const pincode = student.pincode ? String(student.pincode).trim() : null;

                // 4. Check if student exists
                const sid = student.student_id.toUpperCase();
                const existingStudent = existingStudentMap.get(sid);

                let targetStudentUuid = null;
                const email = student.email ? student.email.trim().toLowerCase() : null;

                if (existingStudent) {
                    targetStudentUuid = existingStudent.id;

                    // Update existing
                    const batchChanged = existingStudent.batch_id !== deptId;
                    updateBatch.push({
                        existingId: targetStudentUuid,
                        sid,
                        coachingId,
                        rollNumber,
                        firstName: student.first_name,
                        lastName: student.last_name || '',
                        email: email || existingStudent.email || null,
                        deptId,
                        batchYear,
                        batchChanged,
                        phone,
                        dob,
                        gender,
                        guardianName,
                        address,
                        state,
                        pincode
                    });
                    results.updated++;
                } else {
                    // Check if email already taken
                    if (email) {
                        const emailCheck = await client.query(
                            'SELECT id FROM users WHERE email = $1',
                            [email]
                        );
                        if (emailCheck.rows.length > 0) {
                            // Link to existing user ID if user exists
                            targetStudentUuid = emailCheck.rows[0].id;
                        }
                    }

                    if (!targetStudentUuid) {
                        // Create user row first even if email is missing (for student_id login)
                        const userRes = await client.query(
                            `INSERT INTO users (email, password_hash, first_name, last_name, role, batch_id)
                             VALUES ($1, $2, $3, $4, 'student', $5)
                             RETURNING id`,
                            [email || null, defaultPasswordHash, student.first_name, student.last_name || '', deptId]
                        );
                        targetStudentUuid = userRes.rows[0].id;
                    }

                    // 5. Buffer NEW Student for insert
                    studentBatch.push({
                        newStudentId: targetStudentUuid,
                        sid,
                        coachingId,
                        rollNumber,
                        firstName: student.first_name,
                        lastName: student.last_name || '',
                        email: email,
                        deptId,
                        batchYear,
                        phone,
                        dob,
                        gender,
                        guardianName,
                        address,
                        state,
                        pincode
                    });
                    results.success++;
                }

                // If email is provided for existing student, check/create user row
                if (existingStudent && email) {
                    const userCheck = await client.query(
                        'SELECT id FROM users WHERE id = $1',
                        [targetStudentUuid]
                    );

                    if (userCheck.rows.length > 0) {
                        // Update existing user details
                        await client.query(
                            `UPDATE users SET 
                                email = $2,
                                first_name = $3,
                                last_name = $4,
                                batch_id = $5,
                                updated_at = CURRENT_TIMESTAMP
                             WHERE id = $1`,
                            [targetStudentUuid, email, student.first_name, student.last_name || '', deptId]
                        );
                    } else {
                        // Create users record with the same ID
                        await client.query(
                            `INSERT INTO users (id, email, password_hash, first_name, last_name, role, batch_id)
                             VALUES ($1, $2, $3, $4, $5, 'student', $6)
                             ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
                            [targetStudentUuid, email, defaultPasswordHash, student.first_name, student.last_name || '', deptId]
                        );
                    }
                }

            } catch (err: any) {
                results.failed++;
                results.errors.push({
                    row: rowNum,
                    name: `${student.first_name || 'Unknown'} ${student.last_name || ''}`.trim(),
                    error: err.message
                });
            }
        }

        // Batch insert all valid students in chunks of 50
        if (studentBatch.length > 0) {
            const STUDENT_CHUNK_SIZE = 50;
            for (let i = 0; i < studentBatch.length; i += STUDENT_CHUNK_SIZE) {
                const chunk = studentBatch.slice(i, i + STUDENT_CHUNK_SIZE);
                const values: string[] = [];
                const params: any[] = [];
                chunk.forEach((s, idx) => {
                    const offset = idx * 16;
                    values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16})`);
                    params.push(
                        s.newStudentId, s.sid, s.coachingId, s.rollNumber,
                        s.firstName, s.lastName, s.email, s.deptId, s.batchYear,
                        s.phone, s.dob, s.gender, s.guardianName, s.address, s.state, s.pincode
                    );
                });
                await client.query(
                    `INSERT INTO students (
                        id, student_id, coaching_id, roll_number,
                        first_name, last_name, email, batch_id, batch_year,
                        phone, dob, gender, guardian_name, address, state, pincode
                    ) VALUES ${values.join(', ')}`,
                    params
                );
            }

            // Auto-enroll new students into ALL subjects of their batch
            for (const s of studentBatch) {
                await client.query(
                    `INSERT INTO student_subjects (student_id, subject_id, academic_year)
                     SELECT $1, sub.id, $2 FROM subjects sub
                     WHERE sub.batch_id = $3
                     ON CONFLICT (student_id, subject_id, academic_year) DO NOTHING`,
                    [s.newStudentId, academicYear, s.deptId]
                );
            }
        }

        // Batch UPDATE existing students
        for (const s of updateBatch) {
            await client.query(
                `UPDATE students SET 
                    roll_number = $1, first_name = $2, last_name = $3, email = $4,
                    batch_id = $5, batch_year = $6, coaching_id = COALESCE($7, coaching_id),
                    phone = $8, dob = $9, gender = $10, guardian_name = $11, address = $12, state = $13, pincode = $14,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $15`,
                [
                    s.rollNumber, s.firstName, s.lastName, s.email,
                    s.deptId, s.batchYear, s.coachingId,
                    s.phone, s.dob, s.gender, s.guardianName, s.address, s.state, s.pincode,
                    s.existingId
                ]
            );

            // If batch changed, re-sync subjects
            if (s.batchChanged) {
                await client.query(
                    'DELETE FROM student_subjects WHERE student_id = $1 AND academic_year = $2',
                    [s.existingId, academicYear]
                );
                await client.query(
                    `INSERT INTO student_subjects (student_id, subject_id, academic_year)
                     SELECT $1, sub.id, $2 FROM subjects sub
                     WHERE sub.batch_id = $3
                     ON CONFLICT (student_id, subject_id, academic_year) DO NOTHING`,
                    [s.existingId, academicYear, s.deptId]
                );
            }
        }

        await client.query('COMMIT');
        return NextResponse.json(results);

    } catch (error: any) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        client.release();
    }
}
