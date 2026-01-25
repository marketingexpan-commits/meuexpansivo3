// src/constants.ts

import { Student, Teacher, GradeEntry, BimesterData, Admin, SchoolUnit, SchoolShift, SchoolClass, Subject, ExperienceField, AcademicSubject, CurriculumMatrix } from './types';
import { CURRICULUM_MATRIX, ACADEMIC_GRADES } from './src/utils/academicDefaults';
export { CURRICULUM_MATRIX, ACADEMIC_GRADES };

export const SCHOOL_LOGO_URL = 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';
export const SCHOOL_LOGO_WHITE_URL = 'https://i.postimg.cc/GtV2FsBC/expan-logo-branca-04.png';

// --- CONFIGURAÇÃO DE SEGURANÇA ---
// TRUE = Permite login com dados de teste e mostra a "colinha" na tela de login.
// FALSE = Modo Produção (apenas dados reais do banco, esconde senhas de teste).
export const ALLOW_MOCK_LOGIN = false;

// --- DADOS DE CONTATO DAS UNIDADES ---
export const UNITS_CONTACT_INFO = [
  {
    name: SchoolUnit.UNIT_BS,
    address: 'Av. Boa Sorte, 265 - Nossa Senhora da Apresentação, Natal - RN',
    whatsapp: '5584988277188',
  },
  {
    name: SchoolUnit.UNIT_EXT,
    address: 'Rua do Futebol, 32 - Estivas, Extremoz - RN',
    whatsapp: '5584981863522',
  },
  {
    name: SchoolUnit.UNIT_ZN,
    address: 'Rua Desportista José Augusto de Freitas, 50 - Pajuçara, Natal - RN',
    whatsapp: '5584998362024',
  },
  {
    name: SchoolUnit.UNIT_QUI,
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
const PRIVATE_MOCK_ADMINS: Admin[] = [
  { id: 'a1', username: 'admin_zn', password: 'admin', name: 'Direção Zona Norte', unit: SchoolUnit.UNIT_ZN },
  { id: 'a2', username: 'admin_bs', password: 'admin', name: 'Direção Boa Sorte', unit: SchoolUnit.UNIT_BS },
  { id: 'a3', username: 'admin_ext', password: 'admin', name: 'Direção Extremoz', unit: SchoolUnit.UNIT_EXT },
  { id: 'a4', username: 'admin_qui', password: 'admin', name: 'Direção Quintas', unit: SchoolUnit.UNIT_QUI },
  { id: 'a0', username: 'admin_geral', password: 'admin', name: 'Direção Geral' }
];

export const MOCK_ADMINS: Admin[] = ALLOW_MOCK_LOGIN ? PRIVATE_MOCK_ADMINS : [];

export const DEFAULT_ADMIN_INIT = PRIVATE_MOCK_ADMINS[0];


export const MOCK_STUDENTS: Student[] = ALLOW_MOCK_LOGIN ? [
  {
    id: 's1',
    code: '12345',
    password: '123',
    name: 'João Silva',
    gradeLevel: '8º Ano - Fundamental II',
    schoolClass: SchoolClass.A,
    shift: SchoolShift.MORNING,
    unit: SchoolUnit.UNIT_ZN,
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
    unit: SchoolUnit.UNIT_BS,
    isBlocked: false
  }
] : [];

// --- PROFESSORES MOCKADOS ---
export const MOCK_TEACHERS: Teacher[] = ALLOW_MOCK_LOGIN ? [
  {
    id: 't1',
    cpf: '12345678900',
    password: 'admin',
    name: 'Prof. Carlos Santos (ZN)',
    subjects: [Subject.MATH, Subject.PORTUGUESE],
    phoneNumber: '+5584999999999',
    unit: SchoolUnit.UNIT_ZN
  },
  {
    id: 't2',
    cpf: '11111111111',
    password: 'admin',
    name: 'Prof. Ana Lima (BS)',
    subjects: [Subject.SCIENCE, Subject.BIOLOGY],
    phoneNumber: '+5584988888888',
    unit: SchoolUnit.UNIT_BS
  },
  {
    id: 't3',
    cpf: '22222222222',
    password: 'admin',
    name: 'Prof. Marcos Souza (EXT)',
    subjects: [Subject.HISTORY, Subject.GEOGRAPHY],
    phoneNumber: '+5584977777777',
    unit: SchoolUnit.UNIT_EXT
  },
  {
    id: 't4',
    cpf: '33333333333',
    password: 'admin',
    name: 'Prof. Julia Costa (QUI)',
    subjects: [Subject.ENGLISH, Subject.ARTS],
    phoneNumber: '+5584966666666',
    unit: SchoolUnit.UNIT_QUI
  }
] : [];

export const SCHOOL_UNITS_LIST = Object.values(SchoolUnit);
export const SCHOOL_SHIFTS_LIST = Object.values(SchoolShift);
export const SCHOOL_CLASSES_LIST = Object.values(SchoolClass);


export const calculateBimesterMedia = (bData: BimesterData): BimesterData => {
  // Se não houver nota nem recuperação lançada, a média deve ser um marcador (ex: -1) ou null se o tipo permitir.
  // Como media é number, usaremos -1 para indicar que não há nota lançada ainda.
  if ((bData.nota === null || bData.nota === undefined) && (bData.recuperacao === null || bData.recuperacao === undefined)) {
    return { ...bData, media: -1 };
  }

  const nota = bData.nota ?? 0;
  const rec = bData.recuperacao ?? 0;
  let media = nota;
  if (rec > 0 && rec > nota) {
    media = rec;
  }
  return { ...bData, media: parseFloat(media.toFixed(1)) };
};

export const calculateFinalData = (bimesters: GradeEntry['bimesters'], recFinal?: number | null, isYearFinished: boolean = false): Pick<GradeEntry, 'mediaAnual' | 'mediaFinal' | 'situacaoFinal' | 'mediaAnualApproved'> => {
  const bimesterMedias = [
    bimesters.bimester1.media,
    bimesters.bimester2.media,
    bimesters.bimester3.media,
    bimesters.bimester4.media,
  ];

  const hasAllMedias = bimesterMedias.every(m => m !== undefined && m !== null && m >= 0);
  const validMedias = bimesterMedias.filter(m => m !== undefined && m !== null && m >= 0) as number[];

  // Se não houver nenhuma nota em nenhum bimestre, a situação é 'Cursando'
  // IMPORTANTE: Retornar -1 para que a UI exiba o traço '-'
  if (validMedias.length === 0) {
    return { mediaAnual: -1, mediaFinal: -1, situacaoFinal: 'Cursando' };
  }

  const totalMedias = validMedias.reduce((sum, current) => sum + current, 0);

  // Média Anual: No Expansivo a média é a soma dos 4 bimestres dividida por 4.
  // Só exibimos se o ano acabou OU se já temos as 4 notas.
  let mediaAnual = parseFloat((totalMedias / 4).toFixed(1));
  const showAverages = isYearFinished || hasAllMedias;

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
      // Se já temos as 4 notas e a média < 7, está em Recuperação Final.
      // Se não temos as 4 notas e o ano não acabou, está Cursando.
      if (hasAllMedias || isYearFinished) {
        situacaoFinal = 'Recuperação';
      } else {
        situacaoFinal = 'Cursando';
      }
    }
  }

  // Se não for para mostrar as médias ainda, retornamos -1 como marcador
  // UPDATE: User requested to show calculation always.
  const finalMediaAnual = mediaAnual;
  const finalMediaFinal = (showAverages && (mediaAnual >= 7.0 || (recFinal !== undefined && recFinal !== null))) ? mediaFinal : -1;

  // STRICT APPROVAL CHECK: Annual average is approved ONLY if all component bimesters are fully approved by coordinator.
  const allBimestersApproved = [
    bimesters.bimester1,
    bimesters.bimester2,
    bimesters.bimester3,
    bimesters.bimester4
  ].every(b => b.isNotaApproved !== false && b.isRecuperacaoApproved !== false);

  const mediaAnualApproved = showAverages && allBimestersApproved;

  return {
    mediaAnual: finalMediaAnual,
    mediaFinal: finalMediaFinal,
    situacaoFinal,
    mediaAnualApproved // Automatically calculated based on bimester approvals
  };
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

export const FINAL_GRADES_CALCULATED: GradeEntry[] = ALLOW_MOCK_LOGIN ? INITIAL_GRADES_MOCK.map(grade => {
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
  } as GradeEntry;
}) : [];

// --- HELPER PARA OBTER MATÉRIAS DA MATRIZ ---

export const getCurriculumSubjects = (
  gradeLevel: string,
  stockSubjects?: AcademicSubject[],
  matrices?: CurriculumMatrix[],
  unit?: string,
  shift?: string,
  gradeNameLegacy?: string,
  getFullListFallback: boolean = false
): string[] => {
  // 1. Strict Matrix Lookup (Priority)
  // Tries to match by ID or Name (fuzzy) to ensure robustness
  if (matrices && unit && shift) {
    // 1a. Identify the canonical Grade ID for the student's grade level string
    const gradeEntry = Object.values(ACADEMIC_GRADES).find(g =>
      gradeLevel === g.label ||
      gradeLevel.includes(g.label) ||
      (g.label.includes('Ano') && gradeLevel.includes(g.label))
    );
    const targetGradeId = gradeEntry ? gradeEntry.id : '';

    const matchingMatrix = matrices.find(m => {
      const unitMatch = m.unit === unit || m.unit === 'all';
      const shiftMatch = m.shift === shift || m.shift === 'all';
      // Robust grade match: Match by ID or Label
      const gradeMatch = (gradeLevel && m.gradeId) ?
        (m.gradeId === targetGradeId || m.gradeId === gradeLevel || gradeLevel.includes(m.gradeId) || m.gradeId.includes(gradeLevel)) :
        false;
      return unitMatch && shiftMatch && gradeMatch;
    });

    if (matchingMatrix) {
      return matchingMatrix.subjects
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(s => s.id);
    }
  }

  // 2. Fallback: "Disciplinas diretamente associadas à turma"
  // If no matrix, check if we have stock subjects with weeklyHours for this grade
  if (stockSubjects && stockSubjects.length > 0) {
    const searchName = gradeNameLegacy || gradeLevel;

    const heuristicSubjects = stockSubjects.filter(s => {
      if (!s.isActive) return false;
      // Legacy check: weeklyHours usage
      if (s.weeklyHours) {
        const hasHours = Object.keys(s.weeklyHours).some(k =>
          searchName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(searchName.toLowerCase())
        );
        if (hasHours) return true;
      }
      return false;
    });

    if (heuristicSubjects.length > 0) {
      console.warn('getCurriculumSubjects: Running in Fallback Mode (Legacy WeeklyHours)', { searchName, count: heuristicSubjects.length });
      return heuristicSubjects
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(s => s.id);
    }

    // 3. Ultimate Fallback: Return ALL active subjects if absolutely nothing matched
    // This ensures "O sistema NÃO pode exibir boletim vazio" rule.
    console.warn('getCurriculumSubjects: Running in Ultimate Fallback Mode (All Active)', { searchName });
    return stockSubjects.filter(s => s.isActive !== false).map(s => s.id);
  }

  return [];
};



export const SCHOOL_CLASSES_OPTIONS = [
  { label: 'A', value: 'A' },
  { label: 'B', value: 'B' },
  { label: 'C', value: 'C' },
  { label: 'D', value: 'D' },
  { label: 'E', value: 'E' }
];

export const SCHOOL_SHIFTS = [
  { label: 'Matutino', value: 'Matutino' },
  { label: 'Vespertino', value: 'Vespertino' }
];

import { CalendarEvent } from './types';

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  { id: 'ev1', title: 'Início do Ano Letivo', startDate: '2026-01-19', type: 'event', description: 'Boas-vindas aos alunos e responsáveis.', units: ['all'] },
  { id: 'ev2', title: 'Carnaval', startDate: '2026-02-16', endDate: '2026-02-18', type: 'recess', description: 'Recesso escolar.', units: ['all'] },
  { id: 'ev3', title: 'Prova de Matemática - 1º Bimestre', startDate: '2026-03-20', type: 'exam', description: 'Conteúdo: Razões e Proporções.', units: ['all'] },
  { id: 'ev4', title: 'Reunião de Pais e Mestres', startDate: '2026-04-10', type: 'meeting', description: 'Entrega de boletins do 1º Bimestre.', units: ['all'] },
  { id: 'ev5', title: 'Dia do Trabalho', startDate: '2026-05-01', type: 'holiday_national', units: ['all'] },
  { id: 'ev6', title: 'Festa Junina', startDate: '2026-06-21', type: 'event', description: 'Grande arraiá do Expansivo.', units: ['all'] },
  { id: 'ev7', title: 'Férias Escolares', startDate: '2026-07-01', endDate: '2026-07-31', type: 'vacation', units: ['all'] },
  { id: 'ev8', title: 'Independência do Brasil', startDate: '2026-09-07', type: 'holiday_national', units: ['all'] },
  { id: 'ev9', title: 'Semana de Provas Finais', startDate: '2026-11-23', endDate: '2026-11-27', type: 'exam', units: ['all'] },
  { id: 'ev10', title: 'Encerramento do Ano Letivo', startDate: '2026-12-15', type: 'event', units: ['all'] }
];
