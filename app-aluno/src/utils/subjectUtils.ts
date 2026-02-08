import { SUBJECT_LABELS, SUBJECT_SHORT_LABELS } from '../types';
import type { AcademicSubject } from '../types';

/**
 * [DISPLAY LAYER]
 * Retorna o nome amigável de uma disciplina baseado EXTERNAMENTE no banco de dados.
 * Arquitetura Estrita: Não usa heurísticas. Se não encontrar no banco, exibe o ID bruto.
 * Este utilitário assume que o subejctId JÁ É CANÔNICO (disc_...).
 */
export const getSubjectLabel = (subjectId: string, academicSubjects?: AcademicSubject[]): string => {
    if (!subjectId) return '-';

    // 1. Busca na lista vinda do banco (Fonte da Verdade)
    const academicSubject = academicSubjects?.find(s => s.id === subjectId);
    if (academicSubject) {
        // STRICT PRIORITY: shortLabel > label > name
        return academicSubject.shortLabel || academicSubject.label || academicSubject.name;
    }

    // 2. Fallback para constantes locais
    if (SUBJECT_SHORT_LABELS[subjectId]) return SUBJECT_SHORT_LABELS[subjectId];
    if (SUBJECT_LABELS[subjectId]) return SUBJECT_LABELS[subjectId];

    // 3. Erro Visível: Retorna o ID bruto
    return subjectId;
};

/**
 * Retorna a sigla da disciplina.
 * Arquitetura Estrita: Assume ID canônico.
 */
export const getSubjectShortLabel = (subjectId: string, academicSubjects?: AcademicSubject[]): string => {
    if (!subjectId) return '-';

    const academicSubject = academicSubjects?.find(s => s.id === subjectId);
    if (academicSubject) {
        return academicSubject.shortLabel || academicSubject.shortName || academicSubject.name.substring(0, 3);
    }

    const label = SUBJECT_SHORT_LABELS[subjectId];
    if (label) return label;

    return subjectId.substring(0, 3).toUpperCase();
};
