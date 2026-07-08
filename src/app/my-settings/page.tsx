'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileSidebar } from '@/components/ui/MobileSidebar';
import { Navbar } from '@/components/ui/Navbar';
import { AccessDenied } from '@/components/ui/access-denied';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { 
    Settings, 
    ChevronLeft, 
    CheckCircle2, 
    AlertTriangle, 
    Lock, 
    User as UserIcon, 
    Phone, 
    Mail, 
    MapPin, 
    Sparkles, 
    Loader2 
} from 'lucide-react';

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

export default function MySettingsPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [saving, setSaving] = useState(false);

    // Profile field states
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [phone, setPhone] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState('');
    const [guardianName, setGuardianName] = useState('');
    const [address, setAddress] = useState('');
    const [state, setState] = useState('');
    const [pincode, setPincode] = useState('');

    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
                fetchProfile(token);
            }
        } catch {
            router.replace('/login');
        }
        setLoading(false);
    }, [router]);

    const fetchProfile = async (token: string) => {
        setLoadingData(true);
        try {
            const res = await fetch('/api/student/dashboard', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const prof = data.profile as StudentProfile;
                setProfile(prof);
                
                // Initialize field states
                setPhone(prof.phone || '');
                setGuardianName(prof.guardian_name || '');
                setAddress(prof.address || '');
                setState(prof.state || '');
                setPincode(prof.pincode || '');
                setGender(prof.gender || '');
                if (prof.dob) {
                    // Format Date to YYYY-MM-DD
                    const d = new Date(prof.dob);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    setDob(`${y}-${m}-${day}`);
                } else {
                    setDob('');
                }
            }
        } catch (err) {
            console.error('Error fetching student profile:', err);
        } finally {
            setLoadingData(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSuccessMessage(null);
        setErrorMessage(null);

        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/student/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    phone,
                    dob,
                    gender,
                    guardianName,
                    address,
                    state,
                    pincode
                })
            });

            const data = await res.json();
            if (res.ok) {
                setSuccessMessage('Profile details updated successfully!');
                fetchProfile(token!);
            } else {
                setErrorMessage(data.error || 'Failed to update profile details.');
            }
        } catch {
            setErrorMessage('Network communication error saving profile updates.');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/login');
    };

    if (loading) {
        return <PageSkeleton />;
    }

    if (!user) return null;

    if (user.role !== 'student') {
        return <AccessDenied message="Only students can access profile settings." />;
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
                        Preferences
                    </span>
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#1d1d1f] leading-none">
                        Account Settings
                    </h1>
                    <p className="text-sm font-semibold text-[#86868b]">
                        Manage your personal profile details. Academic records are locked and managed by the college.
                    </p>
                </div>

                {successMessage && (
                    <div className="p-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span className="font-semibold">{successMessage}</span>
                    </div>
                )}
                {errorMessage && (
                    <div className="p-4 bg-red-50 text-red-700 border border-red-100 rounded-2xl flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <span className="font-semibold">{errorMessage}</span>
                    </div>
                )}

                {loadingData ? (
                    <div className="py-20 flex justify-center bg-white rounded-[28px] border border-gray-150 shadow-sm">
                        <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    profile && (
                        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            
                            {/* Read-Only Academic Locking Card */}
                            <div className="lg:col-span-1 space-y-6">
                                <Card className="rounded-[28px] border-[#e8e8ed] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.01)] relative overflow-hidden">
                                    <div className="flex flex-col items-center text-center">
                                        <div className="h-16 w-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 border border-indigo-100 shadow-inner shrink-0">
                                            <UserIcon className="w-8 h-8" />
                                        </div>
                                        <h3 className="font-extrabold text-gray-950 text-base leading-snug">
                                            {profile.first_name} {profile.last_name}
                                        </h3>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                            Roll Number: {profile.roll_number}
                                        </span>
                                    </div>

                                    <div className="border-t border-gray-100 mt-6 pt-5 space-y-4 text-left">
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Student ID</span>
                                            <div className="flex items-center gap-1.5 mt-1 text-gray-500 font-semibold text-sm">
                                                <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                <span>{profile.coaching_id || 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">College ID</span>
                                            <div className="flex items-center gap-1.5 mt-1 text-gray-500 font-semibold text-sm">
                                                <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                <span>{profile.student_id}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Batch Program</span>
                                            <div className="flex items-center gap-1.5 mt-1 text-gray-500 font-semibold text-sm">
                                                <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                <span>{profile.batch_name} ({profile.batch_code})</span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-[#86868b] leading-normal font-semibold mt-6 pt-4 border-t border-gray-100 flex items-start gap-1.5">
                                        <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                        <span>Academic and registration credentials cannot be edited by students. Contact the administration desk to request updates.</span>
                                    </p>
                                </Card>
                            </div>

                            {/* Editable Fields Form Card */}
                            <div className="lg:col-span-2 space-y-6">
                                <Card className="rounded-[28px] border-[#e8e8ed] bg-white p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
                                    <CardHeader className="p-0 mb-6 flex flex-row items-center gap-2.5">
                                        <Sparkles className="w-5 h-5 text-indigo-500" />
                                        <CardTitle className="text-base font-extrabold text-gray-950">Personal Profile Settings</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0 space-y-6">
                                        {/* Row 1: Contact details */}
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pb-1 flex items-center gap-1.5">
                                                <Phone className="w-4 h-4 text-gray-400" />
                                                Contact Info
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide block mb-1.5">Phone Number</label>
                                                    <Input
                                                        type="tel"
                                                        value={phone}
                                                        onChange={(e) => setPhone(e.target.value)}
                                                        placeholder="Enter phone number"
                                                        className="rounded-xl border-gray-200 bg-gray-50/30 focus:bg-white text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide block mb-1.5">Email Address (Read-only)</label>
                                                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3.5 py-2.5 rounded-xl text-gray-500 text-sm font-semibold">
                                                        <Mail className="w-4 h-4 text-gray-400" />
                                                        <span>{profile.email}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 2: Personal details */}
                                        <div className="space-y-4 pt-2 border-t border-gray-100">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pb-1 flex items-center gap-1.5">
                                                <UserIcon className="w-4 h-4 text-gray-400" />
                                                Personal Details
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide block mb-1.5">Guardian Name</label>
                                                    <Input
                                                        type="text"
                                                        value={guardianName}
                                                        onChange={(e) => setGuardianName(e.target.value)}
                                                        placeholder="Enter guardian name"
                                                        className="rounded-xl border-gray-200 bg-gray-50/30 focus:bg-white text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide block mb-1.5">Date of Birth</label>
                                                    <Input
                                                        type="date"
                                                        value={dob}
                                                        onChange={(e) => setDob(e.target.value)}
                                                        className="rounded-xl border-gray-200 bg-gray-50/30 focus:bg-white text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide block mb-1.5">Gender</label>
                                                    <select
                                                        value={gender}
                                                        onChange={(e) => setGender(e.target.value)}
                                                        className="w-full flex h-10 rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                                                    >
                                                        <option value="">Select Gender</option>
                                                        <option value="male">Male</option>
                                                        <option value="female">Female</option>
                                                        <option value="other">Other</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 3: Address details */}
                                        <div className="space-y-4 pt-2 border-t border-gray-100">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pb-1 flex items-center gap-1.5">
                                                <MapPin className="w-4 h-4 text-gray-400" />
                                                Address Details
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="sm:col-span-3">
                                                    <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide block mb-1.5">Residential Address</label>
                                                    <Input
                                                        type="text"
                                                        value={address}
                                                        onChange={(e) => setAddress(e.target.value)}
                                                        placeholder="Enter residential address"
                                                        className="rounded-xl border-gray-200 bg-gray-50/30 focus:bg-white text-sm"
                                                    />
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide block mb-1.5">State</label>
                                                    <Input
                                                        type="text"
                                                        value={state}
                                                        onChange={(e) => setState(e.target.value)}
                                                        placeholder="Enter state"
                                                        className="rounded-xl border-gray-200 bg-gray-50/30 focus:bg-white text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wide block mb-1.5">Pincode</label>
                                                    <Input
                                                        type="text"
                                                        value={pincode}
                                                        onChange={(e) => setPincode(e.target.value)}
                                                        placeholder="Enter pincode"
                                                        className="rounded-xl border-gray-200 bg-gray-50/30 focus:bg-white text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="border-t border-gray-100 pt-6 flex justify-end gap-3">
                                            <Button
                                                type="submit"
                                                disabled={saving}
                                                className="bg-gray-900 hover:bg-gray-800 text-white rounded-xl shadow-lg font-bold text-xs px-6 py-3 flex items-center gap-2"
                                            >
                                                {saving ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Saving Details...
                                                    </>
                                                ) : (
                                                    'Save Changes'
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </form>
                    )
                )}
            </main>
        </div>
    );
}
