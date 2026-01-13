/**
 * 🔒 CRITICAL LOGIC: Unit-Specific Frequency Calculation
 * DO NOT REVERT TO STATIC ESTIMATION.
 * This file implements dynamic calculation based on real school days (calendarEvents).
 * Refer to ARCHITECTURE.md for details.
 */
import { AttendanceStatus } from "../types";
import type { AcademicSettings, GradeEntry, AttendanceRecord, AcademicSubject } from "../types";
import { CURRICULUM_MATRIX } from "../constants";
import { getBimesterFromDate, getCurrentSchoolYear, getDynamicBimester, calculateSchoolDays } from "./academicUtils";

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
 */
export const calculateAttendancePercentage = (
    subject: string,
    absences: number,
    gradeLevel: string,
    bimester?: number,
    academicSubjects?: AcademicSubject[],
    settings?: AcademicSettings | null,
    calendarEvents?: any[]
): number | null => {
    // 1. Try Dynamic Lookup
    if (academicSubjects && academicSubjects.length > 0) {
        const dynamicSubject = academicSubjects.find(s => s.name === subject);
        if (dynamicSubject && dynamicSubject.weeklyHours) {
            const gradeKey = Object.keys(dynamicSubject.weeklyHours).find(key => gradeLevel.includes(key));
            if (gradeKey) {
                const weeklyClasses = dynamicSubject.weeklyHours[gradeKey];
                if (weeklyClasses > 0) {
                    let totalExpectedClasses = weeklyClasses * 10;

                    // Multi-Unit Logic
                    if (settings && calendarEvents && bimester) {
                        const bim = settings.bimesters.find(b => b.number === bimester);
                        if (bim) {
                            const days = calculateSchoolDays(bim.startDate, bim.endDate, calendarEvents);
                            totalExpectedClasses = (weeklyClasses / 5) * days;
                        }
                    }

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
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

    if (!levelKey) return null;

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return null;

    const weeklyClasses = levelMatrix[subject];
    if (weeklyClasses === undefined || weeklyClasses === 0) return null;

    let totalExpectedClasses = weeklyClasses * 10;

    // Multi-Unit Logic for Legacy
    if (settings && calendarEvents && bimester) {
        const bim = settings.bimesters.find(b => b.number === bimester);
        if (bim) {
            const days = calculateSchoolDays(bim.startDate, bim.endDate, calendarEvents);
            totalExpectedClasses = (weeklyClasses / 5) * days;
        }
    }

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
    academicSubjects?: AcademicSubject[],
    settings?: AcademicSettings | null,
    calendarEvents?: any[]
): number | null => {
    const effectiveElapsed = (settings && elapsedBimesters === 4)
        ? Math.max(1, getDynamicBimester(new Date().toISOString().split('T')[0], settings))
        : elapsedBimesters;

    if (academicSubjects && academicSubjects.length > 0) {
        const dynamicSubject = academicSubjects.find(s => s.name === subject);
        if (dynamicSubject && dynamicSubject.weeklyHours) {
            const gradeKey = Object.keys(dynamicSubject.weeklyHours).find(key => gradeLevel.includes(key));
            if (gradeKey) {
                const weeklyClasses = dynamicSubject.weeklyHours[gradeKey];
                if (weeklyClasses > 0) {
                    let totalExpectedClasses = 0;
                    if (settings && calendarEvents) {
                        for (let i = 1; i <= effectiveElapsed; i++) {
                            const bim = settings.bimesters.find(b => b.number === i);
                            if (bim) {
                                const days = calculateSchoolDays(bim.startDate, bim.endDate, calendarEvents);
                                totalExpectedClasses += (weeklyClasses / 5) * days;
                            }
                        }
                    } else {
                        totalExpectedClasses = weeklyClasses * 10 * effectiveElapsed;
                    }

                    if (totalExpectedClasses === 0) return 100;
                    const percentage = ((totalExpectedClasses - totalAbsences) / totalExpectedClasses) * 100;
                    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1))));
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

    let totalExpectedClasses = 0;
    if (settings && calendarEvents) {
        for (let i = 1; i <= effectiveElapsed; i++) {
            const bim = settings.bimesters.find(b => b.number === i);
            if (bim) {
                const days = calculateSchoolDays(bim.startDate, bim.endDate, calendarEvents);
                totalExpectedClasses += (weeklyClasses / 5) * days;
            }
        }
    } else {
        totalExpectedClasses = weeklyClasses * 10 * effectiveElapsed;
    }

    if (totalExpectedClasses === 0) return 100;

    const percentage = ((totalExpectedClasses - totalAbsences) / totalExpectedClasses) * 100;
    return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1))));
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
    settings?: AcademicSettings | null,
    calendarEvents?: any[]
): string => {
    const currentYear = getCurrentSchoolYear();
    const today = new Date().toISOString().split('T')[0];
    const calendarBim = settings ? getDynamicBimester(today, settings) : getBimesterFromDate(today);

    const maxDataBim = (attendanceRecords || []).reduce((max, record) => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        if (rYear !== currentYear) return max;
        if (!record.studentStatus || !record.studentStatus[studentId]) return max;
        const b = settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date);
        return Math.max(max, b);
    }, 1);

    const elapsedBimesters = Math.max(calendarBim, maxDataBim);

    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

    if (!levelKey) return '-';

    const levelMatrix = CURRICULUM_MATRIX[levelKey];
    if (!levelMatrix) return '-';

    let totalExpected = 0;
    let foundDynamic = false;

    if (academicSubjects && academicSubjects.length > 0) {
        academicSubjects.forEach(s => {
            if (s.isActive && s.weeklyHours) {
                const gradeKey = Object.keys(s.weeklyHours).find(key => gradeLevel.includes(key));
                if (gradeKey && s.weeklyHours[gradeKey] > 0) {
                    const weeklyClasses = s.weeklyHours[gradeKey];
                    if (settings && calendarEvents) {
                        for (let i = 1; i <= elapsedBimesters; i++) {
                            const bim = settings.bimesters.find(b => b.number === i);
                            if (bim) {
                                const days = calculateSchoolDays(bim.startDate, bim.endDate, calendarEvents);
                                totalExpected += (weeklyClasses / 5) * days;
                            }
                        }
                    } else {
                        totalExpected += (weeklyClasses * 10 * elapsedBimesters);
                    }
                    foundDynamic = true;
                }
            }
        });
    }

    if (!foundDynamic) {
        Object.values(levelMatrix).forEach(weeklyClasses => {
            if (typeof weeklyClasses === 'number' && weeklyClasses > 0) {
                if (settings && calendarEvents) {
                    for (let i = 1; i <= elapsedBimesters; i++) {
                        const bim = settings.bimesters.find(b => b.number === i);
                        if (bim) {
                            const days = calculateSchoolDays(bim.startDate, bim.endDate, calendarEvents);
                            totalExpected += (weeklyClasses / 5) * days;
                        }
                    }
                } else {
                    totalExpected += (weeklyClasses * 10 * elapsedBimesters);
                }
            }
        });
    }

    const totalAbsences = (attendanceRecords || []).filter(record => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        const rBim = settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date);
        const hasStudentRecord = record.studentStatus && record.studentStatus[studentId] === AttendanceStatus.ABSENT;
        return rYear === currentYear && rBim <= elapsedBimesters && hasStudentRecord;
    }).length;

    if (totalExpected === 0) return '-';
    const freq = ((totalExpected - totalAbsences) / totalExpected) * 100;
    return Math.max(0, Math.min(100, freq)).toFixed(1) + '%';
};
