'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileSidebar } from '@/components/ui/MobileSidebar';
import { Navbar } from '@/components/ui/Navbar';
import { Button } from '@/components/ui/button';
import {
    Building2,
    BookOpen,
    Users,
    GraduationCap,
    CalendarDays,
    BarChart3,
    ClipboardCheck,
    UsersRound,
    Settings,
    ChevronRight,
    BookCheck,
    CreditCard,
    CheckCircle2,
    AlertTriangle,
    User as UserIcon,
    ArrowRight,
    Clock
} from 'lucide-react';

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'super_admin' | 'teacher' | 'student';
    batchId: string | null;
}

interface DashboardCard {
    id: string;
    title: string;
    description: string;
    borderColor: string;
    textColor: string;
    gradient: string;
    iconComponent: React.ReactNode;
    href: string;
}

interface StudentProfile {
    id: string;
    student_id: string;
    coaching_id: string | null;
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

interface StudentAttendance {
    total: number;
    present: number;
    absent: number;
    percentage: number;
}

interface EnrolledSubject {
    id: string;
    name: string;
    code: string;
    credits: number;
}

interface PaymentRecord {
    id: string;
    amount: number;
    currency: string;
    status: string;
    description: string;
    payment_method: string | null;
    transaction_id: string | null;
    paid_at: string | null;
    created_at: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Student Dashboard States
    const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
    const [studentAttendance, setStudentAttendance] = useState<StudentAttendance | null>(null);
    const [studentSubjects, setStudentSubjects] = useState<EnrolledSubject[]>([]);
    const [studentPayments, setStudentPayments] = useState<PaymentRecord[]>([]);
    const [loadingStudentData, setLoadingStudentData] = useState(false);

    useEffect(() => {
        setMounted(true);
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (!token || !userData) {
            router.replace('/login');
            return;
        }

        try {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);

            if (parsedUser.role === 'student') {
                fetchStudentDashboard(token);
                fetchStudentPayments(token);
            }
        } catch {
            router.replace('/login');
        }
        setLoading(false);
    }, [router]);

    const fetchStudentDashboard = async (token: string) => {
        setLoadingStudentData(true);
        try {
            const res = await fetch('/api/student/dashboard', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStudentProfile(data.profile);
                setStudentAttendance(data.attendance);
                setStudentSubjects(data.subjects);
            }
        } catch (err) {
            console.error('Error fetching student dashboard data:', err);
        } finally {
            setLoadingStudentData(false);
        }
    };

    const fetchStudentPayments = async (token: string) => {
        try {
            const res = await fetch('/api/student/payments', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStudentPayments(data.payments || []);
            }
        } catch (err) {
            console.error('Error fetching student payments:', err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
                <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) return null;

    const getCards = (): DashboardCard[] => {
        if (user.role === 'super_admin') {
            return [
                {
                    id: 'batches',
                    title: 'Batches',
                    description: 'Manage coaching batches',
                    href: '/batches',
                    iconComponent: <Building2 className="w-6 h-6" />,
                    gradient: 'from-amber-100 to-orange-100',
                    textColor: 'text-amber-700',
                    borderColor: 'border-amber-200'
                },
                {
                    id: 'subjects',
                    title: 'Subjects',
                    description: 'Configure batch subjects',
                    href: '/subjects',
                    iconComponent: <BookOpen className="w-6 h-6" />,
                    gradient: 'from-blue-100 to-indigo-100',
                    textColor: 'text-blue-700',
                    borderColor: 'border-blue-200'
                },
                {
                    id: 'teachers',
                    title: 'Teachers',
                    description: 'Manage teachers & assignments',
                    href: '/teachers',
                    iconComponent: <Users className="w-6 h-6" />,
                    gradient: 'from-rose-100 to-pink-100',
                    textColor: 'text-rose-700',
                    borderColor: 'border-rose-200'
                },
                {
                    id: 'students',
                    title: 'Students',
                    description: 'Manage student registrations',
                    href: '/students',
                    iconComponent: <GraduationCap className="w-6 h-6" />,
                    gradient: 'from-emerald-100 to-teal-100',
                    textColor: 'text-emerald-700',
                    borderColor: 'border-emerald-200'
                },
                {
                    id: 'holidays',
                    title: 'Holidays',
                    description: 'Configure academic calendar events',
                    href: '/holidays',
                    iconComponent: <CalendarDays className="w-6 h-6" />,
                    gradient: 'from-cyan-100 to-sky-100',
                    textColor: 'text-cyan-700',
                    borderColor: 'border-cyan-200'
                },
                {
                    id: 'reports',
                    title: 'Reports',
                    description: 'Analyze attendance & performance stats',
                    href: '/reports',
                    iconComponent: <BarChart3 className="w-6 h-6" />,
                    gradient: 'from-violet-100 to-purple-100',
                    textColor: 'text-violet-700',
                    borderColor: 'border-violet-200'
                },
                {
                    id: 'payments',
                    title: 'Payments',
                    description: 'Fee ledger & collection manager',
                    href: '/payments',
                    iconComponent: <CreditCard className="w-6 h-6" />,
                    gradient: 'from-teal-100 to-emerald-100',
                    textColor: 'text-teal-700',
                    borderColor: 'border-teal-200'
                },
                {
                    id: 'settings',
                    title: 'Settings',
                    description: 'Platform configs & Batch manager',
                    href: '/settings',
                    iconComponent: <Settings className="w-6 h-6" />,
                    gradient: 'from-slate-100 to-gray-200',
                    textColor: 'text-slate-700',
                    borderColor: 'border-slate-300'
                }
            ];
        } else {
            return [
                {
                    id: 'attendance',
                    title: 'Mark Attendance',
                    description: 'Record daily class attendance',
                    href: '/attendance',
                    iconComponent: <ClipboardCheck className="w-6 h-6" />,
                    gradient: 'from-emerald-100 to-teal-100',
                    textColor: 'text-emerald-700',
                    borderColor: 'border-emerald-200'
                },
                {
                    id: 'classes',
                    title: 'My Classes',
                    description: 'View your assigned schedule',
                    href: '/classes',
                    iconComponent: <UsersRound className="w-6 h-6" />,
                    gradient: 'from-blue-100 to-indigo-100',
                    textColor: 'text-blue-700',
                    borderColor: 'border-blue-200'
                },
                {
                    id: 'reports',
                    title: 'Reports',
                    description: 'View student attendance reports',
                    href: '/reports',
                    iconComponent: <BarChart3 className="w-6 h-6" />,
                    gradient: 'from-violet-100 to-purple-100',
                    textColor: 'text-violet-700',
                    borderColor: 'border-violet-200'
                },
            ];
        }
    };

    const cards = getCards();
    const roleLabel = user.role.replace('_', ' ').toUpperCase();

    // ── RENDER STUDENT DASHBOARD VIEW (Mobile First Premium) ──
    if (user.role === 'student') {
        const pendingPayments = studentPayments.filter(p => p.status !== 'completed');
        const pendingPaymentsCount = pendingPayments.length;
        const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        
        // Attendance circle properties
        const attendancePct = studentAttendance?.percentage ?? 0;
        const radius = 32;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (circumference * attendancePct) / 100;

        return (
            <div className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-900 font-sans sm:pb-8">
                <MobileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} onLogout={handleLogout} />
                <Navbar user={user} onMenuClick={() => setSidebarOpen(true)} onLogout={handleLogout} />

                <main className="flex-1 max-w-5xl mx-auto w-full pt-20 px-4 sm:px-6 pb-24 space-y-6 md:space-y-8">
                    {/* Header Section */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Welcome back,</p>
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                                {studentProfile?.first_name || user.firstName}
                            </h1>
                        </div>
                        <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xl md:text-2xl shadow-lg shadow-blue-500/30 border-2 border-white shrink-0">
                            {user.firstName[0]}
                        </div>
                    </div>

                    {/* Important Alerts */}
                    {pendingPaymentsCount > 0 && (
                        <div 
                            onClick={() => router.push('/my-fees')}
                            className="relative overflow-hidden group p-5 md:p-6 bg-gradient-to-br from-rose-500 to-red-600 rounded-3xl shadow-xl shadow-red-500/20 flex items-center justify-between gap-4 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                        >
                            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 md:w-48 md:h-48 bg-white/10 rounded-full blur-2xl md:blur-3xl"></div>
                            <div className="relative flex items-center gap-4 md:gap-6">
                                <div className="p-3 md:p-4 bg-white/20 backdrop-blur-md text-white rounded-2xl shrink-0">
                                    <AlertTriangle className="w-6 h-6 md:w-8 md:h-8" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base md:text-lg">Action Required</h3>
                                    <p className="text-rose-100 text-sm md:text-base font-medium mt-0.5 md:mt-1">
                                        You have <span className="font-bold text-white">₹{totalPendingAmount.toLocaleString('en-IN')}</span> in pending fees.
                                    </p>
                                </div>
                            </div>
                            <ChevronRight className="relative w-5 h-5 md:w-6 md:h-6 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
                        </div>
                    )}

                    {/* Main Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        {/* Huge Attendance Card */}
                        <div className="col-span-2 md:col-span-2 rounded-3xl bg-white shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-slate-100 p-5 md:p-6 flex flex-row items-center justify-between">
                            <div className="flex-1">
                                <h3 className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Attendance</h3>
                                <p className="text-2xl md:text-4xl font-extrabold text-slate-800 mb-2 md:mb-3">
                                    {studentAttendance?.present || 0} <span className="text-sm md:text-lg font-medium text-slate-500">/ {studentAttendance?.total || 0} classes</span>
                                </p>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg text-xs md:text-sm font-bold ${
                                    attendancePct >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                    <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${attendancePct >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                    {attendancePct >= 75 ? 'On Track' : 'Needs Attention'}
                                </span>
                            </div>
                            
                            <div className="relative w-24 h-24 md:w-32 md:h-32 shrink-0 flex items-center justify-center">
                                <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 96 96">
                                    <circle cx="48" cy="48" r={radius} className="stroke-slate-100 fill-transparent" strokeWidth="8" />
                                    <circle
                                        cx="48" cy="48" r={radius}
                                        className={`fill-transparent transition-all duration-1000 ease-out ${
                                            attendancePct >= 75 ? 'stroke-emerald-500' : 'stroke-amber-500'
                                        }`}
                                        strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-xl md:text-2xl font-black text-slate-800">{attendancePct}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Batch Info */}
                        <div className="col-span-1 md:col-span-1 rounded-3xl bg-gradient-to-b from-indigo-50 to-blue-50/50 border border-indigo-100/50 p-5 md:p-6 flex flex-col justify-between">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 md:mb-6">
                                <Building2 className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div>
                                <h3 className="text-xs md:text-sm font-bold text-indigo-400 uppercase tracking-wider mb-1">My Batch</h3>
                                <p className="text-lg md:text-xl font-extrabold text-slate-800 leading-tight">{studentProfile?.batch_name || 'N/A'}</p>
                                <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">Class of {studentProfile?.batch_year || '2026'}</p>
                            </div>
                        </div>

                        {/* Courses */}
                        <div className="col-span-1 md:col-span-1 rounded-3xl bg-gradient-to-b from-purple-50 to-fuchsia-50/50 border border-purple-100/50 p-5 md:p-6 flex flex-col justify-between">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4 md:mb-6">
                                <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <div>
                                <h3 className="text-xs md:text-sm font-bold text-purple-400 uppercase tracking-wider mb-1">Enrolled</h3>
                                <p className="text-lg md:text-xl font-extrabold text-slate-800 leading-tight">{studentSubjects.length} Courses</p>
                                <p className="text-xs md:text-sm font-medium text-slate-500 mt-1">Active Syllabus</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Navigation / Actions */}
                    <div className="pt-2 md:pt-4">
                        <h3 className="text-sm md:text-base font-bold text-slate-900 mb-4 px-1">Quick Actions</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                            <button 
                                onClick={() => router.push('/my-fees')}
                                className="group flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-4 p-5 md:p-6 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_15px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-blue-200 transition-all active:scale-95"
                            >
                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shrink-0">
                                    <CreditCard className="w-5 h-5 md:w-6 md:h-6" />
                                </div>
                                <span className="text-xs md:text-sm font-bold text-slate-700">Fee Ledger</span>
                            </button>
                            <button 
                                onClick={() => router.push('/my-settings')}
                                className="group flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-4 p-5 md:p-6 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_15px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-slate-300 transition-all active:scale-95"
                            >
                                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-slate-800 group-hover:text-white transition-all duration-300 shrink-0">
                                    <Settings className="w-5 h-5 md:w-6 md:h-6" />
                                </div>
                                <span className="text-xs md:text-sm font-bold text-slate-700">Settings</span>
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // ── RENDER ADMIN & TEACHER VIEW ──
    return (
        <div className="min-h-screen bg-[#f5f5f7] flex flex-col font-sans">
            <MobileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} onLogout={handleLogout} />
            <Navbar user={user} onMenuClick={() => setSidebarOpen(true)} onLogout={handleLogout} />

            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 mt-16 space-y-6">
                <AdminDashboardContent user={user} mounted={mounted} router={router} />
            </main>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// Admin Dashboard Content — Professional SaaS Design
// ═══════════════════════════════════════════════════════════════
interface AdminStats {
    counts: { totalStudents: number; activeStudents: number; totalTeachers: number; totalBatches: number; totalSubjects: number; };
    fees: { totalCollected: number; totalPending: number; countPaid: number; countPending: number; };
    todayAttendance: { classesToday: number; presentToday: number; absentToday: number; };
    recentClasses: any[];
    recentPayments: any[];
    batchDistribution: any[];
}

function AdminDashboardContent({ user, mounted, router }: { user: User; mounted: boolean; router: any }) {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        (async () => {
            try {
                const res = await fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) setStats(await res.json());
            } catch (err) { console.error('Admin stats error:', err); }
            finally { setLoadingStats(false); }
        })();
    }, []);

    if (loadingStats) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const s = stats;
    const todayPresent = s?.todayAttendance.presentToday || 0;
    const todayAbsent = s?.todayAttendance.absentToday || 0;
    const todayTotal = todayPresent + todayAbsent;
    const todayRate = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0;

    const quickNav = user.role === 'super_admin' ? [
        { title: 'Batches', href: '/batches', icon: <Building2 className="w-4 h-4" />, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-100' },
        { title: 'Subjects', href: '/subjects', icon: <BookOpen className="w-4 h-4" />, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-100' },
        { title: 'Teachers', href: '/teachers', icon: <Users className="w-4 h-4" />, color: 'text-rose-500', bg: 'bg-rose-50 border-rose-100' },
        { title: 'Students', href: '/students', icon: <GraduationCap className="w-4 h-4" />, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-100' },
        { title: 'Holidays', href: '/holidays', icon: <CalendarDays className="w-4 h-4" />, color: 'text-cyan-500', bg: 'bg-cyan-50 border-cyan-100' },
        { title: 'Reports', href: '/reports', icon: <BarChart3 className="w-4 h-4" />, color: 'text-violet-500', bg: 'bg-violet-50 border-violet-100' },
        { title: 'Payments', href: '/payments', icon: <CreditCard className="w-4 h-4" />, color: 'text-teal-500', bg: 'bg-teal-50 border-teal-100' },
        { title: 'Settings', href: '/settings', icon: <Settings className="w-4 h-4" />, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-100' },
    ] : [
        { title: 'Attendance', href: '/attendance', icon: <ClipboardCheck className="w-4 h-4" />, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-100' },
        { title: 'My Classes', href: '/classes', icon: <UsersRound className="w-4 h-4" />, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-100' },
        { title: 'Reports', href: '/reports', icon: <BarChart3 className="w-4 h-4" />, color: 'text-violet-500', bg: 'bg-violet-50 border-violet-100' },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Overview</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Welcome back, {user.firstName}. Here is what&apos;s happening today.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-700 border border-gray-200">
                        {user.role.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500 font-medium hidden sm:block">
                        {mounted ? new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                </div>
            </div>

            {/* Quick Access Menu */}
            <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar gap-2">
                {quickNav.map(n => (
                    <button key={n.title} onClick={() => router.push(n.href)}
                        className="group flex items-center gap-2 whitespace-nowrap px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
                        <span className={`p-1 rounded-md border ${n.bg} ${n.color}`}>{n.icon}</span>
                        {n.title}
                    </button>
                ))}
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <MetricCard 
                    label="Total Students" 
                    value={s?.counts.totalStudents || 0} 
                    subtext={`${s?.counts.activeStudents || 0} active currently`}
                />
                <MetricCard 
                    label="Active Teachers" 
                    value={s?.counts.totalTeachers || 0} 
                    subtext="Across all batches"
                />
                {user.role === 'super_admin' ? (
                    <>
                        <MetricCard 
                            label="Total Collections" 
                            value={`₹${(s?.fees.totalCollected || 0).toLocaleString('en-IN')}`}
                            subtext={`${s?.fees.countPaid || 0} successful payments`}
                            isCurrency
                        />
                        <MetricCard 
                            label="Pending Fees" 
                            value={`₹${(s?.fees.totalPending || 0).toLocaleString('en-IN')}`}
                            subtext={`${s?.fees.countPending || 0} pending invoices`}
                            isCurrency
                        />
                    </>
                ) : (
                    <>
                        <MetricCard label="Total Batches" value={s?.counts.totalBatches || 0} subtext="Assigned to you" />
                        <MetricCard label="Total Subjects" value={s?.counts.totalSubjects || 0} subtext="Assigned to you" />
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Main Content Area (2/3) */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Today's Attendance Overview */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">Today&apos;s Attendance</h3>
                            <span className="text-sm text-gray-500">{s?.todayAttendance.classesToday || 0} Classes Held</span>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-col sm:flex-row items-center gap-8">
                                <div className="flex items-center justify-center">
                                    {/* Simple CSS Donut Chart */}
                                    <div className="relative w-32 h-32 flex items-center justify-center rounded-full" 
                                         style={{ background: `conic-gradient(#10b981 ${todayRate}%, #f3f4f6 ${todayRate}% 100%)` }}>
                                        <div className="absolute w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center">
                                            <span className="text-2xl font-bold text-gray-900">{todayRate}%</span>
                                            <span className="text-xs text-gray-500 font-medium">Present</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 w-full space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium text-gray-700 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Present</span>
                                            <span className="font-semibold text-gray-900">{todayPresent} <span className="text-gray-500 font-normal">students</span></span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${todayTotal > 0 ? (todayPresent / todayTotal) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium text-gray-700 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gray-300"></div> Absent</span>
                                            <span className="font-semibold text-gray-900">{todayAbsent} <span className="text-gray-500 font-normal">students</span></span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div className="bg-gray-400 h-2 rounded-full" style={{ width: `${todayTotal > 0 ? (todayAbsent / todayTotal) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Batch Distribution Bar Chart */}
                    {user.role === 'super_admin' && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="text-base font-semibold text-gray-900">Students by Batch</h3>
                                <button onClick={() => router.push('/batches')} className="text-sm font-medium text-blue-600 hover:text-blue-800">View All</button>
                            </div>
                            <div className="p-6">
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                    {(s?.batchDistribution || []).length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-4">No batches found.</p>
                                    ) : (
                                        (s?.batchDistribution || []).map((b: any) => {
                                            const max = Math.max(...(s?.batchDistribution || []).map((x: any) => parseInt(x.student_count) || 1));
                                            const count = parseInt(b.student_count) || 0;
                                            const pct = Math.max(2, Math.round((count / max) * 100));
                                            return (
                                                <div key={b.id}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-medium text-gray-700">{b.name} <span className="text-gray-400 font-normal text-xs ml-1">({b.code})</span></span>
                                                        <span className="text-gray-900 font-medium">{count}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-sm h-6 overflow-hidden flex items-center group">
                                                        <div className="bg-blue-600 h-full rounded-sm transition-all" style={{ width: `${pct}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Column (1/3) */}
                <div className="space-y-6">
                    
                    {/* Recent Payments List */}
                    {user.role === 'super_admin' && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
                            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                                <h3 className="text-sm font-semibold text-gray-900">Recent Transactions</h3>
                                <button onClick={() => router.push('/payments')} className="text-xs font-medium text-blue-600 hover:text-blue-800">View Ledger</button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {(s?.recentPayments || []).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                        <CreditCard className="w-8 h-8 text-gray-300 mb-2" />
                                        <p className="text-sm text-gray-500">No recent transactions</p>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-gray-100">
                                        {(s?.recentPayments || []).map((p: any, i: number) => (
                                            <li key={i} className="px-3 py-3 hover:bg-gray-50 rounded-lg transition-colors">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{p.first_name} {p.last_name}</p>
                                                        <p className="text-xs text-gray-500 truncate max-w-[150px]">{p.description}</p>
                                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                                            {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-semibold text-gray-900">₹{Number(p.amount).toLocaleString('en-IN')}</p>
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium mt-1 ${p.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : p.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                                                            {p.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Recent Classes List */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                            <h3 className="text-sm font-semibold text-gray-900">Recent Classes</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {(s?.recentClasses || []).length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                    <CalendarDays className="w-8 h-8 text-gray-300 mb-2" />
                                    <p className="text-sm text-gray-500">No classes recorded</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {(s?.recentClasses || []).map((c: any, i: number) => (
                                        <li key={i} className="px-3 py-3 hover:bg-gray-50 rounded-lg transition-colors">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="text-sm font-medium text-gray-900 truncate">{c.subject_name}</p>
                                                <p className="text-xs font-semibold text-gray-700">{c.present_count}/{c.total_count}</p>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-gray-500">
                                                <span className="truncate">{c.batch_code} • {c.teacher_first_name}</span>
                                                <span className="whitespace-nowrap ml-2">{new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function MetricCard({ label, value, subtext, isCurrency = false }: { label: string; value: string | number; subtext: string; isCurrency?: boolean }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">{label}</h3>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900 tracking-tight">{value}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{subtext}</p>
        </div>
    );
}
