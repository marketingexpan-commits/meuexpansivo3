// src/types.ts

export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  ADMIN = 'ADMIN',
  NONE = 'NONE'
}

export enum SchoolUnit {
  UNIT_1 = 'Boa Sorte',
  UNIT_2 = 'Extremoz',
  UNIT_3 = 'Zona Norte',
  UNIT_4 = 'Quintas'
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
  MUSIC = 'Musicalização'
}

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
  valor_mensalidade?: number;
  isScholarship?: boolean;
}

export interface Teacher {
  id: string;
  cpf: string;
  password: string;
  name: string;
  subjects: Subject[];
  phoneNumber?: string;
  unit: SchoolUnit; // Singular: define a unidade deste registro específico
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
  user: Student | Teacher | Admin | null;
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
  studentStatus: Record<string, AttendanceStatus>; // studentId -> status
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
  phone: string; // Whatsapp formatting
  unit: SchoolUnit;
  segment?: CoordinationSegment; // Segmento de atuação
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
}