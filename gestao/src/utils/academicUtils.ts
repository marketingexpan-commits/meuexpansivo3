import type { AcademicSettings } from "../types";

/**
 * Centralized Academic Utility for Bimester mapping and Data Normalization.
 */

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
 * Calculates bimester based on dynamic settings.
 */
export const getDynamicBimester = (dateStr: string, settings?: AcademicSettings | null): number => {
    if (!settings || !settings.bimesters) return getBimesterFromDate(dateStr);
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return getBimesterFromDate(dateStr);

    for (const bim of settings.bimesters) {
        const start = new Date(bim.startDate + 'T00:00:00');
        const end = new Date(bim.endDate + 'T23:59:59');
        if (date >= start && date <= end) {
            return bim.number;
        }
    }

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
    if (!gradeLevel) return { grade: '', level: 'Educação Infantil' };

    let level = 'Educação Infantil';
    if (gradeLevel.includes('Fundamental I')) level = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) level = 'Fundamental II';
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) level = 'Ensino Médio';

    const grade = gradeLevel.split(' - ')[0] || gradeLevel;

    return { grade, level };
};

/**
 * Calculates the number of school days between two dates, 
 * excluding weekends and unit-specific holidays/vacations.
 */
export const calculateSchoolDays = (
    start: string,
    end: string,
    events: any[] // CalendarEvent[]
) => {
    let count = 0;
    const curDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');

    if (isNaN(curDate.getTime()) || isNaN(endDate.getTime())) return 0;

    // Map holidays for faster lookup
    const holidayDates = new Set<string>();
    (events || []).forEach(e => {
        if (e.type === 'holiday' || e.type === 'vacation') {
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

