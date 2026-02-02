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
}

export interface GradeEntry {
  id: string;
  studentId: string;
  subject: string;
  bimesters: {
    bimester1: BimesterData;
    bimester2: BimesterData;
    bimester3: BimesterData;
    bimester4: BimesterData;
  };
  recuperacaoFinal?: number | null;
  mediaAnual: number;
  mediaFinal: number;
  situacaoFinal: 'Aprovado' | 'Recuperação' | 'Reprovado';
  lastUpdated: string;
}

export type StudentStatus = 'CURSANDO' | 'TRANSFERIDO' | 'EVADIDO' | 'TRANCADO' | 'RESERVADO' | 'REPROVADO' | 'APROVADO' | 'ATIVO' | 'INATIVO' | 'CONCLUÍDO';

export interface Student {
  id: string;
  code: string;
  password: string;
  name: string;
  phoneNumber?: string;
  gradeLevel: string;
  gradeId?: string; // NEW: ID of the grade (e.g., 'grade_4_ano') for robust matching
  schoolClass: SchoolClass;
  valor_mensalidade?: number;
  isScholarship?: boolean;
  status?: StudentStatus;
}

export interface Teacher {
  id: string;
  cpf: string;
  password: string;
  name: string;
  subjects: Subject[];
  phoneNumber?: string;
  unit: SchoolUnit; // Singular: define a unidade deste registro específico
  gradeLevels?: string[]; // Legacy: List of grade strings
  gradeIds?: string[]; // NEW: List of grade IDs for robust matching
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
  discipline: string;
  shift?: string;
  studentStatus: Record<string, AttendanceStatus>; // studentId -> status
  lessonCount?: number;
  studentAbsenceCount?: Record<string, number>;
}

export interface EarlyChildhoodReport {
  id: string;
  studentId: string;
  teacherId: string;
  unit: SchoolUnit;
  semester: 1 | 2;
  year: number;
  content: string; // JSON string with specific skills
  timestamp: string;
}

export interface Mensalidade {
  id: string;
  studentId: string;
  month: string; // "Janeiro/2025"
  value: number;
  dueDate: string; // YYYY-MM-DD
  status: 'Pendente' | 'Pago' | 'Atrasado';
  paidDate?: string;
  publicUrl?: string; // Link do recibo/fatura
  lastUpdated?: string;
}

export interface EventoFinanceiro {
  id?: string;
  title: string;
  description?: string;
  value: number;
  dueDate: string; // YYYY-MM-DD ou ISO
  unit?: SchoolUnit;
  active: boolean;
}

export interface AppNotification {
  id: string;
  studentId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// NOVO: Tipos para Segmentação da Coordenação (Solicitado)
export enum CoordinationSegment {
  INFANTIL_FUND1 = 'Educação Infantil / Fundamental I',
  FUND2_MEDIO = 'Fundamental II / Ensino Médio',
  GERAL = 'Geral (Ambos)'
}

export interface UnitContact {
  id: string;
  name: string;
  role: string; // 'Coordenador', 'Diretor', etc.
  phoneNumber: string; // Whatsapp formatting
  unit: SchoolUnit;
  segment?: CoordinationSegment; // Segmento de atuação
  password?: string; // Senha de acesso para coordenadores
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
  isSupport?: boolean;
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