'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/ui/Navbar';
import { MobileSidebar } from '@/components/ui/MobileSidebar';
import { Save, AlertTriangle, Mail, Eye, EyeOff, ToggleLeft, ToggleRight, CheckCircle, Shield, Loader2 } from 'lucide-react';
import { AccessDenied } from '@/components/ui/access-denied';

interface User {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
}

export default function SettingsPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'email'>('email');
    
    // ── Email Automation State ──
    const [emailAddress, setEmailAddress] = useState('');
    const [emailPassword, setEmailPassword] = useState('');
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [emailPasswordHint, setEmailPasswordHint] = useState('');
    const [emailPasswordSet, setEmailPasswordSet] = useState(false);
    const [loadingEmail, setLoadingEmail] = useState(false);
    const [savingEmail, setSavingEmail] = useState(false);
    const [emailMessage, setEmailMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (!token || !userData) {
            router.replace('/login');
            return;
        }

        try {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
        } catch {
            router.replace('/login');
        }
        setLoading(false);
    }, [router]);

    // Fetch batch mappings removed

    // ── Fetch Email Config ──
    useEffect(() => {
        const fetchEmailConfig = async () => {
            if (!user) return;
            if (user.role !== 'super_admin') return;
            setLoadingEmail(true);
            try {
                const response = await fetch('/api/settings/email-config', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setEmailAddress(data.email || '');
                    setEmailPasswordSet(data.passwordSet || false);
                    setEmailPasswordHint(data.passwordHint || '');
                    setEmailEnabled(data.enabled || false);
                }
            } catch (err) {
                console.error('Failed to load email config', err);
            } finally {
                setLoadingEmail(false);
            }
        };

        fetchEmailConfig();
    }, [user]);

    // Real-time updates removed

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/login');
    };

    // Batch functions removed

    // ── Save Email Config ──
    const handleSaveEmailConfig = async () => {
        setSavingEmail(true);
        setEmailMessage(null);

        try {
            const response = await fetch('/api/settings/email-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    email: emailAddress,
                    password: emailPassword || '', // empty means keep existing
                    enabled: emailEnabled,
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save email configuration');
            }

            setEmailMessage({ type: 'success', text: 'Email configuration saved successfully!' });
            setEmailPassword(''); // Clear password field after save
            setEmailPasswordSet(true);
            setEmailPasswordHint(emailPassword ? `****${emailPassword.slice(-4)}` : emailPasswordHint);
        } catch (error: any) {
            setEmailMessage({ type: 'error', text: error.message });
        } finally {
            setSavingEmail(false);
        }
    };


    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (user.role !== 'super_admin') {
        return <AccessDenied />;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <MobileSidebar 
                isOpen={sidebarOpen} 
                onClose={() => setSidebarOpen(false)} 
                user={user} 
                onLogout={handleLogout}
            />

            <Navbar user={user} onMenuClick={() => setSidebarOpen(true)} onLogout={handleLogout} />

            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 mt-16">
                <div className="max-w-4xl mx-auto">
                    
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Platform Settings</h1>
                        <p className="text-gray-500">Configure global platform configurations and perform batch overrides.</p>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════
                        Email Automation Section
                    ═══════════════════════════════════════════════════════════ */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
                        <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/50">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Email Automation</h2>
                                {/* Toggle pill */}
                                <div className="ml-auto flex items-center gap-2">
                                    <span className={`text-xs font-semibold ${emailEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                                        {emailEnabled ? 'ENABLED' : 'DISABLED'}
                                    </span>
                                    <button
                                        onClick={() => setEmailEnabled(!emailEnabled)}
                                        className="transition-transform active:scale-95"
                                        aria-label="Toggle email automation"
                                    >
                                        {emailEnabled ? (
                                            <ToggleRight className="w-10 h-10 text-green-500 drop-shadow-sm" />
                                        ) : (
                                            <ToggleLeft className="w-10 h-10 text-gray-300" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                Automatically send monthly PDF Report Cards via email to students whose attendance falls below 60%. Reports cover the previous month and are sent on the 1st of every month.
                            </p>
                        </div>

                        <div className="p-4 sm:p-6">
                            {emailMessage && (
                                <div className={`p-4 rounded-xl mb-6 text-sm flex items-start gap-3 ${
                                    emailMessage.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'
                                }`}>
                                    {emailMessage.type === 'error' ? <AlertTriangle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
                                    <p className="font-medium mt-0.5">{emailMessage.text}</p>
                                </div>
                            )}

                            {loadingEmail ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                    <span className="ml-2 text-sm text-gray-500">Loading email settings...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Info Banner */}
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                                        <div className="flex items-start gap-3">
                                            <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-sm text-amber-800 font-semibold mb-1">Gmail App Password Required</p>
                                                <p className="text-xs text-amber-700 leading-relaxed">
                                                    Use a <strong>Gmail App Password</strong> (16 characters), not your regular password.
                                                    Go to <strong>Google Account → Security → 2-Step Verification → App Passwords</strong> to generate one.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Email Input */}
                                    <div className="mb-5">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Gmail Address
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="email"
                                                value={emailAddress}
                                                onChange={(e) => setEmailAddress(e.target.value)}
                                                placeholder="your-college-email@gmail.com"
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors font-medium text-gray-900"
                                            />
                                        </div>
                                    </div>

                                    {/* Password Input */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            App Password (16 characters)
                                            {emailPasswordSet && !emailPassword && (
                                                <span className="ml-2 text-xs font-normal text-green-600">
                                                    ✓ Password is saved ({emailPasswordHint})
                                                </span>
                                            )}
                                        </label>
                                        <div className="relative">
                                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={emailPassword}
                                                onChange={(e) => setEmailPassword(e.target.value)}
                                                placeholder={emailPasswordSet ? 'Leave empty to keep current password' : 'xxxx xxxx xxxx xxxx'}
                                                className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors font-medium text-gray-900 font-mono tracking-wider"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Enable/Disable Toggle Explanation */}
                                    <div className={`rounded-xl p-4 mb-6 border transition-colors ${
                                        emailEnabled 
                                            ? 'bg-green-50 border-green-200' 
                                            : 'bg-gray-50 border-gray-200'
                                    }`}>
                                        <div className="flex items-center gap-3">
                                            {emailEnabled ? (
                                                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                                            ) : (
                                                <ToggleLeft className="w-5 h-5 text-gray-400 shrink-0" />
                                            )}
                                            <div>
                                                <p className={`text-sm font-semibold ${emailEnabled ? 'text-green-800' : 'text-gray-600'}`}>
                                                    {emailEnabled ? 'Monthly Reports Active' : 'Monthly Reports Paused'}
                                                </p>
                                                <p className={`text-xs ${emailEnabled ? 'text-green-700' : 'text-gray-500'}`}>
                                                    {emailEnabled 
                                                        ? 'PDF report cards will be automatically emailed on the 1st of every month to students with attendance below 60%.'
                                                        : 'Toggle the switch above to enable automatic monthly email reports.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button
                                            onClick={handleSaveEmailConfig}
                                            disabled={savingEmail || !emailAddress}
                                            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                                                savingEmail || !emailAddress
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/20 active:scale-[0.99]'
                                            }`}
                                        >
                                            {savingEmail ? (
                                                <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
                                            ) : (
                                                <><Save className="w-5 h-5 shrink-0" /> Save Email Settings</>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
