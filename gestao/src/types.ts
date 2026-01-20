
// src/types.ts

export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN',
  COORDINATOR = 'COORDINATOR',
  NONE = 'NONE'
}

export enum SchoolUnit {
  UNIT_BS = 'unit_bs',
  UNIT_EXT = 'unit_ext',
  UNIT_ZN = 'unit_zn',
  UNIT_QUI = 'unit_qui'
}

export const UNIT_LABELS: Record<SchoolUnit, string> = {
  [SchoolUnit.UNIT_BS]: 'Boa Sorte',
  [SchoolUnit.UNIT_EXT]: 'Extremoz',
  [SchoolUnit.UNIT_ZN]: 'Zona Norte',
  [SchoolUnit.UNIT_QUI]: 'Quintas'
};

export interface SchoolUnitDetail {
  id: string; // O ID ou o valor do enum (ex: 'Zona Norte')
  fullName: string; // Expansivo - Zona Norte
  professionalTitle?: string; // NOVO: "Educação Infantil, Ensino Fundamental e Médio"
  cnpj: string;
  address: string;
  district?: string; // NOVO: Bairro
  phone: string;
  whatsapp: string;
  email?: string;
  instagram?: string;
  inepCode?: string;
  city?: string;
  uf?: string;
  cep?: string;
  authorization?: string; // NOVO: Portaria ou Ato de Autorização
  directorName?: string;
  secretaryName?: string;
  pixKey?: string;
  logoUrl?: string;
  isActive: boolean;
}

export enum SchoolShift {
  MORNING = 'shift_morning',
  AFTERNOON = 'shift_afternoon'
}

export const SHIFT_LABELS: Record<SchoolShift, string> = {
  [SchoolShift.MORNING]: 'Matutino',
  [SchoolShift.AFTERNOON]: 'Vespertino'
};

export enum SchoolClass {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E'
}

export enum Subject {
  MATH = 'sub_math',
  PORTUGUESE = 'sub_portuguese',
  HISTORY = 'sub_history',
  SCIENCE = 'sub_science',
  GEOGRAPHY = 'sub_geography',
  ENGLISH = 'sub_english',
  ARTS = 'sub_arts',
  RELIGIOUS_ED = 'sub_religious_ed',
  PHYSICAL_ED = 'sub_physical_ed',
  LIFE_PROJECT = 'sub_life_project',
  ENTREPRENEURSHIP = 'sub_entrepreneurship',
  CHEMISTRY = 'sub_chemistry',
  BIOLOGY = 'sub_biology',
  PHYSICS = 'sub_physics',
  SPANISH = 'sub_spanish',
  LITERATURE = 'sub_literature',
  WRITING = 'sub_writing',
  PHILOSOPHY = 'sub_philosophy',
  SOCIOLOGY = 'sub_sociology',
  MUSIC = 'sub_music',
  FRENCH = 'sub_french'
}

export const SUBJECT_LABELS: Record<Subject, string> = {
  [Subject.MATH]: 'Matemática',
  [Subject.PORTUGUESE]: 'Português',
  [Subject.HISTORY]: 'História',
  [Subject.SCIENCE]: 'Ciências',
  [Subject.GEOGRAPHY]: 'Geografia',
  [Subject.ENGLISH]: 'Inglês',
  [Subject.ARTS]: 'Ens. Artes',
  [Subject.RELIGIOUS_ED]: 'Ens. Religioso',
  [Subject.PHYSICAL_ED]: 'Ed. Física',
  [Subject.LIFE_PROJECT]: 'Projeto de Vida',
  [Subject.ENTREPRENEURSHIP]: 'Empreendedorismo',
  [Subject.CHEMISTRY]: 'Química',
  [Subject.BIOLOGY]: 'Biologia',
  [Subject.PHYSICS]: 'Física',
  [Subject.SPANISH]: 'Espanhol',
  [Subject.LITERATURE]: 'Literatura',
  [Subject.WRITING]: 'Redação',
  [Subject.PHILOSOPHY]: 'Filosofia',
  [Subject.SOCIOLOGY]: 'Sociologia',
  [Subject.MUSIC]: 'Musicalização',
  [Subject.FRENCH]: 'Francês'
};

export const SUBJECT_SHORT_LABELS: Record<Subject, string> = {
  [Subject.MATH]: 'Mat',
  [Subject.PORTUGUESE]: 'Port',
  [Subject.HISTORY]: 'His',
  [Subject.SCIENCE]: 'Ciên',
  [Subject.GEOGRAPHY]: 'Geo',
  [Subject.ENGLISH]: 'Ing',
  [Subject.ARTS]: 'Art',
  [Subject.RELIGIOUS_ED]: 'Rel',
  [Subject.PHYSICAL_ED]: 'E.F.',
  [Subject.LIFE_PROJECT]: 'P.V.',
  [Subject.ENTREPRENEURSHIP]: 'Emp',
  [Subject.CHEMISTRY]: 'Quí',
  [Subject.BIOLOGY]: 'Bio',
  [Subject.PHYSICS]: 'Fís',
  [Subject.SPANISH]: 'Esp',
  [Subject.LITERATURE]: 'Lit',
  [Subject.WRITING]: 'Red',
  [Subject.PHILOSOPHY]: 'Fil',
  [Subject.SOCIOLOGY]: 'Soc',
  [Subject.MUSIC]: 'Mús',
  [Subject.FRENCH]: 'Fran'
};

// NOVO: Tipos para o sistema de mensagens
export enum MessageRecipient {
  COORDINATION = 'Coordenação',
  TEACHERS = 'Professores',
  DIRECTION = 'Diretoria',
}

export interface AcademicSubject {
  id: string;      // Firestore ID
  name: string;    // Display name (e.g., "Matemática")
  shortName?: string; // Abbreviation (e.g., "MAT")
  isActive: boolean;
  order?: number;   // For sorting in reports/logs
  weeklyHours?: Record<string, number>; // Mapping: gradeName -> hoursPerWeek
}

export interface AcademicSegment {
  id: string;
  name: string; // e.g., "Ensino Médio"
  isActive: boolean;
  order: number;
}

export interface AcademicGrade {
  id: string;
  segmentId: string; // Foreign key to AcademicSegment
  name: string;      // e.g., "1ª Série"
  isActive: boolean;
  order: number;
}

export enum MessageType {
  COMPLIMENT = 'Elogio',
  SUGGESTION = 'Sugestão',
  COMPLAINT = 'Reclamação',
}

export interface SchoolMessage {
  id: string;
  studentId: string;
  studentName: string;
  unit: SchoolUnit;
  recipient: MessageRecipient;
  messageType: MessageType;
  content: string;
  timestamp: string; // ISO String for Firebase compatibility
  status: 'new' | 'read';
}


export interface BimesterData {
  nota: number | null;
  recuperacao: number | null;
  media: number;
  faltas: number;
  difficultyTopic?: string;
  isApproved?: boolean; // Legado: Indica se o bimestre foi aprovado
  isNotaApproved?: boolean; // Novo: Indica se a nota (N) foi aprovada
  isRecuperacaoApproved?: boolean; // Novo: Indica se a recuperação (R) foi aprovada
}

export interface GradeEntry {
  id: string;
  studentId: string;
  teacherId?: string; // ID do professor que lançou a nota
  subject: string;
  bimesters: {
    bimester1: BimesterData;
    bimester2: BimesterData;
    bimester3: BimesterData;
    bimester4: BimesterData;
  };
  recuperacaoFinal?: number | null;
  recuperacaoFinalApproved?: boolean; // Novo: Indica se a recuperação final foi aprovada
  mediaAnual: number;
  mediaFinal: number;
  situacaoFinal: 'Aprovado' | 'Recuperação' | 'Reprovado';
  situacao?: string;
  year?: number;
  subjectId?: string;
  lastUpdated: string;
}

export interface Mensalidade {
  id: string;
  studentId: string;
  month: string;
  value: number;
  dueDate: string;
  status: 'Pago' | 'Pendente' | 'Atrasado';
  lastUpdated: string;
  paymentDate?: string;
  receiptUrl?: string;
  paymentMethod?: string; // Novo: 'pix', 'credit_card', 'bolbradesco', etc.
  documentNumber?: string; // Novo: Código de Baixa (6 dígitos)
  paidValue?: number; // Novo: Valor total pago
  interestValue?: number; // Juros
  penaltyValue?: number; // Multa
  barcode?: string; // Código de Barras (44 dígitos)
  digitableLine?: string; // Linha digitável (47-48 caracteres)
  ticketUrl?: string; // URL do PDF do Boleto
  qrCode?: string; // Payload do PIX (Copia e Cola)
  qrCodeBase64?: string; // Imagem do QR Code Base64
  receiptId?: string; // Novo: ID do Recibo sincronizado
  mpPaymentId?: string; // Novo: ID do Pagamento no Mercado Pago
}

export interface EventoFinanceiro {
  id: string;
  studentId: string;
  description: string;
  value: number;
  dueDate: string;
  status: 'Pago' | 'Pendente' | 'Atrasado';
  lastUpdated: string;
  type: 'Evento' | 'Extra';
  paymentDate?: string;
  paymentMethod?: string;
  documentNumber?: string;
  receiptId?: string;
}

export interface Expense {
  id: string;
  description: string;
  category: string; // "Aluguel", "Salários", "Material", etc.
  value: number;
  dueDate: string; // ISO ou DD/MM/YYYY
  paymentDate?: string;
  status: 'Pendente' | 'Pago';
  unit: SchoolUnit;
  createdAt: any;
}

// --- NOVOS TIPOS PARA RELATÓRIO DA EDUCAÇÃO INFANTIL ---

export enum CompetencyStatus {
  NOT_OBSERVED = 'Não Observado',
  IN_PROCESS = 'Em Processo',
  DEVELOPED = 'Desenvolvido',
}

export interface Competency {
  id: string;
  description: string;
  status: CompetencyStatus | null;
}

export interface ExperienceField {
  id: string;
  name: string;
  competencies: Competency[];
}

export interface EarlyChildhoodReport {
  id: string; // Formato: studentId_semester_year
  studentId: string;
  semester: 1 | 2;
  year: number;
  fields: ExperienceField[];
  teacherObservations?: string;
  lastUpdated: string;
}

// --- FIM DOS NOVOS TIPOS ---

export interface ClassMaterial {
  id: string;
  title: string;
  url: string;
  filename: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  unit: SchoolUnit;
  gradeLevel: string;
  schoolClass: string;
  shift: string; // Novo: Turno do material
  timestamp: string;
}

// --- NOVOS TIPOS PARA CONTATOS DE LIDERANÇA ---
export enum ContactRole {
  DIRECTOR = 'DIRETOR',
  COORDINATOR = 'COORDENADOR',
  FINANCIAL = 'FINANCEIRO'
}

export enum CoordinationSegment {
  INFANTIL_FUND1 = 'infantil_fund1',
  FUND2_MEDIO = 'fund2_medio',
  GERAL = 'geral'
}

export interface UnitContact {
  id: string;
  name: string;
  phoneNumber: string; // Formato com DDD (ex: 5584999999999)
  phone?: string; // Backwards compatibility if needed, or unify to phone
  email?: string;
  role: ContactRole | string; // Allow string for legacy/flexibility
  unit: SchoolUnit;
  segment?: CoordinationSegment;
  password?: string; // Added for Coordinator Access Control
}
// --- FIM ---

// --- NOVO: TIPO PARA NOTIFICAÇÕES ---
export interface AppNotification {
  id: string;
  studentId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
// --- FIM ---

export interface HealthInfo {
  // Condições Médicas (Arrays para Checkboxes)
  doencas_cronicas?: string[]; // Ex: Asma, Diabetes
  doencas_cronicas_outra?: string;

  deficiencias?: string[];
  deficiencias_outra?: string;

  doencas_contraidas?: string[]; // Catapora, etc.
  doencas_contraidas_outra?: string;

  vacinas?: string[];
  vacinas_outra?: string;

  alergias?: string;
  medicamentos_continuos?: string; // Tratamento atual

  // Emergência
  contato_emergencia_nome?: string;
  contato_emergencia_fone?: string;
  hospital_preferencia?: string;
  medico_particular?: string;
  medico_telefone?: string;

  // Orientações
  instrucoes_febre?: string;
  plano_saude_nome?: string;
  plano_saude_numero?: string;
  observacoes_adicionais?: string;
}

export interface Student {
  id: string;
  code: string;
  password: string;
  name: string;
  gradeLevel: string;
  schoolClass: SchoolClass;
  shift: SchoolShift;
  unit: SchoolUnit;
  isBlocked: boolean;
  createdAt?: string;
  updatedAt?: string;
  metodo_pagamento?: 'Isaac' | 'Interno';

  // --- CAMPOS DE LEGADO / FICHA COMPLETA ---
  numero_inscricao?: string;
  data_inicio?: string;
  cpf_aluno?: string;
  situacao?: string;

  alias?: string; // Nome Social ou Apelido
  socialName?: string; // Explicitar Nome Social separate do alias se desejar, ou usar alias. Vou adicionar para clareza e mapear UI.
  nacionalidade?: string;
  naturalidade?: string;
  uf_naturalidade?: string;
  data_nascimento?: string;
  identidade_rg?: string;
  rg_emissor?: string;
  sexo?: string;
  rg_numero_registro?: string;
  rg_livro?: string;
  rg_folha?: string;
  rg_cartorio?: string;
  data_registro?: string;
  data_desligamento?: string;
  procedencia_escolar?: string;
  ensino_religioso?: string;
  religiao?: string;
  bolsa_percentual?: string;
  autorizacao_saida?: string;
  autorizacao_bolsa?: string; // Novo: Quem autorizou a bolsa
  observacoes_saude?: string;
  observacoes_gerais?: string; // Novo: Obs gerais

  // Documentação Civil Detalhada
  certidao_tipo?: 'Nascimento' | 'Casamento';
  certidao_numero?: string;
  certidao_livro?: string;
  certidao_folha?: string;
  certidao_cartorio?: string;
  certidao_data_emissao?: string;

  // Endereço
  cep?: string;
  endereco_logradouro?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_uf?: string;
  telefone_contato?: string;
  localizacao_tipo?: 'Urbana' | 'Rural';

  // Família e Responsáveis

  // Filiação - Detalhada
  nome_pai?: string;
  pai_profissao?: string;
  pai_nacionalidade?: string;
  pai_naturalidade?: string;
  pai_local_trabalho?: string;
  pai_telefone?: string;
  pai_renda_mensal?: string;

  nome_mae?: string;
  mae_profissao?: string;
  mae_nacionalidade?: string;
  mae_naturalidade?: string;
  mae_naturalidade_uf?: string; // Add UF for mother
  mae_local_trabalho?: string;
  mae_telefone?: string;
  mae_renda_mensal?: string;

  // Responsável Financeiro
  nome_responsavel?: string;
  rg_responsavel?: string; // Add RG for responsible
  cpf_responsavel?: string;
  email_responsavel?: string;
  telefone_responsavel?: string;

  // Alias / Novos campos para compatibilidade
  financialResponsible?: string;
  phone?: string;
  contactPhone?: string;

  // Financeiro
  valor_mensalidade?: number; // Novo

  // Estruturais / Flags
  ficha_saude?: HealthInfo;
  documentos_entregues?: string[];
  historico_escolar_2025?: string;
  gradeLevelSigla?: string; // New field to preserve original PDF sigla
  isScholarship?: boolean; // Indicates if the student is exempt from monthly fees
  phoneNumber?: string;
  photoUrl?: string; // Base64 or URL for 3x4 student photo
  status?: 'CURSANDO' | 'TRANSFERIDO' | 'EVADIDO' | 'TRANCADO' | 'RESERVADO' | 'REPROVADO' | 'APROVADO' | 'ATIVO' | 'INATIVO' | 'CONCLUÍDO';
  nis?: string; // NIS for Bolsa Família
  segment?: string; // NOVO: Segmento acadêmico (Infantil, Fundamental I, etc)
}


export interface TeacherAssignment {
  gradeLevel: string;
  subjects: string[];
}

export interface Teacher {
  id: string;
  cpf: string;
  password: string;
  name: string;
  subjects: string[]; // Changed to string[] to match dynamic subjects names
  gradeLevels: string[]; // NEW: List of grades/series the teacher is responsible for
  email?: string; // NEW
  phoneNumber?: string;
  unit: SchoolUnit;
  isBlocked: boolean; // NEW: Access control
  assignments?: TeacherAssignment[]; // NEW: Linked grade levels and subjects
  createdAt?: string;
  updatedAt?: string;
}

export interface Admin {
  id: string;
  username: string;
  password: string;
  name: string;
  unit?: SchoolUnit | 'admin_geral';
  roleType?: 'gestao' | 'student_app'; // New field to distinguish admin type
}

export interface UserSession {
  role: UserRole;
  user: Student | Teacher | Admin | UnitContact | null;
}

// NOVO: Tipos para o sistema de chamada
export enum AttendanceStatus {
  PRESENT = 'Presente',
  ABSENT = 'Faltou',
}

export interface AttendanceRecord {
  id: string; // Formato: YYYY-MM-DD_UNIT_GRADELEVEL_CLASS
  date: string; // Formato: YYYY-MM-DD
  unit: SchoolUnit;
  gradeLevel: string;
  schoolClass: SchoolClass;
  teacherId: string;
  teacherName: string;
  discipline: string; // Disciplina da chamada to allow subject-specific absences
  studentStatus: Record<string, AttendanceStatus>; // studentId -> status
  lessonCount?: number; // Quantidade de aulas (ex: 2 para aula geminada)
  shift?: string; // Turno da chamada
  studentAbsenceCount?: Record<string, number>; // studentId -> número de faltas (sobrescreve padrão se houver)
}

// NOVO: Tipos para o sistema de Tickets (Dúvidas)
export enum TicketStatus {
  PENDING = 'pendente',
  ANSWERED = 'respondido'
}

export interface Ticket {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: string; // Série
  schoolClass: string; // Turma
  unit: SchoolUnit;
  subject: string;
  message: string;
  response?: string;
  timestamp: string; // ISO
  responseTimestamp?: string; // ISO
  status: TicketStatus;
  responderName?: string; // Nome do professor que respondeu
}



export interface AcademicHistoryRecord {
  id: string;
  year: string;
  gradeLevel: string; // e.g. "6º Ano", "1ª Série"
  schoolName: string;
  cityState: string;
  status: string; // "Aprovado", "Reprovado", "Cursando"
  average?: string | null; // Optional final grade
  attendance?: string | null; // Optional attendance percentage
  totalHours?: string | null; // Optional total hours
  observation?: string | null;
  subjects?: { // Added for detailed grades
    name: string;
    grade: string;
    status: string;
    ch?: string | null; // Carga Horária
    b1?: string | null;
    b2?: string | null;
    b3?: string | null;
    b4?: string | null;
  }[];
}

export interface Student {
  // ... (existing fields)
  academicHistory?: AcademicHistoryRecord[];
}

// --- SISTEMA DE OCORRÊNCIAS ---

export enum OccurrenceCategory {
  PEDAGOGICAL = 'Pedagógica',
  DISCIPLINARY = 'Disciplinar',
  POSITIVE = 'Elogio/Positiva',
  HEALTH = 'Saúde',
  OTHER = 'Outra'
}

export interface Occurrence {
  id: string;
  studentId: string;
  studentName: string;
  gradeLevel: string;
  schoolClass: string;
  shift: string;
  unit: SchoolUnit;
  category: OccurrenceCategory;
  title: string;
  description: string;
  date: string; // ISO ou YYYY-MM-DD
  authorId: string;
  authorName: string;
  authorRole: string;
  isReadByStudent: boolean;
  timestamp: any; // Firebase server timestamp ou ISO
}

export const OCCURRENCE_TEMPLATES: Record<string, string[]> = {
  infantil_fund1: [
    'Dificuldade de acompanhamento pedagógico',
    'Conflito interpessoal em sala',
    'Falta de material escolar',
    'Excelente participação em aula',
    'Mal estar súbito',
    'Atraso recorrente'
  ],
  fund2_medio: [
    'Uso inadequado de celular/eletrônico',
    'Indisciplina em sala de aula',
    'Falta de entrega de atividades',
    'Destaque acadêmico / Olimpíadas',
    'Conversa excessiva durante explicações',
    'Saída antecipada sem justificativa'
  ]
};
// --- SISTEMA DE GRADE HORÁRIA ---

export interface ScheduleItem {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  subject: string;
}

export interface ClassSchedule {
  id?: string;
  schoolId: string; // Unidade
  grade: string;    // Série
  class: string;    // Turma
  shift: string;    // Turno
  dayOfWeek: number; // 1-5 (Seg-Sex)
  items: ScheduleItem[];
  lastUpdated: string;
}

export type EventType =
  | 'event'
  | 'school_day'
  | 'substitution'
  | 'holiday_national'
  | 'holiday_state'
  | 'holiday_municipal'
  | 'vacation'
  | 'recess'
  | 'meeting'
  | 'exam';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string; // ISO (YYYY-MM-DD)
  endDate?: string;
  type: EventType;
  units: string[];
  substituteDayOfWeek?: number; // 0-6 (0=Sun, 1=Mon, etc.)
  substituteDayLabel?: string; // e.g., "Segunda-feira"
  targetSegments?: string[]; // e.g. ["Ensino Médio"]
  targetGrades?: string[]; // e.g. ["1ª Série - Ensino Médio"]
  targetClasses?: string[]; // e.g. ["A", "B"]
  targetSubjectIds?: string[]; // NEW: Granular subject filtering
  targetShifts?: string[]; // NEW: Granular shift filtering
  createdAt?: string;
  updatedAt?: string;
}

export interface BimesterConfig {
  number: 1 | 2 | 3 | 4;
  startDate: string; // ISO (YYYY-MM-DD)
  endDate: string; // ISO (YYYY-MM-DD)
  label: string;
}

export interface AcademicSettings {
  id: string;
  year: number;
  unit: SchoolUnit | 'all'; // 'all' for network default, or specific unit ID
  currentBimester: 1 | 2 | 3 | 4;
  bimesters: BimesterConfig[];
  updatedAt?: string;
}

export interface MuralItem {
  id: string;
  type: 'flyer' | 'file'; // flyer = imagem destaqye, file = download
  title: string;
  url: string;
  date?: string; // Para arquivos (ex: 10/12/2024)
  size?: string; // Para arquivos (ex: 450 KB)
  order: number;
  isActive: boolean;
  createdAt: string;
}
