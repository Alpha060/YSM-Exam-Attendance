/**
 * Coaching Center Student ID Utilities
 * Handles coaching unique IDs like LKS2026001, ARA12026001
 * Coaching IDs are stored in UPPERCASE.
 */

export interface ParsedCoachingId {
    isValid: boolean;
    error?: string;
    batchPrefix: string | null;   // 'LKS', 'ARA1', etc. (uppercase)
    year: number | null;          // 2026
    sequence: number | null;      // 1, 2, 3...
    rollNumber: number | null;    // same as sequence
    normalizedId: string | null;  // 'A1-2026-1' etc.
}

/**
 * Parse a coaching unique ID (e.g., LKS2026001 or ARA12026001)
 * Format: {batchCode}{4-digit-year}{1-4 digit sequence}
 * 
 * The batchPrefix is matched greedily: it finds the longest alphabetic+numeric
 * prefix before a 4-digit year (2020-2099) + a sequence number.
 */
export function parseCoachingId(coachingId: string): ParsedCoachingId {
    const result: ParsedCoachingId = {
        isValid: false,
        batchPrefix: null,
        year: null,
        sequence: null,
        rollNumber: null,
        normalizedId: null,
    };

    if (!coachingId || coachingId.length < 7) {
        result.error = 'Student ID too short';
        return result;
    }

    const id = coachingId.toUpperCase().trim();

    // Try matching hyphenated first (e.g. L1-2026-1)
    let match = id.match(/^([A-Z0-9-]+)-(20[2-9]\d)-(\d{1,4})$/);
    if (!match) {
        // Fallback to legacy format: prefix + year + number (e.g. LKS2026001)
        match = id.match(/^([A-Z][A-Z0-9]{1,9}?)(20[2-9]\d)(\d{1,4})$/);
    }

    if (!match) {
        result.error = 'Invalid Student ID format. Expected: prefix-year-number (e.g., L1-2026-1)';
        return result;
    }

    result.batchPrefix = match[1];
    result.year = parseInt(match[2]);
    result.sequence = parseInt(match[3]);
    result.rollNumber = result.sequence;
    result.normalizedId = `${result.batchPrefix}-${result.year}-${result.sequence}`;

    // Basic year validation
    if (result.year < 2020 || result.year > 2099) {
        result.error = 'Year must be between 2020 and 2099';
        return result;
    }

    result.isValid = true;
    return result;
}

/**
 * Try to match a coaching ID prefix against a list of batch codes.
 * Uses longest-match strategy: if codes 'ARA' and 'ARA1' both exist,
 * 'ARA12026001' matches 'ARA1' (longest), not 'ARA'.
 * 
 * @param coachingId - e.g., 'ARA12026007'
 * @param batchCodes - e.g., ['ARA', 'ARA1', 'LKS']
 * @returns The matching batch code, or null
 */
export function matchBatchCode(coachingId: string, batchCodes: string[]): string | null {
    const id = coachingId.toUpperCase().trim();
    
    // Sort batch codes by length descending so longest match wins
    const sorted = [...batchCodes].sort((a, b) => b.length - a.length);
    
    for (const code of sorted) {
        if (id.startsWith(code.toUpperCase())) {
            // Verify the rest is year + sequence (at least 5 digits)
            const rest = id.slice(code.length);
            if (/^-(20[2-9]\d)-(\d{1,4})$/.test(rest)) {
                return code;
            }
            if (/^20[2-9]\d\d{1,4}$/.test(rest)) {
                return code;
            }
        }
    }
    return null;
}

/**
 * Generate the next coaching ID for a batch
 * @param batchCode - The batch code (e.g., 'LKS')
 * @param year - The year (e.g., 2026)
 * @param lastSequence - The last used sequence number (0 if none)
 * @returns The next coaching ID (e.g., 'LKS2026002')
 */
export function generateCoachingId(batchCode: string, year: number, lastSequence: number): string {
    const prefix = batchCode.toUpperCase();
    const nextSeq = (lastSequence + 1).toString().padStart(3, '0');
    return `${prefix}${year}${nextSeq}`;
}

/**
 * Extract roll number from a coaching ID
 * @param coachingId - e.g., 'LKS2026001'
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
