import { CURRICULUM_MATRIX } from "../constants";
import { Subject } from "../types";

/**
 * Calculates the attendance percentage for a given subject and student grade level.
 * Formula: ((Total Expected Classes - Absences) / Total Expected Classes) * 100
 * Assumption: 1 bimester = 10 weeks of classes.
 * 
 * @param subject The subject name (e.g., "Matemática")
 * @param absences Total number of absences in the period
 * @param gradeLevel The student's grade level string (e.g., "6º Ano - Fundamental II")
 * @returns The percentage as a number (0-100) or null if not applicable/found.
 */
export const calculateAttendancePercentage = (
    subject: string,
    absences: number,
    gradeLevel: string
): number | null => {
    // 1. Determine Level from Grade String
    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ens. Médio';

    if (!levelKey) return null;

    // 2. Get Weekly Classes for the Subject
    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return null;

    const weeklyClasses = levelMatrix[subject];

    // If subject not found or has no workload, return null
    if (weeklyClasses === undefined || weeklyClasses === 0) return null;

    // 3. Calculate Total Expected Classes (10 weeks per bimester assumption)
    const totalExpectedClasses = weeklyClasses * 10;

    if (totalExpectedClasses === 0) return 100; // Avoid division by zero

    // 4. Calculate Percentage
    const percentage = ((totalExpectedClasses - absences) / totalExpectedClasses) * 100;

    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1))));
};
