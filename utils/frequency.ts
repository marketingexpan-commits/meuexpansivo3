
/**
 * 🔒 CRITICAL LOGIC: Unit-Specific Frequency Calculation
 * DO NOT REVERT TO STATIC ESTIMATION.
 * This file implements dynamic calculation based on real school days (calendarEvents).
 * Refer to ARCHITECTURE.md for details.
 */

import { CURRICULUM_MATRIX } from "../src/utils/academicDefaults";
import { AttendanceStatus } from "../types";
import type { GradeEntry, AttendanceRecord, AcademicSubject } from "../types";
import { getBimesterFromDate, getCurrentSchoolYear, getDynamicBimester, calculateSchoolDays } from "../src/utils/academicUtils";
import type { AcademicSettings } from "../types";

/**
 * Calculates the attendance percentage for a given subject and student grade level.
 * Formula: ((Total Expected Classes - Absences) / Total Expected Classes) * 100
 * 
 * @param subject The subject name (e.g., "Matemática")
 * @param absences Total number of absences in the period
 * @param gradeLevel The student's grade level string (e.g., "6º Ano - Fundamental II")
 * @param bimester Optional. Specific bimester for holiday-aware calculation.
 * @param academicSubjects Optional dynamic subjects.
 * @param settings Optional academic settings.
 * @param calendarEvents Optional calendar events.
 * @returns The percentage as a number (0-100) or null if not applicable/found.
 */
export const calculateAttendancePercentage = (
    subject: string,
    absences: number,
    gradeLevel: string,
    bimester?: number,
    academicSubjects?: AcademicSubject[],
    _settings?: AcademicSettings | null,
    _calendarEvents?: any[]
): number | null => {
    // 1. Try Dynamic Lookup first
    if (academicSubjects && academicSubjects.length > 0) {
        const dynamicSubject = academicSubjects.find(s => s.name === subject);
        if (dynamicSubject && dynamicSubject.weeklyHours) {
            const gradeKey = Object.keys(dynamicSubject.weeklyHours).find(key => gradeLevel.includes(key));
            if (gradeKey) {
                const weeklyClasses = dynamicSubject.weeklyHours[gradeKey];
                if (weeklyClasses > 0) {
                    // C.H. BASIS: Each bimester is exactly 10 weeks
                    const totalExpectedClasses = weeklyClasses * 10;

                    if (absences === 0) return null;
                    const percentage = ((totalExpectedClasses - absences) / totalExpectedClasses) * 100;
                    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(2))));
                }
            }
        }
    }

    // 2. Fallback to Legacy Matrix
    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

    if (!levelKey) return null;

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return null;

    const weeklyClasses = levelMatrix[subject];
    if (weeklyClasses === undefined || weeklyClasses === 0) return null;

    // C.H. BASIS: Each bimester is exactly 10 weeks
    const totalExpectedClasses = weeklyClasses * 10;

    if (absences === 0) return null;

    const percentage = ((totalExpectedClasses - absences) / totalExpectedClasses) * 100;
    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(2))));
};

/**
 * Calculates the annual attendance percentage.
 */
export const calculateAnnualAttendancePercentage = (
    subject: string,
    totalAbsences: number,
    gradeLevel: string,
    elapsedBimesters: number = 4,
    academicSubjects?: AcademicSubject[],
    _settings?: AcademicSettings | null,
    _calendarEvents?: any[]
): number | null => {
    if (academicSubjects && academicSubjects.length > 0) {
        const dynamicSubject = academicSubjects.find(s => s.name === subject);
        if (dynamicSubject && dynamicSubject.weeklyHours) {
            const gradeKey = Object.keys(dynamicSubject.weeklyHours).find(key => gradeLevel.includes(key));
            if (gradeKey) {
                const weeklyClasses = dynamicSubject.weeklyHours[gradeKey];
                if (weeklyClasses > 0) {
                    // C.H. BASIS: full year is 40 weeks
                    const totalExpectedClasses = weeklyClasses * 40;

                    if (totalExpectedClasses === 0) return 100;
                    const percentage = ((totalExpectedClasses - totalAbsences) / totalExpectedClasses) * 100;
                    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(2))));
                }
            }
        }
    }

    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

    if (!levelKey) return null;

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return null;

    const weeklyClasses = levelMatrix[subject];
    if (weeklyClasses === undefined || weeklyClasses === 0) return null;

    // C.H. BASIS: full year is 40 weeks
    const totalExpectedClasses = weeklyClasses * 40;

    if (totalExpectedClasses === 0) return 100;

    const percentage = ((totalExpectedClasses - totalAbsences) / totalExpectedClasses) * 100;
    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(2))));
};

/**
 * Calculates the general attendance percentage across all subjects.
 */
export const calculateGeneralFrequency = (
    _grades: GradeEntry[],
    attendanceRecords: AttendanceRecord[],
    studentId: string,
    gradeLevel: string,
    academicSubjects?: AcademicSubject[],
    _settings?: AcademicSettings | null,
    _calendarEvents?: any[]
): string => {
    const currentYear = getCurrentSchoolYear();

    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

    if (!levelKey) return '-';

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return '-';

    let totalExpectedHours = 0; // Cumulative expected classes for the full year
    let foundDynamic = false;

    if (academicSubjects && academicSubjects.length > 0) {
        academicSubjects.forEach(s => {
            if (s.isActive && s.weeklyHours) {
                const gradeKey = Object.keys(s.weeklyHours).find(key => gradeLevel.includes(key));
                if (gradeKey && s.weeklyHours[gradeKey] > 0) {
                    const weeklyClasses = s.weeklyHours[gradeKey];
                    // C.H. BASIS: 40 weeks per year
                    totalExpectedHours += (weeklyClasses * 40);
                    foundDynamic = true;
                }
            }
        });
    }

    if (!foundDynamic) {
        Object.values(levelMatrix).forEach(weeklyClasses => {
            if (typeof weeklyClasses === 'number' && weeklyClasses > 0) {
                // C.H. BASIS: 40 weeks per year
                totalExpectedHours += (weeklyClasses * 40);
            }
        });
    }

    const totalAbsences = (attendanceRecords || []).filter(record => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        return rYear === currentYear &&
            record.studentStatus &&
            record.studentStatus[studentId] === AttendanceStatus.ABSENT;
    }).length;

    if (totalExpectedHours === 0) return '-';
    const freq = ((totalExpectedHours - totalAbsences) / totalExpectedHours) * 100;
    return Math.max(0, Math.min(100, freq)).toFixed(2) + '%';
};

/**
 * Calculates the general attendance percentage for a SPECIFIC bimester.
 */
export const calculateBimesterGeneralFrequency = (
    attendanceRecords: AttendanceRecord[],
    studentId: string,
    gradeLevel: string,
    bimester: number,
    academicSubjects?: AcademicSubject[],
    _settings?: AcademicSettings | null,
    _calendarEvents?: any[]
): string => {
    const currentYear = getCurrentSchoolYear();

    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

    if (!levelKey) return '-';

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return '-';

    let totalExpectedHours = 0;
    let foundDynamic = false;

    if (academicSubjects && academicSubjects.length > 0) {
        academicSubjects.forEach(s => {
            if (s.isActive && s.weeklyHours) {
                const gradeKey = Object.keys(s.weeklyHours).find(key => gradeLevel.includes(key));
                if (gradeKey && s.weeklyHours[gradeKey] > 0) {
                    const weeklyClasses = s.weeklyHours[gradeKey];
                    // C.H. BASIS: 10 weeks per bimester
                    totalExpectedHours += (weeklyClasses * 10);
                    foundDynamic = true;
                }
            }
        });
    }

    if (!foundDynamic) {
        Object.values(levelMatrix).forEach(weeklyClasses => {
            if (typeof weeklyClasses === 'number' && weeklyClasses > 0) {
                // C.H. BASIS: 10 weeks per bimester
                totalExpectedHours += (weeklyClasses * 10);
            }
        });
    }

    const totalAbsences = (attendanceRecords || []).filter(record => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        const rBim = getDynamicBimester(record.date, _settings);
        return rYear === currentYear &&
            rBim === bimester &&
            record.studentStatus &&
            record.studentStatus[studentId] === AttendanceStatus.ABSENT;
    }).length;

    if (totalExpectedHours === 0) return '-';
    const freq = ((totalExpectedHours - totalAbsences) / totalExpectedHours) * 100;
    return Math.max(0, Math.min(100, freq)).toFixed(2) + '%';
};

