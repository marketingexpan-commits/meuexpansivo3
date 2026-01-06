import React, { useState, useMemo, useEffect } from 'react';
// FIX: Add BimesterData to imports to allow for explicit typing and fix property access errors.
import { AttendanceRecord, Student, GradeEntry, BimesterData, SchoolUnit, SchoolShift, SchoolClass, Subject, AttendanceStatus, EarlyChildhoodReport, CompetencyStatus, AppNotification, SchoolMessage, MessageRecipient, MessageType, UnitContact, Teacher, Mensalidade, EventoFinanceiro, Ticket, TicketStatus, ClassMaterial } from '../types';
import { getAttendanceBreakdown } from '../src/utils/attendanceUtils'; // Import helper
import { calculateBimesterMedia, calculateFinalData, CURRICULUM_MATRIX, getCurriculumSubjects } from '../constants'; // Import Sync Fix
import { calculateAttendancePercentage, calculateAnnualAttendancePercentage, calculateGeneralFrequency } from '../utils/frequency';
import { getStudyTips } from '../services/geminiService';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { MessageBox } from './MessageBox';
import { FinanceiroScreen } from './FinanceiroScreen';
import { useNavigate } from 'react-router-dom';
import { Skeleton, TableSkeleton, GridSkeleton } from './Skeleton';
import { ErrorState } from './ErrorState';
import { useFinancialSettings } from '../hooks/useFinancialSettings';
import {
    Bot,
    CalendarDays,
    CircleHelp,
    CreditCard,
    Download,
    FileText,
    LifeBuoy,
    Lightbulb,
    Mail,
    MessageCircle,
    User,
    Folder
} from 'lucide-react';
import { db } from '../firebaseConfig';

// --- DADOS DAS UNIDADES (Definidos localmente) ---
const UNITS_DATA: Record<string, { address: string; cep: string; phone: string; email: string; cnpj: string }> = {
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

const DEFAULT_UNIT_DATA = {
    address: 'Expansivo Rede de Ensino - Matriz',
    cep: '59000-000',
    phone: '(84) 3232-0000',
    email: 'contato@expansivo.com.br',
    cnpj: '00.000.000/0001-00'
};

interface StudentDashboardProps {
    student: Student;
    grades: GradeEntry[];
    teachers?: Teacher[];
    attendanceRecords: AttendanceRecord[];
    earlyChildhoodReports?: EarlyChildhoodReport[];
    unitContacts?: UnitContact[];
    onLogout: () => void;
    onSendMessage: (message: Omit<SchoolMessage, 'id'>) => Promise<void>;
    notifications?: AppNotification[];
    onMarkNotificationAsRead?: (id: string) => Promise<void>;
    mensalidades: Mensalidade[];
    eventos: EventoFinanceiro[];
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
    student,
    grades = [],
    teachers = [],
    attendanceRecords = [],
    earlyChildhoodReports = [],
    unitContacts = [],
    onLogout,
    onSendMessage,
    notifications = [],
    onMarkNotificationAsRead,
    mensalidades = [],
    eventos = []
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', tip: '' });
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [currentView, setCurrentView] = useState<'menu' | 'grades' | 'attendance' | 'support' | 'messages' | 'early_childhood' | 'financeiro' | 'tickets' | 'materials'>('menu');
    const [showNotifications, setShowNotifications] = useState(false);

    // Estado para o sistema de Dúvidas (Tickets)
    const [ticketModalOpen, setTicketModalOpen] = useState(false);
    const [selectedTicketSubject, setSelectedTicketSubject] = useState<string>('');
    const [ticketMessage, setTicketMessage] = useState('');
    const [isTicketSending, setIsTicketSending] = useState(false);
    const [ticketSuccess, setTicketSuccess] = useState(false);
    const [studentTickets, setStudentTickets] = useState<Ticket[]>([]);
    const [isLoadingStudentTickets, setIsLoadingStudentTickets] = useState(false);

    // Estados para Materiais
    const [classMaterials, setClassMaterials] = useState<ClassMaterial[]>([]);
    const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
    const [materialsError, setMaterialsError] = useState<string | null>(null);

    const unreadNotifications = (notifications || []).filter(n => n && !n.read).length;

    // Estado para controle do semestre do relatório infantil
    const [selectedReportSemester, setSelectedReportSemester] = useState<1 | 2>(1);

    // Estado para controle do mês de frequência
    const [selectedBimester, setSelectedBimester] = useState<number>(Math.floor(new Date().getMonth() / 3) + 1);

    const MONTH_NAMES = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const semester = currentMonth >= 7 ? 2 : 1;
    const headerText = `Boletim Escolar ${currentYear}.${semester}`;

    // CORREÇÃO DE SINCRONIZAÇÃO: Recalcular médias dinamicamente
    const studentGrades = useMemo(() => {
        const subjectsInCurriculum = getCurriculumSubjects(student.gradeLevel || "");

        // 1. Pega as notas que o aluno já tem
        const existingGrades = (grades || [])
            .filter(g => g.studentId === student.id)
            .filter(g => {
                // Filtra apenas matérias que pertencem à grade curricular do nível do aluno
                if (subjectsInCurriculum.length > 0) {
                    return subjectsInCurriculum.includes(g.subject);
                }
                return true;
            })
            .map(grade => {
                const calculatedBimesters = {
                    bimester1: calculateBimesterMedia(grade.bimesters.bimester1),
                    bimester2: calculateBimesterMedia(grade.bimesters.bimester2),
                    bimester3: calculateBimesterMedia(grade.bimesters.bimester3),
                    bimester4: calculateBimesterMedia(grade.bimesters.bimester4),
                };
                const finalData = calculateFinalData(calculatedBimesters, grade.recuperacaoFinal);
                return { ...grade, bimesters: calculatedBimesters, ...finalData };
            });

        // 2. Se houver matriz curricular, garante que TODAS as matérias apareçam, mesmo sem nota
        if (subjectsInCurriculum.length > 0) {
            const finalGrades: GradeEntry[] = [...existingGrades];

            subjectsInCurriculum.forEach(subjectName => {
                const exists = existingGrades.some(g => g.subject === subjectName);
                if (!exists) {
                    // Cria uma entrada "vazia" para a matéria faltante
                    const emptyGrade: GradeEntry = {
                        id: `empty_${subjectName}_${student.id}`,
                        studentId: student.id,
                        subject: subjectName,
                        bimesters: {
                            bimester1: { nota: null, recuperacao: null, media: -1, faltas: 0 },
                            bimester2: { nota: null, recuperacao: null, media: -1, faltas: 0 },
                            bimester3: { nota: null, recuperacao: null, media: -1, faltas: 0 },
                            bimester4: { nota: null, recuperacao: null, media: -1, faltas: 0 },
                        },
                        mediaAnual: 0,
                        mediaFinal: 0,
                        situacaoFinal: 'Cursando',
                        lastUpdated: new Date().toISOString()
                    };
                    finalGrades.push(emptyGrade);
                }
            });

            // Ordena as matérias do boletim pela ordem da matriz curricular
            return finalGrades.sort((a, b) => subjectsInCurriculum.indexOf(a.subject) - subjectsInCurriculum.indexOf(b.subject));
        }

        return existingGrades;
    }, [grades, student.id, student.gradeLevel]);

    const { settings: contactSettings } = useFinancialSettings(student.unit);

    const currentUnitInfo = useMemo(() => {
        const staticData = UNITS_DATA[student.unit] || DEFAULT_UNIT_DATA;
        if (contactSettings) {
            return {
                ...staticData,
                phone: contactSettings.whatsapp && contactSettings.whatsapp.replace(/\D/g, '').length >= 10
                    ? contactSettings.whatsapp
                    : staticData.phone,
                email: contactSettings.email || staticData.email,
            };
        }
        return staticData;
    }, [student.unit, contactSettings]);

    // Verifica se o aluno é da educação infantil
    const isEarlyChildhood = useMemo(() => {
        const grade = student.gradeLevel.toLowerCase();
        return grade.includes('nível') || grade.includes('infantil') || grade.includes('edu. infantil');
    }, [student.gradeLevel]);

    // Busca o relatório correspondente (apenas se for Ed. Infantil)
    const currentReport = useMemo(() => {
        if (!isEarlyChildhood) return null;
        return earlyChildhoodReports?.find(
            r => r.studentId === student.id &&
                r.year === currentYear &&
                r.semester === selectedReportSemester
        );
    }, [isEarlyChildhood, earlyChildhoodReports, student.id, currentYear, selectedReportSemester]);

    const studentAttendance = useMemo(() => {
        return (attendanceRecords || [])
            .filter(record => record && record.studentStatus && record.studentStatus[student.id])
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [attendanceRecords, student.id]);

    const absencesThisYear = useMemo(() => {
        return studentAttendance.filter(record => {
            const recordDate = new Date(record.date + 'T00:00:00');
            return recordDate.getFullYear() === currentYear && record.studentStatus[student.id] === AttendanceStatus.ABSENT;
        }).length;
    }, [studentAttendance, currentYear, student.id]);


    const formatGrade = (grade: number | null | undefined) => (grade !== null && grade !== undefined && grade !== -1) ? grade.toFixed(1) : '-';

    const getTeacherPhone = (subjectName: string) => {
        const teacher = teachers.find(t =>
            t.subjects &&
            t.subjects.includes(subjectName as any) &&
            t.unit === student.unit
        );

        const fallbackTeacher = teachers.find(t => t.subjects && t.subjects.includes(subjectName as any));

        return teacher ? teacher.phoneNumber : fallbackTeacher?.phoneNumber;
    };

    const getTeacherName = (subjectName: string) => {
        const teacher = teachers.find(t =>
            t.subjects &&
            t.subjects.includes(subjectName as any) &&
            t.unit === student.unit
        );

        const fallbackTeacher = teachers.find(t => t.subjects && t.subjects.includes(subjectName as any));

        return teacher ? teacher.name : (fallbackTeacher ? fallbackTeacher.name : 'Professor não atribuído');
    };

    const handleGetHelp = async (subject: Subject, difficultyTopic: string) => {
        if (!difficultyTopic) return;
        setModalContent({ title: `Tutor IA: ${subject}`, tip: '' });
        setIsModalOpen(true);
        setIsLoadingAI(true);
        try {
            const tips = await getStudyTips(subject, difficultyTopic, student.gradeLevel);
            setModalContent({ title: `Tutor IA: ${subject}`, tip: tips });
        } catch (error) {
            setModalContent({ title: 'Erro', tip: "Não foi possível conectar ao tutor IA no momento." });
        } finally {
            setIsLoadingAI(false);
        }
    };

    const handleDownloadPDF = () => {
        setTimeout(() => {
            window.print();
        }, 100);
    };

    // CORREÇÃO: Adicionar verificação de segurança para bimesters
    const supportNeededGrades = studentGrades.filter(g => {
        if (!g.bimesters) return false; // Verificação de segurança

        const media = g.mediaAnual || 0;
        const isLowGrade = media < 7.0 && g.situacaoFinal !== 'Aprovado';
        const isWarningGrade = media >= 7.0 && media <= 8.5;
        const isHighGrade = media > 8.5;
        // FIX: Explicitly type 'b' to resolve 'unknown' type from Object.values
        const hasDifficulty = Object.values(g.bimesters).some((b: BimesterData) =>
            b && b.difficultyTopic && b.difficultyTopic.trim().length > 5
        );

        return isLowGrade || isWarningGrade || isHighGrade || hasDifficulty;
    });

    const getStatusBadge = (status: CompetencyStatus | null) => {
        switch (status) {
            case CompetencyStatus.DEVELOPED:
                return <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-bold border border-green-200">D - Desenvolvido</span>;
            case CompetencyStatus.IN_PROCESS:
                return <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-bold border border-yellow-200">EP - Em Processo</span>;
            case CompetencyStatus.NOT_OBSERVED:
                return <span className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-bold border border-red-200">NO - Não Observado</span>;
            default:
                return <span className="px-2 py-1 rounded bg-gray-100 text-gray-500 text-xs border border-gray-200">-</span>;
        }
    };

    // CORREÇÃO: Função auxiliar para sanitizar HTML
    const sanitizeAndFormatTip = (tip: string) => {
        if (!tip) return '';
        return tip
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br/>');
    };

    const handleOpenTicketModal = (subject: string) => {
        setSelectedTicketSubject(subject);
        setTicketMessage('');
        setTicketSuccess(false);
        setTicketModalOpen(true);
    };

    const handleSendTicket = async () => {
        if (!ticketMessage.trim() || !selectedTicketSubject) return;
        setIsTicketSending(true);

        try {
            const ticket: Ticket = {
                id: `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                studentId: student.id,
                studentName: student.name,
                gradeLevel: student.gradeLevel,
                schoolClass: student.schoolClass,
                unit: student.unit,
                subject: selectedTicketSubject,
                message: ticketMessage,
                timestamp: new Date().toISOString(),
                status: TicketStatus.PENDING
            };

            await db.collection('tickets_pedagogicos').doc(ticket.id).set(ticket);
            setTicketSuccess(true);
            setTimeout(() => {
                setTicketModalOpen(false);
                setTicketSuccess(false);
            }, 3000);
        } catch (error) {
            console.error("Erro ao enviar ticket:", error);
            alert("Erro ao enviar dúvida. Tente novamente.");
        } finally {
            setIsTicketSending(false);
        }
    };

    // Load Student Tickets
    useEffect(() => {
        if (currentView === 'tickets') {
            loadStudentTickets();
        }
    }, [currentView]);

    const loadStudentTickets = async () => {
        setIsLoadingStudentTickets(true);
        try {
            const snapshot = await db.collection('tickets_pedagogicos')
                .where('studentId', '==', student.id)
                .get();

            const tickets = snapshot.docs.map(doc => doc.data() as Ticket);
            // Sort by date (newest first)
            tickets.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setStudentTickets(tickets);
        } catch (error) {
            console.error("Erro ao carregar dúvidas:", error);
        } finally {
            setIsLoadingStudentTickets(false);
        }
    };

    // --- MATERIALS LOADING LOGIC ---
    useEffect(() => {
        if (currentView === 'materials') {
            loadClassMaterials();
        }
    }, [currentView]);

    const loadClassMaterials = async () => {
        setIsLoadingMaterials(true);
        setMaterialsError(null); // Reset error
        try {
            console.log("Fetching materials for:", {
                unit: student.unit,
                grade: student.gradeLevel,
                class: student.schoolClass,
                shift: student.shift
            });

            // Filter ONLY by unit in Firestore to avoid complex composite index requirements
            const snapshot = await db.collection('materials')
                .where('unit', '==', student.unit)
                .get();

            const allMats = snapshot.docs.map(doc => doc.data() as ClassMaterial);

            // Filter by Grade, Class, and Shift in memory
            const mats = allMats.filter(mat =>
                mat.gradeLevel === student.gradeLevel &&
                mat.schoolClass === student.schoolClass &&
                mat.shift === student.shift
            );

            // Sort by Timestamp Desc
            mats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setClassMaterials(mats);
        } catch (error: any) {
            console.error("Erro ao carregar materiais:", error);
            setMaterialsError(error.message || "Erro desconhecido ao carregar materiais.");
        } finally {
            setIsLoadingMaterials(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans transition-all duration-500 ease-in-out print:min-h-0 print:h-auto print:bg-white print:p-0 print:block print:overflow-visible">
            <div className={`w-full bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col transition-all duration-500 ease-in-out ${currentView === 'menu' ? 'max-w-md' : 'max-w-5xl'} print:min-h-0 print:h-auto print:shadow-none print:rounded-none`}>

                {/* Minimal Header Bar - For all views EXCEPT menu */}
                {currentView !== 'menu' && (
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white shrink-0 print:hidden">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setCurrentView('menu')}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <button
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    className="p-2 text-gray-600 hover:text-gray-800 transition-colors relative hover:bg-gray-100 rounded-full"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                                    {unreadNotifications > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full border-2 border-white shadow-sm transform scale-100">
                                            {unreadNotifications}
                                        </span>
                                    )}
                                </button>
                                {showNotifications && (
                                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black ring-opacity-5 text-left">
                                        <div className="p-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                                            <h4 className="font-bold text-blue-900 text-sm">Notificações</h4>
                                            <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            </button>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto">
                                            {notifications.length > 0 ? (
                                                notifications.map(n => (
                                                    <div
                                                        key={n.id}
                                                        className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}
                                                        onClick={() => {
                                                            if (!n.read && onMarkNotificationAsRead) onMarkNotificationAsRead(n.id);

                                                            const titleLower = n.title.toLowerCase();
                                                            const messageLower = n.message.toLowerCase();

                                                            if (titleLower.includes('boletim') || titleLower.includes('nota') || messageLower.includes('boletim')) {
                                                                setCurrentView(isEarlyChildhood ? 'early_childhood' : 'grades');
                                                            } else if (titleLower.includes('frequência') || titleLower.includes('falta')) {
                                                                setCurrentView('attendance');
                                                            } else if (titleLower.includes('financeiro') || titleLower.includes('mensalidade') || titleLower.includes('pagamento')) {
                                                                setCurrentView('financeiro');
                                                            } else if (titleLower.includes('material') || titleLower.includes('conteúdo') || titleLower.includes('aula')) {
                                                                setCurrentView('materials');
                                                            } else {
                                                                setCurrentView('tickets');
                                                            }

                                                            setShowNotifications(false);
                                                        }}
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="font-bold text-xs text-gray-800">{n.title}</span>
                                                            <span className="text-[10px] text-gray-400">{new Date(n.timestamp).toLocaleDateString()}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-600 line-clamp-2">{n.message}</p>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-4 text-center text-gray-500 text-xs italic">
                                                    Nenhuma notificação.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Button variant="secondary" onClick={onLogout} className="text-sm font-semibold py-1.5 px-4">Sair</Button>
                        </div>
                    </div>
                )}

                <div className={`p-4 md:p-6 pt-2 bg-white min-h-[500px] ${(currentView === 'grades' || currentView === 'early_childhood') ? 'print:mt-0' : ''}`}>

                    {currentView === 'menu' && (
                        <div className="animate-fade-in-up flex flex-col h-full justify-between">
                            <div className="space-y-1">
                                {/* Informational Banner Area */}
                                <div className="flex gap-3 mb-4">
                                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 flex-1 flex flex-col justify-center">
                                        <div className="flex items-start gap-3">
                                            <div className="bg-blue-500 p-2 rounded-lg shrink-0">
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-blue-900 font-bold text-sm tracking-wide">Rematrículas Abertas 2026</h3>
                                                    <span className="bg-green-500 text-[9px] px-1.5 py-0.5 rounded text-white font-extrabold uppercase tracking-wide">Novo</span>
                                                </div>
                                                <p className="text-blue-700 text-xs leading-tight">
                                                    Garanta sua renovação com condições especiais até o final do mês. Procure a secretaria!
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Buttons separate column */}
                                    <div className="flex flex-col items-end justify-center gap-2 shrink-0">
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowNotifications(!showNotifications)}
                                                className="p-2 text-gray-600 hover:text-gray-800 transition-colors relative hover:bg-gray-100 rounded-full"
                                            >
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                                                {unreadNotifications > 0 && (
                                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full border-2 border-white shadow-sm transform scale-100">
                                                        {unreadNotifications}
                                                    </span>
                                                )}
                                            </button>
                                            {showNotifications && (
                                                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black ring-opacity-5 text-left">
                                                    <div className="p-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                                                        <h4 className="font-bold text-blue-900 text-sm">Notificações</h4>
                                                        <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                        </button>
                                                    </div>
                                                    <div className="max-h-60 overflow-y-auto">
                                                        {notifications.length > 0 ? (
                                                            notifications.map(n => (
                                                                <div
                                                                    key={n.id}
                                                                    className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}
                                                                    onClick={() => {
                                                                        if (!n.read && onMarkNotificationAsRead) onMarkNotificationAsRead(n.id);

                                                                        const titleLower = n.title.toLowerCase();
                                                                        const messageLower = n.message.toLowerCase();

                                                                        if (titleLower.includes('boletim') || titleLower.includes('nota') || messageLower.includes('boletim')) {
                                                                            setCurrentView(isEarlyChildhood ? 'early_childhood' : 'grades');
                                                                        } else if (titleLower.includes('frequência') || titleLower.includes('falta')) {
                                                                            setCurrentView('attendance');
                                                                        } else if (titleLower.includes('financeiro') || titleLower.includes('mensalidade') || titleLower.includes('pagamento')) {
                                                                            setCurrentView('financeiro');
                                                                        } else if (titleLower.includes('material') || titleLower.includes('conteúdo') || titleLower.includes('aula')) {
                                                                            setCurrentView('materials');
                                                                        } else {
                                                                            setCurrentView('tickets');
                                                                        }

                                                                        setShowNotifications(false);
                                                                    }}
                                                                >
                                                                    <div className="flex justify-between items-start mb-1">
                                                                        <span className="font-bold text-xs text-gray-800">{n.title}</span>
                                                                        <span className="text-[10px] text-gray-400">{new Date(n.timestamp).toLocaleDateString()}</span>
                                                                    </div>
                                                                    <p className="text-xs text-gray-600 line-clamp-2">{n.message}</p>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="p-4 text-center text-gray-500 text-xs italic">
                                                                Nenhuma notificação.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <Button variant="secondary" onClick={onLogout} className="text-sm font-semibold py-1.5 px-4">Sair</Button>
                                    </div>
                                </div>

                                {/* Student Info Card */}
                                <div className="bg-blue-50/50 py-3 px-4 rounded-lg border border-blue-100 mb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Aluno(a)</span>
                                            <span className="text-sm font-bold text-blue-900 leading-tight">{student.name}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Turma / Turno</span>
                                            <div className="text-right">
                                                <span className="text-xs font-bold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200 block">
                                                    {student.gradeLevel || 'N/A'} <span className="text-gray-300">|</span> {student.shift}
                                                </span>
                                                <span className="text-[10px] font-semibold text-gray-500 mt-0.5 block">{student.unit}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mt-12 mb-14">
                                    <div className="h-9 w-auto">
                                        <SchoolLogo className="!h-full w-auto drop-shadow-sm" />
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <span className="text-[10px] text-blue-950 font-bold uppercase tracking-widest leading-none mb-0">Aplicativo</span>
                                        <h1 className="text-lg font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                                        <span className="text-[10px] text-blue-950/60 font-semibold uppercase tracking-wider leading-none mt-1.5">Portal da Família</span>
                                    </div>
                                </div>
                                <div className="text-left pb-4">
                                    <p className="text-gray-500 text-sm">Selecione uma opção para visualizar.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setCurrentView(isEarlyChildhood ? 'early_childhood' : 'grades')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <FileText className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm">{isEarlyChildhood ? 'Relatório de Desenvolvimento' : 'Boletim Escolar'}</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('attendance')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-green-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-green-100 transition-colors">
                                            <CalendarDays className="w-6 h-6 text-green-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Registro de frequência</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('support')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-purple-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-purple-100 transition-colors">
                                            <LifeBuoy className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center leading-tight">Centro de Suporte ao Aluno</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('messages')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-orange-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-orange-100 transition-colors">
                                            <MessageCircle className="w-6 h-6 text-orange-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight text-center">Fale com a Escola</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('tickets')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-yellow-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-yellow-100 transition-colors">
                                            <CircleHelp className="w-6 h-6 text-yellow-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight text-center">Minhas Dúvidas</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('materials')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-teal-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-teal-100 transition-colors">
                                            <Folder className="w-6 h-6 text-teal-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight text-center">Biblioteca de Materiais</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('financeiro')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-600 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <CreditCard className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight text-center">Financeiro</h3>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentView === 'financeiro' && <FinanceiroScreen student={student} mensalidades={mensalidades} eventos={eventos} unitContacts={unitContacts} contactSettings={contactSettings} />}

                    {currentView === 'attendance' && (
                        <div className="mb-8 print:hidden">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                                <CalendarDays className="w-6 h-6 text-green-600" />
                                Registro de frequência
                            </h3>
                            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
                                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                                    <p className="text-gray-600 text-sm">
                                        {(() => {
                                            const breakdown = getAttendanceBreakdown(studentAttendance, student.id, undefined, currentYear);
                                            const bimesterSummary = Object.entries(breakdown)
                                                .filter(([_, data]) => data.count > 0)
                                                .map(([bim, data]) => `${bim}º Bim: ${data.count}`)
                                                .join(" | ");

                                            return (
                                                <>
                                                    {bimesterSummary ? (
                                                        <span className="font-bold text-gray-800">{bimesterSummary}</span>
                                                    ) : (
                                                        <span className="font-bold text-gray-800">Sem faltas registradas</span>
                                                    )}
                                                    <span className="mx-2 text-gray-400">|</span>
                                                    <span>Total: <span className="font-bold text-gray-800">{absencesThisYear} falta(s)</span></span>
                                                </>
                                            );
                                        })()}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-bold text-gray-700">Visualizar:</label>
                                        <select
                                            value={selectedBimester}
                                            onChange={(e) => setSelectedBimester(Number(e.target.value))}
                                            className="p-2 border border-blue-200 bg-blue-50 text-blue-900 rounded-md text-sm font-bold focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value={1}>1º Bimestre</option>
                                            <option value={2}>2º Bimestre</option>
                                            <option value={3}>3º Bimestre</option>
                                            <option value={4}>4º Bimestre</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {(() => {
                                        const bimesterRecords = studentAttendance.filter(record => {
                                            if (record.studentStatus[student.id] !== AttendanceStatus.ABSENT) return false;
                                            const [y, mStr] = record.date.split('-');
                                            const yNum = Number(y);
                                            const mNum = Number(mStr);
                                            if (yNum !== currentYear) return false;

                                            const recordBim = Math.floor((mNum - 1) / 3) + 1;
                                            return recordBim === selectedBimester;
                                        });

                                        if (bimesterRecords.length === 0) {
                                            return (
                                                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                                    <p>Nenhuma falta registrada no {selectedBimester}º Bimestre.</p>
                                                </div>
                                            );
                                        }

                                        const groupedByMonth: Record<string, AttendanceRecord[]> = {};
                                        bimesterRecords.forEach(record => {
                                            const mNum = Number(record.date.split('-')[1]);
                                            const monthName = MONTH_NAMES[mNum - 1];
                                            if (!groupedByMonth[monthName]) groupedByMonth[monthName] = [];
                                            groupedByMonth[monthName].push(record);
                                        });

                                        Object.keys(groupedByMonth).forEach(m => {
                                            groupedByMonth[m].sort((a, b) => a.date.localeCompare(b.date));
                                        });

                                        return Object.entries(groupedByMonth).map(([monthName, records]) => (
                                            <div key={monthName} className="border-l-4 border-red-400 pl-4 py-1">
                                                <h4 className="font-bold text-gray-800 text-lg mb-2 capitalize">{monthName}</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {records.map(record => {
                                                        const day = record.date.split('-')[2];
                                                        return (
                                                            <span key={record.id} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100 shadow-sm">
                                                                Dia {day} <span className="mx-1 text-red-300">|</span> {record.discipline}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentView === 'materials' && (
                        <div className="mb-8 print:hidden">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                                <Folder className="w-6 h-6 text-teal-600" />
                                Biblioteca de Materiais
                            </h3>
                            <div className="w-full bg-white p-6 border rounded-lg shadow-md h-[600px] flex flex-col">
                                <div className="flex-1 overflow-y-auto pr-2">
                                    {isLoadingMaterials ? (
                                        <GridSkeleton count={4} />
                                    ) : materialsError ? (
                                        <ErrorState
                                            title="Erro ao carregar materiais"
                                            message={materialsError}
                                            onRetry={() => {
                                                setIsLoadingMaterials(true);
                                                setMaterialsError(null);
                                                // The actual listener is in App.tsx or managed by parent, 
                                                // so we just reset state to trigger re-render if it's dynamic.
                                            }}
                                        />
                                    ) : classMaterials.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {classMaterials.map(mat => (
                                                <div key={mat.id} className="bg-gray-50 hover:bg-white p-4 rounded-lg shadow-sm hover:shadow-md border border-gray-200 transition-all group">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wide">{mat.subject}</span>
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 uppercase tracking-wide">{mat.shift}</span>
                                                            </div>
                                                            <h3 className="font-bold text-gray-800 text-lg leading-tight mb-1">{mat.title}</h3>
                                                            <p className="text-xs text-gray-500">
                                                                Prof. {mat.teacherName.split(' ')[0]} • {new Date(mat.timestamp).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        <div className="bg-white p-2 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                                            <FileText className="w-5 h-5 text-red-500" />
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={mat.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-sm transition-colors"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Baixar Material
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                            <Folder className="w-16 h-16 mb-4 opacity-20" />
                                            <p className="italic text-lg">Nenhum material disponível para sua turma no momento.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {(currentView === 'grades' || currentView === 'early_childhood') && (
                        <div className="animate-fade-in-up">
                            <div className="mb-8 border-b-2 border-blue-950 pb-4">
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="print:block hidden w-20">
                                            <SchoolLogo variant="header" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-extrabold text-blue-950 uppercase tracking-wide">EXPANSIVO REDE DE ENSINO</h2>
                                            <h3 className="text-lg font-bold text-gray-700 uppercase">UNIDADE: {student.unit}</h3>

                                            <div className="mt-2 text-xs text-gray-500 space-y-0.5 font-medium">
                                                <p>{currentUnitInfo.address} - CEP: {currentUnitInfo.cep}</p>
                                                <p>CNPJ: {currentUnitInfo.cnpj}</p>
                                                <p>Tel: {currentUnitInfo.phone} | E-mail: {currentUnitInfo.email}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-left md:text-right w-full md:w-auto">
                                        <h4 className="text-xl font-bold text-gray-800 uppercase">{isEarlyChildhood ? 'Relatório de Desenvolvimento' : headerText}</h4>
                                        <p className="text-xs text-gray-500 mt-1">Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>

                                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8 text-sm">
                                    <div>
                                        <span className="font-bold text-gray-600 uppercase text-xs block">Aluno</span>
                                        <span className="font-bold text-gray-900 text-lg">{student.name}</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-600 uppercase text-xs block">Matrícula</span>
                                        <span className="font-mono text-gray-900">{student.code}</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-600 uppercase text-xs block">Série/Ano</span>
                                        <span className="text-gray-900">{student.gradeLevel}</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-600 uppercase text-xs block">Turma/Turno</span>
                                        <span className="text-gray-900">{student.schoolClass} - {student.shift}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6 flex justify-end print:hidden">
                                <Button
                                    type="button"
                                    onClick={handleDownloadPDF}
                                    className="flex items-center gap-2"
                                >
                                    <Download className="w-5 h-5" />
                                    {isEarlyChildhood ? 'Baixar Relatório (PDF)' : 'Baixar Boletim (PDF)'}
                                </Button>
                            </div>

                            {isEarlyChildhood ? (
                                <div className="space-y-6">
                                    <div className="flex gap-4 mb-4 print:hidden">
                                        <button
                                            onClick={() => setSelectedReportSemester(1)}
                                            className={`flex-1 md:flex-none px-4 py-2 rounded font-bold text-sm transition-colors ${selectedReportSemester === 1 ? 'bg-blue-950 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                        >
                                            1º Semestre
                                        </button>
                                        <button
                                            onClick={() => setSelectedReportSemester(2)}
                                            className={`flex-1 md:flex-none px-4 py-2 rounded font-bold text-sm transition-colors ${selectedReportSemester === 2 ? 'bg-blue-950 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                                        >
                                            2º Semestre
                                        </button>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                                        <h3 className="text-center font-bold text-xl text-blue-950 mb-2 uppercase">Relatório - {selectedReportSemester}º Semestre</h3>

                                        <div className="flex flex-wrap justify-center gap-4 my-6 text-xs">
                                            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-100 border border-green-300 rounded-sm flex-shrink-0"></span> <span className="whitespace-nowrap"><strong>D</strong> - Desenvolvido</span></div>
                                            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded-sm flex-shrink-0"></span> <span className="whitespace-nowrap"><strong>EP</strong> - Em Processo</span></div>
                                            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-100 border border-red-300 rounded-sm flex-shrink-0"></span> <span className="whitespace-nowrap"><strong>NO</strong> - Não Observado</span></div>
                                        </div>

                                        {currentReport && currentReport.fields ? (
                                            <>
                                                <div className="space-y-6">
                                                    {currentReport.fields.map(field => (
                                                        <div key={field.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                                            <div className="bg-gray-100 px-4 py-2 font-bold text-gray-800 text-sm uppercase border-b border-gray-200">
                                                                {field.name}
                                                            </div>
                                                            <div className="divide-y divide-gray-100">
                                                                {field.competencies && field.competencies.map(comp => (
                                                                    <div key={comp.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
                                                                        <p className="text-sm text-gray-700">{comp.description}</p>
                                                                        <div className="flex-shrink-0">
                                                                            {getStatusBadge(comp.status)}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="mt-8 border border-gray-200 rounded-lg p-6 bg-blue-50/30">
                                                    <h4 className="font-bold text-blue-950 mb-3 flex items-center gap-2">
                                                        <MessageCircle className="w-5 h-5" />
                                                        Observações do Professor(a)
                                                    </h4>
                                                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap italic">
                                                        {currentReport.teacherObservations || "Nenhuma observação registrada."}
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="py-12 text-center text-gray-500 italic">
                                                <p>O relatório deste semestre ainda não foi disponibilizado pelos professores.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto pb-4 w-full print:overflow-visible print:w-full print:pb-0">
                                        <table className="min-w-[1000px] print:min-w-0 print:w-full divide-y divide-gray-200 border border-gray-300 text-sm print:text-[8px] print:leading-tight">
                                            <thead className="bg-blue-50 print:bg-gray-100">
                                                <tr>
                                                    <th rowSpan={2} className="px-2 py-3 text-left font-bold text-gray-700 uppercase border-r border-gray-300 w-20 md:w-32 sticky left-0 bg-blue-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[10px] md:text-sm">Disciplina</th>
                                                    {[1, 2, 3, 4].map(num => (
                                                        <th key={num} colSpan={5} className="px-1 py-2 text-center font-bold text-gray-700 uppercase border-r border-gray-300">
                                                            {num}º Bim
                                                        </th>
                                                    ))}
                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-16 text-[10px] leading-tight">Média<br />Anual</th>
                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-amber-700 uppercase border-r border-gray-300 bg-amber-50 w-16 text-[10px] leading-tight">Prova<br />Final</th>
                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-blue-950 uppercase border-r border-gray-300 bg-blue-100 w-16 text-[10px] leading-tight">Média<br />Final</th>
                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-16 text-[10px] leading-tight">%<br />Tot</th>
                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase w-20 text-[10px]">Situação</th>
                                                </tr>
                                                <tr className="bg-blue-50 print:bg-gray-100 text-[10px]">
                                                    {[1, 2, 3, 4].map(num => (
                                                        <React.Fragment key={num}>
                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600" title="Nota">N{num}</th>
                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600" title="Recuperação">R{num}</th>
                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-bold text-blue-950 bg-blue-50" title="Média">M{num}</th>
                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600" title="Faltas">F{num}</th>
                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-bold text-gray-700 bg-gray-50" title="Frequência">%</th>
                                                        </React.Fragment>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {studentGrades.map((grade) => (
                                                    <tr key={grade.id} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                                                        <td className="px-2 py-2 font-bold text-gray-900 border-r border-gray-300 text-[10px] md:text-xs sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top">
                                                            <span className="uppercase block leading-tight mb-1">{grade.subject}</span>
                                                            <span className="text-[9px] text-gray-500 font-normal block italic whitespace-normal leading-tight break-words">
                                                                Prof. {getTeacherName(grade.subject)}
                                                            </span>
                                                        </td>
                                                        {['bimester1', 'bimester2', 'bimester3', 'bimester4'].map((key) => {
                                                            const bData = grade.bimesters[key as keyof typeof grade.bimesters];
                                                            const bimesterNum = Number(key.replace('bimester', '')) as 1 | 2 | 3 | 4;

                                                            const currentAbsences = studentAttendance.reduce((acc, att) => {
                                                                if (att.discipline !== grade.subject) return acc;
                                                                if (att.studentStatus[student.id] === AttendanceStatus.ABSENT) {
                                                                    const d = new Date(att.date + 'T00:00:00');
                                                                    if (d.getFullYear() === currentYear) {
                                                                        const m = d.getMonth();

                                                                        if (bimesterNum === 1 && m >= 0 && m <= 2) return acc + 1;
                                                                        if (bimesterNum === 2 && m >= 3 && m <= 5) return acc + 1;
                                                                        if (bimesterNum === 3 && m >= 6 && m <= 8) return acc + 1;
                                                                        if (bimesterNum === 4 && m >= 9 && m <= 11) return acc + 1;
                                                                    }
                                                                }
                                                                return acc;
                                                            }, 0);

                                                            return (
                                                                <React.Fragment key={key}>
                                                                    <td className="px-1 py-1 text-center text-gray-500 font-medium text-[10px] md:text-sm border-r border-gray-300 relative">
                                                                        {bData.isNotaApproved !== false ? formatGrade(bData.nota) : <span className="text-gray-300 pointer-events-none select-none cursor-help" title="Esta nota está em processo de atualização pela coordenação pedagógica.">-</span>}
                                                                        {bData.isNotaApproved === false && (
                                                                            <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-yellow-400 rounded-full cursor-help" title="Esta nota está em processo de atualização pela coordenação pedagógica."></div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-1 py-1 text-center text-gray-400 text-[10px] md:text-xs border-r border-gray-300 relative">
                                                                        {bData.isRecuperacaoApproved !== false ? formatGrade(bData.recuperacao) : <span className="text-gray-300 pointer-events-none select-none cursor-help" title="Esta nota está em processo de atualização pela coordenação pedagógica.">-</span>}
                                                                        {bData.isRecuperacaoApproved === false && (
                                                                            <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-yellow-400 rounded-full cursor-help" title="Esta nota está em processo de atualização pela coordenação pedagógica."></div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-1 py-2 text-center text-black font-bold bg-gray-50 border-r border-gray-300 text-xs">{(bData.isNotaApproved !== false && bData.isRecuperacaoApproved !== false) ? formatGrade(bData.media) : '-'}</td>
                                                                    <td className="px-1 py-1 text-center text-gray-400 text-[10px] md:text-xs border-r border-gray-300">
                                                                        {bData.faltas !== undefined && bData.faltas !== null ? bData.faltas : (currentAbsences || '')}
                                                                    </td>
                                                                    {(() => {
                                                                        const absences = bData.faltas !== undefined && bData.faltas !== null ? bData.faltas : currentAbsences;
                                                                        const freqPercent = calculateAttendancePercentage(grade.subject, absences, student.gradeLevel);

                                                                        // Só exibe a porcentagem se houver pelo menos uma falta
                                                                        const hasAbsence = absences > 0;
                                                                        const isLowFreq = hasAbsence && freqPercent !== null && freqPercent < 75;

                                                                        return (
                                                                            <td className={`px-1 py-1 text-center font-bold border-r border-gray-300 text-[10px] md:text-xs ${isLowFreq ? 'text-red-600 bg-red-50' : 'text-gray-500'}`} title="Frequência">
                                                                                {hasAbsence && freqPercent !== null ? `${freqPercent}%` : '-'}
                                                                            </td>
                                                                        );
                                                                    })()}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                        <td className="px-1 py-2 text-center font-bold text-gray-700 border-r border-gray-300 bg-gray-50 text-sm">
                                                            {Object.values(grade.bimesters).every((b: any) => b.isNotaApproved !== false && b.isRecuperacaoApproved !== false) ? formatGrade(grade.mediaAnual) : '-'}
                                                        </td>
                                                        <td className={`px-1 py-1 text-center font-bold text-amber-600 text-[10px] md:text-xs border-r border-gray-300 ${grade.recuperacaoFinalApproved === false ? 'bg-yellow-100' : 'bg-amber-50/30'}`}>
                                                            {grade.recuperacaoFinalApproved !== false ? formatGrade(grade.recuperacaoFinal) : <span className="text-gray-300">-</span>}
                                                        </td>
                                                        <td className="px-1 py-1 text-center font-extrabold text-blue-900 bg-blue-50/50 text-xs md:text-sm border-r border-gray-300">
                                                            {(grade.recuperacaoFinalApproved !== false && Object.values(grade.bimesters).every((b: any) => b.isNotaApproved !== false && b.isRecuperacaoApproved !== false)) ? formatGrade(grade.mediaFinal) : '-'}
                                                        </td>
                                                        {(() => {
                                                            const totalAbsences = [grade.bimesters.bimester1, grade.bimesters.bimester2, grade.bimesters.bimester3, grade.bimesters.bimester4].reduce((sum, b, idx) => {
                                                                const bNum = (idx + 1) as 1 | 2 | 3 | 4;
                                                                if (b.faltas !== undefined && b.faltas !== null) return sum + b.faltas;

                                                                // Dynamic calculation fallback
                                                                const currentBimAbsences = studentAttendance.reduce((acc, att) => {
                                                                    if (att.discipline !== grade.subject) return acc;
                                                                    if (att.studentStatus[student.id] === AttendanceStatus.ABSENT) {
                                                                        const d = new Date(att.date + 'T00:00:00');
                                                                        if (d.getFullYear() === currentYear) {
                                                                            const m = d.getMonth();
                                                                            if (bNum === 1 && m >= 0 && m <= 2) return acc + 1;
                                                                            if (bNum === 2 && m >= 3 && m <= 5) return acc + 1;
                                                                            if (bNum === 3 && m >= 6 && m <= 8) return acc + 1;
                                                                            if (bNum === 4 && m >= 9 && m <= 11) return acc + 1;
                                                                        }
                                                                    }
                                                                    return acc;
                                                                }, 0);
                                                                return sum + currentBimAbsences;
                                                            }, 0);

                                                            const annualFreq = calculateAnnualAttendancePercentage(grade.subject, totalAbsences, student.gradeLevel);
                                                            const isCritical = annualFreq !== null && annualFreq < 75;
                                                            // Só mostra se houver pelo menos uma falta em todo o ano
                                                            const hasAbsenceTotal = totalAbsences > 0;

                                                            return (
                                                                <td className={`px-1 py-1 text-center font-bold border-r border-gray-300 text-[10px] md:text-xs ${isCritical ? 'text-red-600 bg-red-50' : 'text-gray-500'}`} title="Frequência Anual">
                                                                    {hasAbsenceTotal && annualFreq !== null ? `${annualFreq}%` : '-'}
                                                                </td>
                                                            );
                                                        })()}
                                                        <td className="px-1 py-2 text-center align-middle">
                                                            <span className={`inline-block w-full py-0.5 rounded text-[9px] uppercase font-bold border ${grade.situacaoFinal === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                grade.situacaoFinal === 'Recuperação' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                    (grade.situacaoFinal === 'Cursando' || grade.situacaoFinal === 'Pendente') ? 'bg-gray-50 text-gray-500 border-gray-200' :
                                                                        'bg-red-50 text-red-700 border-red-200'
                                                                }`}>
                                                                {grade.situacaoFinal}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {studentGrades.length > 0 && (() => {
                                                    const generalFreq = calculateGeneralFrequency(studentGrades, attendanceRecords, student.id, student.gradeLevel);
                                                    return (
                                                        <tr className="bg-gray-100/80 font-bold border-t-2 border-gray-400">
                                                            <td colSpan={19} className="px-4 py-1 text-right uppercase tracking-wider text-blue-950 font-extrabold text-[11px]">
                                                                FREQUÊNCIA GERAL NO ANO LETIVO:
                                                            </td>
                                                            <td className="px-1 py-1 text-center text-blue-900 font-extrabold text-[11px] md:text-sm bg-blue-50/50 border-r border-gray-300">
                                                                {generalFreq}
                                                            </td>
                                                            <td className="bg-gray-100/50"></td>
                                                        </tr>
                                                    );
                                                })()}
                                                {studentGrades.length === 0 && (
                                                    <tr><td colSpan={21} className="px-6 py-8 text-center text-gray-500 italic">Nenhuma nota lançada para este período letivo.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded border border-yellow-200 print:hidden">
                                        <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full flex-shrink-0"></div>
                                        <span>= Nota em processo de atualização pela coordenação pedagógica.</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {currentView === 'support' && supportNeededGrades.length > 0 && (
                        <div className="mt-8 print:hidden animate-fade-in-up">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 border-b border-gray-200 pb-2 flex items-center gap-2">
                                <LifeBuoy className="w-6 h-6 text-purple-600" />
                                Centro de Suporte ao Aluno
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {supportNeededGrades.map((grade) => {
                                    const teacherPhone = getTeacherPhone(grade.subject);
                                    const media = grade.mediaAnual || 0;
                                    const isLowGrade = media < 7.0 && grade.situacaoFinal !== 'Aprovado';

                                    const difficulties = grade.bimesters ? Object.entries(grade.bimesters)
                                        .map(([key, data]) => {
                                            const bimesterNumber = key.replace('bimester', '');
                                            return {
                                                bimester: `${bimesterNumber}º Bimestre`,
                                                topic: (data as BimesterData).difficultyTopic,
                                            }
                                        })
                                        .filter(d => d.topic && d.topic.trim().length > 5) : [];

                                    let statusConfig = {
                                        color: 'border-l-gray-300',
                                        badge: '',
                                        badgeColor: '',
                                        message: '',
                                        showContactButton: false
                                    };

                                    if (isLowGrade) {
                                        statusConfig = { color: 'border-l-red-500', badge: 'Atenção', badgeColor: 'bg-red-100 text-red-800', message: 'Nota abaixo da média. Recomendamos reforço.', showContactButton: true };
                                    } else if (media >= 7.0 && media <= 8.5) {
                                        statusConfig = { color: 'border-l-slate-400', badge: 'Bom', badgeColor: 'bg-slate-100 text-slate-800', message: 'Bom trabalho! Você atingiu a média e pode evoluir ainda mais. 🚀', showContactButton: false };
                                    } else if (media >= 8.6 && media <= 9.5) {
                                        statusConfig = { color: 'border-l-green-500', badge: 'Ótimo', badgeColor: 'bg-green-100 text-green-800', message: 'Ótimo trabalho! Sua nota mostra que você está no caminho certo. Continue brilhando! ⭐', showContactButton: false };
                                    } else if (media > 9.5) {
                                        statusConfig = { color: 'border-l-purple-500', badge: 'Excelente', badgeColor: 'bg-purple-100 text-purple-800', message: 'Uau! Resultado extraordinário! Sua dedicação está fazendo toda a diferença. 🏆', showContactButton: false };
                                    }

                                    const waPhone = teacherPhone ? teacherPhone.replace(/\D/g, '') : '';

                                    return (
                                        <div key={grade.id} className={`p-5 border-l-4 rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg ${statusConfig.color} flex flex-col`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <h4 className="text-lg font-bold text-gray-800">{grade.subject}</h4>
                                                {statusConfig.badge && <span className={`${statusConfig.badgeColor} text-xs font-bold px-2 py-1 rounded`}>{statusConfig.badge}</span>}
                                            </div>

                                            {(() => {
                                                if (difficulties.length > 0) return null;
                                                const relevantBimesters = grade.bimesters ? Object.entries(grade.bimesters)
                                                    .filter(([key, data]) => {
                                                        const bData = data as BimesterData;
                                                        // Prioritize persisted 'faltas' from sync, fallback to dynamic
                                                        if (bData.media === undefined || bData.media === null) return false;

                                                        // Filter based on the status category
                                                        if (isLowGrade) return bData.media < 7.0 && bData.isApproved !== false;
                                                        if (media >= 7.0 && media <= 8.5) return bData.media >= 7.0 && bData.media <= 8.5 && bData.isApproved !== false;
                                                        if (media > 8.5) return bData.media > 8.5 && bData.isApproved !== false;

                                                        return false;
                                                    })
                                                    .map(([key]) => key.replace('bimester', ''))
                                                    .sort() : [];

                                                if (relevantBimesters.length === 0) return null;

                                                const lastBimester = relevantBimesters[relevantBimesters.length - 1];

                                                return (
                                                    <div className="mb-3">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                            Referência: <span className="text-gray-700">{lastBimester}º Bimestre</span>
                                                        </span>
                                                    </div>
                                                );
                                            })()}

                                            <div className="mb-4 space-y-3 flex-grow">
                                                {difficulties.map(d => (
                                                    <div key={d.bimester} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                                        <p className="font-bold text-gray-700 block mb-2 text-sm">
                                                            🔍 Dificuldade Identificada ({d.bimester}):
                                                        </p>
                                                        <p className="text-sm text-gray-600 italic pl-2 border-l-2 border-gray-300">"{d.topic}"</p>
                                                        <div className="mt-3">
                                                            <button
                                                                onClick={() => handleGetHelp(grade.subject as Subject, d.topic!)}
                                                                className="w-full bg-gradient-to-r from-blue-950 to-slate-900 text-white hover:from-blue-900 hover:to-slate-800 py-2 rounded-lg text-xs font-bold flex items-center justify-center transition-all shadow-sm hover:shadow-md transform active:scale-95"
                                                            >
                                                                <Bot className="w-4 h-4 mr-2" />
                                                                Ajuda da IA
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                {statusConfig.message && <p className="text-sm text-gray-500 italic font-medium pt-2">{statusConfig.message}</p>}
                                            </div>

                                            <div className="mt-auto border-t border-gray-100 pt-4">
                                                {statusConfig.showContactButton && (
                                                    <button
                                                        onClick={() => handleOpenTicketModal(grade.subject)}
                                                        className="w-full bg-blue-600 text-white hover:bg-blue-700 py-2.5 rounded-md text-sm font-bold flex items-center justify-center transition-colors shadow-sm"
                                                    >
                                                        <Mail className="w-4 h-4 mr-2" />
                                                        Enviar Dúvida ao Professor
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {currentView === 'messages' && (
                        <div className="animate-fade-in-up">
                            <MessageBox student={student} onSendMessage={onSendMessage} unitContacts={unitContacts || []} teachers={teachers} />
                        </div>
                    )}

                    {currentView === 'tickets' && (
                        <div className="animate-fade-in-up">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 border-b border-gray-200 pb-2 flex items-center gap-2">
                                <CircleHelp className="w-6 h-6 text-yellow-600" />
                                Minhas Dúvidas
                            </h3>

                            {isLoadingStudentTickets ? (
                                <TableSkeleton rows={3} />
                            ) : studentTickets.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
                                    <p className="text-gray-500">Você ainda não enviou dúvidas.</p>
                                    <Button onClick={() => setCurrentView('grades')} className="mt-4">
                                        Ir para Boletim
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {studentTickets.map(ticket => (
                                        <div key={ticket.id} className="bg-white border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{ticket.subject}</span>
                                                    <p className="text-xs text-gray-400 mt-0.5">{new Date(ticket.timestamp).toLocaleDateString()} às {new Date(ticket.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${ticket.status === TicketStatus.PENDING ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                    {ticket.status === TicketStatus.PENDING ? 'Aguardando Resposta' : 'Respondido'}
                                                </span>
                                            </div>

                                            <div className="bg-gray-50 p-3 rounded-md mb-3 text-sm text-gray-700 border border-gray-100">
                                                <span className="font-bold text-gray-900 block mb-1">Sua Pergunta:</span>
                                                {ticket.message}
                                            </div>

                                            {ticket.response && (
                                                <div className="bg-blue-50/50 p-3 rounded-md text-sm text-gray-800 border border-blue-100">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <User className="w-5 h-5 text-blue-800" />
                                                        <span className="font-bold text-blue-900">Resposta do Professor{ticket.responderName ? ` (${ticket.responderName})` : ''}:</span>
                                                    </div>
                                                    <p className="whitespace-pre-wrap pl-2 border-l-2 border-blue-200">{ticket.response}</p>
                                                    <p className="text-[10px] text-gray-400 mt-2 text-right">Respondido em {new Date(ticket.responseTimestamp!).toLocaleDateString()}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}


                    {isModalOpen && (
                        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 print:hidden p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-fade-in-up">
                                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-xl">
                                    <div>
                                        <h3 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                                            <Bot className="w-8 h-8 text-blue-600" />
                                            Tutor Inteligente
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">{modalContent.title}</p>
                                    </div>
                                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-white/50">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>
                                <div className="p-6 overflow-y-auto flex-grow bg-gray-50/50">
                                    {isLoadingAI ? (
                                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-950"></div>
                                            <p className="text-blue-950 font-medium animate-pulse">Analisando sua dificuldade e gerando dicas...</p>
                                        </div>
                                    ) : (
                                        <div className="prose prose-slate max-w-none">
                                            <div
                                                className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 text-gray-700 leading-relaxed whitespace-pre-wrap"
                                                dangerouslySetInnerHTML={{ __html: sanitizeAndFormatTip(modalContent.tip) }}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 border-t border-gray-100 bg-white rounded-b-xl flex justify-end">
                                    <Button onClick={() => setIsModalOpen(false)} className="px-6">Entendi, vou estudar!</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TICKET MDOAL */}
                    {ticketModalOpen && (
                        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 print:hidden p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col animate-fade-in-up">
                                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-blue-50/50 rounded-t-xl">
                                    <div>
                                        <h3 className="text-lg font-extrabold text-blue-950 flex items-center gap-2">
                                            <Mail className="w-6 h-6 text-blue-600" />
                                            Enviar Dúvida
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-0.5 font-medium">{selectedTicketSubject}</p>
                                    </div>
                                    {!ticketSuccess && (
                                        <button onClick={() => setTicketModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-white/50">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </button>
                                    )}
                                </div>
                                <div className="p-6">
                                    {ticketSuccess ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
                                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            </div>
                                            <h4 className="text-xl font-bold text-gray-800 mb-2">Dúvida Enviada!</h4>
                                            <p className="text-gray-600 text-sm max-w-xs mx-auto">
                                                O professor responderá sua dúvida dentro do horário de planejamento escolar.
                                            </p>
                                            <div className="mt-6 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                <div className="h-full bg-green-500 animate-progress-shrink origin-left"></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">Descreva sua dúvida:</label>
                                                <textarea
                                                    value={ticketMessage}
                                                    onChange={(e) => setTicketMessage(e.target.value)}
                                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[150px] text-sm"
                                                    placeholder="Escreva aqui sua pergunta para o professor..."
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800 flex gap-2">
                                                <Lightbulb className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                                                <p>Sua mensagem será enviada diretamente para o painel do professor. Seja claro e específico para obter uma resposta melhor.</p>
                                            </div>
                                            <div className="flex justify-end pt-2">
                                                <Button
                                                    onClick={handleSendTicket}
                                                    disabled={!ticketMessage.trim() || isTicketSending}
                                                    className={`w-full py-3 flex justify-center items-center gap-2 ${isTicketSending ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                >
                                                    {isTicketSending ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                                            Enviando...
                                                        </>
                                                    ) : (
                                                        <>Enviar Dúvida</>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};