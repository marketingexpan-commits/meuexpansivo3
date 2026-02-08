import type { AcademicSubject } from "./types";
import { CURRICULUM_MATRIX, UNIT_DETAILS } from "./utils/academicDefaults";
export { CURRICULUM_MATRIX, UNIT_DETAILS };

// --- HELPER PARA OBTER MATÉRIAS DA MATRIZ ---
// --- HELPER PARA OBTER MATÉRIAS DA MATRIZ ---
import type { CurriculumMatrix } from "./types";

// --- HELPER PARA OBTER MATÉRIAS DA MATRIZ ---
export const getCurriculumSubjects = (gradeLevel: string, academicSubjects?: AcademicSubject[], matrices?: CurriculumMatrix[], unit?: string, shift?: string): string[] => {
    if (!gradeLevel) return [];

    let subjects: string[] = [];

    // 1. Strict Matrix Lookup (Primary)
    if (matrices && unit && shift) {
        const matchingMatrix = matrices.find(m =>
            m.unit === unit &&
            m.shift === shift &&
            (gradeLevel.includes(m.gradeId) || m.gradeId.includes(gradeLevel))
        );

        if (matchingMatrix) {
            // Filter: Must have weeklyHours > 0
            subjects = matchingMatrix.subjects
                .filter(s => s.weeklyHours && s.weeklyHours > 0)
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(s => s.id);
        }
    }

    // 2. Fallback to Dynamic Subjects (academicSubjects)
    if (subjects.length === 0 && academicSubjects && academicSubjects.length > 0) {
        subjects = academicSubjects
            .filter(s => {
                if (!s.isActive) return false;
                // Workload Check
                if (!s.weeklyHours) return false;
                // Find a key in weeklyHours that matches the gradeLevel (e.g. "1º Ano" matches "1º Ano - E.M.")
                const gradeKey = Object.keys(s.weeklyHours).find(key => gradeLevel.includes(key));
                return gradeKey ? (s.weeklyHours[gradeKey] > 0) : false;
            })
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(s => s.id);
    }

    // 3. Fallback to Legacy Hardcoded Matrix
    if (subjects.length === 0) {
        let levelKey = '';
        if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
        else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
        else if (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Médio') || gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

        if (levelKey && CURRICULUM_MATRIX[levelKey]) {
            subjects = Object.entries(CURRICULUM_MATRIX[levelKey])
                .filter(([_, hours]) => hours > 0) // Filter: Must have workload > 0
                .map(([subjectId]) => subjectId);
        }
    }

    return subjects;
};

import type { CalendarEvent } from "./types";

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
    { id: 'ev1', title: 'Início do Ano Letivo', startDate: '2026-01-19', type: 'school_day', description: 'Boas-vindas aos alunos e responsáveis.', units: ['all'] },
    { id: 'ev2', title: 'Carnaval', startDate: '2026-02-16', endDate: '2026-02-18', type: 'recess', description: 'Recesso escolar.', units: ['all'] },
    { id: 'ev3', title: 'Prova de Matemática - 1º Bimestre', startDate: '2026-03-20', type: 'exam', description: 'Conteúdo: Razões e Proporções.', units: ['all'] },
    { id: 'ev4', title: 'Reunião de Pais e Mestres', startDate: '2026-04-10', type: 'meeting', description: 'Entrega de boletins do 1º Bimestre.', units: ['all'] },
    { id: 'ev5', title: 'Dia do Trabalho', startDate: '2026-05-01', type: 'holiday_national', units: ['all'] },
    { id: 'ev6', title: 'Festa Junina', startDate: '2026-06-21', type: 'event', description: 'Grande arraiá do Expansivo.', units: ['all'] },
    { id: 'ev7', title: 'Férias Escolares', startDate: '2026-07-01', endDate: '2026-07-31', type: 'vacation', units: ['all'] },
    { id: 'ev8', title: 'Independência do Brasil', startDate: '2026-09-07', type: 'holiday_national', units: ['all'] },
    { id: 'ev9', title: 'Semana de Provas Finais', startDate: '2026-11-23', endDate: '2026-11-27', type: 'exam', units: ['all'] },
    { id: 'ev10', title: 'Encerramento do Ano Letivo', startDate: '2026-12-15', type: 'school_day', units: ['all'] }
];

export const SCHOOL_UNITS_LIST = ['unit_bs', 'unit_ext', 'unit_zn', 'unit_qui'];

