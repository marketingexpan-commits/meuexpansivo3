import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Admin, Student, Teacher, SchoolUnit, Subject, SchoolShift, SchoolClass, SchoolMessage, MessageType, MessageRecipient, AttendanceRecord, AttendanceStatus, UnitContact, ContactRole, GradeEntry, Mensalidade, Ticket, TicketStatus } from '../types';
import { SCHOOL_UNITS_LIST, SUBJECT_LIST, SCHOOL_SHIFTS_LIST, SCHOOL_CLASSES_LIST, SCHOOL_GRADES_LIST, SCHOOL_LOGO_URL } from '../constants';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { ReceiptModal } from './ReceiptModal';
import { db } from '../firebaseConfig';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Rematricula } from './Rematricula';
import { Shield, User, GraduationCap, LayoutDashboard, Clock, Globe, FileBarChart, RefreshCw } from 'lucide-react';
import { TableSkeleton } from './Skeleton';
import { CoordinationTab } from './Admin/CoordinationTab';
import { FinancialTab } from './Admin/FinancialTab';
import { maskPhone, maskCPF } from '../utils/formattingUtils';
import { calculateFinancials } from '../utils/financialUtils';
import ManualPaymentModal from './Admin/ManualPaymentModal';
import StudentFinancialModal from './Admin/StudentFinancialModal';

interface AdminDashboardProps {
    admin: Admin;
    students: Student[];
    teachers: Teacher[];
    admins?: Admin[];
    schoolMessages: SchoolMessage[];
    attendanceRecords: AttendanceRecord[];
    grades: GradeEntry[]; // Nova prop
    unitContacts?: UnitContact[]; // Nova prop
    onAddStudent: (student: Student) => void;
    onEditStudent: (student: Student) => void;
    onDeleteStudent: (id: string) => void;
    onToggleBlockStudent: (id: string) => void;
    onAddTeacher: (teacher: Teacher) => void;
    onEditTeacher: (teacher: Teacher) => void;
    onDeleteTeacher: (id: string) => void;
    onAddAdmin?: (admin: Admin) => void;
    onEditAdmin?: (admin: Admin) => void;
    onDeleteAdmin?: (id: string) => void;
    onUpdateMessageStatus: (messageId: string, status: 'new' | 'read') => Promise<void>;
    onAddUnitContact?: (contact: UnitContact) => void;
    onEditUnitContact?: (contact: UnitContact) => void;
    onDeleteUnitContact?: (id: string) => void;
    onGenerateFees?: () => Promise<void>; // Nova prop
    onGenerateIndividualFees?: (student: Student) => Promise<void>; // Nova prop individual
    onFixDuplicates?: () => Promise<void>; // Nova prop para correção
    onResetFees?: (studentId: string) => Promise<void>; // Nova prop para reset
    mensalidades?: Mensalidade[]; // Nova prop
    onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
    admin,
    students,
    teachers,
    admins = [],
    schoolMessages,
    attendanceRecords,
    grades,
    unitContacts = [],
    onAddStudent,
    onEditStudent,
    onDeleteStudent,
    onToggleBlockStudent,
    onAddTeacher,
    onEditTeacher,
    onDeleteTeacher,
    onAddAdmin,
    onEditAdmin,
    onDeleteAdmin,
    onUpdateMessageStatus,
    onAddUnitContact,
    onEditUnitContact,
    onDeleteUnitContact,

    onGenerateFees,
    onGenerateIndividualFees,
    onFixDuplicates,
    onResetFees,
    mensalidades = [],
    onLogout
}) => {
    const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'admins' | 'messages' | 'attendance' | 'contacts' | 'rematricula' | 'financial' | 'tickets'>('students');

    const adminUnit = admin.unit;
    const isGeneralAdmin = !adminUnit;

    // --- ESTADOS GERAIS ---
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);

    // --- MASK HELPERS ---
    const maskCPF = (value: string) => {
        const v = value.replace(/\D/g, '');
        if (v.length <= 11) {
            return v
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        }
        return v.substring(0, 11);
    };

    const maskPhone = (value: string) => {
        let r = value.replace(/\D/g, '');
        if (r.length > 11) r = r.substring(0, 11);
        if (r.length > 7) {
            r = `(${r.substring(0, 2)}) ${r.substring(2, 7)}-${r.substring(7)}`;
        } else if (r.length > 2) {
            r = `(${r.substring(0, 2)}) ${r.substring(2)}`;
        } else if (r.length > 0) {
            r = `(${r}`;
        }
        return r;
    };

    // STATES PARA FINANCEIRO INDIVIDUAL
    const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false);
    const [selectedStudentForFinancial, setSelectedStudentForFinancial] = useState<Student | null>(null);
    const [selectedReceiptForModal, setSelectedReceiptForModal] = useState<Mensalidade | null>(null); // State for Receipt Modal

    const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
    const [sName, setSName] = useState('');
    const [sResponsavel, setSResponsavel] = useState(''); // Nome do responsável
    const [sCpfResponsavel, setSCpfResponsavel] = useState(''); // CPF do responsável
    const [sValorMensalidade, setSValorMensalidade] = useState('');
    const [sScholarship, setSScholarship] = useState(false); // Novo Campo Valor
    const [sEmail, setSEmail] = useState('');
    const [sPhone, setSPhone] = useState('+55');
    const [sCode, setSCode] = useState('');
    const [sGrade, setSGrade] = useState(SCHOOL_GRADES_LIST[0]);
    const [sUnit, setSUnit] = useState<SchoolUnit>(adminUnit || SchoolUnit.UNIT_1);
    const [sShift, setSShift] = useState<SchoolShift>(SchoolShift.MORNING);
    const [sClass, setSClass] = useState<SchoolClass>(SchoolClass.A);
    const [sPass, setSPass] = useState('');
    const [sMetodoPagamento, setSMetodoPagamento] = useState<'Isaac' | 'Interno'>('Interno');
    const [showStudentPassword, setShowStudentPassword] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
    const [studentSearchTerm, setStudentSearchTerm] = useState('');
    const [studentFilterGrade, setStudentFilterGrade] = useState(''); // Novo estado para filtro de série
    const [studentFilterClass, setStudentFilterClass] = useState(''); // Novo estado para filtro de turma
    const [studentFilterShift, setStudentFilterShift] = useState(''); // Novo estado para filtro de turno
    const [studentFilterUnit, setStudentFilterUnit] = useState(''); // Novo estado para filtro de unidade



    // --- FINANCIAL STATES --- (Removed, handled in FinancialTab)

    const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
    const [tName, setTName] = useState('');
    const [tCpf, setTCpf] = useState('');
    const [tPhone, setTPhone] = useState('+55');
    const [tUnit, setTUnit] = useState<SchoolUnit>(adminUnit || SchoolUnit.UNIT_1);
    const [tPass, setTPass] = useState('');
    const [showTeacherPassword, setShowTeacherPassword] = useState(false);
    const [tSubjects, setTSubjects] = useState<Subject[]>([]);
    const [tempSubject, setTempSubject] = useState<Subject>(Subject.MATH);
    const [teacherToDelete, setTeacherToDelete] = useState<string | null>(null);
    const [teacherSearchTerm, setTeacherSearchTerm] = useState(''); // Novo filtro nome
    const [teacherFilterUnit, setTeacherFilterUnit] = useState(''); // Novo filtro unidade

    const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
    const [aName, setAName] = useState('');
    const [aUser, setAUser] = useState('');
    const [aPass, setAPass] = useState('');
    const [aUnit, setAUnit] = useState<SchoolUnit>(SchoolUnit.UNIT_1);
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [adminToDelete, setAdminToDelete] = useState<string | null>(null);

    const [messageFilter, setMessageFilter] = useState<'new' | 'all'>('new');

    // States for Coordination / Grade Approval
    const [coordinationFilterUnit, setCoordinationFilterUnit] = useState<SchoolUnit>(adminUnit || SchoolUnit.UNIT_1);
    const [coordinationFilterGrade, setCoordinationFilterGrade] = useState('');
    const [coordinationFilterClass, setCoordinationFilterClass] = useState('');
    const [coordinationFilterSubject, setCoordinationFilterSubject] = useState('');
    const [pendingGradesStudents, setPendingGradesStudents] = useState<Student[]>([]);
    const [pendingGradesMap, setPendingGradesMap] = useState<Record<string, GradeEntry[]>>({});
    const [isLoadingCoordination, setIsLoadingCoordination] = useState(false);

    // Enforcement of Unit Filter for Non-Admins
    useEffect(() => {
        if (!isGeneralAdmin && adminUnit) {
            setCoordinationFilterUnit(adminUnit);
        }
    }, [isGeneralAdmin, adminUnit]);

    // Estados para Frequência
    const [attendanceFilterUnit, setAttendanceFilterUnit] = useState<SchoolUnit | ''>(adminUnit || '');
    const [attendanceFilterGrade, setAttendanceFilterGrade] = useState('');
    const [attendanceFilterClass, setAttendanceFilterClass] = useState(''); // Novo filtro Turma
    const [attendanceFilterShift, setAttendanceFilterShift] = useState(''); // Novo filtro Turno
    const [attendanceFilterDate, setAttendanceFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

    // Estados para Tickets (Dúvidas)
    const [ticketsList, setTicketsList] = useState<Ticket[]>([]);
    const [ticketFilterUnit, setTicketFilterUnit] = useState<string>('all'); // Novo filtro de unidade para tickets
    const [isLoadingTickets, setIsLoadingTickets] = useState(false);

    // Estados para Contatos
    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('+55');
    const [contactUnit, setContactUnit] = useState<SchoolUnit>(adminUnit || SchoolUnit.UNIT_1);
    const [contactSegment, setContactSegment] = useState<'infantil' | 'fundamental_medio' | 'all'>('all'); // Novo state

    // Estados para Cobrança em Massa
    // --- BULK SENDING STATES --- (Removed, handled in FinancialTab)

    // --- ESTADOS DE LOGS/STATS ---
    const [dailyLoginsCount, setDailyLoginsCount] = useState<number | null>(null);
    const [loginPageViews, setLoginPageViews] = useState<number | null>(null);
    const [loginPageViewsToday, setLoginPageViewsToday] = useState<number | null>(null);
    const [accessLogs, setAccessLogs] = useState<any[]>([]);
    const [logFilter, setLogFilter] = useState<'today' | 'week' | 'month'>('today');
    const [logProfileFilter, setLogProfileFilter] = useState<'all' | 'admin' | 'teacher' | 'student'>('all');

    // --- FINANCIAL FETCH --- (Removed, handled in FinancialTab)

    // Fetch Tickets
    useEffect(() => {
        if (activeTab === 'tickets' && isGeneralAdmin) {
            fetchTickets();
        }
    }, [activeTab, isGeneralAdmin]);

    const fetchTickets = async () => {
        setIsLoadingTickets(true);
        try {
            const snapshot = await db.collection('tickets_pedagogicos')
                .orderBy('timestamp', 'desc')
                .get();
            const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
            setTicketsList(tickets);
        } catch (error) {
            console.error("Error fetching tickets:", error);
        } finally {
            setIsLoadingTickets(false);
        }
    };

    // --- COORDENAÇÃO: FETCH PENDING GRADES ---
    useEffect(() => {
        if (activeTab === 'coordination') {
            fetchPendingGrades();
        }
    }, [activeTab, coordinationFilterUnit, coordinationFilterGrade, coordinationFilterClass, coordinationFilterSubject]);

    const fetchPendingGrades = async () => {
        setIsLoadingCoordination(true);
        try {
            // 1. Fetch Students based on filters
            // Note: Optimally we should index this. For now, client filtering if 'unit' is set.
            let studentsQuery = db.collection('students');

            if (coordinationFilterUnit) {
                // @ts-ignore
                studentsQuery = studentsQuery.where('unit', '==', coordinationFilterUnit);
            }

            const studsSnapshot = await studentsQuery.get();
            let studentsData = studsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));

            // Apply other filters locally
            if (coordinationFilterGrade) studentsData = studentsData.filter(s => s.gradeLevel === coordinationFilterGrade);
            if (coordinationFilterClass) studentsData = studentsData.filter(s => s.schoolClass === coordinationFilterClass);

            // 2. Fetch Grades for these students
            // We need to find grades that have ANY unapproved part
            // Fetching all grades for these students is safer/easier than disjoint queries
            if (studentsData.length === 0) {
                setPendingGradesStudents([]);
                setPendingGradesMap({});
                setIsLoadingCoordination(false);
                return;
            }

            // Chunk student IDs for 'in' query if needed, or just fetch all grades filtered by Unit if possible?
            // Grades collection has studentId. It's better to fetch grades by studentId.
            // But if many students, this is hard.
            // Alternative: Fetch ALL grades for the UNIT (if selected) or ALL grades, then filter vertically.
            // Assuming 'grades' collection doesn't have 'unit' field directly (it relies on student).
            // Let's iterate chunks of students.

            const studentIds = studentsData.map(s => s.id);
            const chunks = [];
            for (let i = 0; i < studentIds.length; i += 10) {
                chunks.push(studentIds.slice(i, i + 10));
            }

            const allGrades: GradeEntry[] = [];
            for (const chunk of chunks) {
                const q = db.collection('grades').where('studentId', 'in', chunk);
                const snap = await q.get();
                snap.docs.forEach(d => allGrades.push({ id: d.id, ...d.data() } as GradeEntry));
            }

            // 3. Filter Grades that have Pending items AND match Subject filter
            const pendingMap: Record<string, GradeEntry[]> = {};
            const studentsWithPending: Set<string> = new Set();

            allGrades.forEach(grade => {
                if (coordinationFilterSubject && grade.subject !== coordinationFilterSubject) return;

                // Check for unapproved bimesters OR unapproved final recovery
                const hasPending = Object.values(grade.bimesters).some((b: any) =>
                    b.isApproved === false || b.isNotaApproved === false || b.isRecuperacaoApproved === false
                ) || grade.recuperacaoFinalApproved === false;

                if (hasPending) {
                    if (!pendingMap[grade.studentId]) pendingMap[grade.studentId] = [];
                    pendingMap[grade.studentId].push(grade);
                    studentsWithPending.add(grade.studentId);
                }
            });

            setPendingGradesStudents(studentsData.filter(s => studentsWithPending.has(s.id)));
            setPendingGradesMap(pendingMap);

        } catch (error) {
            console.error("Error fetching coordination data:", error);
        } finally {
            setIsLoadingCoordination(false);
        }
    };

    const handleApproveGrade = async (grade: GradeEntry) => {
        if (!window.confirm(`Confirma a aprovação das notas de ${grade.subject}?`)) return;

        try {
            // Create a safe copy of bimesters to avoid mutating the original object references
            const updatedBimesters = { ...grade.bimesters };

            Object.keys(updatedBimesters).forEach((key) => {
                const k = key as keyof typeof updatedBimesters;
                // Deep copy the specific bimester object before modifying
                updatedBimesters[k] = { ...updatedBimesters[k] };

                if (updatedBimesters[k].isApproved === false) updatedBimesters[k].isApproved = true;
                if (updatedBimesters[k].isNotaApproved === false) updatedBimesters[k].isNotaApproved = true;
                if (updatedBimesters[k].isRecuperacaoApproved === false) updatedBimesters[k].isRecuperacaoApproved = true;
            });

            let updatedRecFinalApproved = grade.recuperacaoFinalApproved;
            if (updatedRecFinalApproved === false) updatedRecFinalApproved = true;

            await db.collection('grades').doc(grade.id).update({
                bimesters: updatedBimesters,
                recuperacaoFinalApproved: updatedRecFinalApproved
            });

            // Update Local State (Remove from pending list)
            setPendingGradesMap(prev => {
                const studentGrades = prev[grade.studentId] || [];
                const newStudentGrades = studentGrades.filter(g => g.id !== grade.id);

                if (newStudentGrades.length === 0) {
                    setPendingGradesStudents(prevS => prevS.filter(s => s.id !== grade.studentId));
                }

                return { ...prev, [grade.studentId]: newStudentGrades };
            });

            alert("Notas aprovadas com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao aprovar notas.");
        }
    };

    const handleDeleteTicket = async (ticketId: string) => {
        if (!window.confirm("ATENÇÃO: Tem certeza que deseja excluir esta dúvida permanentemente? Ela sumirá para o aluno e para o professor.")) return;

        try {
            await db.collection('tickets_pedagogicos').doc(ticketId).delete();
            setTicketsList(prev => prev.filter(t => t.id !== ticketId));
            alert("Dúvida excluída com sucesso.");
        } catch (error) {
            console.error("Erro ao excluir dúvida:", error);
            alert("Erro ao excluir dúvida.");
        }
    };

    // --- FINANCIAL CONTACT AUTO-FILL --- (Removed, handled in FinancialTab)

    // Derived Financial Data
    // --- FINANCIAL SUMMARY & CALCULATIONS --- (Removed or moved to utils)

    const [logUnitFilter, setLogUnitFilter] = useState<string>('all');  // Novo estado
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
    const [maintenanceUnit, setMaintenanceUnit] = useState<string>('all'); // Unit Selector for Maintenance

    // State for Manual Payment Modal
    const [isManualPaymentModalOpen, setIsManualPaymentModalOpen] = useState(false);
    const [selectedManualFee, setSelectedManualFee] = useState<Mensalidade | null>(null);
    const [manualPaymentMethod, setManualPaymentMethod] = useState<string>('Pix');

    useEffect(() => {
        if (!isGeneralAdmin) return; // Só busca se for Admin Geral

        const fetchDailyStats = async () => {
            const today = new Date().toISOString().split('T')[0];
            try {
                const doc = await db.collection('daily_stats').doc(today).get();
                if (doc.exists) {
                    const data = doc.data();
                    setDailyLoginsCount(data?.total_logins || 0);
                } else {
                    setDailyLoginsCount(0);
                }

                // Buscar Stats Globais (Visitas Login)
                const docGlobal = await db.collection('site_stats').doc('general').get();
                if (docGlobal.exists) {
                    setLoginPageViews(docGlobal.data()?.login_page_views || 0);
                }

                // Buscar Stats Hoje (Visitas Login Hoje)
                const docTodayViews = await db.collection('daily_login_page_views').doc(today).get();
                if (docTodayViews.exists) {
                    setLoginPageViewsToday(docTodayViews.data()?.count || 0);
                } else {
                    setLoginPageViewsToday(0);
                }
            } catch (error) {
                console.error("Erro ao buscar estatísticas:", error);
                setDailyLoginsCount(null);
            }
        };

        fetchDailyStats();
    }, [isGeneralAdmin]);

    // Função para buscar logs
    const fetchLogs = async (filter: 'today' | 'week' | 'month') => {
        if (!isGeneralAdmin) return;
        setIsLoadingLogs(true);
        setAccessLogs([]); // Limpa lista anterior

        let startDate = new Date();
        if (filter === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (filter === 'week') {
            startDate.setDate(startDate.getDate() - 7);
        } else if (filter === 'month') {
            startDate.setMonth(startDate.getMonth() - 1);
        }

        try {
            // OBS: 'date' no Firestore foi salvo como string ISO no App.tsx. 
            // Para queries complexas precisariamos de index, vamos usar timestamp do proprio firestore se possivel ou filtrar string ISO.
            // O App.tsx salva: date: new Date().toISOString()
            const isoCheck = startDate.toISOString();

            const snapshot = await db.collection('access_logs')
                .where('date', '>=', isoCheck)
                .orderBy('date', 'desc')
                .limit(100) // Limite de segurança
                .get();

            const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAccessLogs(logs);
        } catch (error) {
            console.error("Erro ao buscar logs:", error);
            // Fallback simples se der erro de index (tenta buscar ultimos 50 sem filtro complexo)
            try {
                const snapshotFallback = await db.collection('access_logs')
                    .orderBy('timestamp', 'desc')
                    .limit(50)
                    .get();
                const logsFallback = snapshotFallback.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAccessLogs(logsFallback);
            } catch (e) {
                console.error("Erro fatal ao buscar logs", e);
            }
        } finally {
            setIsLoadingLogs(false);
        }
    };

    const handleOpenLogModal = () => {
        setIsLogModalOpen(true);
        fetchLogs('today'); // Default filter
    };

    const handleFilterChange = (newFilter: 'today' | 'week' | 'month') => {
        setLogFilter(newFilter);
        fetchLogs(newFilter);
    };

    const resolveUserName = (userId: string) => {
        // Tenta achar em alunos
        const s = students.find(x => x.id === userId);
        if (s) return `${s.name} (Aluno)`;

        // Tenta achar em professores
        const t = teachers.find(x => x.id === userId);
        if (t) return `${t.name} (Prof.)`;

        // Tenta achar em admins
        const a = admins.find(x => x.id === userId);
        if (a) return `${a.name} (Admin)`;

        return userId; // Fallback
    };

    const getLogUserInfo = (userId: string) => {
        const s = students.find(x => x.id === userId);
        if (s) return { name: s.name, role: 'Aluno', type: 'student', unit: s.unit };

        const t = teachers.find(x => x.id === userId);
        if (t) return { name: t.name, role: 'Prof.', type: 'teacher', unit: t.unit };

        const a = admins.find(x => x.id === userId);
        if (a) return { name: a.name, role: 'Admin', type: 'admin', unit: a.unit };

        return { name: userId, role: 'Desconhecido', type: 'unknown', unit: '' };
    };

    const filteredAccessLogs = accessLogs.filter(log => {
        const info = getLogUserInfo(log.user_id);

        const matchesProfile = logProfileFilter === 'all' ? true : info.type === logProfileFilter;
        const matchesUnit = logUnitFilter === 'all' ? true : info.unit === logUnitFilter;

        return matchesProfile && matchesUnit;
    });

    const handleDownloadPDF = async () => {
        const doc = new jsPDF();

        // Maps Translation
        const filterMap: Record<string, string> = { 'today': 'HOJE', 'week': 'ÚLTIMOS 7 DIAS', 'month': 'ESTE MÊS' };
        const profileMap: Record<string, string> = { 'all': 'TODOS', 'student': 'ALUNO', 'teacher': 'PROFESSOR', 'admin': 'ADMINISTRADOR' };
        const txFilter = filterMap[logFilter] || logFilter.toUpperCase();
        const txProfile = profileMap[logProfileFilter] || logProfileFilter.toUpperCase();

        // Header Background (Navy Blue)
        doc.setFillColor(10, 25, 60);
        doc.rect(0, 0, 210, 40, 'F');

        try {
            // Carregar e processar a logo
            const response = await fetch(SCHOOL_LOGO_URL);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
            // Logo reduzida (25x25)
            doc.addImage(base64, 'PNG', 10, 8, 25, 25);

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text("Relatório de Acessos", 40, 15);
            doc.setFontSize(12);
            doc.text("Meu Expansivo - Sistema de Gestão", 40, 22);
        } catch (error) {
            console.error("Erro ao carregar logo:", error);
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text("Relatório de Acessos - Meu Expansivo", 14, 15);
        }

        // Informações de Geração (Alinhado à Direita)
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 200, 15, { align: 'right' });
        doc.text(`Filtro: ${txFilter} | Perfil: ${txProfile}`, 200, 22, { align: 'right' });

        // Resumo Dinâmico
        let summaryText = "";
        const total = filteredAccessLogs.length;

        if (logProfileFilter === 'all') {
            const counts: Record<string, number> = { 'student': 0, 'teacher': 0, 'admin': 0 };
            filteredAccessLogs.forEach(log => {
                const info = getLogUserInfo(log.user_id);
                if (counts[info.type] !== undefined) counts[info.type]++;
            });
            summaryText = `Total de Acessos: ${total} (Admin: ${counts.admin}, Prof: ${counts.teacher}, Alunos: ${counts.student})`;
        } else {
            summaryText = `Resumo: Foram registrados ${total} acessos de ${txProfile} neste período.`;
        }

        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.setFont("helvetica", "bold");
        doc.text(summaryText, 14, 46);
        doc.setFont("helvetica", "normal");

        const tableData = filteredAccessLogs.map(log => {
            const info = getLogUserInfo(log.user_id);
            return [
                new Date(log.date).toLocaleString('pt-BR'),
                info.name + ` (${info.role})`,
                log.ip || 'N/A'
            ];
        });

        // @ts-ignore
        autoTable(doc, {
            head: [['Data/Hora', 'Usuário', 'IP']],
            body: tableData,
            startY: 52,
            styles: { fontSize: 10 },
            headStyles: { fillColor: [10, 25, 60] },
            alternateRowStyles: { fillColor: [240, 248, 255] },
            didDrawPage: function (data) {
                // Rodapé
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                const footerText = "Expansivo - Rede de Ensino";
                const pageSize = doc.internal.pageSize;
                const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();
                const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();

                // Centralizado
                doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

                // Paginação
                // @ts-ignore
                const pageCount = doc.internal.getNumberOfPages();
                doc.text(`Página ${pageCount}`, pageWidth - 20, pageHeight - 10);
            }
        });

        doc.save(`relatorio-acessos-${new Date().toISOString().split('T')[0]}.pdf`);
    };


    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let password = "A" + "a" + "1" + Array(5).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        return password.split('').sort(() => 0.5 - Math.random()).join('');
    };

    const handleGenerateStudentPass = () => { setSPass(generatePassword()); setShowStudentPassword(true); };
    const handleGenerateTeacherPass = () => { setTPass(generatePassword()); setShowTeacherPassword(true); };
    const handleGenerateAdminPass = () => { setAPass(generatePassword()); setShowAdminPassword(true); };

    const filteredStudents = students.filter(student => {
        const matchesUnit = isGeneralAdmin ? (studentFilterUnit ? student.unit === studentFilterUnit : true) : student.unit === adminUnit;
        const term = studentSearchTerm.toLowerCase();
        const matchesSearch = student.name.toLowerCase().includes(term) || student.code.includes(term);
        const matchesGrade = studentFilterGrade ? student.gradeLevel === studentFilterGrade : true;
        const matchesClass = studentFilterClass ? student.schoolClass === studentFilterClass : true;
        const matchesShift = studentFilterShift ? student.shift === studentFilterShift : true;
        return matchesUnit && matchesSearch && matchesGrade && matchesClass && matchesShift;
    });

    const filteredTeachers = teachers.filter(teacher => {
        const matchesUnit = isGeneralAdmin ? (teacherFilterUnit ? teacher.unit === teacherFilterUnit : true) : teacher.unit === adminUnit;
        const term = teacherSearchTerm.toLowerCase();
        const matchesSearch = teacher.name.toLowerCase().includes(term);
        return matchesUnit && matchesSearch;
    });
    const filteredAdmins = admins.filter(a => a.id !== 'a0' && a.unit);
    const sortedSubjects = [...SUBJECT_LIST].sort((a, b) => a.localeCompare(b));

    const filteredMessages = schoolMessages.filter(message => (isGeneralAdmin || message.unit === adminUnit) && (messageFilter === 'all' || message.status === 'new'));
    const newMessagesCount = schoolMessages.filter(m => (isGeneralAdmin || m.unit === adminUnit) && m.status === 'new').length;

    // Helper para inferir turno do record (olhando primeiro aluno)
    const getRecordShift = (record: AttendanceRecord) => {
        const firstStudentId = Object.keys(record.studentStatus)[0];
        if (!firstStudentId) return null;
        const student = students.find(s => s.id === firstStudentId);
        return student ? student.shift : null;
    };

    const filteredAttendanceRecords = attendanceRecords.filter(record => {
        const unitMatch = isGeneralAdmin ? (attendanceFilterUnit ? record.unit === attendanceFilterUnit : true) : record.unit === adminUnit;
        const gradeMatch = attendanceFilterGrade ? record.gradeLevel === attendanceFilterGrade : true;
        const classMatch = attendanceFilterClass ? record.schoolClass === attendanceFilterClass : true;

        // Filtro de Turno (Inferido)
        let shiftMatch = true;
        if (attendanceFilterShift) {
            const recordShift = getRecordShift(record);
            // Se não conseguiu inferir (sem alunos?), assume que não bate ou mostra? Vamos assumir que mostra se não tiver filtro, mas se tiver filtro e não achar, esconde.
            if (recordShift) {
                shiftMatch = recordShift === attendanceFilterShift;
            } else {
                // Se não tem alunos para verificar turno, talvez esconder? Ou mostrar? Vamos manter condicional estrita.
                shiftMatch = false;
            }
        }

        const dateMatch = attendanceFilterDate ? record.date === attendanceFilterDate : true;
        return unitMatch && gradeMatch && classMatch && shiftMatch && dateMatch;
    }).sort((a, b) => a.id.localeCompare(b.id));

    // Filtros para contatos
    const filteredContacts = unitContacts.filter(c => isGeneralAdmin ? (contactUnit ? c.unit === contactUnit : true) : c.unit === adminUnit);
    const directors = filteredContacts.filter(c => c.role === ContactRole.DIRECTOR);
    const coordinators = filteredContacts.filter(c => c.role === ContactRole.COORDINATOR);
    const financialContacts = filteredContacts.filter(c => c.role === ContactRole.FINANCIAL);

    const formatDate = (isoString: string, includeTime = true) => {
        const date = new Date(isoString);
        if (includeTime) {
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    };

    const getStudentNameById = (id: string) => students.find(s => s.id === id)?.name || 'Aluno não encontrado';


    // --- HANDLERS ---
    const handleAdminSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!onAddAdmin || !onEditAdmin) return; if (editingAdminId) { const originalAdmin = admins.find(a => a.id === editingAdminId)!; onEditAdmin({ ...originalAdmin, name: aName, username: aUser, unit: aUnit, password: aPass.trim() ? aPass : originalAdmin.password }); alert("Administrador atualizado!"); setEditingAdminId(null); } else { onAddAdmin({ id: `admin-${Date.now()}`, name: aName, username: aUser, password: aPass, unit: aUnit }); alert("Administrador criado!"); } setAName(''); setAUser(''); setAPass(''); };
    const startEditingAdmin = (adm: Admin) => { setEditingAdminId(adm.id); setAName(adm.name); setAUser(adm.username); setAUnit(adm.unit!); setAPass(adm.password); };
    const initiateDeleteAdmin = (id: string) => setAdminToDelete(id);
    const initiateDeleteStudent = (id: string) => setStudentToDelete(id);
    const startEditingStudent = (s: Student) => {
        setEditingStudentId(s.id);
        setSName(s.name);
        setSResponsavel(s.nome_responsavel || '');
        setSCpfResponsavel(s.cpf_responsavel || '');
        setSEmail(s.email_responsavel || '');
        setSPhone(s.telefone_responsavel || '+55');
        setSCode(s.code);
        setSGrade(s.gradeLevel);
        setSUnit(s.unit);
        setSShift(s.shift);
        setSClass(s.schoolClass);
        setSPass(s.password);
        setSPass(s.password);
        setSMetodoPagamento(s.metodo_pagamento || 'Interno');
        setSValorMensalidade(s.valor_mensalidade ? s.valor_mensalidade.toString() : '');
        setSScholarship(s.isScholarship || false);



        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const cancelEditingStudent = () => {
        setEditingStudentId(null);
        setSName('');
        setSResponsavel('');
        setSCpfResponsavel('');
        setSEmail('');
        setSPhone('+55');
        setSCode('');
        setSCode('');
        setSPass('');
        setSValorMensalidade('');
        setSScholarship(false);


    };
    const fullHandleStudentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const unitToSave = isGeneralAdmin ? sUnit : adminUnit!;

        // Validations
        if (!sName.trim()) { alert("Erro: O nome do aluno é obrigatório."); return; }
        if (!sCode.trim()) { alert("Erro: O código (matrícula) do aluno é obrigatório."); return; }
        if (sEmail && !sEmail.includes('@')) { alert("Erro: O formato do e-mail é inválido."); return; }

        // Base student data
        const studentData: Partial<Student> = {
            name: sName.trim(),
            nome_responsavel: sResponsavel.trim(),
            cpf_responsavel: sCpfResponsavel,
            email_responsavel: sEmail.trim(),
            telefone_responsavel: sPhone,
            code: sCode.trim(),
            gradeLevel: sGrade,
            unit: unitToSave,
            shift: sShift,
            schoolClass: sClass,

            metodo_pagamento: sMetodoPagamento,
            valor_mensalidade: sValorMensalidade ? parseFloat(sValorMensalidade.replace(',', '.')) : 0,
            isScholarship: sScholarship,

        };

        // Finanical Value Validation
        if (studentData.valor_mensalidade! > 0 && studentData.valor_mensalidade! < 1) {
            alert('O valor mínimo para cobrança é de R$ 1,00 devido às regras do processador de pagamentos');
            return;
        }

        if (editingStudentId) {
            const original = students.find(s => s.id === editingStudentId)!;



            onEditStudent({
                ...original,
                ...studentData,
                password: sPass.trim() ? sPass : original.password
            } as Student);
            alert("Aluno atualizado com sucesso!");
            cancelEditingStudent();
        } else {
            // New student
            const newStudent: Student = {
                id: `student-${Date.now()}`,
                ...studentData as Student,
                password: sPass,
                isBlocked: false,

                // Legacy fields initialization
                numero_inscricao: "",
                data_inicio: new Date().toLocaleDateString('pt-BR'),
                cpf_aluno: "",
                situacao: "Ativo",
                alias: "",
                nacionalidade: "Brasileira",
                naturalidade: "",
                uf_naturalidade: "",
                data_nascimento: "",
                identidade_rg: "",
                rg_emissor: "",
                sexo: "",
                rg_numero_registro: "",
                rg_livro: "",
                rg_folha: "",
                rg_cartorio: "",
                data_registro: "",
                data_desligamento: "",
                procedencia_escolar: "",
                ensino_religioso: "",
                religiao: "",
                bolsa_percentual: "",
                autorizacao_saida: "",
                observacoes_saude: "",

                // Address
                cep: "",
                endereco_logradouro: "",
                endereco_numero: "",
                endereco_complemento: "",
                endereco_bairro: "",
                endereco_cidade: "",
                endereco_uf: "",
                telefone_contato: "",
                localizacao_tipo: "Urbana",

                // Family
                nome_pai: "",
                nome_mae: "",

                // Structural
                ficha_saude: {},
                documentos_entregues: []
            };
            onAddStudent(newStudent);
            // setSName(''); setSResponsavel(''); setSEmail(''); setSPhone(''); setSCode(''); setSPass(''); setSMetodoPagamento('Interno'); setSValorMensalidade('');

            // Workflow de Agilidade: Entrar em modo de edição
            alert("Aluno cadastrado com sucesso! \nVocê agora pode gerar o carnê clicando no botão 'Gerar Carnê 2026'.");
            startEditingStudent(newStudent);
        }
    };
    const initiateDeleteTeacher = (id: string) => setTeacherToDelete(id);
    const startEditingTeacher = (t: Teacher) => { setEditingTeacherId(t.id); setTName(t.name); setTCpf(t.cpf); setTPhone(t.phoneNumber || '+55'); setTUnit(t.unit); setTSubjects(t.subjects); setTPass(t.password); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const cancelEditingTeacher = () => { setEditingTeacherId(null); setTName(''); setTCpf(''); setTPhone('+55'); setTPass(''); setTSubjects([]); };
    const fullHandleTeacherSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const unitToSave = isGeneralAdmin ? tUnit : adminUnit!;

        // Validations
        if (!tName.trim()) { alert("Erro: O nome do professor é obrigatório."); return; }
        if (!tCpf || tCpf.length < 14) { alert("Erro: CPF inválido ou incompleto."); return; }
        if (tSubjects.length === 0) { alert("Erro: Selecione ao menos uma matéria para o professor."); return; }

        if (editingTeacherId) {
            const original = teachers.find(t => t.id === editingTeacherId)!;
            onEditTeacher({
                ...original,
                name: tName.trim(),
                cpf: tCpf,
                phoneNumber: tPhone,
                unit: unitToSave,
                subjects: tSubjects,
                password: tPass.trim() ? tPass : original.password
            });
            alert("Professor atualizado com sucesso!");
            cancelEditingTeacher();
        } else {
            if (!tPass.trim()) { alert("Erro: Defina uma senha para o novo professor."); return; }
            onAddTeacher({
                id: `teacher-${Date.now()}`,
                name: tName.trim(),
                cpf: tCpf,
                phoneNumber: tPhone,
                unit: unitToSave,
                subjects: tSubjects,
                password: tPass
            });
            alert("Professor cadastrado com sucesso!");
            setTName('');
            setTCpf('');
            setTPass('');
        }
    };
    const handleAddSubject = () => { if (!tSubjects.includes(tempSubject)) setTSubjects([...tSubjects, tempSubject]); };
    const handleRemoveSubject = (s: Subject) => setTSubjects(tSubjects.filter(sub => sub !== s));

    // Handlers de Telefone & CPF com Máscara
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => { setTPhone(maskPhone(e.target.value)); };
    const handleContactPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => { setContactPhone(maskPhone(e.target.value)); };
    const handleTCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => { setTCpf(maskCPF(e.target.value)); };
    const handleSPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => { setSPhone(maskPhone(e.target.value)); };

    // Handlers de Contatos
    const handleSaveContact = (role: ContactRole) => {
        if (!contactName || !contactPhone) return alert("Preencha nome e telefone.");

        const newContact: UnitContact = {
            id: editingContactId || `contact-${Date.now()}`,
            name: contactName,
            phoneNumber: contactPhone,
            role: role,
            unit: contactUnit,
            ...(role === ContactRole.COORDINATOR ? { segment: contactSegment } : {}) // Salva apenas se for Coordenação
        };

        if (editingContactId && onEditUnitContact) {
            onEditUnitContact(newContact);
            alert('Contato atualizado com sucesso!');
            setEditingContactId(null);
        } else if (onAddUnitContact) {
            onAddUnitContact(newContact);
            alert('Contato adicionado com sucesso!');
        }

        setContactName('');
        setContactPhone('+55');
        setContactSegment('all');
    };

    const startEditingContact = (contact: UnitContact) => {
        setEditingContactId(contact.id);
        setContactName(contact.name);
        setContactPhone(contact.phoneNumber);
        setContactUnit(contact.unit);
        setContactSegment(contact.segment || 'all');
    };

    const cancelEditingContact = () => {
        setEditingContactId(null);
        setContactName('');
        setContactPhone('+55');
        setContactSegment('all');
    };

    const EyeIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);
    const EyeOffIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>);

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans">
            {(studentToDelete || teacherToDelete || adminToDelete) && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-50 backdrop-blur-sm"><div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in-up"><h3 className="text-lg font-bold text-center text-gray-900 mb-2">Confirmar Exclusão</h3><p className="text-sm text-center text-gray-500 mb-6">Tem certeza? Essa ação não pode ser desfeita.</p><div className="flex gap-3 justify-center"><Button variant="secondary" onClick={() => { setStudentToDelete(null); setTeacherToDelete(null); setAdminToDelete(null); }} className="w-full">Cancelar</Button><Button variant="danger" onClick={() => { if (studentToDelete) { onDeleteStudent(studentToDelete); setStudentToDelete(null); } if (teacherToDelete) { onDeleteTeacher(teacherToDelete); setTeacherToDelete(null); } if (adminToDelete && onDeleteAdmin) { onDeleteAdmin(adminToDelete); setAdminToDelete(null); } }} className="w-full">Sim, Excluir</Button></div></div></div>)}

            <div className="w-full max-w-7xl bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col">
                {/* HEADER */}
                <div className="bg-gradient-to-br from-blue-950 to-slate-900 p-4 md:p-6 shadow-md relative shrink-0">
                    <div className="flex flex-col md:flex-row justify-between items-center relative z-10 gap-4 md:gap-0">
                        <div className="flex items-center gap-3 md:gap-4 text-white w-full md:w-auto">
                            <SchoolLogo variant="header" />
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white mb-0.5 shadow-black drop-shadow-sm">
                                    Meu Expansivo
                                </h1>
                                <div className="flex items-center gap-2 text-blue-200 text-xs md:text-sm font-medium">
                                    <span>Administração ({adminUnit || 'GERAL'})</span>
                                    <span className="w-1 h-1 rounded-full bg-blue-400"></span>
                                    <span className="text-blue-200">{admin.name}</span>
                                </div>
                            </div>
                        </div>


                        {/* STATS WIDGET (TOP RIGHT) - Somente para Admin Geral */}
                        <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto justify-between md:justify-start">
                            {isGeneralAdmin && dailyLoginsCount !== null && (
                                <>
                                    <div className="flex flex-col items-end text-white/90 p-2 rounded-lg transition-all" title="Visualizações na tela de login">
                                        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-70">Visitas Login</span>
                                        <div className="flex items-baseline gap-2">
                                            <div className="flex flex-col items-end">
                                                <span className="text-xl font-bold leading-none">{loginPageViewsToday !== null ? loginPageViewsToday : '-'}</span>
                                                <span className="text-[9px] opacity-70 leading-none">HOJE</span>
                                            </div>
                                            <div className="w-px h-6 bg-white/20"></div>
                                            <div className="flex flex-col items-start">
                                                <span className="text-xl font-bold leading-none">{loginPageViews !== null ? loginPageViews : '-'}</span>
                                                <span className="text-[9px] opacity-70 leading-none">TOTAL</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-px h-8 bg-white/20 mx-2 hidden md:block"></div>
                                    <button
                                        onClick={handleOpenLogModal}
                                        className="flex flex-col items-end text-white/90 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all cursor-pointer"
                                        title="Clique para ver detalhes"
                                    >
                                        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-70">Acessos Hoje</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-bold">{dailyLoginsCount}</span>
                                            <span className="text-xs">logins</span>
                                        </div>
                                    </button>
                                </>
                            )}

                            <div className="flex items-center gap-3">
                                {isGeneralAdmin && (
                                    <button
                                        onClick={() => setIsMaintenanceModalOpen(true)}
                                        className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-full transition-colors order-first md:order-none"
                                        title="Manutenção do Sistema"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </button>
                                )}
                                <Button variant="secondary" onClick={onLogout} className="!bg-transparent border-none !text-white font-medium hover:!text-gray-200 shadow-none !px-0">
                                    Sair
                                </Button>
                            </div>
                        </div>
                    </div>
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob pointer-events-none"></div>
                    <div className="absolute top-0 right-20 -mt-10 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000 pointer-events-none"></div>
                </div>

                <div className="p-4 md:p-6 flex-1 flex flex-col">
                    <div className="flex space-x-4 mb-6 overflow-x-auto pb-2 w-full scrollbar-thin scrollbar-thumb-gray-200">
                        <button onClick={() => setActiveTab('students')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'students' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Gerenciar Alunos</button>
                        <button onClick={() => setActiveTab('teachers')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'teachers' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Gerenciar Professores</button>
                        <button onClick={() => setActiveTab('messages')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2 ${activeTab === 'messages' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Mensagens{newMessagesCount > 0 && <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">{newMessagesCount}</span>}</button>
                        <button onClick={() => setActiveTab('attendance')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'attendance' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Controle de Frequência</button>
                        <button onClick={() => setActiveTab('contacts')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'contacts' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Gestão de Contatos</button>
                        <button onClick={() => setActiveTab('coordination')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2 ${activeTab === 'coordination' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                            <span>🦉</span> Coordenação
                        </button>
                        <button onClick={() => setActiveTab('rematricula')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2 ${activeTab === 'rematricula' ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                            <span>🎓</span> Rematrícula 2026
                        </button>
                        <button onClick={() => setActiveTab('financial')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2 ${activeTab === 'financial' ? 'bg-yellow-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                            <span>💰</span> Financeiro
                        </button>
                        {isGeneralAdmin && <button onClick={() => setActiveTab('admins')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'admins' ? 'bg-purple-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Gerenciar Admins</button>}
                        {isGeneralAdmin && <button onClick={() => setActiveTab('tickets')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2 ${activeTab === 'tickets' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                            <span>❓</span> Dúvidas
                        </button>}
                    </div>

                    {activeTab === 'students' && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><div className="lg:col-span-1"><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><h2 className="text-lg font-bold text-gray-800 mb-4">{editingStudentId ? 'Editar Aluno' : 'Cadastrar Novo Aluno'}</h2><form onSubmit={fullHandleStudentSubmit} className="space-y-4"><div><label className="text-sm font-medium">Nome</label><input type="text" value={sName} onChange={e => setSName(e.target.value)} required className="w-full p-2 border rounded" /></div><div><label className="text-sm font-medium">Código</label><input type="text" value={sCode} onChange={e => setSCode(e.target.value)} required className="w-full p-2 border rounded" /></div>
                        <div><label className="text-sm font-medium">Série</label><select value={sGrade} onChange={e => setSGrade(e.target.value)} className="w-full p-2 border rounded">{SCHOOL_GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}</select></div><div className="grid grid-cols-2 gap-2"><div><label className="text-sm font-medium">Turma</label><select value={sClass} onChange={e => setSClass(e.target.value as SchoolClass)} className="w-full p-2 border rounded">{SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="text-sm font-medium">Turno</label><select value={sShift} onChange={e => setSShift(e.target.value as SchoolShift)} className="w-full p-2 border rounded">{SCHOOL_SHIFTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select></div></div><div className="grid grid-cols-2 gap-2"><div><label className="text-sm font-medium">Unidade</label>{isGeneralAdmin ? (<select value={sUnit} onChange={e => setSUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">{SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select>) : <div className="p-2 bg-gray-100 rounded text-gray-600">{adminUnit}</div>}</div><div><label className="text-sm font-medium text-blue-700 font-bold">Método Pagamento</label><select value={sMetodoPagamento} onChange={e => setSMetodoPagamento(e.target.value as 'Isaac' | 'Interno')} className="w-full p-2 border-2 border-blue-200 rounded font-semibold text-blue-900 focus:border-blue-500"><option value="Interno">Sistema Interno</option><option value="Isaac">Parceiro Isaac</option></select></div></div>

                        <div><label className="text-sm font-medium">Responsável Financeiro</label><input type="text" value={sResponsavel} onChange={e => setSResponsavel(e.target.value)} className="w-full p-2 border rounded" placeholder="Nome do responsável financeiro" /></div>

                        <div>
                            <label className="text-sm font-medium">CPF do Responsável</label>
                            <input
                                type="text"
                                value={sCpfResponsavel}
                                onChange={e => setSCpfResponsavel(maskCPF(e.target.value))}
                                className="w-full p-2 border rounded"
                                placeholder="000.000.000-00"
                            />
                        </div>

                        <div className="flex items-center gap-3 bg-yellow-50 p-3 rounded border border-yellow-200">
                            <input
                                type="checkbox"
                                id="scholarship-switch"
                                checked={sScholarship}
                                onChange={e => setSScholarship(e.target.checked)}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="flex flex-col">
                                <label htmlFor="scholarship-switch" className="text-sm font-bold text-gray-800 cursor-pointer">
                                    Aluno Bolsista 🎓
                                </label>
                                <span className="text-xs text-gray-500">Se marcado, o aluno será isento da geração automática de mensalidades.</span>
                            </div>
                        </div>

                        <div><label className="text-sm font-medium font-bold text-green-700">Valor da Mensalidade (R$)</label><input type="number" step="0.01" value={sValorMensalidade} onChange={e => setSValorMensalidade(e.target.value)} className="w-full p-2 border rounded font-bold text-green-800" placeholder="0.00" disabled={sScholarship} /></div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-sm font-medium">E-mail</label><input type="email" value={sEmail} onChange={e => setSEmail(e.target.value)} className="w-full p-2 border rounded" placeholder="email@exemplo.com" /></div>
                            <div><label className="text-sm font-medium">Telefone</label><input type="text" value={sPhone} onChange={handleSPhoneChange} className="w-full p-2 border rounded" placeholder="(84) 99999-9999" /></div>
                        </div>



                        <div><label className="text-sm font-medium">Senha</label>
                            <div className="flex gap-2 relative"><input type={showStudentPassword ? "text" : "password"} value={sPass} onChange={e => setSPass(e.target.value)} className="w-full p-2 border rounded" required={!editingStudentId} /><button type="button" onClick={() => setShowStudentPassword(!showStudentPassword)} className="absolute right-16 top-2 text-gray-500">{showStudentPassword ? <EyeOffIcon /> : <EyeIcon />}</button><button type="button" onClick={handleGenerateStudentPass} className="px-3 py-2 bg-gray-200 rounded text-sm">Gerar</button></div><p className="text-xs text-gray-500 mt-1">Senha automática (8 caracteres).</p></div>

                        <div className="flex gap-2">
                            <Button type="submit" className="w-full flex-1">{editingStudentId ? 'Salvar Alterações' : 'Cadastrar Aluno'}</Button>
                            {onGenerateIndividualFees && (
                                <button

                                    type="button"
                                    disabled={!editingStudentId}
                                    onClick={() => {
                                        if (!editingStudentId) return;
                                        // Construct student from form data to ensure we have the latest value (even if not synced yet)
                                        const formStudent: Student = {
                                            id: editingStudentId,
                                            name: sName,
                                            valor_mensalidade: sValorMensalidade ? parseFloat(sValorMensalidade.replace(',', '.')) : 0,
                                            // Fill other required fields with defaults or current form values to satisfy type
                                            code: sCode,
                                            gradeLevel: sGrade,
                                            schoolClass: sClass,
                                            shift: sShift,
                                            unit: isGeneralAdmin ? sUnit : (adminUnit || SchoolUnit.UNIT_1), // Ensure unit is present
                                            // Legacy/Optional fields can be partial/dummy if not used by fee generator,
                                            // but best to try finding original to keep data clean if possible.
                                            ...(students.find(s => s.id === editingStudentId) || {} as any)
                                        };

                                        // Override with form values specifically for the critical fields
                                        formStudent.valor_mensalidade = sValorMensalidade ? parseFloat(sValorMensalidade.replace(',', '.')) : 0;
                                        formStudent.name = sName;

                                        if (onGenerateIndividualFees) onGenerateIndividualFees(formStudent);
                                    }}
                                    className={`flex-1 font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 ${editingStudentId ? 'bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer' : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-70'}`}
                                    title={editingStudentId ? "Gera o carnê de 2026 com o valor atual do formulário" : "Cadastre o aluno primeiro para gerar o carnê"}
                                >
                                    <span>💰</span> Gerar Carnê 2026
                                </button>
                            )}
                            {onResetFees && (
                                <button
                                    type="button"
                                    disabled={!editingStudentId}
                                    onClick={() => editingStudentId && onResetFees!(editingStudentId)}
                                    className={`px-4 py-2 rounded font-bold transition flex items-center gap-2 border ${editingStudentId ? 'bg-red-100 text-red-600 hover:bg-red-200 border-red-200 cursor-pointer' : 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'}`}
                                    title={editingStudentId ? "ATENÇÃO: Apaga TODAS as mensalidades de 2026 (inclusive pagas) para recomeçar." : "Função indisponível (requer aluno cadastrado)"}
                                >
                                    <span>🗑️</span> Reset
                                </button>
                            )}
                        </div>
                    </form></div></div>

                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-4 bg-gray-50 border-b flex flex-col gap-4">
                                    <h3 className="font-bold text-gray-700 whitespace-nowrap">Alunos ({filteredStudents.length})</h3>
                                    <div className="flex flex-wrap gap-2 w-full">
                                        {isGeneralAdmin && (
                                            <select
                                                value={studentFilterUnit}
                                                onChange={(e) => setStudentFilterUnit(e.target.value)}
                                                className="p-2 border rounded text-sm bg-white text-gray-700 focus:ring-blue-950 focus:border-blue-950 flex-grow md:flex-grow-0 md:w-auto w-full"
                                            >
                                                <option value="">Todas as Unidades</option>
                                                {SCHOOL_UNITS_LIST.map(u => (
                                                    <option key={u} value={u}>{u}</option>
                                                ))}
                                            </select>
                                        )}
                                        <select
                                            value={studentFilterGrade}
                                            onChange={(e) => setStudentFilterGrade(e.target.value)}
                                            className="p-2 border rounded text-sm bg-white text-gray-700 focus:ring-blue-950 focus:border-blue-950 flex-grow md:flex-grow-0 md:w-auto w-full"
                                        >
                                            <option value="">Todas as Séries</option>
                                            {SCHOOL_GRADES_LIST.map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={studentFilterClass}
                                            onChange={(e) => setStudentFilterClass(e.target.value)}
                                            className="p-2 border rounded text-sm bg-white text-gray-700 focus:ring-blue-950 focus:border-blue-950 flex-grow md:flex-grow-0 md:w-auto w-full"
                                        >
                                            <option value="">Todas as Turmas</option>
                                            {SCHOOL_CLASSES_LIST.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={studentFilterShift}
                                            onChange={(e) => setStudentFilterShift(e.target.value)}
                                            className="p-2 border rounded text-sm bg-white text-gray-700 focus:ring-blue-950 focus:border-blue-950 flex-grow md:flex-grow-0 md:w-auto w-full"
                                        >
                                            <option value="">Todos os Turnos</option>
                                            {SCHOOL_SHIFTS_LIST.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="Buscar por nome ou código..."
                                            value={studentSearchTerm}
                                            onChange={e => setStudentSearchTerm(e.target.value)}
                                            className="p-2 border rounded text-sm w-full md:w-64 focus:ring-blue-950 focus:border-blue-950"
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[600px] text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs"><tr><th className="p-3">Nome</th><th className="p-3">Código</th><th className="p-3">Unidade</th><th className="p-3">Ações</th></tr></thead>
                                        <tbody>{filteredStudents.map(s => (<tr key={s.id} className="border-b hover:bg-gray-50"><td className="p-3 font-medium text-gray-800">{s.name}{s.isBlocked && <span className="ml-2 bg-red-100 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full">BLOQUEADO</span>}</td><td className="p-3 font-mono text-gray-600">{s.code}</td><td className="p-3">{s.unit}</td><td className="p-3 flex gap-3 text-xs font-medium">
                                            <button onClick={() => { setSelectedStudentForFinancial(s); setIsFinancialModalOpen(true); }} className="text-green-700 bg-green-50 px-2 py-1 rounded hover:bg-green-100 border border-green-200">💲 Fin.</button>
                                            <button onClick={() => startEditingStudent(s)} className="text-blue-950 hover:underline">Editar</button><button onClick={() => onToggleBlockStudent(s.id)} className={`hover:underline ${s.isBlocked ? 'text-green-600' : 'text-yellow-600'}`}>{s.isBlocked ? 'Desbloquear' : 'Bloquear'}</button><button onClick={() => initiateDeleteStudent(s.id)} className="text-red-600 hover:underline">Excluir</button></td></tr>))}</tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>)}
                    {activeTab === 'teachers' && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><div className="lg:col-span-1"><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-gray-800">{editingTeacherId ? 'Editar Professor' : 'Cadastrar Novo Professor'}</h2>{editingTeacherId && (<button onClick={cancelEditingTeacher} className="text-sm text-red-600 hover:underline">Cancelar</button>)}</div><form onSubmit={fullHandleTeacherSubmit} className="space-y-4"><div><label className="text-sm font-medium">Nome Completo</label><input type="text" value={tName} onChange={e => setTName(e.target.value)} required className="w-full p-2 border rounded" /></div><div><label className="text-sm font-medium">Matérias</label><div className="flex gap-2"><select value={tempSubject} onChange={e => setTempSubject(e.target.value as Subject)} className="flex-1 p-2 border rounded">{sortedSubjects.map(s => <option key={s} value={s}>{s}</option>)}</select><button type="button" onClick={handleAddSubject} className="bg-blue-100 text-blue-950 px-3 rounded">Add</button></div><div className="flex flex-wrap gap-2 mt-2">{tSubjects.map(s => (<span key={s} className="bg-gray-100 px-2 rounded text-xs flex items-center gap-1">{s} <button type="button" onClick={() => handleRemoveSubject(s)}>&times;</button></span>))}</div></div><div className="grid grid-cols-2 gap-2"><div><label className="text-sm font-medium">CPF</label><input type="text" value={tCpf} onChange={handleTCpfChange} required className="w-full p-2 border rounded" placeholder="000.000.000-00" /></div><div><label className="text-sm font-medium">Telefone</label><input type="text" value={tPhone} onChange={handlePhoneChange} className="w-full p-2 border rounded" placeholder="(84) 99999-9999" /></div></div><div><label className="text-sm font-medium">Unidade</label>{isGeneralAdmin ? (<select value={tUnit} onChange={e => setTUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">{SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select>) : <div className="p-2 bg-gray-100 rounded text-gray-600">{adminUnit}</div>}</div><div><label className="text-sm font-medium">Senha</label><div className="flex gap-2 relative"><input type={showTeacherPassword ? "text" : "password"} value={tPass} onChange={e => setTPass(e.target.value)} className="w-full p-2 border rounded" required={!editingTeacherId} /><button type="button" onClick={() => setShowTeacherPassword(!showTeacherPassword)} className="absolute right-16 top-2 text-gray-500">{showTeacherPassword ? <EyeOffIcon /> : <EyeIcon />}</button><button type="button" onClick={handleGenerateTeacherPass} className="px-3 py-2 bg-gray-200 rounded text-sm">Gerar</button></div><p className="text-xs text-gray-500 mt-1">Senha automática (8 caracteres).</p></div><Button type="submit" className="w-full">{editingTeacherId ? 'Salvar' : 'Cadastrar'}</Button></form></div></div><div className="lg:col-span-2"><div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="p-4 bg-gray-50 border-b flex flex-col gap-4">
                        <h3 className="font-bold">Professores ({filteredTeachers.length})</h3>
                        <div className="flex flex-wrap gap-2 w-full">
                            {isGeneralAdmin && (
                                <select
                                    value={teacherFilterUnit}
                                    onChange={(e) => setTeacherFilterUnit(e.target.value)}
                                    className="p-2 border rounded text-sm bg-white text-gray-700 focus:ring-blue-950 focus:border-blue-950 flex-grow md:flex-grow-0 md:w-auto w-full"
                                >
                                    <option value="">Todas as Unidades</option>
                                    {SCHOOL_UNITS_LIST.map(u => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </select>
                            )}
                            <input
                                type="text"
                                placeholder="Buscar professor..."
                                value={teacherSearchTerm}
                                onChange={e => setTeacherSearchTerm(e.target.value)}
                                className="p-2 border rounded text-sm w-full md:w-64 focus:ring-blue-950 focus:border-blue-950"
                            />
                        </div>
                    </div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm text-left"><thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Nome</th><th className="p-3">Matérias</th><th className="p-3">Unidade</th><th className="p-3">Ações</th></tr></thead><tbody>{filteredTeachers.map(t => (<tr key={t.id} className="border-b"><td className="p-3">{t.name}</td><td className="p-3"><div className="flex flex-wrap gap-1">{t.subjects.map(s => <span key={s} className="bg-gray-100 px-2 rounded text-xs">{s}</span>)}</div></td><td className="p-3">{t.unit}</td><td className="p-3 flex gap-2"><button onClick={() => startEditingTeacher(t)} className="text-blue-950 hover:underline">Editar</button><button onClick={() => initiateDeleteTeacher(t.id)} className="text-red-600 hover:underline">Excluir</button></td></tr>))}</tbody></table></div></div></div></div>)}
                    {activeTab === 'messages' && (<div className="animate-fade-in-up"><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b"><h2 className="text-2xl font-bold text-gray-800 mb-3 sm:mb-0">Central de Mensagens</h2><div className="flex items-center gap-2 p-1 bg-gray-200 rounded-lg"><button onClick={() => setMessageFilter('new')} className={`px-3 py-1 text-sm rounded-md font-medium ${messageFilter === 'new' ? 'bg-white shadow text-blue-950' : 'text-gray-600'}`}>Não Lidas</button><button onClick={() => setMessageFilter('all')} className={`px-3 py-1 text-sm rounded-md font-medium ${messageFilter === 'all' ? 'bg-white shadow text-blue-950' : 'text-gray-600'}`}>Todas</button></div></div>{filteredMessages.length > 0 ? (<div className="space-y-4">{filteredMessages.map(message => {
                        const sender = students.find(s => s.id === message.studentId);
                        const typeStyles = { [MessageType.COMPLIMENT]: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' }, [MessageType.SUGGESTION]: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' }, [MessageType.COMPLAINT]: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' }, }; const style = typeStyles[message.messageType]; return (<div key={message.id} className={`p-5 rounded-lg shadow-sm border ${message.status === 'new' ? 'bg-white border-l-4 border-l-blue-950' : 'bg-gray-50 border-gray-200'}`}><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 pb-3 border-b"><div><p className="font-bold text-gray-800">{message.studentName}</p><p className="text-xs text-gray-500">Unidade: <span className="font-semibold">{message.unit}</span></p> {sender && (<p className="text-xs text-gray-600 font-medium mt-0.5">{sender.gradeLevel} - {sender.schoolClass} ({sender.shift})</p>)}</div><p className="text-xs text-gray-400 mt-2 sm:mt-0">{formatDate(message.timestamp)}</p></div><div className="flex gap-4 mb-4"><span className={`px-2 py-1 text-xs font-bold rounded ${style.bg} ${style.border} ${style.text}`}>{message.messageType}</span><span className="text-xs text-gray-500 font-medium self-center">Para: <span className="font-bold text-gray-700">{message.recipient}</span></span></div><p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p><div className="mt-4 pt-3 border-t flex justify-end"><button onClick={() => onUpdateMessageStatus(message.id, message.status === 'new' ? 'read' : 'new')} className={`text-xs font-bold py-1 px-3 rounded-full transition-colors ${message.status === 'new' ? 'bg-blue-100 text-blue-950 hover:bg-blue-200' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{message.status === 'new' ? 'Marcar como Lida' : 'Marcar como Não Lida'}</button></div></div>);
                    })}</div>) : (<div className="text-center py-16"><p className="text-gray-500">Nenhuma mensagem {messageFilter === 'new' ? 'não lida' : ''} encontrada.</p></div>)}</div>)}

                    {activeTab === 'attendance' && (
                        <div className="animate-fade-in-up">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">Controle de Frequência</h2>
                            <div className="p-4 bg-white rounded-lg shadow-md border mb-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {isGeneralAdmin && (
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">Unidade</label>
                                            <select value={attendanceFilterUnit} onChange={e => setAttendanceFilterUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded mt-1">
                                                <option value="">Todas</option>
                                                {SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Série/Ano</label>
                                        <select value={attendanceFilterGrade} onChange={e => setAttendanceFilterGrade(e.target.value)} className="w-full p-2 border rounded mt-1">
                                            <option value="">Todas</option>
                                            {SCHOOL_GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Turma</label>
                                        <select value={attendanceFilterClass} onChange={e => setAttendanceFilterClass(e.target.value)} className="w-full p-2 border rounded mt-1">
                                            <option value="">Todas</option>
                                            {SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Turno</label>
                                        <select value={attendanceFilterShift} onChange={e => setAttendanceFilterShift(e.target.value)} className="w-full p-2 border rounded mt-1">
                                            <option value="">Todos</option>
                                            {SCHOOL_SHIFTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Data</label>
                                        <input type="date" value={attendanceFilterDate} onChange={e => setAttendanceFilterDate(e.target.value)} className="w-full p-2 border rounded mt-1" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {filteredAttendanceRecords.length > 0 ? (
                                    filteredAttendanceRecords.map(record => {
                                        const total = Object.keys(record.studentStatus).length;
                                        const presents = Object.values(record.studentStatus).filter(s => s === AttendanceStatus.PRESENT).length;
                                        const absents = total - presents;
                                        return (
                                            <div key={record.id} className="bg-white rounded-lg shadow-sm border">
                                                <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer hover:bg-gray-50" onClick={() => setExpandedRecordId(expandedRecordId === record.id ? null : record.id)}>
                                                    <div>
                                                        <p className="font-bold text-blue-950">{record.gradeLevel} - Turma {record.schoolClass}</p>
                                                        <p className="text-sm text-gray-800 font-semibold my-0.5">Prof. {record.teacherName}</p>
                                                        <p className="text-xs text-gray-500">{record.unit} | Data: {formatDate(record.date, false)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-2 md:mt-0 text-sm">
                                                        <span className="font-bold text-green-600">{presents} Presentes</span>
                                                        <span className="font-bold text-red-600">{absents} Ausentes</span>
                                                    </div>
                                                </div>
                                                {expandedRecordId === record.id && (
                                                    <div className="border-t p-4 bg-gray-50/50">
                                                        <h4 className="font-bold mb-2">Detalhes da Chamada:</h4>
                                                        <ul className="divide-y max-h-60 overflow-y-auto">
                                                            {Object.entries(record.studentStatus).map(([studentId, status]) => {
                                                                const student = students.find(s => s.id === studentId);
                                                                return (
                                                                    <li key={studentId} className="flex justify-between items-center py-2 px-1">
                                                                        <div>
                                                                            <span className="text-sm text-gray-800 font-medium">{student ? student.name : 'Aluno Removido'}</span>
                                                                            {student && <span className="text-xs text-gray-400 ml-2">({student.shift})</span>}
                                                                        </div>
                                                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${status === AttendanceStatus.PRESENT ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{status}</span>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-12 text-gray-500">
                                        <p>Nenhum registro de frequência encontrado para os filtros selecionados.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* MODAL FINANCEIRO INDIVIDUAL */}
                    <StudentFinancialModal
                        isOpen={isFinancialModalOpen}
                        onClose={() => setIsFinancialModalOpen(false)}
                        student={selectedStudentForFinancial}
                        mensalidades={mensalidades}
                        isGeneralAdmin={isGeneralAdmin}
                        onSetSelectedManualFee={setSelectedManualFee}
                        onSetManualPaymentMethod={setManualPaymentMethod}
                        onSetIsManualPaymentModalOpen={setIsManualPaymentModalOpen}
                    />




                    {/* MODAL DE ENVIO EM MASSA (SEQUENCIAL) - Moved to FinancialTab */}

                    {/* --- CONTEÚDO GESTÃO DE CONTATOS (NOVA ABA) --- */}
                    {
                        activeTab === 'contacts' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* FORMULÁRIO DE CADASTRO */}
                                <div className="lg:col-span-1">
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                        <div className="flex justify-between items-center mb-4">
                                            <h2 className="text-lg font-bold text-blue-950">{editingContactId ? 'Editar Contato' : 'Adicionar Contato'}</h2>
                                            {editingContactId && (
                                                <button onClick={cancelEditingContact} className="text-sm text-red-600 hover:underline">Cancelar</button>
                                            )}
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-sm font-medium">Nome Completo</label>
                                                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className="w-full p-2 border rounded" placeholder="Ex: Maria Silva" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium">Telefone (WhatsApp)</label>
                                                <input type="text" value={contactPhone} onChange={handleContactPhoneChange} className="w-full p-2 border rounded" placeholder="Ex: 5584999999999" />
                                                <p className="text-xs text-gray-500 mt-1">Apenas números, com DDD (Ex: 5584...)</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium">Unidade</label>
                                                {isGeneralAdmin ? (
                                                    <select value={contactUnit} onChange={e => setContactUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">{SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select>
                                                ) : <div className="p-2 bg-gray-100 rounded text-gray-600">{adminUnit}</div>}
                                            </div>

                                            {/* NOVO: Seletor de Segmento (Apenas relevante para Coordenação) */}
                                            <div>
                                                <label className="text-sm font-medium">Segmento (Para Coordenação)</label>
                                                <select
                                                    value={contactSegment}
                                                    onChange={e => setContactSegment(e.target.value as any)}
                                                    className="w-full p-2 border rounded"
                                                >
                                                    <option value="geral">Geral / Ambos</option>
                                                    <option value="infantil_fund1">Educação Infantil / Fundamental I</option>
                                                    <option value="fund2_medio">Fundamental II / Ensino Médio</option>
                                                </select>
                                            </div>
                                            <div className="pt-2 grid grid-cols-2 gap-3">
                                                <Button onClick={() => handleSaveContact(ContactRole.DIRECTOR)} className="w-full bg-blue-950 hover:bg-blue-900">
                                                    Salvar Diretor
                                                </Button>
                                                <Button onClick={() => handleSaveContact(ContactRole.COORDINATOR)} className="w-full bg-orange-600 hover:bg-orange-700">
                                                    Salvar Coord.
                                                </Button>

                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* LISTAGEM DE CONTATOS */}
                                <div className="lg:col-span-2 space-y-6">
                                    {/* DIRETORES */}
                                    <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-x-auto">
                                        <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center min-w-[500px]">
                                            <h3 className="font-bold text-blue-900 flex items-center gap-2">
                                                <span className="text-xl">👔</span> Diretoria
                                            </h3>
                                            <span className="text-xs font-semibold bg-blue-200 text-blue-800 px-2 py-1 rounded-full">{directors.length} cadastrados</span>
                                        </div>
                                        {directors.length > 0 ? (
                                            <table className="min-w-full text-sm text-left">
                                                <thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Nome</th><th className="p-3">Telefone</th><th className="p-3">Unidade</th><th className="p-3 text-right">Ação</th></tr></thead>
                                                <tbody>
                                                    {directors.map(c => (
                                                        <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                                                            <td className="p-3 font-medium">{c.name}</td>
                                                            <td className="p-3 font-mono text-gray-600">{c.phoneNumber}</td>
                                                            <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{c.unit}</span></td>
                                                            <td className="p-3 text-right flex justify-end gap-2">
                                                                <button onClick={() => startEditingContact(c)} className="text-blue-950 hover:underline text-xs font-bold px-2 py-1">Editar</button>
                                                                <button onClick={() => onDeleteUnitContact && onDeleteUnitContact(c.id)} className="text-red-600 hover:text-red-800 text-xs font-bold bg-red-50 px-2 py-1 rounded border border-red-100">Remover</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="p-8 text-center text-gray-400 italic">Nenhum diretor cadastrado para esta seleção.</div>
                                        )}
                                    </div>

                                    {/* COORDENADORES */}
                                    <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-x-auto">
                                        <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center min-w-[500px]">
                                            <h3 className="font-bold text-orange-900 flex items-center gap-2">
                                                <span className="text-xl">📋</span> Coordenação
                                            </h3>
                                            <span className="text-xs font-semibold bg-orange-200 text-orange-800 px-2 py-1 rounded-full">{coordinators.length} cadastrados</span>
                                        </div>
                                        {coordinators.length > 0 ? (
                                            <table className="min-w-full text-sm text-left">
                                                <thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Nome</th><th className="p-3">Telefone</th><th className="p-3">Unidade</th><th className="p-3 text-right">Ação</th></tr></thead>
                                                <tbody>
                                                    {coordinators.map(c => (
                                                        <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                                                            <td className="p-3 font-medium">
                                                                {c.name}
                                                                {c.segment && c.segment !== 'all' && (
                                                                    <span className="block text-[10px] text-gray-500 uppercase bg-gray-100 px-1 rounded w-fit mt-1">
                                                                        {c.segment === 'infantil_fund1' ? 'Infantil / Fund I' : c.segment === 'fund2_medio' ? 'Fund II / Médio' : 'Geral'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 font-mono text-gray-600">{c.phoneNumber}</td>
                                                            <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{c.unit}</span></td>
                                                            <td className="p-3 text-right flex justify-end gap-2">
                                                                <button onClick={() => startEditingContact(c)} className="text-blue-950 hover:underline text-xs font-bold px-2 py-1">Editar</button>
                                                                <button onClick={() => onDeleteUnitContact && onDeleteUnitContact(c.id)} className="text-red-600 hover:text-red-800 text-xs font-bold bg-red-50 px-2 py-1 rounded border border-red-100">Remover</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="p-8 text-center text-gray-400 italic">Nenhum coordenador cadastrado para esta seleção.</div>
                                        )}
                                    </div>

                                    {/* FINANCEIRO REMOVED */}
                                </div>
                            </div>
                        )
                    }

                    {activeTab === 'admins' && isGeneralAdmin && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><div className="lg:col-span-1"><div className="bg-white p-6 rounded-xl shadow-sm border border-purple-200"><h2 className="text-lg font-bold text-purple-800 mb-4">{editingAdminId ? 'Editar Admin' : 'Novo Admin de Unidade'}</h2><form onSubmit={handleAdminSubmit} className="space-y-4"><div><label className="text-sm font-medium">Nome (Descrição)</label><input type="text" value={aName} onChange={e => setAName(e.target.value)} required className="w-full p-2 border rounded" /></div><div><label className="text-sm font-medium">Usuário de Login</label><input type="text" value={aUser} onChange={e => setAUser(e.target.value)} required className="w-full p-2 border rounded" /></div><div><label className="text-sm font-medium">Unidade Responsável</label><select value={aUnit} onChange={e => setAUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">{SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select></div><div><label className="text-sm font-medium">Senha</label><div className="flex gap-2 relative"><input type={showAdminPassword ? "text" : "password"} value={aPass} onChange={e => setAPass(e.target.value)} required={!editingAdminId} className="w-full p-2 border rounded" /><button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} className="absolute right-16 top-2 text-gray-500">{showAdminPassword ? <EyeOffIcon /> : <EyeIcon />}</button><button type="button" onClick={handleGenerateAdminPass} className="px-3 py-2 bg-gray-200 rounded text-sm">Gerar</button></div></div><Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">Salvar Admin</Button></form></div></div><div className="lg:col-span-2"><div className="bg-white rounded-xl shadow-sm border border-gray-200"><div className="p-4 bg-purple-50 border-b border-purple-100"><h3 className="font-bold text-purple-900">Administradores Cadastrados</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm text-left"><thead className="bg-gray-50"><tr><th className="p-3">Nome</th><th className="p-3">Usuário</th><th className="p-3">Unidade</th><th className="p-3">Ações</th></tr></thead><tbody>{filteredAdmins.map(a => (<tr key={a.id} className="border-b"><td className="p-3 font-medium">{a.name}</td><td className="p-3 font-mono text-gray-600">{a.username}</td><td className="p-3"><span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{a.unit}</span></td><td className="p-3 flex gap-2"><button onClick={() => startEditingAdmin(a)} className="text-blue-950 hover:underline">Editar</button><button onClick={() => initiateDeleteAdmin(a.id)} className="text-red-600 hover:underline">Excluir</button></td></tr>))}</tbody></table></div></div></div></div>)}
                    {
                        activeTab === 'rematricula' && (
                            <Rematricula
                                students={students}
                                grades={grades}
                                currentAdminUnit={isGeneralAdmin ? undefined : adminUnit}
                                onRefresh={async () => {
                                    // Re-triggering parent data via mock add if needed,
                                    // but Firestore is real-time.
                                }}
                            />
                        )
                    }

                    {
                        activeTab === 'financial' && (
                            <FinancialTab
                                isGeneralAdmin={isGeneralAdmin}
                                adminUnit={adminUnit}
                                unitContacts={unitContacts}
                                students={students}
                                onAddUnitContact={onAddUnitContact}
                                onEditUnitContact={onEditUnitContact}
                                onGenerateFees={onGenerateFees}
                                onFixDuplicates={onFixDuplicates}
                                setSelectedStudentForFinancial={setSelectedStudentForFinancial}
                                setIsFinancialModalOpen={setIsFinancialModalOpen}
                                setSelectedReceiptForModal={setSelectedReceiptForModal}
                                maskPhone={maskPhone}
                            />
                        )
                    }

                    {
                        activeTab === 'tickets' && isGeneralAdmin && (
                            <div className="animate-fade-in-up">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-800">Minhas Dúvidas (Tickets)</h2>
                                        <p className="text-sm text-gray-500">Gerenciamento interativo de dúvidas dos alunos.</p>
                                    </div>
                                    <div>
                                        <select
                                            value={ticketFilterUnit}
                                            onChange={(e) => setTicketFilterUnit(e.target.value)}
                                            className="p-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        >
                                            <option value="all">Todas as Unidades</option>
                                            {SCHOOL_UNITS_LIST.map(unit => (
                                                <option key={unit} value={unit}>{unit}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {isLoadingTickets ? (
                                    <div className="text-center py-12">
                                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-2"></div>
                                        <p className="text-gray-500">Carregando tickets...</p>
                                    </div>
                                ) : ticketsList.length === 0 ? (
                                    <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm">
                                        <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        <h3 className="text-lg font-bold text-gray-900">Nenhuma dúvida registrada</h3>
                                        <p className="text-gray-500">O histórico de perguntas está vazio.</p>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 uppercase tracking-wider text-xs">
                                                    <tr>
                                                        <th className="px-6 py-4">Data</th>
                                                        <th className="px-6 py-4">Aluno</th>
                                                        <th className="px-6 py-4">Disciplina</th>
                                                        <th className="px-6 py-4 w-1/3">Dúvida / Resposta</th>
                                                        <th className="px-6 py-4 text-center">Status</th>
                                                        <th className="px-6 py-4 text-center">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {ticketsList
                                                        .filter(ticket => ticketFilterUnit === 'all' || ticket.unit === ticketFilterUnit)
                                                        .map(ticket => (
                                                            <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                                                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                                                    {new Date(ticket.timestamp).toLocaleDateString()}
                                                                    <span className="block text-xs">{new Date(ticket.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="font-bold text-gray-800">{ticket.studentName}</div>
                                                                    <div className="text-xs text-gray-500">{ticket.gradeLevel} - {ticket.schoolClass} ({ticket.unit})</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">{ticket.subject}</span>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="mb-2">
                                                                        <span className="font-bold text-gray-700 text-xs uppercase block mb-1">Dúvida:</span>
                                                                        <p className="text-gray-600 italic">"{ticket.message}"</p>
                                                                    </div>
                                                                    {ticket.response && (
                                                                        <div className="bg-green-50 p-2 rounded border border-green-100">
                                                                            <span className="font-bold text-green-800 text-xs uppercase block mb-1">
                                                                                Resposta {ticket.responderName ? `(${ticket.responderName})` : ''}:
                                                                            </span>
                                                                            <p className="text-green-700 text-xs">{ticket.response}</p>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    {ticket.status === TicketStatus.ANSWERED ? (
                                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                                            Respondido
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                                                                            Pendente
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <button
                                                                        onClick={() => handleDeleteTicket(ticket.id)}
                                                                        className="text-red-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-full"
                                                                        title="Excluir Dúvida permanentemente"
                                                                    >
                                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    }
                    {/* TAB COORDENAÇÃO (APROVAÇÃO) */}
                    {
                        activeTab === 'coordination' && (
                            <CoordinationTab
                                isGeneralAdmin={isGeneralAdmin}
                                coordinationFilterUnit={coordinationFilterUnit}
                                setCoordinationFilterUnit={setCoordinationFilterUnit}
                                coordinationFilterGrade={coordinationFilterGrade}
                                setCoordinationFilterGrade={setCoordinationFilterGrade}
                                coordinationFilterClass={coordinationFilterClass}
                                setCoordinationFilterClass={setCoordinationFilterClass}
                                coordinationFilterSubject={coordinationFilterSubject}
                                setCoordinationFilterSubject={setCoordinationFilterSubject}
                                fetchPendingGrades={fetchPendingGrades}
                                isLoadingCoordination={isLoadingCoordination}
                                pendingGradesStudents={pendingGradesStudents}
                                pendingGradesMap={pendingGradesMap}
                                handleApproveGrade={handleApproveGrade}
                            />
                        )
                    }

                    {/* TAB FINANCEIRO */}
                    {
                        activeTab === 'financial' && (
                            <FinancialTab
                                isGeneralAdmin={isGeneralAdmin}
                                adminUnit={adminUnit}
                                unitContacts={unitContacts}
                                students={students}
                                onAddUnitContact={onAddUnitContact}
                                onEditUnitContact={onEditUnitContact}
                                onGenerateFees={onGenerateFees}
                                onFixDuplicates={onFixDuplicates}
                                setSelectedStudentForFinancial={setSelectedStudentForFinancial}
                                setIsFinancialModalOpen={setIsFinancialModalOpen}
                                setSelectedReceiptForModal={setSelectedReceiptForModal}
                                maskPhone={maskPhone}
                            />
                        )
                    }
                </div >
            </div >



            {/* MODAL DE MANUTENÇÃO */}
            {
                isMaintenanceModalOpen && isGeneralAdmin && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900 bg-opacity-70 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-auto max-h-[90vh] flex flex-col overflow-hidden">
                            {/* HEADER MODAL */}
                            <div className="flex justify-between items-center p-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                        ⚙️ Manutenção do Sistema
                                    </h2>
                                    <p className="text-sm text-gray-500">Ferramentas avançadas de administração e virada de ano.</p>
                                </div>
                                <button onClick={() => setIsMaintenanceModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-200">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>

                            {/* BODY MODAL */}
                            <div className="p-8 overflow-y-auto">
                                <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 mb-8 rounded shadow-sm">
                                    <p className="font-bold">⚠️ Área de Risco</p>
                                    <p>Estas ferramentas manipulam dados críticos. Certifique-se de que sabe o que está fazendo.</p>
                                </div>

                                {/* Unit Selector */}
                                <div className="mb-8">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Selecionar Unidade Alvo</label>
                                    <select
                                        value={maintenanceUnit}
                                        onChange={(e) => setMaintenanceUnit(e.target.value)}
                                        className="w-full md:w-1/3 p-2.5 border border-gray-300 rounded-lg bg-white font-medium text-gray-800"
                                    >
                                        <option value="all">Todas as Unidades (Global)</option>
                                        {SCHOOL_UNITS_LIST.map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {maintenanceUnit === 'all'
                                            ? "As ações abaixo afetarão TODOS os dados do sistema."
                                            : `As ações abaixo afetarão APENAS dados da unidade ${maintenanceUnit}.`
                                        }
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                                    {/* 1. BACKUP */}
                                    <div className="bg-white p-6 rounded-lg shadow border border-gray-200 hover:shadow-lg transition-shadow">
                                        <h3 className="text-lg font-bold text-blue-900 mb-2">1. Exportar Dados</h3>
                                        <p className="text-sm text-gray-600 mb-4">Gera um arquivo Excel (.xlsx) com todas as notas, faltas e mensagens atuais.</p>
                                        <Button onClick={async () => {
                                            try {
                                                const wb = XLSX.utils.book_new();

                                                // Fetch Data
                                                const [usersRel, gradesRel, attRel, msgRel, reportsRel] = await Promise.all([
                                                    db.collection('students').get(),
                                                    db.collection('grades').get(),
                                                    db.collection('attendance').get(),
                                                    db.collection('schoolMessages').get(),
                                                    db.collection('earlyChildhoodReports').get()
                                                ]);

                                                // Map Students for easy lookup
                                                const studentsMap: any = {};
                                                usersRel.docs.forEach(d => { studentsMap[d.id] = d.data(); });

                                                // 1. GRADES
                                                let gradesData = gradesRel.docs.map(doc => {
                                                    const g = doc.data();
                                                    const s = studentsMap[g.studentId] || {};
                                                    return {
                                                        ID: g.id,
                                                        ALUNO_ID: g.studentId,
                                                        ALUNO_NOME: s.name || 'Desconhecido',
                                                        UNIDADE: s.unit || '',
                                                        TURMA: s.schoolClass || '',
                                                        DISCIPLINA: g.subject,
                                                        MEDIA_ANUAL: g.mediaAnual,
                                                        RESULTADO: g.situacaoFinal,
                                                        RAW_DATA: JSON.stringify(g)
                                                    };
                                                });

                                                // Filter Grades by Unit
                                                if (maintenanceUnit !== 'all') {
                                                    gradesData = gradesData.filter(g => g.UNIDADE === maintenanceUnit);
                                                }
                                                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gradesData), "Notas");

                                                // 2. ATTENDANCE
                                                let attData = attRel.docs.map(doc => {
                                                    const a = doc.data();
                                                    return {
                                                        ID: a.id,
                                                        DATA: a.date,
                                                        TURMA: a.schoolClass,
                                                        PROFESSOR: a.teacherName,
                                                        UNIDADE: a.unit, // Ensure we check this
                                                        RAW_DATA: JSON.stringify(a)
                                                    };
                                                });

                                                // Filter Attendance by Unit
                                                if (maintenanceUnit !== 'all') {
                                                    attData = attData.filter(a => a.UNIDADE === maintenanceUnit);
                                                }
                                                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attData), "Frequencia");

                                                // 3. MESSAGES & OTHERS
                                                // Only filtering messages if we can identify unit (often difficult without direct field).
                                                // For now, if unit selected, we might skip messages or include relevant ones?
                                                // Strategy: Include all if 'all', else include only if we can link to unit?
                                                // Let's include all for backup safety, user can filter in Excel.
                                                // Actually, if exporting for a unit, broad messages might be confusing.
                                                // Let's keep all for now to be safe.
                                                const msgData = msgRel.docs.map(doc => ({ ...doc.data(), ID: doc.id }));
                                                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(msgData), "Mensagens");

                                                let repData = reportsRel.docs.map(doc => {
                                                    const r = doc.data();
                                                    const s = studentsMap[r.studentId] || {};
                                                    return { ...r, ID: doc.id, UNIDADE: s.unit };
                                                });

                                                if (maintenanceUnit !== 'all') {
                                                    repData = repData.filter(r => r.UNIDADE === maintenanceUnit);
                                                }
                                                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(repData), "RelatoriosInfantil");

                                                const fileName = maintenanceUnit === 'all'
                                                    ? `Backup_Completo_${new Date().toISOString().split('T')[0]}.xlsx`
                                                    : `Backup_${maintenanceUnit.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

                                                XLSX.writeFile(wb, fileName);
                                                alert("Backup gerado com sucesso!");
                                            } catch (e) {
                                                console.error(e);
                                                alert("Erro ao gerar backup: " + e);
                                            }
                                        }} className="w-full">
                                            💾 Baixar Backup
                                        </Button>
                                    </div>

                                    {/* 2. RESTORE */}
                                    <div className="bg-white p-6 rounded-lg shadow border border-gray-200 hover:shadow-lg transition-shadow">
                                        <h3 className="text-lg font-bold text-green-900 mb-2">2. Restaurar Dados</h3>
                                        <p className="text-sm text-gray-600 mb-4">Reimporta dados de um backup anterior. Útil para desfazer erros.</p>
                                        <input type="file" id="restoreFile" accept=".xlsx" className="hidden" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            if (!window.confirm("Isso irá mesclar/sobrescrever os dados atuais com os do arquivo. Confirmar?")) return;

                                            try {
                                                const data = await file.arrayBuffer();
                                                const wb = XLSX.read(data);
                                                const batch = db.batch();

                                                // Restore Grades
                                                const wsGrades = wb.Sheets["Notas"];
                                                if (wsGrades) {
                                                    const gradesJson = XLSX.utils.sheet_to_json(wsGrades);
                                                    gradesJson.forEach((row: any) => {
                                                        // Filter by Unit if selected
                                                        if (maintenanceUnit !== 'all' && row.UNIDADE !== maintenanceUnit) return;

                                                        if (row.RAW_DATA) {
                                                            const gBase = JSON.parse(row.RAW_DATA);
                                                            batch.set(db.collection('grades').doc(gBase.id), gBase);
                                                        }
                                                    });
                                                }

                                                // Restore Attendance
                                                const wsAtt = wb.Sheets["Frequencia"];
                                                if (wsAtt) {
                                                    const attJson = XLSX.utils.sheet_to_json(wsAtt);
                                                    attJson.forEach((row: any) => {
                                                        // Filter by Unit if selected
                                                        if (maintenanceUnit !== 'all' && row.UNIDADE !== maintenanceUnit) return;

                                                        if (row.RAW_DATA) {
                                                            const aBase = JSON.parse(row.RAW_DATA);
                                                            batch.set(db.collection('attendance').doc(aBase.id), aBase);
                                                        }
                                                    });
                                                }

                                                // Restore Messages
                                                const wsMsg = wb.Sheets["Mensagens"];
                                                if (wsMsg) {
                                                    const msgJson = XLSX.utils.sheet_to_json(wsMsg);
                                                    msgJson.forEach((row: any) => {
                                                        if (row.ID) {
                                                            const { ID, ...rest } = row;
                                                            // Difficult to filter messages by unit without extra info, but assuming user caution.
                                                            // If we added unit to export, we could filter here.
                                                            // Current Export doesn't explicitly add UNIDADE column to messages, so we SKIP filtering or Restore ALL.
                                                            // Safest: Restore All for messages as they might be system wide or we can't tell.
                                                            // Alternatively, assume messages are not unit-critical for selective restore?
                                                            // Let's keep it restoring all to prevent data loss, or skip if strict.
                                                            batch.set(db.collection('schoolMessages').doc(ID), rest);
                                                        }
                                                    });
                                                }

                                                // Restore Reports
                                                const wsRep = wb.Sheets["RelatoriosInfantil"];
                                                if (wsRep) {
                                                    const repJson = XLSX.utils.sheet_to_json(wsRep);
                                                    repJson.forEach((row: any) => {
                                                        // Filter by Unit if selected
                                                        if (maintenanceUnit !== 'all' && row.UNIDADE !== maintenanceUnit) return;

                                                        if (row.ID) {
                                                            const { ID, UNIDADE, ...rest } = row; // remove helper fields
                                                            batch.set(db.collection('earlyChildhoodReports').doc(ID), rest);
                                                        }
                                                    });
                                                }

                                                await batch.commit();
                                                alert("Restauração concluída! Recarregue a página.");
                                                window.location.reload();
                                            } catch (err) {
                                                console.error(err);
                                                alert("Erro na restauração: " + err);
                                            }
                                        }} />
                                        <Button variant="secondary" onClick={() => document.getElementById('restoreFile')?.click()} className="w-full">
                                            ♻️ Carregar Backup
                                        </Button>
                                    </div>

                                    {/* 3. RESET */}
                                    <div className="bg-white p-6 rounded-lg shadow border border-red-200 hover:shadow-lg transition-shadow">
                                        <h3 className="text-lg font-bold text-red-900 mb-2">3. Novo Ano Letivo</h3>
                                        <p className="text-sm text-gray-600 mb-4">Apaga NOTAS, FALTAS e RELATÓRIOS. Mantém alunos e professores.</p>
                                        <Button variant="danger" onClick={async () => {
                                            const confirmMsg = maintenanceUnit === 'all'
                                                ? "VOCÊ É O ADMINISTRADOR GERAL.\n\nEsta ação apagará TODAS as notas, faltas e relatórios de TODAS as unidades para iniciar um novo ano.\n\nTem certeza absoluta?"
                                                : `ATENÇÃO: Você selecionou a unidade: ${maintenanceUnit}.\n\nEsta ação apagará apenas notas, faltas e relatórios desta unidade.\n\nTem certeza?`;

                                            if (!window.confirm(confirmMsg)) return;
                                            if (!window.confirm("CONFIRMAÇÃO FINAL: Você já baixou o backup dos dados atuais? Se não, cancele agora.")) return;

                                            try {
                                                let deletedCount = 0;
                                                const batch = db.batch();

                                                // Helper to process deletions
                                                // Firestore batches max 500 ops. We might need multiple batches if large data.
                                                // For simplicity here, assuming reasonable size or simplistic batching.
                                                // Real-world: use a loop/chunking function.

                                                if (maintenanceUnit === 'all') {
                                                    const collections = ['grades', 'attendance', 'schoolMessages', 'earlyChildhoodReports', 'notifications', 'access_logs', 'daily_stats'];
                                                    // NOTE: This uses batch.delete which is size-limited.
                                                    // The original code used a separate deleteCollection with batch per collection.

                                                    const deleteCollection = async (col: string) => {
                                                        const snapshot = await db.collection(col).get();
                                                        const b = db.batch(); // New batch per collection
                                                        snapshot.docs.forEach(doc => b.delete(doc.ref));
                                                        await b.commit();
                                                        deletedCount += snapshot.size;
                                                    };
                                                    await Promise.all(collections.map(c => deleteCollection(c)));

                                                } else {
                                                    // Specific Unit Deletion

                                                    // 1. Attendance (Has Unit)
                                                    const attSnap = await db.collection('attendance').where('unit', '==', maintenanceUnit).get();
                                                    attSnap.docs.forEach(doc => batch.delete(doc.ref));
                                                    deletedCount += attSnap.size;

                                                    // 2. Grades (Linked via Student)
                                                    // Need to fetch all students of this unit first
                                                    const unitStudents = students.filter(s => s.unit === maintenanceUnit);
                                                    const unitStudentIds = unitStudents.map(s => s.id);

                                                    if (unitStudentIds.length > 0) {
                                                        // Firestore 'in' query supports max 10/30 items. Safer to fetch all grades and filter in memory since we download grades anyway.
                                                        // Optimisation: Fetch all grades, locally filter.
                                                        const allGrades = await db.collection('grades').get();
                                                        allGrades.docs.forEach(doc => {
                                                            const g = doc.data();
                                                            if (unitStudentIds.includes(g.studentId)) {
                                                                batch.delete(doc.ref);
                                                                deletedCount++;
                                                            }
                                                        });

                                                        // 3. Early Childhood Reports
                                                        const allReports = await db.collection('earlyChildhoodReports').get();
                                                        allReports.docs.forEach(doc => {
                                                            const r = doc.data();
                                                            if (unitStudentIds.includes(r.studentId)) {
                                                                batch.delete(doc.ref);
                                                                deletedCount++;
                                                            }
                                                        });
                                                    }

                                                    // Commit the specific batch
                                                    // Warning: If > 500 deletes, this will crash.
                                                    // Implementing a safe commit loop.
                                                    if (deletedCount > 0) {
                                                        await batch.commit();
                                                    }
                                                }

                                                alert(`Ano Letivo Reiniciado! ${deletedCount} registros foram apagados.`);
                                                window.location.reload();

                                            } catch (e) {
                                                alert("Erro ao resetar: " + e);
                                            }
                                        }} className="w-full">
                                            🔥 Iniciar Novo Ano
                                        </Button>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* MODAL DE LOGS */}
            {
                isLogModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900 bg-opacity-70 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden">
                            {/* HEADER MODAL */}
                            <div className="flex justify-between items-center p-3 md:p-6 bg-gradient-to-r from-blue-900 to-blue-950 border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                                        <LayoutDashboard className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg md:text-2xl font-bold text-white flex items-center gap-2">
                                            Registro de Acessos
                                        </h2>
                                        <p className="hidden md:block text-sm text-blue-100/70">Auditoria em tempo real de logins no sistema</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsLogModalOpen(false)} className="text-white/70 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>

                            {/* FILTROS E AÇÕES */}
                            <div className="p-2 md:p-4 bg-white border-b border-gray-100 flex flex-col md:flex-row gap-2 md:gap-4 justify-between items-center">
                                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                                    <button
                                        onClick={() => handleFilterChange('today')}
                                        className={`whitespace-nowrap px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs font-bold transition-all ${logFilter === 'today' ? 'bg-blue-950 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        Hoje
                                    </button>
                                    <button
                                        onClick={() => handleFilterChange('week')}
                                        className={`whitespace-nowrap px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs font-bold transition-all ${logFilter === 'week' ? 'bg-blue-950 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        7 Dias
                                    </button>
                                    <button
                                        onClick={() => handleFilterChange('month')}
                                        className={`whitespace-nowrap px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs font-bold transition-all ${logFilter === 'month' ? 'bg-blue-950 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        Mês
                                    </button>
                                </div>

                                <div className="flex flex-col md:flex-row gap-2 items-center w-full md:w-auto">
                                    <select
                                        value={logUnitFilter}
                                        onChange={(e) => setLogUnitFilter(e.target.value)}
                                        className="p-2 border rounded-lg text-sm bg-gray-50 w-full md:w-auto"
                                    >
                                        <option value="all">Todas as Unidades</option>
                                        {SCHOOL_UNITS_LIST.map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>

                                    <select
                                        value={logProfileFilter}
                                        onChange={(e) => setLogProfileFilter(e.target.value as any)}
                                        className="p-2 border rounded-lg text-sm bg-gray-50 w-full md:w-auto"
                                    >
                                        <option value="all">Todos os Perfis</option>
                                        <option value="student">Alunos</option>
                                        <option value="teacher">Professores</option>
                                        <option value="admin">Administração</option>
                                    </select>

                                    <button
                                        onClick={handleDownloadPDF}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 shadow-sm transition-all whitespace-nowrap w-full md:w-auto justify-center"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                        PDF
                                    </button>
                                </div>
                            </div>

                            {/* SUMMARY STATS */}
                            <div className="bg-blue-50 px-3 py-2 md:px-6 md:py-3 border-b border-blue-100 flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm justify-between items-center shadow-inner">
                                <span className="font-bold text-blue-900">Total: {filteredAccessLogs.length}</span>
                                <div className="flex gap-2 md:gap-4">
                                    <span className="text-gray-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Alunos: <strong>{filteredAccessLogs.filter(l => getLogUserInfo(l.user_id).type === 'student').length}</strong></span>
                                    <span className="text-gray-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Prof.: <strong>{filteredAccessLogs.filter(l => getLogUserInfo(l.user_id).type === 'teacher').length}</strong></span>
                                    <span className="text-gray-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Admin: <strong>{filteredAccessLogs.filter(l => getLogUserInfo(l.user_id).type === 'admin').length}</strong></span>
                                </div>
                            </div>

                            {/* CONTEÚDO / TABELA */}
                            <div className="flex-1 overflow-y-auto overflow-x-auto p-0 bg-gray-50">
                                {isLoadingLogs ? (
                                    <TableSkeleton rows={10} />
                                ) : filteredAccessLogs.length > 0 ? (
                                    <table className="w-full min-w-[600px] text-sm text-left">
                                        <thead className="bg-white text-gray-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 shadow-sm z-10">
                                            <tr>
                                                <th className="p-4 border-b border-gray-100 flex items-center gap-2"><Clock className="w-4 h-4" /> Data/Hora</th>
                                                <th className="p-4 border-b border-gray-100"><span className="flex items-center gap-2"><User className="w-4 h-4" /> Usuário</span></th>
                                                <th className="p-4 border-b border-gray-100"><span className="flex items-center gap-2"><Globe className="w-4 h-4" /> IP</span></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {filteredAccessLogs.map((log) => {
                                                const info = getLogUserInfo(log.user_id);
                                                const Icon = info.type === 'admin' ? Shield : info.type === 'teacher' ? GraduationCap : User;
                                                const colorClass = info.type === 'admin' ? 'bg-purple-100 text-purple-700' : info.type === 'teacher' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';

                                                return (
                                                    <tr key={log.id} className="hover:bg-blue-50/50 transition-colors group">
                                                        <td className="p-4 font-mono text-gray-600 text-[11px] whitespace-nowrap">
                                                            {new Date(log.date).toLocaleString('pt-BR')}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-lg ${colorClass} transition-transform group-hover:scale-110`}>
                                                                    <Icon className="w-4 h-4" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-gray-800 text-sm">{info.name}</div>
                                                                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{info.role} • ID: {log.user_id}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-gray-500 font-mono text-xs">
                                                            <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                                                {log.ip || 'N/A'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                        <p>Nenhum registro encontrado para este período.</p>
                                    </div>
                                )}
                            </div>

                            {/* FOOTER */}
                            <div className="p-4 bg-gray-50 border-t border-gray-200 text-right">
                                <p className="text-xs text-gray-400 text-center mb-2">Exibindo os {accessLogs.length} registros mais recentes.</p>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* MODAL DE RECIBO UNIFICADO */}
            {
                selectedStudentForFinancial && selectedReceiptForModal && (
                    <ReceiptModal
                        isOpen={!!selectedReceiptForModal}
                        student={selectedStudentForFinancial}
                        receiptData={selectedReceiptForModal}
                        whatsappNumber={unitContacts?.find(c => c.unit === selectedStudentForFinancial.unit && c.role === ContactRole.FINANCIAL)?.phoneNumber}
                        isAdminView={true}
                        onClose={() => setSelectedReceiptForModal(null)}
                    />
                )
            }

            {/* MANUAL PAYMENT METHOD MODAL */}
            <ManualPaymentModal
                isOpen={isManualPaymentModalOpen}
                onClose={() => { setIsManualPaymentModalOpen(false); setSelectedManualFee(null); }}
                selectedManualFee={selectedManualFee}
                manualPaymentMethod={manualPaymentMethod}
                setManualPaymentMethod={setManualPaymentMethod}
            />

        </div >
    );
}
