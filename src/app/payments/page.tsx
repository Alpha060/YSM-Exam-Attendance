'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MobileSidebar } from '@/components/ui/MobileSidebar';
import { Navbar } from '@/components/ui/Navbar';
import { AccessDenied } from '@/components/ui/access-denied';
import { Button } from '@/components/ui/button';
import {
    CreditCard, Search, Filter, Plus, MoreHorizontal, CheckCircle2, Clock,
    XCircle, RefreshCw, Trash2, Edit3, IndianRupee, TrendingUp, AlertTriangle,
    ChevronLeft, ChevronRight, Download, X, Users, Building2
} from 'lucide-react';

interface User { id: string; email: string; firstName: string; lastName: string; role: string; }
interface Batch { id: string; name: string; code: string; }
interface PaymentRecord {
    id: string; student_id: string; amount: number; currency: string; status: string;
    payment_method: string | null; transaction_id: string | null; description: string;
    paid_at: string | null; created_at: string; first_name: string; last_name: string;
    roll_number: number; coaching_id: string | null; email: string; phone: string | null;
    batch_name: string; batch_code: string;
}
interface Stats { totalCollected: number; totalPending: number; countPending: number; countPaid: number; }

type ModalType = 'assign' | 'collect' | 'edit_amount' | null;

export default function AdminPaymentsPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [batches, setBatches] = useState<Batch[]>([]);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [stats, setStats] = useState<Stats>({ totalCollected: 0, totalPending: 0, countPending: 0, countPaid: 0 });
    const [loadingData, setLoadingData] = useState(false);

    // Filters
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Modals
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Assign form
    const [assignDesc, setAssignDesc] = useState('');
    const [assignAmount, setAssignAmount] = useState('');
    const [assignBatchId, setAssignBatchId] = useState('');
    const [assignStudentId, setAssignStudentId] = useState('');
    const [assignMode, setAssignMode] = useState<'batch' | 'student'>('batch');

    // Collect form
    const [collectMethod, setCollectMethod] = useState('Cash');
    const [collectTxnId, setCollectTxnId] = useState('');
    const [collectDate, setCollectDate] = useState(new Date().toISOString().split('T')[0]);
    const [collectRemarks, setCollectRemarks] = useState('');

    // Edit amount
    const [editAmount, setEditAmount] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        if (!token || !userData) { router.replace('/login'); return; }
        try {
            const parsed = JSON.parse(userData);
            setUser(parsed);
        } catch { router.replace('/login'); }
        setLoading(false);
    }, [router]);

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const fetchBatches = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch('/api/batches', { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) { const data = await res.json(); setBatches(data.batches || data || []); }
        } catch (err) { console.error('Error fetching batches:', err); }
    }, [token]);

    const fetchPayments = useCallback(async () => {
        if (!token) return;
        setLoadingData(true);
        try {
            const params = new URLSearchParams();
            if (selectedBatchId) params.set('batchId', selectedBatchId);
            if (statusFilter) params.set('status', statusFilter);
            if (searchQuery) params.set('search', searchQuery);
            params.set('page', String(currentPage));
            params.set('limit', '30');

            const res = await fetch(`/api/admin/payments?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPayments(data.payments || []);
                setStats(data.stats || { totalCollected: 0, totalPending: 0, countPending: 0, countPaid: 0 });
                setTotalPages(data.pagination?.totalPages || 1);
            }
        } catch (err) { console.error('Error fetching payments:', err); }
        finally { setLoadingData(false); }
    }, [token, selectedBatchId, statusFilter, searchQuery, currentPage]);

    useEffect(() => { if (user?.role === 'super_admin') { fetchBatches(); } }, [user, fetchBatches]);
    useEffect(() => { if (user?.role === 'super_admin') { fetchPayments(); } }, [user, fetchPayments]);

    const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); router.replace('/login'); };

    const handleAssignFee = async () => {
        if (!assignDesc || !assignAmount || parseFloat(assignAmount) <= 0) return;
        setSubmitting(true);
        try {
            const body: any = { description: assignDesc, amount: parseFloat(assignAmount) };
            if (assignMode === 'batch') body.batchId = assignBatchId;
            else body.studentId = assignStudentId;

            const res = await fetch('/api/admin/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            if (res.ok) { setActiveModal(null); setAssignDesc(''); setAssignAmount(''); fetchPayments(); }
            else { const err = await res.json(); alert(err.error || 'Failed to assign fee.'); }
        } catch { alert('Network error.'); }
        finally { setSubmitting(false); }
    };

    const handleCollectPayment = async () => {
        if (!selectedPayment) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/payments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    paymentId: selectedPayment.id, action: 'mark_paid',
                    paymentMethod: collectMethod, transactionId: collectTxnId,
                    paidAt: collectDate, remarks: collectRemarks
                })
            });
            if (res.ok) { setActiveModal(null); setSelectedPayment(null); fetchPayments(); }
            else { const err = await res.json(); alert(err.error || 'Failed.'); }
        } catch { alert('Network error.'); }
        finally { setSubmitting(false); }
    };

    const handleEditAmount = async () => {
        if (!selectedPayment || !editAmount || parseFloat(editAmount) <= 0) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/payments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ paymentId: selectedPayment.id, action: 'edit_amount', amount: parseFloat(editAmount) })
            });
            if (res.ok) { setActiveModal(null); setSelectedPayment(null); fetchPayments(); }
            else { const err = await res.json(); alert(err.error || 'Failed.'); }
        } catch { alert('Network error.'); }
        finally { setSubmitting(false); }
    };

    const handleStatusChange = async (paymentId: string, action: string) => {
        if (!confirm(`Are you sure you want to mark this payment as ${action.replace('mark_', '')}?`)) return;
        try {
            const res = await fetch('/api/admin/payments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ paymentId, action })
            });
            if (res.ok) { setActionMenuId(null); fetchPayments(); }
            else { const err = await res.json(); alert(err.error || 'Failed.'); }
        } catch { alert('Network error.'); }
    };

    const handleDelete = async (paymentId: string) => {
        if (!confirm('Delete this pending bill? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/admin/payments?id=${paymentId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) { setActionMenuId(null); fetchPayments(); }
            else { const err = await res.json(); alert(err.error || 'Failed.'); }
        } catch { alert('Network error.'); }
    };

    const statusBadge = (status: string) => {
        const map: Record<string, { bg: string; text: string; label: string }> = {
            completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Paid' },
            pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
            failed: { bg: 'bg-red-50', text: 'text-red-700', label: 'Failed' },
            refunded: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Refunded' },
        };
        const s = map[status] || { bg: 'bg-gray-50', text: 'text-gray-700', label: status };
        return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${s.bg} ${s.text}`}>{s.label}</span>;
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div></div>;
    if (!user) return null;
    if (user.role !== 'super_admin') return <AccessDenied message="Only administrators can manage payments." />;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <MobileSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} onLogout={handleLogout} />
            <Navbar user={user} onMenuClick={() => setSidebarOpen(true)} onLogout={handleLogout} />

            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 mt-16 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-sm">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Fee Ledger & Payments</h1>
                            <p className="text-sm text-gray-500 font-medium">View, assign, and manage student payments</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => { setActiveModal('assign'); setAssignMode('batch'); setAssignDesc(''); setAssignAmount(''); setAssignBatchId(batches[0]?.id || ''); }}
                        className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-sm px-4 py-2.5 flex items-center gap-2 shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> Assign Fee
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp className="w-3.5 h-3.5" /></div><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Collected</span></div>
                        <span className="text-xl font-black text-gray-900">₹{stats.totalCollected.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><Clock className="w-3.5 h-3.5" /></div><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pending</span></div>
                        <span className="text-xl font-black text-gray-900">₹{stats.totalPending.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /></div><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Paid Bills</span></div>
                        <span className="text-xl font-black text-gray-900">{stats.countPaid}</span>
                    </div>
                    <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-red-50 text-red-600 rounded-lg"><AlertTriangle className="w-3.5 h-3.5" /></div><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Unpaid Bills</span></div>
                        <span className="text-xl font-black text-gray-900">{stats.countPending}</span>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text" placeholder="Search student name or roll…"
                            value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                        />
                    </div>
                    <select value={selectedBatchId} onChange={e => { setSelectedBatchId(e.target.value); setCurrentPage(1); }}
                        className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                        <option value="">All Batches</option>
                        {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                        className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="completed">Paid</option>
                        <option value="failed">Failed</option>
                        <option value="refunded">Refunded</option>
                    </select>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {loadingData ? (
                        <div className="py-16 flex justify-center"><div className="w-6 h-6 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : payments.length === 0 ? (
                        <div className="py-16 text-center text-gray-400 font-bold text-sm">No payment records found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/50">
                                        <th className="text-left px-4 py-3 font-black text-[10px] text-gray-500 uppercase tracking-widest">Student</th>
                                        <th className="text-left px-4 py-3 font-black text-[10px] text-gray-500 uppercase tracking-widest hidden md:table-cell">Batch</th>
                                        <th className="text-left px-4 py-3 font-black text-[10px] text-gray-500 uppercase tracking-widest">Description</th>
                                        <th className="text-right px-4 py-3 font-black text-[10px] text-gray-500 uppercase tracking-widest">Amount</th>
                                        <th className="text-center px-4 py-3 font-black text-[10px] text-gray-500 uppercase tracking-widest">Status</th>
                                        <th className="text-left px-4 py-3 font-black text-[10px] text-gray-500 uppercase tracking-widest hidden lg:table-cell">Date</th>
                                        <th className="text-center px-4 py-3 font-black text-[10px] text-gray-500 uppercase tracking-widest">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map(p => (
                                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-gray-900 text-sm">{p.first_name} {p.last_name}</div>
                                                <div className="text-[11px] text-gray-400 font-medium">Roll #{p.roll_number}</div>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{p.batch_code || p.batch_name || '—'}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-semibold text-gray-800 max-w-[200px] truncate">{p.description}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-sm font-black text-gray-900">₹{Number(p.amount).toLocaleString('en-IN')}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">{statusBadge(p.status)}</td>
                                            <td className="px-4 py-3 hidden lg:table-cell">
                                                <div className="text-xs text-gray-500 font-medium">
                                                    {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                                {p.payment_method && <div className="text-[10px] text-gray-400 font-semibold mt-0.5">via {p.payment_method}</div>}
                                            </td>
                                            <td className="px-4 py-3 text-center relative">
                                                <button onClick={() => setActionMenuId(actionMenuId === p.id ? null : p.id)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                                                    <MoreHorizontal className="w-4 h-4 text-gray-500" />
                                                </button>
                                                {actionMenuId === p.id && (
                                                    <div className="absolute right-4 top-12 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 w-48 text-left">
                                                        {p.status === 'pending' && (
                                                            <>
                                                                <button onClick={() => { setSelectedPayment(p); setActiveModal('collect'); setCollectMethod('Cash'); setCollectTxnId(''); setCollectDate(new Date().toISOString().split('T')[0]); setCollectRemarks(''); setActionMenuId(null); }}
                                                                    className="w-full px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors">
                                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Collect Offline Payment
                                                                </button>
                                                                <button onClick={() => { setSelectedPayment(p); setEditAmount(String(p.amount)); setActiveModal('edit_amount'); setActionMenuId(null); }}
                                                                    className="w-full px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors">
                                                                    <Edit3 className="w-3.5 h-3.5" /> Edit Amount
                                                                </button>
                                                                <button onClick={() => handleDelete(p.id)}
                                                                    className="w-full px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                                                                    <Trash2 className="w-3.5 h-3.5" /> Delete Bill
                                                                </button>
                                                            </>
                                                        )}
                                                        {p.status === 'completed' && (
                                                            <button onClick={() => handleStatusChange(p.id, 'mark_refunded')}
                                                                className="w-full px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-2 transition-colors">
                                                                <RefreshCw className="w-3.5 h-3.5" /> Mark as Refunded
                                                            </button>
                                                        )}
                                                        {(p.status === 'failed' || p.status === 'refunded') && (
                                                            <button onClick={() => { setSelectedPayment(p); setActiveModal('collect'); setCollectMethod('Cash'); setCollectTxnId(''); setCollectDate(new Date().toISOString().split('T')[0]); setCollectRemarks(''); setActionMenuId(null); }}
                                                                className="w-full px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 transition-colors">
                                                                <CheckCircle2 className="w-3.5 h-3.5" /> Resolve & Mark Paid
                                                            </button>
                                                        )}
                                                        <button onClick={() => setActionMenuId(null)}
                                                            className="w-full px-3 py-2 text-xs font-semibold text-gray-400 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                                                            <X className="w-3.5 h-3.5" /> Close
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                            <span className="text-xs font-semibold text-gray-500">Page {currentPage} of {totalPages}</span>
                            <div className="flex gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* ═══ MODALS ═══ */}

            {/* Assign Fee Modal */}
            {activeModal === 'assign' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-extrabold text-gray-900">Assign New Fee</h3>
                            <button onClick={() => setActiveModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setAssignMode('batch')} className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 border transition-colors ${assignMode === 'batch' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                <Building2 className="w-3.5 h-3.5" /> Entire Batch
                            </button>
                            <button onClick={() => setAssignMode('student')} className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 border transition-colors ${assignMode === 'student' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                <Users className="w-3.5 h-3.5" /> Individual
                            </button>
                        </div>
                        {assignMode === 'batch' ? (
                            <div>
                                <label className="text-xs font-bold text-gray-600 block mb-1">Select Batch</label>
                                <select value={assignBatchId} onChange={e => setAssignBatchId(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                    {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs font-bold text-gray-600 block mb-1">Student ID (UUID)</label>
                                <input type="text" placeholder="Paste student UUID" value={assignStudentId} onChange={e => setAssignStudentId(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">Description</label>
                            <input type="text" placeholder="e.g. July Monthly Fee" value={assignDesc} onChange={e => setAssignDesc(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">Amount (₹)</label>
                            <input type="number" min={1} placeholder="1500" value={assignAmount} onChange={e => setAssignAmount(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <Button onClick={handleAssignFee} disabled={submitting || !assignDesc || !assignAmount}
                            className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-sm py-2.5">
                            {submitting ? 'Assigning…' : 'Assign Fee'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Collect Offline Payment Modal */}
            {activeModal === 'collect' && selectedPayment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-extrabold text-gray-900">Record Offline Payment</h3>
                            <button onClick={() => setActiveModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900">{selectedPayment.first_name} {selectedPayment.last_name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{selectedPayment.description} — ₹{Number(selectedPayment.amount).toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">Payment Method</label>
                            <select value={collectMethod} onChange={e => setCollectMethod(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">Transaction / Reference ID</label>
                            <input type="text" placeholder="Optional" value={collectTxnId} onChange={e => setCollectTxnId(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">Payment Date</label>
                            <input type="date" value={collectDate} onChange={e => setCollectDate(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">Remarks (Optional)</label>
                            <input type="text" placeholder="e.g. Paid by guardian" value={collectRemarks} onChange={e => setCollectRemarks(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <Button onClick={handleCollectPayment} disabled={submitting}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm py-2.5">
                            {submitting ? 'Saving…' : 'Confirm Payment'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Edit Amount Modal */}
            {activeModal === 'edit_amount' && selectedPayment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-extrabold text-gray-900">Edit Bill Amount</h3>
                            <button onClick={() => setActiveModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900">{selectedPayment.first_name} {selectedPayment.last_name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{selectedPayment.description} — Current: ₹{Number(selectedPayment.amount).toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">New Amount (₹)</label>
                            <input type="number" min={1} value={editAmount} onChange={e => setEditAmount(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                        <Button onClick={handleEditAmount} disabled={submitting || !editAmount}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm py-2.5">
                            {submitting ? 'Saving…' : 'Update Amount'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Click outside action menu closer */}
            {actionMenuId && <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />}
        </div>
    );
}
