export interface Batch {
    id: string;
    name: string;
    code: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Student {
    id: string;
    studentId: string;
    coachingId: string | null;
    rollNumber: number;
    firstName: string;
    lastName: string;
    email: string | null;
    batchId: string;
    currentSemester: number;
    batchYear: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface Subject {
    id: string;
    code: string;
    name: string;
    batchId: string;
    credits: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface TeacherSubject {
    id: string;
    teacherId: string;
    subjectId: string;
    academicYear: string;
    createdAt: Date;
}

export interface StudentSubject {
    id: string;
    studentId: string;
    subjectId: string;
    academicYear: string;
    enrolledAt: Date;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
    id: string;
    subjectId: string;
    studentId: string;
    teacherId: string;
    date: Date;
    lectureNumber: number;
    status: AttendanceStatus;
    remarks?: string;
    recordedAt: Date;
}

export interface Holiday {
    id: string;
    name: string;
    date: Date;
    description?: string;
    createdAt: Date;
}
