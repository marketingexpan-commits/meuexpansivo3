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
    else if (gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) level = 'Ens. Médio';

    const grade = gradeLevel.split(' - ')[0] || gradeLevel;

    return { grade, level };
};
