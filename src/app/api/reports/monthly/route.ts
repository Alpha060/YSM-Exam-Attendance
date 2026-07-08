import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface MonthlyData {
    total_days: string;
    total_lectures: string;
    present_count: string;
    absent_count: string;
    total_count: string;
}

interface DailyData {
    date: string;
    total_records: string;
    present_count: string;
    absent_count: string;
    topics: string | null;
}

interface SubjectData {
    subject_id: string;
    subject_name: string;
    subject_code: string;
    subject_paper_code: string | null;
    total_records: string;
    present_count: string;
    absent_count: string;
}

// GET - Monthly attendance summary with day-by-day breakdown
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

        const { role, batchId: userDeptId, userId } = payload;

        const { searchParams } = new URL(request.url);
        const getISTMonthStr = () => {
            const now = new Date();
            const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
            return istTime.toISOString().slice(0, 7);
        };
        const month = searchParams.get('month') || getISTMonthStr();
        const batchId = searchParams.get('batchId');
        const [year, monthNum] = month.split('-');

        // Allow HOD to view as teacher (for My Reports)
        const view = searchParams.get('view');
        const effectiveRole = (role === 'super_admin' && view === 'teacher') ? 'teacher' : role;

        // Build role-based filter
        const filters: string[] = [];
        const params: (string | number)[] = [parseInt(year), parseInt(monthNum)];

        // Role-based restrictions
        if (effectiveRole === 'teacher') {
            filters.push(`ar.teacher_id = $${params.length + 1}`);
            params.push(userId);
            // Restrict to active batches only
            filters.push(`ar.subject_id IN (SELECT s.id FROM subjects s JOIN batches d ON s.batch_id = d.id WHERE COALESCE(d.status, 'active') = 'active')`);
            if (batchId) {
                filters.push(`ar.student_id IN (
                    SELECT id FROM students WHERE batch_id = $${params.length + 1}
                )`);
                params.push(batchId);
            }
        } else if (effectiveRole === 'super_admin' && batchId) {
            filters.push(`ar.student_id IN (
                SELECT id FROM students WHERE batch_id = $${params.length + 1}
            )`);
            params.push(batchId);
        }
        // super_admin with no batchId: no filter — sees all data



        const filterClause = filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';

        // 1. Overall summary
        const summaryResult = await query<MonthlyData>(
            `SELECT 
                COUNT(DISTINCT ar.date) as total_days,
                COUNT(DISTINCT ar.teacher_id || '-' || ar.date || '-' || ar.subject_id::text || '-' || ar.lecture_number) as total_lectures,
                COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count,
                COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count,
                COUNT(*) as total_count
            FROM attendance_records ar
            WHERE EXTRACT(YEAR FROM ar.date) = $1 
              AND EXTRACT(MONTH FROM ar.date) = $2
              ${filterClause}`,
            params
        );

        // 2. Day-by-day breakdown (with topic names)
        const dailyResult = await query<DailyData>(
            `SELECT 
                ar.date::text as date,
                COUNT(*) as total_records,
                COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count,
                COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count,
                string_agg(DISTINCT ar.topic, ', ' ORDER BY ar.topic) as topics
            FROM attendance_records ar
            WHERE EXTRACT(YEAR FROM ar.date) = $1 
              AND EXTRACT(MONTH FROM ar.date) = $2
              ${filterClause}
            GROUP BY ar.date
            ORDER BY ar.date ASC`,
            params
        );

        // 4. Daily percentages for min/max
        const percentages = dailyResult.map(d => {
            const total = parseInt(d.total_records) || 0;
            const present = parseInt(d.present_count) || 0;
            return total > 0 ? Math.round((present / total) * 100) : 0;
        });

        const data = summaryResult[0] || {
            total_days: '0',
            total_lectures: '0',
            present_count: '0',
            absent_count: '0',
            total_count: '0'
        };

        const totalCount = parseInt(data.total_count) || 0;
        const presentCount = parseInt(data.present_count) || 0;
        const absentCount = parseInt(data.absent_count) || 0;
        const avgAttendance = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

        return NextResponse.json({
            stats: {
                month,
                totalDays: parseInt(data.total_days) || 0,
                totalSessions: parseInt(data.total_lectures) || 0,
                totalPresent: presentCount,
                totalAbsent: absentCount,
                totalRecords: totalCount,
                averageAttendance: avgAttendance,
                highestAttendance: percentages.length > 0 ? Math.max(...percentages) : 0,
                lowestAttendance: percentages.length > 0 ? Math.min(...percentages) : 0
            },
            dailyBreakdown: dailyResult.map(d => {
                const total = parseInt(d.total_records) || 0;
                const present = parseInt(d.present_count) || 0;
                return {
                    date: d.date,
                    percentage: total > 0 ? Math.round((present / total) * 100) : 0
                };
            })
        });
    } catch (error) {
        console.error('Monthly report error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
