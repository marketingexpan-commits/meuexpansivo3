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
    'Ens. Médio': {
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
    'Zona Norte': {
        name: 'Expansivo - Zona Norte',
        cnpj: '08.693.673/0001-95',
        address: 'Rua Desportista José Augusto de Freitas, 50',
        district: 'Pajuçara',
        city: 'Natal',
        uf: 'RN',
        cep: '59133-310',
        phone: '(84) 99836-2024',
        email: 'diretoria.ZN@expansivo.com.br', // Placeholder/Generic if not found
        professionalTitle: 'Educação Infantil, Ensino Fundamental e Médio',
        authorization: 'Portaria SEEC/RN'
    },
    'Boa Sorte': {
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
    'Extremoz': {
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
    'Quintas': {
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

export const EDUCATION_LEVELS = [
    'Educação Infantil',
    'Fundamental I',
    'Fundamental II',
    'Ensino Médio'
];

export const GRADES_BY_LEVEL = [
    { level: 'Educação Infantil', grades: ['Berçário', 'Nível I', 'Nível II', 'Nível III', 'Nível IV', 'Nível V'] },
    { level: 'Fundamental I', grades: ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'] },
    { level: 'Fundamental II', grades: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
    { level: 'Ensino Médio', grades: ['1ª Série', '2ª Série', '3ª Série'] }
];

export const DEFAULT_SUBJECTS = [
    'Português', 'Matemática', 'História', 'Geografia', 'Ciências',
    'Inglês', 'Ens. Artes', 'Ed. Física', 'Ensino Religioso', 'Redação',
    'Literatura', 'Biologia', 'Física', 'Química', 'Espanhol', 'Filosofia',
    'Sociologia', 'Projeto de Vida', 'Empreendedorismo', 'Música'
];

export const SCHOOL_SHIFTS_LIST = ['Matutino', 'Vespertino'];
export const SCHOOL_CLASSES_LIST = ['A', 'B', 'C', 'D', 'E'];

export const SCHOOL_SHIFTS = [
    { label: 'Matutino', value: 'Matutino' },
    { label: 'Vespertino', value: 'Vespertino' }
];

export const SCHOOL_CLASSES_OPTIONS = [
    { label: 'A', value: 'A' },
    { label: 'B', value: 'B' },
    { label: 'C', value: 'C' },
    { label: 'D', value: 'D' },
    { label: 'E', value: 'E' }
];
