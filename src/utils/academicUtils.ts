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

    // Map holidays for faster lookup
    const holidayDates = new Set<string>();
    (events || []).forEach(e => {
        if (e.type === 'holiday_national' || e.type === 'holiday_state' || e.type === 'holiday_municipal' || e.type === 'vacation' || e.type === 'recess') {
            // UNIT CHECK: If event has units defined, ONLY apply if current unit is in list.
            // If event units is empty/null, it applies to ALL units.
            if (unit && e.units && e.units.length > 0 && !e.units.includes(unit)) {
                return; // Skip this holiday as it doesn't apply to this unit
            }

            const s = new Date(e.startDate + 'T00:00:00');
            const f = e.endDate ? new Date(e.endDate + 'T00:00:00') : new Date(e.startDate + 'T00:00:00');

            if (!isNaN(s.getTime())) {
                for (let d = new Date(s); d <= f; d.setDate(d.getDate() + 1)) {
                    holidayDates.add(d.toISOString().split('T')[0]);
                }
            }
        }
    });

    while (curDate <= endDate) {
        const dayOfWeek = curDate.getDay();
        const dateStr = curDate.toISOString().split('T')[0];
        // 0 = Sunday, 6 = Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
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

        // Match subject (Normalized)
        if (schedule.items) {
            const count = schedule.items.filter((item: any) => normalizeStr(item.subject) === normalizeStr(subjectName)).length;
            if (count > 0) {
                scheduleMap[schedule.dayOfWeek] = count;
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

    // Holiday filtering setup
    const holidayDates = new Set<string>();
    (calendarEvents || []).forEach(e => {
        if (e.type === 'holiday_national' || e.type === 'holiday_state' || e.type === 'holiday_municipal' || e.type === 'vacation' || e.type === 'recess') {
            if (unit && e.units && e.units.length > 0 && !e.units.includes(unit)) {
                return;
            }
            const s = new Date(e.startDate + 'T00:00:00');
            const f = e.endDate ? new Date(e.endDate + 'T00:00:00') : new Date(e.startDate + 'T00:00:00');
            if (!isNaN(s.getTime())) {
                for (let d = new Date(s); d <= f; d.setDate(d.getDate() + 1)) {
                    holidayDates.add(d.toISOString().split('T')[0]);
                }
            }
        }
    });

    while (curDate <= finalDate) {
        const dayOfWeek = curDate.getDay(); // 0-6
        const dateStr = curDate.toISOString().split('T')[0];

        // Strict Check: Not Weekend AND Not Holiday
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
            // Add classes for this specific day of week
            taughtClasses += (scheduleMap[dayOfWeek] || 0);
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

    const weekDay = date.getDay(); // 0-6
    if (weekDay === 0 || weekDay === 6) return false;

    // 1. Check Holidays
    const isHoliday = (calendarEvents || []).some(e => {
        if (e.type === 'holiday_national' || e.type === 'holiday_state' || e.type === 'holiday_municipal' || e.type === 'vacation' || e.type === 'recess') {
            if (unit && e.units && e.units.length > 0 && !e.units.includes(unit)) {
                return false;
            }
            const s = new Date(e.startDate + 'T00:00:00');
            const f = e.endDate ? new Date(e.endDate + 'T00:00:00') : new Date(e.startDate + 'T00:00:00');
            return date >= s && date <= f;
        }
        return false;
    });

    if (isHoliday) return false;

    // 2. Check Schedule
    // Find schedule for this day of week
    const daySchedule = classSchedules.find((s: any) => {
        if (s.dayOfWeek !== weekDay) return false;
        if (gradeLevel) {
            if (parseGradeLevel(s.grade).grade !== parseGradeLevel(gradeLevel).grade) return false;
        }
        if (schoolClass) {
            if (normalizeClass(s.class) !== normalizeClass(schoolClass)) return false;
        }
        return true;
    });
    if (!daySchedule || !daySchedule.items) return false;

    // Check if subject exists in items (Normalized)
    const hasSubject = daySchedule.items.some((item: any) => normalizeStr(item.subject) === normalizeStr(subjectName));
    return hasSubject;
};

