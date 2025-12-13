// src/components/TeacherDashboard.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Teacher, Student, GradeEntry, BimesterData, SchoolUnit, Subject, SchoolClass, AttendanceRecord, AttendanceStatus, EarlyChildhoodReport, CompetencyStatus } from '../types';
import { getAttendanceBreakdown } from '../src/utils/attendanceUtils';
import {
    calculateBimesterMedia,
    calculateFinalData,
    SCHOOL_GRADES_LIST,
    SCHOOL_SHIFTS_LIST,
    SCHOOL_CLASSES_LIST,
    EARLY_CHILDHOOD_REPORT_TEMPLATE
} from '../constants';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';

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

const formatGrade = (value: number | undefined | null) => {
    return value !== undefined && value !== null ? value.toFixed(1) : '-';
};

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ teacher, students, grades, attendanceRecords, earlyChildhoodReports, onSaveGrade, onSaveAttendance, onSaveEarlyChildhoodReport, onLogout }) => {
    const [activeTab, setActiveTab] = useState<'grades' | 'attendance'>('grades');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const activeUnit = teacher.unit;
    const [filterGrade, setFilterGrade] = useState<string>('');
    const [filterShift, setFilterShift] = useState<string>('');

    // Estados para Lançamento de Notas (Fundamental/Médio)
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [selectedStage, setSelectedStage] = useState<string>('bimester1');
    const [nota, setNota] = useState<number | ''>('');
    const [recuperacao, setRecuperacao] = useState<number | ''>('');
    const [faltas, setFaltas] = useState<number | ''>('');
    const [topic, setTopic] = useState('');
    const [notaRecFinal, setNotaRecFinal] = useState<number | ''>('');
    const [currentGradeData, setCurrentGradeData] = useState<GradeEntry | null>(null);

    // Estados para Relatório (Educação Infantil)
    const [selectedSemester, setSelectedSemester] = useState<1 | 2>(1);
    const [currentReport, setCurrentReport] = useState<EarlyChildhoodReport | null>(null);
    const [teacherObservations, setTeacherObservations] = useState('');

    const [selectedAbsenceMonth, setSelectedAbsenceMonth] = useState<number>(new Date().getMonth());
    // New State for Bimester Filter - Default to current bimester
    const [selectedFilterBimester, setSelectedFilterBimester] = useState<number>(Math.floor(new Date().getMonth() / 3) + 1);


    // Estados para a Chamada
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceGrade, setAttendanceGrade] = useState('');
    const [attendanceClass, setAttendanceClass] = useState<SchoolClass>(SchoolClass.A);
    const [attendanceSubject, setAttendanceSubject] = useState<string>('');
    const [attendanceStudents, setAttendanceStudents] = useState<Student[]>([]);
    const [studentStatuses, setStudentStatuses] = useState<Record<string, AttendanceStatus>>({});
    const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
    const [isAttendanceSaving, setIsAttendanceSaving] = useState(false);

    const MONTH_NAMES = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const teacherSubjects = teacher.subjects;

    // Auto-select subject if teacher has only one
    useEffect(() => {
        if (teacherSubjects.length === 1) {
            setAttendanceSubject(teacherSubjects[0] as string);
        }
    }, [teacherSubjects]);

    const isEarlyChildhoodStudent = useMemo(() => selectedStudent?.gradeLevel.toLowerCase().includes('edu. infantil'), [selectedStudent]);

    // NEW: Calculate absences per bimester for the selected student (BY SUBJECT)
    const calculatedAbsences = useMemo(() => {
        if (!selectedStudent) return { 1: 0, 2: 0, 3: 0, 4: 0 };
        const absences = { 1: 0, 2: 0, 3: 0, 4: 0 };
        const currentYear = new Date().getFullYear();

        attendanceRecords.forEach(record => {
            // Filter: Only count absences for the currently selected subject
            if (selectedSubject && record.discipline !== selectedSubject) return;

            if (record.studentStatus[selectedStudent.id] === AttendanceStatus.ABSENT) {
                const [y, mStr] = record.date.split('-');
                const yNum = Number(y);
                const mNum = Number(mStr); // 1-12

                if (yNum === currentYear) {
                    // Explicit Ranges
                    if (mNum >= 1 && mNum <= 3) absences[1]++;
                    else if (mNum >= 4 && mNum <= 6) absences[2]++;
                    else if (mNum >= 7 && mNum <= 9) absences[3]++;
                    else if (mNum >= 10 && mNum <= 12) absences[4]++;
                }
            }
        });
        return absences;
    }, [selectedStudent, attendanceRecords, selectedSubject]);

    const filteredStudents = useMemo(() => students.filter(student => {
        const matchesUnit = student.unit === activeUnit;
        const matchesGrade = filterGrade ? student.gradeLevel === filterGrade : true;
        const matchesShift = filterShift ? student.shift === filterShift : true;
        return matchesUnit && matchesGrade && matchesShift;
    }), [students, activeUnit, filterGrade, filterShift]);

    const { absenceData, currentBimester } = useMemo(() => {
        if (attendanceStudents.length === 0) return { absenceData: {}, currentBimester: 1 };
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const bimesterNumber = Math.floor(currentMonth / 3) + 1;

        const studentAbsences: Record<string, { bimester: Record<number, { count: number, details: Record<string, number[]> }>, year: number, monthly: { count: number, details: { day: number, bimester: number }[] } }> = {};

        for (const student of attendanceStudents) {
            // Use Shared Helper
            const breakdown = getAttendanceBreakdown(attendanceRecords, student.id, attendanceSubject, currentYear);

            // Calculate Total Year from breakdown
            const yearAbsences = Object.values(breakdown).reduce((acc, curr) => acc + curr.count, 0);

            // Calculate Monthly Details (Local logic for Month View Only)
            let monthlyCount = 0;
            let monthlyDetails: { day: number, bimester: number }[] = [];

            // We still need to iterate for monthly details if a month is selected
            // Optimization: Only iterate if we need monthly details
            if (selectedAbsenceMonth !== undefined) {
                for (const record of attendanceRecords) {
                    if (attendanceSubject && record.discipline !== attendanceSubject) continue;
                    if (record.studentStatus[student.id] === AttendanceStatus.ABSENT) {
                        const [y, m, d] = record.date.split('-').map(Number);
                        if (y === currentYear && (m - 1) === selectedAbsenceMonth) {
                            monthlyCount++;
                            const recordBimester = Math.floor((m - 1) / 3) + 1;
                            monthlyDetails.push({ day: d, bimester: recordBimester });
                        }
                    }
                }
            }

            studentAbsences[student.id] = {
                bimester: breakdown, // Now stores the full breakdown object
                year: yearAbsences,
                monthly: { count: monthlyCount, details: monthlyDetails.sort((a, b) => a.day - b.day) }
            };
        }
        return { absenceData: studentAbsences, currentBimester: bimesterNumber };
    }, [attendanceStudents, attendanceRecords, selectedAbsenceMonth, attendanceSubject]);

    const getStageDisplay = (stage: string) => {
        if (stage === 'recuperacaoFinal') return 'Recuperação Final';
        const isRecovery = stage.includes('_rec'); const bimesterKey = stage.replace('_rec', ''); const number = bimesterKey.replace('bimester', '');
        return isRecovery ? `Recuperação ${number}º Bimestre` : `${number}º Bimestre`;
    }

    const reloadGradeInputState = useCallback((student: Student | null, subject: string, stage: string, currentGrades: GradeEntry[]) => {
        if (student && subject) {
            const gradeEntry = currentGrades.find(g => g.studentId === student.id && g.subject === subject);
            setCurrentGradeData(gradeEntry || null);
            if (gradeEntry) {
                if (stage === 'recuperacaoFinal') { setNotaRecFinal(gradeEntry.recuperacaoFinal ?? ''); setNota(''); setRecuperacao(''); setFaltas(''); setTopic(''); }
                else { const bimesterKey = stage.replace('_rec', '') as keyof GradeEntry['bimesters']; const bimesterData = gradeEntry.bimesters[bimesterKey]; setNota(bimesterData.nota ?? ''); setRecuperacao(bimesterData.recuperacao ?? ''); setFaltas(bimesterData.faltas); setTopic(bimesterData.difficultyTopic || ''); }
            } else { setNota(''); setRecuperacao(''); setFaltas(''); setTopic(''); setNotaRecFinal(''); }
        } else { setCurrentGradeData(null); }
    }, []);

    useEffect(() => {
        if (!selectedStudent) { setCurrentGradeData(null); setCurrentReport(null); return; }
        if (isEarlyChildhoodStudent) {
            const year = new Date().getFullYear();
            const reportId = `${selectedStudent.id}_${selectedSemester}_${year}`;
            const existingReport = earlyChildhoodReports.find(r => r.id === reportId);
            if (existingReport) { setCurrentReport(existingReport); setTeacherObservations(existingReport.teacherObservations || ''); }
            else {
                const newReport: EarlyChildhoodReport = { id: reportId, studentId: selectedStudent.id, semester: selectedSemester, year, fields: JSON.parse(JSON.stringify(EARLY_CHILDHOOD_REPORT_TEMPLATE)), teacherObservations: '', lastUpdated: new Date().toISOString() };
                setCurrentReport(newReport); setTeacherObservations('');
            }
            setCurrentGradeData(null); setNota(''); setRecuperacao(''); setFaltas(''); setTopic(''); setNotaRecFinal('');
        } else {
            reloadGradeInputState(selectedStudent, selectedSubject, selectedStage, grades);
            setCurrentReport(null);
        }
    }, [selectedStudent, selectedSemester, isEarlyChildhoodStudent, earlyChildhoodReports, selectedSubject, selectedStage, grades, reloadGradeInputState]);

    const handleStudentSelect = (student: Student) => {
        setSelectedStudent(student);
        if (!selectedSubject && teacherSubjects.length > 0) setSelectedSubject(teacherSubjects[0] as string);
    };

    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<number | ''>>) => (e: React.ChangeEvent<HTMLInputElement>) => { setter(e.target.value === '' ? '' : parseFloat(e.target.value)); };

    const handleGradeSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); if (!selectedStudent || !selectedSubject) return alert("Selecione um aluno e uma disciplina.");
        setIsSaving(true);
        const existingGrade = grades.find(g => g.studentId === selectedStudent.id && g.subject === selectedSubject);
        const baseBimesters = existingGrade?.bimesters || { bimester1: { nota: null, recuperacao: null, media: 0, faltas: 0 }, bimester2: { nota: null, recuperacao: null, media: 0, faltas: 0 }, bimester3: { nota: null, recuperacao: null, media: 0, faltas: 0 }, bimester4: { nota: null, recuperacao: null, media: 0, faltas: 0 } };
        let newBimesters = { ...baseBimesters }; let newRecFinal = existingGrade?.recuperacaoFinal ?? null;
        if (selectedStage === 'recuperacaoFinal') { newRecFinal = notaRecFinal !== '' ? Number(notaRecFinal) : null; }
        else {
            const bimesterKey = selectedStage.replace('_rec', '') as keyof GradeEntry['bimesters'];
            const isRecoveryView = selectedStage.includes('_rec');
            const currentData = newBimesters[bimesterKey];

            const notaToSave = isRecoveryView ? currentData.nota : (nota !== '' ? Number(nota) : null);
            const recToSave = !isRecoveryView ? currentData.recuperacao : (recuperacao !== '' ? Number(recuperacao) : null);

            // USE CALCULATED ABSENCES HERE
            const bimesterNumber = Number(bimesterKey.replace('bimester', '')) as 1 | 2 | 3 | 4;
            const autoAbsences = calculatedAbsences[bimesterNumber] || 0;
            const faltasToSave = autoAbsences;

            const rawBimesterData: BimesterData = { nota: notaToSave, recuperacao: recToSave, faltas: faltasToSave, media: 0, difficultyTopic: topic };
            newBimesters[bimesterKey] = calculateBimesterMedia(rawBimesterData);
        }
        const finalData = calculateFinalData(newBimesters, newRecFinal);
        const gradeToSave: GradeEntry = { id: existingGrade ? existingGrade.id : `grade-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, studentId: selectedStudent.id, subject: selectedSubject, bimesters: newBimesters, recuperacaoFinal: newRecFinal, ...finalData, lastUpdated: new Date().toISOString() };
        await onSaveGrade(gradeToSave); setIsSaving(false); alert(`Dados de ${getStageDisplay(selectedStage)} salvos com sucesso!`);
    };

    const handleCompetencyChange = (fieldId: string, competencyId: string, status: CompetencyStatus) => {
        if (!currentReport) return;
        const updatedFields = currentReport.fields.map(field => field.id === fieldId ? { ...field, competencies: field.competencies.map(comp => comp.id === competencyId ? { ...comp, status } : comp) } : field);
        setCurrentReport({ ...currentReport, fields: updatedFields });
    };

    const handleReportSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); if (!currentReport) return;
        setIsSaving(true);
        const reportToSave: EarlyChildhoodReport = { ...currentReport, teacherObservations: teacherObservations, lastUpdated: new Date().toISOString() };
        try { await onSaveEarlyChildhoodReport(reportToSave); alert(`Relatório do ${selectedSemester}º Semestre salvo com sucesso!`); }
        finally { setIsSaving(false); }
    };

    const loadAttendance = () => {
        if (!attendanceGrade) { alert("Por favor, selecione uma série."); return; }
        if (!attendanceSubject) { alert("Por favor, selecione uma disciplina."); return; }
        setIsAttendanceLoading(true);
        const studentsInClass = students.filter(s => s.unit === activeUnit && s.gradeLevel === attendanceGrade && s.schoolClass === attendanceClass);
        setAttendanceStudents(studentsInClass);
        // ID Includes Discipline now
        const recordId = `${attendanceDate}_${activeUnit}_${attendanceGrade}_${attendanceClass}_${attendanceSubject}`;
        const existingRecord = attendanceRecords.find(r => r.id === recordId);
        if (existingRecord) { setStudentStatuses(existingRecord.studentStatus); }
        else { const defaultStatuses: Record<string, AttendanceStatus> = {}; studentsInClass.forEach(s => { defaultStatuses[s.id] = AttendanceStatus.PRESENT; }); setStudentStatuses(defaultStatuses); }
        setIsAttendanceLoading(false);
    };

    const handleStatusChange = (studentId: string, status: AttendanceStatus) => { setStudentStatuses(prev => ({ ...prev, [studentId]: status })); };

    const handleSaveAttendance = async () => {
        if (attendanceStudents.length === 0) return; setIsAttendanceSaving(true);
        // ID Includes Discipline
        const recordId = `${attendanceDate}_${activeUnit}_${attendanceGrade}_${attendanceClass}_${attendanceSubject}`;
        const record: AttendanceRecord = {
            id: recordId,
            date: attendanceDate,
            unit: activeUnit,
            gradeLevel: attendanceGrade,
            schoolClass: attendanceClass,
            teacherId: teacher.id,
            teacherName: teacher.name,
            discipline: attendanceSubject, // Saving Discipline
            studentStatus: studentStatuses
        };
        try { await onSaveAttendance(record); alert('Chamada salva com sucesso!'); } finally { setIsAttendanceSaving(false); }
    };

    const getBimesterDataDisplay = () => { if (!currentGradeData || selectedStage === 'recuperacaoFinal') return null; const key = selectedStage.replace('_rec', '') as keyof GradeEntry['bimesters']; return currentGradeData.bimesters[key]; }
    const getAnnualMediaValue = () => { if (!currentGradeData) return 0; return ((currentGradeData.bimesters.bimester1.media || 0) + (currentGradeData.bimesters.bimester2.media || 0) + (currentGradeData.bimesters.bimester3.media || 0) + (currentGradeData.bimesters.bimester4.media || 0)) / 4; };
    const getAnnualMediaDisplay = () => !currentGradeData ? '-' : getAnnualMediaValue().toFixed(1);
    const isRecoveryMode = selectedStage.includes('_rec') && selectedStage !== 'recuperacaoFinal';
    const isAnnualMediaPassing = getAnnualMediaValue() >= 7;

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans">
            <div className="w-full max-w-7xl bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col">

                {/* HEADER */}
                <div className="bg-gradient-to-br from-blue-950 to-slate-900 p-6 pb-6 shadow-md relative shrink-0">
                    <div className="flex flex-row justify-between items-center relative z-10">
                        <div className="flex items-center gap-4 text-white">
                            <SchoolLogo variant="header" /> {/* Assuming SchoolLogo can take size/variant or fits well */}
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-white mb-0.5 shadow-black drop-shadow-sm">
                                    Painel do Professor
                                </h1>
                                <div className="flex items-center gap-2 text-blue-200 text-sm font-medium">
                                    <span>{teacher.name}</span>
                                    <span className="w-1 h-1 rounded-full bg-blue-400"></span>
                                    <span className="text-blue-200">{activeUnit}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button variant="secondary" onClick={onLogout} className="!bg-transparent border-none !text-white font-medium hover:!text-gray-200 shadow-none !px-0">
                                Sair
                            </Button>
                        </div>
                    </div>
                    {/* Decorative Elements (Circles) - visual consistency */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob pointer-events-none"></div>
                    <div className="absolute top-0 right-20 -mt-10 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000 pointer-events-none"></div>
                </div>

                <div className="p-4 md:p-6 flex-1 flex flex-col">

                    {/* TABS */}
                    <div className="flex mb-6 border-b w-full">
                        <button onClick={() => setActiveTab('grades')} className={`flex-1 pb-3 px-1 font-semibold border-b-2 text-center transition-colors ${activeTab === 'grades' ? 'text-blue-950 border-blue-950' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
                            {selectedStudent && isEarlyChildhoodStudent ? 'Lançar Relatório' : 'Lançar Notas'}
                        </button>
                        <button onClick={() => setActiveTab('attendance')} className={`flex-1 pb-3 px-1 font-semibold border-b-2 text-center transition-colors ${activeTab === 'attendance' ? 'text-blue-950 border-blue-950' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
                            Chamada Diária
                        </button>
                    </div>

                    {/* CONTEÚDO TAB: NOTAS/RELATÓRIOS */}
                    {activeTab === 'grades' && (
                        <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6">
                            <div className="w-full md:w-1/3 p-4 border rounded-lg shadow-md h-full bg-white flex flex-col">
                                <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">Alunos da Turma</h2>
                                <div className="mb-4 space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filtrar por:</h3>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Unidade Escolar</label>
                                        <div className="w-full text-sm p-2 border border-gray-300 rounded bg-gray-100 text-gray-600 font-medium cursor-not-allowed">{activeUnit}</div>
                                    </div>
                                    <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="w-full text-sm p-2 border border-gray-300 rounded focus:ring-blue-950 focus:border-blue-950">
                                        <option value="">Todas as Séries</option>
                                        {SCHOOL_GRADES_LIST.map((grade) => (<option key={grade} value={grade}>{grade}</option>))}
                                    </select>
                                    <select value={filterShift} onChange={e => setFilterShift(e.target.value)} className="w-full text-sm p-2 border border-gray-300 rounded focus:ring-blue-950 focus:border-blue-950">
                                        <option value="">Todos os Turnos</option>
                                        {SCHOOL_SHIFTS_LIST.map((shift) => (<option key={shift} value={shift}>{shift}</option>))}
                                    </select>
                                </div>
                                <div className="flex-1 overflow-y-auto pr-2">
                                    <ul className="divide-y divide-gray-200">
                                        {filteredStudents.length > 0 ? (
                                            filteredStudents.map(student => (
                                                <li key={student.id} className={`p-3 cursor-pointer hover:bg-blue-50 transition rounded-md mb-1 ${selectedStudent?.id === student.id ? 'bg-blue-100 border-l-4 border-blue-950 shadow-sm' : ''}`} onClick={() => handleStudentSelect(student)}>
                                                    <span className="font-bold text-gray-900 block">{student.name}</span>
                                                    <span className="text-xs text-gray-500 block mt-1">Matrícula: {student.code}</span>
                                                    <span className="text-xs text-gray-400 block mt-0.5">{student.gradeLevel}</span>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <span className="text-[10px] text-white bg-blue-950 px-1.5 py-0.5 rounded">{student.unit}</span>
                                                        <span className="text-[10px] text-gray-500">{student.schoolClass} - {student.shift}</span>
                                                    </div>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="p-4 text-center text-sm text-gray-500 italic">Nenhum aluno encontrado.</li>
                                        )}
                                    </ul>
                                </div>
                            </div>

                            <div className="w-full md:w-2/3 p-6 border rounded-lg shadow-md bg-blue-50 overflow-y-auto max-h-[85vh]">
                                {!selectedStudent ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                        <p className="text-lg">Selecione um aluno na lista ao lado.</p>
                                    </div>
                                ) : (
                                    isEarlyChildhoodStudent ? (
                                        // --- PAINEL DE RELATÓRIO INFANTIL ---
                                        <div>
                                            <h2 className="text-xl font-bold mb-6 text-blue-950 flex items-center">
                                                <span className="bg-blue-100 text-blue-950 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm">🌿</span>
                                                Relatório de Desenvolvimento Infantil
                                            </h2>
                                            <form onSubmit={handleReportSubmit} className="bg-white p-6 rounded-lg shadow-sm">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 mb-1">Aluno(a)</label>
                                                        <div className="w-full p-2.5 border border-gray-300 rounded-md bg-gray-100 font-semibold">{selectedStudent.name}</div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 mb-1">Semestre</label>
                                                        <select value={selectedSemester} onChange={(e) => setSelectedSemester(Number(e.target.value) as 1 | 2)} className="w-full p-2.5 border border-blue-300 rounded-md bg-blue-50 font-medium text-blue-950" required>
                                                            <option value={1}>1º Semestre</option>
                                                            <option value={2}>2º Semestre</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700">
                                                    <h4 className="font-bold text-gray-500 mb-2 uppercase tracking-wider">Legenda de Status</h4>
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-x-6 gap-y-1">
                                                        <span className="flex items-center gap-2"><span className="font-mono font-bold bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.5 rounded-md text-[10px]">NO</span> Não Observado</span>
                                                        <span className="flex items-center gap-2"><span className="font-mono font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 px-1.5 py-0.5 rounded-md text-[10px]">EP</span> Em Processo</span>
                                                        <span className="flex items-center gap-2"><span className="font-mono font-bold bg-green-100 text-green-800 border border-green-200 px-1.5 py-0.5 rounded-md text-[10px]">D</span> Desenvolvido</span>
                                                    </div>
                                                </div>

                                                {currentReport?.fields.map(field => (
                                                    <div key={field.id} className="mb-6 p-4 border rounded-lg bg-gray-50">
                                                        <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">{field.name}</h3>
                                                        <div className="space-y-4">
                                                            {field.competencies.map(comp => (
                                                                <div key={comp.id} className="flex flex-col md:flex-row items-start md:items-center justify-between">
                                                                    <p className="text-sm text-gray-700 md:w-2/3 mb-2 md:mb-0">{comp.description}</p>
                                                                    <div className="inline-flex rounded-md shadow-sm" role="group">
                                                                        {[CompetencyStatus.NOT_OBSERVED, CompetencyStatus.IN_PROCESS, CompetencyStatus.DEVELOPED].map(status => {
                                                                            const abbrev = status === CompetencyStatus.NOT_OBSERVED ? 'NO' : status === CompetencyStatus.IN_PROCESS ? 'EP' : 'D';
                                                                            const color = status === CompetencyStatus.DEVELOPED ? 'green' : status === CompetencyStatus.IN_PROCESS ? 'yellow' : 'red';
                                                                            const isSelected = comp.status === status;
                                                                            return (
                                                                                <button
                                                                                    key={status}
                                                                                    type="button"
                                                                                    onClick={() => handleCompetencyChange(field.id, comp.id, status)}
                                                                                    className={`px-3 py-1.5 text-xs font-bold border transition-colors ${isSelected ? `bg-${color}-500 text-white border-${color}-600 z-10` : `bg-white text-gray-700 border-gray-300 hover:bg-gray-100`} first:rounded-l-lg last:rounded-r-lg`}
                                                                                >
                                                                                    {abbrev}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações Gerais do Professor</label>
                                                    <textarea value={teacherObservations} onChange={(e) => setTeacherObservations(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md" rows={4} placeholder="Descreva aqui observações gerais sobre o desenvolvimento, comportamento ou conquistas do aluno(a) neste semestre..." />
                                                </div>
                                                <div className="flex mt-6">
                                                    <Button type="submit" disabled={isSaving} className={`w-full py-3 shadow-md flex justify-center items-center ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                                        {isSaving ? 'Salvando...' : 'Salvar Relatório'}
                                                    </Button>
                                                </div>
                                            </form>
                                        </div>
                                    ) : (
                                        // --- PAINEL DE NOTAS (FUNDAMENTAL/MÉDIO) ---
                                        <div>
                                            <h2 className="text-xl font-bold mb-6 text-blue-950 flex items-center">
                                                <span className="bg-blue-100 text-blue-950 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm">📝</span>
                                                Lançamento de Notas
                                            </h2>
                                            <form onSubmit={handleGradeSubmit} className="bg-white p-6 rounded-lg shadow-sm mb-8">
                                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                                                    <label className="block text-sm font-bold text-blue-950 mb-1">Unidade Escolar</label>
                                                    <div className="w-full border-blue-300 rounded-lg shadow-sm p-2.5 border text-blue-950 font-medium bg-blue-100 cursor-not-allowed">{activeUnit}</div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 mb-1">Disciplina</label>
                                                        <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md bg-gray-50" required>
                                                            <option value="">Selecione...</option>
                                                            {teacherSubjects.map(subject => (<option key={subject} value={subject as string}>{subject as string}</option>))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-gray-700 mb-1">Bimestre / Etapa</label>
                                                        <select value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)} className="w-full p-2.5 border border-blue-300 rounded-md bg-blue-50 font-medium text-blue-950" required>
                                                            <option value="bimester1">1º Bimestre</option>
                                                            <option value="bimester1_rec">Recuperação 1º Bimestre</option>
                                                            <option value="bimester2">2º Bimestre</option>
                                                            <option value="bimester2_rec">Recuperação 2º Bimestre</option>
                                                            <option value="bimester3">3º Bimestre</option>
                                                            <option value="bimester3_rec">Recuperação 3º Bimestre</option>
                                                            <option value="bimester4">4º Bimestre</option>
                                                            <option value="bimester4_rec">Recuperação 4º Bimestre</option>
                                                            <option value="recuperacaoFinal">Recuperação Final</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {selectedSubject && (
                                                    <div className="space-y-6 animate-fade-in-up">
                                                        {selectedStage !== 'recuperacaoFinal' && (
                                                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                                                                <div className="flex flex-col items-center mb-3 pb-2 border-b border-blue-200 gap-2">
                                                                    <h3 className="font-bold text-lg text-blue-950 whitespace-nowrap">{getStageDisplay(selectedStage).replace('Recuperação ', '')}</h3>
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${isAnnualMediaPassing ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                                        {currentGradeData ? (isAnnualMediaPassing ? 'NA MÉDIA' : 'ABAIXO DA MÉDIA') : 'SEM REGISTRO'}
                                                                    </span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-2 md:gap-4 text-center divide-x divide-blue-200">
                                                                    <div className="px-1">
                                                                        <span className="block text-[10px] md:text-xs text-blue-950 font-semibold uppercase tracking-wider mb-1">Nota</span>
                                                                        <span className="block text-lg md:text-xl font-bold text-gray-700">{formatGrade(getBimesterDataDisplay()?.nota)}</span>
                                                                    </div>
                                                                    <div className="px-1">
                                                                        <span className="block text-[10px] md:text-xs text-blue-950 font-semibold uppercase tracking-wider mb-1">Rec.</span>
                                                                        <span className="block text-lg md:text-xl font-bold text-gray-700">{formatGrade(getBimesterDataDisplay()?.recuperacao)}</span>
                                                                    </div>
                                                                    <div className="px-1">
                                                                        <span className="block text-[10px] md:text-xs text-blue-950 font-semibold uppercase tracking-wider mb-1">Média</span>
                                                                        <span className="block text-lg md:text-2xl font-extrabold text-blue-950">{getAnnualMediaDisplay()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {selectedStage !== 'recuperacaoFinal' && (
                                                            <div className="grid grid-cols-3 gap-2 md:gap-4">
                                                                <div className={isRecoveryMode ? "opacity-60" : ""}>
                                                                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Nota {isRecoveryMode && <span className="text-[10px] text-gray-500 hidden md:inline">(Leitura)</span>}</label>
                                                                    <input type="number" step="0.1" min="0" max="10" value={nota} onChange={handleInputChange(setNota)} disabled={isRecoveryMode} className={`w-full p-2 border border-gray-300 rounded text-center font-bold text-lg ${isRecoveryMode ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`} placeholder="-" />
                                                                </div>
                                                                <div className={!isRecoveryMode ? "opacity-60" : ""}>
                                                                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Rec. {!isRecoveryMode && <span className="text-[10px] text-gray-500 hidden md:inline">(Leitura)</span>}</label>
                                                                    <input type="number" step="0.1" min="0" max="10" value={recuperacao} onChange={handleInputChange(setRecuperacao)} disabled={!isRecoveryMode} className={`w-full p-2 border border-gray-300 rounded text-center text-gray-600 ${!isRecoveryMode ? 'bg-gray-100 cursor-not-allowed' : 'bg-white font-bold'}`} placeholder="-" />
                                                                </div>
                                                                <div className={isRecoveryMode ? "opacity-60" : ""}>
                                                                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Faltas (Auto)</label>
                                                                    <div className={`w-full p-2 border border-gray-300 rounded text-center bg-gray-100 text-gray-600 cursor-not-allowed`}>
                                                                        {selectedStage.startsWith('bimester') ? calculatedAbsences[Number(selectedStage.replace('bimester', '').replace('_rec', '')) as 1 | 2 | 3 | 4] || 0 : '-'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {selectedStage === 'recuperacaoFinal' && (
                                                            <div className="bg-red-50 p-6 rounded-lg border border-red-200">
                                                                <h3 className="font-bold text-red-900 mb-4 border-b border-red-200 pb-2">Lançamento de Recuperação Final</h3>
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <div className="text-center">
                                                                        <span className="block text-xs uppercase text-gray-500 font-bold">Média Anual Atual</span>
                                                                        <span className="text-2xl font-bold text-gray-800">{currentGradeData?.mediaAnual ?? '-'}</span>
                                                                    </div>
                                                                    <div className="text-4xl text-gray-300">→</div>
                                                                    <div className="w-1/2">
                                                                        <label className="block text-sm font-bold text-red-800 mb-1">Nota da Prova Final</label>
                                                                        <input type="number" step="0.1" min="0" max="10" value={notaRecFinal} onChange={handleInputChange(setNotaRecFinal)} className="w-full p-3 border-2 border-red-300 rounded-md focus:border-red-600 text-center font-bold text-xl text-red-900" placeholder="0.0" />
                                                                    </div>
                                                                </div>
                                                                <p className="text-xs text-red-600 italic">* A Média Final será: (Média Anual + Nota Prova Final) / 2. Necessário 5.0 para aprovação.</p>
                                                            </div>
                                                        )}

                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Observação / Dificuldade (Bimestral) <span className="text-xs text-gray-400 ml-2">(Opcional)</span></label>
                                                            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed" rows={2} placeholder={selectedStage === 'recuperacaoFinal' ? 'Observações não se aplicam à Recuperação Final' : 'Registre aqui dificuldades específicas do bimestre...'} disabled={selectedStage === 'recuperacaoFinal'} />
                                                        </div>

                                                        <div className="flex">
                                                            <Button type="submit" disabled={isSaving} className={`w-full py-3 shadow-md flex justify-center items-center ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                                                {isSaving ? 'Salvando...' : 'Salvar Lançamento'}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </form>

                                            {selectedStudent && (
                                                <div className="mt-8">
                                                    <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center"><span className="mr-2">📊</span> Boletim Geral do Aluno</h3>
                                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto pb-4">
                                                        <table className="min-w-[1000px] divide-y divide-gray-200 border border-gray-200 text-sm">
                                                            <thead className="bg-blue-50">
                                                                <tr>
                                                                    <th rowSpan={2} className="px-2 py-3 text-left font-bold text-gray-700 uppercase border-r border-gray-300 w-24 md:w-40 sticky left-0 bg-blue-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[10px] md:text-sm">Disciplina</th>
                                                                    {[1, 2, 3, 4].map(num => (<th key={num} colSpan={3} className="px-1 py-2 text-center font-bold text-gray-700 uppercase tracking-wider border-l border-r border-gray-300">{num}º BIM</th>))}
                                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-red-700 uppercase tracking-wider border-r border-gray-300 bg-red-50 w-16 text-[10px] leading-tight">Prova<br />Final</th>
                                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-blue-950 uppercase tracking-wider border-r border-gray-300 bg-blue-100 w-16 text-[10px] leading-tight">Média<br />Final</th>
                                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase w-20 text-[10px]">Situação</th>
                                                                </tr>
                                                                <tr className="bg-blue-50 text-[10px]">
                                                                    {[1, 2, 3, 4].map(num => (
                                                                        <React.Fragment key={num}>
                                                                            <th className="px-1 py-1 text-center font-semibold text-gray-600 border-r border-gray-300" title={`Nota ${num}º Bimestre`}>N{num}</th>
                                                                            <th className="px-1 py-1 text-center font-semibold text-gray-600 border-r border-gray-300" title={`Recuperação ${num}º Bimestre`}>R{num}</th>
                                                                            <th className="px-1 py-1 text-center font-bold text-blue-950 bg-blue-50 border-r border-gray-300" title={`Faltas ${num}º Bimestre`}>F{num}</th>
                                                                        </React.Fragment>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white divide-y divide-gray-200">
                                                                {(grades.filter(g => g.studentId === selectedStudent.id) || []).map((grade) => (
                                                                    <tr key={grade.id} className="hover:bg-gray-50 transition-colors border-b border-gray-200">
                                                                        <td className="px-2 py-2 font-bold text-gray-900 border-r border-gray-300 text-[10px] md:text-xs sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top">
                                                                            <span className="uppercase block leading-tight mb-1">{grade.subject}</span>
                                                                        </td>
                                                                        {['bimester1', 'bimester2', 'bimester3', 'bimester4'].map((key) => {
                                                                            const bData = grade.bimesters[key as keyof typeof grade.bimesters];
                                                                            const bimesterNum = Number(key.replace('bimester', '')) as 1 | 2 | 3 | 4;
                                                                            // Calculate absences dynamically for this student and bimester
                                                                            // Reusing logic from calculatedAbsences but specifically for this student inside the map
                                                                            const currentStudentAbsences = attendanceRecords.reduce((acc, record) => {
                                                                                // STRICT SUBJECT FILTER FOR BULLETIN ROW
                                                                                if (record.discipline !== grade.subject) return acc;

                                                                                if (record.studentStatus[grade.studentId] === AttendanceStatus.ABSENT) {
                                                                                    const [y, mStr] = record.date.split('-');
                                                                                    const yNum = Number(y);
                                                                                    const mNum = Number(mStr); // 1-12

                                                                                    if (yNum === new Date().getFullYear()) {
                                                                                        // Explicit check against bimesterNum (1,2,3,4)
                                                                                        if (bimesterNum === 1 && mNum >= 1 && mNum <= 3) return acc + 1;
                                                                                        if (bimesterNum === 2 && mNum >= 4 && mNum <= 6) return acc + 1;
                                                                                        if (bimesterNum === 3 && mNum >= 7 && mNum <= 9) return acc + 1;
                                                                                        if (bimesterNum === 4 && mNum >= 10 && mNum <= 12) return acc + 1;
                                                                                    }
                                                                                }
                                                                                return acc;
                                                                            }, 0);

                                                                            return (
                                                                                <React.Fragment key={key}>
                                                                                    <td className="px-1 py-2 text-center text-gray-600 text-xs border-r border-gray-300">{formatGrade(bData.nota)}</td>
                                                                                    <td className="px-1 py-2 text-center text-gray-600 text-xs border-r border-gray-300">{formatGrade(bData.recuperacao)}</td>
                                                                                    <td className="px-1 py-2 text-center text-gray-500 text-xs border-r border-gray-300">{currentStudentAbsences || ''}</td>
                                                                                </React.Fragment>
                                                                            );
                                                                        })}
                                                                        <td className="px-1 py-2 text-center font-bold text-red-600 bg-red-50 text-sm border-r border-gray-300">{formatGrade(grade.recuperacaoFinal)}</td>
                                                                        <td className="px-1 py-2 text-center font-extrabold text-blue-950 bg-blue-50 text-sm border-r border-gray-300">{formatGrade(grade.mediaFinal)}</td>
                                                                        <td className="px-1 py-2 text-center align-middle">
                                                                            <span className={`inline-block w-full py-0.5 rounded text-[9px] uppercase font-bold border ${grade.situacaoFinal === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                                grade.situacaoFinal === 'Recuperação' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                                    'bg-red-50 text-red-700 border-red-200'
                                                                                }`}>
                                                                                {grade.situacaoFinal}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'attendance' && (
                        <div className="animate-fade-in-up">
                            <div className="p-6 border rounded-lg shadow-md bg-white">
                                <h2 className="text-xl font-bold mb-4 text-blue-950">Chamada Diária</h2>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border mb-6">
                                    <div>
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Série/Ano</label>
                                        <select value={attendanceGrade} onChange={e => setAttendanceGrade(e.target.value)} className="w-full p-2 border rounded">
                                            <option value="">Selecione...</option>
                                            {SCHOOL_GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Turma</label>
                                        <select value={attendanceClass} onChange={e => setAttendanceClass(e.target.value as SchoolClass)} className="w-full p-2 border rounded">
                                            {SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Disciplina</label>
                                        <select value={attendanceSubject} onChange={e => setAttendanceSubject(e.target.value)} className="w-full p-2 border rounded">
                                            <option value="">Selecione...</option>
                                            {teacherSubjects.map(subj => <option key={subj} value={subj as string}>{subj as string}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Data</label>
                                        <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="w-full p-2 border rounded" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Mês de Referência</label>
                                        <select
                                            value={selectedAbsenceMonth}
                                            onChange={e => setSelectedAbsenceMonth(Number(e.target.value))}
                                            className="w-full p-2 border rounded"
                                        >
                                            {MONTH_NAMES.map((month, index) => (
                                                <option key={index} value={index}>{month}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Bimestre de Visualização</label>
                                        <select
                                            value={selectedFilterBimester}
                                            onChange={e => setSelectedFilterBimester(Number(e.target.value))}
                                            className="w-full p-2 border rounded text-blue-900 font-medium bg-blue-50 border-blue-200"
                                        >
                                            <option value={1}>1º Bimestre</option>
                                            <option value={2}>2º Bimestre</option>
                                            <option value={3}>3º Bimestre</option>
                                            <option value={4}>4º Bimestre</option>
                                        </select>
                                    </div>

                                    <div className="self-end">
                                        <Button onClick={loadAttendance} className="w-full" disabled={!attendanceGrade}>Buscar Turma</Button>
                                    </div>
                                </div>

                                {isAttendanceLoading && <p>Carregando...</p>}

                                {attendanceStudents.length > 0 && (
                                    <div>
                                        {/* VIEW MOBILE/TABLET (CARDS) - Alterado para LG para cobrir tablets/celulares grandes */}
                                        <div className="lg:hidden space-y-4">
                                            {attendanceStudents.map(student => {
                                                const absences = absenceData[student.id] || {
                                                    bimester: { 1: { count: 0, details: {} }, 2: { count: 0, details: {} }, 3: { count: 0, details: {} }, 4: { count: 0, details: {} } },
                                                    year: 0,
                                                    monthly: { count: 0, details: [] }
                                                };
                                                const status = studentStatuses[student.id]; // Assuming studentStatuses holds the current status
                                                const bimesterBreakdown = absences.bimester;

                                                const totalAbsences = absences.year;
                                                const monthlyAbsences = absences.monthly;
                                                return (
                                                    <div key={student.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col gap-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h4 className="font-bold text-gray-800">{student.name}</h4>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${student.shift === 'Matutino' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                        {student.shift}
                                                                    </span>
                                                                    {status === AttendanceStatus.PRESENT && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">PRESENTE</span>}
                                                                    {status === AttendanceStatus.ABSENT && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">FALTOU</span>}
                                                                </div>
                                                                <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                                                                    <div className="text-gray-700">
                                                                        <p>{selectedFilterBimester}º Bimestre: <span className="font-bold text-red-600">{bimesterBreakdown[selectedFilterBimester]?.count || 0} falta(s)</span></p>

                                                                        {/* Detailed Breakdown */}
                                                                        {bimesterBreakdown[selectedFilterBimester]?.count > 0 && (
                                                                            <div className="mt-1 flex flex-wrap gap-2">
                                                                                {Object.entries(bimesterBreakdown[selectedFilterBimester].details).map(([month, days]) => (
                                                                                    <span key={month} className="text-[10px] bg-red-50 text-red-800 border border-red-100 rounded px-1.5 py-0.5">
                                                                                        <strong>{month}:</strong> {days.map(d => `[${d}]`).join(' ')}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <p>Total no Ano: <span className="font-bold text-gray-800">{totalAbsences} falta(s)</span></p>
                                                                    {monthlyAbsences.count > 0 && (
                                                                        <div className="text-blue-800 bg-blue-50 p-1.5 rounded mt-1">
                                                                            <p>Faltas em {MONTH_NAMES[selectedAbsenceMonth]}: <span className="font-bold">{monthlyAbsences.count}</span></p>
                                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                                {monthlyAbsences.details.map((detail, idx) => (
                                                                                    <span key={idx} className="text-[10px] bg-white border border-blue-100 px-1 rounded text-blue-900">
                                                                                        Dia {detail.day} ({detail.bimester}º Bim)
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2 w-full mt-2">
                                                            <button
                                                                onClick={() => handleStatusChange(student.id, AttendanceStatus.PRESENT)}
                                                                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all duration-200 border ${status === AttendanceStatus.PRESENT
                                                                    ? 'bg-green-500 text-white border-green-600 shadow-md transform scale-105'
                                                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                Presente
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusChange(student.id, AttendanceStatus.ABSENT)}
                                                                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all duration-200 border ${status === AttendanceStatus.ABSENT
                                                                    ? 'bg-red-500 text-white border-red-600 shadow-md transform scale-105'
                                                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                Faltou
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* VIEW DESKTOP (TABLE) - Apenas acima de LG */}
                                        <div className="hidden lg:block bg-white rounded-lg shadow-sm border overflow-x-auto">
                                            {/* min-w-[800px] força o scroll se a tela for menor que isso, evitando esmagamento */}
                                            <table className="min-w-[800px] w-full">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aluno</th>
                                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {attendanceStudents.map(student => {
                                                        const absences = absenceData[student.id] || {
                                                            bimester: { 1: { count: 0, details: {} }, 2: { count: 0, details: {} }, 3: { count: 0, details: {} }, 4: { count: 0, details: {} } },
                                                            year: 0,
                                                            monthly: { count: 0, details: [] }
                                                        };
                                                        const bimesterBreakdown = absences.bimester;
                                                        return (
                                                            <tr key={student.id} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-medium text-gray-900">{student.name}</p>
                                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${student.shift === 'Matutino' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                                                            {student.shift}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-1 font-normal flex items-center gap-x-4 gap-y-1 flex-wrap">
                                                                        <div className="flex gap-2 text-xs border-r pr-3 border-gray-300 items-start">
                                                                            <div className="flex flex-col">
                                                                                <span>
                                                                                    {selectedFilterBimester}º Bimestre: <strong className="text-red-600 font-bold">{bimesterBreakdown[selectedFilterBimester]?.count || 0} falta(s)</strong>
                                                                                </span>
                                                                                {/* Detailed Breakdown for Desktop */}
                                                                                {bimesterBreakdown[selectedFilterBimester]?.count > 0 && (
                                                                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                                                                        {Object.entries(bimesterBreakdown[selectedFilterBimester].details).map(([month, days]) => (
                                                                                            <span key={month} className="text-[10px] text-gray-500">
                                                                                                <strong className="text-gray-700">{month}:</strong> {days.map(d => `[${d}]`).join(' ')} <span className="text-gray-300">|</span>
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <span>Total no Ano: <strong className="text-gray-700 font-bold">{absences.year} falta(s)</strong></span>
                                                                        {absences.monthly.count > 0 && (
                                                                            <div className="bg-blue-50 text-blue-800 px-2 py-1 rounded border border-blue-100 mt-1 inline-block">
                                                                                <span className="font-bold">{MONTH_NAMES[selectedAbsenceMonth]}: {absences.monthly.count}</span>
                                                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                                                    {absences.monthly.details.map((detail, idx) => (
                                                                                        <span key={idx} className="text-[9px] bg-white border border-blue-200 px-1 rounded text-blue-950">
                                                                                            {detail.day} ({detail.bimester}ºB)
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <div className="inline-flex rounded-md shadow-sm" role="group">
                                                                        <button type="button" onClick={() => handleStatusChange(student.id, AttendanceStatus.PRESENT)} className={`px-4 py-2 text-sm font-medium border rounded-l-lg transition-colors ${studentStatuses[student.id] === AttendanceStatus.PRESENT ? 'bg-green-500 text-white border-green-600 z-10' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-100'}`}>Presente</button>
                                                                        <button type="button" onClick={() => handleStatusChange(student.id, AttendanceStatus.ABSENT)} className={`px-4 py-2 text-sm font-medium border rounded-r-lg transition-colors ${studentStatuses[student.id] === AttendanceStatus.ABSENT ? 'bg-red-600 text-white border-red-700 z-10' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-100'}`}>Faltou</button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="mt-6 text-right">
                                            <Button onClick={handleSaveAttendance} disabled={isAttendanceSaving}>{isAttendanceSaving ? 'Salvando...' : 'Salvar Chamada'}</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};