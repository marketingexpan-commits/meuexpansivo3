import React, { useState, useEffect, useMemo } from 'react';
import { useAcademicData } from '../hooks/useAcademicData';
import { db } from '../firebaseConfig';
import { UnitContact, SchoolUnit, CoordinationSegment, Subject, SchoolClass, SchoolShift, AttendanceRecord, AttendanceStatus, Occurrence, OccurrenceCategory, OCCURRENCE_TEMPLATES, Student, Ticket } from '../types';
import { SCHOOL_CLASSES_LIST, SCHOOL_SHIFTS_LIST, CURRICULUM_MATRIX, getCurriculumSubjects, calculateBimesterMedia, calculateFinalData, SCHOOL_CLASSES_OPTIONS, SCHOOL_SHIFTS } from '../constants';
import { calculateAttendancePercentage, calculateAnnualAttendancePercentage, calculateGeneralFrequency } from '../utils/frequency';
import { getDynamicBimester } from '../src/utils/academicUtils';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { SchoolCalendar } from './SchoolCalendar';
import { generateSchoolCalendar } from '../utils/calendarGenerator';
import { CalendarEvent } from '../types';
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
    Loader2
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
}

export const CoordinatorDashboard: React.FC<CoordinatorDashboardProps> = ({ coordinator, onLogout, onCreateNotification, academicSettings, tickets = [] }) => {
    // --- ACADEMIC DATA ---
    const { segments: academicSegments, grades: academicGrades, subjects: academicSubjects, loading: loadingAcademic } = useAcademicData();

    // --- STATE ---

    const [quickClassFilter, setQuickClassFilter] = useState<string>('all');
    const [quickGradeFilter, setQuickGradeFilter] = useState<string>('all');
    const [quickShiftFilter, setQuickShiftFilter] = useState<string>('all');
    const [quickSubjectFilter, setQuickSubjectFilter] = useState<string>('all');

    // NEW: Navigation State
    const [activeTab, setActiveTab] = useState<'menu' | 'approvals' | 'occurrences' | 'attendance' | 'calendar'>('menu');
    // --- OCCURRENCE HISTORY STATE ---
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyOccurrences, setHistoryOccurrences] = useState<Occurrence[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Calendar State
    const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

    useEffect(() => {
        const fetchCalendarEvents = async () => {
            try {
                const snapshot = await db.collection('calendar_events')
                    .where('units', 'array-contains-any', [coordinator.unit, 'all'])
                    .get();
                setCalendarEvents(snapshot.docs.map(doc => ({ ...doc.data() as CalendarEvent, id: doc.id })));
            } catch (error) {
                console.error("Erro ao buscar eventos do calendário:", error);
            }
        };
        fetchCalendarEvents();
    }, [coordinator.unit]);

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

    // --- ATTENDANCE MANAGEMENT STATE ---
    const [isAttendanceManageModalOpen, setIsAttendanceManageModalOpen] = useState(false);
    const [manageAttendanceStep, setManageAttendanceStep] = useState<'filters' | 'list'>('filters');
    const [manageFilters, setManageFilters] = useState({
        date: new Date().toLocaleDateString('en-CA'),
        grade: '',
        class: 'A',
        shift: 'Matutino',
        subjectId: '',
        lessonCount: 1
    });
    const [manageStudents, setManageStudents] = useState<Student[]>([]);
    const [manageStatuses, setManageStatuses] = useState<Record<string, AttendanceStatus>>({});
    const [manageAbsenceOverrides, setManageAbsenceOverrides] = useState<Record<string, number>>({});
    const [isSavingAttendance, setIsSavingAttendance] = useState(false);
    const [isLoadingManageAttendance, setIsLoadingManageAttendance] = useState(false);
    const [manageTeacherName, setManageTeacherName] = useState('Coordenador (Manual)');

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
            const matchesSubject = quickSubjectFilter === 'all' || studentGrades.some(g => g.subject === quickSubjectFilter);

            return matchesClass && matchesGrade && matchesShift && matchesSubject;
        });
    }, [pendingGradesStudents, quickClassFilter, quickGradeFilter, quickShiftFilter, quickSubjectFilter, pendingGradesMap]);

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

            // 1. Fetch Students for Unit + Shift (conditional) + Class (conditional)
            let studentsQuery = db.collection('students')
                .where('unit', '==', coordinator.unit);

            const studentsSnap = await studentsQuery.limit(200).get();
            const studentsData = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            if (studentsData.length === 0) {
                setPendingGradesStudents([]);
                setPendingGradesMap({});
                setLoading(false);
                return;
            }

            // 2. Fetch Grades for these students
            // Process in chunks of 10 for 'in' query.
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
            const fullMap: Record<string, GradeEntry[]> = {}; // Store ALL grades per student
            const studentsWithPending: Set<string> = new Set();

            allGrades.forEach(grade => {
                // Populate full map for frequency calculation
                if (!fullMap[grade.studentId]) fullMap[grade.studentId] = [];
                fullMap[grade.studentId].push(grade);

                const hasPending = Object.values(grade.bimesters).some((b: any) =>
                    b.isApproved === false || b.isNotaApproved === false || b.isRecuperacaoApproved === false
                ) || grade.recuperacaoFinalApproved === false;

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
                    // 1. Notify Student (Always)
                    await onCreateNotification(
                        'Nota Aprovada',
                        `Sua nota de ${grade.subject} foi aprovada pela coordenação.`,
                        grade.studentId,
                        undefined
                    );

                    // 2. Notify Teacher (If exists)
                    if (grade.teacherId) {
                        console.log('[CoordinatorDashboard] Criando notificação para professor:', {
                            teacherId: grade.teacherId,
                            studentName,
                            subject: grade.subject
                        });

                        await onCreateNotification(
                            'Nota Aprovada',
                            `Sua nota de ${grade.subject} para ${studentName} foi aprovada pela coordenação.`,
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
            // Buscar alunos filtrando apenas por UNIDADE e TURMA inicialmente para evitar problemas de formatação de strings no banco
            const snap = await db.collection('students')
                .where('unit', '==', coordinator.unit)
                .where('schoolClass', '==', occFilters.class)
                .get();

            let students = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Refinar filtros em memória (mais seguro contra divergências de string e UTF-8)
            students = students.filter((s: any) => {
                // Verificar Turno
                if (s.shift !== occFilters.shift) return false;

                // Verificar Série (Grade) - Tenta correspondência exata ou parcial para ser robusto
                // Ex: "3ª Série" deve bater com "3ª Série" ou "3ª Série - Ensino Médio"
                const dbGrade = (s.gradeLevel || '').trim();
                const filterGrade = occFilters.grade.trim();

                return dbGrade === filterGrade || dbGrade.startsWith(filterGrade);
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
    const handleFetchAttendanceForManagement = async () => {
        if (!manageFilters.grade || !manageFilters.class || !manageFilters.shift || !manageFilters.date) {
            alert("Preencha todos os campos obrigatórios.");
            return;
        }

        setIsLoadingManageAttendance(true);
        try {
            // 1. Fetch Students
            const studentsSnap = await db.collection('students')
                .where('unit', '==', coordinator.unit)
                .where('schoolClass', '==', manageFilters.class)
                .get();

            let students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];

            // Filter by shift/grade in memory
            students = students.filter(s => {
                const dbGrade = (s.gradeLevel || '').trim();
                const filterGrade = manageFilters.grade.trim();
                return s.shift === manageFilters.shift && (dbGrade === filterGrade || dbGrade.startsWith(filterGrade));
            });

            if (students.length === 0) {
                alert("Nenhum aluno encontrado.");
                setIsLoadingManageAttendance(false);
                return;
            }

            // 2. Fetch Existing Attendance
            const attendanceSnap = await db.collection('attendance')
                .where('unit', '==', coordinator.unit)
                .where('date', '==', manageFilters.date)
                .where('schoolClass', '==', manageFilters.class)
                .get();

            const existingAttendance = attendanceSnap.docs.map(d => d.data());
            const statusMap: Record<string, AttendanceStatus> = {};
            const overrideMap: Record<string, number> = {};

            students.forEach(s => {
                const record = existingAttendance.find((r: any) => r.studentId === s.id);
                if (record) {
                    statusMap[s.id] = record.status as AttendanceStatus;
                    // If there's an override logic in future, handle here
                } else {
                    statusMap[s.id] = AttendanceStatus.PRESENT; // Default
                }
            });

            setManageStudents(students);
            setManageStatuses(statusMap);
            setManageAttendanceStep('list'); // Switch to list view (step 2)

        } catch (error) {
            console.error(error);
            alert("Erro ao buscar dados de frequência.");
        } finally {
            setIsLoadingManageAttendance(false);
        }
    };

    const handleSaveAttendanceManagement = async () => {
        if (!confirm("Confirma o salvamento da chamada?")) return;
        setIsSavingAttendance(true);
        try {
            const batch = db.batch();

            for (const student of manageStudents) {
                const status = manageStatuses[student.id];

                // Construct ID (assuming unique per student per date/class/subject? or just date/student)
                // If subjectId is present, we might want to include it, but typically attendance IS daily.
                // If subjectId provided, it's specific.
                const docId = `${manageFilters.date}_${student.id}${manageFilters.subjectId ? `_${manageFilters.subjectId}` : ''}`;
                const docRef = db.collection('attendance').doc(docId);

                const data: any = {
                    date: manageFilters.date,
                    studentId: student.id,
                    studentName: student.name,
                    schoolClass: manageFilters.class,
                    gradeLevel: manageFilters.grade,
                    shift: manageFilters.shift,
                    unit: coordinator.unit,
                    status: status,
                    lessonCount: manageFilters.lessonCount,
                    recordedBy: manageTeacherName || coordinator.name,
                    timestamp: new Date().toISOString()
                };

                if (manageFilters.subjectId) {
                    // find subject name
                    const subj = academicSubjects.find(s => s.id === manageFilters.subjectId);
                    data.subject = subj?.name || '';
                    data.subjectId = manageFilters.subjectId;
                }

                batch.set(docRef, data, { merge: true });
            }

            await batch.commit();
            alert("Chamada salva com sucesso!");
            setManageAttendanceStep('filters');
            setManageStudents([]);
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar chamada.");
        } finally {
            setIsSavingAttendance(false);
        }
    };



    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans">
            <div className={`w-full bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col transition-all duration-500 ease-in-out ${activeTab === 'menu' ? 'max-w-2xl' :
                (activeTab === 'occurrences' || activeTab === 'attendance') ? 'max-w-3xl' :
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
                                <span className="text-gray-500">{coordinator.unit}</span>
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
                            <div className="flex items-center gap-3">
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
                                            : activeTab === 'attendance'
                                                ? "Controle e lançamentos manuais de frequência diária."
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
                                onClick={() => setActiveTab('attendance')}
                                className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                            >
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                    <CheckCircle2 className="w-6 h-6 text-blue-950" />
                                </div>
                                <h3 className="font-bold text-gray-800 text-sm text-center">Gestão de Chamadas</h3>
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
                                                <option key={sub} value={sub}>{sub}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {(quickClassFilter !== 'all' || quickGradeFilter !== 'all' || quickShiftFilter !== 'all' || quickSubjectFilter !== 'all') && (
                                    <button
                                        onClick={() => { setQuickClassFilter('all'); setQuickGradeFilter('all'); setQuickShiftFilter('all'); setQuickSubjectFilter('all'); }}
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
                                                                                    <div className="font-bold text-gray-700">{grade.subject}</div>
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
                                                                <option key={grade.id} value={grade.name}>{grade.name}</option>
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
                                                            {SCHOOL_SHIFTS.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
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


                    {/* ATTENDANCE MANAGEMENT VIEW (activeTab === 'attendance') */}
                    {activeTab === 'attendance' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-0 md:p-6 mb-8 animate-fade-in-up flex flex-col h-full">

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-0 md:p-4">
                                {/* Steps */}
                                <div className="flex items-center justify-between mb-8 px-4">
                                    {[
                                        { step: 'filters', label: 'Filtros' },
                                        { step: 'list', label: 'Chamada' }
                                    ].map((s, idx) => (
                                        <React.Fragment key={s.step}>
                                            <div className="flex flex-col items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${manageAttendanceStep === s.step ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' :
                                                    (manageAttendanceStep === 'list' && idx === 0) ? 'bg-emerald-600/30 text-emerald-800' : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                    {(manageAttendanceStep === 'list' && idx === 0) ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${manageAttendanceStep === s.step ? 'text-emerald-700' : 'text-gray-400'}`}>
                                                    {s.label}
                                                </span>
                                            </div>
                                            {idx < 1 && <div className={`flex-1 h-0.5 mx-4 ${(manageAttendanceStep === 'list' && idx === 0) ? 'bg-emerald-500' : 'bg-gray-100'}`}></div>}
                                        </React.Fragment>
                                    ))}
                                </div>

                                {/* Step 1: Filters */}
                                {manageAttendanceStep === 'filters' && (
                                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Data da Chamada</label>
                                                <input
                                                    type="date"
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                    value={manageFilters.date}
                                                    onChange={(e) => setManageFilters({ ...manageFilters, date: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Série/Ano</label>
                                                <select
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                    value={manageFilters.grade}
                                                    onChange={(e) => setManageFilters({ ...manageFilters, grade: e.target.value, subjectId: '' })}
                                                >
                                                    <option value="">Selecione</option>
                                                    {academicGrades.map(g => (
                                                        <option key={g.id} value={g.name}>{g.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Turma</label>
                                                <select
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                    value={manageFilters.class}
                                                    onChange={(e) => setManageFilters({ ...manageFilters, class: (e.target.value as SchoolClass) })}
                                                >
                                                    <option value="">Selecione</option>
                                                    {SCHOOL_CLASSES_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Turno</label>
                                                <select
                                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                    value={manageFilters.shift}
                                                    onChange={(e) => setManageFilters({ ...manageFilters, shift: (e.target.value as SchoolShift) })}
                                                >
                                                    {SCHOOL_SHIFTS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Disciplina (Opcional)</label>
                                            <select
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
                                                value={manageFilters.subjectId}
                                                onChange={(e) => setManageFilters({ ...manageFilters, subjectId: e.target.value })}
                                            >
                                                <option value="">Geral / Apenas Presença Diária</option>
                                                {manageFilters.grade && academicSubjects
                                                    .filter(s => s.gradeId === academicGrades.find(g => g.name === manageFilters.grade)?.id)
                                                    .map(subj => (
                                                        <option key={subj.id} value={subj.id}>{subj.name}</option>
                                                    ))}
                                            </select>
                                            <p className="text-[10px] text-gray-500">* Se não selecionar disciplina, será considerada falta GLOBAL no dia.</p>
                                        </div>

                                        <div className="flex justify-end pt-4">
                                            <Button
                                                onClick={handleFetchAttendanceForManagement}
                                                disabled={!manageFilters.date || !manageFilters.grade || !manageFilters.class || isLoadingManageAttendance}
                                                className="w-full md:w-auto py-3 px-8 text-sm !bg-emerald-600 hover:!bg-emerald-700 shadow-lg text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                            >
                                                {isLoadingManageAttendance ? 'Carregando...' : (
                                                    <>
                                                        <Search className="w-4 h-4" />
                                                        Buscar Lista de Chamada
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: List */}
                                {
                                    manageAttendanceStep === 'list' && (
                                        <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
                                            {/* Info Bar */}
                                            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 mb-4 flex flex-wrap gap-4 items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => { setManageStudents([]); setManageStatuses({}); setManageAbsenceOverrides({}); setManageTeacherName(''); setManageAttendanceStep('filters'); }}
                                                        className="p-1.5 hover:bg-white rounded-full transition-colors text-emerald-700 shadow-sm bg-white"
                                                        title="Voltar aos Filtros"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                                                        </svg>
                                                    </button>
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-white rounded-lg text-emerald-600 shadow-sm">
                                                            <CalendarIcon className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Data Selecionada</p>
                                                            <p className="font-bold text-gray-800">{new Date(manageFilters.date + 'T12:00:00').toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {isLoadingManageAttendance ? (
                                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                                    <span className="text-xs font-medium">Processando dados...</span>
                                                </div>
                                            ) : (
                                                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                                                    {/* TEACHER OVERRIDE (Optional) */}
                                                    <div className="bg-white p-4 rounded-xl border border-gray-200 mb-4">
                                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Professor Responsável (Registro)</label>
                                                        <input
                                                            type="text"
                                                            placeholder={`Ex: ${coordinator.name} (Coordenação)`}
                                                            className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
                                                            value={manageTeacherName}
                                                            onChange={(e) => setManageTeacherName(e.target.value)}
                                                        />
                                                        <p className="text-[10px] text-gray-400 mt-1">* Deixe em branco para usar seu nome automaticamente.</p>
                                                    </div>

                                                    {manageStudents.map(student => {
                                                        const status = manageStatuses[student.id]; // 'present' | 'absent' | undefined
                                                        const isOverride = manageAbsenceOverrides[student.id];

                                                        return (
                                                            <div key={student.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${status === 'absent' ? 'bg-red-50 border-red-200' :
                                                                status === 'present' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'
                                                                }`}>
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${status === 'absent' ? 'bg-red-100 text-red-600' :
                                                                        status === 'present' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                                                                        }`}>
                                                                        {student.name.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <p className={`text-sm font-bold ${status === 'absent' ? 'text-red-700' : 'text-gray-800'}`}>{student.name}</p>
                                                                        <p className="text-[10px] text-gray-400">RM: {student.code}</p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            setManageStatuses(prev => ({ ...prev, [student.id]: 'present' }));
                                                                            // If it was override, keep it or logic? For simplicity, present is just present.
                                                                            setManageAbsenceOverrides(prev => { const n = { ...prev }; delete n[student.id]; return n; });
                                                                        }}
                                                                        className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${status === 'present' ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
                                                                    >
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                        <span className="text-xs font-bold hidden md:inline">Presente</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setManageStatuses(prev => ({ ...prev, [student.id]: 'absent' }));
                                                                        }}
                                                                        className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${status === 'absent' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-600'}`}
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                        <span className="text-xs font-bold hidden md:inline">Falta</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <div className="pt-4 border-t border-gray-100 mt-2">
                                                <div className="flex justify-between items-center mb-4 text-xs font-bold text-gray-500">
                                                    <span>Total: {manageStudents.length}</span>
                                                    <div className="flex gap-3">
                                                        <span className="text-emerald-600">Presentes: {Object.values(manageStatuses).filter(s => s === 'present').length}</span>
                                                        <span className="text-red-600">Faltas: {Object.values(manageStatuses).filter(s => s === 'absent').length}</span>
                                                    </div>
                                                </div>
                                                {isSavingAttendance && (
                                                    <div className="mb-2 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                        <div className="bg-emerald-500 h-full animate-progress-indeterminate"></div>
                                                    </div>
                                                )}
                                                <Button
                                                    onClick={handleSaveAttendanceManagement}
                                                    disabled={isSavingAttendance || manageStudents.length === 0}
                                                    className="w-full py-3.5 text-base !bg-blue-950 hover:!bg-black shadow-xl text-white font-bold rounded-xl transition-all"
                                                >
                                                    {isSavingAttendance ? 'Salvando Registros...' : '💾 Confirmar Chamada'}
                                                </Button>
                                                {!manageFilters.subjectId && (
                                                    <p className="text-[10px] text-center text-gray-400 mt-2">
                                                        * Modo Global: A falta será aplicada para TODAS as aulas do dia (Configuração: {academicSettings?.dailyShiftClasses || 5} aulas).
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                }

                            </div>
                        </div>
                    )}

                    {/* CALENDAR VIEW (activeTab === 'calendar') */}
                    {
                        activeTab === 'calendar' && (
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

                </main >
            </div >
        </div >
    );
};
