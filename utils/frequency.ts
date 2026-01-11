import { CURRICULUM_MATRIX } from "../src/utils/academicDefaults";
import { AttendanceStatus } from "../types";
import type { GradeEntry, AttendanceRecord, AcademicSubject } from "../types";
import { getBimesterFromDate, getCurrentSchoolYear } from "../src/utils/academicUtils";

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
    gradeLevel: string,
    academicSubjects?: AcademicSubject[]
): number | null => {
    // 1. Try Dynamic Lookup first
    if (academicSubjects && academicSubjects.length > 0) {
        const dynamicSubject = academicSubjects.find(s => s.name === subject);
        if (dynamicSubject && dynamicSubject.weeklyHours) {
            // Find exact match or partial match in gradeLevel
            const gradeKey = Object.keys(dynamicSubject.weeklyHours).find(key => gradeLevel.includes(key));
            if (gradeKey) {
                const weeklyClasses = dynamicSubject.weeklyHours[gradeKey];
                if (weeklyClasses > 0) {
                    const totalExpectedClasses = weeklyClasses * 10;
                    if (absences === 0) return null;
                    const percentage = ((totalExpectedClasses - absences) / totalExpectedClasses) * 100;
                    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1))));
                }
            }
        }
    }

    // 2. Fallback to Legacy Matrix
    // Determine Level from Grade String
    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ens. Médio';

    if (!levelKey) return null;

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return null;

    const weeklyClasses = levelMatrix[subject];
    if (weeklyClasses === undefined || weeklyClasses === 0) return null;

    // RULE: Divisor is always fixed (weeklyClasses * 10 weeks)
    const totalExpectedClasses = weeklyClasses * 10;

    // UI RULE: If 0 absences, we keep returning null to show '-' in the specific bimester cell
    if (absences === 0) return null;

    const percentage = ((totalExpectedClasses - absences) / totalExpectedClasses) * 100;
    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1))));
};

/**
 * Calculates the annual attendance percentage.
 * @param activeBimesters Optional. Number of bimesters to consider (1-4). Defaults to 4.
 */
export const calculateAnnualAttendancePercentage = (
    subject: string,
    totalAbsences: number,
    gradeLevel: string,
    elapsedBimesters: number = 4,
    academicSubjects?: AcademicSubject[]
): number | null => {
    // 1. Try Dynamic Lookup
    if (academicSubjects && academicSubjects.length > 0) {
        const dynamicSubject = academicSubjects.find(s => s.name === subject);
        if (dynamicSubject && dynamicSubject.weeklyHours) {
            const gradeKey = Object.keys(dynamicSubject.weeklyHours).find(key => gradeLevel.includes(key));
            if (gradeKey) {
                const weeklyClasses = dynamicSubject.weeklyHours[gradeKey];
                if (weeklyClasses > 0) {
                    const totalExpectedClasses = weeklyClasses * 10 * elapsedBimesters;
                    if (totalExpectedClasses === 0) return 100;
                    const percentage = ((totalExpectedClasses - totalAbsences) / totalExpectedClasses) * 100;
                    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1))));
                }
            }
        }
    }

    // 2. Fallback to Legacy
    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ens. Médio';

    if (!levelKey) return null;

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return null;

    const weeklyClasses = levelMatrix[subject];
    if (weeklyClasses === undefined || weeklyClasses === 0) return null;

    // Market Standard: Divisor is sum of expected classes for elapsed bimesters
    const totalExpectedClasses = weeklyClasses * 10 * elapsedBimesters;
    if (totalExpectedClasses === 0) return 100;

    const percentage = ((totalExpectedClasses - totalAbsences) / totalExpectedClasses) * 100;
    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1))));
};

/**
 * Calculates the general attendance percentage across all subjects.
 * Following market standard: Sum(Expected for ALL subjects in grade) vs Total Absences.
 */
export const calculateGeneralFrequency = (
    _grades: GradeEntry[],
    attendanceRecords: AttendanceRecord[],
    studentId: string,
    gradeLevel: string,
    academicSubjects?: AcademicSubject[]
): string => {
    const currentYear = getCurrentSchoolYear();
    const today = new Date().toISOString().split('T')[0];
    const calendarBim = getBimesterFromDate(today);

    // Find the furthest bimester that has any registered data (absences) for this student
    const maxDataBim = (attendanceRecords || []).reduce((max, record) => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        if (rYear !== currentYear) return max;
        if (!record.studentStatus || !record.studentStatus[studentId]) return max;

        const b = getBimesterFromDate(record.date);
        return b > max ? b : max;
    }, 1);

    const elapsedBimesters = Math.max(calendarBim, maxDataBim);

    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ens. Médio';

    if (!levelKey) return '-';

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return '-';

    // 1. Try Dynamic Total Expected
    let totalExpected = 0;
    let foundDynamic = false;

    if (academicSubjects && academicSubjects.length > 0) {
        academicSubjects.forEach(s => {
            if (s.isActive && s.weeklyHours) {
                const gradeKey = Object.keys(s.weeklyHours).find(key => gradeLevel.includes(key));
                if (gradeKey && s.weeklyHours[gradeKey] > 0) {
                    totalExpected += (s.weeklyHours[gradeKey] * 10 * elapsedBimesters);
                    foundDynamic = true;
                }
            }
        });
    }

    // 2. Fallback to Matrix if no dynamic data found for this grade
    if (!foundDynamic) {
        Object.values(levelMatrix).forEach(weeklyClasses => {
            if (typeof weeklyClasses === 'number' && weeklyClasses > 0) {
                totalExpected += (weeklyClasses * 10 * elapsedBimesters);
            }
        });
    }

    // 2. Calculate Total Absences (Sum of all logs for this student up to the active bimesters)
    const totalAbsences = (attendanceRecords || []).filter(record => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        const rBim = getBimesterFromDate(record.date);
        return rYear === currentYear &&
            rBim <= elapsedBimesters &&
            record.studentStatus &&
            record.studentStatus[studentId] === AttendanceStatus.ABSENT;
    }).length;

    if (totalExpected === 0) return '-';

    const freq = ((totalExpected - totalAbsences) / totalExpected) * 100;
    return Math.max(0, Math.min(100, freq)).toFixed(1) + '%';
};

/**
 * Calculates the general attendance percentage for a SPECIFIC bimester.
 */
export const calculateBimesterGeneralFrequency = (
    attendanceRecords: AttendanceRecord[],
    studentId: string,
    gradeLevel: string,
    bimester: number,
    academicSubjects?: AcademicSubject[]
): string => {
    const currentYear = getCurrentSchoolYear();

    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ens. Médio';

    if (!levelKey) return '-';

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return '-';

    // 1. Try Dynamic Total Expected
    let totalExpected = 0;
    let foundDynamic = false;

    if (academicSubjects && academicSubjects.length > 0) {
        academicSubjects.forEach(s => {
            if (s.isActive && s.weeklyHours) {
                const gradeKey = Object.keys(s.weeklyHours).find(key => gradeLevel.includes(key));
                if (gradeKey && s.weeklyHours[gradeKey] > 0) {
                    totalExpected += (s.weeklyHours[gradeKey] * 10);
                    foundDynamic = true;
                }
            }
        });
    }

    if (!foundDynamic) {
        // Calculate Total Expected for 1 Bimester (10 weeks) Legacy
        Object.values(levelMatrix).forEach(weeklyClasses => {
            if (typeof weeklyClasses === 'number' && weeklyClasses > 0) {
                totalExpected += (weeklyClasses * 10);
            }
        });
    }

    // 2. Calculate Total Absences for this bimester
    const totalAbsences = (attendanceRecords || []).filter(record => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        const rBim = getBimesterFromDate(record.date);
        return rYear === currentYear &&
            rBim === bimester &&
            record.studentStatus &&
            record.studentStatus[studentId] === AttendanceStatus.ABSENT;
    }).length;

    if (totalExpected === 0) return '-';

    const freq = ((totalExpected - totalAbsences) / totalExpected) * 100;
    return Math.max(0, Math.min(100, freq)).toFixed(1) + '%';
};

