import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyToken(token);
        if (!payload || (payload.role !== 'super_admin' && payload.role !== 'teacher')) {
            return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
        }

        // Counts
        const counts = await queryOne<{
            total_students: string;
            total_teachers: string;
            total_batches: string;
            total_subjects: string;
            active_students: string;
        }>(`
            SELECT
                (SELECT COUNT(*) FROM students) as total_students,
                (SELECT COUNT(*) FROM users WHERE role = 'teacher') as total_teachers,
                (SELECT COUNT(*) FROM batches) as total_batches,
                (SELECT COUNT(*) FROM subjects) as total_subjects,
                (SELECT COUNT(*) FROM students WHERE is_active = true) as active_students
        `);

        // Fee stats
        const feeStats = await queryOne<{
            total_collected: string;
            total_pending: string;
            count_paid: string;
            count_pending: string;
        }>(`
            SELECT
                COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_collected,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as count_paid,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as count_pending
            FROM payments
        `);

        // Today's attendance summary
        const today = new Date().toISOString().split('T')[0];
        const todayAttendance = await queryOne<{
            classes_today: string;
            present_today: string;
            absent_today: string;
        }>(`
            SELECT
                COUNT(DISTINCT teacher_id || '-' || subject_id::text || '-' || lecture_number::text) as classes_today,
                COUNT(CASE WHEN status = 'present' THEN 1 END) as present_today,
                COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_today
            FROM attendance_records
            WHERE date = $1
        `, [today]);

        // Recent attendance records (last 5 classes)
        const recentClasses = await query(`
            SELECT 
                a_summary.class_id as id,
                s.name as subject_name,
                b.name as batch_name,
                b.code as batch_code,
                a_summary.date,
                a_summary.present_count,
                a_summary.absent_count,
                a_summary.total_count,
                u.first_name as teacher_first_name,
                u.last_name as teacher_last_name
            FROM (
                SELECT 
                    subject_id, teacher_id, date, lecture_number,
                    subject_id::text || '-' || teacher_id::text || '-' || date::text || '-' || lecture_number::text as class_id,
                    COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
                    COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_count,
                    COUNT(*) as total_count
                FROM attendance_records
                GROUP BY subject_id, teacher_id, date, lecture_number
                ORDER BY date DESC
                LIMIT 7
            ) a_summary
            JOIN subjects s ON a_summary.subject_id = s.id
            JOIN batches b ON s.batch_id = b.id
            LEFT JOIN users u ON a_summary.teacher_id = u.id
            ORDER BY a_summary.date DESC
        `);

        // Recent payments (last 5, excluding pending)
        const recentPayments = await query(`
            SELECT 
                p.id, p.amount, p.status, p.description, p.payment_method,
                p.paid_at, p.created_at,
                s.first_name, s.last_name, s.roll_number
            FROM payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.status != 'pending'
            ORDER BY p.created_at DESC
            LIMIT 5
        `);

        // Batch-wise student counts
        const batchDistribution = await query(`
            SELECT 
                b.id, b.name, b.code,
                COUNT(s.id) as student_count
            FROM batches b
            LEFT JOIN students s ON s.batch_id = b.id
            GROUP BY b.id, b.name, b.code
            ORDER BY b.name ASC
        `);

        return NextResponse.json({
            counts: {
                totalStudents: parseInt(counts?.total_students || '0'),
                activeStudents: parseInt(counts?.active_students || '0'),
                totalTeachers: parseInt(counts?.total_teachers || '0'),
                totalBatches: parseInt(counts?.total_batches || '0'),
                totalSubjects: parseInt(counts?.total_subjects || '0'),
            },
            fees: {
                totalCollected: parseFloat(feeStats?.total_collected || '0'),
                totalPending: parseFloat(feeStats?.total_pending || '0'),
                countPaid: parseInt(feeStats?.count_paid || '0'),
                countPending: parseInt(feeStats?.count_pending || '0'),
            },
            todayAttendance: {
                classesToday: parseInt(todayAttendance?.classes_today || '0'),
                presentToday: parseInt(todayAttendance?.present_today || '0'),
                absentToday: parseInt(todayAttendance?.absent_today || '0'),
            },
            recentClasses,
            recentPayments,
            batchDistribution,
        });
    } catch (error) {
        console.error('Admin dashboard stats error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
