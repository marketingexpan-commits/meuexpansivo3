/**
 * 🔒 CRITICAL LOGIC: Unit-Specific Frequency Calculation
 * DO NOT REVERT TO STATIC ESTIMATION.
 * This file implements dynamic calculation based on real school days (calendarEvents).
 * Refer to ARCHITECTURE.md for details.
 */


import { AttendanceStatus } from "../types";
import type { GradeEntry, AttendanceRecord, AcademicSubject, AcademicSettings, CurriculumMatrix } from "../types";
import { getCurrentSchoolYear, getDynamicBimester, calculateSchoolDays, calculateEffectiveTaughtClasses, getSubjectDurationForDay, isClassScheduled } from "./academicUtils";

/**
 * Calculates the number of taught classes for a given period and subject.
 */
export const calculateTaughtClasses = (
    subject: string,
    gradeLevel: string,
    startDate: string,
    endDate: string,
    unit: string,
    academicSubjects?: AcademicSubject[],
    classSchedules?: any[],
    calendarEvents?: any[],
    schoolClass?: string,
    shift?: string,
    matrices?: CurriculumMatrix[]
): { taught: number, isEstimated: boolean } => {
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
            schoolClass,
            shift,
            subject // Passing subject as subjectId for granular filtering
        );
        taughtClasses = result.taught;
        isEstimated = result.isEstimated;
    } else {
        isEstimated = true;
    }

    // Fallback to Estimation if Schedule Missing
    if (isEstimated) {
        let weeklyClasses = 0;

        // 1. Dynamic Subject override (if still exists as legacy)
        if (academicSubjects) {
            const ds = academicSubjects.find(s => s.id === subject || s.name === subject);
            if (ds?.weeklyHours) {
                const k = Object.keys(ds.weeklyHours).find(key => gradeLevel.includes(key));
                if (k) weeklyClasses = ds.weeklyHours[k];
            }
        }

        // 2. Matrix lookup (Dynamic Collection) - PRIMARY
        if (weeklyClasses === 0 && matrices) {
            const matchingMatrix = matrices.find(m =>
                m.unit === unit &&
                m.shift === shift &&
                (gradeLevel.includes(m.gradeId) || m.gradeId.includes(gradeLevel))
            );

            if (matchingMatrix) {
                const matrixSubject = matchingMatrix.subjects.find(s => s.id === subject);
                if (matrixSubject) weeklyClasses = matrixSubject.weeklyHours;
            }
        }



        if (weeklyClasses > 0) {
            const schoolDays = calculateSchoolDays(startDate, endDate, calendarEvents || [], unit);
            taughtClasses = Math.round((weeklyClasses / 5) * schoolDays);
        }
    }

    return { taught: taughtClasses, isEstimated };
};

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
    schoolClass?: string,
    shift?: string,
    matrices?: CurriculumMatrix[]
): { percent: number, isEstimated: boolean } | null => {

    if (!unit) return null; // Unit is mandatory for strict calculation

    // 1. Determine Date Range
    let startDate = `${getCurrentSchoolYear()}-01-01`;
    let endDate = new Date().toISOString().split('T')[0];

    // STRICTOR RULES: Mirroring calendar events
    if (settings?.bimesters) {
        if (!bimester) {
            // Annual window: Strict mirror of first and last bimester boundaries
            startDate = settings.bimesters[0].startDate;
            const absoluteYearEnd = settings.bimesters[3].endDate;
            if (endDate > absoluteYearEnd) endDate = absoluteYearEnd;
        } else {
            const bimConfig = settings.bimesters.find(b => b.number === bimester);
            if (bimConfig) {
                startDate = bimConfig.startDate;
                const bEndDate = bimConfig.endDate;
                // Cap end date to today if current bimester
                endDate = (endDate < bEndDate) ? endDate : bEndDate;
            }
        }
    }

    // 2. Calculate Taught Classes using shared logic
    const { taught: taughtClasses, isEstimated } = calculateTaughtClasses(
        subject,
        gradeLevel,
        startDate,
        endDate,
        unit,
        academicSubjects,
        classSchedules,
        calendarEvents,
        schoolClass,
        shift,
        matrices
    );

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
    schoolClass?: string,
    shift?: string,
    matrices?: CurriculumMatrix[]
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
        schoolClass,
        shift,
        matrices
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
    settings?: AcademicSettings | null,
    calendarEvents?: any[],
    unit?: string,
    classSchedules?: any[],
    schoolClass?: string,
    shift?: string,
    matrices?: CurriculumMatrix[]
): string => {
    const currentYear = getCurrentSchoolYear();
    const startDate = settings?.bimesters?.[0]?.startDate || `${currentYear}-01-01`;
    let endDate = new Date().toISOString().split('T')[0];
    const absoluteEnd = settings?.bimesters?.[3]?.endDate || `${currentYear}-12-31`;
    if (endDate > absoluteEnd) endDate = absoluteEnd;

    let totalTaughtClasses = 0;

    // Determine which subjects to iterate over
    const subjectsToCalculate: string[] = [];

    // 1. Resolve from Matrix (Primary)
    if (matrices && unit && shift) {
        const matchingMatrix = matrices.find(m =>
            m.unit === unit &&
            m.shift === shift &&
            (gradeLevel.includes(m.gradeId) || m.gradeId.includes(gradeLevel))
        );

        if (matchingMatrix) {
            matchingMatrix.subjects.forEach(s => subjectsToCalculate.push(s.id));
        }
    }

    // 2. Fallback to academicSubjects
    if (subjectsToCalculate.length === 0 && academicSubjects && academicSubjects.length > 0) {
        academicSubjects.forEach(s => {
            if (s.isActive) subjectsToCalculate.push(s.id);
        });
    }



    // Sum taught classes for all subjects
    subjectsToCalculate.forEach(subject => {
        const { taught } = calculateTaughtClasses(
            subject,
            gradeLevel,
            startDate,
            endDate,
            unit || '',
            academicSubjects,
            classSchedules,
            calendarEvents,
            schoolClass,
            shift,
            matrices
        );
        totalTaughtClasses += taught;
    });

    const totalAbsences = (attendanceRecords || []).reduce((acc, record) => {
        if (record.date < startDate || record.date > endDate) return acc;
        if (record.studentStatus && record.studentStatus[studentId] === AttendanceStatus.ABSENT) {
            // Verify if the day is a valid school day for this subject
            if (classSchedules && classSchedules.length > 0) {
                if (!isClassScheduled(record.date, record.discipline, classSchedules, calendarEvents || [], unit, gradeLevel, schoolClass)) {
                    return acc;
                }
            }

            const individualCount = record.studentAbsenceCount?.[studentId];
            const weight = individualCount !== undefined ? individualCount : (record.lessonCount || 1);

            if (classSchedules && classSchedules.length > 0) {
                return acc + getSubjectDurationForDay(record.date, record.discipline, classSchedules, weight, gradeLevel, schoolClass, calendarEvents, unit);
            }
            return acc + weight;
        }
        return acc;
    }, 0);

    if (totalTaughtClasses === 0) return '-';
    const freq = ((totalTaughtClasses - totalAbsences) / totalTaughtClasses) * 100;
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
    settings?: AcademicSettings | null,
    calendarEvents?: any[],
    unit?: string,
    classSchedules?: any[],
    schoolClass?: string,
    shift?: string,
    matrices?: CurriculumMatrix[]
): string => {
    const currentYear = getCurrentSchoolYear();

    // Determine Bimester Dates
    let startDate = `${currentYear}-01-01`;
    let endDate = new Date().toISOString().split('T')[0];

    if (settings?.bimesters) {
        const bimConfig = settings.bimesters.find(b => b.number === bimester);
        if (bimConfig) {
            startDate = bimConfig.startDate;
            const bEndDate = bimConfig.endDate;
            endDate = (endDate < bEndDate) ? endDate : bEndDate;
        }
    }

    let totalTaughtClasses = 0;

    // Determine which subjects to iterate over
    const subjectsToCalculate: string[] = [];

    // 1. Resolve from Matrix (Primary)
    if (matrices && unit && shift) {
        const matchingMatrix = matrices.find(m =>
            m.unit === unit &&
            m.shift === shift &&
            (gradeLevel.includes(m.gradeId) || m.gradeId.includes(gradeLevel))
        );

        if (matchingMatrix) {
            matchingMatrix.subjects.forEach(s => subjectsToCalculate.push(s.id));
        }
    }

    // 2. Fallback to academicSubjects
    if (subjectsToCalculate.length === 0 && academicSubjects && academicSubjects.length > 0) {
        academicSubjects.forEach(s => {
            if (s.isActive) subjectsToCalculate.push(s.id);
        });
    }



    // Sum taught classes for all subjects
    subjectsToCalculate.forEach(subject => {
        const { taught } = calculateTaughtClasses(
            subject,
            gradeLevel,
            startDate,
            endDate,
            unit || '',
            academicSubjects,
            classSchedules,
            calendarEvents,
            schoolClass,
            shift,
            matrices
        );
        totalTaughtClasses += taught;
    });

    const totalAbsences = (attendanceRecords || []).reduce((acc, record) => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        const rBim = getDynamicBimester(record.date, settings);
        if (rYear === currentYear && rBim === bimester && record.studentStatus && record.studentStatus[studentId] === AttendanceStatus.ABSENT) {
            // Verify if the day is a valid school day for this subject
            if (classSchedules && classSchedules.length > 0) {
                if (!isClassScheduled(record.date, record.discipline, classSchedules, calendarEvents || [], unit, gradeLevel, schoolClass)) {
                    return acc;
                }
            }

            const individualCount = record.studentAbsenceCount?.[studentId];
            const weight = individualCount !== undefined ? individualCount : (record.lessonCount || 1);

            if (classSchedules && classSchedules.length > 0) {
                return acc + getSubjectDurationForDay(record.date, record.discipline, classSchedules, weight, gradeLevel, schoolClass, calendarEvents, unit);
            }
            return acc + weight;
        }
        return acc;
    }, 0);

    if (totalTaughtClasses === 0) return '-';
    const freq = ((totalTaughtClasses - totalAbsences) / totalTaughtClasses) * 100;
    return Math.max(0, Math.min(100, freq)).toFixed(2) + '%';
};
