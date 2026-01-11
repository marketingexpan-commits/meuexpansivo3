import { CURRICULUM_MATRIX } from "./academicDefaults";
import { AttendanceStatus } from "../types";
import type { GradeEntry, AttendanceRecord, AcademicSubject } from "../types";
import { getBimesterFromDate, getCurrentSchoolYear } from "./academicUtils";

/**
 * Calculates the attendance percentage for a given subject and student grade level.
 * Formula: ((Total Expected Classes - Absences) / Total Expected Classes) * 100
 * Assumption: 1 bimester = 10 weeks of classes.
 */
export const calculateAttendancePercentage = (
    subject: string,
    absences: number,
    gradeLevel: string,
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
                    const totalExpectedClasses = weeklyClasses * 10;
                    if (absences === 0) return null;
                    const percentage = ((totalExpectedClasses - absences) / totalExpectedClasses) * 100;
                    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1))));
                }
            }
        }
    }

    // 2. Fallback to Legacy Matrix
    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ens. Médio';

    if (!levelKey) return null;

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return null;

    const weeklyClasses = levelMatrix[subject];
    if (weeklyClasses === undefined || weeklyClasses === 0) return null;

    const totalExpectedClasses = weeklyClasses * 10;

    // UI RULE: keep '-' if 0 absences
    if (absences === 0) return null;

    const percentage = ((totalExpectedClasses - absences) / totalExpectedClasses) * 100;
    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1))));
};

/**
 * Calculates the annual attendance percentage.
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

    // 2. Fallback to Legacy Matrix
    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ens. Médio';

    if (!levelKey) return null;

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return null;

    const weeklyClasses = levelMatrix[subject];
    if (weeklyClasses === undefined || weeklyClasses === 0) return null;

    const totalExpectedClasses = weeklyClasses * 10 * elapsedBimesters;
    if (totalExpectedClasses === 0) return 100;

    const percentage = ((totalExpectedClasses - totalAbsences) / totalExpectedClasses) * 100;
    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1))));
};

/**
 * Calculates the general attendance percentage across all subjects.
 * Market Standard: Sum of expected for ALL subjects in grade matrix.
 */
export const calculateGeneralFrequency = (
    _grades: GradeEntry[],
    attendanceRecords: AttendanceRecord[],
    studentId: string,
    gradeLevel: string,
    studentUnit?: string,
    studentClass?: string,
    academicSubjects?: AcademicSubject[]
): string => {
    const currentYear = getCurrentSchoolYear();
    const today = new Date().toISOString().split('T')[0];
    const calendarBim = getBimesterFromDate(today);

    // Dynamic detection of elapsed bimesters
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

    // 2. Fallback to Matrix
    if (!foundDynamic) {
        Object.values(levelMatrix).forEach(weeklyClasses => {
            if (typeof weeklyClasses === 'number' && weeklyClasses > 0) {
                totalExpected += (weeklyClasses * 10 * elapsedBimesters);
            }
        });
    }

    // 2. Sum ALL absences from logs for this year
    const totalAbsences = (attendanceRecords || []).filter(record => {
        const rYear = parseInt(record.date.split('-')[0], 10);

        // Base Match
        const isTargetYear = rYear === currentYear;
        const hasStudentRecord = record.studentStatus && record.studentStatus[studentId] === AttendanceStatus.ABSENT;

        // Optional Filters (contextual for reports)
        const unitMatch = studentUnit ? record.unit === studentUnit : true;
        const classMatch = studentClass ? record.schoolClass === studentClass : true;

        return isTargetYear && hasStudentRecord && unitMatch && classMatch;
    }).length;

    if (totalExpected === 0) return '-';

    const freq = ((totalExpected - totalAbsences) / totalExpected) * 100;
    return Math.max(0, Math.min(100, freq)).toFixed(1) + '%';
};
