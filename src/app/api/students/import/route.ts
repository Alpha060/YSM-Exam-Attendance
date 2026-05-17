import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { parseCoachingId } from '@/lib/parseStudentId';

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

        // Cache batches (departments) for validation — include status
        const deptResult = await client.query(
            "SELECT id, code, name, COALESCE(status, 'active') as status FROM departments"
        );
        const departmentMap = new Map(deptResult.rows.map((d: any) => [d.code.toUpperCase(), { id: d.id, name: d.name, status: d.status }]));

        // Get current academic year
        const now = new Date();
        const y = now.getFullYear();
        const academicYear = now.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;

        // Batch: Fetch all existing student_ids
        const allStudentIds = students
            .filter((s: any) => s.student_id)
            .map((s: any) => s.student_id.toUpperCase());
        const allCoachingIds = students
            .filter((s: any) => s.coaching_id)
            .map((s: any) => s.coaching_id.toUpperCase());

        const existingResult = await client.query(
            `SELECT id, student_id, coaching_id, email, first_name, last_name, roll_number, department_id FROM students 
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
                    throw new Error('Missing required fields (Student ID, Name)');
                }

                // 2. Find batch/department
                let deptId: string | undefined;
                let deptStatus: string | undefined;
                const coachingId = student.coaching_id?.trim()?.toUpperCase() || null;

                // Try to find batch from batch_code or department_code column
                if (student.batch_code) {
                    const entry = departmentMap.get(student.batch_code.toUpperCase());
                    deptId = entry?.id;
                    deptStatus = entry?.status;
                } else if (student.department_code) {
                    const entry = departmentMap.get(student.department_code.toUpperCase());
                    deptId = entry?.id;
                    deptStatus = entry?.status;
                }

                // If coaching ID provided, try to derive batch from prefix (longest match)
                if (!deptId && coachingId) {
                    const parsed = parseCoachingId(coachingId);
                    if (parsed.isValid && parsed.batchPrefix) {
                        // Try longest prefix match
                        const allCodes = Array.from(departmentMap.keys());
                        const sortedCodes = allCodes.sort((a, b) => b.length - a.length);
                        for (const code of sortedCodes) {
                            if (coachingId.startsWith(code)) {
                                const rest = coachingId.slice(code.length);
                                if (/^20[2-9]\d\d{1,4}$/.test(rest)) {
                                    const entry = departmentMap.get(code);
                                    deptId = entry?.id;
                                    deptStatus = entry?.status;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!deptId) {
                    throw new Error(`Could not find batch for: ${student.batch_code || student.department_code || 'unknown'}. Please provide a valid batch_code.`);
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

                // 4. Check if student exists
                const sid = student.student_id.toUpperCase();
                const existingStudent = existingStudentMap.get(sid);

                if (existingStudent) {
                    // Update existing — track if batch changed for re-sync
                    const batchChanged = existingStudent.department_id !== deptId;
                    updateBatch.push({
                        existingId: existingStudent.id,
                        sid,
                        coachingId,
                        rollNumber,
                        firstName: student.first_name,
                        lastName: student.last_name || '',
                        email: student.email || existingStudent.email || null,
                        deptId,
                        batchYear,
                        batchChanged,
                    });
                    results.updated++;
                    existingStudentMap.set(sid, { ...existingStudent, first_name: student.first_name });
                    continue;
                }

                const newStudentId = uuidv4();

                // 5. Buffer NEW Student for insert
                studentBatch.push({
                    newStudentId,
                    sid,
                    coachingId,
                    rollNumber,
                    firstName: student.first_name,
                    lastName: student.last_name || '',
                    email: student.email || null,
                    deptId,
                    batchYear,
                });

                existingStudentMap.set(sid, { id: newStudentId });
                results.success++;

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
                    const offset = idx * 9;
                    values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`);
                    params.push(s.newStudentId, s.sid, s.coachingId, s.rollNumber, s.firstName, s.lastName, s.email, s.deptId, s.batchYear);
                });
                await client.query(
                    `INSERT INTO students (
                        id, student_id, coaching_id, roll_number,
                        first_name, last_name, email, department_id, batch_year
                    ) VALUES ${values.join(', ')}`,
                    params
                );
            }

            // Auto-enroll new students into ALL subjects of their batch
            for (const s of studentBatch) {
                await client.query(
                    `INSERT INTO student_subjects (student_id, subject_id, academic_year)
                     SELECT $1, sub.id, $2 FROM subjects sub
                     WHERE sub.department_id = $3
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
                    department_id = $5, batch_year = $6, coaching_id = COALESCE($7, coaching_id),
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $8`,
                [s.rollNumber, s.firstName, s.lastName, s.email, s.deptId, s.batchYear, s.coachingId, s.existingId]
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
                     WHERE sub.department_id = $3
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
