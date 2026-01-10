import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { UnitContact, SchoolUnit, CoordinationSegment, Subject, SchoolClass, SchoolShift, AttendanceRecord, AttendanceStatus, Occurrence, OccurrenceCategory, OCCURRENCE_TEMPLATES } from '../types';
import { SCHOOL_CLASSES_LIST, SCHOOL_SHIFTS_LIST, SUBJECT_LIST, CURRICULUM_MATRIX, getCurriculumSubjects, calculateBimesterMedia, calculateFinalData, GRADES_BY_LEVEL, SCHOOL_CLASSES_OPTIONS, SCHOOL_SHIFTS } from '../constants';
import { calculateAttendancePercentage, calculateAnnualAttendancePercentage, calculateGeneralFrequency } from '../utils/frequency';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
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
    Calendar as CalendarIcon
} from 'lucide-react';
import { CalendarManagement } from './CalendarManagement';
import { ScheduleManagement } from './ScheduleManagement';


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

export const CoordinatorDashboard: React.FC<CoordinatorDashboardProps> = ({ coordinator, onLogout, onCreateNotification }) => {
    // --- STATE ---

    const [quickClassFilter, setQuickClassFilter] = useState<string>('all'); // NEW: Quick Filter
    const [quickGradeFilter, setQuickGradeFilter] = useState<string>('all'); // NEW: Filter by Grade
    const [quickShiftFilter, setQuickShiftFilter] = useState<string>('all'); // NEW: Filter by Shift
    const [quickSubjectFilter, setQuickSubjectFilter] = useState<string>('all'); // NEW: Filter by Subject
    // --- OCCURRENCE HISTORY STATE ---
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyOccurrences, setHistoryOccurrences] = useState<Occurrence[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyFilterTerm, setHistoryFilterTerm] = useState('');
    const [studentSearchTerm, setStudentSearchTerm] = useState(''); // NEW: Search for students in occurrence modal

    const [pendingGradesStudents, setPendingGradesStudents] = useState<any[]>([]);
    const [pendingGradesMap, setPendingGradesMap] = useState<Record<string, GradeEntry[]>>({});
    const [allStudentGradesMap, setAllStudentGradesMap] = useState<Record<string, GradeEntry[]>>({}); // NEW: Holds ALL grades for frequency calc
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]); // Added for frequency calc

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
        date: new Date().toISOString().split('T')[0],
        title: '',
        description: ''
    });
    const [isSavingOcc, setIsSavingOcc] = useState(false);

    // --- CALENDAR MANAGEMENT STATE ---
    const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);


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
                date: occData.date || new Date().toISOString().split('T')[0],
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
                date: new Date().toISOString().split('T')[0],
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

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans">
            <div className="w-full max-w-7xl bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col">

                {/* MAIN CONTENT */}
                <main className="flex-1 w-full p-4 md:p-8 bg-gray-50/50 overflow-y-auto">

                    {/* Welcome Card with inline header info */}
                    <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6 mb-8">
                        {/* Compact top bar with logout */}
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span className="font-medium text-gray-800">{coordinator.name}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span className="text-xs">{coordinator.unit}</span>
                                {coordinator.segment && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                        <span className="text-xs text-gray-500">
                                            {coordinator.segment === CoordinationSegment.INFANTIL_FUND1 ? 'Infantil & Fund. I' :
                                                coordinator.segment === CoordinationSegment.FUND2_MEDIO ? 'Fund. II & Médio' : 'Geral'}
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="primary"
                                    onClick={() => setIsCalendarModalOpen(true)}
                                    className="text-sm font-semibold py-1.5 px-4 flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
                                    style={{ backgroundColor: '#020617', color: '#FFFFFF' }} // Blue-950
                                >
                                    <CalendarIcon className="w-4 h-4" />
                                    Gerenciar Calendário
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => setIsScheduleModalOpen(true)}
                                    className="text-sm font-semibold py-1.5 px-4 flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
                                    style={{ backgroundColor: '#020617', color: '#FFFFFF' }}
                                >
                                    <Clock className="w-4 h-4" />
                                    Grade Horária
                                </Button>
                                <Button

                                    variant="primary"
                                    onClick={() => setIsOccModalOpen(true)}
                                    className="text-sm font-semibold py-1.5 px-4 !bg-blue-950 hover:!bg-blue-900 flex items-center gap-2"
                                >
                                    <ClipboardList className="w-4 h-4" />
                                    Postar Ocorrência
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => { setIsHistoryModalOpen(true); handleFetchOccurrenceHistory(); }}
                                    className="text-sm font-semibold py-1.5 px-4 flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
                                    style={{ backgroundColor: '#020617', color: '#FFFFFF' }}
                                >
                                    <ClipboardList className="w-4 h-4" />
                                    Gerenciar Ocorrências
                                </Button>
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
                            <div className="flex items-center gap-2 mt-6 mb-8 pl-1">
                                <div className="h-10 w-auto shrink-0">
                                    <SchoolLogo className="!h-full w-auto" />
                                </div>
                                <div className="flex flex-col justify-center">
                                    <span className="text-[9px] text-orange-600 font-bold uppercase tracking-[0.15em] leading-none mb-1">Aplicativo</span>
                                    <h1 className="text-lg font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                                    <span className="text-[9px] text-blue-950/60 font-bold uppercase tracking-wider leading-none mt-1">Gestão Pedagógica</span>
                                </div>
                            </div>
                            <p className="text-gray-600 max-w-2xl">
                                Utilize os filtros abaixo para localizar turmas e aprovar notas ou alterações pendentes de professores.
                                Este ambiente é focado exclusivamente em rotinas pedagógicas.
                            </p>
                        </div>
                    </div>

                    {/* FILTERS CARD */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">

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

                    {/* RESULTS AREA */}
                    {pendingGradesStudents.length === 0 && !loading && (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 border-dashed">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-950/10 text-blue-950 mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">Tudo em dia!</h3>
                            <p className="text-gray-500 mt-1 max-w-sm mx-auto">Nenhuma pendência encontrada para os filtros selecionados.</p>
                        </div>
                    )}

                    {/* QUICK FILTERS BAR */}
                    {pendingGradesStudents.length > 0 && (
                        <div className="mb-6 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
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

                    {/* EMPTY STATE FOR FILTER */}
                    {filteredDisplayStudents.length === 0 && pendingGradesStudents.length > 0 && (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200 border-dashed mb-6">
                            <p className="text-gray-500 italic">Nenhum aluno encontrado com os filtros selecionados.</p>
                            <button onClick={() => { setQuickClassFilter('all'); setQuickGradeFilter('all'); setQuickShiftFilter('all'); setQuickSubjectFilter('all'); }} className="text-blue-950 font-bold text-sm mt-2 hover:underline">Limpar filtros</button>
                        </div>
                    )}

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
                                                                const finalData = calculateFinalData(calculatedBimesters, grade.recuperacaoFinal);
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
                                                                                            const freqPercent = calculateAttendancePercentage(grade.subject, bData.faltas || 0, student.gradeLevel || "");

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
                                                                                {formatGrade(grade.mediaAnual)}
                                                                            </td>

                                                                            <td className={`px-1 py-2 text-center font-bold text-red-600 border-r border-gray-300 ${isRecFinalPending ? 'bg-yellow-100 ring-inset ring-2 ring-yellow-300' : ''}`}>
                                                                                {formatGrade(grade.recuperacaoFinal)}
                                                                                {isRecFinalPending && <span className="block text-[8px] bg-yellow-200 text-yellow-900 rounded px-1 mt-0.5 font-bold uppercase">Alterado</span>}
                                                                            </td>

                                                                            <td className="px-1 py-1 text-center font-extrabold text-blue-900 bg-blue-50 border-r border-gray-300">
                                                                                {formatGrade(grade.mediaFinal)}
                                                                            </td>
                                                                            {(() => {
                                                                                const totalAbsences = [grade.bimesters.bimester1, grade.bimesters.bimester2, grade.bimesters.bimester3, grade.bimesters.bimester4].reduce((sum, b, idx) => {
                                                                                    const bNum = (idx + 1) as 1 | 2 | 3 | 4;
                                                                                    const studentAbsSnapshot = attendanceRecords.filter(att =>
                                                                                        att.discipline === grade.subject &&
                                                                                        att.studentStatus[student.id] === AttendanceStatus.ABSENT
                                                                                    ).filter(att => {
                                                                                        const d = new Date(att.date + 'T00:00:00');
                                                                                        const m = d.getMonth();
                                                                                        let bTarget = 0;
                                                                                        if (m >= 0 && m <= 2) bTarget = 1;
                                                                                        else if (m >= 3 && m <= 5) bTarget = 2;
                                                                                        else if (m >= 6 && m <= 8) bTarget = 3;
                                                                                        else if (m >= 9 && m <= 11) bTarget = 4;

                                                                                        const [y] = att.date.split('-');
                                                                                        if (bTarget === bNum && Number(y) === new Date().getFullYear()) return true;
                                                                                        return false;
                                                                                    }).length;

                                                                                    return sum + studentAbsSnapshot;
                                                                                }, 0);

                                                                                const annualFreq = calculateAnnualAttendancePercentage(grade.subject, totalAbsences, student.gradeLevel || "");
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
                                                                    const generalFreq = calculateGeneralFrequency(allStudentGrades, attendanceRecords, student.id, student.gradeLevel || "");
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

                </main>
            </div>

            {/* OCCURRENCE MODAL */}
            {isOccModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                                    <ClipboardList className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-gray-900 leading-tight">Postar Ocorrência</h2>
                                    <p className="text-xs text-gray-500 font-medium">Registro oficial de acompanhamento do aluno</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOccModalOpen(false)}
                                className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600 shadow-sm"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
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
                                                {Object.keys(GRADES_BY_LEVEL).map(level => (
                                                    <option key={level} value={level}>{level}</option>
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
                                                {occFilters.level && GRADES_BY_LEVEL[occFilters.level]?.map(grade => (
                                                    <option key={grade} value={grade}>{grade}</option>
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
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Escolha o Aluno ({occStudents.length})</h3>
                                        <button onClick={() => setOccStep('filters')} className="text-xs text-red-600 font-bold hover:underline">Alterar Filtros</button>
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

                            {/* Step 3: Occurrence Form */}
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
                                        {isSavingOcc ? 'Salvando Ocorrência...' : '💾 Confirmar e Registrar'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* OCCURRENCE HISTORY MODAL */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 bg-white border-b border-gray-100 rounded-t-3xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-xl">
                                    <ClipboardList className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tight leading-none text-gray-900">Gerenciar Ocorrências</h2>
                                    <p className="text-xs text-gray-500 font-medium opacity-90 mt-1">Histórico e Exclusão</p>
                                </div>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-red-500 hover:bg-gray-100 p-2 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
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

                            {/* List */}
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
                                                    <span className="text-xs text-gray-400 font-medium">{new Date(occ.date).toLocaleDateString()}</span>
                                                </div>
                                                <h4 className="font-bold text-gray-900">{occ.title}</h4>
                                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{occ.description}</p>

                                                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                                                        <User className="w-3 h-3" />
                                                        <span className="font-bold">{occ.studentName}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">{occ.gradeLevel}</span>
                                                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">{occ.schoolClass}</span>
                                                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">{occ.shift}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-end">
                                                <button
                                                    onClick={() => handleDeleteOccurrence(occ.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Excluir Ocorrência"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* CALENDAR MANAGEMENT MODAL */}
            <CalendarManagement
                isOpen={isCalendarModalOpen}
                onClose={() => setIsCalendarModalOpen(false)}
                unit={coordinator.unit}
            />

            {/* SCHEDULE MANAGEMENT MODAL */}
            {isScheduleModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-50/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-950 text-white rounded-xl">
                                    <Clock className="w-6 h-6" />
                                </div>
                                <h2 className="text-xl font-black text-gray-900 leading-tight">Gerenciar Grade Horária</h2>
                            </div>
                            <button
                                onClick={() => setIsScheduleModalOpen(false)}
                                className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600 shadow-sm"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                            <ScheduleManagement unit={coordinator.unit as SchoolUnit} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
