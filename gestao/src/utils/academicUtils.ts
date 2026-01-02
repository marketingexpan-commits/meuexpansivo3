import { GRADES_BY_LEVEL } from '../types';

export const parseGradeLevel = (gradeInput: string | undefined) => {
    if (!gradeInput) return { level: '', grade: '' };

    for (const [level, grades] of Object.entries(GRADES_BY_LEVEL)) {
        // Check for exact match
        if (grades.includes(gradeInput)) return { level, grade: gradeInput };

        // Check for "Grade - Level" pattern (e.g., "1º Ano - Fundamental I")
        for (const g of grades) {
            // Check if starts with grade followed by space or dash, or match completely
            if (gradeInput.startsWith(g)) {
                return { level, grade: g };
            }
        }
    }
    return { level: '', grade: gradeInput };
};

export const normalizeClass = (classInput: string | undefined): string => {
    if (!classInput) return '';

    // Remove leading zeros and trim
    const cleanInput = classInput.toString().trim().replace(/^0+/, '');

    const mapping: Record<string, string> = {
        '1': 'A',
        '2': 'B',
        '3': 'A', // Correction based on user feedback (Extremoz/Legacy data)
        '4': 'B', // Assumed, but safer than D
        '5': 'C',
        '01': 'A',
        '02': 'B',
        '03': 'A',
        '04': 'B',
        // Add more if needed
    };

    if (mapping[cleanInput]) {
        return mapping[cleanInput];
    }

    // If it's already a letter, return uppercase
    if (/^[a-zA-Z]$/.test(cleanInput)) {
        return cleanInput.toUpperCase();
    }

    // Fallback: return original (or maybe try to handle partial matches?)
    return classInput;
};
