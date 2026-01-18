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
        (key === 'Ensino Médio' && (gradeLevel.includes('Ensino Médio') || gradeLevel.includes('Médio') || gradeLevel.includes('Série')))
    );
    return levelKey ? Object.keys(CURRICULUM_MATRIX[levelKey]) : [];
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

export const SCHOOL_UNITS_LIST = ['Boa Sorte', 'Extremoz', 'Zona Norte', 'Quintas'];

