import { Subject, SUBJECT_LABELS, SUBJECT_SHORT_LABELS } from '../types';
import type { AcademicSubject } from '../types';

/**
 * Utilitário de Sanitização (APENAS PARA USO ADMINISTRATIVO / LIMPEZA)
 * Heuristicamente tenta mapear uma string "suja" para seu ID canônico (disc_).
 * NÃO deve ser usado em fluxos de produção (boletim, grade, etc).
 */
export const sanitizeSubjectId = (subjectStr: string, academicSubjects?: AcademicSubject[]): string => {
    if (!subjectStr) return subjectStr;

    // 1. Match direto nas constantes Subject (disc_...)
    const validSubjects = Object.values(Subject);
    if (validSubjects.includes(subjectStr as any)) return subjectStr;

    // 2. Heurísticas para mapear nomes ou IDs antigos para o novo padrão disc_
    const normalized = subjectStr.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\./g, '')
        .trim();

    // Mapeamento determinístico via heurística
    if (normalized === 'mat' || normalized.includes('math') || normalized.includes('matematica')) return Subject.MATH;
    if (normalized === 'por' || normalized === 'lp' || normalized.includes('port') || normalized.includes('lingua')) return Subject.PORTUGUESE;
    if (normalized === 'his' || normalized.includes('hist')) return Subject.HISTORY;
    if (normalized === 'geo' || normalized.includes('geog')) return Subject.GEOGRAPHY;
    if (normalized === 'cie' || normalized.includes('cienc')) return Subject.SCIENCE;
    if (normalized === 'ing' || normalized.includes('ingl') || normalized.includes('engl')) return Subject.ENGLISH;
    if (normalized === 'art' || normalized.includes('art')) return Subject.ARTS;
    if (normalized === 'rel' || normalized.includes('relig')) return Subject.RELIGIOUS_ED;
    if (normalized === 'fis' && !normalized.includes('ed')) return Subject.PHYSICS;
    if (normalized.includes('ed') && (normalized.includes('fis') || normalized === 'ef')) return Subject.PHYSICAL_ED;
    if (normalized === 'bio' || normalized.includes('biol')) return Subject.BIOLOGY;
    if (normalized === 'qui' || normalized.includes('quim')) return Subject.CHEMISTRY;
    if (normalized.includes('empreend') || normalized === 'emp') return Subject.ENTREPRENEURSHIP;
    if (normalized.includes('vida') || normalized === 'pv') return Subject.LIFE_PROJECT;
    if (normalized === 'fil' || normalized.includes('filo')) return Subject.PHILOSOPHY;
    if (normalized === 'soc' || normalized.includes('soci')) return Subject.SOCIOLOGY;
    if (normalized === 'lit' || normalized.includes('liter')) return Subject.LITERATURE;
    if (normalized === 'red' || normalized.includes('redac')) return Subject.WRITING;
    if (normalized === 'esp' || normalized.includes('espa') || normalized.includes('span')) return Subject.SPANISH;
    if (normalized === 'mus' || normalized.includes('musi')) return Subject.MUSIC;
    if (normalized === 'fra' || normalized.includes('fran')) return Subject.FRENCH;

    // 3. Busca na Matriz do Banco (academicSubjects)
    const dbMatch = academicSubjects?.find(s =>
        s.id === subjectStr ||
        s.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, '').trim() === normalized
    );
    if (dbMatch) return dbMatch.id;

    return subjectStr; // Mantém original se não houver mapeamento (para log de erro no scan)
};

/**
 * [DISPLAY LAYER]
 * Retorna o nome amigável de uma disciplina baseado EXTERNAMENTE no banco de dados.
 * Arquitetura Estrita: Não usa heurísticas. Se não encontrar no banco, exibe o ID bruto.
 */
export const getSubjectLabel = (subjectId: string, academicSubjects?: AcademicSubject[]): string => {
    if (!subjectId) return '-';

    // 1. Busca na lista vinda do banco (Fonte da Verdade)
    const academicSubject = academicSubjects?.find(s => s.id === subjectId);
    if (academicSubject) {
        return academicSubject.label || academicSubject.name;
    }

    // 2. Fallback para constantes locais (apenas se existir no dicionário de auxílio)
    if (SUBJECT_LABELS[subjectId]) {
        return SUBJECT_LABELS[subjectId];
    }

    // 3. Erro Visível: Retorna o ID bruto para sinalizar que o dado está "sujo"
    return subjectId;
};

/**
 * Retorna a sigla da disciplina.
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
