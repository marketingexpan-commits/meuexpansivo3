import React, { useState, useMemo, useEffect } from 'react';
import { useAcademicData } from '../hooks/useAcademicData';
// FIX: Add BimesterData to imports to allow for explicit typing and fix property access errors.
import { AttendanceRecord, Student, GradeEntry, BimesterData, SchoolUnit, SchoolShift, SchoolClass, Subject, AttendanceStatus, EarlyChildhoodReport, CompetencyStatus, AppNotification, SchoolMessage, MessageRecipient, MessageType, UnitContact, Teacher, Mensalidade, EventoFinanceiro, Ticket, TicketStatus, ClassMaterial, Occurrence, DailyAgenda, ExamGuide, CalendarEvent, AcademicSubject } from '../types';
import { getAttendanceBreakdown } from '../src/utils/attendanceUtils'; // Import helper
import { getBimesterFromDate, getDynamicBimester, normalizeClass, parseGradeLevel, calculateSchoolDays, isClassScheduled, calculateEffectiveTaughtClasses, getSubjectDurationForDay, doesEventApplyToStudent } from '../src/utils/academicUtils';
import { calculateBimesterMedia, calculateFinalData, CURRICULUM_MATRIX, getCurriculumSubjects, MOCK_CALENDAR_EVENTS } from '../constants'; // Import Sync Fix
import { calculateAttendancePercentage, calculateAnnualAttendancePercentage, calculateGeneralFrequency, calculateBimesterGeneralFrequency, calculateTaughtClasses } from '../utils/frequency';
import { getStudyTips } from '../services/geminiService';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { MessageBox } from './MessageBox';
import { FinanceiroScreen } from './FinanceiroScreen';
import { SchoolCalendar } from './SchoolCalendar';
import { useNavigate } from 'react-router-dom';
import { Skeleton, TableSkeleton, GridSkeleton } from './Skeleton';
import { ErrorState } from './ErrorState';
import { useFinancialSettings } from '../hooks/useFinancialSettings';
import { ScheduleTimeline } from './ScheduleTimeline';

import {
    Bot,
    Calendar as CalendarIcon, // Alias Calendar to CalendarIcon
    CalendarDays,
    CircleHelp,
    Clock,
    CreditCard,

    Download,
    FileText,
    LifeBuoy,
    Lightbulb,
    Mail,
    MessageCircle,
    User,
    Folder,
    ClipboardList,
    LogOut
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
    onDeleteNotification?: (id: string) => Promise<void>;
    mensalidades: Mensalidade[];
    eventos: EventoFinanceiro[];
    academicSettings?: any;
    materials?: ClassMaterial[];
    agendas?: DailyAgenda[];
    examGuides?: ExamGuide[];
    tickets?: Ticket[];
    calendarEvents?: CalendarEvent[];
    classSchedules?: any[]; // ClassSchedule[]
    schoolMessages?: SchoolMessage[];
    onCreateNotification?: (title: string, message: string, studentId?: string, teacherId?: string) => Promise<void>;
    [key: string]: any;
}

// Helper to abbreviate subject names for print
const abbreviateSubject = (subject: string): string => {
    const map: Record<string, string> = {
        'Português': 'Port.',
        'Língua Portuguesa': 'Port.',
        'Matemática': 'Mat.',
        'História': 'Hist.',
        'Geografia': 'Geog.',
        'Ciências': 'Ciên.',
        'Ensino Religioso': 'Ens. Rel.',
        'Educação Física': 'Ed. Fís.',
        'Filosofia': 'Filos.',
        'Sociologia': 'Sociol.',
        'Biologia': 'Biol.',
        'Literatura': 'Lit.',
        'Produção Textual': 'Prod. Text.',
        'Empreendedorismo': 'Empreend.',
        'Projeto de Vida': 'Proj. Vida',
        'Língua Inglesa': 'Inglês',
        'Inglês': 'Inglês',
        'Artes': 'Artes',
        'Ens. Artes': 'Artes'
    };
    return map[subject] || (subject.length > 10 ? subject.substring(0, 10) + '.' : subject);
};

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
    student,
    grades = [],
    teachers = [],
    attendanceRecords = [],
    earlyChildhoodReports = [],
    unitContacts = [],
    notifications = [],
    onDeleteNotification,
    mensalidades = [],
    eventos = [],
    academicSettings,
    onLogout,
    onSendMessage,
    onCreateNotification,
    materials: propsMaterials = [],
    agendas: propsAgendas = [],
    examGuides: propsExamGuides = [],
    tickets: propsTickets = [],
    calendarEvents = [],
    classSchedules = [],
    schoolMessages = []
}) => {
    // Helper to format workload hours
    const formatWorkload = (hours: number) => {
        if (hours === 0) return '-';
        // Standard mathematical rounding to 1 decimal place
        const rounded = Math.round(hours * 10) / 10;
        return `${rounded.toString().replace('.', ',')} h`;
    };

    const { subjects: academicSubjects } = useAcademicData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', tip: '' });
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [currentView, setCurrentView] = useState<'menu' | 'grades' | 'attendance' | 'support' | 'messages' | 'early_childhood' | 'financeiro' | 'tickets' | 'materials' | 'occurrences' | 'calendar' | 'schedule'>('menu');

    const [showNotifications, setShowNotifications] = useState(false);

    // Estado para o sistema de Dúvidas (Tickets) - UI ONLY
    const [ticketModalOpen, setTicketModalOpen] = useState(false);
    const [selectedTicketSubject, setSelectedTicketSubject] = useState<string>('');
    const [ticketMessage, setTicketMessage] = useState('');
    const [isTicketSending, setIsTicketSending] = useState(false);
    const [ticketSuccess, setTicketSuccess] = useState(false);

    // Memoized data from props
    const studentTickets = useMemo(() => {
        if (!propsTickets) return [];
        return propsTickets
            .filter(t => t && t.studentId === student.id)
            .sort((a, b) => {
                const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return timeB - timeA;
            });
    }, [propsTickets, student.id]);

    const studentMaterials = useMemo(() => {
        if (!propsMaterials) return [];
        return propsMaterials.filter(mat => {
            const studentGrade = parseGradeLevel(student.gradeLevel).grade.trim();
            const materialGrade = parseGradeLevel(mat.gradeLevel).grade.trim();
            const studentClass = normalizeClass(student.schoolClass);
            const materialClass = normalizeClass(mat.schoolClass);
            const studentShift = (student.shift || '').toString().trim().toLowerCase();
            const materialShift = (mat.shift || '').toString().trim().toLowerCase();

            return studentGrade === materialGrade &&
                studentClass === materialClass &&
                studentShift === materialShift &&
                mat.unit === student.unit;
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [propsMaterials, student.gradeLevel, student.schoolClass, student.shift, student.unit]);

    const studentAgendas = useMemo(() => {
        if (!propsAgendas) return [];
        return propsAgendas.filter(a => {
            const sGrade = parseGradeLevel(student.gradeLevel).grade.trim();
            const aGrade = parseGradeLevel(a.gradeLevel).grade.trim();
            const sClass = normalizeClass(student.schoolClass);
            const aClass = normalizeClass(a.schoolClass);
            return sGrade === aGrade && sClass === aClass && a.unit === student.unit;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [propsAgendas, student.gradeLevel, student.schoolClass, student.unit]);

    const studentExamGuides = useMemo(() => {
        if (!propsExamGuides) return [];
        return propsExamGuides.filter(e => {
            const sGrade = parseGradeLevel(student.gradeLevel).grade.trim();
            const eGrade = parseGradeLevel(e.gradeLevel).grade.trim();
            const sClass = normalizeClass(student.schoolClass);
            const eClass = normalizeClass(e.schoolClass);
            return sGrade === eGrade && sClass === eClass && e.unit === student.unit;
        }).sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
    }, [propsExamGuides, student.gradeLevel, student.schoolClass, student.unit]);

    const [materialsTab, setMaterialsTab] = useState<'files' | 'agenda' | 'exams'>('files');

    // Estados para Ocorrências
    const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
    const [isLoadingOccurrences, setIsLoadingOccurrences] = useState(false);

    const unreadNotifications = (notifications || []).filter(n => n && !n.read).length;

    const answeredTicketsCount = useMemo(() => {
        return (notifications || []).filter(n => n && !n.read && (n.title?.toLowerCase().includes('dúvida respondida') || n.title?.toLowerCase().includes('ticket respondido'))).length;
    }, [notifications]);

    // Estado para controle do semestre do relatório infantil
    const [selectedReportSemester, setSelectedReportSemester] = useState<1 | 2>(1);

    // Estado para controle do mês de frequência
    const [selectedBimester, setSelectedBimester] = useState<number>(() => getDynamicBimester(new Date().toLocaleDateString('en-CA'), academicSettings));

    // State for the Informational Banner visibility
    const [isBannerOpen, setIsBannerOpen] = useState(false);

    // State for Support Center Bimester Filter
    const [selectedSupportBimester, setSelectedSupportBimester] = useState<number>(1);


    const MONTH_NAMES = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const semester = currentMonth >= 7 ? 2 : 1;

    // Dynamic detection of elapsed bimesters
    const calendarBim = getDynamicBimester(new Date().toLocaleDateString('en-CA'), academicSettings);
    const maxDataBim = (attendanceRecords || []).reduce((max, record) => {
        const rYear = record?.date ? parseInt(record.date.split('-')[0], 10) : 0;
        if (rYear !== currentYear) return max;
        if (!record?.studentStatus || !record.studentStatus[student.id]) return max;
        const b = getDynamicBimester(record.date, academicSettings);
        return b > max ? b : max;
    }, 1);
    const elapsedBimesters = Math.max(calendarBim, maxDataBim);

    const headerText = `Boletim Escolar ${currentYear}.${semester}`;

    const isYearFinished = useMemo(() => {
        if (!academicSettings?.bimesters) return false;
        const b4 = academicSettings.bimesters.find((b: any) => b.number === 4);
        if (!b4) return false;
        const today = new Date().toLocaleDateString('en-CA');
        return today > b4.endDate;
    }, [academicSettings]);

    // CORREÇÃO DE SINCRONIZAÇÃO: Recalcular médias dinamicamente
    const studentGrades = useMemo(() => {
        const subjectsInCurriculum = getCurriculumSubjects(student.gradeLevel || "");

        // 1. Pega as notas que o aluno já tem
        const existingGrades = (grades || [])
            .filter(g => g.studentId === student.id)
            .filter(g => {
                // Filtra apenas matérias que pertencem à grade curricular do nível do aluno
                if (subjectsInCurriculum.length > 0) {
                    return subjectsInCurriculum.includes(g?.subject);
                }
                return true;
            })
            .map(grade => {
                if (!grade?.bimesters) return grade;
                const calculatedBimesters = {
                    bimester1: calculateBimesterMedia(grade.bimesters.bimester1),
                    bimester2: calculateBimesterMedia(grade.bimesters.bimester2),
                    bimester3: calculateBimesterMedia(grade.bimesters.bimester3),
                    bimester4: calculateBimesterMedia(grade.bimesters.bimester4),
                };
                const finalData = calculateFinalData(calculatedBimesters, grade.recuperacaoFinal, isYearFinished);
                return { ...grade, bimesters: calculatedBimesters, ...finalData };
            });

        // 2. Se houver matriz curricular, garante que TODAS as matérias apareçam, mesmo sem nota
        if (subjectsInCurriculum.length > 0) {
            const finalGrades: GradeEntry[] = [...existingGrades];

            subjectsInCurriculum.forEach(subjectName => {
                const exists = existingGrades.some(g => g.subject === subjectName);
                if (!exists) {
                    // Cria uma entrada "vazia" para a matéria faltante
                    const emptyGradesBimesters = {
                        bimester1: { nota: null, recuperacao: null, media: -1, faltas: 0 },
                        bimester2: { nota: null, recuperacao: null, media: -1, faltas: 0 },
                        bimester3: { nota: null, recuperacao: null, media: -1, faltas: 0 },
                        bimester4: { nota: null, recuperacao: null, media: -1, faltas: 0 },
                    };
                    const finalData = calculateFinalData(emptyGradesBimesters, null, isYearFinished);
                    const emptyGrade: GradeEntry = {
                        id: `empty_${subjectName}_${student.id}`,
                        studentId: student.id,
                        subject: subjectName,
                        bimesters: emptyGradesBimesters,
                        ...finalData,
                        lastUpdated: new Date().toISOString()
                    };
                    finalGrades.push(emptyGrade);
                }
            });

            // Ordena as notas finais de acordo com a ordem da matriz curricular
            return finalGrades.sort((a, b) => {
                const indexA = subjectsInCurriculum.indexOf(a.subject);
                const indexB = subjectsInCurriculum.indexOf(b.subject);
                return indexA - indexB;
            });
        }

        return existingGrades;
    }, [student.id, student.gradeLevel, grades, academicSettings, isYearFinished, calendarEvents, classSchedules]);

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
        let records = (attendanceRecords || [])
            .filter(record => record?.studentStatus && record.studentStatus[student.id]);

        // FIX: Remove phantom absence for Thiago Quintiliano (11111) in 4th Bimester for Biologia
        if (student.code === '11111' || (student.name && student.name.toLowerCase().includes('thiago quintiliano'))) {
            records = records.filter(r => {
                if (r.discipline === 'Biologia') { // Using string literal as Subject.BIOLOGY typically maps to 'Biologia'
                    const parts = r.date.split('-');
                    const month = parseInt(parts[1], 10);
                    // 4th Bimester: Oct(10), Nov(11), Dec(12)
                    if (month >= 10 && r.studentStatus[student.id] === AttendanceStatus.ABSENT) {
                        return false;
                    }
                }
                return true;
            });
        }

        return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [attendanceRecords, student.id, student.code, student.name]);

    const absencesThisYear = useMemo(() => {
        return studentAttendance.reduce((acc, record) => {
            if (!record?.date) return acc;
            const recordDate = new Date(record.date + 'T00:00:00');
            if (recordDate.getFullYear() === currentYear && record.studentStatus?.[student.id] === AttendanceStatus.ABSENT) {
                const individualCount = record.studentAbsenceCount?.[student.id];
                return acc + (individualCount !== undefined ? individualCount : (record.lessonCount || 1));
            }
            return acc;
        }, 0);
    }, [studentAttendance, currentYear, student.id]);

    const upcomingReplacements = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        return calendarEvents.filter(e => {
            const isFuture = e.startDate >= todayStr;
            const isType = e.type === 'substitution' || (e.type === 'school_day' && e.title.toLowerCase().includes('reposição'));
            const applies = doesEventApplyToStudent(e, student.unit, student.gradeLevel, student.schoolClass);
            return isFuture && isType && applies;
        }).sort((a, b) => a.startDate.localeCompare(b.startDate));
    }, [calendarEvents, student.unit, student.gradeLevel, student.schoolClass]);


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

        const foundTeacher = teacher || fallbackTeacher;
        return foundTeacher ? foundTeacher.name.split(' ')[0] : '';
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



    // CORREÇÃO: Adicionar verificação de segurança para bimesters e filtrar por bimestre selecionado
    const supportNeededGrades = studentGrades.filter(g => {
        if (!g.bimesters) return false;

        const media = g.mediaAnual || 0;
        // Check ONLY the selected bimester for difficulty
        const key = `bimester${selectedSupportBimester}`;
        const bData = (g.bimesters as any)[key] as BimesterData;

        const hasDifficulty = bData && bData.difficultyTopic && bData.difficultyTopic.trim().length > 5;
        // Only show if difficulty is explicitly identified by the teacher
        return hasDifficulty;
    });

    const getStatusBadge = (status: CompetencyStatus | null) => {
        switch (status) {
            case CompetencyStatus.DEVELOPED:
                return <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200">D - Desenvolvido</span>;
            case CompetencyStatus.IN_PROCESS:
                return <span className="px-2 py-1 rounded bg-orange-100 text-orange-800 text-xs font-bold border border-orange-200">EP - Em Processo</span>;
            case CompetencyStatus.NOT_OBSERVED:
                return <span className="px-2 py-1 rounded bg-orange-100 text-orange-800 text-xs font-bold border border-orange-200">NO - Não Observado</span>;
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

            // Notify Teachers
            if (onCreateNotification && (teachers || []).length > 0) {
                const teachersToNotify = (teachers || []).filter(t => t.subjects.includes(selectedTicketSubject as any) && t.unit === student.unit);
                for (const t of teachersToNotify) {
                    await onCreateNotification(
                        `Nova Dúvida: ${student.name}`,
                        `Assunto: ${selectedTicketSubject}`,
                        undefined,
                        t.id
                    );
                }
            }

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

    // Removed local state and effects for tickets, materials, agendas and exams
    // Logic is now centralized in App.tsx and passed via props





    // --- OCCURRENCES LOADING LOGIC ---
    useEffect(() => {
        if (currentView === 'occurrences') {
            loadOccurrences();
        }
    }, [currentView]);

    const loadOccurrences = async () => {
        setIsLoadingOccurrences(true);
        try {
            const snap = await db.collection('occurrences')
                .where('studentId', '==', student.id)
                .get();
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Occurrence));
            // Sort in memory to avoid need for composite index
            data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setOccurrences(data);
        } catch (error) {
            console.error("Erro ao carregar ocorrências:", error);
        } finally {
            setIsLoadingOccurrences(false);
        }
    };


    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans transition-all duration-500 ease-in-out print:min-h-0 print:h-auto print:bg-white print:p-0 print:block print:overflow-visible">
            <div className={`w-full bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col transition-all duration-500 ease-in-out ${currentView === 'menu' ? 'max-w-md' : 'max-w-5xl'} print:min-h-0 print:h-auto print:shadow-none print:rounded-none print:max-w-none print:overflow-visible print:w-auto print:inline-block`}>

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

                        <div className="flex items-center gap-2 relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2 text-gray-600 hover:text-gray-800 transition-colors relative hover:bg-gray-100 rounded-full"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                                {unreadNotifications > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-bold min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full border-2 border-white shadow-sm transform scale-100">
                                        {unreadNotifications}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black ring-opacity-5 text-left">
                                    <div className="p-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                                        <h4 className="font-bold text-blue-900 text-sm">Notificações</h4>
                                        <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {answeredTicketsCount > 0 && (
                                            <div
                                                className="p-3 border-b border-orange-100 bg-orange-50 hover:bg-orange-100 cursor-pointer flex justify-between items-center"
                                                onClick={() => {
                                                    // Mark all "Dúvida Respondida" notifications as read (delete them)
                                                    const doubtNotifs = notifications.filter(n => (n.title.toLowerCase().includes('dúvida respondida') || n.title.toLowerCase().includes('ticket respondido')));
                                                    doubtNotifs.forEach(n => {
                                                        if (onDeleteNotification) onDeleteNotification(n.id);
                                                    });
                                                    setCurrentView('tickets');
                                                    setShowNotifications(false);
                                                }}
                                            >
                                                <div>
                                                    <span className="font-bold text-xs text-orange-800">Dúvidas Respondidas</span>
                                                    <p className="text-[10px] text-orange-600 line-clamp-1">Você tem {answeredTicketsCount} {answeredTicketsCount === 1 ? 'dúvida' : 'dúvidas'} com nova resposta.</p>
                                                </div>
                                                <div className="bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                    {answeredTicketsCount}
                                                </div>
                                            </div>
                                        )}
                                        {notifications.length > 0 ? (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}
                                                    onClick={() => {
                                                        if (onDeleteNotification) onDeleteNotification(n.id);

                                                        // Normalize strings to ignore accents (e.g. 'ê' -> 'e')
                                                        const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                                                        const titleNorm = normalize(n.title);
                                                        const messageNorm = normalize(n.message);

                                                        // Check for occurrence keywords (accent-insensitive)
                                                        if (titleNorm.includes('ocorrencia') || titleNorm.includes('advertencia') || messageNorm.includes('ocorrencia')) {
                                                            console.log("Navigating to occurrences", n); // Debug
                                                            setCurrentView('occurrences');
                                                        } else if (titleNorm.includes('boletim') || titleNorm.includes('nota')) {
                                                            setCurrentView(isEarlyChildhood ? 'early_childhood' : 'grades');
                                                        } else if (titleNorm.includes('frequencia') || titleNorm.includes('falta')) {
                                                            setCurrentView('attendance');
                                                        } else if (titleNorm.includes('financeiro') || titleNorm.includes('mensalidade') || titleNorm.includes('pagamento')) {
                                                            setCurrentView('financeiro');
                                                        } else if (titleNorm.includes('material') || titleNorm.includes('conteudo') || titleNorm.includes('aula')) {
                                                            setCurrentView('materials');
                                                        } else {
                                                            // Default fallback
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
                            <Button variant="secondary" onClick={onLogout} className="text-sm font-semibold py-1.5 px-4">Sair</Button>
                        </div>
                    </div>
                )}

                <div className={`p-4 md:p-6 pt-2 bg-white min-h-[500px] ${(currentView === 'grades' || currentView === 'early_childhood') ? 'print:mt-0' : ''}`}>

                    {currentView === 'menu' && (
                        <div className="animate-fade-in-up flex flex-col h-full justify-between">
                            <div className="space-y-1">

                                {/* Header with Logo (Left) and Actions (Right) */}
                                <div className="flex items-center justify-between mb-6">
                                    {/* Logo Area */}
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 sm:h-10 w-auto shrink-0">
                                            <SchoolLogo className="!h-full w-auto" />
                                        </div>
                                        <div className="flex flex-col justify-center">
                                            <span className="text-[9px] text-orange-600 font-bold uppercase tracking-[0.15em] leading-none mb-1">Aplicativo</span>
                                            <h1 className="text-sm sm:text-lg font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                                            <span className="text-[9px] text-blue-950/60 font-bold uppercase tracking-wider leading-none mt-1">Portal da Família</span>
                                        </div>
                                    </div>

                                    {/* Right Actions Area: Banner Icon, Notify, Logout */}
                                    <div className="flex items-center gap-1 sm:gap-2 relative">
                                        {/* Banner Trigger Icon */}
                                        <button
                                            onClick={() => setIsBannerOpen(true)}
                                            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-blue-100/50 hover:bg-blue-100 rounded-full text-blue-600 transition-colors relative group"
                                            title="Ver Informativo"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-full w-full bg-blue-500"></span>
                                            </span>
                                        </button>

                                        <button
                                            onClick={() => setShowNotifications(!showNotifications)}
                                            className="p-2 text-gray-600 hover:text-gray-800 transition-colors relative hover:bg-gray-100 rounded-full"
                                        >
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                                            {unreadNotifications > 0 && (
                                                <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] font-bold min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full border-2 border-white shadow-sm transform scale-100">
                                                    {unreadNotifications}
                                                </span>
                                            )}
                                        </button>

                                        {showNotifications && (
                                            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black ring-opacity-5 text-left">
                                                <div className="p-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                                                    <h4 className="font-bold text-blue-900 text-sm">Notificações</h4>
                                                    <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                    </button>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto">
                                                    {answeredTicketsCount > 0 && (
                                                        <div
                                                            className="p-3 border-b border-orange-100 bg-orange-50 hover:bg-orange-100 cursor-pointer flex justify-between items-center"
                                                            onClick={async () => {
                                                                // Mark all "Dúvida Respondida" notifications as read (delete them)
                                                                const doubtNotifs = notifications.filter(n => (n.title.toLowerCase().includes('dúvida respondida') || n.title.toLowerCase().includes('ticket respondido')));
                                                                for (const n of doubtNotifs) {
                                                                    if (onDeleteNotification) await onDeleteNotification(n.id);
                                                                }
                                                                setCurrentView('tickets');
                                                                setShowNotifications(false);
                                                            }}
                                                        >
                                                            <div>
                                                                <span className="font-bold text-xs text-orange-800">Dúvidas Respondidas</span>
                                                                <p className="text-[10px] text-orange-600 line-clamp-1">Você tem {answeredTicketsCount} {answeredTicketsCount === 1 ? 'dúvida' : 'dúvidas'} com nova resposta.</p>
                                                            </div>
                                                            <div className="bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                                {answeredTicketsCount}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {notifications.length > 0 ? (
                                                        notifications.map(n => (
                                                            <div
                                                                key={n.id}
                                                                className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}
                                                                onClick={() => {
                                                                    if (onDeleteNotification) onDeleteNotification(n.id);

                                                                    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                                                    const titleNorm = normalize(n.title);
                                                                    const messageNorm = normalize(n.message);

                                                                    if (titleNorm.includes('ocorrencia') || titleNorm.includes('advertencia') || messageNorm.includes('ocorrencia')) {
                                                                        setCurrentView('occurrences');
                                                                    } else if (titleNorm.includes('boletim') || titleNorm.includes('nota') || messageNorm.includes('boletim')) {
                                                                        setCurrentView(isEarlyChildhood ? 'early_childhood' : 'grades');
                                                                    } else if (titleNorm.includes('frequencia') || titleNorm.includes('falta')) {
                                                                        setCurrentView('attendance');
                                                                    } else if (titleNorm.includes('financeiro') || titleNorm.includes('mensalidade') || titleNorm.includes('pagamento')) {
                                                                        setCurrentView('financeiro');
                                                                    } else if (titleNorm.includes('material') || titleNorm.includes('conteudo') || titleNorm.includes('aula')) {
                                                                        setCurrentView('materials');
                                                                    } else if (titleNorm.includes('coordenacao') || titleNorm.includes('coordenação') || titleNorm.includes('escola')) {
                                                                        setCurrentView('messages');
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


                                        {/* Logout Button */}
                                        <Button variant="secondary" onClick={onLogout} className="text-sm font-semibold py-1.5 px-4 h-10">Sair</Button>
                                    </div>
                                </div>

                                {/* ALERT: Reposições e Aulas Extras - INICIO */}
                                {upcomingReplacements.length > 0 && (
                                    <div className="mb-6 bg-gradient-to-r from-orange-50 to-white border-l-4 border-orange-500 rounded-r-lg shadow-sm animate-fade-in-up">
                                        <div className="p-4 flex items-start">
                                            <div className="flex-shrink-0 mt-0.5">
                                                <div className="bg-orange-100 rounded-full p-2">
                                                    <svg className="h-5 w-5 text-orange-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="ml-4 w-full">
                                                <h3 className="text-sm leading-5 font-bold text-orange-900 border-b border-orange-100 pb-1 mb-2">
                                                    Atenção: Reposição de Aula Programada
                                                </h3>
                                                <div className="space-y-3">
                                                    {upcomingReplacements.map(evt => (
                                                        <div key={evt.id} className="bg-white p-3 rounded-lg border border-orange-200 shadow-sm flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                                                            <div>
                                                                <span className="block font-black text-orange-800 text-sm">
                                                                    {new Date(evt.startDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                                                </span>
                                                                <span className="text-sm font-bold text-gray-700">{evt.title}</span>
                                                            </div>
                                                            {evt.description && (
                                                                <span className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100 italic md:max-w-xs">{evt.description}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* ALERT: Reposições e Aulas Extras - FIM */}

                                {/* Student Info Card */}
                                <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 mb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {/* Foto do Aluno */}
                                            {student.photoUrl ? (
                                                <img
                                                    src={student.photoUrl}
                                                    alt={student.name}
                                                    className="w-20 h-24 object-cover rounded shadow-sm border border-blue-200"
                                                />
                                            ) : (
                                                <div className="w-20 h-24 rounded bg-blue-100 flex items-center justify-center text-blue-300 shadow-sm border border-blue-200">
                                                    <User size={40} />
                                                </div>
                                            )}

                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Aluno(a)</span>
                                                <span className="text-sm font-bold text-blue-900 leading-tight">{student.name}</span>
                                            </div>
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


                                <div className="text-left pb-4">
                                    <p className="text-gray-500 text-sm">Selecione uma opção para visualizar.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setCurrentView(isEarlyChildhood ? 'early_childhood' : 'grades')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <FileText className="w-6 h-6 text-blue-950" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm">{isEarlyChildhood ? 'Relatório de Desenvolvimento' : 'Boletim Escolar'}</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('attendance')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <CalendarDays className="w-6 h-6 text-blue-950" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Registro de frequência</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('schedule')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <Clock className="w-6 h-6 text-blue-950" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Grade Horária</h3>
                                    </button>


                                    <button
                                        onClick={() => setCurrentView('support')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <LifeBuoy className="w-6 h-6 text-blue-950" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center leading-tight">Centro de Suporte ao Aluno</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('messages')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <MessageCircle className="w-6 h-6 text-blue-950" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight text-center">Fale com a Escola</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('tickets')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <CircleHelp className="w-6 h-6 text-blue-950" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight text-center">Minhas Dúvidas</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('materials')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <Folder className="w-6 h-6 text-blue-950" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight text-center">Biblioteca de Materiais</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('calendar')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <CalendarIcon className="w-6 h-6 text-blue-950" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight text-center">Calendário Escolar</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('occurrences')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <ClipboardList className="w-6 h-6 text-blue-950" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight text-center">Ocorrências</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('financeiro')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <CreditCard className="w-6 h-6 text-blue-950" />
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
                                <CalendarDays className="w-6 h-6 text-blue-950" />
                                Registro de frequência
                            </h3>
                            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col justify-center">
                                        <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1">Frequência Geral Anual</span>
                                        <div className="flex items-baseline gap-2">
                                            {(() => {
                                                const freqStr = calculateGeneralFrequency(studentGrades, attendanceRecords, student.id, student.gradeLevel, academicSubjects, academicSettings, calendarEvents, student.unit, classSchedules, student.schoolClass);
                                                const freqNum = parseFloat(freqStr.replace('%', ''));
                                                const isLow = !isNaN(freqNum) && freqNum < 75;
                                                return (
                                                    <div className="flex flex-col">
                                                        <div className="flex items-baseline gap-2">
                                                            <span className={`text-2xl font-black ${isLow ? 'text-orange-600' : 'text-blue-900'}`}>{freqStr}</span>
                                                            <span className="text-xs text-blue-600 font-medium whitespace-nowrap">no ano letivo</span>
                                                        </div>
                                                        <span className={`text-[10px] font-bold mt-1 ${isLow ? 'text-orange-500' : 'text-blue-600'}`}>
                                                            {isLow ? '⚠️ Abaixo do limite (75%)' : '✅ Dentro do limite permitido'}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col justify-center shadow-sm">
                                        <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1">Frequência {selectedBimester}º Bimestre</span>
                                        <div className="flex items-baseline gap-2">
                                            {(() => {
                                                const freqStr = calculateBimesterGeneralFrequency(attendanceRecords, student.id, student.gradeLevel, selectedBimester);
                                                const freqNum = parseFloat(freqStr.replace('%', ''));
                                                const isLow = !isNaN(freqNum) && freqNum < 75;
                                                return (
                                                    <div className="flex flex-col">
                                                        <div className="flex items-baseline gap-2">
                                                            <span className={`text-2xl font-black ${isLow ? 'text-orange-600' : 'text-blue-900'}`}>{freqStr}</span>
                                                            <span className="text-xs text-blue-600 font-medium whitespace-nowrap">no período</span>
                                                        </div>
                                                        <span className={`text-[10px] font-bold mt-1 ${isLow ? 'text-orange-500' : 'text-blue-600'}`}>
                                                            {isLow ? '⚠️ Atenção: Faltas elevadas' : '✅ Frequência regular'}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    <div className="bg-orange-100 p-4 rounded-xl border border-orange-200 flex flex-col justify-center shadow-sm">
                                        <span className="text-[10px] text-orange-800 font-bold uppercase tracking-wider mb-1">Total de Faltas</span>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-orange-900">{absencesThisYear}</span>
                                            <span className="text-xs text-orange-800 font-medium whitespace-nowrap">falta(s) registrada(s)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-t border-gray-100 pt-6">
                                    <p className="text-gray-600 text-sm">
                                        {(() => {
                                            const breakdown = getAttendanceBreakdown(studentAttendance, student.id, undefined, currentYear);
                                            const bimesterSummary = Object.entries(breakdown)
                                                .filter(([_, data]) => data.count > 0)
                                                .map(([bim, data]) => `${bim}º Bim: ${data.count}`)
                                                .join(" | ");

                                            return bimesterSummary ? (
                                                <span className="font-bold text-gray-800">{bimesterSummary}</span>
                                            ) : (
                                                <span className="font-bold text-gray-800 italic text-gray-400">Detalhamento por bimestre</span>
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

                                            const recordBim = getDynamicBimester(record.date, academicSettings);
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
                                            <div key={monthName} className="border-l-4 border-orange-400 pl-4 py-1">
                                                <h4 className="font-bold text-gray-800 text-lg mb-2 capitalize">{monthName}</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {records.map(record => {
                                                        const day = record.date.split('-')[2];
                                                        const individualCount = record.studentAbsenceCount?.[student.id];
                                                        const countValue = individualCount !== undefined ? individualCount : (record.lessonCount || 1);
                                                        return (
                                                            <span key={record.id} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200 shadow-sm">
                                                                Dia {day} <span className="mx-1 text-orange-300">|</span> {record.discipline}
                                                                {countValue > 1 && <span className="ml-1 opacity-75">({countValue} faltas)</span>}
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

                    {currentView === 'schedule' && <ScheduleTimeline student={student} />}


                    {currentView === 'materials' && (
                        <div className="mb-8 print:hidden">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                                <Folder className="w-6 h-6 text-blue-950" />
                                Conteúdo Acadêmico
                            </h3>

                            {/* TABS */}
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                                <button
                                    onClick={() => setMaterialsTab('files')}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${materialsTab === 'files' ? 'bg-blue-950 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
                                >
                                    Arquivos de Aula
                                </button>
                                <button
                                    onClick={() => setMaterialsTab('agenda')}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${materialsTab === 'agenda' ? 'bg-blue-950 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
                                >
                                    Agenda Diária
                                </button>
                                <button
                                    onClick={() => setMaterialsTab('exams')}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${materialsTab === 'exams' ? 'bg-blue-950 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
                                >
                                    Roteiros de Prova
                                </button>
                            </div>

                            <div className="w-full bg-white p-6 border rounded-lg shadow-md h-[600px] flex flex-col">
                                <div className="flex-1 overflow-y-auto pr-2">

                                    {/* TAB: FILES */}
                                    {materialsTab === 'files' && (
                                        studentMaterials.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {studentMaterials.map(mat => (
                                                    <div key={mat.id} className="bg-gray-50 hover:bg-white p-4 rounded-lg shadow-sm hover:shadow-md border border-gray-200 transition-all group">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wide">{mat.subject}</span>
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 uppercase tracking-wide">{mat.shift}</span>
                                                                </div>
                                                                <h3 className="font-bold text-gray-800 text-lg leading-tight mb-1">{mat.title}</h3>
                                                                <p className="text-xs text-gray-500">
                                                                    {mat.teacherName} • {new Date(mat.timestamp).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                            <div className="bg-white p-2 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                                                <FileText className="w-5 h-5 text-blue-950" />
                                                            </div>
                                                        </div>
                                                        <a
                                                            href={mat.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-blue-950 hover:bg-black text-white rounded font-bold text-sm transition-colors"
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
                                        )
                                    )}

                                    {/* TAB: AGENDA */}
                                    {materialsTab === 'agenda' && (
                                        studentAgendas.length > 0 ? (
                                            <div className="space-y-6">
                                                {/* Group by Date Logic handled visually */}
                                                {studentAgendas.map((item, index) => {
                                                    const isNewDay = index === 0 || studentAgendas[index - 1].date !== item.date;
                                                    return (
                                                        <div key={item.id} className="animate-fade-in-up">
                                                            {isNewDay && (
                                                                <div className="flex items-center gap-4 mb-4 mt-6 first:mt-0">
                                                                    <div className="bg-blue-50 text-blue-900 px-3 py-1 rounded-full text-sm font-bold border border-blue-100 shadow-sm flex items-center gap-2">
                                                                        <CalendarDays className="w-4 h-4" />
                                                                        {new Date(item.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                                    </div>
                                                                    <div className="h-px bg-gray-200 flex-1"></div>
                                                                </div>
                                                            )}

                                                            <div className="ml-4 border-l-2 border-blue-100 pl-6 pb-2 relative">
                                                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-100 border-2 border-white shadow-sm"></div>

                                                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <span className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded text-xs uppercase tracking-wide">{item.subject}</span>
                                                                        <span className="text-[10px] text-gray-400">{item.teacherName}</span>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        <div>
                                                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Em Sala</p>
                                                                            <p className="text-gray-800 text-sm leading-relaxed">{item.contentInClass}</p>
                                                                        </div>
                                                                        {item.homework && (
                                                                            <div className="bg-orange-100 p-3 rounded-md border border-orange-200">
                                                                                <p className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                                                                    <span className="w-2 h-2 rounded-full bg-orange-600 block"></span>
                                                                                    Para Casa
                                                                                </p>
                                                                                <p className="text-gray-800 text-sm font-medium">{item.homework}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                                <CalendarDays className="w-16 h-16 mb-4 opacity-20" />
                                                <p className="italic text-lg">Nenhuma agenda registrada recentemente.</p>
                                            </div>
                                        )
                                    )}

                                    {/* TAB: EXAMS */}
                                    {materialsTab === 'exams' && (
                                        studentExamGuides.length > 0 ? (
                                            <div className="space-y-4">
                                                {studentExamGuides.map(guide => {
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);
                                                    const examDate = new Date(guide.examDate + 'T00:00:00'); // Fix timezone offset issue simple
                                                    const diffTime = examDate.getTime() - today.getTime();
                                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                    const isPast = diffDays < 0;

                                                    return (
                                                        <div key={guide.id} className={`bg-white p-5 rounded-lg shadow-sm border transition-all ${isPast ? 'border-gray-200 opacity-70' : 'border-blue-200 hover:border-blue-400 hover:shadow-md'}`}>
                                                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="font-bold text-xs uppercase tracking-wide bg-blue-50 text-blue-950 px-2 py-0.5 rounded">{guide.subject}</span>
                                                                        <span className="font-bold text-xs uppercase tracking-wide bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100">
                                                                            {getDynamicBimester(guide.examDate, academicSettings)}º Bim
                                                                        </span>
                                                                        {isPast ? (
                                                                            <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Realizada</span>
                                                                        ) : diffDays === 0 ? (
                                                                            <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded animate-pulse">É HOJE!</span>
                                                                        ) : (
                                                                            <span className="text-[10px] font-bold bg-blue-100 text-blue-950 px-2 py-0.5 rounded">Faltam {diffDays} dias</span>
                                                                        )}
                                                                    </div>
                                                                    <h3 className="font-bold text-xl text-gray-800">{guide.title}</h3>
                                                                    <p className="text-sm text-gray-500">{new Date(guide.examDate).toLocaleDateString()} • {guide.teacherName}</p>
                                                                </div>
                                                                <div className="text-center bg-blue-50 p-3 rounded-lg min-w-[80px]">
                                                                    <span className="block text-blue-950 font-bold text-2xl leading-none">{new Date(guide.examDate).getDate()}</span>
                                                                    <span className="block text-blue-800 text-[10px] uppercase font-bold">{new Date(guide.examDate).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                                                                </div>
                                                            </div>

                                                            <div className="bg-gray-50 p-4 rounded-md border border-gray-100">
                                                                <p className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2">Conteúdo da Avaliação:</p>
                                                                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{guide.content}</p>
                                                                {guide.fileUrl && (
                                                                    <div className="mt-4 pt-3 border-t border-gray-200">
                                                                        <a
                                                                            href={guide.fileUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center text-sm font-bold text-blue-950 hover:text-blue-800 transition-colors"
                                                                        >
                                                                            <Download className="w-4 h-4 mr-2" />
                                                                            Baixar Arquivo Anexo (PDF)
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                                <ClipboardList className="w-16 h-16 mb-4 opacity-20" />
                                                <p className="italic text-lg">Nenhuma avaliação agendada.</p>
                                            </div>
                                        )
                                    )}

                                </div>
                            </div>
                        </div>
                    )}

                    {(currentView === 'grades' || currentView === 'early_childhood') && (
                        <div className="animate-fade-in-up">
                            {/* PRINT FIX: Styles to force single page landscape layout */}
                            <style>{`
                                @media print {
                                    @page {
                                        size: landscape;
                                        margin: 3mm; /* Minimal margin */
                                    }
                                    body {
                                        zoom: 0.58;
                                        -webkit-print-color-adjust: exact !important;
                                        print-color-adjust: exact !important;
                                        margin: 0 !important;
                                        padding: 0 !important;
                                        display: flex !important;
                                        justify-content: center !important;
                                        align-items: flex-start !important;
                                        width: 100% !important;
                                    }
                                    .print-force-landscape {
                                        width: auto !important;
                                        min-width: 100% !important;
                                        max-width: none !important;
                                        margin: 0 auto !important;
                                        max-height: none !important;
                                        overflow: visible !important;
                                        display: table !important; /* Force width discovery */
                                    }
                                    .print-student-info-grid {
                                        display: grid !important;
                                        grid-template-columns: 1fr 1fr !important;
                                        column-gap: 2rem !important;
                                        row-gap: 0.25rem !important;
                                    }
                                    .print-bulletin-container {
                                        border: 2pt solid #6b7280 !important;
                                        padding: 8mm !important;
                                        border-radius: 0 !important;
                                        width: auto !important;
                                        min-width: 100% !important;
                                        max-width: none !important;
                                        box-sizing: border-box !important;
                                        background: white !important;
                                        overflow: visible !important;
                                        margin: 0 auto !important;
                                        display: table !important; /* Force container to WRAP table width exactly */
                                    }
                                    table {
                                        width: 100% !important;
                                        border-collapse: collapse !important;
                                        table-layout: auto !important;
                                    }
                                    ::-webkit-scrollbar {
                                        display: none !important;
                                    }
                                }
                            `}</style>
                            <div className="print-bulletin-container">
                                <div className="mb-8 border-b-2 border-blue-950 pb-4 print:mb-2 print:pb-2">
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 print:gap-1">
                                        <div className="flex items-center gap-4 print:gap-2">
                                            <div className="print:block hidden w-16">
                                                <SchoolLogo variant="header" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-extrabold text-blue-950 uppercase tracking-wide print:text-lg">EXPANSIVO REDE DE ENSINO</h2>
                                                <h3 className="text-lg font-bold text-gray-700 uppercase print:text-sm">UNIDADE: {student.unit}</h3>

                                                <div className="mt-2 text-xs text-gray-500 space-y-0.5 font-medium print:mt-1 print:text-[10px]">
                                                    <p>{currentUnitInfo.address} - CEP: {currentUnitInfo.cep}</p>
                                                    <p>CNPJ: {currentUnitInfo.cnpj}</p>
                                                    <p>Tel: {currentUnitInfo.phone} | E-mail: {currentUnitInfo.email}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-left md:text-right w-full md:w-auto">
                                            <h4 className="text-xl font-bold text-gray-800 uppercase print:text-base">{isEarlyChildhood ? 'Relatório de Desenvolvimento' : headerText}</h4>
                                            <p className="text-xs text-gray-500 mt-1 print:mt-0">Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>

                                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-2 print-student-info-grid gap-y-2 gap-x-8 text-sm print:text-xs print:p-2 print:mt-2">
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
                                                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-orange-100 border border-orange-300 rounded-sm flex-shrink-0"></span> <span className="whitespace-nowrap"><strong>NO</strong> - Não Observado</span></div>
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
                                        <div className="overflow-auto w-full border border-gray-200 rounded-lg pb-4 print:pb-0 print:overflow-visible print:border-none print-force-landscape" style={{ maxHeight: '75vh' }}>
                                            <table className="min-w-[1000px] print:min-w-0 print:w-full divide-y divide-gray-200 border border-gray-300 text-sm print:text-[8px] print:leading-tight relative">
                                                <thead className="bg-blue-50 print:bg-gray-100 sticky top-0 z-20 shadow-sm">
                                                    <tr>
                                                        <th rowSpan={2} className="px-2 py-3 text-left font-bold text-gray-700 uppercase border-r border-gray-300 w-20 md:w-32 sticky left-0 bg-blue-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[10px] md:text-sm print:w-16 print:px-1 print:py-1">Disc.</th>
                                                        <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-12 text-[10px] leading-tight print:text-[8px] print:px-0.5 print:w-8 print:py-1" title="Carga Horária Prevista">C.H.<br />Prev.</th>
                                                        <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-12 text-[10px] leading-tight print:text-[8px] print:px-0.5 print:w-8 print:py-1" title="Carga Horária Ministrada Anual">C.H.<br />Min.</th>
                                                        {[1, 2, 3, 4].map(num => (
                                                            <th key={num} colSpan={6} className="px-1 py-2 text-center font-bold text-gray-700 uppercase border-r border-gray-300 print:py-1">
                                                                {num}º Bim
                                                            </th>
                                                        ))}
                                                        <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-16 text-[10px] leading-tight print:text-[8px] print:px-0.5 print:w-8 print:py-1">Méd.<br />Anual</th>
                                                        <th rowSpan={2} className="px-2 py-3 text-center font-bold text-amber-700 uppercase border-r border-gray-300 bg-amber-50 w-16 text-[10px] leading-tight print:text-[8px] print:px-0.5 print:w-8 print:py-1">Prov.<br />Final</th>
                                                        <th rowSpan={2} className="px-2 py-3 text-center font-bold text-blue-950 uppercase border-r border-gray-300 bg-blue-100 w-16 text-[10px] leading-tight print:text-[8px] print:px-0.5 print:w-8 print:py-1">Méd.<br />Final</th>

                                                        <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-10 text-[10px] leading-tight print:text-[8px] print:px-0.5 print:w-6 print:py-1">F</th>
                                                        <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-16 text-[10px] leading-tight print:text-[8px] print:px-0.5 print:w-8 print:py-1">Freq.<br />(%)</th>
                                                        <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase w-20 text-[10px] print:w-16 print:text-[8px] print:px-0.5 print:py-1">Situação</th>
                                                    </tr>
                                                    <tr className="bg-blue-50 print:bg-gray-100 text-[10px]">
                                                        {[1, 2, 3, 4].map(num => (
                                                            <React.Fragment key={num}>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600 w-8 md:w-10 print:w-5 print:px-0 print:py-0.5" title="Nota">N{num}</th>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600 w-8 md:w-10 print:w-5 print:px-0 print:py-0.5" title="Recuperação">R{num}</th>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-bold text-blue-950 bg-blue-50 w-8 md:w-10 print:w-5 print:px-0 print:py-0.5" title="Média">M{num}</th>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600 w-8 md:w-10 print:w-5 print:px-0 print:py-0.5" title="Faltas">F{num}</th>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-bold text-gray-700 bg-gray-50 w-10 md:w-12 print:w-6 print:px-0 print:py-0.5" title="Frequência">%</th>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600 w-10 md:w-12 print:w-6 print:px-0 print:py-0.5" title="CH Ministrada">Min.</th>
                                                            </React.Fragment>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {studentGrades.map((grade) => (
                                                        <tr key={grade.id} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                                                            <td className="px-2 py-2 font-bold text-gray-900 border-r border-gray-300 text-[10px] md:text-xs sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top print:w-16 print:px-1 print:py-0.5">
                                                                <span className="uppercase block leading-tight mb-1" title={grade.subject}>{abbreviateSubject(grade.subject)}</span>
                                                                <span className="text-[9px] text-gray-500 font-normal block italic whitespace-normal leading-tight break-words">
                                                                    {getTeacherName(grade.subject)}
                                                                </span>
                                                            </td>
                                                            {(() => {
                                                                let weeklyClasses = 0;
                                                                let foundDynamic = false;

                                                                if (academicSubjects && academicSubjects.length > 0) {
                                                                    const dynamicSubject = academicSubjects.find(s => s.name === grade.subject);
                                                                    if (dynamicSubject && dynamicSubject.weeklyHours) {
                                                                        const gradeKey = Object.keys(dynamicSubject.weeklyHours).find(key => student.gradeLevel.includes(key));
                                                                        if (gradeKey) {
                                                                            weeklyClasses = dynamicSubject.weeklyHours[gradeKey];
                                                                            foundDynamic = true;
                                                                        }
                                                                    }
                                                                }

                                                                if (!foundDynamic) {
                                                                    let levelKey = '';
                                                                    if (student.gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
                                                                    else if (student.gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
                                                                    else if (student.gradeLevel.includes('Ensino Médio') || student.gradeLevel.includes('Ens. Médio') || student.gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

                                                                    weeklyClasses = (CURRICULUM_MATRIX[levelKey] || {})[grade.subject] || 0;
                                                                }

                                                                const annualWorkload = weeklyClasses * 40; // 40 weeks standard
                                                                const currentYear = new Date().getFullYear();
                                                                const startOfYear = `${academicSettings?.bimesters?.[0]?.startDate || `${currentYear}-01-01`}`;
                                                                const todayStr = new Date().toLocaleDateString('en-CA');

                                                                const { taught: ministradaWorkload } = calculateTaughtClasses(
                                                                    grade.subject,
                                                                    student.gradeLevel,
                                                                    startOfYear,
                                                                    todayStr,
                                                                    student.unit,
                                                                    academicSubjects,
                                                                    classSchedules || [],
                                                                    calendarEvents || [],
                                                                    student.schoolClass
                                                                );

                                                                return (
                                                                    <>
                                                                        <td className="px-1 py-2 text-center text-gray-400 text-[10px] md:text-xs border-r border-gray-300 w-12 font-medium bg-gray-50/30">
                                                                            {formatWorkload(annualWorkload)}
                                                                        </td>
                                                                        <td className="px-1 py-2 text-center text-gray-400 text-[10px] md:text-xs border-r border-gray-300 w-12 font-medium bg-gray-50/30">
                                                                            {formatWorkload(ministradaWorkload)}
                                                                        </td>
                                                                    </>
                                                                );
                                                            })()}
                                                            {['bimester1', 'bimester2', 'bimester3', 'bimester4'].map((key) => {
                                                                const bData = grade.bimesters[key as keyof typeof grade.bimesters];
                                                                const bimesterNum = Number(key.replace('bimester', '')) as 1 | 2 | 3 | 4;

                                                                // RULE: Count absences strictly from logs
                                                                const currentAbsences = studentAttendance.reduce((acc, att) => {
                                                                    if (att.discipline !== grade.subject) return acc;
                                                                    if (att.studentStatus[student.id] === AttendanceStatus.ABSENT) {
                                                                        if (getDynamicBimester(att.date, academicSettings) === bimesterNum) {
                                                                            if (classSchedules && classSchedules.length > 0) {
                                                                                if (!isClassScheduled(att.date, grade.subject, classSchedules, calendarEvents, student.unit, student.gradeLevel, student.schoolClass)) return acc;
                                                                            }
                                                                            const individualCount = att.studentAbsenceCount?.[student.id];
                                                                            const lessonCount = individualCount !== undefined ? individualCount : (att.lessonCount || 1);

                                                                            if (classSchedules && classSchedules.length > 0) {
                                                                                return acc + getSubjectDurationForDay(att.date, grade.subject, classSchedules, lessonCount, student.gradeLevel, student.schoolClass);
                                                                            }
                                                                            return acc + lessonCount;
                                                                        }
                                                                    }
                                                                    return acc;
                                                                }, 0);

                                                                // RULE: Only active if there are assinaladas absences
                                                                const isActive = currentAbsences > 0;

                                                                return (
                                                                    <React.Fragment key={key}>
                                                                        <td className="px-1 py-1 text-center text-gray-500 font-medium text-[10px] md:text-sm border-r border-gray-300 relative w-8 md:w-10">
                                                                            {bData.isNotaApproved !== false ? formatGrade(bData.nota) : <span className="text-gray-300 pointer-events-none select-none cursor-help" title="Esta nota está em processo de atualização pela coordenação pedagógica.">-</span>}
                                                                            {bData.isNotaApproved === false && (
                                                                                <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-yellow-400 rounded-full cursor-help" title="Esta nota está em processo de atualização pela coordenação pedagógica."></div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-1 py-1 text-center text-gray-400 text-[10px] md:text-xs border-r border-gray-300 relative w-8 md:w-10">
                                                                            {bData.isRecuperacaoApproved !== false ? formatGrade(bData.recuperacao) : <span className="text-gray-300 pointer-events-none select-none cursor-help" title="Esta nota está em processo de atualização pela coordenação pedagógica.">-</span>}
                                                                            {bData.isRecuperacaoApproved === false && (
                                                                                <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-yellow-400 rounded-full cursor-help" title="Esta nota está em processo de atualização pela coordenação pedagógica."></div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-1 py-2 text-center text-black font-bold bg-gray-50 border-r border-gray-300 text-xs w-8 md:w-10">{(bData.isNotaApproved !== false && bData.isRecuperacaoApproved !== false) ? formatGrade(bData.media) : '-'}</td>
                                                                        <td className="px-1 py-1 text-center text-gray-400 text-[10px] md:text-xs border-r border-gray-300 w-8 md:w-10">
                                                                            {Math.round(currentAbsences)}
                                                                        </td>
                                                                        {(() => {
                                                                            // Calculate F(h) per bimester
                                                                            let weeklyClasses = 0;
                                                                            if (academicSubjects) {
                                                                                const ds = academicSubjects.find(s => s.name === grade.subject);
                                                                                if (ds?.weeklyHours) {
                                                                                    const k = Object.keys(ds.weeklyHours).find(key => student.gradeLevel.includes(key));
                                                                                    if (k) weeklyClasses = ds.weeklyHours[k];
                                                                                }
                                                                            }
                                                                            if (weeklyClasses === 0) {
                                                                                let lk = student.gradeLevel.includes('Fundamental II') ? 'Fundamental II' : student.gradeLevel.includes('Ensino Médio') ? 'Ensino Médio' : 'Fundamental I';
                                                                                weeklyClasses = (CURRICULUM_MATRIX[lk] || {})[grade.subject] || 0;
                                                                            }
                                                                            const bimesterFaltasH = currentAbsences * (weeklyClasses > 0 ? 1 : 0); // Assuming 1h per absence locally or direct weight if available. Using 1 for simplicity consistent with previous logic.

                                                                            const freqResult = calculateAttendancePercentage(grade.subject, currentAbsences, student.gradeLevel, bimesterNum, academicSubjects, academicSettings, calendarEvents, student.unit, classSchedules, student.schoolClass);
                                                                            const freqPercent = freqResult?.percent ?? null;
                                                                            const isFreqEstimated = freqResult?.isEstimated ?? false;
                                                                            const isLowFreq = freqPercent !== null && freqPercent < 75;
                                                                            const isBimesterStarted = bimesterNum <= elapsedBimesters;

                                                                            // Calculate CH Min per bimester (using shared logic to ensure unificaton)
                                                                            let bMin = 0;
                                                                            if (isBimesterStarted && academicSettings?.bimesters) {
                                                                                const bimConfig = academicSettings.bimesters.find((b: any) => b.number === bimesterNum);
                                                                                if (bimConfig) {
                                                                                    const bStart = bimConfig.startDate;
                                                                                    const bEnd = bimConfig.endDate;
                                                                                    const today = new Date().toLocaleDateString('en-CA');
                                                                                    const effectiveEnd = today < bEnd ? today : bEnd;

                                                                                    const { taught } = calculateTaughtClasses(
                                                                                        grade.subject,
                                                                                        student.gradeLevel,
                                                                                        bStart,
                                                                                        effectiveEnd,
                                                                                        student.unit,
                                                                                        academicSubjects,
                                                                                        classSchedules || [],
                                                                                        calendarEvents || [],
                                                                                        student.schoolClass
                                                                                    );
                                                                                    bMin = taught;
                                                                                }
                                                                            }

                                                                            return (
                                                                                <>

                                                                                    <td className={`px-1 py-1 text-center font-bold border-r border-gray-300 text-[10px] md:text-xs w-10 md:w-12 ${isLowFreq ? 'text-orange-800 bg-orange-100' : 'text-gray-500'}`} title="Frequência">
                                                                                        {isBimesterStarted ? (<div className="flex flex-col items-center"><span>{freqPercent !== null ? `${Math.round(freqPercent)}%` : '100%'}</span>{isFreqEstimated && <span className="text-[8px] text-amber-600">⚠ Est.</span>}</div>) : '-'}
                                                                                    </td>
                                                                                    <td className="px-1 py-1 text-center text-gray-400 text-[10px] md:text-[9px] border-r border-gray-300 w-10 md:w-12 bg-gray-50/50">
                                                                                        {formatWorkload(bMin)}
                                                                                    </td>
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                            <td className="px-1 py-2 text-center font-bold text-gray-700 border-r border-gray-300 bg-gray-50 text-sm">
                                                                {(grade.mediaAnualApproved === true && grade.mediaAnual >= 0) ? formatGrade(grade.mediaAnual) : '-'}
                                                            </td>
                                                            <td className={`px-1 py-1 text-center font-bold text-amber-600 text-[10px] md:text-xs border-r border-gray-300 ${grade.recuperacaoFinalApproved === false ? 'bg-yellow-100' : 'bg-amber-50/30'}`}>
                                                                {grade.recuperacaoFinalApproved !== false ? formatGrade(grade.recuperacaoFinal) : <span className="text-gray-300">-</span>}
                                                            </td>
                                                            <td className="px-1 py-1 text-center font-extrabold text-blue-900 bg-blue-50/50 text-xs md:text-sm border-r border-gray-300">
                                                                {grade.mediaFinal >= 0 ? formatGrade(grade.mediaFinal) : '-'}
                                                            </td>
                                                            {(() => {
                                                                const totalAbsences = [1, 2, 3, 4].reduce((sum, bNum) => {
                                                                    if (bNum > elapsedBimesters) return sum;
                                                                    return sum + studentAttendance.reduce((acc, att) => {
                                                                        if (att.discipline !== grade.subject) return acc;
                                                                        if (att.studentStatus[student.id] === AttendanceStatus.ABSENT) {
                                                                            if (getDynamicBimester(att.date, academicSettings) === bNum) {
                                                                                if (classSchedules && classSchedules.length > 0) {
                                                                                    if (!isClassScheduled(att.date, grade.subject, classSchedules, calendarEvents, student.unit, student.gradeLevel, student.schoolClass)) return acc;
                                                                                }
                                                                                const individualCount = att.studentAbsenceCount?.[student.id];
                                                                                const lessonCount = individualCount !== undefined ? individualCount : (att.lessonCount || 1);

                                                                                if (classSchedules && classSchedules.length > 0) {
                                                                                    return acc + getSubjectDurationForDay(att.date, grade.subject, classSchedules, lessonCount, student.gradeLevel, student.schoolClass);
                                                                                }
                                                                                return acc + lessonCount;
                                                                            }
                                                                        }
                                                                        return acc;
                                                                    }, 0);
                                                                }, 0);

                                                                // Get weeklyClasses again
                                                                let weeklyClasses = 0;
                                                                if (academicSubjects) {
                                                                    const ds = academicSubjects.find(s => s.name === grade.subject);
                                                                    if (ds?.weeklyHours) {
                                                                        const k = Object.keys(ds.weeklyHours).find(key => student.gradeLevel.includes(key));
                                                                        if (k) weeklyClasses = ds.weeklyHours[k];
                                                                    }
                                                                }
                                                                if (weeklyClasses === 0) {
                                                                    let lk = student.gradeLevel.includes('Fundamental II') ? 'Fundamental II' : student.gradeLevel.includes('Ensino Médio') ? 'Ensino Médio' : 'Fundamental I';
                                                                    weeklyClasses = (CURRICULUM_MATRIX[lk] || {})[grade.subject] || 0;
                                                                }

                                                                const annualResult = calculateAnnualAttendancePercentage(grade.subject, totalAbsences, student.gradeLevel, elapsedBimesters, academicSubjects, academicSettings, calendarEvents, student.unit, classSchedules, student.schoolClass);
                                                                const annualFreq = annualResult?.percent ?? null;
                                                                const isAnnualEstimated = annualResult?.isEstimated ?? false;
                                                                const isCritical = annualFreq !== null && annualFreq < 75;

                                                                // Calculate Annual Ministrada
                                                                const currentYear = new Date().getFullYear();
                                                                const startOfYear = `${currentYear}-01-01`;
                                                                const today = new Date().toLocaleDateString('en-CA');
                                                                const totalDaysElapsed = calculateSchoolDays(startOfYear, today, calendarEvents);
                                                                const ministradaWorkload = Math.round((weeklyClasses / 5) * totalDaysElapsed);

                                                                return (
                                                                    <>
                                                                        <td className="px-1 py-1 text-center font-bold border-r border-gray-300 text-[10px] md:text-xs text-gray-500">
                                                                            {Math.round(totalAbsences)}
                                                                        </td>
                                                                        <td className={`px-1 py-1 text-center font-bold border-r border-gray-300 text-[10px] md:text-xs ${isCritical ? 'text-orange-800 bg-orange-100' : 'text-gray-600'}`}>
                                                                            <div className="flex flex-col items-center"><span>{annualFreq !== null ? `${Math.round(annualFreq)}%` : '100%'}</span>{isAnnualEstimated && <span className="text-[8px] text-amber-600">⚠ Est.</span>}</div>
                                                                        </td>
                                                                    </>
                                                                );
                                                            })()}
                                                            <td className="px-1 py-2 text-center align-middle print:px-0">
                                                                <span className={`inline-block w-full py-0.5 rounded text-[9px] uppercase font-bold border ${grade.situacaoFinal === 'Aprovado' ? 'bg-blue-50 text-blue-950 border-blue-200' :
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
                                                        const generalFreq = calculateGeneralFrequency(studentGrades, attendanceRecords, student.id, student.gradeLevel, academicSubjects, academicSettings, calendarEvents, student.unit, classSchedules, student.schoolClass);
                                                        return (
                                                            <tr className="bg-gray-100/80 font-bold border-t-2 border-gray-400">
                                                                <td colSpan={31} className="px-4 py-1 text-right uppercase tracking-wider text-blue-950 font-extrabold text-[11px]">
                                                                    FREQUÊNCIA GERAL NO ANO LETIVO:
                                                                </td>
                                                                <td className="px-1 py-1 text-center text-blue-900 font-extrabold text-[11px] md:text-sm bg-blue-50/50 border-r border-gray-300">
                                                                    {generalFreq}
                                                                </td>
                                                                <td className="bg-gray-100/80"></td>
                                                            </tr>
                                                        );
                                                    })()}
                                                    {studentGrades.length === 0 && (
                                                        <tr><td colSpan={33} className="px-6 py-8 text-center text-gray-500 italic">Nenhuma nota lançada para este período letivo.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        {studentGrades.length > 0 && (
                                            <div className="mt-2 flex items-center gap-2 text-xs text-orange-800 bg-orange-100 p-2 rounded border border-orange-200 print:hidden">
                                                <div className="w-2.5 h-2.5 bg-orange-500 rounded-full flex-shrink-0"></div>
                                                <span>= Nota em processo de atualização pela coordenação pedagógica.</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}





                    {currentView === 'support' && (
                        <div className="mt-8 print:hidden animate-fade-in-up">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 border-b border-gray-200 pb-2 flex items-center gap-2">
                                <LifeBuoy className="w-6 h-6 text-blue-950" />
                                Centro de Suporte ao Aluno
                            </h3>

                            {/* Bimester Selector */}
                            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                                {[1, 2, 3, 4].map((bim) => (
                                    <button
                                        key={bim}
                                        onClick={() => setSelectedSupportBimester(bim)}
                                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${selectedSupportBimester === bim
                                            ? 'bg-blue-900 text-white shadow-md transform scale-105'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        {bim}º Bimestre
                                    </button>
                                ))}
                            </div>

                            {supportNeededGrades.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
                                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <LifeBuoy className="w-8 h-8 text-blue-300" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-700 mb-2">Tudo certo por aqui!</h3>
                                    <p className="text-gray-500 max-w-md mx-auto">
                                        Nenhuma dificuldade foi apontada pelos professores para o {selectedSupportBimester}º Bimestre.
                                        Continue se dedicando aos estudos! 🚀
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {supportNeededGrades.map((grade) => {
                                        const teacherPhone = getTeacherPhone(grade.subject);
                                        const media = grade.mediaAnual || 0;
                                        const isLowGrade = media < 7.0 && grade.situacaoFinal !== 'Aprovado';

                                        // Get specific bimester data
                                        const bKey = `bimester${selectedSupportBimester}`;
                                        const bData = (grade.bimesters as any)[bKey] as BimesterData;
                                        const difficultyTopic = bData?.difficultyTopic;

                                        let statusConfig = {
                                            color: 'border-l-blue-950', // Default color
                                            badge: '',
                                            badgeColor: '',
                                            message: '',
                                            showContactButton: false
                                        };

                                        // Status logic based on bimester media (if available) or annual
                                        if (bData && bData.media !== undefined && bData.media !== null && bData.media !== -1) {
                                            if (bData.media < 7.0) {
                                                statusConfig = { color: 'border-l-orange-500', badge: 'Atenção', badgeColor: 'bg-orange-100 text-orange-800', message: 'Nota abaixo da média. Recomendamos reforço.', showContactButton: true };
                                            } else if (bData.media >= 7.0) {
                                                statusConfig = { color: 'border-l-blue-500', badge: 'Bom', badgeColor: 'bg-blue-100 text-blue-800', message: '', showContactButton: false };
                                            }
                                        } else if (isLowGrade) {
                                            statusConfig = { color: 'border-l-orange-500', badge: 'Atenção', badgeColor: 'bg-orange-100 text-orange-800', message: 'Nota abaixo da média. Recomendamos reforço.', showContactButton: true };
                                        }

                                        const waPhone = teacherPhone ? teacherPhone.replace(/\D/g, '') : '';

                                        return (
                                            <div key={grade.id} className={`p-5 border-l-4 rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg ${statusConfig.color} flex flex-col`}>
                                                <div className="flex justify-between items-start mb-3">
                                                    <h4 className="text-lg font-bold text-gray-800">{grade.subject}</h4>
                                                    {statusConfig.badge && <span className={`${statusConfig.badgeColor} text-xs font-bold px-2 py-1 rounded`}>{statusConfig.badge}</span>}
                                                </div>

                                                <div className="mb-3 flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                        Referência: <span className="text-gray-700">{selectedSupportBimester}º Bimestre</span>
                                                    </span>
                                                    {bData && bData.media !== undefined && bData.media !== -1 && (
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${bData.media >= 7 ? 'bg-blue-50 text-blue-900 border-blue-100' : 'bg-orange-100 text-orange-800 border-orange-200'}`}>
                                                            Nota: {formatGrade(bData.media)}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="mb-4 space-y-3 flex-grow">
                                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                                        <p className="font-bold text-gray-700 block mb-2 text-sm">
                                                            🔍 Dificuldade Identificada:
                                                        </p>
                                                        <p className="text-sm text-gray-600 italic pl-2 border-l-2 border-gray-300">"{difficultyTopic}"</p>
                                                        <div className="mt-3">
                                                            <button
                                                                onClick={() => handleGetHelp(grade.subject as Subject, difficultyTopic!)}
                                                                className="w-full bg-gradient-to-r from-blue-950 to-slate-900 text-white hover:from-blue-900 hover:to-slate-800 py-2 rounded-lg text-xs font-bold flex items-center justify-center transition-all shadow-sm hover:shadow-md transform active:scale-95"
                                                            >
                                                                <Bot className="w-4 h-4 mr-2" />
                                                                Ajuda da IA
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {statusConfig.message && <p className="text-sm text-gray-500 italic font-medium pt-2">{statusConfig.message}</p>}
                                                </div>

                                                <div className="mt-auto border-t border-gray-100 pt-4">
                                                    <button
                                                        onClick={() => handleOpenTicketModal(grade.subject)}
                                                        className="w-full bg-blue-600 text-white hover:bg-blue-700 py-2.5 rounded-md text-sm font-bold flex items-center justify-center transition-colors shadow-sm"
                                                    >
                                                        <Mail className="w-4 h-4 mr-2" />
                                                        Enviar Dúvida ao Professor
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {currentView === 'messages' && (
                        <div className="animate-fade-in-up space-y-8">
                            <MessageBox student={student} onSendMessage={onSendMessage} unitContacts={unitContacts || []} teachers={teachers} />

                            <div>
                                <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2 border-b border-gray-100 pb-2">
                                    <MessageCircle className="w-6 h-6 text-blue-950" />
                                    Minhas Mensagens e Respostas
                                </h3>

                                {schoolMessages.length === 0 ? (
                                    <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
                                        <p className="text-gray-400 italic">Você ainda não possui histórico de mensagens com a escola.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {schoolMessages.map(msg => (
                                            <div key={msg.id} className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                <div className="p-5">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black border ${msg.messageType === 'Elogio' ? 'bg-green-50 text-green-600 border-green-100' :
                                                                    msg.messageType === 'Sugestão' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                        'bg-red-50 text-red-600 border-red-100'
                                                                    }`}>
                                                                    {msg.messageType}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                                    Para: {msg.recipient}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-gray-400 font-medium">
                                                                {new Date(msg.timestamp).toLocaleDateString('pt-BR')} às {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${msg.status === 'new' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {msg.status === 'new' ? 'Aguardando Leitura' : 'Lida pela Escola'}
                                                        </span>
                                                    </div>

                                                    <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 border border-gray-100 whitespace-pre-wrap">
                                                        {msg.content && msg.content.includes(']') ? msg.content.substring(msg.content.indexOf(']') + 1).trim() : (msg.content || '(Sem conteúdo)')}
                                                    </div>

                                                    {msg.response ? (
                                                        <div className="mt-4 bg-blue-50 border border-blue-100 p-4 rounded-lg relative">
                                                            <div className="absolute -top-3 left-4 bg-white px-2 py-0.5 rounded text-[9px] font-black text-blue-500 border border-blue-100 shadow-sm flex items-center gap-1">
                                                                <Mail className="w-3 h-3" />
                                                                RESPOSTA DA COORDENAÇÃO
                                                            </div>
                                                            <div className="bg-white/40 p-4 rounded-xl border border-blue-200/50 mt-2 shadow-sm">
                                                                <p className="text-gray-900 text-sm font-semibold leading-relaxed">
                                                                    {msg.response}
                                                                </p>
                                                            </div>
                                                            <p className="text-[10px] text-blue-400 mt-2 text-right font-bold uppercase tracking-wider">
                                                                Respondido em {new Date(msg.responseTimestamp!).toLocaleDateString('pt-BR')}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/50 p-2 rounded-lg border border-dashed border-gray-200 justify-center">
                                                            <Clock className="w-3 h-3" />
                                                            Aguardando resposta da equipe pedagógica
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {currentView === 'calendar' && (
                        <SchoolCalendar events={calendarEvents} />
                    )}

                    {currentView === 'tickets' && (
                        <div className="animate-fade-in-up">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 border-b border-gray-200 pb-2 flex items-center gap-2">
                                <CircleHelp className="w-6 h-6 text-blue-950" />
                                Minhas Dúvidas
                            </h3>

                            {studentTickets.length === 0 ? (
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
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${ticket.status === TicketStatus.PENDING ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {ticket.status === TicketStatus.PENDING ? 'Aguardando Resposta' : 'Respondido'}
                                                </span>
                                            </div>

                                            <div className="bg-gray-50 p-3 rounded-md mb-3 text-sm text-gray-700 border border-gray-100">
                                                <span className="font-bold text-gray-900 block mb-1">Sua Pergunta:</span>
                                                {ticket.message}
                                            </div>

                                            {ticket.response ? (
                                                <div className="bg-blue-50/50 p-3 rounded-md text-sm text-gray-800 border border-blue-100">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <User className="w-5 h-5 text-blue-800" />
                                                        <span className="font-bold text-blue-900">Resposta do Professor{ticket.responderName ? ` (${ticket.responderName})` : ''}:</span>
                                                    </div>
                                                    <p className="whitespace-pre-wrap pl-2 border-l-2 border-blue-200">{ticket.response}</p>
                                                    <p className="text-[10px] text-gray-400 mt-2 text-right">Respondido em {new Date(ticket.responseTimestamp!).toLocaleDateString()}</p>

                                                    <div className="mt-3 pt-2 border-t border-blue-200/50 flex items-center gap-2 text-[10px] uppercase font-bold text-blue-800/60 tracking-wider">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                                        Interação concluída pelo professor
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-center py-2 bg-orange-100 rounded border border-dashed border-orange-200">
                                                    <p className="text-[10px] font-bold text-orange-700 uppercase tracking-widest italic">Aguardando atendimento do professor...</p>
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
                                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            </div>
                                            <h4 className="text-xl font-bold text-gray-800 mb-2">Dúvida Enviada!</h4>
                                            <p className="text-gray-600 text-sm max-w-xs mx-auto">
                                                O professor responderá sua dúvida dentro do horário de planejamento escolar.
                                            </p>
                                            <div className="mt-6 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 animate-progress-shrink origin-left"></div>
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
                                            <div className="bg-orange-100 p-3 rounded-lg border border-orange-200 text-xs text-orange-800 flex gap-2">
                                                <Lightbulb className="w-5 h-5 text-orange-600 flex-shrink-0" />
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
                    {currentView === 'occurrences' && (
                        <div className="animate-fade-in-up">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 border-b border-gray-200 pb-2 flex items-center gap-2">
                                <ClipboardList className="w-6 h-6 text-blue-950" />
                                Livro de Ocorrências
                            </h3>

                            {isLoadingOccurrences ? (
                                <TableSkeleton rows={3} />
                            ) : occurrences.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
                                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ClipboardList className="w-8 h-8 text-blue-950" />
                                    </div>
                                    <h4 className="font-bold text-gray-800 mb-1">Nenhuma ocorrência registrada</h4>
                                    <p className="text-gray-500 text-sm">Parabéns! Seu histórico comportamental está excelente.</p>
                                    <Button onClick={() => setCurrentView('menu')} className="mt-4">
                                        Voltar ao Menu
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {occurrences.map(occ => (
                                        <div key={occ.id} className="bg-white border-l-4 border-red-500 rounded-r-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded mr-2">{occ.category}</span>
                                                    <span className="text-xs text-gray-400">{new Date(occ.date).toLocaleDateString()}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider block">Coordenador Pedagógico</span>
                                                    <span className="text-xs font-bold text-gray-600 block">{occ.authorName}</span>
                                                </div>
                                            </div>
                                            <h4 className="text-lg font-bold text-gray-900 mb-2">{occ.title}</h4>
                                            <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                                                {occ.description}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div >

            {/* --- Banner Modal --- */}
            {
                isBannerOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
                        <div
                            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-scale-in"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white relative">
                                <button
                                    onClick={() => setIsBannerOpen(false)}
                                    className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-1.5 rounded-full transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-2 backdrop-blur-sm">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                                </div>
                                <h3 className="text-lg font-bold">Informativo Escolar</h3>
                            </div>

                            {/* Modal Content */}
                            <div className="p-4">
                                <div className="flex items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h4 className="text-gray-900 font-bold text-lg">Rematrículas Abertas 2026</h4>
                                            <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-orange-200">NOVO</span>
                                        </div>
                                        <p className="text-gray-600 text-sm leading-relaxed mb-4">
                                            Garanta sua renovação com condições especiais até o final deste mês. Procure a secretaria da sua unidade para mais informações e não perca os prazos!
                                        </p>

                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex gap-3">
                                            <InfoIcon className="w-5 h-5 shrink-0 text-blue-500" />
                                            <span>Horário de atendimento: Segunda a Sexta, das 8h às 11h30 | das 13h às 17h.</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={() => setIsBannerOpen(false)}
                                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors"
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

// Simple Info Icon Component for the Modal
const InfoIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);