import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { parseCoachingId, extractRollNumber, matchBatchCode } from '@/lib/parseStudentId';

interface StudentRow {
    id: string;
    student_id: string;
    coaching_id: string | null;
    roll_number: number;
    first_name: string;
    last_name: string;
    email: string | null;
    department_id: string;
    department_name: string;
    department_code: string;
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
        const departmentId = searchParams.get('departmentId');
        const subjectId = searchParams.get('subjectId');

        let queryStr = `
            SELECT s.*, d.name as department_name, d.code as department_code
            FROM students s
            LEFT JOIN departments d ON s.department_id = d.id
            WHERE s.is_active = true
        `;
        const params: string[] = [];

        // Filter by batch (department)
        if (departmentId) {
            params.push(departmentId);
            queryStr += ` AND s.department_id = $${params.length}`;
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
            queryStr += ` AND s.department_id IN (
                SELECT department_id FROM user_departments WHERE user_id = $${params.length}
                UNION
                SELECT department_id FROM users WHERE id = $${params.length} AND department_id IS NOT NULL
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
                department_id: s.department_id,
                department_name: s.department_name,
                department_code: s.department_code,
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
        const studentId = body.studentId?.trim();
        const coachingId = body.coachingId?.trim()?.toUpperCase() || null;
        const firstName = body.firstName?.trim();
        const lastName = body.lastName?.trim() || '';
        const email = body.email?.trim() || null;
        let departmentId = body.departmentId;

        if (!studentId || !firstName) {
            return NextResponse.json(
                { error: 'Student ID and name are required' },
                { status: 400 }
            );
        }

        // Auto-detect batch from coaching ID if no explicit departmentId
        if (!departmentId && coachingId) {
            const allBatches = await query<{ id: string; code: string; status: string }>(
                'SELECT id, code, COALESCE(status, \'active\') as status FROM departments'
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
                    departmentId = matchedBatch.id;
                }
            }
        }

        // If departmentId provided directly, verify batch is not completed
        if (departmentId) {
            const batch = await queryOne<{ status: string }>(
                'SELECT COALESCE(status, \'active\') as status FROM departments WHERE id = $1',
                [departmentId]
            );
            if (batch?.status === 'completed') {
                return NextResponse.json(
                    { error: 'Cannot add students to a completed batch.' },
                    { status: 400 }
                );
            }
        }

        if (!departmentId) {
            return NextResponse.json(
                { error: 'Could not determine batch. Please select a batch or use a valid coaching ID.' },
                { status: 400 }
            );
        }

        // Derive roll number from coaching ID if provided
        let rollNumber = body.rollNumber ? parseInt(body.rollNumber) : 0;
        if (coachingId) {
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

        if (rollNumber <= 0 && !coachingId) {
            rollNumber = 1; // Default if no coaching ID provided
        }

        // Get batch year from coaching ID or current year
        let batchYear = body.batchYear || new Date().getFullYear();
        if (coachingId) {
            const parsed = parseCoachingId(coachingId);
            if (parsed.isValid && parsed.year) {
                batchYear = parsed.year;
            }
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

        const result = await query<{ id: string }>(
            `INSERT INTO students (student_id, coaching_id, roll_number, first_name, last_name, email, department_id, current_semester, batch_year)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)
             RETURNING id`,
            [studentId, coachingId || null, rollNumber, firstName, lastName, email, departmentId, batchYear]
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
             WHERE s.department_id = $3
             ON CONFLICT (student_id, subject_id, academic_year) DO NOTHING`,
            [newStudentId, academicYear, departmentId]
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
        if (body.departmentId) {
            const batch = await queryOne<{ status: string }>(
                'SELECT COALESCE(status, \'active\') as status FROM departments WHERE id = $1',
                [body.departmentId]
            );
            if (batch?.status === 'completed') {
                return NextResponse.json(
                    { error: 'Cannot move student to a completed batch.' },
                    { status: 400 }
                );
            }
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
        if (body.firstName) {
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
        if (body.departmentId) {
            updateFields.push(`department_id = $${++paramCount}`);
            params.push(body.departmentId);
        }

        if (updateFields.length === 0) {
            return NextResponse.json({ message: 'No fields to update' });
        }

        await query(
            `UPDATE students SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            params
        );

        // If batch (departmentId) was changed, re-sync student subjects
        if (body.departmentId) {
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
                 WHERE s.department_id = $3
                 ON CONFLICT (student_id, subject_id, academic_year) DO NOTHING`,
                [id, academicYear, body.departmentId]
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

        return NextResponse.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Delete student error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
