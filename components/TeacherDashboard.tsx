import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { Teacher, Student, GradeEntry, AttendanceRecord } from '../types';
import { SCHOOL_GRADES_LIST, UNITS_DATA } from '../src/constants';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { ClassHistoricalReport2025 } from './ClassHistoricalReport2025';
import { applyGradePatches } from '../utils/dataPatch';

interface TeacherDashboardProps {
    teacher: Teacher; students: Student[]; grades: GradeEntry[];
    attendanceRecords: AttendanceRecord[]; onLogout: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
    teacher, students, grades, attendanceRecords, onLogout
}) => {
    const [liveGrades, setLiveGrades] = useState<GradeEntry[]>(grades);
    const [activeTab, setActiveTab] = useState<'grades' | 'attendance'>('grades');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [filterGrade, setFilterGrade] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number>(2025);

    useEffect(() => {
        const unsub = db.collection('grades').onSnapshot((snap) => {
            setLiveGrades(snap.docs.map(doc => doc.data() as GradeEntry));
        });
        return () => unsub();
    }, []);

    const patchedGrades = useMemo(() => applyGradePatches(liveGrades), [liveGrades]);
    const filteredStudents = useMemo(() => students.filter(s =>
        s.unit === teacher.unit && (filterGrade ? s.gradeLevel === filterGrade : true)
    ), [students, teacher.unit, filterGrade]);

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
            <header className="bg-gradient-to-br from-blue-950 to-slate-900 p-6 text-white flex justify-between items-center shadow-md">
                <div className="flex items-center gap-4">
                    <SchoolLogo variant="header" />
                    <div>
                        <h1 className="text-2xl font-bold">Painel do Professor</h1>
                        <p className="text-blue-200 text-sm">{teacher.name} • {teacher.unit}</p>
                    </div>
                </div>
                <Button variant="secondary" onClick={onLogout} className="!text-white !bg-transparent border-none">Sair</Button>
            </header>

            <main className="p-4 md:p-6 flex-1 flex flex-col overflow-hidden">
                <div className="flex mb-6 border-b shrink-0">
                    <button onClick={() => setActiveTab('grades')} className={`flex-1 pb-3 font-semibold border-b-2 ${activeTab === 'grades' ? 'text-blue-950 border-blue-950' : 'text-gray-500 border-transparent'}`}>Notas e Pauta</button>
                    <button onClick={() => setActiveTab('attendance')} className={`flex-1 pb-3 font-semibold border-b-2 ${activeTab === 'attendance' ? 'text-blue-950 border-blue-950' : 'text-gray-500 border-transparent'}`}>Chamada Diária</button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
                    <aside className="w-full md:w-1/3 p-4 border rounded-lg bg-white overflow-y-auto">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Alunos da Turma</h2>
                        <div className="space-y-4 mb-4">
                            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-full p-2 border rounded font-bold text-blue-900 bg-blue-50">
                                <option value={2025}>2025 (Pauta Matriz)</option>
                                <option value={2026}>2026 (Lançamento)</option>
                            </select>
                            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="w-full p-2 border rounded text-sm">
                                <option value="">Todas as Séries</option>
                                {SCHOOL_GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <ul className="divide-y">
                            {filteredStudents.map(student => (
                                <li key={student.id} onClick={() => setSelectedStudent(student)} className={`p-3 cursor-pointer rounded mb-1 ${selectedStudent?.id === student.id ? 'bg-blue-100 border-l-4 border-blue-950' : 'hover:bg-gray-50'}`}>
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
                                    attendanceRecords={attendanceRecords}
                                    unitData={UNITS_DATA[teacher.unit as keyof typeof UNITS_DATA] || null}
                                />
                            ) : (
                                <div className="text-center py-20 text-gray-500 bg-white rounded-lg border-2 border-dashed">
                                    <p>Selecione um aluno para lançar notas (2026).</p>
                                </div>
                            )
                        ) : (
                            <div className="text-center py-20 text-gray-400">
                                <h2 className="text-xl font-bold mb-4 text-blue-950 text-left">Chamada Diária</h2>
                                <p className="italic">Selecione uma turma para frequência.</p>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
};

export default TeacherDashboard;