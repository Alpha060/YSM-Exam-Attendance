import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface StudentProfileRow {
    id: string;
    student_id: string;
    roll_number: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    dob: string | null;
    gender: string | null;
    guardian_name: string | null;
    address: string | null;
    state: string | null;
    pincode: string | null;
    batch_name: string;
    batch_code: string;
    current_semester: number;
    batch_year: number;
}

interface AttendanceStatsRow {
    total: string;
    present: string;
}

interface EnrolledSubjectRow {
    id: string;
    name: string;
    code: string;
    credits: number;
}

export async function GET(request: NextRequest) {
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

        // 1. Fetch Student Profile
        const student = await queryOne<StudentProfileRow>(
            `SELECT s.*, d.name as batch_name, d.code as batch_code 
             FROM students s 
             LEFT JOIN batches d ON s.batch_id = d.id 
             WHERE s.id = $1`,
            [payload.userId]
        );

        if (!student) {
            return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
        }

        // 2. Fetch Attendance Stats
        const attendanceStats = await queryOne<AttendanceStatsRow>(
            `SELECT 
                COUNT(*) as total, 
                COUNT(CASE WHEN status = 'present' THEN 1 END) as present 
             FROM attendance_records 
             WHERE student_id = $1`,
            [payload.userId]
        );

        const totalLectures = parseInt(attendanceStats?.total || '0', 10);
        const presentLectures = parseInt(attendanceStats?.present || '0', 10);
        const absentLectures = totalLectures - presentLectures;
        const attendancePercentage = totalLectures > 0 ? Math.round((presentLectures / totalLectures) * 100) : 0;

        // 3. Fetch Enrolled Subjects
        const subjects = await query<EnrolledSubjectRow>(
            `SELECT s.id, s.name, s.code, s.credits
             FROM student_subjects ss
             JOIN subjects s ON ss.subject_id = s.id
             WHERE ss.student_id = $1
             ORDER BY s.name ASC`,
            [payload.userId]
        );

        return NextResponse.json({
            profile: student,
            attendance: {
                total: totalLectures,
                present: presentLectures,
                absent: absentLectures,
                percentage: attendancePercentage
            },
            subjects
        });

    } catch (error) {
        console.error('Fetch student dashboard stats error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
