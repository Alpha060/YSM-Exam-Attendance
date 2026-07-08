'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MobileSidebar } from '@/components/ui/MobileSidebar';
import { Navbar } from '@/components/ui/Navbar';
import {
    Pencil,
    Trash2,
    Search,
    Plus,
    Building2,
    CheckCircle2,
    Clock,
    Archive,
    RotateCcw,
    ChevronDown
} from 'lucide-react';
import { AccessDenied } from '@/components/ui/access-denied';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { useRealtimeData } from '@/hooks/useRealtimeData';

interface Batch {
    id: string;
    name: string;
    code: string;
    status: 'upcoming' | 'active' | 'completed';
    tuition_fee: number;
}

interface User {
    firstName: string;
    lastName: string;
    email: string;
    role: 'super_admin' | 'teacher';
}

const STATUS_CONFIG = {
    active: {
        label: 'Active',
        icon: CheckCircle2,
        badge: 'bg-green-50 text-green-700 border-green-200',
        dot: 'bg-green-500',
    },
    upcoming: {
        label: 'Upcoming',
        icon: Clock,
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-400',
    },
    completed: {
        label: 'Completed',
        icon: Archive,
        badge: 'bg-gray-100 text-gray-500 border-gray-200',
        dot: 'bg-gray-400',
    },
};

export default function BatchesPage() {
    const router = useRouter();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingDept, setEditingDept] = useState<Batch | null>(null);
    const [formData, setFormData] = useState({ name: '', code: '', status: 'active' as Batch['status'], tuition_fee: 0 });
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | Batch['status']>('all');
    const [paymentFrequency, setPaymentFrequency] = useState<'monthly' | 'one-time'>('monthly');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [completingId, setCompletingId] = useState<string | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        if (!token || !userData) {
            router.replace('/login');
            return;
        }
        setUser(JSON.parse(userData));

        try {
            const cached = sessionStorage.getItem('cache_dept_page');
            if (cached) {
                setBatches(JSON.parse(cached));
                setLoading(false);
            }
        } catch { /* ignore cache errors */ }

        fetchBatches(token);

        fetch('/api/public/course-fee-config')
            .then(res => res.ok ? res.json() : {})
            .then((data: any) => setPaymentFrequency(data.paymentFrequency || 'monthly'))
            .catch(console.error);

    }, [router]);

    useRealtimeData({
        tables: ['batches'],
        onTableChange: useCallback(() => {
            const token = localStorage.getItem('token');
            if (token) fetchBatches(token);
        }, []),
    });

    const fetchBatches = async (token: string) => {
        try {
            const res = await fetch('/api/batches', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.status === 401) {
                router.replace('/login');
                return;
            }
            const data = await res.json();
            const deptsList = (data.batches || []).map((d: Batch) => ({
                ...d,
                status: d.status || 'active',
            }));
            setBatches(deptsList);
            try { sessionStorage.setItem('cache_dept_page', JSON.stringify(deptsList)); } catch {}
        } catch (err) {
            console.error('Error fetching batches:', err);
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const token = localStorage.getItem('token');

        try {
            if (editingDept) {
                const res = await fetch('/api/batches', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ id: editingDept.id, ...formData }),
                });
                if (!res.ok) { setError((await res.json()).error || 'Failed to save'); return; }
            } else {
                const res = await fetch('/api/batches', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(formData),
                });
                if (!res.ok) { setError((await res.json()).error || 'Failed to save'); return; }
            }

            setShowModal(false);
            setFormData({ name: '', code: '', status: 'active', tuition_fee: 0 });
            setEditingDept(null);
            fetchBatches(token!);
        } catch {
            setError('Network error');
        }
    };

    const handleCompleteBatch = async (dept: Batch) => {
        const isCompleting = dept.status !== 'completed';
        const newStatus = isCompleting ? 'completed' : 'active';
        const confirmMsg = isCompleting
            ? `Complete "${dept.name}"?\n\nThis will:\n• Archive all teacher assignments for this batch\n• Hide this batch from attendance screens\n• Keep all historical data & reports intact\n\nYou can reactivate it later.`
            : `Reactivate "${dept.name}"?\n\nThis will make the batch active again for attendance tracking.`;

        if (!confirm(confirmMsg)) return;

        setCompletingId(dept.id);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/batches', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id: dept.id, status: newStatus }),
            });
            if (res.ok) {
                fetchBatches(token!);
            } else {
                alert((await res.json()).error || 'Failed to update status');
            }
        } catch {
            alert('Network error');
        }
        setCompletingId(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this batch? This cannot be undone.')) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/batches?id=${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                fetchBatches(token!);
            } else {
                alert((await res.json()).error || 'Cannot delete this batch');
            }
        } catch { console.error('Error deleting'); }
    };

    const openEditModal = (dept: Batch) => {
        setEditingDept(dept);
        setFormData({ name: dept.name, code: dept.code, status: dept.status, tuition_fee: dept.tuition_fee || 0 });
        setShowModal(true);
    };

    const openAddModal = () => {
        setEditingDept(null);
        setFormData({ name: '', code: '', status: 'active', tuition_fee: 0 });
        setShowModal(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/login');
    };

    const filteredBatches = batches.filter(dept => {
        const matchesSearch =
            dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dept.code.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || dept.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const counts = {
        all: batches.length,
        active: batches.filter(d => d.status === 'active').length,
        upcoming: batches.filter(d => d.status === 'upcoming').length,
        completed: batches.filter(d => d.status === 'completed').length,
    };

    if (loading) return <PageSkeleton type="batches" />;
    if (user?.role !== 'super_admin') {
        return <AccessDenied message="You do not have permission to access the Batches page." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {user && (
                <MobileSidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    user={{ ...user, role: user.role }}
                    onLogout={handleLogout}
                />
            )}
            <Navbar user={user} onMenuClick={() => setSidebarOpen(true)} />

            <main className="flex-1 pt-24 pb-12 px-4 max-w-7xl mx-auto w-full">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-amber-100 text-amber-600">
                                <Building2 className="w-8 h-8" />
                            </span>
                            Batches
                        </h1>
                        <p className="text-gray-500 mt-1 ml-1">Manage coaching batches and their lifecycle.</p>
                    </div>
                    <Button
                        onClick={openAddModal}
                        className="hidden md:flex shrink-0 bg-gray-900 hover:bg-gray-800 text-white rounded-xl shadow-lg shadow-gray-900/20"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Batch
                    </Button>
                </div>

                {/* Status Filter Tabs + Search */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search batches..."
                            className="pl-10 bg-white border-gray-200 rounded-xl focus:ring-blue-500/20"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <select
                            className="w-full sm:w-auto bg-white border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                        >
                            <option value="all">All Batches ({counts.all})</option>
                            <option value="active">Active ({counts.active})</option>
                            <option value="upcoming">Upcoming ({counts.upcoming})</option>
                            <option value="completed">Completed ({counts.completed})</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {/* Batches Grid / List */}
                {batches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                        <div className="bg-amber-50 p-4 rounded-full mb-4">
                            <Building2 className="w-8 h-8 text-amber-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No batches found</h3>
                        <p className="text-gray-500 max-w-sm text-center mt-1">
                            Get started by adding your first coaching batch (e.g., Lakshya, Arambh).
                        </p>
                        <Button onClick={openAddModal} variant="outline" className="mt-4">Add Batch</Button>
                    </div>
                ) : filteredBatches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100">
                        <Search className="w-8 h-8 text-gray-300 mb-3" />
                        <p className="text-gray-500">No batches match your filters.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">S.No.</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Batch Name</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fee</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredBatches.map((dept, index) => {
                                        const sc = STATUS_CONFIG[dept.status] || STATUS_CONFIG.active;
                                        const isCompleting = completingId === dept.id;
                                        return (
                                            <tr key={dept.id} className={`hover:bg-gray-50/80 transition-colors ${dept.status === 'completed' ? 'opacity-70' : ''}`}>
                                                <td className="px-4 py-4 text-center text-sm font-medium text-gray-500">{index + 1}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                                                        {dept.code}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-medium text-gray-900">{dept.name}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                                                        ₹{dept.tuition_fee || 0}{paymentFrequency === 'monthly' ? '/mo' : ''}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${sc.badge}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                        {sc.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {/* Complete / Reactivate Button */}
                                                        {dept.status !== 'upcoming' && (
                                                            <button
                                                                onClick={() => handleCompleteBatch(dept)}
                                                                disabled={isCompleting}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                                                    dept.status === 'completed'
                                                                        ? 'text-green-700 bg-green-50 hover:bg-green-100 border border-green-200'
                                                                        : 'text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200'
                                                                }`}
                                                                title={dept.status === 'completed' ? 'Reactivate Batch' : 'Complete Batch'}
                                                            >
                                                                {dept.status === 'completed'
                                                                    ? <><RotateCcw className="w-3.5 h-3.5" /> Reactivate</>
                                                                    : <><Archive className="w-3.5 h-3.5" /> Complete</>
                                                                }
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => openEditModal(dept)}
                                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(dept.id)}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden grid grid-cols-1 gap-4">
                            {filteredBatches.map((dept) => {
                                const sc = STATUS_CONFIG[dept.status] || STATUS_CONFIG.active;
                                return (
                                    <div key={dept.id} className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 ${dept.status === 'completed' ? 'opacity-75' : ''}`}>
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-semibold text-gray-900 truncate">{dept.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded font-mono">{dept.code}</span>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${sc.badge}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                            {sc.label}
                                                        </span>
                                                        <span className="text-xs bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded font-medium">₹{dept.tuition_fee || 0}{paymentFrequency === 'monthly' ? '/mo' : ''}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0">
                                                {dept.status !== 'upcoming' && (
                                                    <button
                                                        onClick={() => handleCompleteBatch(dept)}
                                                        className="p-2 text-gray-400 hover:text-orange-600"
                                                        title={dept.status === 'completed' ? 'Reactivate' : 'Complete'}
                                                    >
                                                        {dept.status === 'completed' ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                                    </button>
                                                )}
                                                <button onClick={() => openEditModal(dept)} className="p-2 text-gray-400 hover:text-blue-600">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(dept.id)} className="p-2 text-red-400 hover:text-red-600">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </main>

            {/* Mobile FAB */}
            <button
                onClick={openAddModal}
                className="md:hidden fixed bottom-6 right-6 h-14 w-14 bg-gray-900 text-white rounded-full shadow-xl flex items-center justify-center active:scale-95 transition-transform z-20"
            >
                <Plus className="w-6 h-6" />
            </button>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-0 overflow-hidden">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                            <CardTitle className="text-xl">{editingDept ? 'Edit Batch' : 'New Batch'}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-gray-700">Batch Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Lakshya Jan 2025"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        className="rounded-xl border-gray-200"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="code" className="text-gray-700">Batch Code <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="code"
                                        placeholder="e.g. LKS"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        required
                                        maxLength={10}
                                        className="rounded-xl border-gray-200 font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tuition_fee" className="text-gray-700">{paymentFrequency === 'monthly' ? 'Monthly Tuition Fee (₹)' : 'Course Tuition Fee (₹)'} <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="tuition_fee"
                                        type="number"
                                        placeholder="e.g. 1500"
                                        value={formData.tuition_fee}
                                        onChange={(e) => setFormData({ ...formData, tuition_fee: Number(e.target.value) })}
                                        required
                                        className="rounded-xl border-gray-200 font-mono"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status" className="text-gray-700">Status</Label>
                                    <div className="relative">
                                        <select
                                            id="status"
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value as Batch['status'] })}
                                            className="w-full bg-white border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                                        >
                                            <option value="upcoming">Upcoming (not started)</option>
                                            <option value="active">Active (currently running)</option>
                                            <option value="completed">Completed (archived)</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                                        {error}
                                    </div>
                                )}

                                <div className="flex gap-3 justify-end pt-2">
                                    <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="rounded-xl">
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="rounded-xl bg-gray-900 hover:bg-gray-800">
                                        {editingDept ? 'Save Changes' : 'Create Batch'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
