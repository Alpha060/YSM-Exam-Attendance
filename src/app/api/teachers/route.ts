import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, hashPassword } from '@/lib/auth';

interface TeacherRow {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    batch_id: string | null;
    batch_name?: string;
    batch_code?: string;
}

interface BatchInfo {
    id: string;
    name: string;
    code: string;
    is_primary: boolean;
}

// GET - List teachers
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

        // Query teachers with their primary batch and subjects
        let queryText = `
            SELECT 
                u.id, u.email, u.first_name, u.last_name, u.role, u.batch_id, u.created_at, u.updated_at,
                d.name as batch_name, 
                d.code as batch_code,
                (
                    SELECT COALESCE(json_agg(json_build_object(
                        'assignmentId', ts.id,
                        'subjectId', s.id,
                        'code', s.code, 
                        'paperCode', s.paper_code,
                        'name', s.name,
                        'batchId', s.batch_id
                    )), '[]'::json)
                    FROM teacher_subjects ts
                    JOIN subjects s ON ts.subject_id = s.id
                    WHERE ts.teacher_id = u.id
                    AND ts.unassigned_date IS NULL
                ) as subjects,
                (
                    SELECT COALESCE(json_agg(json_build_object(
                        'assignmentId', ts.id,
                        'subjectId', s.id,
                        'code', s.code, 
                        'paperCode', s.paper_code,
                        'name', s.name,
                        'batchId', s.batch_id,
                        'assignedDate', ts.assigned_date,
                        'unassignedDate', ts.unassigned_date
                    )), '[]'::json)
                    FROM teacher_subjects ts
                    JOIN subjects s ON ts.subject_id = s.id
                    WHERE ts.teacher_id = u.id
                    AND ts.unassigned_date IS NOT NULL
                ) as archived_subjects,
                (
                    SELECT COALESCE(json_agg(json_build_object(
                        'id', dept.id,
                        'name', dept.name,
                        'code', dept.code,
                        'is_primary', false
                    )), '[]'::json)
                    FROM user_batches ud
                    JOIN batches dept ON ud.batch_id = dept.id
                    WHERE ud.user_id = u.id AND (u.batch_id IS NULL OR ud.batch_id != u.batch_id)
                ) as additional_batches
            FROM users u
            LEFT JOIN batches d ON u.batch_id = d.id
            WHERE u.role IN ('teacher')
        `;
        const params: string[] = [];

        // Teachers can only see teachers from their own batches
        if (payload.role === 'teacher' && payload.userId) {
            queryText += ` AND (
                u.batch_id IN (SELECT batch_id FROM user_batches WHERE user_id = $1)
                OR u.batch_id = $2
                OR EXISTS (
                    SELECT 1 FROM user_batches ud 
                    WHERE ud.user_id = u.id AND (
                        ud.batch_id IN (SELECT batch_id FROM user_batches WHERE user_id = $1)
                        OR ud.batch_id = $2
                    )
                )
            )`;
            params.push(payload.userId, payload.batchId || '00000000-0000-0000-0000-000000000000');
        }
        // Super admin sees ALL teachers - no filter needed

        queryText += ' ORDER BY u.first_name, u.last_name';

        const teachers = await query<TeacherRow & { subjects: any[]; additional_batches: BatchInfo[] }>(queryText, params);

        // Transform response to include all batches in a single array
        const transformedTeachers = teachers.map(teacher => {
            const allBatches: BatchInfo[] = [];

            // Add primary batch first
            if (teacher.batch_id && teacher.batch_name && teacher.batch_code) {
                allBatches.push({
                    id: teacher.batch_id,
                    name: teacher.batch_name,
                    code: teacher.batch_code,
                    is_primary: true
                });
            }

            // Add additional batches
            if (teacher.additional_batches && Array.isArray(teacher.additional_batches)) {
                allBatches.push(...teacher.additional_batches);
            }

            return {
                ...teacher,
                batches: allBatches
            };
        });

        return NextResponse.json({ teachers: transformedTeachers });
    } catch (error) {
        console.error('Get teachers error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST - Create teacher
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyToken(token);
        if (!payload || !['super_admin'].includes(payload.role)) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { firstName, lastName, email, batchId, batchIds, role, password } = await request.json();

        // Support both single batchId and array of batchIds
        const deptIds: string[] = batchIds || (batchId ? [batchId] : []);

        if (!firstName || !lastName || !email || deptIds.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const primaryDeptId = deptIds[0];
        const additionalDeptIds = deptIds.slice(1);

        // Super admin can assign teachers to any batch - no restrictions

        // Use custom password if provided, otherwise default
        const defaultPassword = password || 'Welcome@123';
        const passwordHash = await hashPassword(defaultPassword);

        const teachers = await query<TeacherRow>(
            `INSERT INTO users (first_name, last_name, email, password_hash, role, batch_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [firstName, lastName, email, passwordHash, role || 'teacher', primaryDeptId]
        );

        const newTeacher = teachers[0];

        // Add all batches to user_batches (including primary for easy querying)
        for (const deptId of deptIds) {
            await query(
                `INSERT INTO user_batches (user_id, batch_id) 
                 VALUES ($1, $2) 
                 ON CONFLICT (user_id, batch_id) DO NOTHING`,
                [newTeacher.id, deptId]
            );
        }

        return NextResponse.json({
            teacher: newTeacher,
            temporaryPassword: defaultPassword,
        }, { status: 201 });
    } catch (error: unknown) {
        console.error('Create teacher error:', error);
        if ((error as { code?: string }).code === '23505') {
            return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Remove teacher
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

        // Only super_admin can delete
        if (payload.role !== 'super_admin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Teacher ID required' }, { status: 400 });
        }

        // Clean up related records
        await query('DELETE FROM teacher_subjects WHERE teacher_id = $1', [id]);
        await query('DELETE FROM user_batches WHERE user_id = $1', [id]);

        // Unlink teacher from attendance records (preserve history)
        await query('UPDATE attendance_records SET teacher_id = NULL WHERE teacher_id = $1', [id]);

        // Unlink from audit logs if any
        await query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [id]);

        await query('DELETE FROM users WHERE id = $1', [id]);

        return NextResponse.json({ message: 'Teacher deleted successfully' });
    } catch (error) {
        console.error('Delete teacher error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// PUT - Update teacher
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
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { id, firstName, lastName, email, batchId, batchIds, role, password } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Teacher ID required' }, { status: 400 });
        }

        // Support both single batchId and array of batchIds
        const deptIds: string[] = batchIds || (batchId ? [batchId] : []);
        const primaryDeptId = deptIds.length > 0 ? deptIds[0] : null;

        const updateFields: string[] = [];
        const params: (string | boolean)[] = [id];
        let paramCount = 1;

        if (firstName) { updateFields.push(`first_name = $${++paramCount}`); params.push(firstName); }
        if (lastName !== undefined) { updateFields.push(`last_name = $${++paramCount}`); params.push(lastName); }
        if (email) { updateFields.push(`email = $${++paramCount}`); params.push(email); }
        if (primaryDeptId) { updateFields.push(`batch_id = $${++paramCount}`); params.push(primaryDeptId); }
        if (role) { updateFields.push(`role = $${++paramCount}`); params.push(role); }
        if (password) {
            const passwordHash = await hashPassword(password);
            updateFields.push(`password_hash = $${++paramCount}`);
            params.push(passwordHash);
        }

        if (updateFields.length > 0) {
            await query(
                `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                params
            );
        }

        // Update batches if provided
        if (deptIds.length > 0) {
            // Remove all batch links first
            await query('DELETE FROM user_batches WHERE user_id = $1', [id]);

            // Add all batches
            for (const deptId of deptIds) {
                await query(
                    `INSERT INTO user_batches (user_id, batch_id) 
                     VALUES ($1, $2) 
                     ON CONFLICT (user_id, batch_id) DO NOTHING`,
                    [id, deptId]
                );
            }
        }

        return NextResponse.json({ message: 'Teacher updated successfully' });
    } catch (error) {
        console.error('Update teacher error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
