/**
 * Coaching Center Student ID Utilities
 * Handles coaching unique IDs like lks2026001, arb2026001
 * and college student IDs like BCA2025SC001
 */

export interface ParsedCoachingId {
    isValid: boolean;
    error?: string;
    batchPrefix: string | null;   // 'lks', 'arb', etc.
    year: number | null;          // 2026
    sequence: number | null;      // 1, 2, 3...
    rollNumber: number | null;    // same as sequence
}

/**
 * Parse a coaching unique ID (e.g., lks2026001)
 * Format: {batchCodeLowercase}{4-digit-year}{3-digit-sequence}
 */
export function parseCoachingId(coachingId: string): ParsedCoachingId {
    const result: ParsedCoachingId = {
        isValid: false,
        batchPrefix: null,
        year: null,
        sequence: null,
        rollNumber: null,
    };

    if (!coachingId || coachingId.length < 7) {
        result.error = 'Coaching ID too short';
        return result;
    }

    const id = coachingId.toLowerCase().trim();

    // Match pattern: letters (2-5) + 4 digits (year) + 1-4 digits (sequence)
    const match = id.match(/^([a-z]{2,5})(\d{4})(\d{1,4})$/);
    if (!match) {
        result.error = 'Invalid coaching ID format. Expected: prefix + year + number (e.g., lks2026001)';
        return result;
    }

    result.batchPrefix = match[1];
    result.year = parseInt(match[2]);
    result.sequence = parseInt(match[3]);
    result.rollNumber = result.sequence;

    // Basic year validation
    if (result.year < 2020 || result.year > 2099) {
        result.error = 'Year must be between 2020 and 2099';
        return result;
    }

    result.isValid = true;
    return result;
}

/**
 * Generate the next coaching ID for a batch
 * @param batchCode - The batch code (e.g., 'LKS')
 * @param year - The year (e.g., 2026)
 * @param lastSequence - The last used sequence number (0 if none)
 * @returns The next coaching ID (e.g., 'lks2026002')
 */
export function generateCoachingId(batchCode: string, year: number, lastSequence: number): string {
    const prefix = batchCode.toLowerCase();
    const nextSeq = (lastSequence + 1).toString().padStart(3, '0');
    return `${prefix}${year}${nextSeq}`;
}

/**
 * Extract roll number from a coaching ID
 * @param coachingId - e.g., 'lks2026001'
 * @returns The roll number (e.g., 1) or null
 */
export function extractRollNumber(coachingId: string): number | null {
    const parsed = parseCoachingId(coachingId);
    return parsed.isValid ? parsed.rollNumber : null;
}

// Legacy compatibility: parseStudentId wraps parseCoachingId
export function parseStudentId(studentId: string): ParsedCoachingId & { admissionYear: number | null } {
    const parsed = parseCoachingId(studentId);
    return {
        ...parsed,
        admissionYear: parsed.year,
    };
}
