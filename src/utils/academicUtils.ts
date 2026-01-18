/**
 * Centralized Academic Utility for Bimester mapping and Data Normalization.
 */
import { AcademicSettings } from "../types";

/**
 * Bimester Ranges (Approximate to Academic Calendar):
 * 1º Bimestre: Jan - Abr (Months 1-4)
 * 2º Bimestre: Mai - Jul (Months 5-7)
 * 3º Bimestre: Ago - Set (Months 8-9)
 * 4º Bimestre: Out - Dez (Months 10-12)
 * 
 * @param dateStr Date in YYYY-MM-DD format
 * @returns Bimester number (1-4)
 */
export const getBimesterFromDate = (dateStr: string): 1 | 2 | 3 | 4 => {
    const month = parseInt(dateStr.split('-')[1], 10);

    if (month >= 1 && month <= 4) return 1;
    if (month >= 5 && month <= 7) return 2;
    if (month >= 8 && month <= 9) return 3;
    return 4; // 10, 11, 12
};

/**
 * Returns the bimester for a given date based on dynamic settings.
 */
export const getDynamicBimester = (dateStr: string, settings?: AcademicSettings | null): number => {
    if (!settings || !settings.bimesters) return getBimesterFromDate(dateStr);
    const date = new Date(dateStr + 'T00:00:00');

    for (const bim of settings.bimesters) {
        const start = new Date(bim.startDate + 'T00:00:00');
        const end = new Date(bim.endDate + 'T00:00:00');
        if (date >= start && date <= end) {
            return bim.number;
        }
    }

    // Fallback to month-based logic if date is outside defined ranges
    return getBimesterFromDate(dateStr);
};

/**
 * Returns the current school year for attendance filtering.
 */
export const getCurrentSchoolYear = (): number => {
    return 2026; // Hardcoded to current system year as requested for the 2026 cycle
};

/**
 * Normalizes class strings from numeric format to letters (e.g. "03" -> "C").
 */
export const normalizeClass = (schoolClass: any): string => {
    if (!schoolClass) return '';
    const classStr = String(schoolClass).trim();

    // If already a letter A-E, just return it uppercase
    if (/^[A-E]$/i.test(classStr)) return classStr.toUpperCase();

    // Mapping numbers to letters
    const num = parseInt(classStr, 10);
    if (isNaN(num)) return classStr;

    const mapping: Record<number, string> = {
        1: 'A',
        2: 'B',
        3: 'C',
        4: 'D',
        5: 'E'
    };

    return mapping[num] || classStr;
};

/**
 * Parses a grade level string into its grade and level components.
 * Example: "1º Ano - Fundamental I" -> { grade: "1º Ano", level: "Fundamental I" }
 */
export const parseGradeLevel = (gradeLevel: string) => {
    if (!gradeLevel) return { grade: '', level: 'Fundamental I' };

    let level = 'Fundamental I';
    if (gradeLevel.includes('Fundamental II')) level = 'Fundamental II';
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) level = 'Ensino Médio';

    const grade = gradeLevel.split(' - ')[0] || gradeLevel;

    return { grade, level };
};

/**
 * Calculates the number of school days between two dates, 
 * excluding weekends and unit-specific holidays/vacations.
 */
/**
 * Calculates the number of school days between two dates, 
 * excluding weekends and unit-specific holidays/vacations.
 */
export const calculateSchoolDays = (
    start: string,
    end: string,
    events: any[], // CalendarEvent[]
    unit?: string // Optional unit for filtering
) => {
    let count = 0;
    const curDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');

    if (isNaN(curDate.getTime()) || isNaN(endDate.getTime())) return 0;

    // Map holidays and extra school days for faster lookup
    const holidayDates = new Set<string>();
    const extraSchoolDates = new Set<string>();

    (events || []).forEach(e => {
        if (unit && e.units && e.units.length > 0 && !e.units.includes(unit) && !e.units.includes('all')) {
            return;
        }

        const s = new Date(e.startDate + 'T00:00:00');
        const f = e.endDate ? new Date(e.endDate + 'T00:00:00') : new Date(e.startDate + 'T00:00:00');

        if (!isNaN(s.getTime())) {
            if (e.type === 'holiday_national' || e.type === 'holiday_state' || e.type === 'holiday_municipal' || e.type === 'vacation' || e.type === 'recess') {
                for (let d = new Date(s); d <= f; d.setDate(d.getDate() + 1)) {
                    holidayDates.add(d.toISOString().split('T')[0]);
                }
            } else if (e.type === 'school_day' || e.type === 'substitution') {
                for (let d = new Date(s); d <= f; d.setDate(d.getDate() + 1)) {
                    extraSchoolDates.add(d.toISOString().split('T')[0]);
                }
            }
        }
    });

    while (curDate <= endDate) {
        const dayOfWeek = curDate.getDay();
        const dateStr = curDate.toISOString().split('T')[0];

        // Count if: (Weekday OR Extra School Day) AND NOT Holiday
        const isActuallySchoolDay = (dayOfWeek !== 0 && dayOfWeek !== 6) || extraSchoolDates.has(dateStr);

        if (isActuallySchoolDay && !holidayDates.has(dateStr)) {
            count++;
        }
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
};

/**
 * Calculates Effective Taught Classes based on REAL SCHEDULE.
 * Iterates through school days and sums classes according to the ClassSchedule.
 */

// Helper to normalize strings for comparison
const normalizeStr = (str: string) => str.trim().toLowerCase();

/**
 * Calculates duration in hours between two HH:mm strings.
 */
const getDurationInHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 1;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    return durationMinutes > 0 ? durationMinutes / 60 : 1;
};

/**
 * Validates if a calendar event applies to a specific student context 
 * using Hierarchical Priority (Class > Grade > Segment > Unit).
 */
export const doesEventApplyToStudent = (
    event: any,
    unit?: string,
    gradeLevel?: string,
    schoolClass?: string
): boolean => {
    // 1. Basic Unit Check
    if (unit && event.units && event.units.length > 0 && !event.units.includes(unit) && !event.units.includes('all')) {
        return false;
    }

    // 2. Hierarchical Priority Check

    // a) Turma (Class) - Most Specific
    if (event.targetClasses && event.targetClasses.length > 0) {
        const normalizedStudentClass = schoolClass ? normalizeClass(schoolClass) : null;
        return normalizedStudentClass ? event.targetClasses.some((c: string) => normalizeClass(c) === normalizedStudentClass) : false;
    }

    // b) Série (Grade)
    if (event.targetGrades && event.targetGrades.length > 0) {
        const studentGrade = gradeLevel ? parseGradeLevel(gradeLevel).grade : null;
        return studentGrade ? event.targetGrades.some((g: string) => parseGradeLevel(g).grade === studentGrade) : false;
    }

    // c) Segmento (Segment)
    if (event.targetSegments && event.targetSegments.length > 0) {
        const studentSegment = gradeLevel ? parseGradeLevel(gradeLevel).level : null;
        return studentSegment ? event.targetSegments.includes(studentSegment) : false;
    }

    // d) Geral da Unidade (No filters defined)
    return true;
};

export const calculateEffectiveTaughtClasses = (
    startDate: string,
    endDate: string,
    unit: string,
    subjectName: string,
    classSchedules: any[], // ClassSchedule[]
    calendarEvents: any[],
    gradeLevel?: string,
    schoolClass?: string
): { taught: number, isEstimated: boolean } => {
    // 1. Find Schedule for this unit/grade/class
    const scheduleMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let hasSchedule = false;

    classSchedules.forEach(schedule => {
        // Filter by Grade/Class if provided
        if (gradeLevel) {
            const sGrade = parseGradeLevel(schedule.grade).grade;
            const tGrade = parseGradeLevel(gradeLevel).grade;
            if (sGrade !== tGrade) return;
        }
        if (schoolClass) {
            if (normalizeClass(schedule.class) !== normalizeClass(schoolClass)) return;
        }

        // Match subject (Normalized) and sum durations
        if (schedule.items) {
            let dailyTotal = 0;
            schedule.items.forEach((item: any) => {
                if (normalizeStr(item.subject) === normalizeStr(subjectName)) {
                    dailyTotal += getDurationInHours(item.startTime, item.endTime);
                }
            });

            if (dailyTotal > 0) {
                scheduleMap[schedule.dayOfWeek] = dailyTotal;
                hasSchedule = true;
            }
        }
    });

    // Fallback if no schedule found
    if (!hasSchedule) {
        return { taught: 0, isEstimated: true };
    }

    let taughtClasses = 0;
    const curDate = new Date(startDate + 'T00:00:00');
    const finalDate = new Date(endDate + 'T00:00:00');

    // Holiday and Extra School Day filtering setup
    const holidayDates = new Set<string>();
    const extraSchoolDates = new Set<string>();

    (calendarEvents || []).forEach(e => {
        if (!doesEventApplyToStudent(e, unit, gradeLevel, schoolClass)) return;

        const s = new Date(e.startDate + 'T00:00:00');
        const f = e.endDate ? new Date(e.endDate + 'T00:00:00') : new Date(e.startDate + 'T00:00:00');

        if (!isNaN(s.getTime())) {
            if (e.type === 'holiday_national' || e.type === 'holiday_state' || e.type === 'holiday_municipal' || e.type === 'vacation' || e.type === 'recess') {
                for (let d = new Date(s); d <= f; d.setDate(d.getDate() + 1)) {
                    holidayDates.add(d.toISOString().split('T')[0]);
                }
            } else if (e.type === 'school_day' || e.type === 'substitution') {
                for (let d = new Date(s); d <= f; d.setDate(d.getDate() + 1)) {
                    extraSchoolDates.add(d.toISOString().split('T')[0]);
                }
            }
        }
    });

    while (curDate <= finalDate) {
        const actualDayOfWeek = curDate.getDay(); // 0-6
        const dateStr = curDate.toISOString().split('T')[0];

        // 1. Check for Events on this specific day
        let isHoliday = holidayDates.has(dateStr);
        let isExtraSchoolDay = extraSchoolDates.has(dateStr);

        // 2. Determine Effective Day of Week
        let effectiveDay = actualDayOfWeek;

        // Find the specific event for this date to check for substitution
        const dayEvent = (calendarEvents || []).find(e => {
            if (!doesEventApplyToStudent(e, unit, gradeLevel, schoolClass)) return false;
            return dateStr >= e.startDate && dateStr <= (e.endDate || e.startDate);
        });

        if (dayEvent && (dayEvent.type === 'school_day' || dayEvent.type === 'substitution')) {
            if (dayEvent.substituteDayOfWeek !== undefined && dayEvent.substituteDayOfWeek !== null) {
                effectiveDay = dayEvent.substituteDayOfWeek;
                isExtraSchoolDay = true;
            }
        }

        // 3. Strict Check: Not Holiday AND (Not Weekend OR Marked as Extra School Day)
        const isWeekend = actualDayOfWeek === 0 || actualDayOfWeek === 6;
        const isActuallySchoolDay = (!isWeekend || isExtraSchoolDay) && !isHoliday;

        if (isActuallySchoolDay) {
            // Add classes for the effective day of week
            taughtClasses += (scheduleMap[effectiveDay] || 0);
        }
        curDate.setDate(curDate.getDate() + 1);
    }

    return { taught: taughtClasses, isEstimated: false };
};

/**
 * Checks if a specific date constitutes a valid school day for a given subject based on the schedule.
 * Used to filter invalid absences (e.g. absences recorded on days without that class).
 */
export const isClassScheduled = (
    dateStr: string,
    subjectName: string,
    classSchedules: any[], // ClassSchedule[]
    calendarEvents: any[],
    unit?: string,
    gradeLevel?: string,
    schoolClass?: string
): boolean => {
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return false;

    const actualDayOfWeek = date.getDay(); // 0-6

    // 1. Check Holidays and Extra School Days
    let isHoliday = false;
    let isExtraSchoolDay = false;
    let effectiveDay = actualDayOfWeek;

    (calendarEvents || []).forEach(e => {
        if (!doesEventApplyToStudent(e, unit, gradeLevel, schoolClass)) return;

        const s = new Date(e.startDate + 'T00:00:00');
        const f = e.endDate ? new Date(e.endDate + 'T00:00:00') : new Date(e.startDate + 'T00:00:00');

        if (date >= s && date <= f) {
            if (e.type === 'holiday_national' || e.type === 'holiday_state' || e.type === 'holiday_municipal' || e.type === 'vacation' || e.type === 'recess') {
                isHoliday = true;
            } else if (e.type === 'school_day' || e.type === 'substitution') {
                isExtraSchoolDay = true;
                if (e.substituteDayOfWeek !== undefined && e.substituteDayOfWeek !== null) {
                    effectiveDay = e.substituteDayOfWeek;
                }
            }
        }
    });

    if (isHoliday) return false;

    // Strict weekend check: if it's weekend, it MUST be an extra school day
    const isWeekend = actualDayOfWeek === 0 || actualDayOfWeek === 6;
    if (isWeekend && !isExtraSchoolDay) return false;

    // 2. Check Schedule for the effective day
    const daySchedule = classSchedules.find((s: any) => {
        if (s.dayOfWeek !== effectiveDay) return false;
        if (gradeLevel) {
            if (parseGradeLevel(s.grade).grade !== parseGradeLevel(gradeLevel).grade) return false;
        }
        if (schoolClass) {
            if (normalizeClass(s.class) !== normalizeClass(schoolClass)) return false;
        }
        return true;
    });

    if (daySchedule && daySchedule.items) {
        return daySchedule.items.some((item: any) => normalizeStr(item.subject) === normalizeStr(subjectName));
    }

    return false;
};

/**
 * Gets the duration in hours for a specific subject on a specific date,
 * weighted by lessonCount if provided.
 */
export const getSubjectDurationForDay = (
    dateStr: string,
    subjectName: string,
    classSchedules: any[],
    lessonCount: number = 1,
    gradeLevel?: string,
    schoolClass?: string,
    calendarEvents?: any[],
    unit?: string
): number => {
    const date = new Date(dateStr + 'T00:00:00');
    const actualDayOfWeek = date.getDay();
    let effectiveDay = actualDayOfWeek;

    // Check for substitution in calendar events
    const dayEvent = (calendarEvents || []).find(e => {
        if (!doesEventApplyToStudent(e, unit, gradeLevel, schoolClass)) return false;
        const s = new Date(e.startDate + 'T00:00:00');
        const f = e.endDate ? new Date(e.endDate + 'T00:00:00') : new Date(e.startDate + 'T00:00:00');
        return date >= s && date <= f;
    });

    if (dayEvent && (dayEvent.type === 'school_day' || dayEvent.type === 'substitution')) {
        if (dayEvent.substituteDayOfWeek !== undefined && dayEvent.substituteDayOfWeek !== null) {
            effectiveDay = dayEvent.substituteDayOfWeek;
        }
    }

    const daySchedule = classSchedules.find((s: any) => {
        if (s.dayOfWeek !== effectiveDay) return false;
        if (gradeLevel && parseGradeLevel(s.grade).grade !== parseGradeLevel(gradeLevel).grade) return false;
        if (schoolClass && normalizeClass(s.class) !== normalizeClass(schoolClass)) return false;
        return true;
    });

    if (!daySchedule || !daySchedule.items) return lessonCount; // Fallback to 1h per lesson

    const subjectItems = daySchedule.items.filter((item: any) => normalizeStr(item.subject) === normalizeStr(subjectName));
    if (subjectItems.length === 0) return lessonCount;

    // Calculate total duration and session count
    const totalDuration = subjectItems.reduce((sum: number, item: any) => sum + getDurationInHours(item.startTime, item.endTime), 0);
    const totalSessions = subjectItems.length;

    // Weight: (Average Duration) * (Number of Lessons Missed)
    return (totalDuration / totalSessions) * lessonCount;
};

