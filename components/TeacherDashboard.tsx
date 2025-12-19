import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { Teacher, Student, GradeEntry, AttendanceRecord, EarlyChildhoodReport, BimesterData, AttendanceStatus, SchoolClass } from '../types';
import { SCHOOL_GRADES_LIST, UNITS_DATA, SCHOOL_CLASSES_LIST } from '../src/constants';
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
    const [filterClass, setFilterClass] = useState<SchoolClass>(SchoolClass.A); // Padrão Turma A

    // Estados do Formulário de Lançamento
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [selectedStage, setSelectedStage] = useState<string>('bimester1');
    const [nota, setNota] = useState<number | ''>('');
    const [recuperacao, setRecuperacao] = useState<number | ''>('');
    const [faltas, setFaltas] = useState<number | ''>('');
    const [difficultyTopic, setDifficultyTopic] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [currentGradeData, setCurrentGradeData] = useState<GradeEntry | null>(null);

    // Estados da Chamada
    const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});

    // Patch de Dados Aplicado
    const patchedGrades = useMemo(() => applyGradePatches(liveGrades), [liveGrades]);

    const filteredStudents = useMemo(() => students.filter(s =>
        s.unit === teacher.unit &&
        (filterGrade ? s.gradeLevel === filterGrade : true) &&
        (filterClass ? s.schoolClass === filterClass : true)
        // Nota: Assumes student has schoolClass. Se não tiver, pode precisar ajustar.
    ), [students, teacher.unit, filterGrade, filterClass]);

    // Carregar dados nos inputs quando mudar aluno/disciplina/etapa
    useEffect(() => {
        if (selectedStudent && selectedSubject) {
            const entry = liveGrades.find(g => g.studentId === selectedStudent.id && g.subject === selectedSubject);
            setCurrentGradeData(entry || null);
            if (entry) {
                const bimesterKey = selectedStage.replace('_rec', '') as keyof GradeEntry['bimesters'];
                const data = entry.bimesters ? entry.bimesters[bimesterKey] : null;
                if (data) {
                    setNota(data.nota ?? '');
                    setRecuperacao(data.recuperacao ?? '');
                    setFaltas(data.faltas);
                    setDifficultyTopic(data.difficultyTopic || '');
                }
            } else {
                setNota(''); setRecuperacao(''); setFaltas(''); setDifficultyTopic('');
            }
        } else {
            setCurrentGradeData(null);
            setNota(''); setRecuperacao(''); setFaltas(''); setDifficultyTopic('');
        }
    }, [selectedStudent, selectedSubject, selectedStage, liveGrades]);

    // Carregar Chamada Existente
    useEffect(() => {
        if (activeTab === 'attendance' && filterGrade && selectedSubject) {
            // Busca registro: Data + Unit + Grade + Class + Disc
            // ID format: YYYY-MM-DD_UNIT_GRADE_CLASS_DISC (Need to confirm format? fallback to search)
            // Simplified Logic: Search in liveAttendance
            const record = liveAttendance.find(r =>
                r.date === attendanceDate &&
                r.unit === teacher.unit &&
                r.gradeLevel === filterGrade &&
                r.schoolClass === filterClass &&
                r.discipline === selectedSubject
            );

            if (record) {
                setAttendanceMap(record.studentStatus || {});
            } else {
                // Initialize default PRESENT
                const initialMap: Record<string, AttendanceStatus> = {};
                filteredStudents.forEach(s => initialMap[s.id] = AttendanceStatus.PRESENT);
                setAttendanceMap(initialMap);
            }
        }
    }, [activeTab, attendanceDate, filterGrade, filterClass, selectedSubject, liveAttendance, filteredStudents, teacher.unit]);


    const handleStudentSelect = (student: Student) => {
        setSelectedStudent(student);
        if (teacher.subjects.length > 0 && !selectedSubject) setSelectedSubject(teacher.subjects[0]);
    };

    const handleAttendanceToggle = (studentId: string) => {
        setAttendanceMap(prev => ({
            ...prev,
            [studentId]: prev[studentId] === AttendanceStatus.PRESENT ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT
        }));
    };

    const handleSaveAttendanceSubmit = async () => {
        if (!filterGrade || !selectedSubject) return alert("Selecione Série e Disciplina.");
        setIsSaving(true);
        try {
            const id = `${attendanceDate}_${teacher.unit}_${filterGrade}_${filterClass}_${selectedSubject}`; // Unique ID

            const record: AttendanceRecord = {
                id,
                date: attendanceDate,
                unit: teacher.unit,
                gradeLevel: filterGrade,
                schoolClass: filterClass,
                teacherId: teacher.id,
                teacherName: teacher.name,
                discipline: selectedSubject,
                studentStatus: attendanceMap
            };

            await onSaveAttendance(record);
            alert("Chamada salva com sucesso!");
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar chamada.");
        } finally {
            setIsSaving(false);
        }
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

            const newData: BimesterData = {
                ...currentData,
                nota: nota !== '' ? Number(nota) : null,
                recuperacao: recuperacao !== '' ? Number(recuperacao) : null,
                faltas: faltas !== '' ? Number(faltas) : 0,
                difficultyTopic: difficultyTopic
            };

            const n = newData.nota || 0;
            const r = newData.recuperacao || 0;
            newData.media = Math.max(n, r);

            const newBimesters = { ...baseBimesters, [bimesterKey]: newData };

            const b1 = newBimesters.bimester1.media;
            const b2 = newBimesters.bimester2.media;
            const b3 = newBimesters.bimester3.media;
            const b4 = newBimesters.bimester4.media;
            const mediaAnual = (b1 + b2 + b3 + b4) / 4;
            const mediaFinal = mediaAnual;
            const situacao = mediaFinal >= 7 ? 'Aprovado' : 'Reprovado';

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
                            <div className="grid grid-cols-2 gap-2">
                                <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="w-full p-2 border rounded text-sm">
                                    <option value="">Série</option>
                                    {SCHOOL_GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                                <select value={filterClass} onChange={e => setFilterClass(e.target.value as SchoolClass)} className="w-full p-2 border rounded text-sm">
                                    {SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>Turma {c}</option>)}
                                </select>
                            </div>
                            {activeTab === 'attendance' && (
                                <div className="mt-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Disciplina</label>
                                    <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full p-2 border rounded text-sm bg-blue-50 text-blue-900 font-bold">
                                        <option value="">Selecione...</option>
                                        {teacher.subjects.map(s => <option key={s} value={s as string}>{s as string}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <ul className="divide-y max-h-[500px] overflow-y-auto">
                            {activeTab === 'grades' ? (
                                filteredStudents.map(student => (
                                    <li key={student.id} onClick={() => handleStudentSelect(student)} className={`p-3 cursor-pointer rounded mb-1 transition-all ${selectedStudent?.id === student.id ? 'bg-blue-100 border-l-4 border-blue-950' : 'hover:bg-gray-50'}`}>
                                        <span className="font-bold block">{student.name}</span>
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>{student.gradeLevel}</span>
                                            <span className="bg-gray-200 px-2 rounded-full text-gray-700">{student.schoolClass || 'A'}</span>
                                        </div>
                                    </li>
                                ))
                            ) : (
                                // Attendance List
                                filterGrade && selectedSubject ? (
                                    filteredStudents.map(student => (
                                        <li key={student.id} className="p-3 flex items-center justify-between hover:bg-gray-50 border-b">
                                            <div className="flex-1">
                                                <span className="font-bold block text-sm">{student.name}</span>
                                                <span className="text-xs text-gray-400">{student.code}</span>
                                            </div>
                                            <button
                                                onClick={() => handleAttendanceToggle(student.id)}
                                                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${attendanceMap[student.id] === AttendanceStatus.ABSENT ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                                            >
                                                {attendanceMap[student.id] === AttendanceStatus.ABSENT ? 'FALTOU' : 'PRESENTE'}
                                            </button>
                                        </li>
                                    ))
                                ) : (
                                    <li className="p-4 text-center text-gray-400 italic text-sm">Selecione Série e Disciplina para visualizar a lista de chamada.</li>
                                )
                            )}
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
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="bg-white p-6 rounded-lg shadow-md">
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

                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-1">Dificuldade / Conteúdo (Opcional)</label>
                                                    <textarea
                                                        value={difficultyTopic}
                                                        onChange={e => setDifficultyTopic(e.target.value)}
                                                        className="w-full p-2 border rounded h-20 text-sm"
                                                        placeholder="Descreva a dificuldade encontrada ou o conteúdo trabalhado..."
                                                    />
                                                </div>

                                                <div className="text-right">
                                                    <Button type="submit" disabled={isSaving} className="w-full md:w-auto">
                                                        {isSaving ? 'Salvando...' : 'Salvar Lançamento'}
                                                    </Button>
                                                </div>
                                            </form>
                                        </div>

                                        {/* MINI BOLETIM (DEMONSTRATIVO) */}
                                        <div className="bg-white p-6 rounded-lg shadow-sm border">
                                            <h3 className="text-lg font-semibold mb-4 text-gray-700">Demonstrativo do Boletim ({selectedSubject || '-'})</h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-center">
                                                    <thead className="bg-gray-100 text-gray-600 font-bold">
                                                        <tr>
                                                            <th className="p-2 text-left">Bimestre</th>
                                                            <th className="p-2">Nota</th>
                                                            <th className="p-2">Rec.</th>
                                                            <th className="p-2">Média</th>
                                                            <th className="p-2">Faltas</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {[1, 2, 3, 4].map(b => {
                                                            const bKey = `bimester${b}` as keyof GradeEntry['bimesters'];
                                                            const data = currentGradeData?.bimesters?.[bKey];
                                                            return (
                                                                <tr key={b}>
                                                                    <td className="p-2 text-left font-medium">{b}º Bimestre</td>
                                                                    <td className="p-2">{data?.nota ?? '-'}</td>
                                                                    <td className="p-2">{data?.recuperacao ?? '-'}</td>
                                                                    <td className="p-2 font-bold text-blue-900">{data?.media ?? '-'}</td>
                                                                    <td className="p-2">{data?.faltas ?? 0}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot className="bg-gray-50 font-bold border-t-2">
                                                        <tr>
                                                            <td className="p-2 text-left">Resultado</td>
                                                            <td colSpan={2}></td>
                                                            <td className="p-2 text-blue-950">{currentGradeData?.mediaAnual?.toFixed(1) ?? '-'}</td>
                                                            <td className="p-2">{currentGradeData?.situacaoFinal ?? '-'}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-20 text-gray-500">Selecione um aluno para iniciar.</div>
                                )
                            )
                        ) : (
                            // ABA CHAMADA DIÁRIA
                            <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
                                <h2 className="text-xl font-bold mb-6 text-blue-950 flex items-center justify-between">
                                    <div className="flex items-center gap-2"><span>📅</span> Chamada Diária</div>
                                    <input
                                        type="date"
                                        value={attendanceDate}
                                        onChange={e => setAttendanceDate(e.target.value)}
                                        className="text-sm p-2 border rounded font-normal"
                                    />
                                </h2>

                                {filterGrade && selectedSubject ? (
                                    <div className="flex-1 overflow-hidden flex flex-col">
                                        <div className="mb-4 bg-yellow-50 p-3 rounded text-sm text-yellow-800 border border-yellow-200">
                                            Confirme a presença dos alunos abaixo. Clique no botão de status para alternar.
                                        </div>
                                        <div className="flex-1 overflow-y-auto border rounded-lg">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-gray-100 sticky top-0">
                                                    <tr>
                                                        <th className="p-3 border-b">Aluno</th>
                                                        <th className="p-3 border-b w-32 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {filteredStudents.map(student => (
                                                        <tr key={student.id} className="hover:bg-gray-50">
                                                            <td className="p-3">
                                                                <div className="font-bold">{student.name}</div>
                                                                <div className="text-xs text-gray-400">Mat: {student.code}</div>
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <button
                                                                    onClick={() => handleAttendanceToggle(student.id)}
                                                                    className={`w-full py-1 rounded font-bold text-sm transition-all ${attendanceMap[student.id] === AttendanceStatus.ABSENT ? 'bg-red-500 text-white shadow-md' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                                                                >
                                                                    {attendanceMap[student.id] === AttendanceStatus.ABSENT ? 'FALTOU' : 'PRESENTE'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="mt-4 text-right">
                                            <Button onClick={handleSaveAttendanceSubmit} disabled={isSaving}>
                                                {isSaving ? 'Salvando...' : 'Salvar Chamada'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-gray-400 italic">
                                        Selecione uma Série e uma Disciplina no menu lateral para realizar a chamada.
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
};

export default TeacherDashboard;