
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
  isApproved?: boolean; // Legado: Indica se o bimestre foi aprovado
  isNotaApproved?: boolean; // Novo: Indica se a nota (N) foi aprovada
  isRecuperacaoApproved?: boolean; // Novo: Indica se a recuperação (R) foi aprovada
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
  barcode?: string; // Linha digitável do Boleto
  ticketUrl?: string; // URL do PDF do Boleto
  qrCode?: string; // Payload do PIX (Copia e Cola)
  qrCodeBase64?: string; // Imagem do QR Code Base64
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
  email_responsavel?: string;
  telefone_responsavel?: string;

  // Alias / Novos campos para compatibilidade
  financialResponsible?: string;
  phone?: string;
  contactPhone?: string;

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
  status?: 'CURSANDO' | 'TRANSFERIDO' | 'EVADIDO' | 'TRANCADO' | 'RESERVADO' | 'REPROVADO' | 'APROVADO' | 'ATIVO' | 'INATIVO';
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

// --- CONSTANTES DO SISTEMA DE ENSINO ---

export const EDUCATION_LEVELS = [
  { label: 'Educação Infantil', value: 'Educação Infantil' },
  { label: 'Fundamental I', value: 'Fundamental I' },
  { label: 'Fundamental II', value: 'Fundamental II' },
  { label: 'Ensino Médio', value: 'Ensino Médio' }
];

export const GRADES_BY_LEVEL: Record<string, string[]> = {
  'Educação Infantil': ['Nível I', 'Nível II', 'Nível III', 'Nível IV', 'Nível V'],
  'Fundamental I': ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'],
  'Fundamental II': ['6º Ano', '7º Ano', '8º Ano', '9º Ano'],
  'Ensino Médio': ['1ª Série', '2ª Série', '3ª Série']
};

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
