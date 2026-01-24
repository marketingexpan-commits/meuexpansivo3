import { Subject } from "../types";

export const CURRICULUM_MATRIX: Record<string, Record<string, number>> = {
    'Fundamental I': {
        [Subject.PORTUGUESE]: 4,
        [Subject.MATH]: 4,
        [Subject.SCIENCE]: 2,
        [Subject.GEOGRAPHY]: 2,
        [Subject.HISTORY]: 2,
        [Subject.ENGLISH]: 2,
        [Subject.ARTS]: 2, // Ens. Artes
        [Subject.SPANISH]: 1,
        [Subject.PHILOSOPHY]: 1,
        [Subject.LIFE_PROJECT]: 1,
        [Subject.MUSIC]: 1
    },
    'Fundamental II': {
        [Subject.MATH]: 4,
        [Subject.PORTUGUESE]: 4,
        [Subject.HISTORY]: 2,
        [Subject.GEOGRAPHY]: 2,
        [Subject.SCIENCE]: 2,
        [Subject.ENGLISH]: 1,
        [Subject.SPANISH]: 1,
        [Subject.FRENCH]: 1,
        [Subject.ARTS]: 1, // Ens. Artes
        [Subject.WRITING]: 1,
        [Subject.PHYSICAL_ED]: 1,
        [Subject.LIFE_PROJECT]: 1
    },
    'Ensino Médio': {
        [Subject.PORTUGUESE]: 2,
        [Subject.MATH]: 4,
        [Subject.PHYSICS]: 4,
        [Subject.BIOLOGY]: 2,
        [Subject.HISTORY]: 2,
        [Subject.GEOGRAPHY]: 2,
        [Subject.SOCIOLOGY]: 1,
        [Subject.PHILOSOPHY]: 2,
        [Subject.CHEMISTRY]: 2,
        [Subject.LITERATURE]: 2,
        [Subject.WRITING]: 2,
        [Subject.ENGLISH]: 1,
        [Subject.SPANISH]: 1,
        [Subject.LIFE_PROJECT]: 0,
        [Subject.ENTREPRENEURSHIP]: 0
    }
};

export const UNIT_DETAILS: Record<string, {
    name: string,
    cnpj: string,
    address: string,
    phone: string,
    email?: string,
    district?: string,
    city?: string,
    uf?: string,
    cep?: string,
    professionalTitle?: string,
    authorization?: string
}> = {
    'unit_zn': {
        name: 'Expansivo - Zona Norte',
        cnpj: '08.693.673/0001-95',
        address: 'Rua Desportista José Augusto de Freitas, 50',
        district: 'Pajuçara',
        city: 'Natal',
        uf: 'RN',
        cep: '59133-310',
        phone: '(84) 99836-2024',
        email: 'diretoria.ZN@expansivo.com.br',
        professionalTitle: 'Educação Infantil, Ensino Fundamental e Médio',
        authorization: 'Portaria SEEC/RN'
    },
    'unit_bs': {
        name: 'Expansivo - Boa Sorte',
        cnpj: '08.693.673/0002-76',
        address: 'Av. Boa Sorte, 265',
        district: 'Nossa Senhora da Apresentação',
        city: 'Natal',
        uf: 'RN',
        cep: '59114-150',
        phone: '(84) 98827-7188',
        email: 'contato.bs@expansivo.com.br',
        professionalTitle: 'Educação Infantil, Ensino Fundamental e Médio',
        authorization: 'Portaria SEEC/RN'
    },
    'unit_ext': {
        name: 'Expansivo - Extremoz',
        cnpj: '08.693.673/0003-57',
        address: 'Rua do Futebol, 32',
        district: 'Estivas',
        city: 'Extremoz',
        uf: 'RN',
        cep: '59575-000',
        phone: '(84) 98186-3522',
        email: 'expansivoextremoz@gmail.com',
        professionalTitle: 'Educação Infantil, Ensino Fundamental e Médio',
        authorization: 'Portaria SEEC/RN'
    },
    'unit_qui': {
        name: 'Expansivo - Quintas',
        cnpj: '08.693.673/0004-38',
        address: 'Rua Coemaçu, 1045',
        district: 'Quintas',
        city: 'Natal',
        uf: 'RN',
        cep: '59035-130',
        phone: '(84) 99954-0167',
        email: 'expansivo.quintas@gmail.com',
        professionalTitle: 'Educação Infantil, Ensino Fundamental e Médio',
        authorization: 'Portaria SEEC/RN'
    }
};

export const ACADEMIC_SEGMENTS = {
    INFANTIL: { id: 'seg_infantil', label: 'Educação Infantil', order: 10 },
    FUND_1: { id: 'seg_fund_1', label: 'Fundamental I', order: 20 },
    FUND_2: { id: 'seg_fund_2', label: 'Fundamental II', order: 30 },
    MEDIO: { id: 'seg_medio', label: 'Ensino Médio', order: 40 }
};

export const ACADEMIC_GRADES = {
    // Infantil
    BERCARIO: { id: 'grade_bercario', segmentId: ACADEMIC_SEGMENTS.INFANTIL.id, label: 'Berçário', order: 1 },
    NIVEL_1: { id: 'grade_nivel_1', segmentId: ACADEMIC_SEGMENTS.INFANTIL.id, label: 'Nível I', order: 2 },
    NIVEL_2: { id: 'grade_nivel_2', segmentId: ACADEMIC_SEGMENTS.INFANTIL.id, label: 'Nível II', order: 3 },
    NIVEL_3: { id: 'grade_nivel_3', segmentId: ACADEMIC_SEGMENTS.INFANTIL.id, label: 'Nível III', order: 4 },
    NIVEL_4: { id: 'grade_nivel_4', segmentId: ACADEMIC_SEGMENTS.INFANTIL.id, label: 'Nível IV', order: 5 },
    NIVEL_5: { id: 'grade_nivel_5', segmentId: ACADEMIC_SEGMENTS.INFANTIL.id, label: 'Nível V', order: 6 },
    // Fund 1
    ANO_1: { id: 'grade_1_ano', segmentId: ACADEMIC_SEGMENTS.FUND_1.id, label: '1º Ano', order: 11 },
    ANO_2: { id: 'grade_2_ano', segmentId: ACADEMIC_SEGMENTS.FUND_1.id, label: '2º Ano', order: 12 },
    ANO_3: { id: 'grade_3_ano', segmentId: ACADEMIC_SEGMENTS.FUND_1.id, label: '3º Ano', order: 13 },
    ANO_4: { id: 'grade_4_ano', segmentId: ACADEMIC_SEGMENTS.FUND_1.id, label: '4º Ano', order: 14 },
    ANO_5: { id: 'grade_5_ano', segmentId: ACADEMIC_SEGMENTS.FUND_1.id, label: '5º Ano', order: 15 },
    // Fund 2
    ANO_6: { id: 'grade_6_ano', segmentId: ACADEMIC_SEGMENTS.FUND_2.id, label: '6º Ano', order: 21 },
    ANO_7: { id: 'grade_7_ano', segmentId: ACADEMIC_SEGMENTS.FUND_2.id, label: '7º Ano', order: 22 },
    ANO_8: { id: 'grade_8_ano', segmentId: ACADEMIC_SEGMENTS.FUND_2.id, label: '8º Ano', order: 23 },
    ANO_9: { id: 'grade_9_ano', segmentId: ACADEMIC_SEGMENTS.FUND_2.id, label: '9º Ano', order: 24 },
    // Médio
    SERIE_1: { id: 'grade_1_ser', segmentId: ACADEMIC_SEGMENTS.MEDIO.id, label: '1ª Série', order: 31 },
    SERIE_2: { id: 'grade_2_ser', segmentId: ACADEMIC_SEGMENTS.MEDIO.id, label: '2ª Série', order: 32 },
    SERIE_3: { id: 'grade_3_ser', segmentId: ACADEMIC_SEGMENTS.MEDIO.id, label: '3ª Série', order: 33 }
};

export const EDUCATION_LEVELS = Object.values(ACADEMIC_SEGMENTS).map(s => s.label);

export const GRADES_BY_LEVEL = Object.values(ACADEMIC_SEGMENTS).map(seg => ({
    level: seg.label,
    segmentId: seg.id,
    grades: Object.values(ACADEMIC_GRADES)
        .filter(g => g.segmentId === seg.id)
        .map(g => g.label)
}));

export const SUBJECTS_DATA = {
    PORTUGUESE: { id: 'sub_portuguese', label: 'Português' },
    MATH: { id: 'sub_math', label: 'Matemática' },
    HISTORY: { id: 'sub_history', label: 'História' },
    GEOGRAPHY: { id: 'sub_geography', label: 'Geografia' },
    SCIENCE: { id: 'sub_science', label: 'Ciências' },
    ENGLISH: { id: 'sub_english', label: 'Inglês' },
    ARTS: { id: 'sub_arts', label: 'Ens. Artes' },
    PHYSICAL_ED: { id: 'sub_physical_ed', label: 'Ed. Física' },
    RELIGIOUS_ED: { id: 'sub_religious_ed', label: 'Ensino Religioso' },
    WRITING: { id: 'sub_writing', label: 'Redação' },
    LITERATURE: { id: 'sub_literature', label: 'Literatura' },
    BIOLOGY: { id: 'sub_biology', label: 'Biologia' },
    PHYSICS: { id: 'sub_physics', label: 'Física' },
    CHEMISTRY: { id: 'sub_chemistry', label: 'Química' },
    SPANISH: { id: 'sub_spanish', label: 'Espanhol' },
    PHILOSOPHY: { id: 'sub_philosophy', label: 'Filosofia' },
    SOCIOLOGY: { id: 'sub_sociology', label: 'Sociologia' },
    LIFE_PROJECT: { id: 'sub_life_project', label: 'Projeto de Vida' },
    ENTREPRENEURSHIP: { id: 'sub_entrepreneurship', label: 'Empreendedorismo' },
    MUSIC: { id: 'sub_music', label: 'Música' }
};

export const DEFAULT_SUBJECTS = Object.values(SUBJECTS_DATA).map(s => s.label);

export const SCHOOL_SHIFTS_LIST = ['Matutino', 'Vespertino'];
export const SCHOOL_CLASSES_LIST = ['A', 'B', 'C', 'D', 'E'];

export const SCHOOL_SHIFTS = [
    { label: 'Matutino', value: 'shift_morning' },
    { label: 'Vespertino', value: 'shift_afternoon' }
];

export const SCHOOL_CLASSES_OPTIONS = [
    { label: 'A', value: 'A' },
    { label: 'B', value: 'B' },
    { label: 'C', value: 'C' },
    { label: 'D', value: 'D' },
    { label: 'E', value: 'E' }
];
