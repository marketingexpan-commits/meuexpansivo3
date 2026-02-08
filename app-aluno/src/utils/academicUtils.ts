/**
 * Centralized Academic Utility for Bimester mapping and Data Normalization.
 * Trigger Vercel Build: 2026-02-07
 */
import { AcademicSettings, SchoolUnit } from "../types";

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
 * Parses a YYYY-MM-DD string into a Date object at exactly 00:00:00 in LOCAL time.
 * Avoids off-by-one errors caused by UTC-sensitive parsing.
 */
export const safeParseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0);
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

import { ACADEMIC_GRADES, ACADEMIC_SEGMENTS } from "./academicDefaults";

/**
 * Normalizes class strings from numeric format to letters (e.g. "03" -> "C").
 * Now strictly enforced as a single letter ID.
 */
export const normalizeClass = (schoolClass: any): string => {
    if (!schoolClass) return '';
    const classStr = String(schoolClass).trim().toUpperCase();

    // Mapping common variants to standard IDs
    const mapping: Record<string, string> = {
        '1': 'A', '01': 'A',
        '2': 'B', '02': 'B',
        '3': 'C', '03': 'C',
        '4': 'D', '04': 'D',
        '5': 'E', '05': 'E'
    };

    return mapping[classStr] || classStr;
};

/**
 * Normalizes shift strings to internal IDs (e.g. "Matutino" -> "shift_morning").
 * Handles both enum IDs and display labels for robust comparison.
 */
export const normalizeShift = (shift: any): string => {
    if (!shift) return '';
    const s = String(shift).trim().toLowerCase();
    if (s.includes('morning') || s === 'matutino') return 'shift_morning';
    if (s.includes('afternoon') || s === 'vespertino') return 'shift_afternoon';
    return s;
};

/**
 * Normalizes unit strings to internal IDs (e.g. "Zona Norte" -> "unit_zn").
 */
/**
 * Normalizes unit strings to internal IDs (e.g. "Zona Norte" -> "unit_zn").
 */
export const normalizeUnit = (unit: any): SchoolUnit | string => {
    if (!unit) return '';
    const u = String(unit).trim().toLowerCase();
    if (u.includes('zona norte') || u === 'unit_zn') return SchoolUnit.UNIT_ZN;
    if (u.includes('boa sorte') || u === 'unit_bs') return SchoolUnit.UNIT_BS;
    if (u.includes('extremoz') || u === 'unit_ext') return SchoolUnit.UNIT_EXT;
    if (u.includes('quintas') || u === 'unit_qui') return SchoolUnit.UNIT_QUI;
    return u;
};

/**
 * 🔒 STRICT ID RESOLUTION: Unit
 * strictly returns a valid SchoolUnit ID or null.
 */
export const resolveUnitId = (input: string): string | null => {
    if (!input) return null;
    const normalized = normalizeUnit(input);
    if (Object.values(SchoolUnit).includes(normalized as SchoolUnit)) {
        return normalized;
    }
    return null;
};

/**
 * 🔒 STRICT ID RESOLUTION: Shift
 * strictly returns a valid SchoolShift ID or null.
 */
export const resolveShiftId = (input: string): string | null => {
    if (!input) return null;
    const normalized = normalizeShift(input);
    if (normalized === 'shift_morning' || normalized === 'shift_afternoon') return normalized;
    return null;
};

/**
 * 🔒 STRICT ID RESOLUTION: Grade
 * strictly returns a valid Grade ID (e.g., 'grade_1_ser') or null.
 * Checks both ID matches and exact Label matches against ACADEMIC_GRADES.
 */
export const resolveGradeId = (input: string): string | null => {
    if (!input) return null;
    const trimmed = input.trim();

    // 1. Direct ID Match
    const directMatch = Object.values(ACADEMIC_GRADES).find(g => g.id === trimmed);
    if (directMatch) return directMatch.id;

    // 2. Canonical Label Match
    const labelMatch = Object.values(ACADEMIC_GRADES).find(g => g.label === trimmed);
    if (labelMatch) return labelMatch.id;

    // 3. Fallback: Try parsing the label if it contains extra info like " - Ensino Médio"
    // But ONLY if exact match fails. We prioritize strictness.
    const parts = trimmed.split(/ - | \(/);
    const candidateLabel = parts[0].trim();
    const fuzzyMatch = Object.values(ACADEMIC_GRADES).find(g => g.label === candidateLabel);
    if (fuzzyMatch) return fuzzyMatch.id;

    return null;
};

/**
 * Parses a grade level string into its grade and level components.
 * Rigorous version: Expects "GradeLabel - SegmentLabel" or a valid Grade ID.
 * Returns official Labels only to maintain UI consistency.
 */
export const parseGradeLevel = (gradeLevel: string) => {
    if (!gradeLevel) return { grade: '', level: ACADEMIC_SEGMENTS.FUND_1.label, segmentId: ACADEMIC_SEGMENTS.FUND_1.id };

    // 1. Try Strict ID Resolution first
    const resolvedId = resolveGradeId(gradeLevel);
    if (resolvedId) {
        const gradeDef = Object.values(ACADEMIC_GRADES).find(g => g.id === resolvedId);
        if (gradeDef) {
            const segment = Object.values(ACADEMIC_SEGMENTS).find(s => s.id === gradeDef.segmentId);
            return {
                grade: gradeDef.label,
                level: segment?.label || ACADEMIC_SEGMENTS.FUND_1.label,
                segmentId: gradeDef.segmentId
            };
        }
    }

    // 2. Fallback to parsing string (for legacy/display compatibility)
    const parts = gradeLevel.split(' - ').map(p => p.trim());
    const gradePart = parts[0];
    const levelPart = parts[1];

    // Try to match any of the parts against the official grade labels
    const officialGrade = Object.values(ACADEMIC_GRADES).find(g =>
        (g.label === gradePart && (!levelPart || ACADEMIC_SEGMENTS[Object.keys(ACADEMIC_SEGMENTS).find(k => ACADEMIC_SEGMENTS[k as keyof typeof ACADEMIC_SEGMENTS].label === levelPart) as keyof typeof ACADEMIC_SEGMENTS]?.id === g.segmentId)) ||
        (levelPart && g.label === levelPart && (!gradePart || ACADEMIC_SEGMENTS[Object.keys(ACADEMIC_SEGMENTS).find(k => ACADEMIC_SEGMENTS[k as keyof typeof ACADEMIC_SEGMENTS].label === gradePart) as keyof typeof ACADEMIC_SEGMENTS]?.id === g.segmentId))
    );

    if (officialGrade) {
        const segment = Object.values(ACADEMIC_SEGMENTS).find(s => s.id === officialGrade.segmentId);
        return {
            grade: officialGrade.label,
            level: segment?.label || ACADEMIC_SEGMENTS.FUND_1.label,
            segmentId: officialGrade.segmentId
        };
    }

    // Fallback logic for legacy cases or partial strings
    let level = ACADEMIC_SEGMENTS.FUND_1.label;
    let segmentId = ACADEMIC_SEGMENTS.FUND_1.id;

    if (gradeLevel.includes('Fundamental II')) {
        level = ACADEMIC_SEGMENTS.FUND_2.label;
        segmentId = ACADEMIC_SEGMENTS.FUND_2.id;
    }
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio')) {
        level = ACADEMIC_SEGMENTS.MEDIO.label;
        segmentId = ACADEMIC_SEGMENTS.MEDIO.id;
    }
    else if (gradeLevel.includes('Infantil')) {
        level = ACADEMIC_SEGMENTS.INFANTIL.label;
        segmentId = ACADEMIC_SEGMENTS.INFANTIL.id;
    }

    // Try to extract the most likely grade part (the one that is not a segment name)
    const segmentLabels = Object.values(ACADEMIC_SEGMENTS).map(s => s.label.toLowerCase());
    const gradeCandidate = parts.find(p => !segmentLabels.includes(p.toLowerCase())) || parts[0] || gradeLevel;

    return {
        grade: gradeCandidate,
        level,
        segmentId
    };
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
    unit?: string, // Optional unit for filtering
    gradeLevel?: string,
    schoolClass?: string,
    shift?: string,
    subjectId?: string
) => {
    let count = 0;
    const curDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');

    if (isNaN(curDate.getTime()) || isNaN(endDate.getTime())) return 0;

    // Map holidays and extra school days for faster lookup
    const holidayDates = new Set<string>();
    const extraSchoolDates = new Set<string>();

    (events || []).forEach(e => {
        // Use hierarchical filter
        if (!doesEventApplyToStudent(e, unit, gradeLevel, schoolClass, shift, subjectId)) {
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
    schoolClass?: string,
    shift?: string,
    subjectId?: string
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

    // b) Turno (Shift) - Additive Filter
    if (event.targetShifts && event.targetShifts.length > 0) {
        if (shift && !event.targetShifts.includes(shift)) {
            return false;
        }
    }

    // c) Disciplina (Subject) - Additive Filter (CRITICAL for Repositions)
    if (event.targetSubjectIds && event.targetSubjectIds.length > 0) {
        if (subjectId && !event.targetSubjectIds.includes(subjectId)) {
            return false;
        }
    }

    // d) Série (Grade)
    if (event.targetGrades && event.targetGrades.length > 0) {
        const studentGrade = gradeLevel ? parseGradeLevel(gradeLevel).grade : null;
        return studentGrade ? event.targetGrades.some((g: string) => parseGradeLevel(g).grade === studentGrade) : false;
    }

    // e) Segmento (Segment)
    if (event.targetSegments && event.targetSegments.length > 0) {
        const studentSegment = gradeLevel ? parseGradeLevel(gradeLevel).level : null;
        return studentSegment ? event.targetSegments.includes(studentSegment) : false;
    }

    // f) Geral da Unidade (No filters defined)
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
    schoolClass?: string,
    studentShift?: string,
    subjectId?: string // Now required for granular filtering
): { taught: number, isEstimated: boolean } => {
    // 1. Resolve Strict Target IDs
    let targetGradeId: string | null = null;
    let targetUnitId: string | null = null;
    let targetShiftId: string | null = null;

    if (gradeLevel) targetGradeId = resolveGradeId(gradeLevel);
    if (unit) targetUnitId = resolveUnitId(unit);
    if (studentShift) targetShiftId = resolveShiftId(studentShift);

    // 1. Find Schedule for this unit/grade/class
    const scheduleMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let hasScheduleForSubject = false;
    let hasAnyScheduleForClass = false;

    classSchedules.forEach(schedule => {
        // STRICT FILTERING

        // Check Unit
        if (targetUnitId) {
            const scheduleUnitId = resolveUnitId(schedule.schoolId);
            if (scheduleUnitId !== targetUnitId) return;
        }

        // Check Shift
        if (targetShiftId) {
            const scheduleShiftId = resolveShiftId(schedule.shift);
            if (scheduleShiftId !== targetShiftId) return;
        }

        // Check Grade
        if (targetGradeId) {
            let scheduleGradeId: string | null = null;

            // PRIORITY: Try to extract Grade ID from Document ID (Technical Source of Truth)
            // Pattern: unit_{unitId}_{gradeDescriptionOrId}_{class}_{shift}_...
            // This is complex, so we fallback to verifying if schedule.grade is an ID.
            scheduleGradeId = resolveGradeId(schedule.grade);

            // If the schedule.grade is a label like "1ª Série", resolveGradeId handles it.
            // If it's "grade_1_ser", resolveGradeId handles it.

            if (scheduleGradeId !== targetGradeId) return;
        }

        // Check Class (Strict Normalization)
        if (schoolClass) {
            if (normalizeClass(schedule.class) !== normalizeClass(schoolClass)) return;
        }

        // If we reached here, we found at least one schedule entry for this class/grade
        hasAnyScheduleForClass = true;

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
                hasScheduleForSubject = true;
            }
        }
    });

    // Fallback if no schedule found for this SUBJECT
    if (!hasScheduleForSubject) {
        // If there is ANY schedule for this class, we assume the subject is NOT scheduled
        // and therefore should NOT be estimated.
        return { taught: 0, isEstimated: !hasAnyScheduleForClass };
    }

    let taughtClasses = 0;
    const curDate = new Date(startDate + 'T00:00:00');
    const finalDate = new Date(endDate + 'T00:00:00');

    // Holiday and Extra School Day filtering setup
    const holidayDates = new Set<string>();
    const extraSchoolDates = new Set<string>();

    (calendarEvents || []).forEach(e => {
        if (!doesEventApplyToStudent(e, unit, gradeLevel, schoolClass, studentShift, subjectId)) return;

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
            if (!doesEventApplyToStudent(e, unit, gradeLevel, schoolClass, studentShift, subjectId)) return false;
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
    schoolClass?: string,
    shift?: string,
    subjectId?: string
): boolean => {
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return false;

    const actualDayOfWeek = date.getDay(); // 0-6

    // 1. Check Holidays and Extra School Days
    let isHoliday = false;
    let isExtraSchoolDay = false;
    let effectiveDay = actualDayOfWeek;

    (calendarEvents || []).forEach(e => {
        if (!doesEventApplyToStudent(e, unit, gradeLevel, schoolClass, shift, subjectId)) return;

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

    // Resolve Target IDs
    let targetGradeId = gradeLevel ? resolveGradeId(gradeLevel) : null;
    let targetUnitId = unit ? resolveUnitId(unit) : null;
    let targetShiftId = shift ? resolveShiftId(shift) : null;


    // 2. Check Schedule for the effective day
    const daySchedule = classSchedules.find((s: any) => {
        if (s.dayOfWeek !== effectiveDay) return false;

        // Strict Filters
        if (targetGradeId && resolveGradeId(s.grade) !== targetGradeId) return false;
        if (targetUnitId && resolveUnitId(s.schoolId) !== targetUnitId) return false;
        if (targetShiftId && resolveShiftId(s.shift) !== targetShiftId) return false;

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
    unit?: string,
    shift?: string,
    subjectId?: string
): number => {
    const date = new Date(dateStr + 'T00:00:00');
    const actualDayOfWeek = date.getDay();
    let effectiveDay = actualDayOfWeek;

    // Check for substitution in calendar events
    const dayEvent = (calendarEvents || []).find(e => {
        if (!doesEventApplyToStudent(e, unit, gradeLevel, schoolClass, shift, subjectId)) return false;
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


/**
 * Formats an ISO timestamp or Date object to Brazilian format (DD/MM/YYYY HH:mm).
 */
export const formatDateWithTimeBr = (dateInput: string | Date | undefined): string => {
    if (!dateInput) return '-';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';

    return date.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};
