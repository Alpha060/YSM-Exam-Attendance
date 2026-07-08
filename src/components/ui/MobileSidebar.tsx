'use client';

import { useEffect, useState } from 'react';
import { 
    X, 
    Settings, 
    LayoutDashboard, 
    Building2, 
    BookOpen, 
    Users, 
    GraduationCap, 
    CalendarDays, 
    BarChart3, 
    ClipboardCheck,
    UsersRound, 
    User,
    TrendingUp,
    CreditCard
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { getInitials } from '@/lib/utils';
import { ProfileModal } from './ProfileModal';

interface MobileSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    user: {
        role: string;
        [key: string]: any;
    };
    onLogout?: () => void;
}

export function MobileSidebar({ isOpen, onClose, user, onLogout }: MobileSidebarProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            // Allow DOM to mount before triggering transition
            const timer = setTimeout(() => setIsMounted(true), 10);
            return () => clearTimeout(timer);
        } else {
            setIsMounted(false);
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isVisible) return null;

    const navigateTo = (href: string) => {
        onClose();
        router.push(href);
    };

    const getNavLinks = () => {
        const commonLinks = [
            { id: 'dashboard', title: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-[16px] h-[16px]" /> },
        ];
        
        if (user.role === 'super_admin') {
            return [
                { group: 'Main Menu', items: commonLinks },
                { group: 'Academics', items: [
                    { id: 'batches', title: 'Batches', href: '/batches', icon: <Building2 className="w-[16px] h-[16px]" /> },
                    { id: 'subjects', title: 'Subjects', href: '/subjects', icon: <BookOpen className="w-[16px] h-[16px]" /> },
                    { id: 'holidays', title: 'Holidays', href: '/holidays', icon: <CalendarDays className="w-[16px] h-[16px]" /> },
                ]},
                { group: 'People', items: [
                    { id: 'teachers', title: 'Teachers', href: '/teachers', icon: <Users className="w-[16px] h-[16px]" /> },
                    { id: 'students', title: 'Students', href: '/students', icon: <GraduationCap className="w-[16px] h-[16px]" /> },
                ]},
                { group: 'Finance & Analytics', items: [
                    { id: 'payments', title: 'Payments', href: '/payments', icon: <CreditCard className="w-[16px] h-[16px]" /> },
                    { id: 'reports', title: 'Reports', href: '/reports', icon: <BarChart3 className="w-[16px] h-[16px]" /> },
                ]}
            ];
        } else if (user.role === 'teacher') {
            return [
                { group: 'Main Menu', items: commonLinks },
                { group: 'Classes', items: [
                    { id: 'attendance', title: 'Mark Attendance', href: '/attendance', icon: <ClipboardCheck className="w-[16px] h-[16px]" /> },
                    { id: 'classes', title: 'My Classes', href: '/classes', icon: <UsersRound className="w-[16px] h-[16px]" /> },
                ]},
                { group: 'Analytics', items: [
                    { id: 'reports', title: 'Reports', href: '/reports', icon: <BarChart3 className="w-[16px] h-[16px]" /> },
                ]}
            ];
        } else if (user.role === 'student') {
            return [
                { group: 'Main Menu', items: commonLinks },
                { group: 'Personal', items: [
                    { id: 'fees', title: 'My Fees', href: '/my-fees', icon: <CreditCard className="w-[16px] h-[16px]" /> },
                    { id: 'settings', title: 'Settings', href: '/my-settings', icon: <Settings className="w-[16px] h-[16px]" /> }
                ]}
            ];
        } else {
            return [{ group: 'Main Menu', items: commonLinks }];
        }
    };

    const navLinks = getNavLinks();

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-slate-900/40 z-40 transition-opacity duration-300 ${isMounted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Sidebar */}
            <div 
                className={`fixed left-0 top-0 h-full w-64 bg-[#0B1120]/95 backdrop-blur-2xl border-r border-white/10 shadow-[4px_0_24px_rgba(0,0,0,0.5)] z-50 flex flex-col transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${isMounted ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Header App Branding */}
                <div className="relative overflow-hidden flex flex-col border-b border-white/10 bg-[#0f172a]">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-blue-500/10 blur-3xl" />
                    <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 rounded-full bg-indigo-500/10 blur-3xl" />
                    
                    <div className="relative flex items-start justify-between p-5">
                        <div className="flex flex-col gap-3 w-full">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl blur opacity-40 group-hover:opacity-70 transition-opacity duration-300"></div>
                                        <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center p-0.5 shadow-md">
                                            <div className="w-full h-full rounded-[10px] border-2 border-slate-800 bg-slate-900 flex items-center justify-center">
                                                <span className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-br from-blue-400 to-indigo-400">
                                                    {getInitials(user.firstName || '', user.lastName || '')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 mt-0.5">
                                        <h2 className="text-lg font-bold text-white leading-tight">
                                            {user.firstName || 'User'} {user.lastName || ''}
                                        </h2>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.role?.replace('_', ' ')}</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 -mr-3 -mt-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all hover:rotate-90 active:scale-90"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <button
                                onClick={() => setShowProfileModal(true)}
                                className="group w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/50 text-[13px] font-semibold text-slate-300 hover:text-white rounded-lg shadow-sm transition-all duration-300"
                            >
                                <User className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                Manage Profile
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/50 hover:[&::-webkit-scrollbar-thumb]:bg-slate-600/80 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {navLinks.map((group, groupIdx) => (
                        <div key={groupIdx} className="space-y-1">
                            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{group.group}</p>
                            <div className="space-y-0.5">
                                {group.items.map((link) => {
                                    const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                                    return (
                                        <button
                                            key={link.id}
                                            onClick={() => navigateTo(link.href)}
                                            className={`w-full group relative flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 overflow-hidden ${
                                                isActive 
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' 
                                                : 'hover:bg-slate-800/50 text-slate-300 hover:text-white border border-transparent'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 pl-1">
                                                <div className={`transition-all duration-200 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                                                    {link.icon}
                                                </div>
                                                <span className={`text-[13px] tracking-wide transition-transform duration-200 ${isActive ? 'font-semibold' : 'font-medium group-hover:translate-x-0.5'}`}>
                                                    {link.title}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="p-3 border-t border-slate-800 bg-[#0f172a]">
                    {user.role === 'super_admin' && (
                        <button
                            onClick={() => navigateTo('/settings')}
                            className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 ${
                                pathname.startsWith('/settings') 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-slate-800/40 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
                            }`}
                        >
                            <div className="flex items-center gap-3 pl-1">
                                <div className={`transition-transform duration-300 ${pathname.startsWith('/settings') ? 'text-white rotate-90' : 'text-slate-400 group-hover:text-white group-hover:rotate-90'}`}>
                                    <Settings className="w-4 h-4" />
                                </div>
                                <span className={`text-[13px] tracking-wide ${pathname.startsWith('/settings') ? 'font-semibold' : 'font-medium'}`}>
                                    System Settings
                                </span>
                            </div>
                        </button>
                    )}
                </div>
            </div>

            <ProfileModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                user={user as any}
                onLogout={onLogout}
            />
        </>
    );
}
