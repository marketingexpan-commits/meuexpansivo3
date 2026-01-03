import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
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

    const [pendingGradesStudents, setPendingGradesStudents] = useState<any[]>([]);
    const [pendingGradesMap, setPendingGradesMap] = useState<Record<string, GradeEntry[]>>({});
    const [teachersMap, setTeachersMap] = useState<Record<string, string>>({}); // ID -> Name
    const [loading, setLoading] = useState(false);

    // --- HELPER ---
    const formatGrade = (val: number | null | undefined) => (val !== null && val !== undefined) ? val.toFixed(1) : '-';

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

            if (selectedShift) {
                studentsQuery = studentsQuery.where('shift', '==', selectedShift);
            }

            if (selectedClass) {
                studentsQuery = studentsQuery.where('schoolClass', '==', selectedClass);
            }

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
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-purple-100 text-purple-700 rounded-xl shrink-0">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 mb-1">Painel de Acompanhamento Pedagógico</h2>
                                <p className="text-gray-600">
                                    Utilize os filtros abaixo para localizar turmas e aprovar notas ou alterações pendentes de professores.
                                    Este ambiente é focado exclusivamente em rotinas pedagógicas.
                                </p>
                            </div>
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
                                    <div className="p-0">
                                        <div className="overflow-x-auto pb-2">
                                            <table className="w-full text-[11px] md:text-xs text-left border-collapse border border-gray-200">
                                                <thead className="bg-gray-50 text-gray-500 border-b border-gray-300">
                                                    <tr>
                                                        <th rowSpan={2} className="px-2 py-2 font-bold uppercase border-r border-gray-300 w-32 sticky left-0 bg-gray-50 z-10 shadow-sm">Disciplina</th>
                                                        {[1, 2, 3, 4].map(num => (
                                                            <th key={num} colSpan={4} className="px-1 py-1 text-center font-bold uppercase border-r border-gray-300">
                                                                {num}º Bim
                                                            </th>
                                                        ))}
                                                        <th rowSpan={2} className="px-1 py-2 text-center font-bold uppercase border-r border-gray-300 w-12 leading-tight">Média<br />Anual</th>
                                                        <th rowSpan={2} className="px-1 py-2 text-center font-bold text-red-700 uppercase border-r border-gray-300 bg-red-50 w-12 leading-tight">Rec.<br />Final</th>
                                                        <th rowSpan={2} className="px-1 py-2 text-center font-bold text-blue-950 uppercase border-r border-gray-300 bg-blue-50 w-12 leading-tight">Média<br />Final</th>
                                                        <th rowSpan={2} className="px-2 py-2 text-center font-bold uppercase w-20">Situação</th>
                                                        <th rowSpan={2} className="px-2 py-2 text-center font-bold uppercase w-20 bg-gray-100">Ação</th>
                                                    </tr>
                                                    <tr className="bg-gray-100 text-[10px]">
                                                        {[1, 2, 3, 4].map(num => (
                                                            <React.Fragment key={num}>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold" title="Nota">N</th>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold" title="Recuperação">R</th>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-bold bg-gray-200" title="Média">M</th>
                                                                <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold" title="Faltas">F</th>
                                                            </React.Fragment>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {grades.map(grade => {
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
        </div>
    );
};
