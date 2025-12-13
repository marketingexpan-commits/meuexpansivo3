import React, { useState, useMemo } from 'react';
// FIX: Add BimesterData to imports to allow for explicit typing and fix property access errors.
import { Student, GradeEntry, Teacher, Subject, SchoolMessage, MessageRecipient, MessageType, AttendanceRecord, AttendanceStatus, BimesterData, UnitContact, EarlyChildhoodReport, CompetencyStatus, AppNotification } from '../types';
import { getStudyTips } from '../services/geminiService';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { MessageBox } from './MessageBox';

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
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
    student,
    grades,
    teachers = [],
    attendanceRecords,
    earlyChildhoodReports = [],
    unitContacts = [],
    onLogout,
    onSendMessage,
    notifications = [],
    onMarkNotificationAsRead
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', tip: '' });
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [currentView, setCurrentView] = useState<'menu' | 'grades' | 'attendance' | 'support' | 'messages' | 'early_childhood'>('menu');
    const [showNotifications, setShowNotifications] = useState(false);

    const unreadNotifications = notifications.filter(n => !n.read).length;

    // Estado para controle do semestre do relatório infantil
    const [selectedReportSemester, setSelectedReportSemester] = useState<1 | 2>(1);

    // Estado para controle do mês de frequência
    const [selectedAttendanceMonth, setSelectedAttendanceMonth] = useState<number>(new Date().getMonth());

    const MONTH_NAMES = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const semester = currentMonth >= 7 ? 2 : 1;
    const headerText = `Boletim Escolar ${currentYear}.${semester}`;

    const studentGrades = (grades || []).filter(g => g.studentId === student.id);
    const currentUnitInfo = UNITS_DATA[student.unit] || DEFAULT_UNIT_DATA;

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
        return attendanceRecords
            .map(record => {
                if (record.studentStatus && record.studentStatus[student.id]) {
                    return {
                        date: record.date,
                        status: record.studentStatus[student.id],
                        discipline: record.discipline, // Added Discipline
                    };
                }
                return null;
            })
            .filter((record): record is { date: string; status: AttendanceStatus; discipline: string } => record !== null)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [attendanceRecords, student.id]);

    const displayedAttendance = useMemo(() => {
        return studentAttendance
            .filter(record => {
                const recordDate = new Date(record.date + 'T00:00:00');
                const matchesFilter = recordDate.getFullYear() === currentYear &&
                    recordDate.getMonth() === selectedAttendanceMonth;
                return matchesFilter;
            })
            .map(record => {
                const recordDate = new Date(record.date + 'T00:00:00');
                const bimester = Math.floor(recordDate.getMonth() / 3) + 1;
                return { ...record, bimester };
            });
    }, [studentAttendance, currentYear, selectedAttendanceMonth]);

    const absencesThisMonth = useMemo(() => {
        return displayedAttendance.filter(record => record.status === AttendanceStatus.ABSENT).length;
    }, [displayedAttendance]);

    const absencesThisYear = useMemo(() => {
        return studentAttendance.filter(record => {
            const recordDate = new Date(record.date + 'T00:00:00');
            return recordDate.getFullYear() === currentYear && record.status === AttendanceStatus.ABSENT;
        }).length;
    }, [studentAttendance, currentYear]);

    const calculatedAbsencesByBimester = useMemo(() => {
        const absences = { 1: 0, 2: 0, 3: 0, 4: 0 };
        studentAttendance.forEach(record => {
            if (record.status === AttendanceStatus.ABSENT) {
                const recordDate = new Date(record.date + 'T00:00:00');
                if (recordDate.getFullYear() === currentYear) {
                    const bimester = Math.floor(recordDate.getMonth() / 3) + 1;
                    if (bimester >= 1 && bimester <= 4) {
                        absences[bimester as keyof typeof absences]++;
                    }
                }
            }
        });
        return absences;
    }, [studentAttendance, currentYear]);


    const formatGrade = (grade: number | null | undefined) => (grade !== null && grade !== undefined && grade !== 0) ? grade.toFixed(1) : '-';

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

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans transition-all duration-500 ease-in-out print:min-h-0 print:h-auto print:bg-white print:p-0 print:block print:overflow-visible">
            <div className={`w-full bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col transition-all duration-500 ease-in-out ${currentView === 'menu' ? 'max-w-md' : 'max-w-5xl'} print:min-h-0 print:h-auto print:shadow-none print:rounded-none`}>

                {/* CABEÇALHO (GRADIENTE AZUL MARINHO - Igual ao Login) */}
                {/* CABEÇALHO (GRADIENTE AZUL MARINHO - Igual ao Login) */}
                {/* CABEÇALHO (GRADIENTE AZUL MARINHO - Simplificado) */}
                <div className="bg-gradient-to-br from-blue-950 to-slate-900 p-6 pb-12 shadow-md relative shrink-0 print:hidden">
                    <div className="flex flex-row justify-between items-center relative">
                        {/* LEFT: Back Button + Mural Title */}
                        <div className="flex items-center gap-3 text-white">
                            {currentView !== 'menu' && (
                                <button
                                    onClick={() => setCurrentView('menu')}
                                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm text-white border border-white/20"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                </button>
                            )}
                            {/* Mural Content in Header - Visible on All Pages, Hidden on Print */}
                            <div className="flex items-start gap-3">
                                <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm shrink-0">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h3 className="text-white font-bold text-sm tracking-wide">Matrículas Abertas 2026</h3>
                                        <span className="bg-green-500 text-[9px] px-1.5 py-0.5 rounded text-white font-extrabold uppercase tracking-wide">Novo</span>
                                    </div>
                                    <p className="text-blue-100 text-[10px] leading-tight max-w-[200px] opacity-90">
                                        Garanta sua vaga com condições especiais até o final do mês. Procure a secretaria!
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Notifications & Logout */}
                        <div className="flex items-center gap-2">
                            {/* Notification Bell */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    className="p-2 text-white/80 hover:text-white transition-colors relative hover:bg-white/10 rounded-full"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                                    {unreadNotifications > 0 && (
                                        <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full border border-blue-900 animate-pulse">
                                            {unreadNotifications}
                                        </span>
                                    )}
                                </button>

                                {/* Notifications Dropdown (Mobile Optimized) */}
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
                            <Button variant="secondary" onClick={onLogout} className="!bg-transparent border-none !text-white font-medium hover:!text-gray-200 shadow-none !px-0 text-xs py-1 px-2 h-auto min-h-0">Sair</Button>
                        </div>
                    </div>
                </div>

                {/* --- STUDENT INFO BAR (Replacing Tabs - Hidden on Bulletin) --- */}
                {currentView !== 'grades' && currentView !== 'early_childhood' && (
                    <div className="flex flex-col border-b border-gray-100 bg-white rounded-t-3xl -mt-6 relative z-10 overflow-hidden shrink-0 shadow-sm mx-0">
                        <div className="bg-blue-50/50 py-3 px-4 md:px-6 flex items-center justify-between border-b-2 border-blue-900">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Aluno(a)</span>
                                <span className="text-sm font-bold text-blue-900 truncate max-w-[180px] leading-tight">{student.name}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Turma</span>
                                <div className="text-right">
                                    <span className="text-xs font-bold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-200 block">{student.gradeLevel || 'N/A'}</span>
                                    <span className="text-[10px] font-semibold text-gray-500 mt-0.5 block">{student.unit}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- CONTEÚDO (SHEET BODY) --- */}
                <div className={`p-4 md:p-6 pt-2 bg-white min-h-[500px] ${(currentView === 'grades' || currentView === 'early_childhood') ? 'rounded-t-3xl -mt-6 relative z-10 print:mt-0 print:rounded-none' : ''}`}>

                    {/* --- MENU VIEW --- */}
                    {/* --- MENU VIEW --- */}
                    {currentView === 'menu' && (
                        <div className="animate-fade-in-up flex flex-col h-full justify-between">

                            {/* Content Wrapper */}
                            <div className="space-y-1">

                                {/* BRANDING (Moved from Header) */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12">
                                            <SchoolLogo variant="login" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-extrabold text-blue-950 tracking-tight leading-tight">Meu Expansivo</h2>
                                        </div>
                                    </div>
                                </div>

                                {/* Welcome Context */}
                                <div className="text-left pb-4">
                                    <p className="text-gray-500 text-sm">Selecione uma opção para visualizar.</p>
                                </div>

                                {/* Grid de Opções (2 Colunas - Style Login Grid) */}
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setCurrentView(isEarlyChildhood ? 'early_childhood' : 'grades')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                            <span className="text-xl">📊</span>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm">Boletim Escolar</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('attendance')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-green-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-green-100 transition-colors">
                                            <span className="text-xl">📅</span>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Registro de frequência</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('support')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-purple-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-purple-100 transition-colors">
                                            <span className="text-xl">🆘</span>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center leading-tight">Centro de Suporte ao Aluno</h3>
                                    </button>

                                    <button
                                        onClick={() => setCurrentView('messages')}
                                        className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-orange-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-orange-100 transition-colors">
                                            <span className="text-xl">💬</span>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm leading-tight text-center">Fale com a Escola</h3>
                                    </button>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* --- FREQUÊNCIA --- */}
                    {currentView === 'attendance' && (
                        <div className="mb-8 print:hidden">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                                <span className="text-2xl">📅</span> Registro de frequência
                            </h3>
                            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
                                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                                    <p className="text-gray-600 text-sm">
                                        Resumo em <span className="font-bold text-gray-800">{MONTH_NAMES[selectedAttendanceMonth]}</span>: <span className={`font-bold ${absencesThisMonth > 0 ? 'text-red-600' : 'text-green-600'}`}>{absencesThisMonth} falta(s)</span>.
                                        <span className="ml-2 text-gray-500">|</span> <span className="ml-2">Total no ano: <span className="font-bold text-gray-800">{absencesThisYear} falta(s)</span></span>
                                    </p>
                                    <select
                                        value={selectedAttendanceMonth}
                                        onChange={(e) => setSelectedAttendanceMonth(Number(e.target.value))}
                                        className="p-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {MONTH_NAMES.map((month, index) => (
                                            <option key={index} value={index}>{month}</option>
                                        ))}
                                    </select>
                                </div>

                                {displayedAttendance.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-center mb-6">
                                        {displayedAttendance.map((att, index) => (
                                            <div key={index} className="p-3 border rounded-lg flex flex-col items-center justify-center bg-gray-50">
                                                <p className="text-xs text-gray-500 font-bold mb-1">
                                                    {new Date(att.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                </p>
                                                <p className="text-[10px] text-blue-900 font-extrabold uppercase mb-1 text-center leading-tight">
                                                    {att.discipline || 'Disciplina'}
                                                </p>
                                                <span className="text-[9px] text-gray-400 font-medium mb-1.5">{att.bimester}º Bimestre</span>
                                                <span className={`px-3 py-1 text-xs font-bold rounded-full text-white ${att.status === 'Presente' ? 'bg-green-500' : 'bg-red-600'}`}>
                                                    {att.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 italic py-4">Nenhum registro de frequência encontrado para {MONTH_NAMES[selectedAttendanceMonth]}.</p>
                                )}


                            </div>
                        </div>
                    )}


                    {/* --- BOLETIM / RELATÓRIO --- */}
                    {(currentView === 'grades' || currentView === 'early_childhood') && (
                        <div className="animate-fade-in-up">
                            {/* --- CABEÇALHO DO BOLETIM (COMUM A TODOS) --- */}
                            <div className="mb-8 border-b-2 border-blue-950 pb-4">
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="print:block hidden w-20">
                                            <SchoolLogo variant="login" />
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

                            {/* --- BOTÃO DOWNLOAD --- */}
                            <div className="mb-6 flex justify-end print:hidden">
                                <Button
                                    type="button"
                                    onClick={handleDownloadPDF}
                                    className="flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                    {isEarlyChildhood ? 'Baixar Relatório (PDF)' : 'Baixar Boletim (PDF)'}
                                </Button>
                            </div>

                            {/* --- RENDERIZAÇÃO CONDICIONAL: EDUCAÇÃO INFANTIL vs FUNDAMENTAL/MÉDIO --- */}
                            {isEarlyChildhood ? (
                                // --- VIEW EDUCAÇÃO INFANTIL ---
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

                                        {/* LEGENDA */}
                                        {/* LEGENDA */}
                                        <div className="flex flex-wrap justify-center gap-4 my-6 text-xs">
                                            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-100 border border-green-300 rounded-sm flex-shrink-0"></span> <span className="whitespace-nowrap"><strong>D</strong> - Desenvolvido</span></div>
                                            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded-sm flex-shrink-0"></span> <span className="whitespace-nowrap"><strong>EP</strong> - Em Processo</span></div>
                                            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-100 border border-red-300 rounded-sm flex-shrink-0"></span> <span className="whitespace-nowrap"><strong>NO</strong> - Não Observado</span></div>
                                        </div>

                                        {/* CORREÇÃO: Verificar se currentReport existe antes de acessar fields */}
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

                                                {/* OBSERVAÇÕES DO PROFESSOR */}
                                                <div className="mt-8 border border-gray-200 rounded-lg p-6 bg-blue-50/30">
                                                    <h4 className="font-bold text-blue-950 mb-3 flex items-center gap-2">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
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
                                // --- VIEW FUNDAMENTAL E MÉDIO (Notas Numéricas) ---
                                <>
                                    {/* --- VIEW GRADES: RESPONSIVE TABLE (ALL SCREENS) --- */}
                                    <div className="overflow-x-auto pb-4 w-full print:overflow-visible print:w-full print:pb-0">
                                        {/* Print Adjustment: Remove fixed min-width to allow shrinking, reduce text size further */}
                                        <table className="min-w-[1000px] print:min-w-0 print:w-full divide-y divide-gray-200 border border-gray-300 text-sm print:text-[8px] print:leading-tight">
                                            <thead className="bg-blue-50 print:bg-gray-100">
                                                <tr>
                                                    <th rowSpan={2} className="px-2 py-3 text-left font-bold text-gray-700 uppercase border-r border-gray-300 w-20 md:w-32 sticky left-0 bg-blue-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[10px] md:text-sm">Disciplina</th>
                                                    {[1, 2, 3, 4].map(num => (
                                                        <th key={num} colSpan={4} className="px-1 py-2 text-center font-bold text-gray-700 uppercase border-r border-gray-300">
                                                            {num}º Bim
                                                        </th>
                                                    ))}
                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-16 text-[10px] leading-tight">Média<br />Anual</th>
                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-red-700 uppercase border-r border-gray-300 bg-red-50 w-16 text-[10px] leading-tight">Prova<br />Final</th>
                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-blue-950 uppercase border-r border-gray-300 bg-blue-100 w-16 text-[10px] leading-tight">Média<br />Final</th>
                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase w-20 text-[10px]">Situação</th>
                                                </tr>
                                                <tr className="bg-blue-50 print:bg-gray-100 text-[10px]">
                                                    {[1, 2, 3, 4].map(num => (
                                                        <React.Fragment key={num}>
                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600" title="Nota">N{num}</th>
                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600" title="Recuperação">R{num}</th>
                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-bold text-blue-950 bg-blue-50" title="Média">M{num}</th>
                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600" title="Faltas">F{num}</th>
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

                                                            // STRICT SUBJECT ABSENCE COUNT
                                                            const currentAbsences = studentAttendance.reduce((acc, att) => {
                                                                if (att.discipline !== grade.subject) return acc;
                                                                if (att.status === AttendanceStatus.ABSENT) {
                                                                    const d = new Date(att.date + 'T00:00:00');
                                                                    if (d.getFullYear() === currentYear) {
                                                                        const m = d.getMonth(); // 0 - 11

                                                                        // Explicit Ranges (Jan=0, Dec=11)
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
                                                                    <td className="px-1 py-2 text-center text-gray-600 border-r border-gray-300 text-xs">{formatGrade(bData.nota)}</td>
                                                                    <td className="px-1 py-2 text-center text-gray-600 border-r border-gray-300 text-xs">{formatGrade(bData.recuperacao)}</td>
                                                                    <td className="px-1 py-2 text-center text-black font-bold bg-gray-50 border-r border-gray-300 text-xs">{formatGrade(bData.media)}</td>
                                                                    <td className="px-1 py-2 text-center text-gray-500 border-r border-gray-300 text-xs">{currentAbsences || ''}</td>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                        <td className="px-1 py-2 text-center font-bold text-gray-700 border-r border-gray-300 bg-gray-50 text-sm">{formatGrade(grade.mediaAnual)}</td>
                                                        <td className="px-1 py-2 text-center font-bold text-red-600 border-r border-gray-300 bg-red-50 text-sm">{formatGrade(grade.recuperacaoFinal)}</td>
                                                        <td className="px-1 py-2 text-center font-extrabold text-blue-950 border-r border-gray-300 bg-blue-50 text-sm">{formatGrade(grade.mediaFinal)}</td>
                                                        <td className="px-1 py-2 text-center align-middle">
                                                            <span className={`inline-block w-full py-0.5 rounded text-[9px] uppercase font-bold border ${grade.situacaoFinal === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                grade.situacaoFinal === 'Recuperação' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                    'bg-red-50 text-red-700 border-red-200'
                                                                }`}>
                                                                {grade.situacaoFinal}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {studentGrades.length === 0 && (
                                                    <tr><td colSpan={21} className="px-6 py-8 text-center text-gray-500 italic">Nenhuma nota lançada para este período letivo.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {/* --- SUPORTE AO ALUNO --- */}
                    {currentView === 'support' && supportNeededGrades.length > 0 && (
                        <div className="mt-8 print:hidden animate-fade-in-up">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 border-b border-gray-200 pb-2">
                                <span className="mr-2">🆘</span> Centro de Suporte ao Aluno
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {supportNeededGrades.map((grade) => {
                                    const teacherPhone = getTeacherPhone(grade.subject);
                                    const media = grade.mediaAnual || 0;
                                    const isLowGrade = media < 7.0 && grade.situacaoFinal !== 'Aprovado';

                                    // CORREÇÃO: Verificação de segurança para bimesters
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
                                                                <span className="mr-2 text-md">🤖</span> Ajuda da IA
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                {statusConfig.message && <p className="text-sm text-gray-500 italic font-medium pt-2">{statusConfig.message}</p>}
                                            </div>

                                            <div className="mt-auto border-t border-gray-100 pt-4">
                                                {statusConfig.showContactButton && teacherPhone && (
                                                    <a
                                                        href={`https://wa.me/${waPhone}?text=Olá, sou o aluno(a) ${student.name}. Estou com dificuldades em ${grade.subject} e gostaria de tirar dúvidas.`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="w-full bg-green-500 text-white hover:bg-green-600 py-2.5 rounded-md text-sm font-bold flex items-center justify-center transition-colors shadow-sm"
                                                    >
                                                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.017-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                                                        Falar com Professor
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* --- RENDERIZAÇÃO CONDICIONAL PARA SUPORTE (EMPTY STATE) --- */}
                    {currentView === 'support' && supportNeededGrades.length === 0 && (
                        <div className="mt-8 p-12 text-center bg-white rounded-lg shadow-sm animate-fade-in-up">
                            <span className="text-4xl">🎉</span>
                            <h3 className="mt-4 text-xl font-bold text-gray-800">Tudo ótimo por aqui!</h3>
                            <p className="text-gray-500 mt-2">Você não possui notas que exigem atenção imediata. Continue assim!</p>
                            <Button variant="secondary" onClick={() => setCurrentView('menu')} className="mt-6">Voltar ao Menu</Button>
                        </div>
                    )}

                    {/* --- ASSINATURAS (Apenas no Boletim) --- */}
                    {currentView === 'grades' && (
                        <div className="hidden print:flex mt-16 pt-8 border-t border-gray-400 justify-between items-end">
                            <div className="text-center w-64">
                                <div className="border-b border-black mb-2"></div>
                                <p className="text-xs uppercase font-bold">Secretaria Escolar</p>
                            </div>
                            <div className="text-center w-64">
                                <div className="border-b border-black mb-2"></div>
                                <p className="text-xs uppercase font-bold">Responsável do Aluno</p>
                            </div>
                        </div>
                    )}

                    {currentView === 'messages' && (
                        <div className="animate-fade-in-up">
                            <MessageBox student={student} onSendMessage={onSendMessage} unitContacts={unitContacts || []} />
                        </div>
                    )}

                    {/* CORREÇÃO: Modal com melhor tratamento de conteúdo */}
                    {isModalOpen && (
                        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 print:hidden p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-fade-in-up">
                                <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-xl">
                                    <div>
                                        <h3 className="text-xl font-extrabold text-gray-800 flex items-center">
                                            <span className="text-2xl mr-2">🤖</span> Tutor Inteligente
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

                </div>
            </div>
        </div>
    );
};