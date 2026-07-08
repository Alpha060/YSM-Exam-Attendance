'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileSidebar } from '@/components/ui/MobileSidebar';
import { Navbar } from '@/components/ui/Navbar';
import { AccessDenied } from '@/components/ui/access-denied';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, ChevronLeft, CheckCircle2, AlertTriangle, Download, Clock } from 'lucide-react';

interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'super_admin' | 'teacher' | 'student';
    batchId: string | null;
}

interface StudentProfile {
    id: string;
    student_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
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

export default function MyFeesPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
    const [razorpayConfig, setRazorpayConfig] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(false);
    const [payingPaymentId, setPayingPaymentId] = useState<string | null>(null);
    const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
    const [paymentError, setPaymentError] = useState<string | null>(null);

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

            if (parsedUser.role === 'student') {
                fetchPaymentsData(token);
                fetchProfileData(token);
            }
        } catch {
            router.replace('/login');
        }
        setLoading(false);
    }, [router]);

    const fetchProfileData = async (token: string) => {
        try {
            const res = await fetch('/api/student/dashboard', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStudentProfile(data.profile);
            }
        } catch (err) {
            console.error('Error fetching student profile:', err);
        }
    };

    const fetchPaymentsData = async (token: string) => {
        setLoadingData(true);
        try {
            const res = await fetch('/api/student/payments', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPayments(data.payments || []);
                setRazorpayConfig(data.razorpay || null);
            }
        } catch (err) {
            console.error('Error fetching student payments:', err);
        } finally {
            setLoadingData(false);
        }
    };

    const handleInitiatePayment = async (payment: PaymentRecord) => {
        if (!user) return;
        setPayingPaymentId(payment.id);
        setPaymentSuccess(null);
        setPaymentError(null);

        if (!razorpayConfig?.enabled || !razorpayConfig?.keyId) {
            setPaymentError('Online payment integration is currently offline.');
            setPayingPaymentId(null);
            return;
        }

        // Load Razorpay Checkout SDK Script
        const scriptLoaded = await new Promise<boolean>((resolve) => {
            if ((window as any).Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });

        if (!scriptLoaded) {
            setPaymentError('Failed to load Razorpay SDK. Please check your network connection.');
            setPayingPaymentId(null);
            return;
        }

        try {
            const options = {
                key: razorpayConfig.keyId,
                amount: Math.round(Number(payment.amount) * 100), // Razorpay expects paise
                currency: 'INR',
                name: razorpayConfig.merchantName || 'YSM Ranchi',
                description: payment.description || 'College Fees Payment',
                image: '/college-logo.png',
                handler: async function (response: any) {
                    setPayingPaymentId(payment.id);
                    const token = localStorage.getItem('token');
                    try {
                        const res = await fetch('/api/student/payments', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                paymentId: payment.id,
                                paymentMethod: 'Razorpay Checkout',
                                transactionId: response.razorpay_payment_id
                            })
                        });

                        const data = await res.json();
                        if (res.ok) {
                            setPaymentSuccess('Payment completed successfully via Razorpay!');
                            fetchPaymentsData(token!);
                        } else {
                            setPaymentError(data.error || 'Failed to complete payment transaction.');
                        }
                    } catch {
                        setPaymentError('Server communication error confirming transaction status.');
                    } finally {
                        setPayingPaymentId(null);
                    }
                },
                prefill: {
                    name: studentProfile ? `${studentProfile.first_name} ${studentProfile.last_name}` : user.firstName,
                    email: studentProfile?.email || user.email,
                    contact: studentProfile?.phone || ''
                },
                theme: {
                    color: razorpayConfig.themeColor || '#4f6dbc'
                },
                modal: {
                    ondismiss: function() {
                        setPayingPaymentId(null);
                    }
                }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', function (resp: any) {
                setPaymentError(resp.error.description || 'Payment transaction failed or was cancelled.');
                setPayingPaymentId(null);
            });
            rzp.open();
        } catch (err) {
            console.error('Razorpay launch error:', err);
            setPaymentError('Could not initialize Razorpay checkout script.');
            setPayingPaymentId(null);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
                <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) return null;

    if (user.role !== 'student') {
        return <AccessDenied message="Only students can access fee accounts." />;
    }

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex flex-col text-[#1d1d1f] font-sans antialiased">
            <MobileSidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                user={user}
                onLogout={handleLogout}
            />

            <Navbar user={user} onMenuClick={() => setSidebarOpen(true)} onLogout={handleLogout} />

            <main className="flex-1 max-w-4xl mx-auto w-full px-5 sm:px-8 py-10 mt-16 space-y-8">
                {/* Back Link */}
                <button
                    onClick={() => router.push('/dashboard')}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Dashboard</span>
                </button>

                {/* Header */}
                <div className="space-y-1.5">
                    <span className="text-[11px] font-extrabold tracking-widest text-[#86868b] uppercase">
                        Billing & Accounts
                    </span>
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#1d1d1f] leading-none">
                        Fees & Payments
                    </h1>
                    <p className="text-sm font-semibold text-[#86868b]">
                        Submit payments online securely and manage transaction receipt records.
                    </p>
                </div>

                {/* Warning banner when gateway is unconfigured/disabled */}
                {(!razorpayConfig?.enabled || !razorpayConfig?.keyId) && (
                    <div className="p-5 bg-amber-50 text-amber-900 border border-amber-200 rounded-[24px] flex items-start gap-4 shadow-sm">
                        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-extrabold text-base block">Online Payment Gateway Offline</span>
                            <span className="text-sm text-amber-700 leading-relaxed block mt-0.5">
                                Online fee payments are currently disabled or unconfigured by the administration. Please proceed to the billing desk to complete payment manually.
                            </span>
                        </div>
                    </div>
                )}

                {paymentSuccess && (
                    <div className="p-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span className="font-medium">{paymentSuccess}</span>
                    </div>
                )}
                {paymentError && (
                    <div className="p-4 bg-red-50 text-red-700 border border-red-100 rounded-2xl flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <span className="font-medium">{paymentError}</span>
                    </div>
                )}

                {loadingData ? (
                    <div className="py-12 flex justify-center bg-white rounded-2xl border border-gray-105 shadow-sm">
                        <div className="w-6 h-6 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <Card className="rounded-2xl border-[#e8e8ed] shadow-sm bg-white overflow-hidden">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-3.5 px-5 flex flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-4.5 h-4.5 text-indigo-500" />
                                <CardTitle className="text-sm font-extrabold text-gray-950">Tuition & Fee Records</CardTitle>
                            </div>
                            {razorpayConfig?.enabled && razorpayConfig?.keyId && (
                                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-100 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                                    💳 Active
                                </span>
                            )}
                        </CardHeader>
                        <CardContent className="p-3 sm:p-5">
                            <div className="space-y-3">
                                {payments.length > 0 ? (
                                    payments.map((payment) => (
                                        <div 
                                            key={payment.id} 
                                            className={`p-4 bg-white rounded-2xl border shadow-sm transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                                payment.status === 'completed' 
                                                    ? 'border-l-4 border-l-emerald-500 border-gray-100' 
                                                    : 'border-l-4 border-l-amber-500 border-gray-100'
                                            }`}
                                        >
                                            <div className="space-y-1 flex-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                     <h4 className="text-sm font-extrabold text-gray-950 leading-snug">{payment.description}</h4>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                                        payment.status === 'completed' 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                            : 'bg-amber-50 text-amber-700 border-amber-100'
                                                    }`}>
                                                        {payment.status === 'completed' ? 'Paid' : 'Pending'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-400 font-semibold">
                                                    Billed on {new Date(payment.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                                </p>
                                                {payment.paid_at && (
                                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50/50 px-2.5 py-1 rounded-xl border border-emerald-100/50 w-fit font-bold mt-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                        <span>Paid via {payment.payment_method || 'Checkout'} on {new Date(payment.paid_at).toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 mt-1 md:mt-0">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Amount Due</span>
                                                    <span className="text-xl font-black text-gray-950">
                                                        ₹{Number(payment.amount).toLocaleString('en-IN')}
                                                    </span>
                                                </div>

                                                <div>
                                                    {payment.status !== 'completed' ? (
                                                        (!razorpayConfig?.enabled || !razorpayConfig?.keyId) ? (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-400 text-xs font-bold rounded-xl border border-gray-200">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                Pay at Counter
                                                            </span>
                                                        ) : (
                                                            <Button
                                                                disabled={payingPaymentId !== null}
                                                                onClick={() => handleInitiatePayment(payment)}
                                                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md font-bold text-xs px-4 py-2.5 flex items-center gap-2 w-full sm:w-auto"
                                                            >
                                                                {payingPaymentId === payment.id ? (
                                                                    <>
                                                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                        Processing...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <CreditCard className="w-3.5 h-3.5" />
                                                                        Pay Now
                                                                    </>
                                                                )}
                                                            </Button>
                                                        )
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => alert(`Receipt Transaction ID: ${payment.transaction_id || 'N/A'}\nPaid via: ${payment.payment_method || 'Razorpay'}`)}
                                                            className="rounded-xl border-gray-200 text-xs font-bold gap-1.5 bg-white text-gray-700 hover:bg-gray-50 py-2 px-3 flex items-center shrink-0"
                                                        >
                                                            <Download className="w-3.5 h-3.5" />
                                                            Receipt
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-gray-500 font-semibold text-sm">
                                        No tuition fees or registrations records listed.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
