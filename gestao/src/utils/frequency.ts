/**
 * 🔒 CRITICAL LOGIC: Fixed Workload Frequency Calculation
 * This file replaces dynamic calendar logic with a fixed C.H. basis for stable bulletin display.
 * Refer to implementation_plan.md for details.
 */
import { AttendanceStatus } from "../types";
import type { AcademicSettings, GradeEntry, AttendanceRecord, AcademicSubject } from "../types";
import { CURRICULUM_MATRIX } from "../constants";
import { getCurrentSchoolYear, getDynamicBimester } from "./academicUtils";

/**
 * Calculates the attendance percentage for a given subject and student grade level.
 * Formula: ((Total Expected Classes - Absences) / Total Expected Classes) * 100
 */
export const calculateAttendancePercentage = (
    subject: string,
    absences: number,
    gradeLevel: string,
    _bimester?: number,
    academicSubjects?: AcademicSubject[],
    _settings?: AcademicSettings | null,
    _calendarEvents?: any[]
): number | null => {
    // 1. Try Dynamic Lookup
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
    _elapsedBimesters: number = 4,
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

    let totalExpectedHours = 0;
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
