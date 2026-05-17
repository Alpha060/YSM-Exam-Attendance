const { Pool } = require('pg');
require('dotenv').config({path: '.env.local'});
if (!process.env.DATABASE_URL) require('dotenv').config();

const p2 = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function test() {
  try {
    const res = await p2.query("SELECT id FROM users WHERE role IN ('teacher', 'hod') LIMIT 1");
    if (!res.rows[0]) return console.log('no teacher found');
    const teacherId = res.rows[0].id;
    console.log('Testing teacher:', teacherId);
    
    const qs = [
      `SELECT u.id, u.first_name, u.last_name, u.email, u.department_id, d.name as department_name FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = $1`,
      
      `SELECT d.id, d.name, d.code, d.dept_type FROM departments d WHERE d.id IN (SELECT department_id FROM users WHERE id = $1 UNION SELECT department_id FROM user_departments WHERE user_id = $1) ORDER BY d.name`,
      
      `SELECT MIN(s.id::text) as subject_id, s.name as subject_name, s.code as subject_code, s.paper_code as paper_code, MIN(d.id::text) as department_id, string_agg(DISTINCT COALESCE(d.code, d.name), ', ') as department_name, COUNT(DISTINCT ar.date || '-' || ar.subject_id::text || '-' || ar.lecture_number) as total_sessions, COUNT(DISTINCT ar.date) as working_days, COUNT(DISTINCT ar.student_id) as total_students, COALESCE(ROUND(COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::numeric * 100 / NULLIF(COUNT(ar.id), 0), 1), 0) as avg_attendance FROM teacher_subjects ts JOIN subjects s ON s.id = ts.subject_id LEFT JOIN departments d ON d.id = s.department_id LEFT JOIN attendance_records ar ON ar.subject_id = s.id AND ar.teacher_id = ts.teacher_id WHERE ts.teacher_id = $1 GROUP BY s.code, s.name, s.paper_code ORDER BY s.code, s.name`,
      
      `SELECT ar.date::text as date, COUNT(*) as total_records, COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count, COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count, string_agg(DISTINCT ar.topic, ', ') as topics FROM attendance_records ar WHERE ar.teacher_id = $1 GROUP BY ar.date ORDER BY ar.date DESC LIMIT 60`,
      
      `SELECT TO_CHAR(ar.date, 'YYYY-MM') as month, COUNT(DISTINCT ar.date || '-' || ar.subject_id::text || '-' || ar.lecture_number) as sessions, COALESCE(ROUND(COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::numeric * 100 / NULLIF(COUNT(ar.id), 0), 1), 0) as avg_attendance FROM attendance_records ar JOIN teacher_subjects ts ON ts.subject_id = ar.subject_id AND ar.teacher_id = ts.teacher_id WHERE ts.teacher_id = $1 AND ar.date >= CURRENT_DATE - INTERVAL '6 months' GROUP BY TO_CHAR(ar.date, 'YYYY-MM') ORDER BY month DESC`,
      
      `SELECT COUNT(DISTINCT ar.date || '-' || ar.subject_id::text || '-' || ar.lecture_number) as total_sessions, COUNT(DISTINCT ar.date) as working_days, COUNT(DISTINCT ar.student_id) as total_students, COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count, COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count, COALESCE(ROUND(COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::numeric * 100 / NULLIF(COUNT(ar.id), 0), 1), 0) as avg_attendance FROM attendance_records ar WHERE ar.teacher_id = $1`
    ];
    
    for (let i=0; i<qs.length; i++) {
        try {
            await p2.query(qs[i], [teacherId]);
            console.log('Query ' + i + ' OK');
        } catch(e) {
            console.log('Query ' + i + ' ERROR:', e.message);
        }
    }
  } catch(e) { console.log('Outer err:', e); }
  p2.end();
}
test();
