import { CURRICULUM_MATRIX } from "../constants";
import { AttendanceStatus } from "../types";
import type { AcademicSettings } from "../types";
import { getBimesterFromDate, getCurrentSchoolYear, getDynamicBimester } from "./academicUtils";

/**
 * Calculates the attendance percentage for a given subject and student grade level.
 * Formula: ((Total Expected Classes - Absences) / Total Expected Classes) * 100
 * Assumption: 1 bimester = 10 weeks of classes.
 * 
 * @param subject The subject name (e.g., "Matemática")
 * @param absences Total number of absences in the period
 * @param gradeLevel The student's grade level string (e.g., "6º Ano - Fundamental II")
 * @returns The percentage as a number (0-100) or null if not applicable/found.
 */
export const calculateAttendancePercentage = (
    subject: string,
    absences: number,
    gradeLevel: string,
    bimester?: number,
    subjects: any[] = [],
    settings?: any,
    events?: any[],
    unit?: string,
    schedules?: any[],
    schoolClass?: string,
    shift?: string
): { percent: number; isEstimated: boolean } | null => {
    // 1. Try to find subject in academicSubjects (by ID or Name)
    // If 'subject' is an ID, this finds the object. If 'subject' is a name, we search by name.
    const subjectData = subjects.find(s => s.id === subject || s.name === subject);
    const subjectName = subjectData ? subjectData.name : subject;

    // 2. Determine Level from Grade String
    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

    if (!levelKey) return null;

    // 3. Get Weekly Classes
    let weeklyClasses = 0;

    // Priority 1: Weekly Hours from Database Subject Data for this level
    if (subjectData && subjectData.weeklyHours) {
        // weeklyHours keys are like 'Fundamental I', 'Ensino Médio', etc.
        // We try to find a key that matches the student's level
        const key = Object.keys(subjectData.weeklyHours).find(k => gradeLevel.includes(k) || levelKey === k);
        if (key) weeklyClasses = subjectData.weeklyHours[key];
    }

    // Priority 2: Fallback to Curriculum Matrix (using normalized Name)
    if (weeklyClasses === 0) {
        const levelMatrix = CURRICULUM_MATRIX[levelKey];
        if (levelMatrix) {
            weeklyClasses = levelMatrix[subjectName] || 0;
        }
    }

    // If subject not found or has no workload, return null
    if (weeklyClasses === 0) return null;

    // 4. Calculate Total Expected Classes (10 weeks per bimester assumption)
    // TODO: Improve this with bimester dates if available
    const totalExpectedClasses = weeklyClasses * 10;

    if (totalExpectedClasses === 0) return { percent: 100, isEstimated: true }; // Avoid division by zero

    // 5. Calculate Percentage
    const percentage = ((totalExpectedClasses - absences) / totalExpectedClasses) * 100;

    // Clamp between 0 and 100
    return {
        percent: Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1)))),
        isEstimated: true // Marks that we are using the simple 10-week estimation
    };
};

/**
 * Calculates the general attendance percentage across all subjects.
 */
export const calculateGeneralFrequency = (
    grades: any[],
    attendanceRecords: any[],
    studentId: string,
    gradeLevel: string,
    subjects: any[] = [],
    settings?: AcademicSettings | null,
    events?: any[],
    unit?: string,
    schedules?: any[],
    schoolClass?: string,
    shift?: string
): string => {
    if (!grades || grades.length === 0) return '-';

    let totalExpected = 0;
    let totalAbsences = 0;
    const currentYear = getCurrentSchoolYear();

    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

    if (!levelKey) return '-';

    grades.forEach(g => {
        // Resolve Subject Name/Workload
        const subjectData = subjects.find(s => s.id === g.subject || s.name === g.subject);
        const subjectName = subjectData ? subjectData.name : g.subject;
        const subjectId = subjectData ? subjectData.id : g.subject;

        let weeklyClasses = 0;
        if (subjectData && subjectData.weeklyHours) {
            const key = Object.keys(subjectData.weeklyHours).find(k => gradeLevel.includes(k) || levelKey === k);
            if (key) weeklyClasses = subjectData.weeklyHours[key];
        }
        if (weeklyClasses === 0) {
            weeklyClasses = (CURRICULUM_MATRIX[levelKey] || {})[subjectName] || 0;
        }

        if (weeklyClasses > 0) {
            let activeBimesters = 0;
            [1, 2, 3, 4].forEach(bim => {
                const hasRecords = attendanceRecords.some(record => {
                    const rYear = parseInt(record.date.split('-')[0], 10);
                    const b = settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date);
                    // Check against ID or Name
                    return rYear === currentYear && (record.discipline === subjectData?.id || record.discipline === subjectData?.name || record.discipline === g.subject) && b === bim;
                });
                if (hasRecords) activeBimesters++;
            });

            totalExpected += (weeklyClasses * 10 * activeBimesters);

            totalAbsences += attendanceRecords.filter(record => {
                const rYear = parseInt(record.date.split('-')[0], 10);
                return rYear === currentYear &&
                    (record.discipline === subjectData?.id || record.discipline === subjectData?.name || record.discipline === g.subject) &&
                    record.studentStatus &&
                    record.studentStatus[studentId] === AttendanceStatus.ABSENT;
            }).length;
        }
    });

    if (totalExpected === 0) return '100%';
    const freq = ((totalExpected - totalAbsences) / totalExpected) * 100;
    return freq.toFixed(1) + '%';
};

/**
 * Calculates the annual attendance percentage (40 weeks).
 */
export const calculateAnnualAttendancePercentage = (
    subject: string,
    totalAbsences: number,
    gradeLevel: string,
    elapsedBimesters: number = 4,
    subjects: any[] = [],
    settings?: any,
    events?: any[],
    unit?: string,
    schedules?: any[],
    schoolClass?: string,
    shift?: string
): { percent: number; isEstimated: boolean } | null => {
    // 1. Resolve Subject
    const subjectData = subjects.find(s => s.id === subject || s.name === subject);
    const subjectName = subjectData ? subjectData.name : subject;

    let levelKey = '';
    if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
    else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

    if (!levelKey) return null;

    let weeklyClasses = 0;
    if (subjectData && subjectData.weeklyHours) {
        const key = Object.keys(subjectData.weeklyHours).find(k => gradeLevel.includes(k) || levelKey === k);
        if (key) weeklyClasses = subjectData.weeklyHours[key];
    }
    if (weeklyClasses === 0) {
        const levelMatrix = CURRICULUM_MATRIX[levelKey];
        if (levelMatrix) {
            weeklyClasses = levelMatrix[subjectName] || 0;
        }
    }

    if (weeklyClasses === 0) return null;

    const totalExpectedClasses = weeklyClasses * 40;
    if (totalExpectedClasses === 0) return { percent: 100, isEstimated: true };

    const percentage = ((totalExpectedClasses - totalAbsences) / totalExpectedClasses) * 100;
    return {
        percent: Math.max(0, Math.min(100, parseFloat(percentage.toFixed(1)))),
        isEstimated: true
    };
};
