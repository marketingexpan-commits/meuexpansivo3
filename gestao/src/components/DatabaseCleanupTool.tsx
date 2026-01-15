import { useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Button } from './Button';
import { pedagogicalService } from '../services/pedagogicalService';
import { studentService } from '../services/studentService';
import { Loader2, ShieldCheck, Search, X, Trash2, AlertTriangle, Database, Zap, Calendar } from 'lucide-react';
import { getCurrentSchoolYear } from '../utils/academicUtils';
import { getAcademicSettings } from '../services/academicSettings';
import type { GradeEntry, ClassSchedule } from '../types';
import { SchoolUnit } from '../types';
import { useAcademicData } from '../hooks/useAcademicData';

interface Discrepancy {
    studentId: string;
    studentName: string;
    subject: string;
    bimester: number;
    gradeValue: number; // Current value in GradeEntry.faltas
    actualValue: number; // Calculated from attendanceRecords
}

interface GhostGrade {
    id: string;
    studentName: string;
    subject: string;
    reason: string;
}

type Mode = 'SYNC_ABSENCES' | 'GHOST_GRADES' | 'GHOST_SCHEDULES' | 'GLOBAL_RESET';

export const DatabaseCleanupTool = () => {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Mode>('SYNC_ABSENCES');
    const [isOpen, setIsOpen] = useState(false);

    // Scan Results
    const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
    const [selectedDiscrepancies, setSelectedDiscrepancies] = useState<number[]>([]);
    const [ghostGrades, setGhostGrades] = useState<GhostGrade[]>([]);
    const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
    const [ghostSchedules, setGhostSchedules] = useState<ClassSchedule[]>([]);
    const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);

    // Filters & Context
    const { grades: allGradesList } = useAcademicData();
    const [selectedUnit, setSelectedUnit] = useState<string>(SchoolUnit.UNIT_1);
    const [selectedGrade, setSelectedGrade] = useState<string>('');

    // Auth Check
    const userUnitCode = localStorage.getItem('userUnit') || '';
    const isAdminGeral = userUnitCode === 'admin_geral';

    if (!isAdminGeral) return null;

    // --- LOGIC FUNCTIONS ---

    const scanAbsences = async () => {
        setLoading(true);
        setDiscrepancies([]);
        setSelectedDiscrepancies([]);
        try {
            const [allStudents, allGrades, allAttendance, settings] = await Promise.all([
                studentService.getStudents(),
                pedagogicalService.getAllGrades(),
                pedagogicalService.getAllAttendance(),
                getAcademicSettings()
            ]);

            const foundDiscrepancies: Discrepancy[] = [];

            allStudents.forEach(student => {
                const studentGrades = allGrades.filter(g => g.studentId === student.id && g.year === getCurrentSchoolYear());
                studentGrades.forEach(grade => {
                    for (let b = 1; b <= 4; b++) {
                        // 1. Determine Date Range for Bimester
                        let startDate = `${getCurrentSchoolYear()}-01-01`;
                        let endDate = `${getCurrentSchoolYear()}-12-31`;

                        // @ts-ignore
                        const bimConfig = settings?.bimesters?.find((bm: any) => bm.number === b);
                        if (bimConfig) {
                            startDate = bimConfig.startDate;
                            endDate = bimConfig.endDate;
                        }

                        // 2. Filter Attendance Records for this Subject & Period (No studentId filter yet)
                        const subjectAttendance = allAttendance.filter(a =>
                            a.discipline === grade.subject &&
                            a.date >= startDate &&
                            a.date <= endDate
                        );

                        // 3. Calculate Actual Absences for Student
                        let actualAbsences = 0;
                        subjectAttendance.forEach(record => {
                            // Check if student is marked ABSENT in this record
                            // Using string 'Faltou' to match AttendanceStatus.ABSENT if enum not available in scope easily, 
                            // or better, check if key exists and equals value.
                            // Accessing dynamic property types safely
                            if (record.studentStatus && record.studentStatus[student.id] === 'Faltou') {
                                const individualCount = record.studentAbsenceCount?.[student.id];
                                const weight = individualCount !== undefined ? individualCount : (record.lessonCount || 1);
                                actualAbsences += weight;
                            }
                        });

                        const bKey = `bimester${b}` as keyof GradeEntry['bimesters'];
                        const currentAbsence = grade.bimesters[bKey]?.faltas || 0;

                        if (currentAbsence !== actualAbsences) {
                            foundDiscrepancies.push({
                                studentId: student.id,
                                studentName: student.name,
                                subject: grade.subject,
                                bimester: b,
                                gradeValue: currentAbsence,
                                actualValue: actualAbsences
                            });
                        }
                    }
                });
            });

            setDiscrepancies(foundDiscrepancies);
        } catch (error) {
            console.error(error);
            alert("Erro ao analisar faltas.");
        } finally {
            setLoading(false);
        }
    };

    const fixAbsences = async () => {
        if (selectedDiscrepancies.length === 0) {
            alert("Selecione ao menos um registro para sincronizar.");
            return;
        }

        const itemsToFix = selectedDiscrepancies.map(index => discrepancies[index]);
        if (!confirm(`Deseja sincronizar ${itemsToFix.length} registros selecionados?`)) return;

        setLoading(true);
        try {
            for (const d of itemsToFix) {
                const q = query(
                    collection(db, 'grades'),
                    where('studentId', '==', d.studentId),
                    where('subject', '==', d.subject),
                    where('year', '==', getCurrentSchoolYear())
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const docId = snap.docs[0].id;
                    const gradeEntry = snap.docs[0].data() as GradeEntry;
                    const newBimesters = { ...gradeEntry.bimesters };
                    const bKey = `bimester${d.bimester}` as keyof GradeEntry['bimesters'];
                    if (newBimesters[bKey]) {
                        newBimesters[bKey] = { ...newBimesters[bKey], faltas: d.actualValue };
                    }
                    await pedagogicalService.updateGrade(docId, { bimesters: newBimesters });
                }
            }
            alert("Sincronização concluída!");
            setDiscrepancies(prev => prev.filter((_, idx) => !selectedDiscrepancies.includes(idx)));
            setSelectedDiscrepancies([]);
        } catch (error) {
            console.error(error);
            alert("Erro ao sincronizar faltas.");
        } finally { setLoading(false); }
    };

    const scanGhostGrades = async () => {
        setLoading(true);
        setGhostGrades([]);
        try {
            const [allGrades, allStudents] = await Promise.all([
                pedagogicalService.getAllGrades(),
                studentService.getStudents()
            ]);

            const ghosts: GhostGrade[] = [];
            allGrades.forEach(g => {
                const studentExists = allStudents.some(s => s.id === g.studentId);
                const hasNoTeacher = !g.teacherId;

                if (!studentExists) {
                    ghosts.push({ id: g.id, studentName: 'Aluno Excluído', subject: g.subject, reason: 'Aluno não existe' });
                } else if (hasNoTeacher) {
                    const student = allStudents.find(s => s.id === g.studentId);
                    ghosts.push({ id: g.id, studentName: student?.name || '?', subject: g.subject, reason: 'Sem Professor (Importado)' });
                }
            });

            setGhostGrades(ghosts);
            setSelectedGrades([]);
        } catch (error) {
            console.error(error);
            alert("Erro ao buscar notas fantasmas.");
        } finally {
            setLoading(false);
        }
    };

    const deleteGhosts = async () => {
        if (selectedGrades.length === 0) {
            alert("Selecione ao menos uma nota para apagar.");
            return;
        }
        if (!confirm(`Deseja apagar permanentemente ${selectedGrades.length} registros de notas fantasmas selecionados?`)) return;
        setLoading(true);
        try {
            await pedagogicalService.deleteGradesBatch(selectedGrades);
            alert("Limpeza concluída!");
            setGhostGrades(prev => prev.filter(g => !selectedGrades.includes(g.id)));
            setSelectedGrades([]);
        } catch (error) {
            console.error(error);
            alert("Erro ao apagar notas.");
        } finally { setLoading(false); }
    };

    const scanGhostSchedules = async () => {
        setLoading(true);
        setGhostSchedules([]);
        try {
            const allSchedules = await pedagogicalService.getAllSchedules();
            const filtered = allSchedules.filter(s =>
                s.schoolId === selectedUnit &&
                (selectedGrade === '' || s.grade === selectedGrade)
            );
            setGhostSchedules(filtered);
            setSelectedSchedules([]);
        } catch (error) {
            console.error(error);
            alert("Erro ao buscar grades.");
        } finally {
            setLoading(false);
        }
    };

    const deleteGhostSchedules = async () => {
        if (selectedSchedules.length === 0) {
            alert("Selecione ao menos um registro para apagar.");
            return;
        }
        if (!confirm(`Deseja apagar permanentemente ${selectedSchedules.length} registros de grade horária selecionados?`)) return;
        setLoading(true);
        try {
            await pedagogicalService.deleteSchedulesBatch(selectedSchedules);
            alert("Limpeza de grades concluída!");
            setGhostSchedules(prev => prev.filter(s => !selectedSchedules.includes(s.id || '')));
            setSelectedSchedules([]);
        } catch (error) {
            console.error(error);
            alert("Erro ao apagar grades.");
        } finally { setLoading(false); }
    };

    const runGlobalReset = async () => {
        const input = prompt("ATENÇÃO: Isso apagará TODAS as notas e faltas do boletim de TODOS os alunos para o ano atual. Esta ação é irreversível.\n\nPara confirmar, digite 'APAGAR TUDO':");
        if (input !== 'APAGAR TUDO') return;

        setLoading(true);
        try {
            const allGrades = await pedagogicalService.getAllGrades();
            const ids = allGrades.map(g => g.id).filter((id): id is string => !!id);
            await pedagogicalService.deleteGradesBatch(ids);
            alert("Banco de dados de boletins resetado com sucesso!");
            setIsOpen(false);
        } catch (error) {
            console.error(error);
            alert("Erro ao executar reset global.");
        } finally {
            setLoading(false);
        }
    };

    // --- UI RENDERING ---

    if (!isOpen) {
        return (
            <div className="mt-8 p-6 bg-blue-900 text-white border border-blue-950 rounded-2xl shadow-2xl transition-all hover:scale-[1.01] hover:shadow-xl group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform">
                    <Database className="w-24 h-24" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                    <div className="max-w-md">
                        <h3 className="text-xl font-black flex items-center gap-3 tracking-tight">
                            <Zap className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                            CENTRAL DE LIMPEZA GLOBAL
                        </h3>
                        <p className="text-blue-100 text-sm mt-1 font-medium opacity-80">
                            Ferramentas avançadas para correção de notas fantasmas, sincronização de faltas e reset de banco de dados.
                        </p>
                    </div>
                    <Button onClick={() => setIsOpen(true)} className="bg-white text-blue-950 hover:bg-blue-50 font-bold px-6 py-2.5 rounded-xl shadow-sm">
                        Gerenciar Banco
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-950 text-white rounded-2xl flex items-center justify-center shadow-lg transform -rotate-1">
                            <Database className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Advanced Database Cleanup</h2>
                            <p className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Ações Destrutivas - Use com Cautela
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-3 hover:bg-slate-200/50 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex gap-2 overflow-x-auto shrink-0 no-scrollbar">
                    {[
                        { id: 'SYNC_ABSENCES', label: 'Sincronizar Faltas', icon: ShieldCheck },
                        { id: 'GHOST_GRADES', label: 'Notas Fantasmas', icon: Search },
                        { id: 'GHOST_SCHEDULES', label: 'Grades Fantasmas', icon: Calendar },
                        { id: 'GLOBAL_RESET', label: 'RESET TOTAL', icon: Trash2 },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Mode)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-black rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-blue-950 text-white shadow-md shadow-blue-900/20'
                                : 'text-slate-500 hover:bg-slate-200/50'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto grow bg-slate-50/30">
                    {activeTab === 'SYNC_ABSENCES' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                                <h4 className="font-bold text-slate-800 mb-2">Sincronizador de Faltas (Ghost Absences)</h4>
                                <p className="text-sm text-slate-500 mb-6 font-medium">Compara as faltas salvas no boletim com os registros reais na coleção 'attendance'. Corrige discrepâncias causadas por edições manuais ou erros de importação.</p>

                                {discrepancies.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Button onClick={scanAbsences} disabled={loading} className="bg-blue-950 px-8">
                                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2 w-4 h-4" />}
                                            Escanear Inconsistências
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-4 flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-600 font-bold">{discrepancies.length} registros com erro</span>
                                            <Button onClick={() => setDiscrepancies([])} variant="ghost" className="text-xs">Limpar Preview</Button>
                                        </div>
                                        <div className="border rounded-xl overflow-hidden bg-white max-h-64 overflow-y-auto mb-6">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 sticky top-0">
                                                    <tr>
                                                        <th className="p-3 w-10">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedDiscrepancies.length === discrepancies.length && discrepancies.length > 0}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedDiscrepancies(discrepancies.map((_, i) => i));
                                                                    else setSelectedDiscrepancies([]);
                                                                }}
                                                                className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                                                            />
                                                        </th>
                                                        <th className="p-3">Aluno</th>
                                                        <th className="p-3">Disciplina</th>
                                                        <th className="p-3 text-center">Bim.</th>
                                                        <th className="p-3 text-center">Boletim</th>
                                                        <th className="p-3 text-center">Real</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {discrepancies.map((d, i) => (
                                                        <tr key={i} className={selectedDiscrepancies.includes(i) ? 'bg-blue-50/30' : ''}>
                                                            <td className="p-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedDiscrepancies.includes(i)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) setSelectedDiscrepancies(prev => [...prev, i]);
                                                                        else setSelectedDiscrepancies(prev => prev.filter(idx => idx !== i));
                                                                    }}
                                                                    className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                                                                />
                                                            </td>
                                                            <td className="p-3 font-medium">{d.studentName}</td>
                                                            <td className="p-3">{d.subject}</td>
                                                            <td className="p-3 text-center">{d.bimester}º</td>
                                                            <td className="p-3 text-center text-red-500 font-bold">{d.gradeValue}</td>
                                                            <td className="p-3 text-center text-green-600 font-bold">{d.actualValue}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <Button
                                            onClick={fixAbsences}
                                            disabled={loading || selectedDiscrepancies.length === 0}
                                            className={`w-full py-6 text-lg font-black ${selectedDiscrepancies.length > 0 ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20' : 'bg-slate-300 cursor-not-allowed shadow-none'}`}
                                        >
                                            {loading ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck className="mr-2" />}
                                            Sincronizar {selectedDiscrepancies.length} Registros Selecionados
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'GHOST_GRADES' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                                <h4 className="font-bold text-slate-800 mb-2">Exclusão de Notas Fantasmas</h4>
                                <p className="text-sm text-slate-500 mb-6 font-medium">Localiza registros de notas na coleção 'grades' que pertencem a alunos excluídos ou que foram criadas via importação (sem ID de professor).</p>

                                {ghostGrades.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Button onClick={scanGhostGrades} disabled={loading} className="bg-blue-950 px-8">
                                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2 w-4 h-4" />}
                                            Buscar Notas Fantasmas
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-4 flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-600 font-bold">{ghostGrades.length} notas orfãs encontradas</span>
                                            <Button onClick={() => setGhostGrades([])} variant="ghost" className="text-xs">Limpar</Button>
                                        </div>
                                        <div className="border rounded-xl overflow-hidden bg-white max-h-64 overflow-y-auto mb-6">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 sticky top-0">
                                                    <tr>
                                                        <th className="p-3 w-10">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedGrades.length === ghostGrades.length && ghostGrades.length > 0}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedGrades(ghostGrades.map(g => g.id));
                                                                    else setSelectedGrades([]);
                                                                }}
                                                                className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                                                            />
                                                        </th>
                                                        <th className="p-3">Aluno</th>
                                                        <th className="p-3">Disciplina</th>
                                                        <th className="p-3">Motivo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {ghostGrades.map((g) => (
                                                        <tr key={g.id} className={selectedGrades.includes(g.id) ? 'bg-blue-50/30' : ''}>
                                                            <td className="p-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedGrades.includes(g.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) setSelectedGrades(prev => [...prev, g.id]);
                                                                        else setSelectedGrades(prev => prev.filter(id => id !== g.id));
                                                                    }}
                                                                    className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                                                                />
                                                            </td>
                                                            <td className="p-3 font-medium">{g.studentName}</td>
                                                            <td className="p-3">{g.subject}</td>
                                                            <td className="p-3">
                                                                <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">
                                                                    {g.reason}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <Button
                                            onClick={deleteGhosts}
                                            disabled={loading || selectedGrades.length === 0}
                                            className={`w-full py-6 text-lg font-black ${selectedGrades.length > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-300 cursor-not-allowed'}`}
                                        >
                                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Trash2 className="mr-2" />}
                                            Apagar {selectedGrades.length} Notas Selecionadas
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'GHOST_SCHEDULES' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                                <h4 className="font-bold text-slate-800 mb-2">Exclusão de Grades Horárias Fantasmas</h4>
                                <p className="text-sm text-slate-500 mb-6 font-medium">Remove registros de grade horária para uma unidade e série específica. Útil para limpar dados corrompidos que geram cálculos de C.H. Min. errados.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Unidade</label>
                                        <select
                                            value={selectedUnit}
                                            onChange={(e) => setSelectedUnit(e.target.value)}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-950/10"
                                        >
                                            {Object.entries(SchoolUnit).map(([key, value]) => (
                                                <option key={key} value={value}>{value}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Série (Opcional)</label>
                                        <select
                                            value={selectedGrade}
                                            onChange={(e) => setSelectedGrade(e.target.value)}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-950/10"
                                        >
                                            <option value="">Todas as Séries</option>
                                            {allGradesList.map(g => (
                                                <option key={g.id} value={g.name}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {ghostSchedules.length === 0 ? (
                                    <div className="text-center py-6">
                                        <Button onClick={scanGhostSchedules} disabled={loading} className="bg-blue-950 px-8">
                                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2 w-4 h-4" />}
                                            Buscar Grades
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-4 flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-600 font-bold">{ghostSchedules.length} registros de grade encontrados</span>
                                            <Button onClick={() => setGhostSchedules([])} variant="ghost" className="text-xs">Limpar</Button>
                                        </div>
                                        <div className="border rounded-xl overflow-hidden bg-white max-h-64 overflow-y-auto mb-6">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 sticky top-0">
                                                    <tr>
                                                        <th className="p-3 w-10">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedSchedules.length === ghostSchedules.length && ghostSchedules.length > 0}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedSchedules(ghostSchedules.map(s => s.id || '').filter(id => id !== ''));
                                                                    else setSelectedSchedules([]);
                                                                }}
                                                                className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                                                            />
                                                        </th>
                                                        <th className="p-3 font-black text-slate-600 uppercase tracking-tighter">Série</th>
                                                        <th className="p-3 font-black text-slate-600 uppercase tracking-tighter">Turma</th>
                                                        <th className="p-3 font-black text-slate-600 uppercase tracking-tighter">Turno</th>
                                                        <th className="p-3 font-black text-slate-600 uppercase tracking-tighter">Dia</th>
                                                        <th className="p-3 font-black text-slate-600 uppercase tracking-tighter">Itens</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {ghostSchedules.map((s, i) => (
                                                        <tr key={s.id || i} className={`hover:bg-slate-50/50 transition-colors ${selectedSchedules.includes(s.id || '') ? 'bg-blue-50/30' : ''}`}>
                                                            <td className="p-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedSchedules.includes(s.id || '')}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) setSelectedSchedules(prev => [...prev, s.id || '']);
                                                                        else setSelectedSchedules(prev => prev.filter(id => id !== (s.id || '')));
                                                                    }}
                                                                    className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                                                                />
                                                            </td>
                                                            <td className="p-3 font-medium text-slate-700">{s.grade}</td>
                                                            <td className="p-3 font-bold text-blue-900">{s.class}</td>
                                                            <td className="p-3 text-slate-500 font-medium">{s.shift}</td>
                                                            <td className="p-3 text-slate-500 font-medium">{s.dayOfWeek}º dia</td>
                                                            <td className="p-3">
                                                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                                                    {(s.items || []).length} aulas
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <Button
                                            onClick={deleteGhostSchedules}
                                            disabled={loading || selectedSchedules.length === 0}
                                            className={`w-full py-6 text-lg font-black shadow-lg transition-all ${selectedSchedules.length > 0 ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-slate-300 cursor-not-allowed shadow-none'}`}
                                        >
                                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Trash2 className="mr-2" />}
                                            Apagar {selectedSchedules.length} Registros Selecionados
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'GLOBAL_RESET' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-red-50 p-8 rounded-3xl border-2 border-dashed border-red-200 text-center">
                                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                    <AlertTriangle className="w-10 h-10" />
                                </div>
                                <h4 className="text-2xl font-black text-red-900 mb-3">RESET GLOBAL DE BOLETINS</h4>
                                <p className="text-red-700 max-w-lg mx-auto mb-8 font-medium">
                                    Esta ação apagará permanentemente **TODOS os lançamentos de notas e faltas** (coleção grades) de todas as unidades para o ano corrente.
                                    <br /><br />
                                    <span className="font-bold underline">Não afeta os dados de presença diária (attendance)</span>, apenas o que foi consolidado no boletim.
                                </p>

                                <Button onClick={runGlobalReset} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white px-12 py-4 rounded-2xl text-xl font-black shadow-xl shadow-red-500/20">
                                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Database className="mr-2" />}
                                    Zerar Todo o Banco de Dados
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-bold shrink-0">
                    <div className="flex gap-4">
                        <span>SISTEMA: MEU EXPANSIVO 3.0</span>
                        <span>MODO: SUPER ADMIN</span>
                    </div>
                    <div>
                        © {new Date().getFullYear()} - CENTRAL DE PROTEÇÃO DE DADOS
                    </div>
                </div>
            </div>
        </div>
    );
};
