import { GradeEntry } from '../types';

/**
 * HOTFIX: Patches specific incorrect grade records that were imported with errors.
 * This function intercepts the grades array and applies hardcoded corrections for specific students/subjects.
 * 
 * Target: Alline Hevyllin (535)
 * Corrections:
 * - Português: 8.5 -> 7.5
 * - Matemática: 8.5 -> 7.0
 */
export const applyGradePatches = (grades: GradeEntry[]): GradeEntry[] => {
    return grades.map(grade => {
        // Target Student: 535 (Alline Hevyllin)
        // Check for both '535' and 'student_535' formats just in case
        if (grade.studentId === '535' || grade.studentId === 'student_535') {
            if (grade.year === 2025) {
                if (grade.subject === 'Português') {
                    // Force corrected value
                    return { ...grade, mediaAnual: 7.5, situacaoFinal: 'Aprovado' };
                }
                if (grade.subject === 'Matemática') {
                    // Force corrected value
                    return { ...grade, mediaAnual: 7.0, situacaoFinal: 'Aprovado' };
                }
            }
        }
        return grade;
    });
};
