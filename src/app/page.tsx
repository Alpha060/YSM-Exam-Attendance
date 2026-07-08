'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
    GraduationCap, ClipboardCheck, CalendarDays, BarChart3, 
    CreditCard, ArrowRight, ShieldCheck, CheckCircle2, ChevronRight, 
    Sparkles, ArrowUpRight, Zap, PlayCircle, Users
} from 'lucide-react';

// Intersection Observer for scroll animations
function useIntersectionObserver() {
    const [isIntersecting, setIsIntersecting] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsIntersecting(true);
                }
            },
            { threshold: 0.1 }
        );

        const currentRef = ref.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, []);

    return { ref, isIntersecting };
}

// Fade in on scroll component
function ScrollReveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string, delay?: number }) {
    const { ref, isIntersecting } = useIntersectionObserver();
    return (
        <div 
            ref={ref} 
            className={`transition-all duration-1000 ease-out transform ${
                isIntersecting 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-8'
            } ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}

export default function LandingPage() {
    const router = useRouter();
    const [redirecting, setRedirecting] = useState(true); // Start true — check auth first
    const [userFirstName, setUserFirstName] = useState('');
    const [scrolled, setScrolled] = useState(false);
    
    // Dynamic Academy Settings State
    const [academySettings, setAcademySettings] = useState({
        registrationFee: 500,
        monthlyFee: 1500,
        durationMonths: 6,
        academyName: 'YSM Academy',
        academySubName: 'Competition Wing'
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        if (token && userData) {
            // Redirect immediately — keep the spinner showing, never render landing page
            router.replace('/dashboard');
            return; // Don't set redirecting=false; spinner stays until navigation completes
        }

        // Not logged in — allow the landing page to render
        setRedirecting(false);

        // Fetch dynamic settings from public API
        const fetchAcademySettings = async () => {
            try {
                const res = await fetch('/api/public/course-fee-config');
                if (res.ok) {
                    const data = await res.json();
                    setAcademySettings({
                        registrationFee: data.registrationFee ?? 500,
                        monthlyFee: data.monthlyFee ?? 1500,
                        durationMonths: data.durationMonths ?? 6,
                        academyName: data.academyName || 'YSM Academy',
                        academySubName: data.academySubName || 'Competition Wing'
                    });
                }
            } catch (err) {
                console.error('Failed to load academy settings config:', err);
            }
        };

        fetchAcademySettings();

        const handleScroll = () => {
            if (window.scrollY > 10) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [router]);

    // Show a minimal spinner while checking auth / redirecting to dashboard
    if (redirecting) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFC]">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-slate-800 font-sans overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900">
            
            {/* --- Subtle Background Gradient --- */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-30%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-indigo-100/50 to-purple-100/30 blur-[120px]"></div>
                <div className="absolute top-[30%] right-[-15%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-bl from-blue-100/40 to-cyan-100/20 blur-[140px]"></div>
            </div>

            {/* --- Glass Navigation --- */}
            <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ease-out ${
                scrolled 
                    ? 'bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.03)] py-3 sm:py-4' 
                    : 'bg-transparent py-5 sm:py-6 border-b border-transparent'
            }`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    
                    {/* Logo & Branding */}
                    <div className="flex items-center gap-3 sm:gap-4 cursor-pointer group" onClick={() => router.push('/')}>
                        <div className="relative bg-white/80 backdrop-blur-md border border-white/60 shadow-sm rounded-2xl h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3 group-hover:shadow-indigo-500/10">
                            <img src="/college-logo.png" alt="Logo" className="w-[120%] h-[120%] object-cover" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {academySettings.academyName}
                            </span>
                            <span className="text-[9px] sm:text-[10px] font-bold text-indigo-500 tracking-[0.2em] uppercase">
                                {academySettings.academySubName}
                            </span>
                        </div>
                    </div>

                    {/* Nav Links - Hidden on mobile */}
                    <nav className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors">Features</a>
                        <a href="#courses" className="text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors">Pricing & Batches</a>
                    </nav>

                    {/* CTAs */}
                    <div className="flex items-center gap-3 sm:gap-4">
                        <button
                            onClick={() => router.push('/login')}
                            className="hidden sm:block text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors px-2"
                        >
                            Log In
                        </button>
                        <button
                            onClick={() => router.push('/register')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-sm font-bold shadow-lg hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0 group"
                        >
                            <span>Enroll Now</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </div>
            </header>

            {/* --- Hero Section --- */}
            <section className="relative z-10 pt-32 sm:pt-40 pb-20 md:pt-48 md:pb-32 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center min-h-[90vh]">
                <div className="max-w-5xl mx-auto text-center space-y-8 sm:space-y-10">
                    
                    {/* Badge */}
                    <ScrollReveal>
                        <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full bg-white/60 backdrop-blur-md border border-indigo-100 shadow-sm text-[11px] sm:text-xs font-bold text-indigo-600 tracking-wide uppercase">
                            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                            <span>Next-Gen Preparation Portal</span>
                        </div>
                    </ScrollReveal>

                    {/* Headline */}
                    <ScrollReveal delay={100}>
                        <h1 className="text-[2.75rem] sm:text-6xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight leading-[1.1] text-slate-900 px-2">
                            Accelerate your <br className="hidden sm:block" />
                            <span className="relative inline-block mt-1 sm:mt-0 pb-2">
                                <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent" style={{ WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone', padding: '0 0.05em' }}>
                                    Government Exams.
                                </span>
                                {/* Decorative underline */}
                                <div className="absolute -bottom-1 sm:-bottom-2 left-0 right-0 h-2 sm:h-3 bg-gradient-to-r from-indigo-200/50 to-purple-200/50 rounded-full blur-sm -z-10"></div>
                            </span>
                        </h1>
                    </ScrollReveal>

                    {/* Subheadline */}
                    <ScrollReveal delay={200}>
                        <p className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-slate-500 leading-relaxed font-medium px-4">
                            Join <strong className="text-slate-800 font-bold">{academySettings.academyName}</strong>'s premier batches. Get expert guidance, comprehensive study materials, and the winning strategy you need to crack your exams.
                        </p>
                    </ScrollReveal>

                    {/* Mobile optimized CTAs */}
                    <ScrollReveal delay={300} className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 pt-4 px-4 sm:px-0">
                        <button
                            onClick={() => router.push('/register')}
                            className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-[0_8px_30px_rgba(79,70,229,0.25)] hover:shadow-[0_8px_40px_rgba(79,70,229,0.35)] hover:-translate-y-1 active:translate-y-0 transition-all text-base group"
                        >
                            <span>Start Preparing Today</span>
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={() => router.push('/login')}
                            className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 border border-slate-200 shadow-sm hover:shadow-md transition-all text-base"
                        >
                            <PlayCircle className="w-5 h-5 text-indigo-400" />
                            <span>Student Login</span>
                        </button>
                    </ScrollReveal>

                    {/* Trust Indicators */}
                    <ScrollReveal delay={400} className="pt-12 sm:pt-16 pb-4">
                        <p className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-[0.2em] mb-6">Built for Excellence</p>
                        <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-12">
                            <div className="flex items-center gap-2.5 font-semibold text-slate-500 text-sm sm:text-base"><ShieldCheck className="w-5 h-5 text-indigo-500" /> Latest Patterns</div>
                            <div className="flex items-center gap-2.5 font-semibold text-slate-500 text-sm sm:text-base"><Zap className="w-5 h-5 text-amber-500" /> Daily Practice</div>
                            <div className="flex items-center gap-2.5 font-semibold text-slate-500 text-sm sm:text-base hidden sm:flex"><Users className="w-5 h-5 text-emerald-500" /> 1-on-1 Mentorship</div>
                        </div>
                    </ScrollReveal>
                </div>
            </section>

            {/* --- Premium Features Grid --- */}
            <section id="features" className="relative z-10 py-20 sm:py-32 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center max-w-2xl mx-auto mb-16 sm:mb-24">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">Everything you need to succeed.</h2>
                        <p className="text-base sm:text-lg text-slate-500 font-medium">A complete preparation ecosystem designed to help you master your syllabus and ace your competitive exams.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                        {[
                            { icon: GraduationCap, title: "Structured Curriculum", desc: "Expertly designed study plans tailored for top government competitive exams like SSC, Banking, and Railways.", color: "text-blue-600", bg: "bg-blue-100/50" },
                            { icon: Users, title: "Expert Faculty", desc: "Learn directly from seasoned educators with years of proven experience in cracking competitive exams.", color: "text-emerald-600", bg: "bg-emerald-100/50" },
                            { icon: BarChart3, title: "Mock Tests & Analysis", desc: "Regular assessment through realistic mock tests and comprehensive graphical performance analysis.", color: "text-purple-600", bg: "bg-purple-100/50" },
                            { icon: CalendarDays, title: "Doubt Clearing Sessions", desc: "Dedicated one-on-one time with instructors to resolve your queries and solidify your concepts.", color: "text-orange-600", bg: "bg-orange-100/50" },
                            { icon: ClipboardCheck, title: "Extensive Study Material", desc: "Get access to our premium library of class notes, previous year question papers, and interactive quizzes.", color: "text-indigo-600", bg: "bg-indigo-100/50" },
                            { icon: Zap, title: "Exam-Focused Strategy", desc: "Master time management, shortcut tricks, and strategies proven to help you score higher under pressure.", color: "text-cyan-600", bg: "bg-cyan-100/50" },
                        ].map((feature, idx) => (
                            <ScrollReveal key={idx} delay={idx * 50}>
                                <div className="group h-full p-8 bg-white rounded-[2rem] border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transform translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-500">
                                        <feature.icon className={`w-24 h-24 ${feature.color}`} />
                                    </div>
                                    <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-6`}>
                                        <feature.icon className={`w-7 h-7 ${feature.color}`} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed font-medium">{feature.desc}</p>
                                </div>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- Premium Pricing/Batches Section --- */}
            <section id="courses" className="py-20 sm:py-32 relative z-10 px-4 sm:px-6 lg:px-8 border-t border-slate-100 bg-slate-50/50">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
                        
                        {/* Text Content */}
                        <ScrollReveal className="space-y-8">
                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                                Simple Pricing. <br/>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Zero hidden fees.</span>
                            </h2>
                            <p className="text-lg text-slate-500 leading-relaxed font-medium max-w-lg">
                                We believe in complete transparency. Our competitive prep batch fees are straightforward, flexible, and completely digital.
                            </p>

                            <div className="space-y-5 pt-4">
                                {[
                                    `Targeted ${academySettings.durationMonths}-month intensive batches`,
                                    "Dedicated highly-qualified faculty",
                                    "Comprehensive digital study materials",
                                    "Instant digital invoicing & receipts"
                                ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-4">
                                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                        </div>
                                        <p className="text-base font-semibold text-slate-700">{item}</p>
                                    </div>
                                ))}
                            </div>
                        </ScrollReveal>

                        {/* High-End Pricing Card */}
                        <ScrollReveal delay={200}>
                            <div className="relative bg-[#0F172A] rounded-[2.5rem] p-8 sm:p-10 shadow-[0_20px_50px_rgba(15,23,42,0.2)] overflow-hidden text-white border border-slate-800">
                                {/* Decorative Glow */}
                                <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
                                <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-purple-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>

                                <div className="relative z-10 flex justify-between items-start border-b border-slate-800 pb-8 mb-8">
                                    <div>
                                        <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold tracking-wider uppercase mb-4 border border-indigo-500/30">
                                            Most Popular
                                        </span>
                                        <h3 className="text-2xl sm:text-3xl font-extrabold text-white">Target Batch</h3>
                                        <p className="text-slate-400 text-sm mt-2 font-medium">Full competitive syllabus coverage</p>
                                    </div>
                                </div>

                                <div className="space-y-6 relative z-10">
                                    <div className="flex justify-between items-center group">
                                        <div>
                                            <p className="text-base font-semibold text-slate-200">Registration</p>
                                            <p className="text-xs text-slate-500">One-time admission fee</p>
                                        </div>
                                        <p className="text-xl font-bold text-white font-mono">₹{academySettings.registrationFee.toLocaleString('en-IN')}</p>
                                    </div>
                                    
                                    <div className="flex justify-between items-center group">
                                        <div>
                                            <p className="text-base font-semibold text-slate-200">Monthly Tuition</p>
                                            <p className="text-xs text-slate-500">Billed monthly</p>
                                        </div>
                                        <p className="text-xl font-bold text-white font-mono">₹{academySettings.monthlyFee.toLocaleString('en-IN')}</p>
                                    </div>

                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent my-6"></div>

                                    <div className="flex justify-between items-end">
                                        <span className="text-sm font-semibold text-slate-400">Total Initial Due</span>
                                        <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                                            <span className="text-2xl text-slate-400 font-medium mr-1">₹</span>
                                            {(academySettings.registrationFee + academySettings.monthlyFee).toLocaleString('en-IN')}
                                        </span>
                                    </div>

                                    <button 
                                        onClick={() => router.push('/register')}
                                        className="w-full mt-8 py-4 sm:py-5 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl text-base font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 active:scale-[0.98]"
                                    >
                                        <span>Proceed to Enrollment</span>
                                        <ArrowUpRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </ScrollReveal>
                    </div>

                </div>
            </section>

            {/* --- Premium Footer --- */}
            <footer className="relative z-10 border-t border-slate-200 py-16 px-4 sm:px-6 lg:px-8 bg-white text-slate-500">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-white border border-slate-200 rounded-xl h-10 w-10 flex items-center justify-center overflow-hidden shadow-sm">
                            <img src="/college-logo.png" alt="Logo" className="w-[120%] h-[120%] object-cover" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-lg">{academySettings.academyName}</span>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{academySettings.academySubName}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 sm:gap-10 text-sm font-semibold text-slate-400">
                        <a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-indigo-600 transition-colors">Help Center</a>
                        <a href="#" className="hover:text-indigo-600 transition-colors">Contact</a>
                    </div>

                    <div className="text-center md:text-right">
                        <p className="text-sm font-medium">© {new Date().getFullYear()} {academySettings.academyName}.</p>
                        <p className="text-xs text-slate-400 mt-1">All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
