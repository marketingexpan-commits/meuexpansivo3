import { CURRICULUM_MATRIX } from "../constants";
import { AttendanceStatus } from "../types";
import type { AcademicSettings } from "../types";
import { getBimesterFromDate, getCurrentSchoolYear, getDynamicBimester } from "./academicUtils";

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
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

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

/**
 * Calculates the general attendance percentage across all subjects.
 */
export const calculateGeneralFrequency = (
    grades: any[],
    attendanceRecords: any[],
    studentId: string,
    gradeLevel: string,
    settings?: AcademicSettings | null
): string => {
    if (!grades || grades.length === 0) return '-';

    let totalExpected = 0;
    let totalAbsences = 0;
    const currentYear = getCurrentSchoolYear();

    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

    if (!levelKey) return '-';

    grades.forEach(g => {
        const weeklyClasses = (CURRICULUM_MATRIX[levelKey] || {})[g.subject] || 0;
        if (weeklyClasses > 0) {
            let activeBimesters = 0;
            [1, 2, 3, 4].forEach(bim => {
                const hasRecords = attendanceRecords.some(record => {
                    const rYear = parseInt(record.date.split('-')[0], 10);
                    const b = settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date);
                    return rYear === currentYear && record.discipline === g.subject && b === bim;
                });
                if (hasRecords) activeBimesters++;
            });

            totalExpected += (weeklyClasses * 10 * activeBimesters);

            totalAbsences += attendanceRecords.filter(record => {
                const rYear = parseInt(record.date.split('-')[0], 10);
                return rYear === currentYear &&
                    record.discipline === g.subject &&
                    record.studentStatus &&
                    record.studentStatus[studentId] === AttendanceStatus.ABSENT;
            }).length;
        }
    });

    if (totalExpected === 0) return '100%';
    const freq = ((totalExpected - totalAbsences) / totalExpected) * 100;
    return freq.toFixed(1) + '%';
};

/**
 * Calculates the annual attendance percentage (40 weeks).
 */
export const calculateAnnualAttendancePercentage = (
    subject: string,
    totalAbsences: number,
    gradeLevel: string
): number | null => {
    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

    if (!levelKey) return null;

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return null;

    const weeklyClasses = levelMatrix[subject];
    if (weeklyClasses === undefined || weeklyClasses === 0) return null;

    const totalExpectedClasses = weeklyClasses * 40;
    if (totalExpectedClasses === 0) return 100;

    const percentage = ((totalExpectedClasses - totalAbsences) / totalExpectedClasses) * 100;
    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1))));
};
