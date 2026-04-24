import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: Request) {
    const client = await pool.connect();
    try {
        const body = await req.json();
        const { subjects } = body;

        if (!Array.isArray(subjects) || subjects.length === 0) {
            return NextResponse.json({ error: 'No subject data provided' }, { status: 400 });
        }

        if (subjects.length > 500) {
            return NextResponse.json({ error: 'Maximum 500 subjects per import' }, { status: 400 });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as { row: number; name: string; error: string }[]
        };

        // Pre-fetch departments (batches) for validation
        const deptResult = await client.query('SELECT id, code, name FROM departments');
        const departmentMap = new Map(deptResult.rows.map((d: any) => [d.code.toUpperCase(), d.id]));

        // Pre-fetch existing subjects by code+department_id (matches unique constraint)
        const existingResult = await client.query(
            'SELECT id, code, department_id FROM subjects'
        );
        const existingMap = new Map<string, string>();
        for (const r of existingResult.rows) {
            existingMap.set(`${r.code.toUpperCase()}|${r.department_id || ''}`, r.id);
        }

        await client.query('BEGIN');

        // Collect batches for insert
        const subjectInsertBatch: { code: string; paperCode: string | null; name: string; departmentId: string | null; credits: number }[] = [];

        for (let i = 0; i < subjects.length; i++) {
            const subject = subjects[i];
            const rowNum = i + 1;

            try {
                if (!subject.code || !subject.name) {
                    throw new Error('Missing required fields (code, name)');
                }

                const code = subject.code.trim().toUpperCase();
                const paperCode = subject.paper_code?.trim() || subject.paperCode?.trim() || subject['paper code']?.trim() || null;
                const name = subject.name.trim();
                const credits = subject.credits ? parseInt(subject.credits) : 3;

                // Resolve department (batch) - required
                let departmentId: string | null = null;
                const batchCode = subject.department_code?.trim() || subject.batch_code?.trim() || subject.degree_type?.trim();
                if (batchCode) {
                    departmentId = departmentMap.get(batchCode.toUpperCase()) || null;
                    if (!departmentId) {
                        throw new Error(`Invalid batch code: "${batchCode}"`);
                    }
                }

                if (!departmentId) {
                    throw new Error('Batch code is required');
                }

                const existingKey = `${code}|${departmentId || ''}`;
                const existingId = existingMap.get(existingKey);

                if (existingId) {
                    // Subject already exists - skip or update
                    throw new Error('Subject with this code already exists in this batch');
                } else {
                    // New subject
                    subjectInsertBatch.push({ code, paperCode, name, departmentId, credits });
                    existingMap.set(existingKey, `pending_${code}`);
                }

                results.success++;

            } catch (err: any) {
                results.failed++;
                results.errors.push({
                    row: rowNum,
                    name: `${subject.code || 'Unknown'} - ${subject.name || 'Unknown'}`,
                    error: err.message
                });
            }
        }

        // Batch INSERT new subjects
        const newSubjectIds = new Map<string, { id: string; departmentId: string | null }>();
        if (subjectInsertBatch.length > 0) {
            const CHUNK_SIZE = 100;
            for (let i = 0; i < subjectInsertBatch.length; i += CHUNK_SIZE) {
                const chunk = subjectInsertBatch.slice(i, i + CHUNK_SIZE);
                const values: string[] = [];
                const params: (string | number | null)[] = [];
                chunk.forEach((s, idx) => {
                    const offset = idx * 5;
                    values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
                    params.push(s.code, s.paperCode, s.name, s.departmentId, s.credits);
                });
                const result = await client.query(
                    `INSERT INTO subjects (code, paper_code, name, department_id, credits)
                     VALUES ${values.join(', ')}
                     ON CONFLICT (code, department_id) DO UPDATE SET name = EXCLUDED.name, paper_code = coalesce(EXCLUDED.paper_code, subjects.paper_code)
                     RETURNING id, code, department_id`,
                    params
                );
                for (const row of result.rows) {
                    newSubjectIds.set(row.code, { id: row.id, departmentId: row.department_id });
                }
            }
        }

        // Auto-enroll all existing batch students into newly created subjects
        if (newSubjectIds.size > 0) {
            const now = new Date();
            const y = now.getFullYear();
            const academicYear = now.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;

            for (const [, { id: subjectId, departmentId }] of newSubjectIds) {
                if (departmentId) {
                    await client.query(
                        `INSERT INTO student_subjects (student_id, subject_id, academic_year)
                         SELECT s.id, $1, $2 FROM students s
                         WHERE s.department_id = $3 AND s.is_active = true
                         ON CONFLICT (student_id, subject_id, academic_year) DO NOTHING`,
                        [subjectId, academicYear, departmentId]
                    );
                }
            }
        }

        await client.query('COMMIT');
        return NextResponse.json(results);

    } catch (error: any) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('Subject Import Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        client.release();
    }
}
