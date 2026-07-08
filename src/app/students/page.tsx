'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MobileSidebar } from '@/components/ui/MobileSidebar';
import {
    Pencil,
    Trash2,
    Search,
    Plus,
    FileUp,
    Download,
    X,
    FileSpreadsheet,
    AlertTriangle,
    Loader2,
    GraduationCap,
    ChevronDown,
    CheckCircle2,
    Sparkles
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Navbar } from '@/components/ui/Navbar';
import { AccessDenied } from '@/components/ui/access-denied';
import { parseCoachingId, matchBatchCode, type ParsedCoachingId } from '@/lib/parseStudentId';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { useRealtimeData } from '@/hooks/useRealtimeData';

interface Student {
    id: string;
    student_id: string | null;
    coaching_id: string | null;
    roll_number: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone?: string | null;
    dob?: string | null;
    gender?: string | null;
    guardianName?: string | null;
    address?: string | null;
    state?: string | null;
    pincode?: string | null;
    batch_id: string;
    current_semester: number;
    batch_code: string;
    batch_name: string;
    batch_year?: number;
}

interface Batch {
    id: string;
    name: string;
    code: string;
    status?: string;
}

interface Subject {
    id: string;
    code: string;
    name: string;
    batchId: string;
}

interface User {
    firstName: string;
    lastName: string;
    email: string;
    role: 'super_admin' | 'teacher';
    batchId?: string;
}

export default function StudentsPage() {
    const router = useRouter();
    const [students, setStudents] = useState<Student[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    // Coaching ID form field
    const [coachingId, setCoachingId] = useState('');
    const [batchWarning, setBatchWarning] = useState('');

    // Form States
    const [formData, setFormData] = useState({
        studentId: '',
        rollNumber: '',
        firstName: '',
        lastName: '',
        email: '',
        batchId: '',
        batchYear: new Date().getFullYear().toString(),
        phone: '',
        dob: '',
        gender: 'male',
        guardianName: '',
        address: '',
        state: '',
        pincode: '',
        password: 'Welcome@123',
        confirmPassword: 'Welcome@123'
    });
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [parsedInfo, setParsedInfo] = useState<ParsedCoachingId | null>(null);

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBatchId, setFilterBatchId] = useState('');


    // Import States
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importResults, setImportResults] = useState<{ success: number; updated: number; failed: number; errors: any[] } | null>(null);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        if (!token || !userData) {
            router.replace('/login');
            return;
        }
        setUser(JSON.parse(userData));

        // Try loading cached data first for instant display
        try {
            const cachedStudents = sessionStorage.getItem('cache_students');
            if (cachedStudents) {
                setStudents(JSON.parse(cachedStudents));
                setLoading(false);
            }
            const lCache = localStorage.getItem('offline_batches');
            if (lCache) {
                const parsed = JSON.parse(lCache);
                if (parsed.data && Array.isArray(parsed.data)) setBatches(parsed.data);
            } else {
                const cachedDepts = sessionStorage.getItem('cache_batches');
                if (cachedDepts) setBatches(JSON.parse(cachedDepts));
            }
            const cachedSubjects = sessionStorage.getItem('cache_subjects');
            if (cachedSubjects) setSubjects(JSON.parse(cachedSubjects));
        } catch { /* ignore cache errors */ }

        fetchStudents(token);
        fetchBatches(token);
        fetchSubjects(token);
    }, [router]);

    // Real-time updates: silently re-fetch when DB tables change
    useRealtimeData({
        tables: ['students', 'student_subjects', 'batches', 'subjects'],
        onTableChange: useCallback(() => {
            const token = localStorage.getItem('token');
            if (token) {
                fetchStudents(token);
                fetchBatches(token);
                fetchSubjects(token);
            }
        }, []),
    });



    const safeJson = async (res: Response) => {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await res.json();
        }
        return null;
    };

    const fetchStudents = async (token: string) => {
        try {
            const res = await fetch('/api/students', {
                cache: 'no-store',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.status === 401) {
                router.replace('/login');
                return;
            }
            const data = await safeJson(res);
            const studentsList = data?.students || [];
            setStudents(studentsList);
            try { sessionStorage.setItem('cache_students', JSON.stringify(studentsList)); } catch {}
        } catch (err) {
            console.error('Error fetching students:', err);
        }
        setLoading(false);
    };

    const fetchBatches = async (token: string) => {
        try {
            const res = await fetch('/api/batches', {
                cache: 'no-store',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.status === 401) { router.replace('/login'); return; }
            const data = await safeJson(res);
            const deptsList = data?.batches || [];
            setBatches(deptsList);
            try { sessionStorage.setItem('cache_batches', JSON.stringify(deptsList)); } catch {}
        } catch (err) {
            console.error('Error fetching batches:', err);
        }
    };

    const fetchSubjects = async (token: string) => {
        try {
            const res = await fetch('/api/subjects', {
                cache: 'no-store',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.status === 401) { router.replace('/login'); return; }
            const data = await safeJson(res);
            const subjectsList = data?.subjects || [];
            setSubjects(subjectsList);
            try { sessionStorage.setItem('cache_subjects', JSON.stringify(subjectsList)); } catch {}
        } catch (err) {
            console.error('Error fetching subjects:', err);
        }
    };



    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/login');
    };

    const handleEdit = async (student: Student) => {
        setCoachingId(student.coaching_id || '');
        setFormData({
            studentId: student.student_id || '',
            rollNumber: student.roll_number,
            firstName: student.first_name || '',
            lastName: student.last_name || '',
            email: student.email || '',
            batchId: student.batch_id || '',
            batchYear: student.batch_year ? student.batch_year.toString() : new Date().getFullYear().toString(),
            phone: student.phone || '',
            dob: student.dob ? student.dob.split('T')[0] : '',
            gender: student.gender || 'male',
            guardianName: student.guardianName || '',
            address: student.address || '',
            state: student.state || '',
            pincode: student.pincode || '',
            password: '',
            confirmPassword: ''
        });
        setSelectedStudentId(student.id);
        setShowModal(true);
        setError('');
        setSuccess('');
    };

    const resetForm = () => {
        setFormData({
            studentId: '',
            rollNumber: '',
            firstName: '',
            lastName: '',
            email: '',
            batchId: '',
            batchYear: new Date().getFullYear().toString(),
            phone: '',
            dob: '',
            gender: 'male',
            guardianName: '',
            address: '',
            state: '',
            pincode: '',
            password: 'Welcome@123',
            confirmPassword: 'Welcome@123'
        });
        setCoachingId('');
        setBatchWarning('');
        setSelectedStudentId(null);
        setParsedInfo(null);
        setError('');
        setSuccess('');
    };

    // Handle Coaching ID input — UPPERCASE, longest-prefix match, completed batch check
    const handleCoachingIdChange = (value: string) => {
        const id = value.toUpperCase();
        setCoachingId(id);
        setBatchWarning('');

        if (id.length < 7) {
            setParsedInfo(null);
            return;
        }

        const parsed = parseCoachingId(id);
        setParsedInfo(parsed);

        if (parsed.isValid) {
            // Auto-fill roll number from coaching ID
            if (parsed.rollNumber) {
                setFormData(prev => ({ ...prev, rollNumber: parsed.rollNumber!.toString() }));
            }

            // Auto-fill batch from coaching ID prefix using longest-match
            if (parsed.batchPrefix && batches.length > 0) {
                const batchCodes = batches.map(d => d.code);
                const matchedCode = matchBatchCode(id, batchCodes);
                if (matchedCode) {
                    const matchedDept = batches.find(d => d.code.toUpperCase() === matchedCode.toUpperCase());
                    if (matchedDept) {
                        if (matchedDept.status === 'completed') {
                            setBatchWarning(`Batch "${matchedDept.name} (${matchedDept.code})" is completed. Cannot add students to it.`);
                            setFormData(prev => ({ ...prev, batchId: '' }));
                        } else {
                            setFormData(prev => ({ ...prev, batchId: matchedDept.id }));
                        }
                    }
                }
            }
        }
    };

    // Auto-select subjects based on student ID parsing
    /*
    const autoSelectSubjects = (parsed: ParsedStudentId, semester: number, deptId: string) => {
        if (!parsed.isValid) return;

        const selectedDept = batches.find(d => d.id === deptId);
        if (!selectedDept) return;

        // Get subjects that match the batch's degree type and semester
        const availableSubjects = subjects.filter(s =>
            s.semesters.includes(semester) && s.degreeType === selectedDept.degree_type
        );

        const subjectsToSelect: string[] = [];


        // Helper function to find subject by name (case-insensitive, with common aliases)
        const findSubjectByName = (name: string) => {
            const nameLower = name.toLowerCase();

            // Define common name aliases/variations
            const nameAliases: Record<string, string[]> = {
                'mathematics': ['mathematics', 'maths', 'math'],
                'physics': ['physics', 'phy'],
                'chemistry': ['chemistry', 'chem'],
                'accounts': ['accounts', 'accountancy', 'accounting'],
                'business studies': ['business studies', 'business study', 'business'],
                'history': ['history', 'his'],
                'political science': ['political science', 'pol science', 'politics'],
                'economics': ['economics', 'eco'],
                'english': ['english', 'eng'],
                'hindi': ['hindi', 'hin'],
                'philosophy': ['philosophy', 'phil'],
                'botany': ['botany', 'bot'],
                'zoology': ['zoology', 'zoo'],
                'commerce': ['commerce', 'com'],
            };

            // Get all possible variations for this search term
            let searchTerms = [nameLower];
            for (const [key, aliases] of Object.entries(nameAliases)) {
                if (aliases.includes(nameLower) || key === nameLower) {
                    searchTerms = aliases;
                    break;
                }
            }

            // Search with all variations
            return availableSubjects.find(s => {
                const subjectNameLower = s.name.toLowerCase();
                return searchTerms.some(term =>
                    subjectNameLower.includes(term) || term.includes(subjectNameLower)
                );
            });
        };

        if (parsed.courseType === 'regular') {
            // For regular students, match subjects by name using the dept code mapping
            // e.g., BA2025HIS001 -> deptCode 'HIS' -> subject name 'History'
            if (parsed.deptCode) {
                const DEPT_CODE_TO_NAME: Record<string, string> = {
                    'HIS': 'History',
                    'POL': 'Political Science',
                    'ECO': 'Economics',
                    'ENG': 'English',
                    'HIN': 'Hindi',
                    'PHI': 'Philosophy',
                    'PHY': 'Physics',
                    'CHE': 'Chemistry',
                    'MAT': 'Mathematics',
                    'BOT': 'Botany',
                    'ZOO': 'Zoology',
                    'COM': 'Commerce',
                };

                const subjectName = DEPT_CODE_TO_NAME[parsed.deptCode.toUpperCase()];
                if (subjectName) {
                    const matchingSubject = findSubjectByName(subjectName);
                    if (matchingSubject) {
                        subjectsToSelect.push(matchingSubject.id);
                    }
                }
            }
        } else if (parsed.courseType === 'vocational') {
            // For vocational students, auto-select core paper + GE subjects
            const coreSubject = availableSubjects.find(s =>
                s.name.toLowerCase().includes('core') &&
                (s.name.includes(semester.toString()) || s.code.includes(semester.toString()))
            );
            if (coreSubject) {
                subjectsToSelect.push(coreSubject.id);
            }

            if (parsed.geSubjects) {
                const ge1Subject = findSubjectByName(parsed.geSubjects.ge1);
                if (ge1Subject) {
                    subjectsToSelect.push(ge1Subject.id);
                }

                const ge2Subject = findSubjectByName(parsed.geSubjects.ge2);
                if (ge2Subject) {
                    subjectsToSelect.push(ge2Subject.id);
                }
            }
        }

        // Set the selected subjects and adjust field count
        if (subjectsToSelect.length > 0) {
            setSelectedSubjects(subjectsToSelect);
            setSubjectFieldCount(Math.max(subjectsToSelect.length, 1));
        }
    };
    */

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        const token = localStorage.getItem('token');

        if (!formData.batchId) {
            setError('Please select a batch');
            return;
        }

        if (formData.password && formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        try {
            if (selectedStudentId) {
                // UPDATE Existing Student
                const res = await fetch('/api/students', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        id: selectedStudentId,
                        studentId: formData.studentId,
                        coachingId: coachingId || null,
                        firstName: formData.firstName,
                        lastName: formData.lastName,
                        email: formData.email || undefined,
                        batchId: formData.batchId,
                        batchYear: formData.batchYear,
                        phone: formData.phone || undefined,
                        dob: formData.dob || undefined,
                        gender: formData.gender,
                        guardianName: formData.guardianName || undefined,
                        address: formData.address || undefined,
                        state: formData.state || undefined,
                        pincode: formData.pincode || undefined,
                        password: formData.password || undefined
                    }),
                });

                const data = await res.json();
                if (!res.ok) {
                    setError(data.error || 'Failed to update student');
                    return;
                }
                setSuccess('Student updated successfully! Subjects auto-synced with batch.');
            } else {
                // CREATE New Student
                const res = await fetch('/api/students', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        studentId: formData.studentId,
                        coachingId: coachingId || null,
                        firstName: formData.firstName,
                        lastName: formData.lastName,
                        email: formData.email || undefined,
                        batchId: formData.batchId,
                        batchYear: formData.batchYear,
                        phone: formData.phone || undefined,
                        dob: formData.dob || undefined,
                        gender: formData.gender,
                        guardianName: formData.guardianName || undefined,
                        address: formData.address || undefined,
                        state: formData.state || undefined,
                        pincode: formData.pincode || undefined,
                        password: formData.password || undefined
                    }),
                });

                const data = await res.json();
                if (!res.ok) {
                    setError(data.error || 'Failed to create student');
                    return;
                }
                setSuccess('Student created! All batch subjects auto-assigned.');
            }

            fetchStudents(token!);

            // Auto-close modal after success
            setTimeout(() => {
                setShowModal(false);
                resetForm();
            }, 1500);

        } catch {
            setError('Network error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this student?')) return;
        const token = localStorage.getItem('token');

        try {
            const res = await fetch(`/api/students?id=${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                fetchStudents(token!);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete student');
            }
        } catch (err) {
            console.error('Error deleting:', err);
        }
    };

    // Get subjects count for a batch
    const getBatchSubjectCount = (deptId: string) => {
        return subjects.filter(s => s.batchId === deptId).length;
    };

    // Import Logic
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportFile(file);
        setPreviewData([]);
        setImportResults(null);
        setError('');

        if (file.name.endsWith('.csv')) {
            const seenMap = new Map<string, number>();
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) => {
                    const h = header.trim();
                    const cleanLower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (cleanLower.startsWith('core') || cleanLower.startsWith('generic') || cleanLower.startsWith('ge')) {
                        if (/\d$/.test(cleanLower)) return h;
                        const key = cleanLower.replace(/\d+/g, '');
                        const count = (seenMap.get(key) || 0) + 1;
                        seenMap.set(key, count);
                        return `${h}${count}`;
                    }
                    return h;
                },
                complete: (results) => setPreviewData(results.data.slice(0, 5)),
                error: () => setError('Failed to parse CSV file')
            });
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                setPreviewData(data.slice(0, 5));
            };
            reader.readAsBinaryString(file);
        } else {
            setError('Please upload a valid CSV or Excel file');
            setImportFile(null);
        }
    };

    // Template for coaching center students
    const downloadCoachingTemplate = () => {
        const headers = ['college_id*', 'student_id', 'name*', 'email', 'batch_code*', 'phone', 'dob', 'gender', 'guardian_name', 'address', 'state', 'pincode'];
        const dummyData = [
            ['BCA2025SC001', 'lks2026001', 'John Doe', 'john@example.com', 'LKS', '9876543210', '2005-05-15', 'male', 'Richard Doe', '123 Academic Lane', 'Jharkhand', '834001'],
            ['BSC2025PHY002', 'lks2026002', 'Jane Smith', 'jane@example.com', 'LKS', '9876543211', '2005-08-20', 'female', 'Mary Smith', '456 College Road', 'Jharkhand', '834002']
        ];
        const csvContent = [headers.join(','), ...dummyData.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'students_template.csv';
        a.click();
    };

    const normalizeData = (data: any[]) => {
        const keyMap: { [key: string]: string } = {
            'college id': 'student_id', 'collegeid': 'student_id', 'college_id': 'student_id',
            'college_id*': 'student_id', 'collegeid*': 'student_id', 'college id*': 'student_id',
            'student id': 'coaching_id', 'studentid': 'coaching_id', 'student_id': 'coaching_id', 'id': 'coaching_id',
            'roll number': 'roll_number', 'rollnumber': 'roll_number', 'roll': 'roll_number', 'roll_no': 'roll_number',
            'first name': 'name', 'firstname': 'name', 'name': 'name',
            'first_name*': 'name', 'firstname*': 'name', 'name*': 'name',
            'first_name': 'name', 'full name': 'name', 'fullname': 'name', 'student name': 'name',
            'last name': 'last_name', 'lastname': 'last_name', 'surname': 'last_name',
            'last_name*': 'last_name', 'lastname*': 'last_name',
            'email': 'email', 'email address': 'email', 'email*': 'email',
            'batch': 'batch_code', 'dept': 'batch_code', 'course': 'batch_code',
            'semester': 'semester', 'sem': 'semester',
            'phone': 'phone', 'phonenumber': 'phone', 'phone number': 'phone', 'contact': 'phone', 'mobile': 'phone',
            'dob': 'dob', 'dateofbirth': 'dob', 'date of birth': 'dob', 'birthdate': 'dob',
            'gender': 'gender', 'sex': 'gender',
            'guardianname': 'guardian_name', 'guardian name': 'guardian_name', 'guardian': 'guardian_name', 'parent': 'guardian_name', 'parentname': 'guardian_name', 'parent name': 'guardian_name', 'guardian_name': 'guardian_name',
            'address': 'address', 'street': 'address', 'streetaddress': 'address', 'street address': 'address',
            'state': 'state',
            'pincode': 'pincode', 'pin': 'pincode', 'zip': 'pincode', 'zipcode': 'pincode', 'pin code': 'pincode',
            // Subject columns - Regular
            'major_subject': 'major', 'majorsubject': 'major', 'major subject': 'major', 'major': 'major', 'major*': 'major',
            'minor': 'minor', 'minor subject': 'minor',
            'mdc': 'mdc', 'mdc subject': 'mdc',
            'vac': 'vac', 'vac subject': 'vac',
            'aec': 'aec', 'aec subject': 'aec',
            // Subject columns - Vocational
            'core': 'core1', 'core1': 'core1', 'core 1': 'core1', 'core1*': 'core1',
            'core2': 'core2', 'core 2': 'core2', 'core2*': 'core2',
            'core3': 'core3', 'core 3': 'core3',
            'generic': 'generic1', 'ge1': 'generic1', 'ge 1': 'generic1',
            'ge2': 'generic2', 'ge 2': 'generic2',
            'generic1': 'generic1', 'generic 1': 'generic1', 'generic1*': 'generic1',
            'generic2': 'generic2', 'generic 2': 'generic2', 'generic2*': 'generic2',
            'aecc': 'aecc', 'aecc subject': 'aecc',
            'subject_codes': 'subject_codes', 'subjectcodes': 'subject_codes', 'subjects': 'subject_codes'
        };

        return data.map(row => {
            const newRow: any = {};
            Object.keys(row).forEach(key => {
                const lowerKey = key.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                let mappedKey = null;
                for (const [mapK, mapV] of Object.entries(keyMap)) {
                    if (mapK.replace(/[^a-z0-9]/g, '') === lowerKey) {
                        mappedKey = mapV;
                        break;
                    }
                }
                newRow[mappedKey || key] = row[key];
            });
            return newRow;
        });
    };

    const handleImport = async () => {
        if (!importFile) return;
        setIsImporting(true);
        setError('');

        const processImport = async (rawData: any[]) => {
            const data = normalizeData(rawData);
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setError('Not authenticated. Please log in again.');
                    setIsImporting(false);
                    return;
                }
                const res = await fetch('/api/students/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ students: data })
                });

                if (res.status === 401) {
                    setError('Session expired. Please log out and log in again.');
                    setIsImporting(false);
                    return;
                }

                const contentType = res.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    setError('Server returned an unexpected response. Please try again.');
                    setIsImporting(false);
                    return;
                }

                const result = await res.json();
                if (res.ok) {
                    setImportResults(result);
                    if (result.success > 0 || result.updated > 0) fetchStudents(token!);
                } else {
                    setError(result.error || 'Import failed');
                }
            } catch {
                setError('Network error occurred during import');
            }
            setIsImporting(false);
        };

        if (importFile.name.endsWith('.csv')) {
            const seenMap = new Map<string, number>();
            Papa.parse(importFile, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) => {
                    const h = header.trim();
                    const cleanLower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (cleanLower.startsWith('core') || cleanLower.startsWith('generic') || cleanLower.startsWith('ge')) {
                        if (/\d$/.test(cleanLower)) return h;
                        const key = cleanLower.replace(/\d+/g, '');
                        const count = (seenMap.get(key) || 0) + 1;
                        seenMap.set(key, count);
                        return `${h}${count}`;
                    }
                    return h;
                },
                complete: (results) => processImport(results.data)
            });
        } else {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                processImport(data);
            };
            reader.readAsBinaryString(importFile);
        }
    };

    const getStudentIdPreview = () => {
        if (selectedStudentId) {
            return coachingId || 'Not Assigned';
        }
        const selectedBatch = batches.find(b => b.id === formData.batchId);
        const prefix = selectedBatch?.code || '';
        const year = formData.batchYear || new Date().getFullYear().toString();
        const roll = formData.rollNumber || '[Auto]';
        return prefix ? `${prefix}-${year}-${roll}` : 'Select a batch to preview ID';
    };

    if (loading) return <PageSkeleton type="students" />;

    if (user?.role !== 'super_admin') {
        return <AccessDenied message="Only admins have access to the Students page." />;
    }

    const filteredStudents = students.filter(student => {
        const matchesSearch =
            (student.first_name + ' ' + student.last_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(student.roll_number).includes(searchTerm) ||
            (student.student_id?.includes(searchTerm)) ||
            (student.coaching_id?.toUpperCase().includes(searchTerm.toUpperCase()));

        const matchesDept = !filterBatchId || student.batch_id === filterBatchId;

        return matchesSearch && matchesDept;
    }).sort((a, b) =>
        String(a.roll_number || '').localeCompare(String(b.roll_number || ''), undefined, { numeric: true, sensitivity: 'base' })
    );

    const isSuperAdmin = user?.role === 'super_admin';
    const canManage = user?.role === 'super_admin';

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* Mobile Sidebar */}
            {user && (
                <MobileSidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    user={{ ...user, role: user.role }}
                    onLogout={handleLogout}
                />
            )}

            {/* Navbar */}
            <Navbar user={user} onMenuClick={() => setSidebarOpen(true)} />

            {/* Page Header */}
            <div className="bg-white shadow-sm border-b border-gray-200 mt-16">
                <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <span className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                                <GraduationCap className="w-6 h-6" />
                            </span>
                            Students
                        </h1>
                        <p className="text-gray-500 text-sm mt-1 ml-11">
                            Manage student records and enrollments.
                        </p>
                    </div>
                    {canManage && (
                        <div className="flex gap-2 shrink-0">
                            <Button variant="outline" onClick={() => setShowImportModal(true)} className="hidden md:flex">
                                <FileUp className="w-4 h-4 mr-2" />
                                Import CSV
                            </Button>
                            <Button
                                onClick={() => {
                                    resetForm();
                                    setShowModal(true);
                                }}
                                className="bg-gray-900 hover:bg-gray-800 text-white shadow-sm hidden md:flex"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                <span className="hidden sm:inline">Add Student</span>
                                <span className="sm:hidden">Add</span>
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 py-8 px-4 max-w-7xl mx-auto w-full">

                {/* Filter and Search Bar */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
                    {/* Filters */}
                <div className="md:col-span-4 flex gap-2">
                            {batches.length > 1 && (
                                <div className="relative w-full">
                                    <select
                                        className="w-full bg-white border border-gray-200 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer"
                                        value={filterBatchId}
                                        onChange={(e) => setFilterBatchId(e.target.value)}
                                    >
                                        <option value="">All Batches</option>
                                        {batches.map((dept) => (
                                            <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                </div>
                            )}
                    </div>

                    {/* Search Bar */}
                    <div className={`relative md:col-span-8`}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search by name, roll no, or ID..."
                            className="pl-10 bg-white border-gray-200 rounded-xl focus:ring-blue-500/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Students List */}
                {filteredStudents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                        <div className="bg-blue-50 p-4 rounded-full mb-4">
                            <Search className="w-8 h-8 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No students found</h3>
                        <p className="text-gray-500 max-w-sm text-center mt-1">
                            {students.length === 0 ? "Get started by adding students to the system." : "Try adjusting your search or filters."}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Desktop View */}
                        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">S.No.</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student Details</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                                        {canManage && <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredStudents.map((student, index) => (
                                        <tr key={student.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="px-4 py-4 text-center text-sm font-medium text-gray-500">{index + 1}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                                                        {student.first_name[0]}{student.last_name[0]}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <div className="font-semibold text-gray-900">{student.first_name} {student.last_name}</div>
                                                            {student.batch_code && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                                                    {student.batch_code}
                                                                </span>
                                                            )}
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                {student.batch_name || student.batch_code}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-gray-500 font-mono mt-0.5">
                                                            {student.coaching_id && <span>Student ID: {student.coaching_id} • </span>}College ID: {student.student_id || 'N/A'} • Roll: {student.roll_number}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {student.email || <span className="text-gray-400 italic">No email</span>}
                                            </td>
                                            {canManage && (
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handleEdit(student)} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDelete(student.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Grid View */}
                        <div className="md:hidden grid grid-cols-1 gap-4">
                            {filteredStudents.map((student) => (
                                <div key={student.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
                                                {student.first_name[0]}{student.last_name[0]}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{student.first_name} {student.last_name}</h3>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    {student.coaching_id && (
                                                        <span className="text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded">
                                                            {student.coaching_id}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                        College: {student.student_id || 'N/A'}
                                                    </span>
                                                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                        Roll: {student.roll_number}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {canManage && (
                                            <div className="flex">
                                                <button onClick={() => handleEdit(student)} className="p-2 text-gray-400 hover:text-emerald-600">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(student.id)} className="p-2 text-red-500 md:text-gray-400 hover:text-red-600">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                        <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                                            {student.coaching_id && (
                                                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                                    Student ID: {student.coaching_id}
                                                </span>
                                            )}
                                            <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-100">
                                                {student.batch_name || student.batch_code}
                                            </span>
                                        </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </main>

            {/* Floating Action Buttons (Mobile) */}
            {canManage && (
                <div className="md:hidden fixed bottom-6 right-6 flex flex-col gap-3 z-30">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="h-12 w-12 bg-white text-blue-600 rounded-full shadow-lg border border-blue-50 flex items-center justify-center"
                    >
                        <FileUp className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="h-14 w-14 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center active:scale-90"
                    >
                        <Plus className="w-6 h-6" />
                    </button>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border-0">
                        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4 shrink-0 rounded-t-2xl">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-xl">{selectedStudentId ? 'Edit Student' : 'Add New Student'}</CardTitle>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent className="overflow-y-auto pt-6 custom-scrollbar">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Section 1: Academic & Account Info */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">1. Academic & Account Info</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                                            <Input
                                                id="firstName"
                                                value={formData.firstName}
                                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                                placeholder="Rahul"
                                                className="rounded-xl border-gray-200"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="lastName">Last Name</Label>
                                            <Input
                                                id="lastName"
                                                value={formData.lastName}
                                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                                placeholder="Kumar"
                                                className="rounded-xl border-gray-200"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="email">Email</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="rahul.kumar@example.com"
                                                className="rounded-xl border-gray-200"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="phone">Phone Number</Label>
                                            <Input
                                                id="phone"
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="+91 98765 43210"
                                                className="rounded-xl border-gray-200"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="studentId">College ID <span className="text-red-500">*</span></Label>
                                            <Input
                                                id="studentId"
                                                value={formData.studentId}
                                                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                                                placeholder="e.g. BCA2025SC061"
                                                className="rounded-xl border-gray-200"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="coachingId">Student ID (Auto-generated)</Label>
                                            <Input
                                                id="coachingId"
                                                value={getStudentIdPreview()}
                                                disabled
                                                className="rounded-xl border-gray-200 uppercase bg-gray-50 text-gray-500 font-semibold cursor-not-allowed"
                                            />
                                        </div>
                                        {selectedStudentId && (
                                            <div>
                                                <Label htmlFor="rollNumber">Roll Number</Label>
                                                <Input
                                                    id="rollNumber"
                                                    value={formData.rollNumber}
                                                    disabled
                                                    className="rounded-xl border-gray-200 bg-gray-100 text-gray-500 font-medium"
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <Label htmlFor="batchId">Batch <span className="text-red-500">*</span></Label>
                                            <select
                                                id="batchId"
                                                className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:outline-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed bg-white h-[42px] text-sm"
                                                value={formData.batchId}
                                                onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                                                required
                                                disabled={!!(parsedInfo?.isValid && parsedInfo?.batchPrefix && !batchWarning)}
                                            >
                                                <option value="">Select Batch</option>
                                                {batches
                                                    .filter(dept => dept.status !== 'completed')
                                                    .map((dept) => (
                                                        <option key={dept.id} value={dept.id}>{dept.code} - {dept.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <Label htmlFor="batchYear">Batch Year</Label>
                                            <Input
                                                id="batchYear"
                                                type="number"
                                                value={formData.batchYear}
                                                onChange={(e) => setFormData({ ...formData, batchYear: e.target.value })}
                                                className="rounded-xl border-gray-200"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Password credentials (optional) */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">2. Login Password (Optional)</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <Label htmlFor="password">Password</Label>
                                                {!selectedStudentId && <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Default: Welcome@123</span>}
                                            </div>
                                            <Input
                                                id="password"
                                                type="password"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                placeholder={selectedStudentId ? "Leave blank to keep current" : "Min 6 characters"}
                                                className="rounded-xl border-gray-200"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                                            <Input
                                                id="confirmPassword"
                                                type="password"
                                                value={formData.confirmPassword}
                                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                                placeholder={selectedStudentId ? "Leave blank to keep current" : "Confirm password"}
                                                className="rounded-xl border-gray-200"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Personal Info */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">3. Personal Details</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="dob">Date of Birth</Label>
                                            <Input
                                                id="dob"
                                                type="date"
                                                value={formData.dob}
                                                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                                                className="rounded-xl border-gray-200"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="gender">Gender</Label>
                                            <select
                                                id="gender"
                                                className="w-full p-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:outline-none bg-white h-[42px] text-sm"
                                                value={formData.gender}
                                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                            >
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div className="col-span-1 sm:col-span-2">
                                            <Label htmlFor="guardianName">Guardian / Parent Name</Label>
                                            <Input
                                                id="guardianName"
                                                value={formData.guardianName}
                                                onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                                                placeholder="Mr. Sanjay Kumar"
                                                className="rounded-xl border-gray-200"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 4: Address Details */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">4. Contact Address</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="col-span-1 sm:col-span-2">
                                            <Label htmlFor="address">Street Address</Label>
                                            <Input
                                                id="address"
                                                value={formData.address}
                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                placeholder="123 Academic Lane, Ranchi"
                                                className="rounded-xl border-gray-200"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="state">State</Label>
                                            <Input
                                                id="state"
                                                value={formData.state}
                                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                                placeholder="Jharkhand"
                                                className="rounded-xl border-gray-200"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="pincode">Pin Code</Label>
                                            <Input
                                                id="pincode"
                                                value={formData.pincode}
                                                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                                                placeholder="834001"
                                                className="rounded-xl border-gray-200"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Auto-assigned Subjects Info */}
                                {formData.batchId ? (
                                    <div className="pt-4 border-t">
                                        <Label className="font-medium">Subjects</Label>
                                        {(() => {
                                            const count = getBatchSubjectCount(formData.batchId);
                                            const dept = batches.find(d => d.id === formData.batchId);
                                            return count > 0 ? (
                                                <div className="mt-2 p-4 bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 rounded-xl">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                                        <span className="text-sm font-semibold text-emerald-800">Auto-Assignment</span>
                                                    </div>
                                                    <p className="text-sm text-emerald-700">
                                                        All <span className="font-bold">{count}</span> subject(s) in <span className="font-bold">{dept?.name || dept?.code}</span> batch will be automatically assigned.
                                                    </p>
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {subjects.filter(s => s.batchId === formData.batchId).map(s => (
                                                            <span key={s.id} className="px-2 py-0.5 text-xs bg-white/70 text-emerald-700 rounded-full border border-emerald-100">
                                                                {s.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-gray-500 text-sm p-2 mt-2 bg-gray-50 rounded-xl">No subjects available for this batch yet.</p>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <div className="pt-4 border-t">
                                        <p className="text-amber-600 text-sm bg-amber-50 p-3 rounded-xl border border-amber-100">
                                            Please select a batch to see auto-assigned subjects.
                                        </p>
                                    </div>
                                )}

                                {error && (
                                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        {error}
                                    </div>
                                )}

                                {success && (
                                    <div className="p-3 bg-green-50 text-green-700 rounded-xl text-sm border border-green-100 flex flex-col gap-2">
                                        <div className="font-semibold flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                            Success
                                        </div>
                                        {success}
                                        {!selectedStudentId && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => { setShowModal(false); resetForm(); }}
                                                className="self-end bg-white"
                                            >
                                                Close
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {(!success || selectedStudentId) && (
                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setShowModal(false)}
                                            className="rounded-xl border-gray-200"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={!!batchWarning}
                                            className="bg-gray-900 text-white rounded-xl hover:bg-gray-800 shadow-lg shadow-gray-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {selectedStudentId ? 'Update Student' : 'Add Student'}
                                        </Button>
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border-0">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 pb-4">
                            <CardTitle>Import Students</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setShowImportModal(false)}>
                                <X className="h-5 w-5 text-gray-400" />
                            </Button>
                        </CardHeader>
                        <CardContent className="overflow-y-auto pt-6 custom-scrollbar">
                            {!importResults ? (
                                <div className="space-y-6">
                                    {/* Upload Section */}
                                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center space-y-4 hover:bg-gray-50 transition-colors relative cursor-pointer group">
                                        <input
                                            type="file"
                                            accept=".csv,.xlsx,.xls"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600 group-hover:scale-110 transition-transform">
                                            <FileSpreadsheet className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <p className="text-lg font-semibold text-gray-900">
                                                {importFile ? importFile.name : 'Click to Upload CSV or Excel'}
                                            </p>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Drag & drop or browse from computer
                                            </p>
                                        </div>
                                    </div>

                                    {/* Template Download */}
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                        <div className="mb-3">
                                            <h4 className="font-semibold text-emerald-900 text-sm">Download Template</h4>
                                            <p className="text-xs text-emerald-700 mt-0.5">Download the template CSV to import students.</p>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            <Button variant="outline" onClick={downloadCoachingTemplate} className="bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                                <Download className="w-3.5 h-3.5 mr-2" />
                                                Student Template
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Preview */}
                                    {previewData.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm text-gray-700">
                                                <Search className="w-4 h-4" /> Preview (First 5 Rows)
                                            </h4>
                                            <div className="overflow-x-auto border border-gray-200 rounded-xl">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-gray-50 text-gray-600">
                                                        <tr>
                                                            {Object.keys(previewData[0]).map((header) => (
                                                                <th key={header} className="px-3 py-2 text-left font-medium uppercase tracking-wider">{header}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {previewData.map((row, i) => (
                                                            <tr key={i} className="hover:bg-gray-50">
                                                                {Object.values(row).map((val: any, j) => (
                                                                    <td key={j} className="px-3 py-2 whitespace-nowrap text-gray-600">{val}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 justify-end pt-2">
                                        <Button variant="outline" onClick={() => setShowImportModal(false)} className="rounded-xl">
                                            Cancel
                                        </Button>
                                        <Button onClick={handleImport} disabled={!importFile || isImporting} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                                            {isImporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</> : 'Start Import'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                // Results View
                                <div className="space-y-6">
                                    <div className={`grid gap-4 ${importResults.updated > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                        <div className="bg-green-50 p-5 rounded-2xl text-center border border-green-100">
                                            <div className="text-3xl font-bold text-green-600">{importResults.success}</div>
                                            <div className="text-sm font-medium text-green-800 mt-1">New Students</div>
                                        </div>
                                        {importResults.updated > 0 && (
                                            <div className="bg-blue-50 p-5 rounded-2xl text-center border border-blue-100">
                                                <div className="text-3xl font-bold text-blue-600">{importResults.updated}</div>
                                                <div className="text-sm font-medium text-blue-800 mt-1">Updated</div>
                                            </div>
                                        )}
                                        <div className="bg-red-50 p-5 rounded-2xl text-center border border-red-100">
                                            <div className="text-3xl font-bold text-red-600">{importResults.failed}</div>
                                            <div className="text-sm font-medium text-red-800 mt-1">Failed</div>
                                        </div>
                                    </div>
                                    {importResults.updated > 0 && (
                                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-sm text-blue-700 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 shrink-0" />
                                            {importResults.updated} existing student(s) were updated with new data (name, semester, batch, etc.)
                                        </div>
                                    )}

                                    {importResults.errors.length > 0 && (
                                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                                            <h4 className="font-semibold mb-3 text-red-600 text-sm flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4" /> Error Log
                                            </h4>
                                            <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                                {importResults.errors.map((err, i) => (
                                                    <div key={i} className="flex gap-3 text-xs p-2.5 bg-white rounded-lg border border-red-100 shadow-sm">
                                                        <span className="font-mono text-gray-500 w-12 shrink-0">Row {err.row}</span>
                                                        <span className="text-red-600 flex-1">{err.error}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-4">
                                        <Button onClick={() => { setShowImportModal(false); setImportResults(null); }} className="w-full rounded-xl bg-gray-900 hover:bg-gray-800">
                                            Done
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {error && <p className="text-red-500 text-sm mt-4 text-center bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
