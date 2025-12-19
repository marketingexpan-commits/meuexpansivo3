// src/components/TeacherDashboard.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { Teacher, Student, GradeEntry, BimesterData, SchoolClass, AttendanceRecord, AttendanceStatus, EarlyChildhoodReport, CompetencyStatus } from '../types';
import { getAttendanceBreakdown } from '../src/utils/attendanceUtils';
import {
    calculateBimesterMedia,
    calculateFinalData,
    SCHOOL_GRADES_LIST,
    SCHOOL_SHIFTS_LIST,
    SCHOOL_CLASSES_LIST,
    EARLY_CHILDHOOD_REPORT_TEMPLATE,
    UNITS_DATA
} from '../src/constants';
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
        const unsubGrades = db.collection('grades').onSnapshot((snapshot) => {
            setLiveGrades(snapshot.docs.map(doc => doc.data() as GradeEntry));
        });
        const unsubAttendance = db.collection('attendance').onSnapshot((snapshot) => {
            setLiveAttendance(snapshot.docs.map(doc => doc.data() as AttendanceRecord));
        });
        return () => { unsubGrades(); unsubAttendance(); };
    }, []);

    // Estados de Controle
    const [activeTab, setActiveTab] = useState<'grades' | 'attendance'>('grades');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [selectedYear, setSelectedYear] = useState<number>(2025);
    const [filterGrade, setFilterGrade] = useState<string>('');
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const activeUnit = teacher.unit;

    // Patch de Dados Aplicado
    const patchedGrades = useMemo(() => applyGradePatches(liveGrades), [liveGrades]);

    const filteredStudents = useMemo(() => students.filter(student => {
        return student.unit === activeUnit && (filterGrade ? student.gradeLevel === filterGrade : true);
    }), [students, activeUnit, filterGrade]);

    const handleStudentSelect = (student: Student) => {
        setSelectedStudent(student);
        if (teacher.subjects.length > 0) setSelectedSubject(teacher.subjects[0]);
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
            {/* CABEÇALHO */}
            <header className="bg-gradient-to-br from-blue-950 to-slate-900 p-6 text-white flex justify-between items-center shadow-md">
                <div className="flex items-center gap-4">
                    <SchoolLogo variant="header" />
                    <div>
                        <h1 className="text-2xl font-bold">Painel do Professor</h1>
                        <p className="text-blue-200 text-sm">{teacher.name} • {activeUnit}</p>
                    </div>
                </div>
                <Button variant="secondary" onClick={onLogout} className="!bg-transparent !text-white border-none">Sair</Button>
            </header>

            <main className="p-4 md:p-6 flex-1 flex flex-col overflow-hidden">
                {/* TABS */}
                <div className="flex mb-6 border-b shrink-0">
                    <button onClick={() => setActiveTab('grades')} className={`flex-1 pb-3 font-semibold border-b-2 ${activeTab === 'grades' ? 'text-blue-950 border-blue-950' : 'text-gray-500 border-transparent'}`}>Notas e Pauta</button>
                    <button onClick={() => setActiveTab('attendance')} className={`flex-1 pb-3 font-semibold border-b-2 ${activeTab === 'attendance' ? 'text-blue-950 border-blue-950' : 'text-gray-500 border-transparent'}`}>Chamada Diária</button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
                    {/* LISTA DE ALUNOS */}
                    <aside className="w-full md:w-1/3 p-4 border rounded-lg bg-white overflow-y-auto">
                        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Turma</h2>
                        <div className="space-y-4 mb-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase">Ano Letivo</label>
                                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-full p-2 border rounded font-bold text-blue-900 bg-blue-50">
                                    <option value={2025}>2025 (Pauta Matriz)</option>
                                    <option value={2026}>2026 (Lançamento e Boletim)</option>
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

                    {/* CONTEÚDO PRINCIPAL */}
                    <section className="w-full md:w-2/3 p-6 border rounded-lg bg-blue-50 overflow-y-auto">
                        {activeTab === 'grades' ? (
                            selectedYear === 2025 ? (
                                <ClassHistoricalReport2025
                                    students={filteredStudents}
                                    grades={patchedGrades}
                                    attendanceRecords={liveAttendance}
                                    unitData={UNITS_DATA[activeUnit as keyof typeof UNITS_DATA] || null}
                                />
                            ) : (
                                selectedStudent ? (
                                    <div className="bg-white p-6 rounded-lg shadow-md">
                                        <h2 className="text-xl font-bold mb-4">Lançamento 2026: {selectedStudent.name}</h2>
                                        <div className="p-10 text-center text-gray-400 italic border-2 border-dashed rounded-lg">
                                            Interface de lançamento e boletim individual de 2026.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-20 text-gray-500">Selecione um aluno na lista ao lado.</div>
                                )
                            )
                        ) : (
                            <div className="p-6 bg-white rounded-lg border text-center text-gray-400">
                                <h2 className="text-xl font-bold mb-4 text-blue-950 text-left">Chamada Diária</h2>
                                <p className="py-10 italic">Selecione uma série para iniciar a frequência.</p>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
};

export default TeacherDashboard;