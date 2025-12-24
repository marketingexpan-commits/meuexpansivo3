// src/constants.ts

import { Student, Teacher, GradeEntry, BimesterData, Admin, SchoolUnit, SchoolShift, SchoolClass, Subject, ExperienceField } from './types';

export const SCHOOL_LOGO_URL = 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';
export const SCHOOL_LOGO_WHITE_URL = 'https://i.postimg.cc/GtV2FsBC/expan-logo-branca-04.png';

// --- CONFIGURAÇÃO DE SEGURANÇA ---
// TRUE = Permite login com dados de teste e mostra a "colinha" na tela de login.
// FALSE = Modo Produção (apenas dados reais do banco, esconde senhas de teste).
export const ALLOW_MOCK_LOGIN = false;

// --- DADOS DE CONTATO DAS UNIDADES ---
export const UNITS_CONTACT_INFO = [
  {
    name: SchoolUnit.UNIT_1,
    address: 'Av. Boa Sorte, 265 - Nossa Senhora da Apresentação, Natal - RN',
    whatsapp: '5584988277188',
  },
  {
    name: SchoolUnit.UNIT_2,
    address: 'Rua do Futebol, 32 - Estivas, Extremoz - RN',
    whatsapp: '5584981863522',
  },
  {
    name: SchoolUnit.UNIT_3,
    address: 'Rua Desportista José Augusto de Freitas, 50 - Pajuçara, Natal - RN',
    whatsapp: '5584998362024',
  },
  {
    name: SchoolUnit.UNIT_4,
    address: 'Rua Coemaçu, 1045 - Quintas, Natal - RN',
    whatsapp: '5584999540167',
  }
];

// --- MODELO PARA RELATÓRIO DE EDUCAÇÃO INFANTIL (BNCC) ---
export const EARLY_CHILDHOOD_REPORT_TEMPLATE: ExperienceField[] = [
  {
    id: 'cg_mov',
    name: 'Corpo, Gestos e Movimentos',
    competencies: [
      { id: 'cg_mov_1', description: 'APROPRIA-SE DE GESTOS E MOVIMENTOS DE SUA CULTURA NO CUIDADO DE SI E NOS JOGOS E BRINCADEIRAS.', status: null },
      { id: 'cg_mov_2', description: 'DESLOCA SEU CORPO NO ESPAÇO, ORIENTANDO-SE POR NOÇÕES COMO EM FRENTE, ATRÁS, NO ALTO, EMBAIXO, DENTRO, FORA, ETC..., AO SE ENVOLVER EM BRINCADEIRAS E ATIVIDADES DE DIFERENTES NATUREZAS.', status: null },
      { id: 'cg_mov_3', description: 'EXPLORA FORMAS DE DESLOCAMENTO NO ESPAÇO (PULAR, SALTAR, DANÇAR), COMBINANDO MOVIMENTOS E SEGUINDO ORIENTAÇÕES.', status: null },
      { id: 'cg_mov_4', description: 'DESENVOLVE PROGRESSIVAMENTE AS HABILIDADES MANUAIS, ADQUIRINDO CONTROLE PARA DESENHAR, PINTAR, RASGAR, FOLHEAR, ENTRE OUTROS.', status: null },
    ],
  },
  {
    id: 'eu_outro_nos',
    name: 'O Eu, o Outro e o Nós',
    competencies: [
      { id: 'eon_1', description: 'DEMONSTRA ATITUDES DE CUIDADO E SOLIDARIEDADE NA INTERAÇÃO COM CRIANÇAS E ADULTOS.', status: null },
      { id: 'eon_2', description: 'COMUNICA SUAS IDEIAS E SENTIMENTOS A PESSOAS E GRUPOS DIVERSOS.', status: null },
      { id: 'eon_3', description: 'AGE DE MANEIRA INDEPENDENTE, COM CONFIANÇA EM SUAS CAPACIDADES, RECONHECENDO SUAS CONQUISTAS E LIMITAÇÕES.', status: null },
    ]
  },
  {
    id: 'tracos_sons',
    name: 'Traços, Sons, Cores e Formas',
    competencies: [
      { id: 'tscf_1', description: 'UTILIZA SONS PRODUZIDOS POR MATERIAIS, OBJETOS E INSTRUMENTOS MUSICAIS DURANTE BRINCADEIRAS DE FAZ DE CONTA, ENCENAÇÕES, CRIAÇÕES MUSICAIS E FESTAS.', status: null },
      { id: 'tscf_2', description: 'EXPRESSA-SE LIVREMENTE POR MEIO DE DESENHO, PINTURA, COLAGEM, DOBRADURA E ESCULTURA, CRIANDO PRODUÇÕES BIDIMENSIONAIS E TRIDIMENSIONAIS.', status: null },
    ]
  },
  {
    id: 'escuta_fala',
    name: 'Escuta, Fala, Pensamento e Imaginação',
    competencies: [
      { id: 'efpi_1', description: 'EXPRESSA IDEIAS, DESEJOS E SENTIMENTOS SOBRE SUAS VIVÊNCIAS, POR MEIO DA LINGUAGEM ORAL E ESCRITA (ESCRITA ESPONTÂNEA), DE FOTOS, DESENHOS E OUTRAS FORMAS DE EXPRESSÃO.', status: null },
      { id: 'efpi_2', description: 'RECONTA HISTÓRIAS OUVIDAS E PLANEJA COLETIVAMENTE ROTEIROS DE VÍDEOS E DE ENCENAÇÕES, DEFININDO OS CONTEXTOS, OS PERSONAGENS, A ESTRUTURA DA HISTÓRIA.', status: null },
    ]
  },
  {
    id: 'espacos_tempos',
    name: 'Espaços, Tempos, Quantidades, Relações e Transformações',
    competencies: [
      { id: 'etqrt_1', description: 'ESTABELECE RELAÇÕES DE COMPARAÇÃO ENTRE OBJETOS, OBSERVANDO SUAS PROPRIEDADES.', status: null },
      { id: 'etqrt_2', description: 'REGISTRA OBSERVAÇÕES, MANIPULAÇÕES E MEDIDAS, USANDO MÚLTIPLAS LINGUAGENS (DESENHO, REGISTRO POR NÚMEROS OU ESCRITA ESPONTÂNEA), EM DIFERENTES SUPORTES.', status: null },
    ]
  }
];


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

export const SCHOOL_GRADES_LIST = [
  'Nível I - Edu. Infantil', 'Nível II - Edu. Infantil', 'Nível III - Edu. Infantil', 'Nível IV - Edu. Infantil', 'Nível V - Edu. Infantil',
  '1º Ano - Fundamental I', '2º Ano - Fundamental I', '3º Ano - Fundamental I', '4º Ano - Fundamental I', '5º Ano - Fundamental I',
  '6º Ano - Fundamental II', '7º Ano - Fundamental II', '8º Ano - Fundamental II', '9º Ano - Fundamental II',
  '1ª Série - Ens. Médio', '2ª Série - Ens. Médio', '3ª Série - Ens. Médio'
];

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

export const SUBJECT_LIST = Object.values(Subject);
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
