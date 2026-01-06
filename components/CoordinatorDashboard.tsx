import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { UnitContact, SchoolUnit, CoordinationSegment, Subject, SchoolClass, SchoolShift } from '../types';
import { SCHOOL_CLASSES_LIST, SCHOOL_SHIFTS_LIST, SUBJECT_LIST, CURRICULUM_MATRIX, getCurriculumSubjects, calculateBimesterMedia, calculateFinalData } from '../constants';
import { calculateAttendancePercentage, calculateAnnualAttendancePercentage } from '../utils/frequency';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';

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

    const [pendingGradesStudents, setPendingGradesStudents] = useState<any[]>([]);
    const [pendingGradesMap, setPendingGradesMap] = useState<Record<string, GradeEntry[]>>({});

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
            const studentsWithPending: Set<string> = new Set();

            allGrades.forEach(grade => {


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

            let updatedRecFinalApproved = grade.recuperacaoFinalApproved;
            if (updatedRecFinalApproved === false) updatedRecFinalApproved = true;

            await db.collection('grades').doc(grade.id).update({
                bimesters: updatedBimesters,
                recuperacaoFinalApproved: updatedRecFinalApproved
            });

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

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans">
            <div className="w-full max-w-7xl bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col">

                {/* MAIN CONTENT */}
                <main className="flex-1 w-full p-4 md:p-8 bg-gray-50/50 overflow-y-auto">

                    {/* Welcome Card with inline header info */}
                    <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 mb-8">
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
                            <Button
                                variant="secondary"
                                onClick={onLogout}
                                className="text-sm font-semibold py-1.5 px-4"
                            >
                                Sair
                            </Button>
                        </div>

                        {/* Welcome Message */}
                        <div className="flex flex-col items-start text-left">
                            <div className="flex items-center gap-2 mt-4 mb-6">
                                <div className="h-9 w-auto">
                                    <SchoolLogo className="!h-full w-auto drop-shadow-sm" />
                                </div>
                                <div className="flex flex-col justify-center">
                                    <span className="text-[10px] text-blue-950 font-bold uppercase tracking-widest leading-none mb-0">Aplicativo</span>
                                    <h1 className="text-lg font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                                    <span className="text-[10px] text-blue-950/60 font-semibold uppercase tracking-wider leading-none mt-1.5">Gestão Pedagógica</span>
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
                                className="w-full py-4 text-lg !bg-purple-700 hover:!bg-purple-800 shadow-xl text-white font-bold rounded-xl transition-all transform hover:scale-[1.01]"
                            >
                                {loading ? 'Carregando...' : '🔍 Buscar Todas as Pendências'}
                            </Button>
                        </div>

                    </div>

                    {/* RESULTS AREA */}
                    {pendingGradesStudents.length === 0 && !loading && (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 border-dashed">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-50 text-purple-300 mb-4">
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
                                            className="p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm min-w-[120px]"
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
                                            className="p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm min-w-[150px]"
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
                                            className="p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm min-w-[250px]"
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
                                            className="p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm min-w-[200px]"
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
                                        className="mb-1 text-purple-600 text-xs font-bold hover:text-purple-800 underline px-2 transition-colors"
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
                            <button onClick={() => { setQuickClassFilter('all'); setQuickGradeFilter('all'); setQuickShiftFilter('all'); setQuickSubjectFilter('all'); }} className="text-purple-600 font-bold text-sm mt-2 hover:underline">Limpar filtros</button>
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
                                    <div className="p-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center text-purple-800 font-bold text-sm">
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
                                        <div className="text-xs font-bold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
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
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold" title="Nota">N</th>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold" title="Recuperação">R</th>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-bold bg-gray-200" title="Média">M</th>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold" title="Faltas">F</th>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold" title="Frequência">%</th>
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

                                                        // 2. Preencher faltantes
                                                        let finalGrades: any[] = [...existingGrades];
                                                        if (subjectsInCurriculum.length > 0) {
                                                            subjectsInCurriculum.forEach(subjectName => {
                                                                const exists = existingGrades.some(g => g.subject === subjectName);
                                                                if (!exists) {
                                                                    finalGrades.push({
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
                                                                        situacaoFinal: 'Cursando'
                                                                    });
                                                                }
                                                            });
                                                            finalGrades.sort((a, b) => subjectsInCurriculum.indexOf(a.subject) - subjectsInCurriculum.indexOf(b.subject));
                                                        }

                                                        return finalGrades.map(grade => {
                                                            const isRecFinalPending = grade.recuperacaoFinalApproved === false;

                                                            // Resolve teacher Name
                                                            const tName = teachersMap[grade.teacherId || ''] || grade.teacherName || 'N/A';

                                                            return (
                                                                <tr key={grade.id} className="hover:bg-purple-50 transition-colors border-b last:border-0 border-gray-200">
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
                                                                                <td className={cellClass(isNotaPending)}>
                                                                                    {formatGrade(bData.nota)}
                                                                                    {isNotaPending && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" title="Nota Alterada"></span>}
                                                                                </td>
                                                                                <td className={cellClass(isRecPending)}>
                                                                                    {formatGrade(bData.recuperacao)}
                                                                                    {isRecPending && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" title="Recuperação Alterada"></span>}
                                                                                </td>
                                                                                <td className="px-1 py-2 text-center font-bold bg-gray-50 border-r border-gray-300">
                                                                                    {formatGrade(bData.media)}
                                                                                </td>
                                                                                <td className="px-1 py-2 text-center text-gray-500 border-r border-gray-300">
                                                                                    {bData.faltas ?? '-'}
                                                                                </td>
                                                                                {(() => {
                                                                                    const freqPercent = calculateAttendancePercentage(grade.subject, bData.faltas || 0, student.gradeLevel || "");

                                                                                    // Só exibe a porcentagem se houver pelo menos uma falta
                                                                                    const hasAbsence = (bData.faltas || 0) > 0;
                                                                                    const isLowFreq = hasAbsence && freqPercent !== null && freqPercent < 75;

                                                                                    return (
                                                                                        <td className={`px-1 py-2 text-center font-bold border-r border-gray-300 text-[10px] ${isLowFreq ? 'text-red-600 bg-red-50' : 'text-gray-500'}`} title="Frequência">
                                                                                            {hasAbsence && freqPercent !== null ? `${freqPercent}%` : '-'}
                                                                                        </td>
                                                                                    );
                                                                                })()}
                                                                            </React.Fragment>
                                                                        );
                                                                    })}

                                                                    {/* Final Columns */}
                                                                    <td className="px-1 py-2 text-center font-bold text-gray-700 bg-gray-50 border-r border-gray-300">
                                                                        {formatGrade(grade.mediaAnual)}
                                                                    </td>

                                                                    <td className={`px-1 py-2 text-center font-bold text-red-600 border-r border-gray-300 ${isRecFinalPending ? 'bg-yellow-100 ring-inset ring-2 ring-yellow-300' : ''}`}>
                                                                        {formatGrade(grade.recuperacaoFinal)}
                                                                        {isRecFinalPending && <span className="block text-[8px] bg-yellow-200 text-yellow-900 rounded px-1 mt-0.5 font-bold uppercase">Alterado</span>}
                                                                    </td>

                                                                    <td className="px-1 py-2 text-center font-extrabold text-blue-900 bg-blue-50 border-r border-gray-300">
                                                                        {formatGrade(grade.mediaFinal)}
                                                                    </td>

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
                                                        })
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
            </div >
        </div >
    );
};
