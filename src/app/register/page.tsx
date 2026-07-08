'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Mail, Lock, User, Phone, Calendar, Users, MapPin, 
    ArrowLeft, CheckCircle2, Loader2, Eye, EyeOff, 
    GraduationCap, ArrowRight, ShieldCheck, Home 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Batch {
    status?: string;
    id: string;
    name: string;
    code: string;
}

export default function RegisterPage() {
    const router = useRouter();
    
    // UI state
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loadingBatches, setLoadingBatches] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [step, setStep] = useState(1); // Grouped into 2 steps for cleaner UX

    // Form data state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [studentId, setStudentId] = useState(''); // College ID
    const [phone, setPhone] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState('male');
    const [guardianName, setGuardianName] = useState('');
    const [address, setAddress] = useState('');
    const [state, setState] = useState('');
    const [pincode, setPincode] = useState('');
    const [batchId, setBatchId] = useState(''); // Selected Batch
    const [batchYear, setBatchYear] = useState(new Date().getFullYear().toString());

    // Fetch batches
    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const response = await fetch('/api/public/batches');
                if (response.ok) {
                    const data = await response.json();
                    setBatches(data.batches || []);
                    if (data.batches && data.batches.length > 0) {
                        setBatchId(data.batches[0].id);
                    }
                }
            } catch (err) {
                console.error('Error fetching batches', err);
            } finally {
                setLoadingBatches(false);
            }
        };
        fetchBatches();
    }, []);

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        // Basic Step 1 Validation
        if (!firstName || !lastName || !email || !password || !confirmPassword || !studentId || !batchId) {
            setError('Please fill in all required fields, including College ID.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (!email.includes('@')) {
            setError('Please enter a valid email address.');
            return;
        }
        
        setStep(2);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    firstName,
                    lastName,
                    studentId,
                    batchId,
                    batchYear: parseInt(batchYear),
                    phone: phone || null,
                    dob: dob || null,
                    gender,
                    guardianName: guardianName || null,
                    address: address || null,
                    state: state || null,
                    pincode: pincode || null
                })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Failed to complete registration.');
                setSubmitting(false);
                return;
            }

            setSuccess(true);
        } catch (err) {
            setError('Unable to connect to the server. Please check your network.');
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-gray-900 p-4 font-sans">
                {/* Background Blobs */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-600 rounded-full mix-blend-screen filter blur-3xl opacity-20"></div>

                <div className="relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 p-8 sm:p-12 rounded-3xl max-w-md w-full shadow-2xl text-center text-white animate-scale-in">
                    <div className="flex justify-center mb-6">
                        <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-full p-4 text-emerald-400">
                            <CheckCircle2 className="w-16 h-16 animate-bounce" />
                        </div>
                    </div>
                    
                    <h2 className="text-3xl font-extrabold mb-3">Registration Successful!</h2>
                    <p className="text-gray-300 text-sm mb-8 leading-relaxed">
                        Welcome to Yogoda Satsanga Mahavidyalaya. Your student account has been created. You can now login to check your attendance, schedules, and mock invoice payments.
                    </p>

                    <Button
                        onClick={() => router.push('/login')}
                        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.98]"
                    >
                        Go to Sign In
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex bg-gray-50 font-sans">
            
            {/* Left Side - Brand/Hero Section (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-5/12 relative bg-gray-900 flex-col justify-between p-12 overflow-hidden shrink-0">
                {/* Background Image with animated entry */}
                <div className="absolute inset-0 z-0 animate-fade-in duration-1000">
                    <img
                        src="/paramahansa.jpg"
                        alt="Paramahansa Yogananda"
                        className="w-full h-full object-cover opacity-30 mix-blend-luminosity hover:mix-blend-normal transition-all duration-1000 ease-in-out scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/90 to-blue-900/40"></div>
                </div>

                {/* Content */}
                <div className="relative z-10">
                    <div className="flex items-center gap-4 text-white mb-12">
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full h-16 w-16 flex items-center justify-center overflow-hidden shadow-2xl">
                            <img src="/college-logo.png" alt="YSM Logo" className="w-[140%] h-[140%] object-cover drop-shadow-md" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-orange-200 to-white">
                                Yogoda Satsanga
                            </span>
                            <span className="text-xs font-semibold text-blue-200 tracking-[0.2em] uppercase">
                                Mahavidyalaya
                            </span>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 space-y-6 max-w-sm mb-8">
                    <h1 className="text-4xl font-extrabold text-white leading-tight">
                        Begin Your <span className="text-orange-400">Academic</span> Journey.
                    </h1>
                    <p className="text-sm text-gray-300 leading-relaxed font-light">
                        Register to access your student profile, monitor classes, review real-time attendance, and view academic dues.
                    </p>

                    <div className="flex flex-col gap-3 pt-2">
                        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm shadow-sm">
                            <ShieldCheck className="w-5 h-5 text-orange-400" />
                            <span className="text-xs text-gray-200 font-medium">Secured Student Credentials</span>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm shadow-sm">
                            <GraduationCap className="w-5 h-5 text-blue-400" />
                            <span className="text-xs text-gray-200 font-medium">Automated Batch Enrollment</span>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-[10px] text-gray-500 border-t border-white/10 pt-6 flex justify-between items-center">
                   <span>© {new Date().getFullYear()} Yogoda Satsanga Mahavidyalaya.</span>
                   <span className="text-gray-600">Ranchi, Jharkhand</span>
                </div>
            </div>

            {/* Right Side - Scrollable Form */}
            <div className="w-full lg:w-7/12 flex flex-col p-4 sm:p-8 md:p-12 lg:p-16 bg-white overflow-y-auto min-h-screen">
                <div className="w-full max-w-[560px] mx-auto my-auto space-y-8 py-8">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center border-b border-gray-100 pb-5">
                        <div className="space-y-1">
                            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Student Registration</h2>
                            <p className="text-gray-500 text-sm">
                                {step === 1 ? 'Step 1: Account & Core Academic Details' : 'Step 2: Profile & Contact Details'}
                            </p>
                        </div>
                        <button
                            onClick={() => router.push('/login')}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 group bg-blue-50 px-3 py-2 rounded-xl transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                            Sign In Instead
                        </button>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-sm text-red-600 animate-shake">
                            <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0" />
                            <p className="leading-snug font-medium">{error}</p>
                        </div>
                    )}

                    {/* Step 1: Account Credentials & Core Academic */}
                    {step === 1 && (
                        <form onSubmit={handleNextStep} className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 group">
                                    <Label htmlFor="firstName" className="text-xs font-bold text-gray-700 ml-1">First Name <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            id="firstName"
                                            placeholder="Rahul"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            className="pl-11 h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl shadow-sm text-sm"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 group">
                                    <Label htmlFor="lastName" className="text-xs font-bold text-gray-700 ml-1">Last Name <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            id="lastName"
                                            placeholder="Kumar"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            className="pl-11 h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl shadow-sm text-sm"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2 group">
                                    <Label htmlFor="email" className="text-xs font-bold text-gray-700 ml-1">Email Address <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="student@college.edu"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="pl-11 h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl shadow-sm text-sm"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 group">
                                    <Label htmlFor="studentId" className="text-xs font-bold text-gray-700 ml-1">College ID <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            id="studentId"
                                            type="text"
                                            placeholder="e.g. BCA2025SC061"
                                            value={studentId}
                                            onChange={(e) => setStudentId(e.target.value)}
                                            className="pl-11 h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl shadow-sm text-sm"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2 group">
                                    <Label htmlFor="password" className="text-xs font-bold text-gray-700 ml-1">Password <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Min 6 chars"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="pl-11 pr-11 h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl shadow-sm text-sm"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="space-y-2 group">
                                    <Label htmlFor="confirmPassword" className="text-xs font-bold text-gray-700 ml-1">Confirm Password <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            id="confirmPassword"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Confirm password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="pl-11 h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl shadow-sm text-sm"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="batchId" className="text-xs font-bold text-gray-700 ml-1">Academic Batch <span className="text-red-500">*</span></Label>
                                    <div className="relative">
                                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        {loadingBatches ? (
                                            <div className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm flex items-center justify-between">
                                                <span className="text-gray-400">Loading...</span>
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                            </div>
                                        ) : (
                                            <select
                                                id="batchId"
                                                value={batchId}
                                                onChange={(e) => setBatchId(e.target.value)}
                                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-semibold appearance-none"
                                            >
                                                {batches.length === 0 ? (
                                                    <option value="">No active batches</option>
                                                ) : (
                                                    batches.map((b) => (
                                                        <option key={b.id} value={b.id}>
                                                            {b.name} ({b.code})
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 group">
                                    <Label htmlFor="batchYear" className="text-xs font-bold text-gray-700 ml-1">Batch Year</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            id="batchYear"
                                            type="number"
                                            value={batchYear}
                                            onChange={(e) => setBatchYear(e.target.value)}
                                            className="pl-11 h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl shadow-sm text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] mt-2 flex items-center justify-center gap-2 group"
                            >
                                <span>Continue to Profile Details</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </form>
                    )}

                    {/* Step 2: Personal Profile & Address */}
                    {step === 2 && (
                        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2 group">
                                    <Label htmlFor="phone" className="text-xs font-bold text-gray-700 ml-1">Phone Number</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            id="phone"
                                            type="tel"
                                            placeholder="+91 98765 43210"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="pl-11 h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl shadow-sm text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 group">
                                    <Label htmlFor="dob" className="text-xs font-bold text-gray-700 ml-1">Date of Birth</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            id="dob"
                                            type="date"
                                            value={dob}
                                            onChange={(e) => setDob(e.target.value)}
                                            className="pl-11 h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl shadow-sm text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="gender" className="text-xs font-bold text-gray-700 ml-1">Gender</Label>
                                    <select
                                        id="gender"
                                        value={gender}
                                        onChange={(e) => setGender(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-semibold"
                                    >
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div className="space-y-2 group">
                                    <Label htmlFor="guardianName" className="text-xs font-bold text-gray-700 ml-1">Guardian / Parent Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            id="guardianName"
                                            placeholder="Mr. Sanjay Kumar"
                                            value={guardianName}
                                            onChange={(e) => setGuardianName(e.target.value)}
                                            className="pl-11 h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl shadow-sm text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 group">
                                <Label htmlFor="address" className="text-xs font-bold text-gray-700 ml-1">Street Address</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-4 top-[18px] w-4 h-4 text-gray-400" />
                                    <textarea
                                        id="address"
                                        placeholder="123 Academic Lane, Ranchi"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-medium h-20 resize-none shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2 group">
                                    <Label htmlFor="state" className="text-xs font-bold text-gray-700 ml-1">State</Label>
                                    <Input
                                        id="state"
                                        placeholder="Jharkhand"
                                        value={state}
                                        onChange={(e) => setState(e.target.value)}
                                        className="h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl shadow-sm text-sm"
                                    />
                                </div>

                                <div className="space-y-2 group">
                                    <Label htmlFor="pincode" className="text-xs font-bold text-gray-700 ml-1">Pin Code</Label>
                                    <Input
                                        id="pincode"
                                        placeholder="834001"
                                        value={pincode}
                                        onChange={(e) => setPincode(e.target.value)}
                                        className="h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl shadow-sm text-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="w-1/3 h-12 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all"
                                >
                                    Back
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-2/3 h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Submitting profile...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                                            <span>Complete Registration</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    )}

                </div>
            </div>

        </div>
    );
}
