
// src/types.ts

export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN',
  COORDINATOR = 'COORDINATOR',
  NONE = 'NONE'
}

export enum SchoolUnit {
  UNIT_1 = 'Boa Sorte',
  UNIT_2 = 'Extremoz',
  UNIT_3 = 'Zona Norte',
  UNIT_4 = 'Quintas'
}

export interface SchoolUnitDetail {
  id: string; // O ID ou o valor do enum (ex: 'Zona Norte')
  fullName: string; // Expansivo - Zona Norte
  cnpj: string;
  address: string;
  phone: string;
  whatsapp: string;
  logoUrl?: string;
  isActive: boolean;
}

export enum SchoolShift {
  MORNING = 'Matutino',
  AFTERNOON = 'Vespertino'
}

export enum SchoolClass {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E'
}

export enum Subject {
  MATH = 'Matemática',
  PORTUGUESE = 'Português',
  HISTORY = 'História',
  SCIENCE = 'Ciências',
  GEOGRAPHY = 'Geografia',
  ENGLISH = 'Inglês',
  ARTS = 'Ens. Artes',
  RELIGIOUS_ED = 'Ens. Religioso',
  PHYSICAL_ED = 'Ed. Física',
  LIFE_PROJECT = 'Projeto de Vida',
  ENTREPRENEURSHIP = 'Empreendedorismo',
  CHEMISTRY = 'Química',
  BIOLOGY = 'Biologia',
  PHYSICS = 'Física',
  SPANISH = 'Espanhol',
  LITERATURE = 'Literatura',
  WRITING = 'Redação',
  PHILOSOPHY = 'Filosofia',
  SOCIOLOGY = 'Sociologia',
  MUSIC = 'Musicalização',
  FRENCH = 'Francês'
}

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
  response?: string;
  responseTimestamp?: string;
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
  mediaAnualApproved?: boolean; // Novo: Controle de exibição da Média Anual
  mediaAnual: number;
  mediaFinal: number;
  situacaoFinal: 'Aprovado' | 'Recuperação' | 'Reprovado' | 'Cursando' | 'Pendente';
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
  receiptId?: string; // Novo: ID do Recibo sincronizado
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
  documentNumber?: string; // Novo: Código de Baixa
  receiptId?: string; // Novo: ID do Recibo sincronizado
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
  studentId?: string;
  teacherId?: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
// --- FIM ---

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
  metodo_pagamento?: 'Isaac' | 'Interno';

  // --- CAMPOS DE LEGADO / FICHA COMPLETA ---
  numero_inscricao?: string;
  data_inicio?: string;
  cpf_aluno?: string;
  situacao?: string;
  alias?: string;
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
  observacoes_saude?: string;

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
  nome_pai?: string;
  nome_mae?: string;
  nome_responsavel?: string;
  cpf_responsavel?: string;
  email_responsavel?: string; // Novo
  telefone_responsavel?: string; // Novo

  // Financeiro
  valor_mensalidade?: number; // Novo

  // Estruturais / Flags
  ficha_saude?: any;
  documentos_entregues?: string[];
  historico_escolar_2025?: string;
  gradeLevelSigla?: string; // New field to preserve original PDF sigla
  isScholarship?: boolean; // Indicates if the student is exempt from monthly fees
  phoneNumber?: string;
  photoUrl?: string; // Base64 or URL for 3x4 student photo
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
  subjects: Subject[];
  phoneNumber?: string;
  unit: SchoolUnit; // Singular: define a unidade deste registro específico
  assignments?: TeacherAssignment[]; // NEW: Linked grade levels and subjects
}

export interface Admin {
  id: string;
  username: string;
  password: string;
  name: string;
  unit?: SchoolUnit;
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
  shift?: string; // NOVO: Turno da chamada
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

// --- NOVAS FUNCIONALIDADES: AGENDA E ROTEIROS ---

export interface DailyAgenda {
  id: string;
  teacherId: string;
  teacherName: string;
  gradeLevel: string; // Série (ex: 9º Ano)
  schoolClass: string; // Turma (ex: A)
  subject: string; // Disciplina
  date: string; // YYYY-MM-DD
  contentInClass: string; // Conteúdo dado em sala
  homework: string; // Tarefa de casa
  timestamp: string;
  unit: SchoolUnit;
}

export interface ExamGuide {
  id: string;
  teacherId: string;
  teacherName: string;
  gradeLevel: string;
  schoolClass: string;
  subject: string;
  examDate: string; // YYYY-MM-DD
  title: string; // ex: Avaliação Mensal 1
  content: string; // Tópicos da prova
  fileUrl?: string; // URL do arquivo PDF anexado
  fileName?: string; // Nome original do arquivo
  timestamp: string;
  unit: SchoolUnit;
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
// End of types definitions

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
  units: string[]; // List of school units (e.g., ['Zona Norte', 'all'])
  targetSegments?: string[]; // Optional: Limit scope to specific segments
  targetGrades?: string[];   // Optional: Limit scope to specific grades
  targetClasses?: string[];  // Optional: Limit scope to specific classes
  substituteDayOfWeek?: number; // Optional: For substitution events
  substituteDayLabel?: string;  // Optional: Label for the substitute day
}

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

export interface BimesterConfig {
  number: number;
  label: string;
  startDate: string;
  endDate: string;
}

export interface AcademicSettings {
  id: string;
  year: number;
  unit: string;
  bimesters: BimesterConfig[];
  currentBimester: number;
  updatedAt: string;
}
