import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { Teacher, Student, GradeEntry, AttendanceRecord, EarlyChildhoodReport, BimesterData } from '../types';
import { SCHOOL_GRADES_LIST, UNITS_DATA } from '../src/constants';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { ClassHistoricalReport2025 } from './ClassHistoricalReport2025';
import { applyGradePatches } from '../utils/dataPatch';

interface TeacherDashboardProps {
    teacher: Teacher;
    students: Student[];
    grades: GradeEntry[];
    attendanceRecords: AttendanceRecord[];
    earlyChildhoodReports: EarlyChildhoodReport[];
    onSaveGrade: (grade: GradeEntry) => Promise<void>;
    onSaveAttendance: (record: AttendanceRecord) => Promise<void>;
    onSaveEarlyChildhoodReport: (report: EarlyChildhoodReport) => Promise<void>;
    onLogout: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
    teacher, students, grades, attendanceRecords, earlyChildhoodReports,
    onSaveGrade, onSaveAttendance, onSaveEarlyChildhoodReport, onLogout
}) => {
    // Sincronização em Tempo Real
    const [liveGrades, setLiveGrades] = useState<GradeEntry[]>(grades);
    const [liveAttendance, setLiveAttendance] = useState<AttendanceRecord[]>(attendanceRecords);

    useEffect(() => {
        const unsubGrades = db.collection('grades').onSnapshot(snap =>
            setLiveGrades(snap.docs.map(doc => doc.data() as GradeEntry)));
        const unsubAtt = db.collection('attendance').onSnapshot(snap =>
            setLiveAttendance(snap.docs.map(doc => doc.data() as AttendanceRecord)));
        return () => { unsubGrades(); unsubAtt(); };
    }, []);

    // Estados de Controle
    const [activeTab, setActiveTab] = useState<'grades' | 'attendance'>('grades');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedYear, setSelectedYear] = useState<number>(2026);
    const [filterGrade, setFilterGrade] = useState<string>('');

    // Estados do Formulário de Lançamento
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [selectedStage, setSelectedStage] = useState<string>('bimester1');
    const [nota, setNota] = useState<number | ''>('');
    const [recuperacao, setRecuperacao] = useState<number | ''>('');
    const [faltas, setFaltas] = useState<number | ''>('');
    const [isSaving, setIsSaving] = useState(false);
    const [currentGradeData, setCurrentGradeData] = useState<GradeEntry | null>(null);

    // Patch de Dados Aplicado
    const patchedGrades = useMemo(() => applyGradePatches(liveGrades), [liveGrades]);

    const filteredStudents = useMemo(() => students.filter(s =>
        s.unit === teacher.unit && (filterGrade ? s.gradeLevel === filterGrade : true)
    ), [students, teacher.unit, filterGrade]);

    // Carregar dados nos inputs quando mudar aluno/disciplina/etapa
    useEffect(() => {
        if (selectedStudent && selectedSubject) {
            const entry = liveGrades.find(g => g.studentId === selectedStudent.id && g.subject === selectedSubject);
            setCurrentGradeData(entry || null);
            if (entry) {
                const bimesterKey = selectedStage.replace('_rec', '') as keyof GradeEntry['bimesters'];
                // Check if bimester exists (it should based on type, but safe check)
                const data = entry.bimesters ? entry.bimesters[bimesterKey] : null;
                if (data) {
                    setNota(data.nota ?? '');
                    setRecuperacao(data.recuperacao ?? '');
                    setFaltas(data.faltas);
                }
            } else {
                setNota(''); setRecuperacao(''); setFaltas('');
            }
        } else {
            setCurrentGradeData(null);
            setNota(''); setRecuperacao(''); setFaltas('');
        }
    }, [selectedStudent, selectedSubject, selectedStage, liveGrades]);

    const handleStudentSelect = (student: Student) => {
        setSelectedStudent(student);
        // Auto-select first subject if available
        if (teacher.subjects.length > 0 && !selectedSubject) setSelectedSubject(teacher.subjects[0]);
    };

    const handleGradeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent || !selectedSubject) return alert("Selecione aluno e disciplina.");

        setIsSaving(true);
        try {
            const existingGrade = liveGrades.find(g => g.studentId === selectedStudent.id && g.subject === selectedSubject);
            const baseBimesters = existingGrade?.bimesters || {
                bimester1: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                bimester2: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                bimester3: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                bimester4: { nota: null, recuperacao: null, media: 0, faltas: 0 }
            };

            const bimesterKey = selectedStage.replace('_rec', '') as keyof GradeEntry['bimesters'];
            const currentData = baseBimesters[bimesterKey];

            // Logic: If plain bimester, update nota/rec/faltas. If rec view (future), maybe different? 
            // User requested basic form. Assuming standard update.

            const newData: BimesterData = {
                ...currentData,
                nota: nota !== '' ? Number(nota) : null,
                recuperacao: recuperacao !== '' ? Number(recuperacao) : null,
                faltas: faltas !== '' ? Number(faltas) : 0,
            };

            // Calculate Media (Simple average of nota/rec? Or predefined Logic?)
            // Re-using simplified media logic: Max(nota, rec)
            const n = newData.nota || 0;
            const r = newData.recuperacao || 0;
            newData.media = Math.max(n, r);

            const newBimesters = { ...baseBimesters, [bimesterKey]: newData };

            // Calculate Final (simplified)
            const b1 = newBimesters.bimester1.media;
            const b2 = newBimesters.bimester2.media;
            const b3 = newBimesters.bimester3.media;
            const b4 = newBimesters.bimester4.media;
            const mediaAnual = (b1 + b2 + b3 + b4) / 4;
            // Basic logic: if no rec final, mediaFinal = mediaAnual
            const mediaFinal = mediaAnual;
            const situacao = mediaFinal >= 7 ? 'Aprovado' : 'Reprovado'; // Simplified

            const gradeToSave: GradeEntry = {
                id: existingGrade ? existingGrade.id : `grade-${Date.now()}`,
                studentId: selectedStudent.id,
                subject: selectedSubject,
                bimesters: newBimesters,
                mediaAnual,
                mediaFinal,
                situacaoFinal: situacao,
                recuperacaoFinal: existingGrade?.recuperacaoFinal ?? null,
                lastUpdated: new Date().toISOString()
            };

            await onSaveGrade(gradeToSave);
            alert("Nota salva com sucesso!");
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar nota.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
            <header className="bg-gradient-to-br from-blue-950 to-slate-900 p-6 text-white flex justify-between items-center shadow-md shrink-0">
                <div className="flex items-center gap-4">
                    <SchoolLogo variant="header" />
                    <div>
                        <h1 className="text-2xl font-bold">Painel do Professor</h1>
                        <p className="text-blue-200 text-sm">{teacher.name} • {teacher.unit}</p>
                    </div>
                </div>
                <Button variant="secondary" onClick={onLogout} className="!bg-transparent !text-white border-none">Sair</Button>
            </header>

            <main className="p-4 md:p-6 flex-1 flex flex-col overflow-hidden">
                <div className="flex mb-6 border-b shrink-0">
                    <button onClick={() => setActiveTab('grades')} className={`flex-1 pb-3 font-semibold border-b-2 ${activeTab === 'grades' ? 'text-blue-950 border-blue-950' : 'text-gray-500 border-transparent'}`}>Notas e Pauta</button>
                    <button onClick={() => setActiveTab('attendance')} className={`flex-1 pb-3 font-semibold border-b-2 ${activeTab === 'attendance' ? 'text-blue-950 border-blue-950' : 'text-gray-500 border-transparent'}`}>Chamada Diária</button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
                    <aside className="w-full md:w-1/3 p-4 border rounded-lg bg-white overflow-y-auto h-full">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Turma</h2>
                        <div className="space-y-4 mb-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Ano Letivo</label>
                                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-full p-2 border rounded font-bold text-blue-900 bg-blue-50">
                                    <option value={2026}>2026 (Lançamento e Boletim)</option>
                                    <option value={2025}>2025 (Pauta Matriz)</option>
                                </select>
                            </div>
                            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="w-full p-2 border rounded text-sm">
                                <option value="">Todas as Séries</option>
                                {SCHOOL_GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <ul className="divide-y">
                            {filteredStudents.map(student => (
                                <li key={student.id} onClick={() => handleStudentSelect(student)} className={`p-3 cursor-pointer rounded mb-1 transition-all ${selectedStudent?.id === student.id ? 'bg-blue-100 border-l-4 border-blue-950' : 'hover:bg-gray-50'}`}>
                                    <span className="font-bold block">{student.name}</span>
                                    <span className="text-xs text-gray-500">{student.gradeLevel}</span>
                                </li>
                            ))}
                        </ul>
                    </aside>

                    <section className="w-full md:w-2/3 p-6 border rounded-lg bg-blue-50 overflow-y-auto">
                        {activeTab === 'grades' ? (
                            selectedYear === 2025 ? (
                                <ClassHistoricalReport2025
                                    students={filteredStudents}
                                    grades={patchedGrades}
                                    attendanceRecords={liveAttendance}
                                    unitData={UNITS_DATA[teacher.unit as keyof typeof UNITS_DATA] || null}
                                />
                            ) : (
                                selectedStudent ? (
                                    <div className="bg-white p-6 rounded-lg shadow-md animate-fade-in">
                                        <h2 className="text-xl font-bold mb-6 text-blue-950 flex items-center gap-2">
                                            <span>📝</span> Lançamento 2026: {selectedStudent.name}
                                        </h2>

                                        <form onSubmit={handleGradeSubmit} className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-1">Disciplina</label>
                                                    <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full p-2 border rounded" required>
                                                        <option value="">Selecione...</option>
                                                        {teacher.subjects.map(subj => <option key={subj} value={subj as string}>{subj as string}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-1">Bimestre</label>
                                                    <select value={selectedStage} onChange={e => setSelectedStage(e.target.value)} className="w-full p-2 border rounded" required>
                                                        <option value="bimester1">1º Bimestre</option>
                                                        <option value="bimester2">2º Bimestre</option>
                                                        <option value="bimester3">3º Bimestre</option>
                                                        <option value="bimester4">4º Bimestre</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nota</label>
                                                    <input type="number" step="0.1" min="0" max="10" value={nota} onChange={e => setNota(e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-2 border rounded text-center font-bold text-lg" placeholder="-" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Recuperação</label>
                                                    <input type="number" step="0.1" min="0" max="10" value={recuperacao} onChange={e => setRecuperacao(e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-2 border rounded text-center font-bold text-lg" placeholder="-" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Faltas</label>
                                                    <input type="number" step="1" min="0" value={faltas} onChange={e => setFaltas(e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-2 border rounded text-center font-bold text-lg" placeholder="0" />
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <Button type="submit" disabled={isSaving} className="w-full md:w-auto">
                                                    {isSaving ? 'Salvando...' : 'Salvar Lançamento'}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                ) : (
                                    <div className="text-center py-20 text-gray-500">Selecione um aluno para iniciar.</div>
                                )
                            )
                        ) : (
                            <div className="p-6 bg-white rounded-lg border text-center text-gray-400 italic">
                                Chamada Diária: selecione a série no menu ao lado.
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
};

export default TeacherDashboard;