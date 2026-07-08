
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Mail, Eye, EyeOff, Loader2, Save, CheckCircle, AlertTriangle, ToggleLeft, ToggleRight, Settings, Coins, CreditCard } from 'lucide-react';
import { Navbar } from '@/components/ui/Navbar';
import { MobileSidebar } from '@/components/ui/MobileSidebar';

function AccessDenied() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                <Shield className="w-6 h-6" />
                <div>
                    <h2 className="font-bold text-lg">Access Denied</h2>
                    <p className="text-sm">You need Super Admin privileges to view this page.</p>
                </div>
            </div>
            <button 
                onClick={() => window.location.href = '/dashboard'}
                className="mt-6 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
                Return to Dashboard
            </button>
        </div>
    );
}

export default function SettingsPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<'course' | 'email' | 'razorpay'>('course');

    // ── Email Automation State ──
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [emailAddress, setEmailAddress] = useState('');
    const [emailPassword, setEmailPassword] = useState('');
    const [emailPasswordSet, setEmailPasswordSet] = useState(false);
    const [emailPasswordHint, setEmailPasswordHint] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loadingEmail, setLoadingEmail] = useState(false);
    const [savingEmail, setSavingEmail] = useState(false);
    const [emailMessage, setEmailMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    // ── Razorpay Integration State ──
    const [razorpayEnabled, setRazorpayEnabled] = useState(false);
    const [razorpayKeyId, setRazorpayKeyId] = useState('');
    const [razorpayKeyIdSet, setRazorpayKeyIdSet] = useState(false);
    const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
    const [razorpayKeySecretSet, setRazorpayKeySecretSet] = useState(false);
    const [razorpayWebhookSecret, setRazorpayWebhookSecret] = useState('');
    const [razorpayWebhookSecretSet, setRazorpayWebhookSecretSet] = useState(false);
    const [razorpayMerchantName, setRazorpayMerchantName] = useState('YSM Academy');
    const [razorpayThemeColor, setRazorpayThemeColor] = useState('#4f6dbc');
    const [showKeySecret, setShowKeySecret] = useState(false);
    const [loadingRazorpay, setLoadingRazorpay] = useState(false);
    const [savingRazorpay, setSavingRazorpay] = useState(false);
    const [razorpayMessage, setRazorpayMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    // ── Course & Fees State ──
    const [academyName, setAcademyName] = useState('YSM Academy');
    const [academySubName, setAcademySubName] = useState('Competition Wing');
    const [registrationFee, setRegistrationFee] = useState(500);
    const [durationMonths, setDurationMonths] = useState(6);
    const [loadingCourseFee, setLoadingCourseFee] = useState(false);
    const [savingCourseFee, setSavingCourseFee] = useState(false);
    const [courseFeeMessage, setCourseFeeMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (!token || !userData) {
            router.replace('/login');
            return;
        }

        try {
            setUser(JSON.parse(userData));
        } catch (e) {
            router.replace('/login');
        }
        setLoading(false);
    }, [router]);

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

    // ── Fetch Razorpay Config ──
    useEffect(() => {
        const fetchRazorpayConfig = async () => {
            if (!user) return;
            if (user.role !== 'super_admin') return;
            setLoadingRazorpay(true);
            try {
                const response = await fetch('/api/settings/razorpay-config', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setRazorpayEnabled(data.enabled ?? false);
                    setRazorpayKeyId(data.keyId ?? '');
                    setRazorpayKeyIdSet(data.keyIdSet ?? false);
                    setRazorpayKeySecretSet(data.keySecretSet ?? false);
                    setRazorpayWebhookSecretSet(data.webhookSecretSet ?? false);
                    setRazorpayMerchantName(data.merchantName ?? 'YSM Academy');
                    setRazorpayThemeColor(data.themeColor ?? '#4f6dbc');
                }
            } catch (err) {
                console.error('Failed to load Razorpay config', err);
            } finally {
                setLoadingRazorpay(false);
            }
        };

        fetchRazorpayConfig();
    }, [user]);

    // ── Fetch Course Fee Config ──
    useEffect(() => {
        const fetchCourseFeeConfig = async () => {
            if (!user) return;
            if (user.role !== 'super_admin') return;
            setLoadingCourseFee(true);
            try {
                const response = await fetch('/api/settings/course-fee-config', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setAcademyName(data.academyName ?? 'YSM Academy');
                    setAcademySubName(data.academySubName ?? 'Competition Wing');
                    setRegistrationFee(data.registrationFee ?? 500);
                    setDurationMonths(data.durationMonths ?? 6);
                }
            } catch (err) {
                console.error('Failed to load Course fee config', err);
            } finally {
                setLoadingCourseFee(false);
            }
        };

        fetchCourseFeeConfig();
    }, [user]);

    // ── Save Course Fee Config ──
    const handleSaveCourseFeeConfig = async () => {
        setSavingCourseFee(true);
        setCourseFeeMessage(null);

        try {
            const response = await fetch('/api/settings/course-fee-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    academyName,
                    academySubName,
                    registrationFee: Number(registrationFee) || 0,
                    durationMonths: Number(durationMonths) || 0
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save course fee configuration');
            }

            setCourseFeeMessage({ type: 'success', text: 'Course fee settings saved successfully!' });
        } catch (error: any) {
            setCourseFeeMessage({ type: 'error', text: error.message });
        } finally {
            setSavingCourseFee(false);
        }
    };

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
                    password: emailPassword,
                    enabled: emailEnabled
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save email configuration');
            }

            setEmailMessage({ type: 'success', text: 'Email settings saved successfully!' });
            setEmailPassword('');
            setEmailPasswordSet(true);
        } catch (error: any) {
            setEmailMessage({ type: 'error', text: error.message });
        } finally {
            setSavingEmail(false);
        }
    };

    // ── Save Razorpay Config ──
    const handleSaveRazorpayConfig = async () => {
        setSavingRazorpay(true);
        setRazorpayMessage(null);

        try {
            const response = await fetch('/api/settings/razorpay-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    enabled: razorpayEnabled,
                    keyId: razorpayKeyId,
                    keySecret: razorpayKeySecret,
                    webhookSecret: razorpayWebhookSecret,
                    merchantName: razorpayMerchantName,
                    themeColor: razorpayThemeColor
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save Razorpay configuration');
            }

            setRazorpayMessage({ type: 'success', text: 'Razorpay settings saved successfully!' });
            setRazorpayKeySecret('');
            setRazorpayWebhookSecret('');
            setRazorpayKeySecretSet(true);
        } catch (error: any) {
            setRazorpayMessage({ type: 'error', text: error.message });
        } finally {
            setSavingRazorpay(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/login');
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
                    
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Platform Settings</h1>
                        <p className="text-gray-500">Configure global configurations, payment settings, templates, and branding.</p>
                    </div>

                    {/* Section Selector (Top Tabs) */}
                    <div className="flex border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar scroll-smooth gap-2">
                        {[
                            { key: 'course', label: 'Course & Fees', icon: Coins },
                            { key: 'email', label: 'Email Automation', icon: Mail },
                            { key: 'razorpay', label: 'Razorpay Payments', icon: CreditCard },
                        ].map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeSection === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveSection(tab.key as any)}
                                    className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                                        isActive
                                            ? 'border-indigo-600 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* ═══════════════════════════════════════════════
                        Email Automation Detail View
                    ═══════════════════════════════════════════════ */}
                    {activeSection === 'email' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Email Automation</h2>
                                    <div className="ml-auto flex items-center gap-2">
                                        <span className={`text-xs font-semibold ${emailEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                                            {emailEnabled ? 'ENABLED' : 'DISABLED'}
                                        </span>
                                        <button onClick={() => setEmailEnabled(!emailEnabled)} className="transition-transform active:scale-95" aria-label="Toggle email automation">
                                            {emailEnabled ? <ToggleRight className="w-10 h-10 text-green-500 drop-shadow-sm" /> : <ToggleLeft className="w-10 h-10 text-gray-300" />}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs sm:text-sm text-gray-500 mt-2">
                                    Automatically send monthly PDF Report Cards via email to students whose attendance falls below 60%.
                                </p>
                            </div>

                            <div className="p-4 sm:p-6">
                                {emailMessage && (
                                    <div className={`p-4 rounded-xl mb-6 text-sm flex items-start gap-3 ${emailMessage.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
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

                                        <div className="mb-5">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Gmail Address</label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input type="email" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} placeholder="your-college-email@gmail.com" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors font-medium text-gray-900" />
                                            </div>
                                        </div>

                                        <div className="mb-6">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                App Password (16 characters)
                                                {emailPasswordSet && !emailPassword && (
                                                    <span className="ml-2 text-xs font-normal text-green-600">✓ Password is saved ({emailPasswordHint})</span>
                                                )}
                                            </label>
                                            <div className="relative">
                                                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input type={showPassword ? 'text' : 'password'} value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} placeholder={emailPasswordSet ? 'Leave empty to keep current password' : 'xxxx xxxx xxxx xxxx'} className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors font-medium text-gray-900 font-mono tracking-wider" />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className={`rounded-xl p-4 mb-6 border transition-colors ${emailEnabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                            <div className="flex items-center gap-3">
                                                {emailEnabled ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" /> : <ToggleLeft className="w-5 h-5 text-gray-400 shrink-0" />}
                                                <div>
                                                    <p className={`text-sm font-semibold ${emailEnabled ? 'text-green-800' : 'text-gray-600'}`}>
                                                        {emailEnabled ? 'Monthly Reports Active' : 'Monthly Reports Paused'}
                                                    </p>
                                                    <p className={`text-xs ${emailEnabled ? 'text-green-700' : 'text-gray-500'}`}>
                                                        {emailEnabled ? 'PDF report cards will be automatically emailed on the 1st of every month.' : 'Toggle the switch above to enable automatic monthly email reports.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <button onClick={handleSaveEmailConfig} disabled={savingEmail || !emailAddress} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${savingEmail || !emailAddress ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/20 active:scale-[0.99]'}`}>
                                            {savingEmail ? (<><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>) : (<><Save className="w-5 h-5 shrink-0" /> Save Email Settings</>)}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════
                        Razorpay Section Detail View
                    ═══════════════════════════════════════════════ */}
                    {activeSection === 'razorpay' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-orange-50/80 to-amber-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-100 text-orange-700 rounded-lg shrink-0">
                                        <CreditCard className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Razorpay Payment Integration</h2>
                                    <div className="ml-auto flex items-center gap-2">
                                        <span className={`text-xs font-semibold ${razorpayEnabled ? 'text-orange-600' : 'text-gray-400'}`}>
                                            {razorpayEnabled ? 'ENABLED' : 'DISABLED'}
                                        </span>
                                        <button onClick={() => setRazorpayEnabled(!razorpayEnabled)} className="transition-transform active:scale-95" aria-label="Toggle Razorpay integration">
                                            {razorpayEnabled ? <ToggleRight className="w-10 h-10 text-orange-500 drop-shadow-sm" /> : <ToggleLeft className="w-10 h-10 text-gray-300" />}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs sm:text-sm text-gray-500 mt-2">
                                    Configure credentials and appearance details to connect with Razorpay Checkout for student fee payments (INR only).
                                </p>
                            </div>

                            <div className="p-4 sm:p-6">
                                {razorpayMessage && (
                                    <div className={`p-4 rounded-xl mb-6 text-sm flex items-start gap-3 ${razorpayMessage.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                                        {razorpayMessage.type === 'error' ? <AlertTriangle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
                                        <p className="font-medium mt-0.5">{razorpayMessage.text}</p>
                                    </div>
                                )}

                                {loadingRazorpay ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                                        <span className="ml-2 text-sm text-gray-500">Loading Razorpay config...</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    Razorpay Key ID
                                                    {razorpayKeyIdSet && <span className="ml-2 text-xs font-normal text-green-600">✓ Saved</span>}
                                                </label>
                                                <input type="text" value={razorpayKeyId} onChange={(e) => setRazorpayKeyId(e.target.value)} placeholder="rzp_test_xxxxxxxxxxxxxx" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-colors font-medium text-gray-900" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    Razorpay Key Secret
                                                    {razorpayKeySecretSet && !razorpayKeySecret && <span className="ml-2 text-xs font-normal text-green-600">✓ Saved</span>}
                                                </label>
                                                <div className="relative">
                                                    <input type={showKeySecret ? 'text' : 'password'} value={razorpayKeySecret} onChange={(e) => setRazorpayKeySecret(e.target.value)} placeholder={razorpayKeySecretSet ? '••••••••••••••••••••••••' : 'Enter Secret Key'} className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-colors font-medium text-gray-900" />
                                                    <button type="button" onClick={() => setShowKeySecret(!showKeySecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                                        {showKeySecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Webhook Secret (Optional)</label>
                                                <input type="password" value={razorpayWebhookSecret} onChange={(e) => setRazorpayWebhookSecret(e.target.value)} placeholder={razorpayWebhookSecretSet ? '••••••••••••••••' : 'Enter Webhook Secret'} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-colors font-medium text-gray-900" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
                                                <div className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">
                                                    INR (₹) — Indian Rupee
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Merchant Display Name</label>
                                                <input type="text" value={razorpayMerchantName} onChange={(e) => setRazorpayMerchantName(e.target.value)} placeholder="YSM Academy" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-colors font-medium text-gray-900" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Checkout Theme Color (Hex)</label>
                                                <div className="flex gap-2">
                                                    <input type="color" value={razorpayThemeColor} onChange={(e) => setRazorpayThemeColor(e.target.value)} className="w-12 h-11 p-1 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer" />
                                                    <input type="text" value={razorpayThemeColor} onChange={(e) => setRazorpayThemeColor(e.target.value)} placeholder="#4f6dbc" className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-colors font-mono font-medium text-gray-900" />
                                                </div>
                                            </div>
                                        </div>

                                        <button onClick={handleSaveRazorpayConfig} disabled={savingRazorpay || !razorpayKeyId} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${savingRazorpay || !razorpayKeyId ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg hover:shadow-orange-500/20 active:scale-[0.99]'}`}>
                                            {savingRazorpay ? (<><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>) : (<><Save className="w-5 h-5 shrink-0" /> Save Razorpay Config</>)}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════
                        Course & Fees Detail View
                    ═══════════════════════════════════════════════ */}
                    {activeSection === 'course' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                                        <Coins className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Course & Fees Configuration</h2>
                                </div>
                                <p className="text-xs sm:text-sm text-gray-500 mt-2">
                                    Configure the base registration fees, monthly tuition fees, and course duration for competitive exam preparation.
                                </p>
                            </div>

                            <div className="p-4 sm:p-6">
                                {courseFeeMessage && (
                                    <div className={`p-4 rounded-xl mb-6 text-sm flex items-start gap-3 ${courseFeeMessage.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                                        {courseFeeMessage.type === 'error' ? <AlertTriangle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
                                        <p className="font-medium mt-0.5">{courseFeeMessage.text}</p>
                                    </div>
                                )}

                                {loadingCourseFee ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                                        <span className="ml-2 text-sm text-gray-500">Loading course fee config...</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Academy Display Name</label>
                                                <input type="text" value={academyName} onChange={(e) => setAcademyName(e.target.value)} placeholder="e.g. YSM Academy" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors font-medium text-gray-900" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Branch / Sub-heading</label>
                                                <input type="text" value={academySubName} onChange={(e) => setAcademySubName(e.target.value)} placeholder="e.g. Competition Wing" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors font-medium text-gray-900" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Admission/Registration Fee (₹)</label>
                                                <input type="number" value={registrationFee} onChange={(e) => setRegistrationFee(Number(e.target.value))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors font-medium text-gray-900" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Course Duration (Months)</label>
                                                <input type="number" value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors font-medium text-gray-900" />
                                            </div>
                                        </div>

                                        <button onClick={handleSaveCourseFeeConfig} disabled={savingCourseFee} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${savingCourseFee ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg hover:shadow-emerald-500/20 active:scale-[0.99]'}`}>
                                            {savingCourseFee ? (<><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>) : (<><Save className="w-5 h-5 shrink-0" /> Save Course Settings</>)}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
