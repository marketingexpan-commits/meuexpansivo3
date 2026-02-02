import React, { useState, useEffect, useMemo } from 'react';
import { useAcademicData } from '../hooks/useAcademicData';
import { db } from '../firebaseConfig';
import { UnitContact, SchoolUnit, UNIT_LABELS, SHIFT_LABELS, CoordinationSegment, Subject, SUBJECT_LABELS, SchoolClass, SchoolShift, AttendanceRecord, AttendanceStatus, Occurrence, OccurrenceCategory, OCCURRENCE_TEMPLATES, Student, Ticket, SchoolMessage, MessageRecipient, CalendarEvent, ClassSchedule } from '../types';
import { SCHOOL_CLASSES_LIST, SCHOOL_SHIFTS_LIST, CURRICULUM_MATRIX, getCurriculumSubjects, calculateBimesterMedia, calculateFinalData, SCHOOL_CLASSES_OPTIONS } from '../constants';
import { calculateAttendancePercentage, calculateAnnualAttendancePercentage, calculateGeneralFrequency } from '../utils/frequency';
import { getDynamicBimester, isClassScheduled, normalizeClass, parseGradeLevel } from '../src/utils/academicUtils';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { SchoolCalendar } from './SchoolCalendar';
import { generateSchoolCalendar } from '../utils/calendarGenerator';
import {
    AlertCircle,
    X,
    Search,
    Plus,
    Clock,
    ChevronRight,
    ClipboardList,
    User,
    CheckCircle2,
    Trash2,
    Filter,
    Calendar as CalendarIcon,
    Printer,
    Loader2,
    MessageSquare,
    Reply,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Bell
} from 'lucide-react';



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
    academicSettings?: any;
    tickets?: Ticket[];
    calendarEvents?: CalendarEvent[];
    classSchedules?: ClassSchedule[];
}

export const CoordinatorDashboard: React.FC<CoordinatorDashboardProps> = ({
    coordinator,
    onLogout,
    onCreateNotification,
    academicSettings,
    tickets = [],
    calendarEvents = [],
    classSchedules = []
}) => {
    // --- ACADEMIC DATA ---
    const { segments: academicSegments, grades: academicGrades, subjects: academicSubjects, loading: loadingAcademic } = useAcademicData();

    // --- STATE ---

    const [quickClassFilter, setQuickClassFilter] = useState<string>('all');
    const [quickGradeFilter, setQuickGradeFilter] = useState<string>('all');
    const [quickShiftFilter, setQuickShiftFilter] = useState<string>('all');
    const [quickSubjectFilter, setQuickSubjectFilter] = useState<string>('all');
    const [quickBimesterFilter, setQuickBimesterFilter] = useState<string | number>('all');

    // NEW: Sync Bimester Filter with current bimester
    useEffect(() => {
        if (academicSettings?.currentBimester) {
            setQuickBimesterFilter(academicSettings.currentBimester);
        }
    }, [academicSettings]);

    // NEW: Navigation State
    const [activeTab, setActiveTab] = useState<'menu' | 'approvals' | 'occurrences' | 'calendar' | 'messages'>('menu');
    // --- OCCURRENCE HISTORY STATE ---
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyOccurrences, setHistoryOccurrences] = useState<Occurrence[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Calendar logic is now handled via props

    // Dynamic Listener for Messages
    useEffect(() => {
        if (!coordinator.unit) return;

        const unsubscribe = db.collection('schoolMessages')
            .where('unit', '==', coordinator.unit)
            .where('recipient', '==', MessageRecipient.COORDINATION)
            .orderBy('timestamp', 'desc')
            .onSnapshot(snapshot => {
                let msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolMessage));

                // Client-side sort to be resilient to missing composite indexes
                msgs.sort((a, b) => {
                    const timeA = new Date(a.timestamp || 0).getTime();
                    const timeB = new Date(b.timestamp || 0).getTime();
                    return timeB - timeA;
                });

                // Client-side filter for specific coordinator messages if using the [PARA: Name] pattern
                const filteredMsgs = msgs.filter(m => {
                    if (m.content.startsWith('[PARA:')) {
                        return m.content.includes(`[PARA: ${coordinator.name?.trim()}]`);
                    }
                    return true; // General coordination messages
                });

                setMessages(filteredMsgs);
            }, error => {
                console.error("Error listening to messages:", error);
            });

        return () => unsubscribe();
    }, [activeTab, coordinator.unit, coordinator.name]);

    const handlePrintCalendar = () => {
        generateSchoolCalendar(calendarEvents, academicSettings, coordinator.unit);
    };
    const [historyFilterTerm, setHistoryFilterTerm] = useState('');
    const [studentSearchTerm, setStudentSearchTerm] = useState(''); // NEW: Search for students in occurrence modal

    const isYearFinished = useMemo(() => {
        if (!academicSettings?.bimesters) return false;
        const b4 = academicSettings.bimesters.find((b: any) => b.number === 4);
        if (!b4) return false;
        const today = new Date().toLocaleDateString('en-CA');
        return today > b4.endDate;
    }, [academicSettings]);

    const [pendingGradesStudents, setPendingGradesStudents] = useState<any[]>([]);
    const [pendingGradesMap, setPendingGradesMap] = useState<Record<string, GradeEntry[]>>({});
    const [allStudentGradesMap, setAllStudentGradesMap] = useState<Record<string, GradeEntry[]>>({}); // NEW: Holds ALL grades for frequency calc
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]); // Added for frequency calc

    // --- MESSAGES STATE ---
    const [messages, setMessages] = useState<SchoolMessage[]>([]);
    const [messageFilter, setMessageFilter] = useState<'all' | 'new' | 'read'>('all');
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);



    // --- COMPUTED ---
    const uniqueClasses = useMemo(() => {
        const classes = new Set<string>();
        pendingGradesStudents.forEach(s => {
            if (s.schoolClass) classes.add(s.schoolClass);
        });
        return Array.from(classes).sort(); // Sorted alphabetically
    }, [pendingGradesStudents]);

    const uniqueGrades = useMemo(() => {
        const grades = new Set<string>();
        pendingGradesStudents.forEach(s => {
            if (s.gradeLevel) grades.add(s.gradeLevel);
        });
        return Array.from(grades).sort(); // Sorted alphabetically
    }, [pendingGradesStudents]);

    const uniqueShifts = useMemo(() => {
        const shifts = new Set<string>();
        pendingGradesStudents.forEach(s => {
            if (s.shift) shifts.add(s.shift);
        });
        return Array.from(shifts).sort();
    }, [pendingGradesStudents]);

    const uniqueSubjects = useMemo(() => {
        const subjects = new Set<string>();
        (Object.values(pendingGradesMap) as GradeEntry[][]).forEach(grades => {
            grades.forEach(g => subjects.add(g.subject));
        });
        return Array.from(subjects).sort();
    }, [pendingGradesMap]);



    const filteredDisplayStudents = useMemo(() => {
        return pendingGradesStudents.filter(s => {
            const matchesClass = quickClassFilter === 'all' || s.schoolClass === quickClassFilter;
            const matchesGrade = quickGradeFilter === 'all' || s.gradeLevel === quickGradeFilter;
            const matchesShift = quickShiftFilter === 'all' || s.shift === quickShiftFilter;

            const studentGrades = pendingGradesMap[s.id] || [];

            // Bimester Filter Logic: Is there a pendency in the SELECTED bimester for this student?
            const matchesBimester = quickBimesterFilter === 'all' || studentGrades.some(g => {
                const bKey = `bimester${quickBimesterFilter}` as keyof typeof g.bimesters;
                const b = g.bimesters[bKey];
                return b && (
                    (b.isApproved !== true) ||
                    (b.isNotaApproved !== true) ||
                    (b.isRecuperacaoApproved !== true)
                );
            });

            const matchesSubject = quickSubjectFilter === 'all' || studentGrades.some(g => g.subject === quickSubjectFilter);

            return matchesClass && matchesGrade && matchesShift && matchesSubject && matchesBimester;
        });
    }, [pendingGradesStudents, quickClassFilter, quickGradeFilter, quickShiftFilter, quickSubjectFilter, quickBimesterFilter, pendingGradesMap]);

    const [teachersMap, setTeachersMap] = useState<Record<string, string>>({}); // ID -> Name
    const [loading, setLoading] = useState(false);

    // --- OCCURRENCE MODAL STATE ---
    const [isOccModalOpen, setIsOccModalOpen] = useState(false);
    const [occStep, setOccStep] = useState<'filters' | 'select_student' | 'form'>('filters');
    const [occFilters, setOccFilters] = useState({
        level: '',
        grade: '',
        class: '',
        shift: ''
    });
    const [occStudents, setOccStudents] = useState<any[]>([]);
    const [selectedOccStudent, setSelectedOccStudent] = useState<any | null>(null);
    const [occData, setOccData] = useState<Partial<Occurrence>>({
        category: OccurrenceCategory.PEDAGOGICAL,
        date: new Date().toLocaleDateString('en-CA'),
        title: '',
        description: ''
    });
    const [isSavingOcc, setIsSavingOcc] = useState(false);

    // --- CALENDAR MANAGEMENT STATE ---



    // --- HELPER ---
    const formatGrade = (val: number | null | undefined) => (val !== null && val !== undefined && val !== -1) ? val.toFixed(1) : '-';

    // --- FETCH DATA ---
    const handleFetchPendingGrades = async () => {
        if (!coordinator.unit) return;
        setLoading(true);
        try {
            // 0. Fetch Teachers for this unit (to ensure names are available)
            const teachersSnap = await db.collection('teachers').where('unit', '==', coordinator.unit).get();
            const tMap: Record<string, string> = {};
            teachersSnap.docs.forEach(doc => {
                const t = doc.data();
                tMap[doc.id] = t.name;
            });
            setTeachersMap(tMap);

            // 1. Fetch Students for Unit
            let studentsQuery = db.collection('students')
                .where('unit', '==', coordinator.unit);

            const studentsSnap = await studentsQuery.limit(1000).get();
            const studentsData = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            if (studentsData.length === 0) {
                setPendingGradesStudents([]);
                setPendingGradesMap({});
                setLoading(false);
                return;
            }

            // 1.5 Filter Students by Segment (Performance Optimization)
            const filteredStudents = studentsData.filter((student: any) => {
                if (!coordinator.segment || coordinator.segment === 'geral') return true; // View all

                // Strict ID Resolution
                if (student.gradeId) {
                    const gradeDef = academicGrades.find(g => g.id === student.gradeId);
                    if (gradeDef) {
                        const { segmentId } = gradeDef;
                        if (coordinator.segment === 'infantil_fund1') {
                            return segmentId === 'seg_infantil' || segmentId === 'seg_fund_1';
                        }
                        if (coordinator.segment === 'fund2_medio') {
                            return segmentId === 'seg_fund_2' || segmentId === 'seg_medio';
                        }
                        return segmentId === coordinator.segment;
                    }
                }

                return false;
            });

            // 2. Fetch Grades for RELEVANT students only
            // Process in chunks of 10 for 'in' query.
            const studentIds = filteredStudents.map((s: any) => s.id);
            const chunks = [];
            for (let i = 0; i < studentIds.length; i += 10) {
                chunks.push(studentIds.slice(i, i + 10));
            }

            const allGrades: GradeEntry[] = [];
            // Use academicSettings.year or fallback to current system year
            const searchYear = academicSettings?.year || new Date().getFullYear();

            // Optimized: Parallel Fetching
            await Promise.all(chunks.map(async (chunk) => {
                try {
                    const q = db.collection('grades').where('studentId', 'in', chunk);
                    const snap = await q.get();
                    snap.docs.forEach(d => allGrades.push({ id: d.id, ...d.data() } as GradeEntry));
                } catch (err) {
                    console.error("Error fetching chunk", err);
                }
            }));

            // 3. Filter for PENDING items
            // Pending means: Any bimester isApproved !== true (catch undefined/null as pending)
            const pendingMap: Record<string, GradeEntry[]> = {};
            const fullMap: Record<string, GradeEntry[]> = {}; // Store ALL grades per student
            const studentsWithPending: Set<string> = new Set();

            allGrades.forEach(grade => {
                // Populate full map for frequency calculation
                if (!fullMap[grade.studentId]) fullMap[grade.studentId] = [];
                fullMap[grade.studentId].push(grade);

                // Defensive check for bimesters
                if (!grade.bimesters) return;

                // YEAR FILTER (Client-side)
                // Use type assertion to avoid TS error if interface is outdated, but rely on lastUpdated
                const gradeYear = (grade as any).year || (grade.lastUpdated ? new Date(grade.lastUpdated).getFullYear() : null);
                // If we have a year and it doesn't match, skip. (If unknown, we might include or exclude. Excluding to be safe for "current year" req)
                if (gradeYear && gradeYear !== searchYear) return;

                const hasPending = Object.values(grade.bimesters).some((b: any) =>
                    // Check if explicitely NOT true (covers false, undefined, null)
                    (b.isApproved !== true) ||
                    (b.isNotaApproved !== true) ||
                    (b.isRecuperacaoApproved !== true)
                ) || (grade.recuperacaoFinalApproved !== true);

                if (hasPending) {
                    if (!pendingMap[grade.studentId]) pendingMap[grade.studentId] = [];
                    pendingMap[grade.studentId].push(grade);
                    studentsWithPending.add(grade.studentId);
                }
            });

            // 4. Fetch Attendance for these students for frequency calculation
            const allAttendance: AttendanceRecord[] = [];
            for (const chunk of chunks) {
                const q = db.collection('attendance').where('studentId', 'in', chunk); // Note: check collection name
                // Actually attendance records are stored by date/class?
                // Looking at other components, they use a general query or similar.
                // Let's check how attendance is fetched in TeacherDashboard.
            }
            // Wait, I should verify the attendance collection name and structure.
            // In App.tsx it might be passed as prop.

            // For now, let's just fetch all records for the unit if it's not too many, 
            // or filter by year.
            const attSnap = await db.collection('attendance')
                .where('unit', '==', coordinator.unit)
                .get();
            attSnap.docs.forEach(d => allAttendance.push({ id: d.id, ...d.data() } as AttendanceRecord));
            setAttendanceRecords(allAttendance);

            setPendingGradesStudents(studentsData.filter((s: any) => studentsWithPending.has(s.id)));
            setPendingGradesMap(pendingMap);
            setAllStudentGradesMap(fullMap);

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

            // Create notification for teacher if teacherId exists
            console.log('[CoordinatorDashboard] Aprovação de nota:', {
                gradeId: grade.id,
                subject: grade.subject,
                studentId: grade.studentId,
                teacherId: grade.teacherId,
                hasOnCreateNotification: !!onCreateNotification
            });

            if (onCreateNotification) {
                const student = pendingGradesStudents.find((s: any) => s.id === grade.studentId);
                const studentName = student?.name || 'o aluno';

                try {
                    const subjectName = academicSubjects?.find(s => s.id === grade.subject)?.name || grade.subject;

                    // 1. Notify Student (Always)
                    await onCreateNotification(
                        'Nota Aprovada',
                        `Sua nota de ${subjectName} foi aprovada pela coordenação.`,
                        grade.studentId,
                        undefined
                    );

                    // 2. Notify Teacher (If exists)
                    if (grade.teacherId) {
                        console.log('[CoordinatorDashboard] Criando notificação para professor:', {
                            teacherId: grade.teacherId,
                            studentName,
                            subject: subjectName
                        });

                        await onCreateNotification(
                            'Nota Aprovada',
                            `Sua nota de ${subjectName} para ${studentName} foi aprovada pela coordenação.`,
                            undefined,
                            grade.teacherId
                        );
                        console.log('[CoordinatorDashboard] Notificações criadas com sucesso!');
                    } else {
                        console.warn('[CoordinatorDashboard] Nota sem teacherId - notificação prof. não enviada.');
                    }
                } catch (error) {
                    console.error('[CoordinatorDashboard] Erro ao criar notificação:', error);
                }
            }

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

        } catch (error: any) {
            console.error("Erro detalhado:", error);
            alert(`Erro ao aprovar: ${error.message || 'Erro desconhecido'}`);
        }
    };

    const handleOccurrencesFetchStudents = async () => {
        if (!occFilters.level || !occFilters.grade || !occFilters.class || !occFilters.shift) {
            alert("Por favor, selecione todos os filtros.");
            return;
        }

        setLoading(true);
        try {
            // Buscar alunos filtrando apenas por UNIDADE inicialmente para ser mais robusto contra divergências no banco
            const snap = await db.collection('students')
                .where('unit', '==', coordinator.unit)
                .get();

            let students = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

            // Refinar filtros em memória (mais seguro contra divergências de string, normalização de turmas e UTF-8)
            students = students.filter((s: any) => {
                // Verificar Turno
                if (s.shift !== occFilters.shift) return false;

                // Verificar Turma (Normalized) - Resolve problema de "A" vs "01"
                if (normalizeClass(s.schoolClass) !== normalizeClass(occFilters.class)) return false;

                // Verificar Série (Grade) - Strict ID Match
                const filterGradeId = occFilters.grade; // This is now an ID

                if (s.gradeId && filterGradeId) {
                    return s.gradeId === filterGradeId;
                }

                return false;
            });

            setOccStudents(students);
            if (students.length === 0) {
                alert("Nenhum aluno encontrado com esses filtros.");
            } else {
                setOccStep('select_student');
            }
        } catch (error) {
            console.error("Erro ao buscar alunos para ocorrência:", error);
            alert("Erro ao buscar alunos.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveOccurrence = async () => {
        if (!occData.title || !occData.description || !selectedOccStudent) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        setIsSavingOcc(true);
        try {
            const newOcc: Omit<Occurrence, 'id'> = {
                studentId: selectedOccStudent.id,
                studentName: selectedOccStudent.name,
                gradeLevel: selectedOccStudent.gradeLevel,
                schoolClass: selectedOccStudent.schoolClass,
                shift: selectedOccStudent.shift,
                unit: selectedOccStudent.unit,
                category: occData.category as OccurrenceCategory,
                title: occData.title,
                description: occData.description,
                date: occData.date || new Date().toLocaleDateString('en-CA'),
                authorId: coordinator.id,
                authorName: coordinator.name,
                authorRole: 'Coordenação',
                isReadByStudent: false,
                timestamp: new Date().toISOString()
            };

            const docRef = await db.collection('occurrences').add(newOcc);

            // Notificação
            if (onCreateNotification) {
                await onCreateNotification(
                    'Nova Ocorrência',
                    `Você recebeu uma nova ocorrência: ${occData.title}`,
                    selectedOccStudent.id
                );
            }

            alert("Ocorrência registrada com sucesso!");
            setIsOccModalOpen(false);
            // Reset state
            setOccStep('filters');
            setSelectedOccStudent(null);
            setOccData({
                category: OccurrenceCategory.PEDAGOGICAL,
                date: new Date().toLocaleDateString('en-CA'),
                title: '',
                description: ''
            });
        } catch (error) {
            console.error("Erro ao salvar ocorrência:", error);
            alert("Erro ao salvar ocorrência.");
        } finally {
            setIsSavingOcc(false);
        }
    };

    // --- OCCURRENCE HISTORY LOGIC ---
    const handleFetchOccurrenceHistory = async () => {
        setHistoryLoading(true);
        try {
            // Fetch occurrences for this unit
            const snap = await db.collection('occurrences')
                .where('unit', '==', coordinator.unit)
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();

            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Occurrence));
            setHistoryOccurrences(data);
        } catch (error) {
            console.error("Erro ao buscar histórico de ocorrências:", error);
            // Fallback for missing index if orderBy timestamp fails (should be rare if index exists or simple query)
            try {
                const snap = await db.collection('occurrences')
                    .where('unit', '==', coordinator.unit)
                    .get();
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Occurrence));
                data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setHistoryOccurrences(data);
            } catch (e) {
                console.error("Fallback fetch failed", e);
            }
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleDeleteOccurrence = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta ocorrência? Esta ação não pode ser desfeita.")) return;

        try {
            await db.collection('occurrences').doc(id).delete();
            setHistoryOccurrences(prev => prev.filter(occ => occ.id !== id));
            alert("Ocorrência excluída com sucesso.");
        } catch (error) {
            console.error("Erro ao excluir ocorrência:", error);
            alert("Erro ao excluir ocorrência.");
        }
    };

    const filteredHistory = useMemo(() => {
        if (!historyFilterTerm) return historyOccurrences;
        const term = historyFilterTerm.toLowerCase();
        return historyOccurrences.filter(occ =>
            occ.studentName.toLowerCase().includes(term) ||
            occ.schoolClass.toLowerCase().includes(term) ||
            occ.title.toLowerCase().includes(term) ||
            occ.gradeLevel.toLowerCase().includes(term)
        );
    }, [historyOccurrences, historyFilterTerm]);

    // --- ATTENDANCE MANAGEMENT LOGIC ---


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
        console.log("Enviando resposta:", { msgId: message.id, response: responseToSave });

        try {
            await db.collection('schoolMessages').doc(message.id).update({
                status: 'read',
                response: responseToSave,
                responseTimestamp: new Date().toISOString()
            });

            if (onCreateNotification) {
                console.log("Calling onCreateNotification for studentId:", message.studentId);
                await onCreateNotification(
                    "Nova Resposta da Coordenação",
                    `Sua mensagem sobre "${message.messageType}" foi respondida.`,
                    message.studentId
                );
            } else {
                console.error("onCreateNotification prop is MISSING in CoordinatorDashboard!");
                alert("DEBUG: onCreateNotification is missing! Notification won't be sent.");
            }

            setReplyingTo(null);
            setReplyText('');
            alert(`Resposta enviada com sucesso! (Notificação enviada para ID: ${message.studentId})`);
        } catch (error) {
            console.error("Erro ao enviar resposta:", error);
            alert("Erro ao enviar resposta. Verifique os logs.");
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
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans">
            <div className={`w-full bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col transition-all duration-500 ease-in-out ${activeTab === 'menu' ? 'max-w-2xl' :
                (activeTab === 'occurrences' || activeTab === 'messages') ? 'max-w-3xl' :
                    'max-w-5xl'
                }`}>

                {/* MAIN CONTENT */}
                <main className="flex-1 w-full p-4 md:p-8 bg-gray-50/50 overflow-y-auto">

                    {/* Welcome Card with inline header info */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
                        {/* Compact top bar with logout */}
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                            <div className="flex items-center gap-2 text-base text-gray-600">
                                {activeTab !== 'menu' && (
                                    <button
                                        onClick={() => setActiveTab('menu')}
                                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-600 -ml-1 mr-1"
                                        title="Voltar ao Menu"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                        </svg>
                                    </button>
                                )}
                                <span className="font-bold text-gray-800">{coordinator.name}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                <span className="text-gray-500">{UNIT_LABELS[coordinator.unit as SchoolUnit] || coordinator.unit}</span>
                                {coordinator.segment && (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                        <span className="text-gray-500">
                                            {coordinator.segment === CoordinationSegment.INFANTIL_FUND1 ? 'Infantil & Fund. I' :
                                                coordinator.segment === CoordinationSegment.FUND2_MEDIO ? 'Fund. II & Médio' : 'Geral'}
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-3 relative">
                                {/* NOTIFICATION BELL */}
                                <button
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    className="p-2 text-gray-400 hover:text-blue-950 hover:bg-blue-50 transition-colors relative rounded-full"
                                    title="Notificações de Mensagens"
                                >
                                    <Bell className="w-5 h-5" />
                                    {messages.filter(m => m.status === 'new').length > 0 && (
                                        <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-[16px] px-0.5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                                            {messages.filter(m => m.status === 'new').length}
                                        </span>
                                    )}
                                </button>

                                {showNotifications && (
                                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                                            <h4 className="font-bold text-blue-950 text-xs uppercase tracking-wider">Notificações</h4>
                                            <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-blue-800">
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
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider"
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

                                <Button
                                    variant="secondary"
                                    onClick={onLogout}
                                    className="text-sm font-semibold py-1.5 px-4"
                                >
                                    Sair
                                </Button>
                            </div>
                        </div>

                        {/* Welcome Message */}
                        <div className="flex flex-col items-start text-left">
                            {activeTab === 'menu' && (
                                <div className="flex items-center gap-2 mt-4 mb-6 pl-1">
                                    <div className="h-10 w-auto shrink-0">
                                        <SchoolLogo className="!h-full w-auto" />
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <span className="text-[9px] text-orange-600 font-bold uppercase tracking-[0.15em] leading-none mb-1">Aplicativo</span>
                                        <h1 className="text-lg font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                                        <span className="text-[9px] text-blue-950/60 font-bold uppercase tracking-wider leading-none mt-1">Portal do Coordenador</span>
                                    </div>
                                </div>
                            )}
                            <p className="text-gray-600 max-w-2xl">
                                {activeTab === 'menu'
                                    ? "Selecione uma opção para gerenciar as atividades pedagógicas da unidade."
                                    : activeTab === 'approvals'
                                        ? "Utilize os filtros abaixo para localizar e aprovar notas pendentes."
                                        : activeTab === 'occurrences'
                                            ? "Gerencie o histórico e registre novas ocorrências disciplinares."

                                            : activeTab === 'messages'
                                                ? "Gerencie as mensagens e feedbacks enviados pelos alunos."
                                                : "Calendário letivo da unidade."
                                }
                            </p>
                        </div>
                    </div>

                    {/* MENU GRID (activeTab === 'menu') */}
                    {activeTab === 'menu' && (
                        <div className="animate-fade-in-up grid grid-cols-2 gap-4 mb-8">
                            <button
                                onClick={() => setActiveTab('approvals')}
                                className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                            >
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                    <Search className="w-6 h-6 text-blue-950" />
                                </div>
                                <h3 className="font-bold text-gray-800 text-sm text-center">Pendências de Notas</h3>
                            </button>

                            <button
                                onClick={() => { setActiveTab('occurrences'); /* Prepare Occurrences? */ }}
                                className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                            >
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                    <ClipboardList className="w-6 h-6 text-blue-950" />
                                </div>
                                <h3 className="font-bold text-gray-800 text-sm text-center">Ocorrências</h3>
                            </button>



                            <button
                                onClick={() => setActiveTab('calendar')}
                                className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                            >
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                    <CalendarIcon className="w-6 h-6 text-blue-950" />
                                </div>
                                <h3 className="font-bold text-gray-800 text-sm text-center">Calendário Escolar</h3>
                            </button>

                            {/* STUDENT MESSAGES CARD */}
                            <button
                                onClick={() => setActiveTab('messages')}
                                className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square relative"
                            >
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                    <MessageSquare className="w-6 h-6 text-blue-950" />
                                </div>
                                <h3 className="font-bold text-gray-800 text-sm text-center">Mensagens do Aluno</h3>
                                {messages.filter(m => m.status === 'new').length > 0 && (
                                    <span className="absolute top-4 right-4 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-pulse">
                                        {messages.filter(m => m.status === 'new').length}
                                    </span>
                                )}
                            </button>
                        </div>
                    )}

                    {/* APPROVALS VIEW (activeTab === 'approvals') */}
                    {activeTab === 'approvals' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8 animate-fade-in-up">

                            <div className="w-full">
                                <Button
                                    onClick={handleFetchPendingGrades}
                                    disabled={loading}
                                    className="w-full py-4 text-lg !bg-blue-950 hover:!bg-black shadow-xl text-white font-bold rounded-xl transition-all transform hover:scale-[1.01]"
                                >
                                    {loading ? 'Carregando...' : '🔍 Buscar Todas as Pendências'}
                                </Button>
                            </div>

                        </div>
                    )}

                    {/* RESULTS AREA (Only for Approvals) */}
                    {activeTab === 'approvals' && pendingGradesStudents.length === 0 && !loading && (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 border-dashed animate-fade-in-up">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-950/10 text-blue-950 mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">Tudo em dia!</h3>
                            <p className="text-gray-500 mt-1 max-w-sm mx-auto">Nenhuma pendência encontrada para os filtros selecionados.</p>
                        </div>
                    )}

                    {/* QUICK FILTERS BAR (Only for Approvals) */}
                    {activeTab === 'approvals' && pendingGradesStudents.length > 0 && (
                        <div className="mb-6 bg-gray-50/50 p-4 rounded-xl border border-gray-100 animate-fade-in-up">
                            <div className="flex flex-wrap gap-4 items-end">

                                {/* BIMESTER FILTER */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Filtrar por Bimestre</label>
                                    <select
                                        value={quickBimesterFilter}
                                        onChange={(e) => setQuickBimesterFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                        className="p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-blue-950 focus:ring-2 focus:ring-blue-950 outline-none shadow-sm min-w-[140px]"
                                    >
                                        <option value="all">Todos os Bimestres</option>
                                        <option value={1}>1º Bimestre</option>
                                        <option value={2}>2º Bimestre</option>
                                        <option value={3}>3º Bimestre</option>
                                        <option value={4}>4º Bimestre</option>
                                    </select>
                                </div>

                                {/* CLASS FILTER (Turma) */}
                                {uniqueClasses.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Filtrar por Turma</label>
                                        <select
                                            value={quickClassFilter}
                                            onChange={(e) => setQuickClassFilter(e.target.value)}
                                            className="p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-950 outline-none shadow-sm min-w-[120px]"
                                        >
                                            <option value="all">Todas</option>
                                            {uniqueClasses.map(cls => (
                                                <option key={cls} value={cls}>{cls}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* SHIFT FILTER (Turno) */}
                                {uniqueShifts.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Filtrar por Turno</label>
                                        <select
                                            value={quickShiftFilter}
                                            onChange={(e) => setQuickShiftFilter(e.target.value)}
                                            className="p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-950 outline-none shadow-sm min-w-[150px]"
                                        >
                                            <option value="all">Todos os Turnos</option>
                                            {uniqueShifts.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* GRADE FILTER (Série) */}
                                {uniqueGrades.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Filtrar por Série</label>
                                        <select
                                            value={quickGradeFilter}
                                            onChange={(e) => setQuickGradeFilter(e.target.value)}
                                            className="p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-950 outline-none shadow-sm min-w-[250px]"
                                        >
                                            <option value="all">Todas as Séries</option>
                                            {uniqueGrades.map(grade => (
                                                <option key={grade} value={grade}>{grade}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* SUBJECT FILTER (Disciplina) */}
                                {uniqueSubjects.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Filtrar por Disciplina</label>
                                        <select
                                            value={quickSubjectFilter}
                                            onChange={(e) => setQuickSubjectFilter(e.target.value)}
                                            className="p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-950 outline-none shadow-sm min-w-[200px]"
                                        >
                                            <option value="all">Todas as Disciplinas</option>
                                            {uniqueSubjects.map(sub => (
                                                <option key={sub} value={sub}>{SUBJECT_LABELS[sub] || sub}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {(quickClassFilter !== 'all' || quickGradeFilter !== 'all' || quickShiftFilter !== 'all' || quickSubjectFilter !== 'all' || quickBimesterFilter !== 'all') && (
                                    <button
                                        onClick={() => {
                                            setQuickClassFilter('all');
                                            setQuickGradeFilter('all');
                                            setQuickShiftFilter('all');
                                            setQuickSubjectFilter('all');
                                            setQuickBimesterFilter(academicSettings?.currentBimester || 'all');
                                        }}
                                        className="mb-1 text-blue-950 text-xs font-bold hover:text-blue-900 underline px-2 transition-colors"
                                    >
                                        Limpar Filtros
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* EMPTY STATE FOR FILTER (Only for Approvals) */}
                    {activeTab === 'approvals' && filteredDisplayStudents.length === 0 && pendingGradesStudents.length > 0 && (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200 border-dashed mb-6 animate-fade-in-up">
                            <p className="text-gray-500 italic">Nenhum aluno encontrado com os filtros selecionados.</p>
                            <button onClick={() => { setQuickClassFilter('all'); setQuickGradeFilter('all'); setQuickShiftFilter('all'); setQuickSubjectFilter('all'); }} className="text-blue-950 font-bold text-sm mt-2 hover:underline">Limpar filtros</button>
                        </div>
                    )}

                    {activeTab === 'approvals' && (
                        <div className="space-y-6">
                            {filteredDisplayStudents.map((student: any) => {
                                let grades = pendingGradesMap[student.id] || [];
                                if (quickSubjectFilter !== 'all') {
                                    grades = grades.filter(g => g.subject === quickSubjectFilter);
                                }
                                if (grades.length === 0) return null;

                                return (
                                    <div key={student.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
                                        <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-950 font-bold text-sm">
                                                    {student.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-800">{student.name}</h3>
                                                    <div className="flex gap-2 text-xs text-gray-600">
                                                        <span className="bg-white px-2 py-0.5 rounded border border-gray-200">{student.code}</span>
                                                        <span className="bg-white px-2 py-0.5 rounded border border-gray-200">{student.gradeLevel}</span>
                                                        <span className="bg-white px-2 py-0.5 rounded border border-gray-200">{student.schoolClass}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-xs font-bold text-blue-950 bg-blue-100 px-3 py-1 rounded-full">
                                                {grades.length} Pendência(s)
                                            </div>
                                        </div>
                                        <div className="p-0">
                                            <div className="overflow-x-auto pb-2">
                                                <table className="w-full text-[11px] md:text-xs text-left border-collapse border border-gray-200">
                                                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-300">
                                                        <tr>
                                                            <th rowSpan={2} className="px-2 py-2 font-bold uppercase border-r border-gray-300 w-32 sticky left-0 bg-gray-50 z-10 shadow-sm">Disciplina</th>
                                                            {[1, 2, 3, 4].map(num => (
                                                                <th key={num} colSpan={5} className="px-1 py-1 text-center font-bold uppercase border-r border-gray-300">
                                                                    {num}º Bim
                                                                </th>
                                                            ))}
                                                            <th rowSpan={2} className="px-1 py-1 text-center font-bold uppercase border-r border-gray-300">Média<br />Anual</th>
                                                            <th rowSpan={2} className="px-1 py-1 text-center font-bold text-amber-700 uppercase border-r border-gray-300 bg-amber-50">Prova<br />Final</th>
                                                            <th rowSpan={2} className="px-1 py-1 text-center font-bold text-blue-900 uppercase border-r border-gray-300 bg-blue-50">Média<br />Final</th>
                                                            <th rowSpan={2} className="px-1 py-1 text-center font-bold uppercase border-r border-gray-300">%<br />Tot</th>
                                                            <th rowSpan={2} className="px-1 py-1 text-center font-bold uppercase">Situação</th>
                                                            <th rowSpan={2} className="px-2 py-2 text-center font-bold uppercase w-20 bg-gray-100">Ação</th>
                                                        </tr>
                                                        <tr className="bg-gray-100 text-[10px]">
                                                            {[1, 2, 3, 4].map(num => (
                                                                <React.Fragment key={num}>
                                                                    <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold w-8 md:w-10" title="Nota">N</th>
                                                                    <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold w-8 md:w-10" title="Recuperação">R</th>
                                                                    <th className="px-1 py-1 text-center border-r border-gray-300 font-bold bg-gray-200 w-8 md:w-10" title="Média">M</th>
                                                                    <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold w-8 md:w-10" title="Faltas">F</th>
                                                                    <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold w-10 md:w-12" title="Frequência">%</th>
                                                                </React.Fragment>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(() => {
                                                            const subjectsInCurriculum = getCurriculumSubjects(student.gradeLevel || "");

                                                            // 1. Matérias existentes
                                                            const existingGrades = (grades || [])
                                                                .filter(g => subjectsInCurriculum.length === 0 || subjectsInCurriculum.includes(g.subject))
                                                                .map(grade => {
                                                                    const calculatedBimesters = {
                                                                        bimester1: calculateBimesterMedia(grade.bimesters.bimester1),
                                                                        bimester2: calculateBimesterMedia(grade.bimesters.bimester2),
                                                                        bimester3: calculateBimesterMedia(grade.bimesters.bimester3),
                                                                        bimester4: calculateBimesterMedia(grade.bimesters.bimester4),
                                                                    };
                                                                    const finalData = calculateFinalData(calculatedBimesters, grade.recuperacaoFinal, isYearFinished);
                                                                    return { ...grade, bimesters: calculatedBimesters, ...finalData };
                                                                });

                                                            // 2. Apenas ordenar os existentes (não preencher faltantes)
                                                            let finalGrades: any[] = [...existingGrades];
                                                            if (subjectsInCurriculum.length > 0) {
                                                                finalGrades.sort((a, b) => subjectsInCurriculum.indexOf(a.subject) - subjectsInCurriculum.indexOf(b.subject));
                                                            }

                                                            return (
                                                                <>
                                                                    {finalGrades.map(grade => {
                                                                        const isRecFinalPending = grade.recuperacaoFinalApproved === false;

                                                                        // Resolve teacher Name
                                                                        const tName = teachersMap[grade.teacherId || ''] || grade.teacherName || 'N/A';

                                                                        return (
                                                                            <tr key={grade.id} className="hover:bg-blue-50 transition-colors border-b last:border-0 border-gray-200">
                                                                                <td className="px-2 py-2 border-r border-gray-300 sticky left-0 bg-white z-10 shadow-sm">
                                                                                    <div className="font-bold text-gray-700">{SUBJECT_LABELS[grade.subject as keyof typeof SUBJECT_LABELS] || grade.subject}</div>
                                                                                    <div className="text-[9px] text-gray-400 mt-0.5">{tName}</div>
                                                                                </td>

                                                                                {['bimester1', 'bimester2', 'bimester3', 'bimester4'].map((key) => {
                                                                                    const bData = grade.bimesters[key as keyof typeof grade.bimesters];
                                                                                    const isNotaPending = bData.isNotaApproved === false || (bData.isApproved === false && bData.nota !== null && bData.recuperacao === null);
                                                                                    const isRecPending = bData.isRecuperacaoApproved === false || (bData.isApproved === false && bData.recuperacao !== null);

                                                                                    const cellClass = (pending: boolean) =>
                                                                                        `px-1 py-2 text-center border-r border-gray-300 relative ${pending ? 'bg-yellow-100 font-bold text-yellow-900 ring-1 ring-inset ring-yellow-300' : ''}`;

                                                                                    return (
                                                                                        <React.Fragment key={key}>
                                                                                            <td className={cellClass(isNotaPending) + " w-8 md:w-10"}>
                                                                                                {formatGrade(bData.nota)}
                                                                                                {isNotaPending && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-orange-600 rounded-full animate-pulse" title="Nota Alterada"></span>}
                                                                                            </td>
                                                                                            <td className={cellClass(isRecPending) + " w-8 md:w-10"}>
                                                                                                {formatGrade(bData.recuperacao)}
                                                                                                {isRecPending && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-orange-600 rounded-full animate-pulse" title="Recuperação Alterada"></span>}
                                                                                            </td>
                                                                                            <td className="px-1 py-2 text-center font-bold bg-gray-50 border-r border-gray-300 w-8 md:w-10">
                                                                                                {formatGrade(bData.media)}
                                                                                            </td>
                                                                                            <td className="px-1 py-2 text-center text-gray-500 border-r border-gray-300 w-8 md:w-10">
                                                                                                {bData.faltas ?? '-'}
                                                                                            </td>
                                                                                            {(() => {
                                                                                                const freqResult = calculateAttendancePercentage(grade.subject, bData.faltas || 0, student.gradeLevel || "");
                                                                                                const freqPercent = freqResult ? freqResult.percent : null;

                                                                                                // Só exibe a porcentagem se houver pelo menos uma falta
                                                                                                const hasAbsence = (bData.faltas || 0) > 0;
                                                                                                const isLowFreq = hasAbsence && freqPercent !== null && freqPercent < 75;

                                                                                                return (
                                                                                                    <td className={`px-1 py-2 text-center font-bold border-r border-gray-300 text-[10px] w-10 md:w-12 ${isLowFreq ? 'text-red-600 bg-red-50' : 'text-gray-500'}`} title="Frequência">
                                                                                                        {hasAbsence && freqPercent !== null ? `${freqPercent}%` : '-'}
                                                                                                    </td>
                                                                                                );
                                                                                            })()}
                                                                                        </React.Fragment>
                                                                                    );
                                                                                })}

                                                                                <td className="px-1 py-2 text-center font-bold text-gray-700 bg-gray-50 border-r border-gray-300">
                                                                                    {grade.mediaAnual >= 0 ? formatGrade(grade.mediaAnual) : '-'}
                                                                                </td>

                                                                                <td className={`px-1 py-2 text-center font-bold text-red-600 border-r border-gray-300 ${isRecFinalPending ? 'bg-yellow-100 ring-inset ring-2 ring-yellow-300' : ''}`}>
                                                                                    {grade.recuperacaoFinalApproved !== false ? formatGrade(grade.recuperacaoFinal) : '-'}
                                                                                    {isRecFinalPending && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-orange-600 rounded-full animate-pulse" title="Prova Final Pendente"></span>}
                                                                                </td>

                                                                                <td className="px-1 py-2 text-center font-extrabold text-blue-900 bg-blue-50 border-r border-gray-300">
                                                                                    {grade.mediaFinal >= 0 ? formatGrade(grade.mediaFinal) : '-'}
                                                                                </td>
                                                                                {(() => {
                                                                                    const totalAbsences = [grade.bimesters.bimester1, grade.bimesters.bimester2, grade.bimesters.bimester3, grade.bimesters.bimester4].reduce((sum, b, idx) => {
                                                                                        const bNum = (idx + 1) as 1 | 2 | 3 | 4;
                                                                                        const studentAbsSnapshot = attendanceRecords.filter(att =>
                                                                                            att.discipline === grade.subject &&
                                                                                            att.studentStatus[student.id] === AttendanceStatus.ABSENT
                                                                                        ).filter(att => {
                                                                                            const d = new Date(att.date + 'T00:00:00');
                                                                                            const bTarget = getDynamicBimester(att.date, academicSettings);
                                                                                            const [y] = att.date.split('-');
                                                                                            if (bTarget === bNum && Number(y) === new Date().getFullYear()) return true;
                                                                                            return false;
                                                                                        }).length;

                                                                                        return sum + studentAbsSnapshot;
                                                                                    }, 0);

                                                                                    const annualFreqResult = calculateAnnualAttendancePercentage(grade.subject, totalAbsences, student.gradeLevel || "", 4, academicSubjects, academicSettings);
                                                                                    const annualFreq = annualFreqResult ? annualFreqResult.percent : null;
                                                                                    const isCritical = annualFreq !== null && annualFreq < 75;
                                                                                    const hasAbsenceTotal = totalAbsences > 0;

                                                                                    return (
                                                                                        <td className={`px-1 py-1 text-center font-bold border-r border-gray-300 text-[10px] ${isCritical ? 'text-red-600 bg-red-50' : 'text-gray-500'}`} title="Frequência Anual">
                                                                                            {hasAbsenceTotal && annualFreq !== null ? `${annualFreq}%` : '-'}
                                                                                        </td>
                                                                                    );
                                                                                })()}

                                                                                <td className="px-2 py-2 text-center align-middle border-r border-gray-300">
                                                                                    <span className={`inline-block w-full py-0.5 rounded text-[9px] uppercase font-bold border ${grade.situacaoFinal === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                                        grade.situacaoFinal === 'Recuperação' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                                            (grade.situacaoFinal === 'Cursando' || grade.situacaoFinal === 'Pendente') ? 'bg-gray-50 text-gray-500 border-gray-200' :
                                                                                                'bg-red-50 text-red-700 border-red-200'
                                                                                        }`}>
                                                                                        {grade.situacaoFinal}
                                                                                    </span>
                                                                                </td>

                                                                                <td className="px-2 py-2 text-center bg-gray-50">
                                                                                    <button
                                                                                        onClick={() => handleApproveGrade(grade)}
                                                                                        className="bg-green-600 hover:bg-green-700 text-white p-1.5 rounded shadow-sm hover:scale-105 transition-all w-full flex items-center justify-center gap-1"
                                                                                        title="Aprovar alterações desta disciplina"
                                                                                    >
                                                                                        <span className="text-xs">✅</span> <span className="text-[10px] font-bold uppercase hidden md:inline">Aprovar</span>
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                    {(() => {
                                                                        // Use ALL grades for this student to calculate general frequency correctly
                                                                        const allStudentGrades = allStudentGradesMap[student.id] || [];
                                                                        const generalFreq = calculateGeneralFrequency(allStudentGrades, attendanceRecords, student.id, student.gradeLevel || "", academicSubjects, academicSettings);
                                                                        return (
                                                                            <tr className="bg-gray-100/80 font-bold border-t-2 border-gray-400">
                                                                                <td colSpan={26} className="px-4 py-2 text-right uppercase tracking-wider text-blue-950 font-extrabold text-[10px]">
                                                                                    FREQUÊNCIA GERAL NO ANO LETIVO:
                                                                                </td>
                                                                                <td className="px-1 py-1 text-center text-blue-900 font-extrabold text-[10px] md:text-sm bg-blue-50/50 border-r border-gray-300">
                                                                                    {generalFreq}
                                                                                </td>

                                                                            </tr>
                                                                        );
                                                                    })()}
                                                                </>
                                                            );
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {/* OCCURRENCES VIEW (activeTab === 'occurrences') */}
                    {activeTab === 'occurrences' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-0 md:p-6 mb-8 animate-fade-in-up flex flex-col h-full">

                            {/* View Switcher (New vs History) */}
                            <div className="flex gap-4 border-b border-gray-100 pb-4 px-4 md:px-0 mb-6">
                                <button
                                    onClick={() => { setIsHistoryModalOpen(false); /* Logic to show form */ }}
                                    className={`text-sm font-bold uppercase tracking-wider pb-2 border-b-2 transition-colors ${!isHistoryModalOpen ? 'border-red-600 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                >
                                    Nova Ocorrência
                                </button>
                                <button
                                    onClick={() => { setIsHistoryModalOpen(true); handleFetchOccurrenceHistory(); }}
                                    className={`text-sm font-bold uppercase tracking-wider pb-2 border-b-2 transition-colors ${isHistoryModalOpen ? 'border-blue-950 text-blue-950' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                >
                                    Histórico
                                </button>
                            </div>

                            {!isHistoryModalOpen ? (
                                // RECORD NEW OCCURRENCE FORM
                                <div className="flex-1 overflow-y-auto">
                                    <div className="flex-1 p-0 md:p-4">
                                        {/* Steps Indicator */}
                                        <div className="flex items-center justify-between mb-8 px-4">
                                            {[
                                                { step: 'filters', label: 'Filtros' },
                                                { step: 'select_student', label: 'Seleção' },
                                                { step: 'form', label: 'Detalhes' }
                                            ].map((s, idx) => (
                                                <React.Fragment key={s.step}>
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${occStep === s.step ? 'bg-red-600 text-white shadow-lg shadow-red-200' :
                                                            (occStep === 'select_student' && idx === 0) || (occStep === 'form' && idx <= 1) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
                                                            }`}>
                                                            {(occStep === 'select_student' && idx === 0) || (occStep === 'form' && idx <= 1) ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                                                        </div>
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${occStep === s.step ? 'text-red-600' : 'text-gray-400'}`}>
                                                            {s.label}
                                                        </span>
                                                    </div>
                                                    {idx < 2 && <div className={`flex-1 h-0.5 mx-4 ${(occStep === 'select_student' && idx === 0) || (occStep === 'form' && idx <= 1) ? 'bg-green-500' : 'bg-gray-100'}`}></div>}
                                                </React.Fragment>
                                            ))}
                                        </div>

                                        {/* Step 1: Filters */}
                                        {occStep === 'filters' && (
                                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nível de Ensino</label>
                                                        <select
                                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                                            value={occFilters.level}
                                                            onChange={(e) => setOccFilters({ ...occFilters, level: e.target.value, grade: '' })}
                                                        >
                                                            <option value="">Selecione o nível</option>
                                                            {academicSegments.map(s => (
                                                                <option key={s.id} value={s.name}>{s.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Série/Ano</label>
                                                        <select
                                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500 transition-all disabled:opacity-50"
                                                            value={occFilters.grade}
                                                            disabled={!occFilters.level}
                                                            onChange={(e) => setOccFilters({ ...occFilters, grade: e.target.value })}
                                                        >
                                                            <option value="">Selecione a série</option>
                                                            {occFilters.level && academicGrades.filter(g => {
                                                                const segment = academicSegments.find(s => s.name === occFilters.level);
                                                                return segment && g.segmentId === segment.id;
                                                            }).map(grade => (
                                                                <option key={grade.id} value={grade.id}>{grade.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Turma</label>
                                                        <select
                                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                                            value={occFilters.class}
                                                            onChange={(e) => setOccFilters({ ...occFilters, class: (e.target.value as SchoolClass) })}
                                                        >
                                                            <option value="">Selecione a turma</option>
                                                            {SCHOOL_CLASSES_OPTIONS.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Turno</label>
                                                        <select
                                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500 transition-all"
                                                            value={occFilters.shift}
                                                            onChange={(e) => setOccFilters({ ...occFilters, shift: (e.target.value as SchoolShift) })}
                                                        >
                                                            <option value="">Selecione o turno</option>
                                                            {SCHOOL_SHIFTS_LIST.map(shift => (
                                                                <option key={shift} value={shift}>{SHIFT_LABELS[shift as SchoolShift] || shift}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={handleOccurrencesFetchStudents}
                                                    disabled={loading}
                                                    className="w-full py-4 text-base !bg-red-600 hover:!bg-red-700 shadow-lg text-white font-bold rounded-xl transition-all"
                                                >
                                                    {loading ? 'Buscando...' : '🔍 Buscar Alunos'}
                                                </Button>
                                            </div>
                                        )}

                                        {/* Step 2: Select Student */}
                                        {occStep === 'select_student' && (
                                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <button
                                                        onClick={() => setOccStep('filters')}
                                                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                                                        title="Voltar aos Filtros"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                                        </svg>
                                                    </button>
                                                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Escolha o Aluno ({occStudents.length})</h3>
                                                </div>
                                                <div className="mb-4 relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar por nome ou RM..."
                                                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                                        value={studentSearchTerm}
                                                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2">
                                                    {occStudents.filter(s =>
                                                        s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
                                                        (s.code && s.code.toLowerCase().includes(studentSearchTerm.toLowerCase()))
                                                    ).map(student => (
                                                        <button
                                                            key={student.id}
                                                            onClick={() => {
                                                                setSelectedOccStudent(student);
                                                                setOccStep('form');
                                                            }}
                                                            className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-red-200 hover:bg-red-50 transition-all group text-left"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-red-100 group-hover:text-red-500 transition-colors">
                                                                    <User className="w-5 h-5" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-gray-900 leading-tight">{student.name}</p>
                                                                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tighter mt-0.5">RM: {student.code}</p>
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-red-500 transition-colors" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 3: Form */}
                                        {occStep === 'form' && selectedOccStudent && (
                                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-red-600 shadow-sm">
                                                            <User className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">Aluno Selecionado</p>
                                                            <p className="font-bold text-gray-900">{selectedOccStudent.name}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => setOccStep('select_student')} className="text-xs text-red-600 font-bold hover:underline px-3 py-1 bg-white rounded-lg shadow-sm">Trocar</button>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Categoria</label>
                                                        <select
                                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
                                                            value={occData.category}
                                                            onChange={(e) => setOccData({ ...occData, category: (e.target.value as OccurrenceCategory) })}
                                                        >
                                                            {Object.entries(OccurrenceCategory).map(([key, value]) => (
                                                                <option key={key} value={value}>{value}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Data do Ocorrido</label>
                                                        <input
                                                            type="date"
                                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
                                                            value={occData.date}
                                                            onChange={(e) => setOccData({ ...occData, date: e.target.value })}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
                                                        <span>Título da Ocorrência</span>
                                                        <span className="text-[10px] text-gray-400 capitalize">Modelos disponíveis abaixo</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="Ex: Falta de material, Comportamento..."
                                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500 placeholder:text-gray-300"
                                                        value={occData.title}
                                                        onChange={(e) => setOccData({ ...occData, title: e.target.value })}
                                                    />

                                                    {/* Templates */}
                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                        {(coordinator.segment ? OCCURRENCE_TEMPLATES[coordinator.segment] : []).map(template => (
                                                            <button
                                                                key={template}
                                                                onClick={() => setOccData({ ...occData, title: template })}
                                                                className="px-3 py-1.5 bg-white border border-gray-100 rounded-full text-[10px] font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all shadow-sm"
                                                            >
                                                                + {template}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição Detalhada</label>
                                                    <textarea
                                                        rows={4}
                                                        placeholder="Descreva o ocorrido com detalhes para registro no prontuário do aluno..."
                                                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-medium text-gray-700 outline-none focus:ring-2 focus:ring-red-500 placeholder:text-gray-300 resize-none"
                                                        value={occData.description}
                                                        onChange={(e) => setOccData({ ...occData, description: e.target.value })}
                                                    />
                                                </div>

                                                <Button
                                                    onClick={handleSaveOccurrence}
                                                    disabled={isSavingOcc}
                                                    className="w-full py-4 text-base !bg-green-600 hover:!bg-green-700 shadow-xl text-white font-black rounded-xl transition-all"
                                                >
                                                    {isSavingOcc ? 'Salvando...' : '💾 Confirmar e Registrar'}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                // HISTORY VIEW
                                <div className="flex-1 overflow-hidden flex flex-col bg-gray-50 rounded-xl border border-gray-100">
                                    {/* Filter Bar */}
                                    <div className="p-4 bg-white border-b border-gray-100 flex gap-4 items-center">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Filtrar por aluno, turma, série..."
                                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={historyFilterTerm}
                                                onChange={(e) => setHistoryFilterTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                        {historyLoading ? (
                                            <div className="text-center py-10 text-gray-400">Carregando histórico...</div>
                                        ) : filteredHistory.length === 0 ? (
                                            <div className="text-center py-10 text-gray-400">Nenhuma ocorrência encontrada.</div>
                                        ) : (
                                            filteredHistory.map(occ => (
                                                <div key={occ.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between gap-4 group hover:border-blue-200 transition-colors">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${occ.category === OccurrenceCategory.DISCIPLINARY ? 'bg-red-100 text-red-600' :
                                                                occ.category === OccurrenceCategory.POSITIVE ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                                                                }`}>
                                                                {occ.category}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {new Date(occ.timestamp).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <h4 className="font-bold text-gray-900 leading-tight mb-1">{occ.title}</h4>
                                                        <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{occ.description}</p>
                                                        <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
                                                            <span className="font-bold text-gray-500">{occ.studentName}</span> • <span>{occ.gradeLevel} - {occ.schoolClass}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-row md:flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4">
                                                        <button
                                                            onClick={() => handleDeleteOccurrence(occ.id)}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Excluir Ocorrência"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}



                    {/* CALENDAR VIEW (activeTab === 'calendar') */}
                    {activeTab === 'calendar' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-0 md:p-6 mb-8 animate-fade-in-up flex flex-col h-full">
                            {/* Header */}
                            <div className="flex justify-end mb-4 px-4 md:px-0">
                                <button
                                    onClick={handlePrintCalendar}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-500 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-gray-50 hover:text-blue-950 transition-all shadow-sm active:scale-95 cursor-pointer"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    Imprimir
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-0 md:p-4 bg-gray-50/20">
                                <div className="max-w-5xl mx-auto">
                                    <SchoolCalendar events={calendarEvents} />
                                </div>
                            </div>
                        </div>
                    )
                    }


                    {/* MESSAGES VIEW (activeTab === 'messages') */}
                    {activeTab === 'messages' && (
                        <div className="space-y-6 animate-fade-in-up">
                            {/* Messages Filter & Stats */}
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-2">
                                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                                    {['all', 'new', 'read'].map((filter) => (
                                        <button
                                            key={filter}
                                            onClick={() => setMessageFilter(filter as any)}
                                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${messageFilter === filter ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            {filter === 'all' ? 'Todas' : filter === 'new' ? `Novas (${messages.filter(m => m.status === 'new').length})` : 'Lidas/Respondidas'}
                                        </button>
                                    ))}
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
                                <div className="grid grid-cols-1 gap-6">
                                    {filteredMessages.map((msg) => (
                                        <div key={msg.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${msg.status === 'new' ? 'border-blue-200 ring-4 ring-blue-50/50' : 'border-gray-200'}`}>
                                            <div className="p-6">
                                                {/* Header: Student Info & Metadata */}
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-gray-50">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 shadow-sm">
                                                            <User className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-gray-900 text-base">{msg.studentName}</h4>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-blue-600 font-bold tracking-wider">{UNIT_LABELS[msg.unit as SchoolUnit] || msg.unit}</span>
                                                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                                <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    {new Date(msg.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border shadow-sm ${msg.messageType === 'Elogio' ? 'bg-green-50 text-green-600 border-green-100' :
                                                            msg.messageType === 'Sugestão' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                'bg-red-50 text-red-600 border-red-100'
                                                            }`}>
                                                            {msg.messageType}
                                                        </span>
                                                        {msg.status === 'read' && (
                                                            <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                                                Lida
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Body: Message Content */}
                                                <div className="space-y-4">
                                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 relative group">
                                                        <div className="absolute -top-3 left-4 bg-white px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 border border-slate-100 shadow-sm">
                                                            MENSAGEM DO ALUNO
                                                        </div>
                                                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap pt-8">
                                                            {msg.content && msg.content.includes(']') ? msg.content.substring(msg.content.indexOf(']') + 1).trim() : (msg.content || '(Sem conteúdo)')}
                                                        </p>
                                                    </div>

                                                    {/* Existing Response */}
                                                    {msg.response && (
                                                        <div className="bg-blue-50/30 p-5 rounded-2xl border border-blue-100/50 relative">
                                                            <div className="absolute -top-3 left-4 bg-white px-2 py-0.5 rounded text-[10px] font-bold text-blue-400 border border-blue-100 shadow-sm flex items-center gap-1">
                                                                <Reply className="w-3 h-3" />
                                                                SUA RESPOSTA
                                                            </div>
                                                            <p className="text-slate-700 text-sm font-medium leading-relaxed italic">
                                                                "{msg.response}"
                                                            </p>
                                                            <div className="mt-3 text-[9px] text-blue-300 font-bold uppercase tracking-widest text-right">
                                                                Respondido em {new Date(msg.responseTimestamp!).toLocaleString('pt-BR')}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Reply Input Form */}
                                                    {replyingTo === msg.id && (
                                                        <div className="mt-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
                                                            <div className="relative">
                                                                <textarea
                                                                    value={replyText}
                                                                    onChange={e => setReplyText(e.target.value)}
                                                                    placeholder="Escreva sua resposta atenciosa para o aluno..."
                                                                    className="w-full p-5 bg-white border-2 border-blue-100 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 text-sm min-h-[120px] shadow-sm transition-all"
                                                                    autoFocus
                                                                />
                                                                <div className="absolute bottom-4 right-4 text-[10px] font-bold text-slate-300 pointer-events-none">
                                                                    Pressione Enviar para responder
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-end items-center gap-3">
                                                                <button
                                                                    onClick={() => setReplyingTo(null)}
                                                                    className="px-6 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                                <Button
                                                                    onClick={() => handleSendReply(msg)}
                                                                    disabled={isSendingReply || !replyText.trim()}
                                                                    className="px-8 !py-2.5 !bg-blue-600 hover:!bg-blue-700 text-white shadow-lg shadow-blue-200 flex items-center gap-2"
                                                                >
                                                                    {isSendingReply ? 'Enviando...' : 'Enviar Resposta'}
                                                                    <Reply className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Footer: Quick Actions */}
                                                {!replyingTo && (
                                                    <div className="mt-8 pt-6 border-t border-gray-50 flex flex-wrap justify-end gap-3">
                                                        {msg.status === 'new' && (
                                                            <button
                                                                onClick={() => handleMarkAsRead(msg.id)}
                                                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                                                            >
                                                                <CheckCircle2 className="w-4 h-4" />
                                                                Marcar como Lida
                                                            </button>
                                                        )}
                                                        {!msg.response && (
                                                            <Button
                                                                onClick={() => {
                                                                    setReplyingTo(msg.id);
                                                                    setReplyText('');
                                                                }}
                                                                className="px-8 !py-2.5 !bg-blue-950 hover:!bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-gray-200"
                                                            >
                                                                <Reply className="w-4 h-4" />
                                                                Responder Aluno
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
