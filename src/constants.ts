// src/constants.ts

import { Student, Teacher, GradeEntry, BimesterData, Admin, SchoolUnit, SchoolShift, SchoolClass, Subject } from './types';

export const SCHOOL_LOGO_URL = 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';
export const SCHOOL_LOGO_WHITE_URL = 'https://i.postimg.cc/GtV2FsBC/expan-logo-branca-04.png';

// --- DADOS DAS UNIDADES ---
export const UNITS_DATA: Record<string, { address: string; cep: string; phone: string; email: string; cnpj: string }> = {
  'Zona Norte': {
    address: 'Rua Desportista José Augusto de Freitas, 50 - Pajuçara, Natal - RN',
    cep: '59133-400',
    phone: '(84) 3661-4742',
    email: 'contato.zn@expansivo.com.br',
    cnpj: '08.693.673/0001-95'
  },
  'Boa Sorte': {
    address: 'Av. Boa Sorte, 265 - Nossa Senhora da Apresentação, Natal - RN',
    cep: '59114-250',
    phone: '(84) 3661-4742',
    email: 'contato.bs@expansivo.com.br',
    cnpj: '08.693.673/0002-76'
  },
  'Extremoz': {
    address: 'Rua do Futebol, 32 - Estivas, Extremoz - RN',
    cep: '59575-000',
    phone: '(84) 98186-3522',
    email: 'expansivoextremoz@gmail.com',
    cnpj: '08.693.673/0003-57'
  },
  'Quintas': {
    address: 'Rua Coemaçu, 1045 - Quintas, Natal - RN',
    cep: '59035-060',
    phone: '(84) 3653-1063',
    email: 'contato.quintas@expansivo.com.br',
    cnpj: '08.693.673/0004-38'
  }
};

export const DEFAULT_UNIT_DATA = {
  address: 'Expansivo Rede de Ensino - Matriz',
  cep: '59000-000',
  phone: '(84) 3232-0000',
  email: 'contato@expansivo.com.br',
  cnpj: '00.000.000/0001-00'
};

// --- CONFIGURAÇÃO DE SEGURANÇA ---
// TRUE = Permite login com dados de teste e mostra a "colinha" na tela de login.
// FALSE = Modo Produção (apenas dados reais do banco, esconde senhas de teste).
export const ALLOW_MOCK_LOGIN = false;

// --- ADMINISTRADORES ---
// SENHAS SIMPLIFICADAS PARA TESTE E ACESSO IMEDIATO
export const MOCK_ADMINS: Admin[] = [
  { id: 'a1', username: 'admin_zn', password: 'admin', name: 'Direção Zona Norte', unit: SchoolUnit.UNIT_3 },
  { id: 'a2', username: 'admin_bs', password: 'admin', name: 'Direção Boa Sorte', unit: SchoolUnit.UNIT_1 },
  { id: 'a3', username: 'admin_ext', password: 'admin', name: 'Direção Extremoz', unit: SchoolUnit.UNIT_2 },
  { id: 'a4', username: 'admin_qui', password: 'admin', name: 'Direção Quintas', unit: SchoolUnit.UNIT_4 },
  { id: 'a0', username: 'admin_geral', password: 'admin', name: 'Direção Geral' }
];

export const DEFAULT_ADMIN_INIT = MOCK_ADMINS[0];


// --- CURRÍCULOS CENTRALIZADOS ---
// Garantir que os nomes batam EXATAMENTE com o Subject enum em types.ts


export const MOCK_STUDENTS: Student[] = [
  {
    id: 's1',
    code: '12345',
    password: '123',
    name: 'João Silva',
    gradeLevel: '8º Ano - Fundamental II',
    schoolClass: SchoolClass.A,
    shift: SchoolShift.MORNING,
    unit: SchoolUnit.UNIT_3,
    isBlocked: false
  },
  {
    id: 's2',
    code: '67890',
    password: '123',
    name: 'Maria Oliveira',
    gradeLevel: '9º Ano - Fundamental II',
    schoolClass: SchoolClass.B,
    shift: SchoolShift.AFTERNOON,
    unit: SchoolUnit.UNIT_1,
    isBlocked: false
  }
];

// --- PROFESSORES MOCKADOS ---
export const MOCK_TEACHERS: Teacher[] = [
  {
    id: 't1',
    cpf: '12345678900',
    password: 'admin',
    name: 'Prof. Carlos Santos (ZN)',
    subjects: [Subject.MATH, Subject.PORTUGUESE],
    phoneNumber: '+5584999999999',
    unit: SchoolUnit.UNIT_3
  },
  {
    id: 't2',
    cpf: '11111111111',
    password: 'admin',
    name: 'Prof. Ana Lima (BS)',
    subjects: [Subject.SCIENCE, Subject.BIOLOGY],
    phoneNumber: '+5584988888888',
    unit: SchoolUnit.UNIT_1
  },
  {
    id: 't3',
    cpf: '22222222222',
    password: 'admin',
    name: 'Prof. Marcos Souza (EXT)',
    subjects: [Subject.HISTORY, Subject.GEOGRAPHY],
    phoneNumber: '+5584977777777',
    unit: SchoolUnit.UNIT_2
  },
  {
    id: 't4',
    cpf: '33333333333',
    password: 'admin',
    name: 'Prof. Julia Costa (QUI)',
    subjects: [Subject.ENGLISH, Subject.ARTS],
    phoneNumber: '+5584966666666',
    unit: SchoolUnit.UNIT_4
  }
];

export const SCHOOL_UNITS_LIST = Object.values(SchoolUnit);
export const SCHOOL_SHIFTS_LIST = Object.values(SchoolShift);
export const SCHOOL_CLASSES_LIST = Object.values(SchoolClass);


export const calculateBimesterMedia = (bData: BimesterData): BimesterData => {
  const nota = bData.nota ?? 0;
  const rec = bData.recuperacao ?? 0;
  let media = nota;
  if (rec > 0 && rec > nota) {
    media = rec;
  }
  return { ...bData, media: parseFloat(media.toFixed(1)) };
};

export const calculateFinalData = (bimesters: GradeEntry['bimesters'], recFinal?: number | null) => {
  const bimesterMedias = [
    bimesters.bimester1.media,
    bimesters.bimester2.media,
    bimesters.bimester3.media,
    bimesters.bimester4.media,
  ].filter(m => m !== undefined && m !== null) as number[];

  const totalMedias = bimesterMedias.reduce((sum, current) => sum + current, 0);
  const mediaAnual = parseFloat((totalMedias / 4).toFixed(1));

  let mediaFinal = mediaAnual;
  let situacaoFinal: GradeEntry['situacaoFinal'] = 'Aprovado';

  if (mediaAnual >= 7.0) {
    situacaoFinal = 'Aprovado';
  } else {
    if (recFinal !== undefined && recFinal !== null) {
      mediaFinal = parseFloat(((mediaAnual + recFinal) / 2).toFixed(1));

      if (mediaFinal >= 5.0) {
        situacaoFinal = 'Aprovado';
      } else {
        situacaoFinal = 'Reprovado';
      }
    } else {
      situacaoFinal = 'Recuperação';
    }
  }

  return { mediaAnual, mediaFinal, situacaoFinal };
}

export const INITIAL_GRADES_MOCK: GradeEntry[] = [
  {
    id: 'g1', studentId: 's1', subject: 'Matemática',
    bimesters: {
      bimester1: { nota: 6.5, recuperacao: 7.0, media: 0, faltas: 2, difficultyTopic: 'Fração e Números Decimais' },
      bimester2: { nota: 8.0, recuperacao: null, media: 0, faltas: 1 },
      bimester3: { nota: 7.5, recuperacao: null, media: 0, faltas: 0 },
      bimester4: { nota: 6.0, recuperacao: 8.5, media: 0, faltas: 3 },
    },
    recuperacaoFinal: null,
    lastUpdated: '20251205T1634',
    mediaAnual: 0, mediaFinal: 0, situacaoFinal: 'Reprovado',
  },
  {
    id: 'g2', studentId: 's1', subject: 'Português',
    bimesters: {
      bimester1: { nota: 9.0, recuperacao: null, media: 0, faltas: 0 },
      bimester2: { nota: 8.5, recuperacao: null, media: 0, faltas: 1, difficultyTopic: 'Concordância verbal' },
      bimester3: { nota: 9.0, recuperacao: null, media: 0, faltas: 0 },
      bimester4: { nota: 8.0, recuperacao: null, media: 0, faltas: 2 },
    },
    recuperacaoFinal: null,
    lastUpdated: '20251205T1634',
    mediaAnual: 0, mediaFinal: 0, situacaoFinal: 'Reprovado',
  },
  {
    id: 'g3', studentId: 's1', subject: 'Geografia',
    bimesters: {
      bimester1: { nota: 5.0, recuperacao: 6.0, media: 0, faltas: 4, difficultyTopic: 'estude mais antigo egito!' },
      bimester2: { nota: 7.0, recuperacao: null, media: 0, faltas: 1 },
      bimester3: { nota: null, recuperacao: null, media: 0, faltas: 0 },
      bimester4: { nota: null, recuperacao: null, media: 0, faltas: 0 },
    },
    recuperacaoFinal: null,
    lastUpdated: '20251205T1634',
    mediaAnual: 0, mediaFinal: 0, situacaoFinal: 'Reprovado',
  }
];

export const FINAL_GRADES_CALCULATED: GradeEntry[] = INITIAL_GRADES_MOCK.map(grade => {
  const calculatedBimesters: GradeEntry['bimesters'] = {
    bimester1: calculateBimesterMedia(grade.bimesters.bimester1),
    bimester2: calculateBimesterMedia(grade.bimesters.bimester2),
    bimester3: calculateBimesterMedia(grade.bimesters.bimester3),
    bimester4: calculateBimesterMedia(grade.bimesters.bimester4),
  };
  const finalData = calculateFinalData(calculatedBimesters, grade.recuperacaoFinal);
  return {
    ...grade,
    bimesters: calculatedBimesters,
    ...finalData,
  };
});

// --- MATRIZ CURRICULAR (AULAS POR SEMANA) ---
export const CURRICULUM_MATRIX: Record<string, Record<string, number>> = {
  'Fundamental I': {
    [Subject.PORTUGUESE]: 4,
    [Subject.MATH]: 4,
    [Subject.SCIENCE]: 2,
    [Subject.GEOGRAPHY]: 2,
    [Subject.HISTORY]: 2,
    [Subject.ENGLISH]: 2,
    [Subject.ARTS]: 2,
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
    [Subject.ARTS]: 1,
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