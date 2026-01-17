import React, { useState, useEffect, useMemo } from 'react';
import { useAcademicData } from '../../hooks/useAcademicData';
import { db } from '../../firebaseConfig';
import { UnitContact, SchoolUnit, CoordinationSegment, Subject, SchoolClass, SchoolShift, SchoolMessage, MessageRecipient } from '../types';
import { SCHOOL_CLASSES_LIST, SCHOOL_SHIFTS_LIST } from '../constants';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { CheckCircle, MessageSquare, Reply, Clock, User, Filter, AlertCircle, ChevronDown, ChevronUp, Bell } from 'lucide-react';

// Types for Grade coordination (copied/adapted from AdminDashboard)
interface GradeEntry {
    id: string; // Document ID
    studentId: string;
    subject: Subject;
    bimesters: Record<string, any>;
    recuperacaoFinal: number | null;
    mediaFinal: number | null;
    situacaoFinal: string;
    teacherId?: string;
    teacherName?: string;
    lastUpdated?: string;

    // Approval Flags
    recuperacaoFinalApproved?: boolean; // Default true if undefined (legacy), false means pending
}

interface CoordinatorDashboardProps {
    coordinator: UnitContact;
    onLogout: () => void;
    onCreateNotification?: (title: string, message: string, studentId?: string, teacherId?: string) => Promise<void>;
}

export const CoordinatorDashboard: React.FC<CoordinatorDashboardProps> = ({
    coordinator,
    onLogout,
    onCreateNotification
}) => {
    const { subjects, loading: loadingAcademic } = useAcademicData();
    // --- STATE ---
    const [selectedClass, setSelectedClass] = useState<SchoolClass | ''>('');
    const [selectedSubject, setSelectedSubject] = useState<Subject | ''>('');
    const [selectedShift, setSelectedShift] = useState<SchoolShift | ''>(SchoolShift.MORNING);

    const [pendingGradesStudents, setPendingGradesStudents] = useState<any[]>([]); // Using any[] for students for simplicity, ideally Student[]
    const [pendingGradesMap, setPendingGradesMap] = useState<Record<string, GradeEntry[]>>({});
    const [loading, setLoading] = useState(false);

    // --- MESSAGES STATE ---
    const [activeTab, setActiveTab] = useState<'pending' | 'messages'>('pending');
    const [messages, setMessages] = useState<SchoolMessage[]>([]);
    const [messageFilter, setMessageFilter] = useState<'all' | 'new' | 'read'>('all');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

    // Dynamic Listener for Messages
    useEffect(() => {
        if (activeTab !== 'messages' || !coordinator.unit) return;

        const unsubscribe = db.collection('schoolMessages')
            .where('unit', '==', coordinator.unit)
            .where('recipient', '==', MessageRecipient.COORDINATION)
            .orderBy('timestamp', 'desc')
            .onSnapshot(snapshot => {
                const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolMessage));

                // Client-side filter for specific coordinator messages if using the [PARA: Name] pattern
                const filteredMsgs = msgs.filter(m => {
                    if (m.content.startsWith('[PARA:')) {
                        return m.content.includes(`[PARA: ${coordinator.name}]`);
                    }
                    return true; // General coordination messages
                });

                setMessages(filteredMsgs);
            }, error => {
                console.error("Error listening to messages:", error);
            });

        return () => unsubscribe();
    }, [activeTab, coordinator.unit, coordinator.name]);

    // Initial load? Maybe not needed, we wait for filter selection.

    // --- FETCH DATA ---
    const handleFetchPendingGrades = async () => {
        if (!coordinator.unit) return;
        setLoading(true);
        try {
            // 1. Fetch Students for Unit + Shift + Class (optional)
            // Note: In a real app we might paginate or have a better query index.
            // Here we do client side filtering or basic queries.
            let studentsQuery = db.collection('students')
                .where('unit', '==', coordinator.unit)
                .where('shift', '==', selectedShift);

            if (selectedClass) {
                studentsQuery = studentsQuery.where('schoolClass', '==', selectedClass);
            }

            // Filter segments?
            // If coordinator.segment is 'infantil_fund1', we might filter by gradeLevel.
            // For now, assume the coordinator filters manually by Class which is good enough proxy.

            const studentsSnap = await studentsQuery.limit(200).get();
            const studentsData = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            if (studentsData.length === 0) {
                setPendingGradesStudents([]);
                setPendingGradesMap({});
                setLoading(false);
                return;
            }

            // 2. Fetch Grades for these students
            // Since Firestore 'in' query limit is 10, we batch or fetch via map.
            // Optimization: Iterate students and grab their grades? Or fetch all grades for these students.
            // Given the potential size, let's process in chunks of 10 for 'in' query.

            const studentIds = studentsData.map((s: any) => s.id);
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

            // 3. Filter for PENDING items
            // Pending means: Any bimester isApproved === false, OR final recovery approved === false
            const pendingMap: Record<string, GradeEntry[]> = {};
            const studentsWithPending: Set<string> = new Set();

            allGrades.forEach(grade => {
                if (selectedSubject && grade.subject !== selectedSubject) return;

                const hasPending = Object.values(grade.bimesters).some((b: any) =>
                    b.isApproved === false || b.isNotaApproved === false || b.isRecuperacaoApproved === false
                ) || grade.recuperacaoFinalApproved === false;

                if (hasPending) {
                    if (!pendingMap[grade.studentId]) pendingMap[grade.studentId] = [];
                    pendingMap[grade.studentId].push(grade);
                    studentsWithPending.add(grade.studentId);
                }
            });

            setPendingGradesStudents(studentsData.filter((s: any) => studentsWithPending.has(s.id)));
            setPendingGradesMap(pendingMap);

        } catch (error) {
            console.error("Error fetching data:", error);
            alert("Erro ao buscar dados.");
        } finally {
            setLoading(false);
        }
    };

    const handleApproveGrade = async (grade: GradeEntry) => {
        if (!window.confirm(`Confirma a aprovação das notas de ${grade.subject}?`)) return;

        try {
            const updatedBimesters = { ...grade.bimesters };
            Object.keys(updatedBimesters).forEach((key) => {
                const k = key as keyof typeof updatedBimesters;
                updatedBimesters[k] = { ...updatedBimesters[k] }; // Clone
                if (updatedBimesters[k].isApproved === false) updatedBimesters[k].isApproved = true;
                if (updatedBimesters[k].isNotaApproved === false) updatedBimesters[k].isNotaApproved = true;
                if (updatedBimesters[k].isRecuperacaoApproved === false) updatedBimesters[k].isRecuperacaoApproved = true;
            });

            // Force approval of final recovery if it was pending or undefined
            const updatedRecFinalApproved = true;

            // SANITIZE PAYLOAD: Recursively remove undefined values to prevent Firestore crash
            const sanitizeUndefined = (obj: any): any => {
                return JSON.parse(JSON.stringify(obj));
            };

            const payload = sanitizeUndefined({
                bimesters: updatedBimesters,
                recuperacaoFinalApproved: updatedRecFinalApproved
            });

            await db.collection('grades').doc(grade.id).update(payload);

            // Update UI
            setPendingGradesMap(prev => {
                const studentGrades = prev[grade.studentId] || [];
                const newStudentGrades = studentGrades.filter(g => g.id !== grade.id);

                if (newStudentGrades.length === 0) {
                    setPendingGradesStudents(prevS => prevS.filter(s => s.id !== grade.studentId));
                }
                return { ...prev, [grade.studentId]: newStudentGrades };
            });

            alert("Aprovado com sucesso!");

        } catch (error) {
            console.error(error);
            alert("Erro ao aprovar.");
        }
    };
    const handleMarkAsRead = async (messageId: string) => {
        try {
            await db.collection('schoolMessages').doc(messageId).update({
                status: 'read'
            });
        } catch (error) {
            console.error("Error marking as read:", error);
            alert("Erro ao marcar como lida.");
        }
    };

    const handleSendReply = async (message: SchoolMessage) => {
        const responseToSave = String(replyText).trim();
        if (!responseToSave) {
            alert("Por favor, escreva uma mensagem antes de enviar.");
            return;
        }

        setIsSendingReply(true);
        console.log("Enviando resposta (src notifications):", { msgId: message.id, studentId: message.studentId });

        try {
            await db.collection('schoolMessages').doc(message.id).update({
                status: 'read',
                response: responseToSave,
                responseTimestamp: new Date().toISOString()
            });

            if (onCreateNotification) {
                console.log("Chamando onCreateNotification para:", message.studentId);
                await onCreateNotification(
                    "Nova Resposta da Coordenação",
                    `Sua mensagem sobre "${message.messageType}" foi respondida.`,
                    message.studentId
                );
            } else {
                console.warn("onCreateNotification não está definida no CoordinatorDashboard (src)");
                alert("DEBUG (src): onCreateNotification is missing!");
            }

            setReplyingTo(null);
            setReplyText('');
            alert(`Resposta enviada com sucesso! (ID Destino: ${message.studentId})`);
        } catch (error) {
            console.error("Error sending reply:", error);
            alert("Erro ao enviar resposta.");
        } finally {
            setIsSendingReply(false);
        }
    };

    const filteredMessages = messages.filter(m => {
        if (messageFilter === 'new') return m.status === 'new';
        if (messageFilter === 'read') return m.status === 'read';
        return true;
    });

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* HEADER ROXO */}
            <header className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white shadow-lg p-4 md:p-6 shrink-0 relative overflow-hidden">

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-purple-500 opacity-20 rounded-full blur-3xl pointer-events-none"></div>

                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center relative z-10 gap-4 md:gap-0">
                    <div className="flex items-center gap-4">
                        <SchoolLogo variant="header" />
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight shadow-black drop-shadow-sm flex items-center gap-2">
                                Área Pedagógica
                                <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Coordenação</span>
                            </h1>
                            <div className="flex items-center gap-2 text-purple-200 text-sm font-medium mt-1">
                                <span className="bg-purple-800/50 px-2 py-0.5 rounded border border-purple-700/50">{coordinator.unit}</span>
                                <span className="w-1 h-1 rounded-full bg-purple-400"></span>
                                <span>{coordinator.name}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Segment Badge */}
                        {coordinator.segment && (
                            <div className="hidden md:flex flex-col items-end mr-4">
                                <span className="text-[10px] uppercase text-purple-300 font-bold tracking-wider">Segmento</span>
                                <span className="text-sm font-semibold">
                                    {coordinator.segment === CoordinationSegment.INFANTIL_FUND1 ? 'Infantil & Fund. I' :
                                        coordinator.segment === CoordinationSegment.FUND2_MEDIO ? 'Fund. II & Médio' : 'Geral'}
                                </span>
                            </div>
                        )}

                        {/* NOTIFICATION BELL */}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2 text-purple-200 hover:text-white hover:bg-white/10 transition-all relative rounded-full"
                                title="Notificações de Mensagens"
                            >
                                <Bell className="w-6 h-6" />
                                {messages.filter(m => m.status === 'new').length > 0 && (
                                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full border-2 border-purple-900 shadow-sm">
                                        {messages.filter(m => m.status === 'new').length}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in-95 duration-200 text-left">
                                    <div className="p-3 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
                                        <h4 className="font-bold text-purple-900 text-xs uppercase tracking-wider">Notificações</h4>
                                        <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-purple-800">
                                            <ChevronUp className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {messages.filter(m => m.status === 'new').length > 0 ? (
                                            messages.filter(m => m.status === 'new').map(msg => (
                                                <div
                                                    key={msg.id}
                                                    className="p-3 border-b border-gray-50 hover:bg-blue-50/50 cursor-pointer transition-colors"
                                                    onClick={() => {
                                                        setActiveTab('messages');
                                                        setMessageFilter('new');
                                                        setShowNotifications(false);
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                                                            <User className="w-3 h-3" />
                                                        </div>
                                                        <span className="font-bold text-xs text-gray-700 truncate flex-1">{msg.studentName}</span>
                                                        <span className="text-[9px] text-gray-400 whitespace-nowrap">{new Date(msg.timestamp).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 line-clamp-2 pl-8">
                                                        {msg.content && msg.content.includes(']') ? msg.content.substring(msg.content.indexOf(']') + 1).trim() : (msg.content || '(Sem conteúdo)')}
                                                    </p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center text-gray-400 text-xs italic">
                                                Nenhuma mensagem nova.
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-2 bg-gray-50 border-t border-gray-100 text-center">
                                        <button
                                            className="text-[10px] font-bold text-purple-600 hover:text-purple-800 uppercase tracking-wider"
                                            onClick={() => {
                                                setActiveTab('messages');
                                                setShowNotifications(false);
                                            }}
                                        >
                                            Ver Todas as Mensagens
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Button
                            variant="secondary"
                            onClick={onLogout}
                            className="!bg-white/10 hover:!bg-white/20 !text-white border-none shadow-none text-sm font-semibold backdrop-blur-sm"
                        >
                            Sair
                        </Button>
                    </div>
                </div>
            </header>

            {/* TABS NAVIGATION */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto flex">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'pending' ? 'border-purple-600 text-purple-700 bg-purple-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                        <Clock className="w-4 h-4" />
                        Notas Pendentes
                        {pendingGradesStudents.length > 0 && (
                            <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                {pendingGradesStudents.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('messages')}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'messages' ? 'border-purple-600 text-purple-700 bg-purple-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                        <MessageSquare className="w-4 h-4" />
                        Mensagens do Aluno
                        {messages.filter(m => m.status === 'new').length > 0 && (
                            <span className="ml-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                {messages.filter(m => m.status === 'new').length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">

                {activeTab === 'pending' ? (
                    <>
                        {/* Introduction / Welcome Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 mb-8 flex items-start gap-4">
                            <div className="p-3 bg-purple-100 text-purple-700 rounded-xl shrink-0">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 mb-1">Painel de Acompanhamento Pedagógico</h2>
                                <p className="text-gray-600">
                                    Olá, <strong>{coordinator.name}</strong>. Utilize os filtros abaixo para localizar turmas e aprovar notas ou alterações pendentes de professores.
                                    Este ambiente é focado exclusivamente em rotinas pedagógicas.
                                </p>
                            </div>
                        </div>

                        {/* FILTERS CARD */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Turno</label>
                                    <select
                                        value={selectedShift}
                                        onChange={e => setSelectedShift(e.target.value as SchoolShift)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
                                    >
                                        <option value="">Todos</option>
                                        {SCHOOL_SHIFTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Turma</label>
                                    <select
                                        value={selectedClass}
                                        onChange={e => setSelectedClass(e.target.value as SchoolClass)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
                                    >
                                        <option value="">Todas</option>
                                        {SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Disciplina (Opcional)</label>
                                    <select
                                        value={selectedSubject}
                                        onChange={e => setSelectedSubject(e.target.value as Subject)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
                                    >
                                        <option value="">Todas</option>
                                        {loadingAcademic ? <option>Carregando...</option> : subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <Button
                                        onClick={handleFetchPendingGrades}
                                        disabled={loading}
                                        className="w-full py-3 !bg-purple-700 hover:!bg-purple-800 shadow-lg text-white font-bold"
                                    >
                                        {loading ? 'Carregando...' : '🔍 Buscar Pendências'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                    </>
                ) : (
                    <div className="space-y-6">
                        {/* Messages Filter & Stats */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2">
                            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                                <button
                                    onClick={() => setMessageFilter('all')}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${messageFilter === 'all' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    Todas
                                </button>
                                <button
                                    onClick={() => setMessageFilter('new')}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${messageFilter === 'new' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    Novas ({messages.filter(m => m.status === 'new').length})
                                </button>
                                <button
                                    onClick={() => setMessageFilter('read')}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${messageFilter === 'read' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    Lidas/Respondidas
                                </button>
                            </div>
                        </div>

                        {filteredMessages.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 border-dashed">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 text-slate-300 mb-4">
                                    <MessageSquare className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">Nenhuma mensagem</h3>
                                <p className="text-gray-500 mt-1">Não há mensagens para exibir com este filtro.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {filteredMessages.map((msg) => (
                                    <div key={msg.id} className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 overflow-hidden ${msg.status === 'new' ? 'border-blue-200 ring-1 ring-blue-50' : 'border-gray-200'}`}>
                                        <div className="p-5 flex flex-col md:flex-row gap-5">
                                            {/* Left side: Student Info & Type */}
                                            <div className="md:w-64 shrink-0 flex flex-col gap-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                                        <User className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-800 truncate leading-tight">{msg.studentName}</p>
                                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{msg.unit}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${msg.messageType === 'Elogio' ? 'bg-green-50 text-green-600 border-green-100' :
                                                        msg.messageType === 'Sugestão' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            'bg-red-50 text-red-600 border-red-100'
                                                        }`}>
                                                        {msg.messageType}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(msg.timestamp).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Middle side: Content */}
                                            <div className="flex-1">
                                                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 italic text-gray-700 text-sm leading-relaxed relative">
                                                    <div className="absolute -top-2 -left-2 text-slate-200">
                                                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21C21.017 22.1046 20.1216 23 19.017 23H16.017C14.9124 23 14.017 22.1046 14.017 21ZM14.017 21C14.017 19.8954 13.1216 19 12.017 19H9.01701C7.91244 19 7.01701 19.8954 7.01701 21V23C7.01701 24.1046 7.91244 25 9.01701 25H12.017C13.1216 25 14.017 24.1046 14.017 23V21ZM5.01701 21L5.01701 18C5.01701 16.8954 5.91244 16 7.01701 16H10.017C11.1216 16 12.017 16.8954 12.017 18V21C12.017 22.1046 11.1216 23 10.017 23H7.01701C5.91244 23 5.01701 22.1046 5.01701 21Z" transform="scale(0.5) translate(0, -10)" /></svg>
                                                    </div>
                                                    {msg.content && msg.content.includes(']') ? msg.content.substring(msg.content.indexOf(']') + 1).trim() : (msg.content || '(Sem conteúdo)')}
                                                </div>

                                                {/* Response Display */}
                                                {msg.response && (
                                                    <div className="mt-4 bg-purple-50/50 p-4 rounded-xl border border-purple-100 text-gray-700 text-sm animate-in slide-in-from-top-2">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="w-6 h-6 rounded-lg bg-purple-600 flex items-center justify-center text-white">
                                                                <Reply className="w-3.5 h-3.5" />
                                                            </div>
                                                            <span className="font-bold text-purple-800 text-xs">Sua Resposta:</span>
                                                        </div>
                                                        <p className="font-medium text-slate-600">{msg.response}</p>
                                                        <div className="text-[9px] text-purple-400 font-bold mt-2 uppercase tracking-widest">
                                                            {new Date(msg.responseTimestamp!).toLocaleString('pt-BR')}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Response Input Overlay */}
                                                {replyingTo === msg.id && (
                                                    <div className="mt-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                                        <textarea
                                                            value={replyText}
                                                            onChange={e => setReplyText(e.target.value)}
                                                            placeholder="Digite sua resposta para o aluno..."
                                                            className="w-full p-4 bg-white border-2 border-purple-200 rounded-xl outline-none focus:border-purple-600 text-sm min-h-[100px] shadow-inner"
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => setReplyingTo(null)}
                                                                className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                onClick={() => handleSendReply(msg)}
                                                                disabled={isSendingReply || !replyText.trim()}
                                                                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-lg shadow-purple-600/20 flex items-center gap-2"
                                                            >
                                                                {isSendingReply ? 'Enviando...' : 'Enviar Resposta'}
                                                                <Reply className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right side: Actions */}
                                            <div className="md:w-48 shrink-0 flex md:flex-col justify-end gap-2">
                                                {msg.status === 'new' && (
                                                    <button
                                                        onClick={() => handleMarkAsRead(msg.id)}
                                                        className="flex-1 md:flex-none py-2.5 px-4 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                        Lida
                                                    </button>
                                                )}
                                                {!msg.response && replyingTo !== msg.id && (
                                                    <button
                                                        onClick={() => {
                                                            setReplyingTo(msg.id);
                                                            setReplyText('');
                                                        }}
                                                        className="flex-1 md:flex-none py-2.5 px-4 bg-white hover:bg-purple-50 text-purple-700 border-2 border-purple-100 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        <Reply className="w-4 h-4" />
                                                        Responder
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};
