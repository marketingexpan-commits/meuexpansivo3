import type { AcademicSubject } from "./types";
import { CURRICULUM_MATRIX, UNIT_DETAILS } from "./utils/academicDefaults";
export { CURRICULUM_MATRIX, UNIT_DETAILS };

// --- HELPER PARA OBTER MATÉRIAS DA MATRIZ ---
export const getCurriculumSubjects = (gradeLevel: string, academicSubjects?: AcademicSubject[]): string[] => {
    if (!gradeLevel) return [];

    // 1. Try Dynamic Lookup
    if (academicSubjects && academicSubjects.length > 0) {
        const matchingSubjects = academicSubjects.filter(s => {
            if (!s.isActive || !s.weeklyHours) return false;
            return Object.keys(s.weeklyHours).some(key => gradeLevel.includes(key));
        });
        if (matchingSubjects.length > 0) {
            return matchingSubjects
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(s => s.name);
        }
    }

    // 2. Fallback to Matrix
    const sortedMatrixKeys = Object.keys(CURRICULUM_MATRIX).sort((a, b) => b.length - a.length);
    const levelKey = sortedMatrixKeys.find(key =>
        gradeLevel.includes(key) ||
        (key === 'Ens. Médio' && (gradeLevel.includes('Médio') || gradeLevel.includes('Série')))
    );
    return levelKey ? Object.keys(CURRICULUM_MATRIX[levelKey]) : [];
};

