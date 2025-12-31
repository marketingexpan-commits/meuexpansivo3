import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { UnitContact, SchoolUnit, CoordinationSegment, Subject, SchoolClass, SchoolShift } from '../types';
import { SCHOOL_CLASSES_LIST, SCHOOL_SHIFTS_LIST, SUBJECT_LIST } from '../constants';
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
}

export const CoordinatorDashboard: React.FC<CoordinatorDashboardProps> = ({ coordinator, onLogout }) => {
    // --- STATE ---
    const [selectedClass, setSelectedClass] = useState<SchoolClass | ''>('');
    const [selectedSubject, setSelectedSubject] = useState<Subject | ''>('');
    const [selectedShift, setSelectedShift] = useState<SchoolShift | ''>(SchoolShift.MORNING);

    const [pendingGradesStudents, setPendingGradesStudents] = useState<any[]>([]); // Using any[] for students for simplicity, ideally Student[]
    const [pendingGradesMap, setPendingGradesMap] = useState<Record<string, GradeEntry[]>>({});
    const [loading, setLoading] = useState(false);

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

            let updatedRecFinalApproved = grade.recuperacaoFinalApproved;
            if (updatedRecFinalApproved === false) updatedRecFinalApproved = true;

            await db.collection('grades').doc(grade.id).update({
                bimesters: updatedBimesters,
                recuperacaoFinalApproved: updatedRecFinalApproved
            });

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

            {/* MAIN CONTENT */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">

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
                                {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
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

                <div className="space-y-6">
                    {pendingGradesStudents.map((student: any) => {
                        const grades = pendingGradesMap[student.id] || [];
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
                                <div className="divide-y divide-gray-100">
                                    {grades.map(grade => (
                                        <div key={grade.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col md:flex-row justify-between md:items-center gap-4">
                                            <div>
                                                <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-bold mb-1">{grade.subject}</span>
                                                <div className="text-sm text-gray-500">
                                                    Professor(a): <span className="font-medium text-gray-700">{grade.teacherName || 'N/A'}</span>
                                                </div>

                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'].map((lbl, idx) => {
                                                        const key = `${idx + 1}bi`;
                                                        const b = grade.bimesters[key];
                                                        // Check if this specific bimester has a pending flag
                                                        const isPending = b && (b.isApproved === false || b.isNotaApproved === false || b.isRecuperacaoApproved === false);

                                                        if (!isPending) return null;

                                                        return (
                                                            <span key={key} className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded flex items-center gap-1 border border-orange-200">
                                                                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                                                                {lbl} (Alteração/Nota)
                                                            </span>
                                                        );
                                                    })}
                                                    {grade.recuperacaoFinalApproved === false && (
                                                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded flex items-center gap-1 border border-red-200">
                                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                                            Recuperação Final
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleApproveGrade(grade)}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm text-sm font-bold transition-all flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                Aprovar Alterações
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

            </main>
        </div>
    );
};
