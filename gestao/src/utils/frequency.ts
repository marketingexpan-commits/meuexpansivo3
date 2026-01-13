/**
 * 🔒 CRITICAL LOGIC: Unit-Specific Frequency Calculation
 * DO NOT REVERT TO STATIC ESTIMATION.
 * This file implements dynamic calculation based on real school days (calendarEvents).
 * Refer to ARCHITECTURE.md for details.
 */

import { CURRICULUM_MATRIX } from "../constants";
import { AttendanceStatus } from "../types";
import type { GradeEntry, AttendanceRecord, AcademicSubject, AcademicSettings } from "../types";
import { getCurrentSchoolYear, getDynamicBimester, calculateSchoolDays, calculateEffectiveTaughtClasses } from "./academicUtils";

/**
 * Calculates the attendance percentage for a given subject and student grade level.
 * STRICT FORMULA: (Effective Taught Classes - Absences) / Effective Taught Classes * 100
 * 
 * @param subject The subject name
 * @param absences Total NUMBER of absence hours (not days)
 * @param gradeLevel The student's grade level
 * @param bimester Optional bimester
 * @param academicSubjects Optional dynamic subjects
 * @param settings Academic settings (for dates)
 * @param calendarEvents Calendar events (for holidays)
 * @param unit Student's unit (for holiday filtering)
 * @param classSchedules List of class schedules (for effective taught calculation)
 */
export const calculateAttendancePercentage = (
    subject: string,
    absences: number,
    gradeLevel: string,
    bimester?: number,
    academicSubjects?: AcademicSubject[],
    settings?: AcademicSettings | null,
    calendarEvents?: any[],
    unit?: string,
    classSchedules?: any[],
    schoolClass?: string
): { percent: number, isEstimated: boolean } | null => {

    if (!unit) return null; // Unit is mandatory for strict calculation

    // 1. Determine Date Range
    let startDate = `${getCurrentSchoolYear()}-01-01`;
    let endDate = new Date().toISOString().split('T')[0];

    if (bimester && settings?.bimesters) {
        const bimConfig = settings.bimesters.find(b => b.number === bimester);
        if (bimConfig) {
            startDate = bimConfig.startDate;
            const bEndDate = bimConfig.endDate;
            // Cap end date to today if current bimester
            endDate = (endDate < bEndDate) ? endDate : bEndDate;
        }
    }

    // 2. Calculate Effective Taught Classes
    let taughtClasses = 0;
    let isEstimated = false;

    if (classSchedules && classSchedules.length > 0) {
        const result = calculateEffectiveTaughtClasses(
            startDate,
            endDate,
            unit,
            subject,
            classSchedules,
            calendarEvents || [],
            gradeLevel,
            schoolClass
        );
        taughtClasses = result.taught;
        isEstimated = result.isEstimated;
    } else {
        isEstimated = true;
    }

    // 3. Fallback to Estimation if Schedule Missing (Safety Rule #5)
    if (isEstimated) {
        // Legacy: Weekly Classes * School Days / 5
        let weeklyClasses = 0;
        // Dynamic lookup
        if (academicSubjects) {
            const ds = academicSubjects.find(s => s.name === subject);
            if (ds?.weeklyHours) {
                const k = Object.keys(ds.weeklyHours).find(key => gradeLevel.includes(key));
                if (k) weeklyClasses = ds.weeklyHours[k];
            }
        }
        // Matrix lookup
        if (weeklyClasses === 0) {
            let levelKey = '';
            if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
            else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
            else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

            if (levelKey && CURRICULUM_MATRIX[levelKey]) {
                weeklyClasses = CURRICULUM_MATRIX[levelKey][subject] || 0;
            }
        }

        if (weeklyClasses > 0) {
            const schoolDays = calculateSchoolDays(startDate, endDate, calendarEvents || [], unit);
            taughtClasses = Math.round((weeklyClasses / 5) * schoolDays);
        }
    }

    // 4. Apply Strict Rules
    // Rule: Start of Year (Taught = 0) -> 100%
    if (taughtClasses === 0) return { percent: 100, isEstimated };

    // Rule: Implicit Presence (Formula)
    // Freq = (Taught - Absences) / Taught
    const percentage = ((taughtClasses - absences) / taughtClasses) * 100;

    return {
        percent: Math.max(0, Math.min(100, parseFloat(percentage.toFixed(2)))),
        isEstimated
    };
};

/**
 * Calculates the annual attendance percentage.
 */
export const calculateAnnualAttendancePercentage = (
    subject: string,
    totalAbsences: number, // Sum of absence hours from logs
    gradeLevel: string,
    _elapsedBimesters: number = 4,
    academicSubjects?: AcademicSubject[],
    settings?: AcademicSettings | null,
    calendarEvents?: any[],
    unit?: string,
    classSchedules?: any[],
    schoolClass?: string
): { percent: number, isEstimated: boolean } | null => {

    if (!unit) return null;

    // Check if year ended (optional optimization, keeping simple for now: effective up to today)

    // Reuse shared logic
    return calculateAttendancePercentage(
        subject,
        totalAbsences,
        gradeLevel,
        undefined, // Annual (no specific bimester limit, uses full range)
        academicSubjects,
        settings,
        calendarEvents,
        unit,
        classSchedules,
        schoolClass
    );
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
