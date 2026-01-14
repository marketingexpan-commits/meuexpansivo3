// src/components/TeacherDashboard.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAcademicData } from '../hooks/useAcademicData';
import {
    Teacher, Student, GradeEntry, BimesterData, SchoolUnit, Subject, SchoolClass, AttendanceRecord, AttendanceStatus, EarlyChildhoodReport, CompetencyStatus, Ticket,
    TicketStatus,
    AppNotification,
    DailyAgenda,
    ExamGuide,
    ClassMaterial,
    CalendarEvent
} from '../types';
import { db, storage } from '../firebaseConfig';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

import { getAttendanceBreakdown, AttendanceBreakdown } from '../src/utils/attendanceUtils';
import { getBimesterFromDate, getCurrentSchoolYear, getDynamicBimester, parseGradeLevel, normalizeClass, calculateSchoolDays } from '../src/utils/academicUtils';
import { calculateBimesterMedia, calculateFinalData, CURRICULUM_MATRIX, getCurriculumSubjects, SCHOOL_SHIFTS_LIST, SCHOOL_CLASSES_LIST, EARLY_CHILDHOOD_REPORT_TEMPLATE } from '../constants';
import { calculateAttendancePercentage, calculateAnnualAttendancePercentage } from '../utils/frequency';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { TableSkeleton } from './Skeleton';

interface TeacherDashboardProps {
    teacher: Teacher;
    students: Student[];
    grades: GradeEntry[];
    attendanceRecords: AttendanceRecord[];
    earlyChildhoodReports: EarlyChildhoodReport[];
    onSaveGrade: (grade: GradeEntry) => Promise<void>;
    onSaveAttendance: (record: AttendanceRecord) => Promise<void>;
    onDeleteAttendance?: (recordId: string) => Promise<void>;
    onSaveEarlyChildhoodReport: (report: EarlyChildhoodReport) => Promise<void>;
    onLogout: () => void;
    notifications?: AppNotification[];
    onDeleteNotification?: (id: string) => Promise<void>;
    academicSettings?: any;
    materials?: ClassMaterial[];
    agendas?: DailyAgenda[];
    examGuides?: ExamGuide[];
    tickets?: Ticket[];
    calendarEvents?: CalendarEvent[];
}

const formatGrade = (value: number | undefined | null) => {
    return value !== undefined && value !== null && value !== -1 ? value.toFixed(1) : '-';
};

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
    teacher,
    students,
    grades,
    attendanceRecords,
    earlyChildhoodReports,
    onSaveGrade,
    onSaveAttendance,
    onDeleteAttendance,
    onSaveEarlyChildhoodReport,
    onLogout,
    notifications = [],
    onDeleteNotification,
    academicSettings,
    materials: propsMaterials = [],
    agendas: propsAgendas = [],
    examGuides: propsExamGuides = [],
    tickets: propsTickets = [],
    calendarEvents = []
}) => {
    const { grades: academicGrades, subjects: academicSubjects, schedules, loading: loadingAcademic } = useAcademicData();

    const [activeTab, setActiveTab] = useState<'menu' | 'grades' | 'attendance' | 'tickets' | 'materials'>('menu');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const activeUnit = teacher.unit;
    const [filterGrade, setFilterGrade] = useState<string>('');
    const [filterShift, setFilterShift] = useState<string>('');
    const [filterClass, setFilterClass] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');

    const isYearFinished = useMemo(() => {
        if (!academicSettings?.bimesters) return false;
        const b4 = academicSettings.bimesters.find((b: any) => b.number === 4);
        if (!b4) return false;
        const today = new Date().toLocaleDateString('en-CA');
        return today > b4.endDate;
    }, [academicSettings]);

    // Estados para Lançamento de Notas (Fundamental/Médio)
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [selectedStage, setSelectedStage] = useState<string>('bimester1');
    const [nota, setNota] = useState<number | ''>('');
    const [recuperacao, setRecuperacao] = useState<number | ''>('');
    const [faltas, setFaltas] = useState<number | ''>('');
    const [topic, setTopic] = useState('');
    const [notaRecFinal, setNotaRecFinal] = useState<number | ''>('');
    const [currentGradeData, setCurrentGradeData] = useState<GradeEntry | null>(null);

    // Refs for mobile navigation
    const gradeFormRef = React.useRef<HTMLDivElement>(null);
    const studentListRef = React.useRef<HTMLDivElement>(null);
    // Removed local showScrollTop state as global button is used

    // Estados para Relatório (Educação Infantil)
    const [selectedSemester, setSelectedSemester] = useState<1 | 2>(1);
    const [currentReport, setCurrentReport] = useState<EarlyChildhoodReport | null>(null);
    const [teacherObservations, setTeacherObservations] = useState('');

    type StudentAbsenceSummary = {
        bimester: AttendanceBreakdown;
        year: number;
    };

    // New State for Bimester Filter - Default to current bimester
    const [selectedFilterBimester, setSelectedFilterBimester] = useState<number>(() => getDynamicBimester(new Date().toLocaleDateString('en-CA'), academicSettings));


    // Estados para a Chamada
    const [attendanceDate, setAttendanceDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [attendanceGrade, setAttendanceGrade] = useState('');
    const [attendanceClass, setAttendanceClass] = useState<SchoolClass>(SchoolClass.A);
    const [attendanceShift, setAttendanceShift] = useState<string>('');
    const [attendanceSubject, setAttendanceSubject] = useState<string>('');
    const [attendanceStudents, setAttendanceStudents] = useState<Student[]>([]);
    const [studentStatuses, setStudentStatuses] = useState<Record<string, AttendanceStatus>>({});
    const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
    const [attendanceLessonCount, setAttendanceLessonCount] = useState<number>(1);
    const [studentAbsenceOverrides, setStudentAbsenceOverrides] = useState<Record<string, number>>({});

    const [isAttendanceSaving, setIsAttendanceSaving] = useState(false);

    const tickets = useMemo(() => {
        if (!propsTickets) return [];
        const filtered = propsTickets.filter(t => teacher.subjects.includes(t.subject as any) && t.unit === teacher.unit);
        return filtered.sort((a, b) => {
            if (a.status === TicketStatus.PENDING && b.status !== TicketStatus.PENDING) return -1;
            if (a.status !== TicketStatus.PENDING && b.status === TicketStatus.PENDING) return 1;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
    }, [propsTickets, teacher.subjects, teacher.unit]);

    const uploadedMaterials = useMemo(() => {
        if (!propsMaterials) return [];
        return propsMaterials
            .filter(m => m.teacherId === teacher.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [propsMaterials, teacher.id]);

    const examGuidesList = useMemo(() => {
        if (!propsExamGuides) return [];
        return propsExamGuides
            .filter(eg => eg.teacherId === teacher.id)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [propsExamGuides, teacher.id]);

    // Note: agendas are filtered by teacher and some current parameters in the UI
    const teacherAgendas = useMemo(() => {
        if (!propsAgendas) return [];
        return propsAgendas.filter(a => a.teacherId === teacher.id);
    }, [propsAgendas, teacher.id]);


    const [replyingTicketId, setReplyingTicketId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);

    // Estados para Materiais de Aula
    const [materialTitle, setMaterialTitle] = useState('');
    const [materialFile, setMaterialFile] = useState<File | null>(null);
    const [materialGrade, setMaterialGrade] = useState('');
    const [materialShift, setMaterialShift] = useState('');
    const [materialClass, setMaterialClass] = useState<SchoolClass>(SchoolClass.A);
    const [materialSubject, setMaterialSubject] = useState<string>('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    // Removed local state and fetching for materials as it's now prop-driven


    // --- STATES PARA AGENDA E ROTEIROS ---
    const [agendaDate, setAgendaDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [agendaSubject, setAgendaSubject] = useState('');
    const [agendaGrade, setAgendaGrade] = useState('');
    const [agendaClass, setAgendaClass] = useState('');
    const [contentInClass, setContentInClass] = useState('');
    const [homework, setHomework] = useState('');
    const [isSavingAgenda, setIsSavingAgenda] = useState(false);

    const [examDate, setExamDate] = useState('');
    const [examTitle, setExamTitle] = useState('');
    const [examContent, setExamContent] = useState('');
    const [examSubject, setExamSubject] = useState('');
    const [examGrade, setExamGrade] = useState('');
    const [examClass, setExamClass] = useState('');
    const [isSavingExam, setIsSavingExam] = useState(false);


    // Estados para Notificações
    const [showNotifications, setShowNotifications] = useState(false);

    const MONTH_NAMES = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const teacherSubjects = teacher.subjects;

    const filteredGrades = useMemo(() => {
        if (!teacher.gradeLevels || teacher.gradeLevels.length === 0) return [];
        return academicGrades.filter(g => {
            // Try exact match first
            if (teacher.gradeLevels.includes(g.name)) return true;

            // Try normalized match (comparing only the grade part)
            const gShort = parseGradeLevel(g.name).grade.trim();
            return teacher.gradeLevels.some(tGrade => {
                const tShort = parseGradeLevel(tGrade).grade.trim();
                return gShort === tShort;
            });
        });
    }, [academicGrades, teacher.gradeLevels]);


    // Auto-select subject and grade if teacher has only one
    useEffect(() => {
        if (teacherSubjects.length === 1) {
            const onlySubject = teacherSubjects[0] as string;
            setAttendanceSubject(onlySubject);
            setMaterialSubject(onlySubject);
            setAgendaSubject(onlySubject);
            setExamSubject(onlySubject);
            setSelectedSubject(onlySubject);
        }

        if (teacher.gradeLevels?.length === 1) {
            const onlyGrade = teacher.gradeLevels[0];
            setFilterGrade(onlyGrade);
            setAttendanceGrade(onlyGrade);
            setMaterialGrade(onlyGrade);
            setAgendaGrade(onlyGrade);
            setExamGrade(onlyGrade);
        }
    }, [teacherSubjects, teacher.gradeLevels]);

    const getFilteredSubjects = useCallback((gradeLevel: string) => {
        if (!teacher.assignments || teacher.assignments.length === 0) return teacher.subjects;
        const assignment = teacher.assignments.find(a => a.gradeLevel === gradeLevel);
        return assignment ? assignment.subjects : teacher.subjects;
    }, [teacher.assignments, teacher.subjects]);

    const filteredSubjectsForGrades = useMemo(() => {
        const grade = selectedStudent?.gradeLevel || filterGrade;
        return getFilteredSubjects(grade);
    }, [selectedStudent, filterGrade, getFilteredSubjects]);

    const filteredSubjectsForAttendance = useMemo(() => {
        return getFilteredSubjects(attendanceGrade);
    }, [attendanceGrade, getFilteredSubjects]);

    const scheduleConflict = useMemo(() => {
        if (!attendanceDate || !attendanceGrade || !attendanceClass || !attendanceSubject || !schedules || schedules.length === 0) return false;

        // Convert date to day of week (0 = Sunday, 1 = Monday ...)
        // Note: ClassSchedule uses 0=Sunday, 1=Monday... or similar. 
        // Let's verify standard: 0 (Sunday) to 6 (Saturday).
        const dateObj = new Date(attendanceDate + 'T00:00:00');
        const dayOfWeek = dateObj.getDay();

        // Find schedule for this day/grade/class AND UNIT
        const daySchedule = schedules.find(s =>
            s.schoolId === activeUnit &&
            s.dayOfWeek === dayOfWeek &&
            s.grade === attendanceGrade &&
            s.class === attendanceClass &&
            (attendanceShift ? s.shift === attendanceShift : true)
        );

        if (!daySchedule) return true; // No classes at all on this day

        // Check if the specific subject is in the items
        const hasSubject = daySchedule.items.some(item => item.subject === attendanceSubject);
        return !hasSubject;
    }, [attendanceDate, attendanceGrade, attendanceClass, attendanceSubject, attendanceShift, schedules, activeUnit]);
    const filteredSubjectsForAgenda = useMemo(() => getFilteredSubjects(agendaGrade), [agendaGrade, getFilteredSubjects]);
    const filteredSubjectsForMaterials = useMemo(() => getFilteredSubjects(materialGrade), [materialGrade, getFilteredSubjects]);
    const filteredSubjectsForExams = useMemo(() => getFilteredSubjects(examGrade), [examGrade, getFilteredSubjects]);

    const isEarlyChildhoodStudent = useMemo(() => selectedStudent?.gradeLevel.toLowerCase().includes('edu. infantil'), [selectedStudent]);

    // NEW: Calculate absences per bimester for the selected student (BY SUBJECT)
    const calculatedAbsences = useMemo(() => {
        if (!selectedStudent) return { 1: 0, 2: 0, 3: 0, 4: 0 };
        const absences = { 1: 0, 2: 0, 3: 0, 4: 0 };
        const currentYear = getCurrentSchoolYear();

        attendanceRecords.forEach(record => {
            // Filter: Only count absences for the currently selected subject
            if (selectedSubject && record.discipline !== selectedSubject) return;

            if (record.studentStatus[selectedStudent.id] === AttendanceStatus.ABSENT) {
                const [y] = record.date.split('-');
                const yNum = Number(y);

                if (yNum === currentYear) {
                    const bimester = getDynamicBimester(record.date, academicSettings);
                    const individualCount = record.studentAbsenceCount?.[selectedStudent.id];
                    absences[bimester as 1 | 2 | 3 | 4] += individualCount !== undefined ? individualCount : (record.lessonCount || 1);
                }
            }
        });
        return absences;
    }, [selectedStudent, attendanceRecords, selectedSubject, academicSettings]);

    const filteredStudents = useMemo(() => students.filter(student => {
        const matchesUnit = student.unit === activeUnit;

        // Normalize gradeLevel for comparison (e.g., "2ª Série - Ensino Médio" -> "2ª Série")
        const { grade: studentGrade } = parseGradeLevel(student.gradeLevel);

        // Always restrict to teacher's assigned grades
        const isAssignedGrade = teacher.gradeLevels && teacher.gradeLevels.length > 0
            ? teacher.gradeLevels.includes(studentGrade)
            : false;

        const matchesGrade = filterGrade ? studentGrade === filterGrade : true;

        const matchesShift = filterShift ? student.shift === filterShift : true;

        // Normalize schoolClass for comparison (e.g., "01" -> "A")
        const studentClass = normalizeClass(student.schoolClass);
        const matchesClass = filterClass ? studentClass === filterClass : true;

        const matchesSearch = searchTerm ? (
            student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.code.toLowerCase().includes(searchTerm.toLowerCase())
        ) : true;
        return matchesUnit && isAssignedGrade && matchesGrade && matchesShift && matchesClass && matchesSearch;
    }), [students, activeUnit, teacher.gradeLevels, filterGrade, filterShift, filterClass, searchTerm]);

    const { absenceData, currentBimester } = useMemo(() => {
        if (attendanceStudents.length === 0) return { absenceData: {} as Record<string, StudentAbsenceSummary>, currentBimester: 1 };
        const currentYear = getCurrentSchoolYear();
        const currentMonth = new Date().getMonth();
        const bimesterNumber = Math.floor(currentMonth / 3) + 1;

        const studentAbsences: Record<string, StudentAbsenceSummary> = {};

        for (const student of attendanceStudents) {
            // Use Shared Helper
            const breakdown = getAttendanceBreakdown(attendanceRecords, student.id, attendanceSubject, currentYear);

            // Calculate Total Year from breakdown
            const yearAbsences = Object.values(breakdown).reduce((acc, curr) => acc + curr.count, 0);

            studentAbsences[student.id] = {
                bimester: breakdown, // Now stores the full breakdown object
                year: yearAbsences,
            };
        }
        return { absenceData: studentAbsences, currentBimester: bimesterNumber };
    }, [attendanceStudents, attendanceRecords, attendanceSubject]);

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
            const year = getCurrentSchoolYear();
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

    // Scroll Listener removed (Global used)

    const handleStudentSelect = (student: Student) => {
        setSelectedStudent(student);
        if (!selectedSubject && teacherSubjects.length > 0) setSelectedSubject(teacherSubjects[0] as string);

        // Mobile: Scroll to form when student is selected to ensure visibility
        if (window.innerWidth < 768) {
            setTimeout(() => {
                gradeFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
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

            const rawBimesterData: BimesterData = {
                nota: notaToSave,
                recuperacao: recToSave,
                faltas: faltasToSave,
                media: 0,
                difficultyTopic: topic,
                isApproved: false, // Reset legacy approval
                isNotaApproved: isRecoveryView ? (currentData.isNotaApproved ?? true) : false,
                isRecuperacaoApproved: isRecoveryView ? false : (currentData.isRecuperacaoApproved ?? true)
            };
            newBimesters[bimesterKey] = calculateBimesterMedia(rawBimesterData);
        }

        // Sanitize bimesters to ensure no undefined values (legacy support)
        const sanitizedBimesters = Object.entries(newBimesters).reduce((acc, [key, data]) => {
            const bimesterData = data as BimesterData;
            acc[key as keyof typeof newBimesters] = {
                ...bimesterData,
                isApproved: bimesterData.isApproved ?? true,
                isNotaApproved: bimesterData.isNotaApproved ?? true,
                isRecuperacaoApproved: bimesterData.isRecuperacaoApproved ?? true
            };
            return acc;
        }, {} as typeof newBimesters);

        const finalData = calculateFinalData(sanitizedBimesters, newRecFinal, isYearFinished);
        const gradeToSave: GradeEntry = {
            id: existingGrade ? existingGrade.id : `grade-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            studentId: selectedStudent.id,
            subject: selectedSubject,
            bimesters: sanitizedBimesters,
            recuperacaoFinal: newRecFinal,
            // Ensure recuperacaoFinalApproved is never undefined. Default to true if existing is missing/undefined (legacy).
            recuperacaoFinalApproved: selectedStage === 'recuperacaoFinal' ? false : (existingGrade?.recuperacaoFinalApproved ?? true),
            ...finalData,
            lastUpdated: new Date().toISOString()
        };
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
        const studentsInClass = students.filter(s => {
            const { grade: sGrade } = parseGradeLevel(s.gradeLevel);
            const sClass = normalizeClass(s.schoolClass);

            // Security check: restrict to teacher's assigned grades
            const isAssignedGrade = teacher.gradeLevels && teacher.gradeLevels.length > 0
                ? teacher.gradeLevels.includes(sGrade)
                : false;

            if (!isAssignedGrade) return false;

            return s.unit === activeUnit &&
                sGrade === attendanceGrade &&
                sClass === attendanceClass &&
                (!attendanceShift || s.shift === attendanceShift);
        });
        setAttendanceStudents(studentsInClass);
        // ID Includes Discipline now
        const recordId = `${attendanceDate}_${activeUnit}_${attendanceGrade}_${attendanceClass}_${attendanceSubject}`;
        const existingRecord = attendanceRecords.find(r => r.id === recordId);
        if (existingRecord) {
            setStudentStatuses(existingRecord.studentStatus);
            setAttendanceLessonCount(existingRecord.lessonCount || 1);
            setStudentAbsenceOverrides(existingRecord.studentAbsenceCount || {});
        }
        else {
            const defaultStatuses: Record<string, AttendanceStatus> = {};
            studentsInClass.forEach(s => { defaultStatuses[s.id] = AttendanceStatus.PRESENT; });
            setStudentStatuses(defaultStatuses);
            setAttendanceLessonCount(1);
            setStudentAbsenceOverrides({});
        }
        setIsAttendanceLoading(false);
    };

    const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
        setStudentStatuses(prev => ({ ...prev, [studentId]: status }));
        // Reset override if changing back to Present
        if (status === AttendanceStatus.PRESENT) {
            setStudentAbsenceOverrides(prev => {
                const next = { ...prev };
                delete next[studentId];
                return next;
            });
        }
    };

    const handleIndividualAbsenceChange = (studentId: string, count: number) => {
        setStudentAbsenceOverrides(prev => ({ ...prev, [studentId]: count }));
        // If count > 0, make sure status is ABSENT
        if (count > 0) {
            setStudentStatuses(prev => ({ ...prev, [studentId]: AttendanceStatus.ABSENT }));
        } else {
            setStudentStatuses(prev => ({ ...prev, [studentId]: AttendanceStatus.PRESENT }));
        }
    };

    const handleSaveAttendance = async () => {
        if (attendanceStudents.length === 0) return;
        setIsAttendanceSaving(true);

        // 1. Save the Attendance Record
        const recordId = `${attendanceDate}_${activeUnit}_${attendanceGrade}_${attendanceClass}_${attendanceSubject}`;
        const record: AttendanceRecord = {
            id: recordId,
            date: attendanceDate,
            unit: activeUnit,
            gradeLevel: attendanceGrade,
            schoolClass: attendanceClass,
            teacherId: teacher.id,
            teacherName: teacher.name,
            discipline: attendanceSubject,
            studentStatus: studentStatuses,
            lessonCount: attendanceLessonCount,
            studentAbsenceCount: studentAbsenceOverrides
        };

        try {
            await onSaveAttendance(record);

            // 2. TRIGGER: Synchronize Absences to 'Grades' Collection
            const [yearStr] = attendanceDate.split('-');
            const yearNum = Number(yearStr);
            const currentSchoolYear = getCurrentSchoolYear();

            // Determine Bimester
            const targetBimester = getDynamicBimester(attendanceDate, academicSettings);

            if (targetBimester && yearNum === currentSchoolYear) {
                const bimesterKey = `bimester${targetBimester}` as keyof GradeEntry['bimesters'];
                const otherRecords = attendanceRecords.filter(r => r.id !== recordId && r.discipline === attendanceSubject);
                const allRelevantRecords = [...otherRecords, record];

                const updates: Promise<void>[] = [];

                for (const student of attendanceStudents) {
                    // Calculate Total Absences for this Student/Bimester
                    let totalAbsences = 0;
                    allRelevantRecords.forEach(r => {
                        if (r.studentStatus[student.id] === AttendanceStatus.ABSENT) {
                            if (getDynamicBimester(r.date, academicSettings) === targetBimester) {
                                const individualCount = r.studentAbsenceCount?.[student.id];
                                totalAbsences += individualCount !== undefined ? individualCount : (r.lessonCount || 1);
                            }
                        }
                    });

                    // Find or Create partial Grade Entry
                    const existingGrade = grades.find(g => g.studentId === student.id && g.subject === attendanceSubject);
                    const baseBimesters = existingGrade?.bimesters || {
                        bimester1: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                        bimester2: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                        bimester3: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                        bimester4: { nota: null, recuperacao: null, media: 0, faltas: 0 }
                    };

                    const currentBimesterData = baseBimesters[bimesterKey];
                    if (currentBimesterData.faltas === totalAbsences) continue;

                    const newBimesterData = { ...currentBimesterData, faltas: totalAbsences };
                    const newBimesters = { ...baseBimesters, [bimesterKey]: newBimesterData };

                    const finalData = calculateFinalData(newBimesters, existingGrade?.recuperacaoFinal ?? null, isYearFinished);

                    const gradeToSave: GradeEntry = {
                        id: existingGrade ? existingGrade.id : `grade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        studentId: student.id,
                        subject: attendanceSubject,
                        bimesters: newBimesters,
                        recuperacaoFinal: existingGrade?.recuperacaoFinal ?? null,
                        ...finalData,
                        lastUpdated: new Date().toISOString()
                    };

                    updates.push(onSaveGrade(gradeToSave));
                }

                if (updates.length > 0) {
                    await Promise.all(updates);
                }
            }

            alert('Chamada salva e boletins atualizados com sucesso!');
        } catch (error) {
            console.error("Erro ao salvar chamada:", error);
            alert("Erro ao salvar chamada.");
        } finally {
            setIsAttendanceSaving(false);
        }
    };

    const handleDeleteAttendance = async () => {
        const recordId = `${attendanceDate}_${activeUnit}_${attendanceGrade}_${attendanceClass}_${attendanceSubject}`;
        const existingRecord = attendanceRecords.find(r => r.id === recordId);

        if (!existingRecord) return;
        if (!window.confirm("ATENÇÃO: Deseja realmente excluir esta chamada? Esta ação é irreversível e atualizará os boletins dos alunos.")) return;

        setIsAttendanceSaving(true);
        try {
            if (onDeleteAttendance) {
                await onDeleteAttendance(recordId);

                // SYNC BULLETIN: Recalculate absences excluding the deleted record
                const [yearStr] = attendanceDate.split('-');
                const yearNum = Number(yearStr);
                const currentSchoolYear = getCurrentSchoolYear();
                const targetBimester = getDynamicBimester(attendanceDate, academicSettings);

                if (targetBimester && yearNum === currentSchoolYear) {
                    const bimesterKey = `bimester${targetBimester}` as keyof GradeEntry['bimesters'];
                    const updates: Promise<void>[] = [];

                    // Filter only students affected (who had an absence in this record)
                    const affectedStudents = attendanceStudents.filter(s => existingRecord.studentStatus[s.id] === AttendanceStatus.ABSENT);

                    for (const student of affectedStudents) {
                        const existingGrade = grades.find(g => g.studentId === student.id && g.subject === attendanceSubject);
                        if (!existingGrade) continue;

                        // Calculate totals excluding the current recordId
                        const otherRecords = attendanceRecords.filter(r => r.id !== recordId && r.discipline === attendanceSubject);

                        let totalAbsences = 0;
                        otherRecords.forEach(r => {
                            if (r.studentStatus[student.id] === AttendanceStatus.ABSENT) {
                                if (getDynamicBimester(r.date, academicSettings) === targetBimester) {
                                    const individualCount = r.studentAbsenceCount?.[student.id];
                                    totalAbsences += individualCount !== undefined ? individualCount : (r.lessonCount || 1);
                                }
                            }
                        });

                        const baseBimesters = existingGrade.bimesters;
                        const currentBimesterData = baseBimesters[bimesterKey];
                        const newBimesterData = { ...currentBimesterData, faltas: totalAbsences };
                        const newBimesters = { ...baseBimesters, [bimesterKey]: newBimesterData };

                        const finalData = calculateFinalData(newBimesters, existingGrade.recuperacaoFinal ?? null, isYearFinished);

                        const gradeToSave: GradeEntry = {
                            ...existingGrade,
                            bimesters: newBimesters,
                            ...finalData,
                            lastUpdated: new Date().toISOString()
                        };

                        updates.push(onSaveGrade(gradeToSave));
                    }

                    if (updates.length > 0) {
                        await Promise.all(updates);
                    }
                }
            }
            // Reset to clean state for this selection
            loadAttendance();
        } catch (error) {
            console.error("Erro ao excluir chamada:", error);
            alert("Erro ao excluir chamada.");
        } finally {
            setIsAttendanceSaving(false);
        }
    };



    const handleReplySubmit = async (ticketId: string) => {
        if (!replyText.trim()) return;
        setIsSendingReply(true);

        try {
            const ticketRef = db.collection('tickets_pedagogicos').doc(ticketId);
            const timestamp = new Date().toISOString();

            // 1. Update Ticket
            await ticketRef.update({
                response: replyText,
                responseTimestamp: timestamp,
                status: TicketStatus.ANSWERED,
                responderName: teacher.name // Save teacher name
            });

            // 2. Create Notification for Student
            const ticket = tickets.find(t => t.id === ticketId);
            if (ticket) {
                const notification: AppNotification = {
                    id: `notif-${Date.now()}`,
                    studentId: ticket.studentId,
                    title: 'Dúvida Respondida',
                    message: `O professor ${teacher.name} respondeu sua dúvida em ${ticket.subject}.`,
                    timestamp: timestamp,
                    read: false
                };
                await db.collection('notifications').add(notification);
            }



            setReplyingTicketId(null);
            setReplyText('');
            alert("Resposta enviada com sucesso!");
        } catch (error) {
            console.error("Erro ao responder ticket:", error);
            alert("Erro ao enviar resposta. Tente novamente.");
        } finally {
            setIsSendingReply(false);
        }
    };

    const getBimesterDataDisplay = () => { if (!currentGradeData || selectedStage === 'recuperacaoFinal') return null; const key = selectedStage.replace('_rec', '') as keyof GradeEntry['bimesters']; return currentGradeData.bimesters[key]; }
    const getAnnualMediaValue = () => { if (!currentGradeData) return 0; return ((currentGradeData.bimesters.bimester1.media || 0) + (currentGradeData.bimesters.bimester2.media || 0) + (currentGradeData.bimesters.bimester3.media || 0) + (currentGradeData.bimesters.bimester4.media || 0)) / 4; };
    const getAnnualMediaDisplay = () => !currentGradeData ? '-' : getAnnualMediaValue().toFixed(1);
    const isRecoveryMode = selectedStage.includes('_rec') && selectedStage !== 'recuperacaoFinal';
    const isAnnualMediaPassing = getAnnualMediaValue() >= 7;

    const pendingTicketsCount = tickets.filter(t => t.status === TicketStatus.PENDING).length;

    // Calculate unread notifications count
    const unreadNotifications = useMemo(() => {
        return notifications.filter(n => !n.read).length;
    }, [notifications]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setMaterialFile(e.target.files[0]);
        }
    };

    const handleUploadMaterial = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validação básica
        if (!materialFile || !materialTitle || !materialGrade || !materialSubject) {
            alert("Preencha todos os campos e selecione um arquivo.");
            return;
        }

        if (!materialShift) {
            alert("Por favor, selecione o Turno.");
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadError(null);

        console.log("Iniciando processo de upload (v2)...");

        try {
            // 1. Sanitize filename
            const sanitizedFilename = materialFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');

            // 2. Define Path (Modular)
            const storagePath = `materials/${activeUnit}/${materialShift}/${materialGrade}/${materialClass}/${Date.now()}_${sanitizedFilename}`;
            console.log("Caminho Modular:", storagePath);

            // 3. Upload with uploadBytesResumable (Modular SDK)
            const storageV9 = getStorage();
            const storageRef = ref(storageV9, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, materialFile);

            console.log("Iniciando Upload Resumable...");

            // Aguardar conclusão com monitoramento
            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(progress);
                        console.log('Upload is ' + progress + '% done');
                    },
                    (error) => {
                        console.error("ERRO UPLOAD (OnChanged):", error);
                        reject(error);
                    },
                    async () => {
                        // Sucesso
                        try {
                            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                            console.log("URL Final:", downloadUrl);

                            // Salvar no Firestore
                            const newMaterial: ClassMaterial = {
                                id: `mat-${Date.now()}`,
                                title: materialTitle,
                                url: downloadUrl,
                                filename: sanitizedFilename,
                                teacherId: teacher.id,
                                teacherName: teacher.name,
                                subject: materialSubject,
                                unit: activeUnit,
                                gradeLevel: materialGrade,
                                schoolClass: materialClass,
                                shift: materialShift,
                                timestamp: new Date().toISOString()
                            };

                            await db.collection('materials').doc(newMaterial.id).set(newMaterial);
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    }
                );
            });

            // 4. Limpar Form e Finalizar
            setMaterialFile(null);
            setMaterialTitle('');
            setUploadProgress(0);
            alert("Material enviado com sucesso!");

        } catch (error: any) {
            console.error("ERRO NO UPLOAD:", error);

            let errorMessage = `Erro: ${error.message}`;

            if (error.code === 'storage/unauthorized') {
                errorMessage = "Permissão negada (Storage Rules). Verifique se você está logado e se as regras permitem.";
            } else if (error.code === 'storage/canceled') {
                errorMessage = "Upload cancelado.";
            } else if (error.code === 'storage/unknown') {
                errorMessage = `Erro desconhecido (${error.code}).`;
            }

            setUploadError(errorMessage);
            alert(`FALHA: ${errorMessage}`);

        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteMaterial = async (material: ClassMaterial) => {
        if (!window.confirm("Tem certeza que deseja excluir este material?")) return;

        try {
            // 1. Delete from Firestore
            await db.collection('materials').doc(material.id).delete();

            // 2. Try delete from Storage (might fail if file moved, but firestore is priority)
            try {
                const fileRef = storage.refFromURL(material.url);
                await fileRef.delete();
            } catch (err) {
                console.warn("Erro ao deletar arquivo do storage (pode já ter sido removido):", err);
            }

            alert("Material removido.");
        } catch (error) {
            console.error("Erro ao deletar material:", error);
            alert("Erro ao deletar material.");
        }
    };

    // --- HANDLERS PARA AGENDA E ROTEIROS ---
    const handleSaveAgenda = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agendaSubject || !agendaGrade || !agendaClass || !contentInClass || !agendaDate) {
            alert("Preencha todos os campos obrigatórios.");
            return;
        }

        setIsSavingAgenda(true);
        try {
            const newAgenda: DailyAgenda = {
                id: `agenda-${Date.now()}`,
                teacherId: teacher.id,
                teacherName: teacher.name,
                gradeLevel: agendaGrade,
                schoolClass: agendaClass,
                subject: agendaSubject,
                date: agendaDate,
                contentInClass,
                homework,
                timestamp: new Date().toISOString(),
                unit: activeUnit
            };

            await db.collection('daily_agenda').doc(newAgenda.id).set(newAgenda);
            alert("Agenda salva com sucesso!");

            // Limpar campos (exceto data e turma para facilitar lançamentos sequenciais)
            setContentInClass('');
            setHomework('');
        } catch (error) {
            console.error("Erro ao salvar agenda:", error);
            alert("Erro ao salvar agenda.");
        } finally {
            setIsSavingAgenda(false);
        }
    };

    const handleSaveExamGuide = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!examSubject || !examGrade || !examClass || !examDate || !examTitle || !examContent) {
            alert("Preencha todos os campos obrigatórios.");
            return;
        }

        setIsSavingExam(true);
        try {
            const newGuide: ExamGuide = {
                id: `exam-${Date.now()}`,
                teacherId: teacher.id,
                teacherName: teacher.name,
                gradeLevel: examGrade,
                schoolClass: examClass,
                subject: examSubject,
                examDate,
                title: examTitle,
                content: examContent,
                timestamp: new Date().toISOString(),
                unit: activeUnit
            };

            await db.collection('exam_guides').doc(newGuide.id).set(newGuide);
            alert("Roteiro de prova salvo com sucesso!");

            // Limpar campos
            setExamTitle('');
            setExamContent('');
        } catch (error) {
            console.error("Erro ao salvar roteiro:", error);
            alert("Erro ao salvar roteiro.");
        } finally {
            setIsSavingExam(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans">
            <div className={`w-full bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col transition-all duration-500 ease-in-out ${activeTab === 'menu' ? 'max-w-md' : 'max-w-5xl'}`}>

                {/* Minimal Header Bar */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        {activeTab !== 'menu' && (
                            <button
                                onClick={() => setActiveTab('menu')}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                            </button>
                        )}
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="font-medium text-gray-800">{teacher.name}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                            <span className="text-xs">{activeUnit}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2 text-gray-600 hover:text-gray-800 transition-colors relative hover:bg-gray-100 rounded-full"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                                {unreadNotifications > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full border-2 border-white shadow-sm transform scale-100">
                                        {unreadNotifications}
                                    </span>
                                )}
                            </button>
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black ring-opacity-5 text-left">
                                    <div className="p-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
                                        <h4 className="font-bold text-blue-900 text-sm">Notificações</h4>
                                        <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </button>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {pendingTicketsCount > 0 && (
                                            <div
                                                className="p-3 border-b border-orange-100 bg-orange-50 hover:bg-orange-100 cursor-pointer flex justify-between items-center"
                                                onClick={() => {
                                                    if (onDeleteNotification) {
                                                        // Mark all "Nova Dúvida" notifications as read (delete them)
                                                        const doubtNotifs = notifications.filter(n => (n.title.toLowerCase().includes('dúvida') || n.title.toLowerCase().includes('nova dúvida')));
                                                        doubtNotifs.forEach(n => onDeleteNotification(n.id));
                                                    }
                                                    setActiveTab('tickets');
                                                    setShowNotifications(false);
                                                }}
                                            >
                                                <div>
                                                    <span className="font-bold text-xs text-orange-800">Dúvidas Pendentes</span>
                                                    <p className="text-[10px] text-orange-600 line-clamp-1">Você tem {pendingTicketsCount} {pendingTicketsCount === 1 ? 'dúvida' : 'dúvidas'} para responder.</p>
                                                </div>
                                                <div className="bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                    {pendingTicketsCount}
                                                </div>
                                            </div>
                                        )}
                                        {notifications.length > 0 ? (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}
                                                    onClick={() => {
                                                        if (onDeleteNotification) onDeleteNotification(n.id);

                                                        // Smart Navigation: Pre-select student
                                                        if (n.studentId) {
                                                            const student = students.find(s => s.id === n.studentId);
                                                            if (student) {
                                                                setSearchTerm(''); // Clear search to ensure student is visible
                                                                setSelectedStudent(student);
                                                                // Auto-set filters to match student context
                                                                setFilterGrade(student.gradeLevel);
                                                                setFilterShift(student.shift);
                                                                // activeUnit is derived from teacher.unit, so no need/way to set it
                                                            }
                                                        }

                                                        const titleLower = n.title.toLowerCase();
                                                        const messageLower = n.message.toLowerCase();

                                                        if (titleLower.includes('dúvida') || titleLower.includes('pergunta') || messageLower.includes('dúvida')) {
                                                            setActiveTab('tickets');
                                                        } else if (titleLower.includes('nota') || titleLower.includes('aprovação') || messageLower.includes('aprovada')) {
                                                            setActiveTab('grades');
                                                        } else if (titleLower.includes('material') || messageLower.includes('material')) {
                                                            setActiveTab('materials');
                                                        }

                                                        setShowNotifications(false);
                                                    }}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-bold text-xs text-gray-800">{n.title}</span>
                                                        <span className="text-[10px] text-gray-400">{new Date(n.timestamp).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-600 line-clamp-2">{n.message}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-gray-500 text-xs italic">
                                                Nenhuma notificação.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <Button variant="secondary" onClick={onLogout} className="text-sm font-semibold py-1.5 px-4">
                            Sair
                        </Button>
                    </div>
                </div>

                <div className="p-4 md:p-6 flex-1 flex flex-col">

                    {/* MENU VIEW */}
                    {activeTab === 'menu' && (
                        <div className="animate-fade-in-up flex flex-col h-full justify-between w-full">
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 mb-10 pl-2">
                                    <div className="h-10 w-auto shrink-0">
                                        <SchoolLogo className="!h-full w-auto" />
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <span className="text-[9px] text-orange-600 font-bold uppercase tracking-[0.15em] leading-none mb-1">Aplicativo</span>
                                        <h1 className="text-lg font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                                        <span className="text-[9px] text-blue-950/60 font-bold uppercase tracking-wider leading-none mt-1">Portal do Professor</span>
                                    </div>
                                </div>
                                <div className="text-left pb-4">
                                    <p className="text-gray-500 text-sm">Selecione uma opção para gerenciar suas atividades.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setActiveTab('grades')}
                                        className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                            <svg className="w-7 h-7 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Lançar Notas</h3>
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('attendance')}
                                        className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                            <svg className="w-7 h-7 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Chamada Diária</h3>
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('tickets')}
                                        className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square relative"
                                    >
                                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                            <svg className="w-7 h-7 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Dúvidas dos Alunos</h3>
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('materials')}
                                        className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                            <svg className="w-7 h-7 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Materiais de Aula</h3>
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('agenda')}
                                        className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                            <svg className="w-7 h-7 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Agenda Diária</h3>
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('exam_guides')}
                                        className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                            <svg className="w-7 h-7 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Roteiros de Prova</h3>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONTEÚDO TAB: MATERIAIS */}
                    {activeTab === 'materials' && (
                        <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6">
                            {/* FORMULÁRIO DE UPLOAD */}
                            <div className="w-full md:w-1/3 p-6 border rounded-lg shadow-md bg-white">
                                <h2 className="text-xl font-bold mb-4 text-blue-950 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                                    </div>
                                    Enviar Material
                                </h2>
                                <form onSubmit={handleUploadMaterial} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Título do Material</label>
                                        <input
                                            type="text"
                                            value={materialTitle}
                                            onChange={(e) => setMaterialTitle(e.target.value)}
                                            placeholder="Ex: Lista de Exercícios - Fixação"
                                            className="w-full p-2 border border-gray-300 rounded focus:ring-blue-950 focus:border-blue-950"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Disciplina</label>
                                        <select value={materialSubject} onChange={(e) => setMaterialSubject(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white" required>
                                            <option value="">Selecione...</option>
                                            {filteredSubjectsForMaterials.map(subject => (<option key={subject} value={subject as string}>{subject as string}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Série</label>
                                        <select value={materialGrade} onChange={(e) => setMaterialGrade(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white" required>
                                            <option value="">Selecione...</option>
                                            {loadingAcademic ? (
                                                <option>Carregando...</option>
                                            ) : (
                                                filteredGrades.map((grade) => (<option key={grade.id} value={grade.name}>{grade.name}</option>))
                                            )}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Turno</label>
                                            <select value={materialShift} onChange={(e) => setMaterialShift(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white" required>
                                                <option value="">Selecione...</option>
                                                <option value="Matutino">Matutino</option>
                                                <option value="Vespertino">Vespertino</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Turma</label>
                                            <select value={materialClass} onChange={(e) => setMaterialClass(e.target.value as SchoolClass)} className="w-full p-2 border border-gray-300 rounded bg-white" required>
                                                {SCHOOL_CLASSES_LIST.map((cls) => (<option key={cls} value={cls}>{cls}</option>))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Arquivo (PDF)</label>
                                        <input
                                            type="file"
                                            accept="application/pdf"
                                            onChange={handleFileChange}
                                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            required
                                        />
                                        <p className="text-xs text-gray-400 mt-1">Apenas arquivos .pdf são permitidos.</p>
                                    </div>

                                    {isUploading && (
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                                        </div>
                                    )}

                                    {uploadError && (
                                        <div className="p-3 mb-2 bg-red-100 border border-red-300 text-red-700 text-sm rounded">
                                            {uploadError}
                                        </div>
                                    )}

                                    <Button type="submit" disabled={isUploading} className="w-full flex justify-center items-center gap-2">
                                        {isUploading ? 'Enviando...' : 'Fazer Upload'}
                                    </Button>
                                </form>
                            </div>

                            {/* LISTA DE MATERIAIS */}
                            <div className="w-full md:w-2/3 p-6 border rounded-lg shadow-md bg-gray-50 flex flex-col h-[600px]">
                                <h2 className="text-xl font-bold mb-4 text-blue-950 flex items-center gap-2">
                                    <span className="text-xl">📚</span> Meus Envios Recentes
                                </h2>

                                <div className="flex-1 overflow-y-auto pr-2">
                                    {uploadedMaterials.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-4">
                                            {uploadedMaterials.map(mat => (
                                                <div key={mat.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-gray-800 text-lg">{mat.title}</h3>
                                                        <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                                                            <p><span className="font-semibold text-gray-600">Disciplina:</span> {mat.subject}</p>
                                                            <p><span className="font-semibold text-gray-600">Destino:</span> {mat.gradeLevel} - {mat.schoolClass} ({mat.shift})</p>
                                                            <p className="text-xs text-gray-400 mt-2">{new Date(mat.timestamp).toLocaleDateString()} às {new Date(mat.timestamp).toLocaleTimeString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <a
                                                            href={mat.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-xs font-bold hover:bg-blue-200 text-center transition-colors"
                                                        >
                                                            Visualizar
                                                        </a>
                                                        <button
                                                            onClick={() => handleDeleteMaterial(mat)}
                                                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded text-xs font-bold hover:bg-red-100 border border-red-100 transition-colors"
                                                        >
                                                            Excluir
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-20 text-gray-400 italic">
                                            Nenhum material enviado ainda.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONTEÚDO TAB: AGENDA DIÁRIA */}
                    {activeTab === 'agenda' && (
                        <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6">
                            <div className="w-full md:w-1/3 p-6 border rounded-lg shadow-md bg-white">
                                <h2 className="text-xl font-bold mb-4 text-blue-950 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-950/10 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    </div>
                                    Nova Agenda
                                </h2>
                                <form onSubmit={handleSaveAgenda} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Data</label>
                                        <input type="date" value={agendaDate} onChange={e => setAgendaDate(e.target.value)} className="w-full p-2 border border-blue-200 rounded focus:ring-purple-500 focus:border-purple-500" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Disciplina</label>
                                        <select value={agendaSubject} onChange={e => setAgendaSubject(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white" required>
                                            <option value="">Selecione...</option>
                                            {filteredSubjectsForAgenda.map(s => <option key={s} value={s as string}>{s as string}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Série</label>
                                            <select value={agendaGrade} onChange={e => setAgendaGrade(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white" required>
                                                <option value="">Selecione...</option>
                                                {loadingAcademic ? (
                                                    <option>Carregando...</option>
                                                ) : (
                                                    filteredGrades.map(g => <option key={g.id} value={g.name}>{g.name}</option>)
                                                )}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Turma</label>
                                            <select value={agendaClass} onChange={e => setAgendaClass(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white" required>
                                                {SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Conteúdo em Sala</label>
                                        <textarea value={contentInClass} onChange={e => setContentInClass(e.target.value)} rows={3} className="w-full p-2 border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500" placeholder="Resumo do que foi dado em aula..." required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Para Casa (Tarefas)</label>
                                        <textarea value={homework} onChange={e => setHomework(e.target.value)} rows={2} className="w-full p-2 border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500" placeholder="Exercícios, páginas do livro..." />
                                    </div>
                                    <Button type="submit" disabled={isSavingAgenda} className="w-full bg-blue-950 hover:bg-black text-white font-bold py-2 rounded-lg shadow-md transition-colors flex justify-center items-center">
                                        {isSavingAgenda ? 'Salvando...' : 'Salvar Agenda'}
                                    </Button>
                                </form>
                            </div>
                            <div className="w-full md:w-2/3 p-6 border rounded-lg shadow-md bg-gray-50 flex items-center justify-center text-gray-400">
                                <p>Histórico de agendas será exibido aqui (Em breve).</p>
                            </div>
                        </div>
                    )}

                    {/* CONTEÚDO TAB: ROTEIROS DE PROVA */}
                    {activeTab === 'exam_guides' && (
                        <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6">
                            <div className="w-full md:w-1/3 p-6 border rounded-lg shadow-md bg-white">
                                <h2 className="text-xl font-bold mb-4 text-orange-600 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-950/10 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    </div>
                                    Novo Roteiro
                                </h2>
                                <form onSubmit={handleSaveExamGuide} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Título da Avaliação</label>
                                        <input type="text" value={examTitle} onChange={e => setExamTitle(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500" placeholder="Ex: Prova Mensal 1" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Data da Prova</label>
                                        <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="w-full p-2 border border-blue-200 rounded focus:ring-orange-500 focus:border-orange-500" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Disciplina</label>
                                        <select value={examSubject} onChange={e => setExamSubject(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white" required>
                                            <option value="">Selecione...</option>
                                            {filteredSubjectsForExams.map(s => <option key={s} value={s as string}>{s as string}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Série</label>
                                            <select value={examGrade} onChange={e => setExamGrade(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white" required>
                                                <option value="">Selecione...</option>
                                                {loadingAcademic ? (
                                                    <option>Carregando...</option>
                                                ) : (
                                                    filteredGrades.map(g => <option key={g.id} value={g.name}>{g.name}</option>)
                                                )}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Turma</label>
                                            <select value={examClass} onChange={e => setExamClass(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white" required>
                                                {SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Conteúdo (Tópicos)</label>
                                        <textarea value={examContent} onChange={e => setExamContent(e.target.value)} rows={5} className="w-full p-2 border border-gray-300 rounded focus:ring-orange-500 focus:border-orange-500" placeholder="Liste os assuntos que cairão na prova..." required />
                                    </div>
                                    <Button type="submit" disabled={isSavingExam} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg shadow-md transition-colors flex justify-center items-center">
                                        {isSavingExam ? 'Salvando...' : 'Salvar Roteiro'}
                                    </Button>
                                </form>
                            </div>
                            <div className="w-full md:w-2/3 p-6 border rounded-lg shadow-md bg-gray-50 flex items-center justify-center text-gray-400">
                                <p>Histórico de roteiros será exibido aqui (Em breve).</p>
                            </div>
                        </div>
                    )}

                    {/* CONTEÚDO TAB: NOTAS/RELATÓRIOS/ETC (Original) */}
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
                                        {loadingAcademic ? (
                                            <option>Carregando...</option>
                                        ) : (
                                            filteredGrades.map((grade) => (<option key={grade.id} value={grade.name}>{grade.name}</option>))
                                        )}
                                    </select>
                                    <select value={filterShift} onChange={e => setFilterShift(e.target.value)} className="w-full text-sm p-2 border border-gray-300 rounded focus:ring-blue-950 focus:border-blue-950">
                                        <option value="">Todos os Turnos</option>
                                        {SCHOOL_SHIFTS_LIST.map((shift) => (<option key={shift} value={shift}>{shift}</option>))}
                                    </select>
                                    <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-full text-sm p-2 border border-gray-300 rounded focus:ring-blue-950 focus:border-blue-950">
                                        <option value="">Todas as Turmas</option>
                                        {SCHOOL_CLASSES_LIST.map((cls) => (<option key={cls} value={cls}>{cls}</option>))}
                                    </select>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Pesquisar por nome ou matrícula..."
                                        className="w-full text-sm p-2 border border-gray-300 rounded focus:ring-blue-950 focus:border-blue-950 mt-2"
                                    />
                                </div>
                                <div ref={studentListRef} className="flex-1 overflow-y-auto pr-2 relative">
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



                            <div ref={gradeFormRef} className="w-full md:w-2/3 p-6 border rounded-lg shadow-md bg-blue-50 overflow-y-auto max-h-[85vh]">
                                {!selectedStudent ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                        <p className="text-lg">Selecione um aluno na lista ao lado.</p>
                                    </div>
                                ) : (
                                    isEarlyChildhoodStudent ? (
                                        // --- PAINEL DE RELATÓRIO INFANTIL ---
                                        <div>
                                            <h2 className="text-xl font-bold mb-6 text-blue-950 flex items-center">
                                                <div className="w-8 h-8 bg-blue-950/10 rounded-full flex items-center justify-center mr-3">
                                                    <svg className="w-5 h-5 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                                </div>
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
                                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-2">
                                                <h2 className="text-xl font-bold text-blue-950 flex items-center">
                                                    <div className="w-8 h-8 bg-blue-950/10 rounded-full flex items-center justify-center mr-3">
                                                        <svg className="w-5 h-5 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                                    </div>
                                                    Lançamento de Notas
                                                </h2>
                                                {selectedStudent && (
                                                    <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 animate-fade-in">
                                                        <span className="text-blue-400">👤</span>
                                                        {selectedStudent.name}
                                                        <span className="text-xs font-normal text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded ml-1">{selectedStudent.code}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <form onSubmit={handleGradeSubmit} className="bg-white p-6 rounded-lg shadow-sm mb-8">
                                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                                                    <label className="block text-sm font-bold text-blue-950 mb-1">Unidade Escolar</label>
                                                    <div className="w-full border-blue-300 rounded-lg shadow-sm p-2.5 border text-blue-950 font-medium bg-blue-100 cursor-not-allowed">{activeUnit}</div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                                    <div>
                                                        <select
                                                            value={selectedSubject}
                                                            onChange={(e) => {
                                                                setSelectedSubject(e.target.value);
                                                                if (selectedStudent) reloadGradeInputState(selectedStudent, e.target.value, selectedStage, grades);
                                                            }}
                                                            className="w-full p-2.5 border border-gray-300 rounded-md bg-gray-50 font-medium text-blue-950"
                                                            required
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {filteredSubjectsForGrades.map(subject => (<option key={subject} value={subject as string}>{subject as string}</option>))}
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
                                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto pb-4 w-full" style={{ maxHeight: '75vh' }}>
                                                        <table className="min-w-[1000px] divide-y divide-gray-200 border border-gray-300 text-sm relative">
                                                            <thead className="bg-blue-50 sticky top-0 z-20 shadow-sm">
                                                                <tr>
                                                                    <th rowSpan={2} className="px-2 py-3 text-left font-bold text-gray-700 uppercase border-r border-gray-300 w-20 md:w-32 sticky left-0 bg-blue-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[10px] md:text-sm">Disciplina</th>
                                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-12 text-[10px] leading-tight" title="Carga Horária Prevista">C.H.<br />Prev.</th>
                                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-12 text-[10px] leading-tight" title="Carga Horária Ministrada Anual">C.H.<br />Min.</th>
                                                                    {[1, 2, 3, 4].map(num => (
                                                                        <th key={num} colSpan={6} className="px-1 py-2 text-center font-bold text-gray-700 uppercase border-r border-gray-300">
                                                                            {num}º Bim
                                                                        </th>
                                                                    ))}
                                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-16 text-[10px] leading-tight">Méd.<br />Anual</th>
                                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-amber-700 uppercase border-r border-gray-300 bg-amber-50 w-16 text-[10px] leading-tight">Prov.<br />Final</th>
                                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-blue-950 uppercase border-r border-gray-300 bg-blue-100 w-16 text-[10px] leading-tight">Méd.<br />Final</th>

                                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-10 text-[10px] leading-tight">F</th>
                                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase border-r border-gray-300 w-16 text-[10px] leading-tight">Freq.<br />(%)</th>
                                                                    <th rowSpan={2} className="px-2 py-3 text-center font-bold text-gray-700 uppercase w-20 text-[10px]">Situação</th>
                                                                </tr>
                                                                <tr className="bg-blue-50 text-[10px]">
                                                                    {[1, 2, 3, 4].map(num => (
                                                                        <React.Fragment key={num}>
                                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600 w-8 md:w-10" title="Nota">N{num}</th>
                                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600 w-8 md:w-10" title="Recuperação">R{num}</th>
                                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-bold text-blue-950 bg-blue-50 w-8 md:w-10" title="Média">M{num}</th>
                                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600 w-8 md:w-10" title="Faltas">F{num}</th>
                                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-bold text-gray-700 bg-gray-50 w-10 md:w-12" title="Frequência">%</th>
                                                                            <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold text-gray-600 w-10 md:w-12" title="CH Ministrada">Min.</th>
                                                                        </React.Fragment>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white divide-y divide-gray-200">
                                                                {(() => {
                                                                    const normalize = (s: string) => s.toLowerCase().trim();
                                                                    const studentGradeLevelRaw = selectedStudent.gradeLevel || "";
                                                                    const studentGradeLevelNorm = normalize(studentGradeLevelRaw);

                                                                    const allCurriculumSubjects = getCurriculumSubjects(studentGradeLevelRaw, academicSubjects);

                                                                    const teacherAuthorizedSubjects = allCurriculumSubjects.filter(subName => {
                                                                        const subNameNorm = normalize(subName);

                                                                        // 1. Check for specific assignment for this grade level (Exact Match requested)
                                                                        if (teacher.assignments && teacher.assignments.length > 0) {
                                                                            const gradeAssignment = teacher.assignments.find(a => normalize(a.gradeLevel) === studentGradeLevelNorm);
                                                                            if (gradeAssignment) {
                                                                                return gradeAssignment.subjects.some(s => normalize(s) === subNameNorm);
                                                                            }
                                                                        }

                                                                        // 2. Fallback: If assignments exist but none match this grade, return false
                                                                        if (teacher.assignments && teacher.assignments.length > 0) {
                                                                            return false;
                                                                        }

                                                                        // 3. Fallback: Rely on general subjects list if no assignments are defined
                                                                        return teacher.subjects.some(s => normalize(s) === subNameNorm);
                                                                    });
                                                                    const studentId = selectedStudent.id;

                                                                    // 1. Matérias que já possuem registros
                                                                    const existingGrades = (grades.filter(g => g.studentId === studentId) || [])
                                                                        .filter(g => teacherAuthorizedSubjects.includes(g.subject))
                                                                        .map(grade => {
                                                                            const calculatedBimesters = {
                                                                                bimester1: calculateBimesterMedia(grade.bimesters.bimester1),
                                                                                bimester2: calculateBimesterMedia(grade.bimesters.bimester2),
                                                                                bimester3: calculateBimesterMedia(grade.bimesters.bimester3),
                                                                                bimester4: calculateBimesterMedia(grade.bimesters.bimester4),
                                                                            };
                                                                            const finalData = calculateFinalData(calculatedBimesters, grade.recuperacaoFinal, isYearFinished);
                                                                            return { ...grade, bimesters: calculatedBimesters, ...finalData };
                                                                        });

                                                                    // 2. Garantir que todas as matérias da matriz apareçam
                                                                    let finalGrades: GradeEntry[] = [...existingGrades];
                                                                    if (teacherAuthorizedSubjects.length > 0) {
                                                                        teacherAuthorizedSubjects.forEach(subjectName => {
                                                                            const exists = existingGrades.some(g => g.subject === subjectName);
                                                                            if (!exists) {
                                                                                const emptyGrade: GradeEntry = {
                                                                                    id: `empty_${subjectName}_${studentId}`,
                                                                                    studentId: studentId,
                                                                                    subject: subjectName,
                                                                                    bimesters: {
                                                                                        bimester1: { nota: null, recuperacao: null, media: -1, faltas: 0 },
                                                                                        bimester2: { nota: null, recuperacao: null, media: -1, faltas: 0 },
                                                                                        bimester3: { nota: null, recuperacao: null, media: -1, faltas: 0 },
                                                                                        bimester4: { nota: null, recuperacao: null, media: -1, faltas: 0 },
                                                                                    },
                                                                                    mediaAnual: 0,
                                                                                    mediaFinal: 0,
                                                                                    situacaoFinal: 'Cursando',
                                                                                    lastUpdated: new Date().toISOString()
                                                                                };
                                                                                finalGrades.push(emptyGrade);
                                                                            }
                                                                        });
                                                                        finalGrades.sort((a, b) => teacherAuthorizedSubjects.indexOf(a.subject) - teacherAuthorizedSubjects.indexOf(b.subject));
                                                                    }

                                                                    // Logic for elapsed bimesters (matching StudentDashboard)
                                                                    const calendarBim = getDynamicBimester(new Date().toLocaleDateString('en-CA'), academicSettings);
                                                                    const maxDataBim = (attendanceRecords || []).reduce((max, record) => {
                                                                        const rYear = parseInt(record.date.split('-')[0], 10);
                                                                        if (rYear !== getCurrentSchoolYear()) return max;
                                                                        if (!record.studentStatus || !record.studentStatus[selectedStudent.id]) return max;
                                                                        const b = getDynamicBimester(record.date, academicSettings);
                                                                        return b > max ? b : max;
                                                                    }, 1);
                                                                    const elapsedBimesters = Math.max(calendarBim, maxDataBim);

                                                                    return (
                                                                        <>
                                                                            {finalGrades.map((grade) => (
                                                                                <tr key={grade.id} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                                                                                    <td className="px-2 py-2 font-bold text-gray-900 border-r border-gray-300 text-[10px] md:text-xs sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top">
                                                                                        <span className="uppercase block leading-tight mb-1">{grade.subject}</span>
                                                                                    </td>
                                                                                    {(() => {
                                                                                        let weeklyClasses = 0;
                                                                                        let foundDynamic = false;

                                                                                        if (academicSubjects && academicSubjects.length > 0) {
                                                                                            const dynamicSubject = academicSubjects.find(s => s.name === grade.subject);
                                                                                            if (dynamicSubject && dynamicSubject.weeklyHours) {
                                                                                                const gradeKey = Object.keys(dynamicSubject.weeklyHours).find(key => selectedStudent.gradeLevel.includes(key));
                                                                                                if (gradeKey) {
                                                                                                    weeklyClasses = dynamicSubject.weeklyHours[gradeKey];
                                                                                                    foundDynamic = true;
                                                                                                }
                                                                                            }
                                                                                        }

                                                                                        if (!foundDynamic) {
                                                                                            let levelKey = '';
                                                                                            if (selectedStudent.gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
                                                                                            else if (selectedStudent.gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
                                                                                            else if (selectedStudent.gradeLevel.includes('Ensino Médio') || selectedStudent.gradeLevel.includes('Ens. Médio') || selectedStudent.gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

                                                                                            weeklyClasses = (CURRICULUM_MATRIX[levelKey] || {})[grade.subject] || 0;
                                                                                        }

                                                                                        const annualWorkload = weeklyClasses * 40;
                                                                                        const currentYear = getCurrentSchoolYear();
                                                                                        const startOfYear = `${currentYear}-01-01`;
                                                                                        const todayStr = new Date().toLocaleDateString('en-CA');
                                                                                        const totalDaysElapsed = calculateSchoolDays(startOfYear, todayStr, calendarEvents);
                                                                                        const ministradaWorkload = Math.round((weeklyClasses / 5) * totalDaysElapsed);

                                                                                        return (
                                                                                            <>
                                                                                                <td className="px-1 py-2 text-center text-gray-400 text-[10px] md:text-xs border-r border-gray-300 w-12 font-medium bg-gray-50/30">
                                                                                                    {annualWorkload > 0 ? `${annualWorkload} h` : '-'}
                                                                                                </td>
                                                                                                <td className="px-1 py-2 text-center text-gray-400 text-[10px] md:text-xs border-r border-gray-300 w-12 font-medium bg-gray-50/30">
                                                                                                    {ministradaWorkload > 0 ? `${ministradaWorkload} h` : '-'}
                                                                                                </td>
                                                                                            </>
                                                                                        );
                                                                                    })()}
                                                                                    {['bimester1', 'bimester2', 'bimester3', 'bimester4'].map((key) => {
                                                                                        const bData = grade.bimesters[key as keyof typeof grade.bimesters];
                                                                                        const bimesterNum = Number(key.replace('bimester', '')) as 1 | 2 | 3 | 4;

                                                                                        const currentAbsences = attendanceRecords.reduce((acc, record) => {
                                                                                            if (record.discipline !== grade.subject) return acc;
                                                                                            if (record.studentStatus[selectedStudent.id] === AttendanceStatus.ABSENT) {
                                                                                                if (getDynamicBimester(record.date, academicSettings) === bimesterNum) {
                                                                                                    const yNum = Number(record.date.split('-')[0]);
                                                                                                    if (yNum === getCurrentSchoolYear()) {
                                                                                                        const individualCount = record.studentAbsenceCount?.[selectedStudent.id];
                                                                                                        return acc + (individualCount !== undefined ? individualCount : (record.lessonCount || 1));
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                            return acc;
                                                                                        }, 0);

                                                                                        return (
                                                                                            <React.Fragment key={key}>
                                                                                                <td className="px-1 py-1 text-center text-gray-500 font-medium text-[10px] md:text-sm border-r border-gray-300 relative w-8 md:w-10">
                                                                                                    {bData.isNotaApproved !== false ? formatGrade(bData.nota) : <span className="text-gray-300 pointer-events-none select-none cursor-help" title="Esta nota está em processo de atualização pela coordenação pedagógica.">-</span>}
                                                                                                    {bData.isNotaApproved === false && (
                                                                                                        <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-yellow-400 rounded-full cursor-help" title="Esta nota está em processo de atualização pela coordenação pedagógica."></div>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="px-1 py-1 text-center text-gray-400 text-[10px] md:text-xs border-r border-gray-300 relative w-8 md:w-10">
                                                                                                    {bData.isRecuperacaoApproved !== false ? formatGrade(bData.recuperacao) : <span className="text-gray-300 pointer-events-none select-none cursor-help" title="Esta nota está em processo de atualização pela coordenação pedagógica.">-</span>}
                                                                                                    {bData.isRecuperacaoApproved === false && (
                                                                                                        <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-yellow-400 rounded-full cursor-help" title="Esta nota está em processo de atualização pela coordenação pedagógica."></div>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="px-1 py-2 text-center text-black font-bold bg-gray-50 border-r border-gray-300 text-xs w-8 md:w-10">{(bData.isNotaApproved !== false && bData.isRecuperacaoApproved !== false) ? formatGrade(bData.media) : '-'}</td>
                                                                                                <td className="px-1 py-1 text-center text-gray-400 text-[10px] md:text-xs border-r border-gray-300 w-8 md:w-10">
                                                                                                    {currentAbsences}
                                                                                                </td>
                                                                                                {(() => {
                                                                                                    let weeklyClasses = 0;
                                                                                                    if (academicSubjects) {
                                                                                                        const ds = academicSubjects.find(s => s.name === grade.subject);
                                                                                                        if (ds?.weeklyHours) {
                                                                                                            const k = Object.keys(ds.weeklyHours).find(key => selectedStudent.gradeLevel.includes(key));
                                                                                                            if (k) weeklyClasses = ds.weeklyHours[k];
                                                                                                        }
                                                                                                    }
                                                                                                    if (weeklyClasses === 0) {
                                                                                                        let lk = selectedStudent.gradeLevel.includes('Fundamental II') ? 'Fundamental II' : selectedStudent.gradeLevel.includes('Ensino Médio') ? 'Ensino Médio' : 'Fundamental I';
                                                                                                        weeklyClasses = (CURRICULUM_MATRIX[lk] || {})[grade.subject] || 0;
                                                                                                    }


                                                                                                    const freqResult = calculateAttendancePercentage(grade.subject, currentAbsences, selectedStudent.gradeLevel, bimesterNum, academicSubjects, academicSettings, calendarEvents, teacher.unit, schedules, selectedStudent.schoolClass);
                                                                                                    const freqPercent = freqResult?.percent ?? null;
                                                                                                    const isFreqEstimated = freqResult?.isEstimated ?? false;
                                                                                                    const isLowFreq = freqPercent !== null && freqPercent < 75;
                                                                                                    const isBimesterStarted = bimesterNum <= elapsedBimesters;

                                                                                                    let bMin = 0;
                                                                                                    if (isBimesterStarted && academicSettings?.bimesters?.find((b: any) => b.number === bimesterNum)) {
                                                                                                        const bSettings = academicSettings.bimesters.find((b: any) => b.number === bimesterNum);
                                                                                                        const bStart = bSettings.startDate;
                                                                                                        const bEnd = bSettings.endDate;
                                                                                                        const today = new Date().toLocaleDateString('en-CA');
                                                                                                        const effectiveEnd = today < bEnd ? today : bEnd;
                                                                                                        const bDays = calculateSchoolDays(bStart, effectiveEnd, calendarEvents);
                                                                                                        bMin = Math.round((weeklyClasses / 5) * bDays);
                                                                                                    } else if (isBimesterStarted) {
                                                                                                        bMin = Math.round((weeklyClasses / 5) * 50);
                                                                                                        const currentBim = getDynamicBimester(new Date().toLocaleDateString('en-CA'), academicSettings);
                                                                                                        if (bimesterNum === currentBim) bMin = Math.round(bMin * 0.5);
                                                                                                    }

                                                                                                    return (
                                                                                                        <>
                                                                                                            <td className={`px-1 py-1 text-center font-bold border-r border-gray-300 text-[10px] md:text-xs w-10 md:w-12 ${isLowFreq ? 'text-red-600 bg-red-50' : 'text-gray-500'}`} title="Frequência">
                                                                                                                {isBimesterStarted ? (
                                                                                                                    <div className="flex flex-col items-center">
                                                                                                                        <span>{freqPercent !== null ? `${freqPercent}%` : '100%'}</span>
                                                                                                                        {isFreqEstimated && <span className="text-[8px] text-amber-600">⚠ Est.</span>}
                                                                                                                    </div>
                                                                                                                ) : '-'}
                                                                                                            </td>
                                                                                                            <td className="px-1 py-1 text-center text-gray-400 text-[10px] md:text-[9px] border-r border-gray-300 w-10 md:w-12 bg-gray-50/50">
                                                                                                                {bMin > 0 ? `${bMin}h` : '-'}
                                                                                                            </td>
                                                                                                        </>
                                                                                                    );
                                                                                                })()}
                                                                                            </React.Fragment>
                                                                                        );
                                                                                    })}
                                                                                    <td className="px-1 py-2 text-center font-bold text-gray-700 border-r border-gray-300 bg-gray-50 text-sm">
                                                                                        {grade.mediaAnual >= 0 ? formatGrade(grade.mediaAnual) : '-'}
                                                                                    </td>
                                                                                    <td className={`px-1 py-1 text-center font-bold text-amber-600 text-[10px] md:text-xs border-r border-gray-300 ${grade.recuperacaoFinalApproved === false ? 'bg-yellow-100' : 'bg-amber-50/30'}`}>
                                                                                        {grade.recuperacaoFinalApproved !== false ? formatGrade(grade.recuperacaoFinal) : <span className="text-gray-300">-</span>}
                                                                                    </td>
                                                                                    <td className="px-1 py-1 text-center font-extrabold text-blue-950 bg-blue-50/50 text-xs md:text-sm border-r border-gray-300">
                                                                                        {grade.mediaFinal >= 0 ? formatGrade(grade.mediaFinal) : '-'}
                                                                                    </td>
                                                                                    {(() => {
                                                                                        const totalAbsences = [1, 2, 3, 4].reduce((sum, bNum) => {
                                                                                            if (bNum > elapsedBimesters) return sum;
                                                                                            return sum + attendanceRecords.reduce((acc, att) => {
                                                                                                if (att.discipline !== grade.subject) return acc;
                                                                                                if (att.studentStatus[selectedStudent.id] === AttendanceStatus.ABSENT) {
                                                                                                    if (getDynamicBimester(att.date, academicSettings) === bNum) {
                                                                                                        const yNum = Number(att.date.split('-')[0]);
                                                                                                        if (yNum === getCurrentSchoolYear()) {
                                                                                                            const individualCount = att.studentAbsenceCount?.[selectedStudent.id];
                                                                                                            return acc + (individualCount !== undefined ? individualCount : (att.lessonCount || 1));
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                                return acc;
                                                                                            }, 0);
                                                                                        }, 0);

                                                                                        let weeklyClasses = 0;
                                                                                        if (academicSubjects) {
                                                                                            const ds = academicSubjects.find(s => s.name === grade.subject);
                                                                                            if (ds?.weeklyHours) {
                                                                                                const k = Object.keys(ds.weeklyHours).find(key => selectedStudent.gradeLevel.includes(key));
                                                                                                if (k) weeklyClasses = ds.weeklyHours[k];
                                                                                            }
                                                                                        }
                                                                                        if (weeklyClasses === 0) {
                                                                                            let lk = selectedStudent.gradeLevel.includes('Fundamental II') ? 'Fundamental II' : selectedStudent.gradeLevel.includes('Ensino Médio') ? 'Ensino Médio' : 'Fundamental I';
                                                                                            weeklyClasses = (CURRICULUM_MATRIX[lk] || {})[grade.subject] || 0;
                                                                                        }

                                                                                        const annualResult = calculateAnnualAttendancePercentage(grade.subject, totalAbsences, selectedStudent.gradeLevel, elapsedBimesters, academicSubjects, academicSettings, calendarEvents, teacher.unit, schedules, selectedStudent.schoolClass);
                                                                                        const annualFreq = annualResult?.percent ?? null;
                                                                                        const isAnnualEstimated = annualResult?.isEstimated ?? false;
                                                                                        const isCritical = annualFreq !== null && annualFreq < 75;


                                                                                        return (
                                                                                            <>
                                                                                                <td className="px-1 py-1 text-center font-bold text-gray-500 border-r border-gray-300 text-xs w-8 md:w-10">
                                                                                                    {totalAbsences}
                                                                                                </td>
                                                                                                <td className={`px-1 py-1 text-center font-bold border-r border-gray-300 text-[10px] md:text-xs w-12 md:w-16 ${isCritical ? 'text-red-600 bg-red-50' : 'text-gray-500'}`} title="Frequência Anual">
                                                                                                    {annualFreq !== null ? (
                                                                                                        <div className="flex flex-col items-center">
                                                                                                            <span>{annualFreq}%</span>
                                                                                                            {isAnnualEstimated && <span className="text-[8px] text-amber-600">⚠</span>}
                                                                                                        </div>
                                                                                                    ) : '-'}
                                                                                                </td>
                                                                                            </>
                                                                                        );
                                                                                    })()}
                                                                                    <td className="px-1 py-2 text-center align-middle">
                                                                                        <span className={`inline-block w-full py-0.5 rounded text-[9px] uppercase font-bold border ${grade.situacaoFinal === 'Aprovado' ? 'bg-blue-50 text-blue-950 border-blue-100' :
                                                                                            grade.situacaoFinal === 'Recuperação' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                                                (grade.situacaoFinal === 'Cursando' || grade.situacaoFinal === 'Pendente') ? 'bg-gray-50 text-gray-500 border-gray-200' :
                                                                                                    'bg-red-50 text-red-700 border-red-200'
                                                                                            }`}>
                                                                                            {grade.situacaoFinal}
                                                                                        </span>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </>
                                                                    );
                                                                })()}
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
                                <h2 className="text-xl font-bold mb-4 text-blue-950 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-950/10 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                                    </div>
                                    Chamada Diária
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 p-4 bg-gray-50 rounded-lg border mb-6">
                                    <div>
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Série/Ano</label>
                                        <select value={attendanceGrade} onChange={e => setAttendanceGrade(e.target.value)} className="w-full p-2 border rounded">
                                            <option value="">Selecione...</option>
                                            {loadingAcademic ? (
                                                <option>Carregando...</option>
                                            ) : (
                                                filteredGrades.map(g => <option key={g.id} value={g.name}>{g.name}</option>)
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Turma</label>
                                        <select value={attendanceClass} onChange={e => setAttendanceClass(e.target.value as SchoolClass)} className="w-full p-2 border rounded">
                                            {SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Turno</label>
                                        <select value={attendanceShift} onChange={e => setAttendanceShift(e.target.value)} className="w-full p-2 border rounded">
                                            <option value="">Todos</option>
                                            {SCHOOL_SHIFTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Nº de Aulas</label>
                                        <select
                                            value={attendanceLessonCount}
                                            onChange={e => setAttendanceLessonCount(Number(e.target.value))}
                                            className="w-full p-2 border rounded font-bold text-blue-900 bg-white"
                                        >
                                            <option value={1}>1 Aula</option>
                                            <option value={2}>2 Aulas</option>
                                            <option value={3}>3 Aulas</option>
                                            <option value={4}>4 Aulas</option>
                                        </select>
                                    </div>


                                    <div>
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Disciplina</label>
                                        <select value={attendanceSubject} onChange={e => setAttendanceSubject(e.target.value)} className="w-full p-2 border rounded">
                                            <option value="">Selecione...</option>
                                            {filteredSubjectsForAttendance.map(subj => <option key={subj} value={subj as string}>{subj as string}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Data</label>
                                        <input
                                            type="date"
                                            value={attendanceDate}
                                            readOnly
                                            className={`w-full p-2 border rounded bg-gray-100 cursor-not-allowed ${scheduleConflict ? 'border-red-500 bg-red-50' : ''}`}
                                        />
                                        <p className="text-[9px] text-gray-500 mt-0.5">Automático (Dia Atual)</p>
                                        {scheduleConflict && attendanceDate && (
                                            <p className="text-[10px] text-red-600 font-bold mt-1 leading-tight animate-pulse">
                                                ⚠️ Disciplina não cadastrada para este dia no calendário oficial.
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col">
                                        <label className="text-sm font-bold text-gray-700 mb-1 block">Bimestre de Visualização</label>
                                        <select
                                            value={selectedFilterBimester}
                                            onChange={e => setSelectedFilterBimester(Number(e.target.value))}
                                            className="w-full p-2 border rounded text-blue-950 font-medium bg-blue-950/10 border-blue-950/20"
                                        >
                                            <option value={1}>1º Bimestre</option>
                                            <option value={2}>2º Bimestre</option>
                                            <option value={3}>3º Bimestre</option>
                                            <option value={4}>4º Bimestre</option>
                                        </select>
                                    </div>

                                    <div className="self-end">
                                        <Button onClick={loadAttendance} className="w-full" disabled={!attendanceGrade || scheduleConflict}>Buscar Turma</Button>
                                    </div>
                                </div>

                                {isAttendanceLoading && <p>Carregando...</p>}

                                {attendanceStudents.length > 0 && (
                                    <div>
                                        {/* VIEW MOBILE/TABLET (CARDS) */}
                                        <div className="lg:hidden space-y-4">
                                            {attendanceStudents.map(student => {
                                                const absences: StudentAbsenceSummary = absenceData[student.id] || {
                                                    bimester: { 1: { count: 0, details: {} }, 2: { count: 0, details: {} }, 3: { count: 0, details: {} }, 4: { count: 0, details: {} } },
                                                    year: 0
                                                };
                                                const status = studentStatuses[student.id];
                                                const bimesterBreakdown = absences.bimester;
                                                const totalAbsences = absences.year;

                                                return (
                                                    <div key={student.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col gap-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h4 className="font-bold text-gray-800">{student.name}</h4>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${student.shift === 'Matutino' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                        {student.shift}
                                                                    </span>
                                                                    {status === AttendanceStatus.PRESENT && <span className="text-[10px] bg-blue-100 text-blue-950 px-2 py-0.5 rounded-full font-bold">PRESENTE</span>}
                                                                    {status === AttendanceStatus.ABSENT && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">FALTOU</span>}
                                                                </div>
                                                                <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                                                                    <div className="text-gray-700">
                                                                        <p>{selectedFilterBimester}º Bimestre: <span className="font-bold text-red-600">{bimesterBreakdown[selectedFilterBimester]?.count || 0} falta(s)</span></p>

                                                                        {bimesterBreakdown[selectedFilterBimester]?.count > 0 && (
                                                                            <div className="mt-1 flex flex-wrap gap-2">
                                                                                {Object.entries(bimesterBreakdown[selectedFilterBimester].details).map(([month, days]) => (
                                                                                    <span key={month} className="text-[10px] bg-red-50 text-red-800 border border-red-100 rounded px-1.5 py-0.5">
                                                                                        <strong>{month}:</strong> {days.map(d => `[${d.day}${d.count > 1 ? ` (${d.count})` : ''}]`).join(' ')}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <p>Total no Ano: <span className="font-bold text-gray-800">{totalAbsences} falta(s)</span></p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2 w-full mt-2">
                                                            <button
                                                                onClick={() => handleStatusChange(student.id, AttendanceStatus.PRESENT)}
                                                                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all duration-200 border ${status === AttendanceStatus.PRESENT
                                                                    ? 'bg-blue-950 text-white border-blue-900 shadow-md transform scale-105'
                                                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                Presente
                                                            </button>
                                                            <div className="flex flex-col gap-1 flex-1">
                                                                <button
                                                                    onClick={() => handleStatusChange(student.id, AttendanceStatus.ABSENT)}
                                                                    className={`w-full py-3 rounded-lg font-bold text-sm transition-all duration-200 border ${status === AttendanceStatus.ABSENT
                                                                        ? 'bg-red-500 text-white border-red-600 shadow-md transform scale-105'
                                                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    Faltou {status === AttendanceStatus.ABSENT && `(${studentAbsenceOverrides[student.id] || attendanceLessonCount})`}
                                                                </button>
                                                                {status === AttendanceStatus.ABSENT && attendanceLessonCount > 1 && (
                                                                    <div className="flex justify-center gap-2 mt-1">
                                                                        {[...Array(attendanceLessonCount)].map((_, i) => (
                                                                            <button
                                                                                key={i}
                                                                                onClick={() => handleIndividualAbsenceChange(student.id, i + 1)}
                                                                                className={`w-8 h-8 rounded-full border text-xs font-bold ${(studentAbsenceOverrides[student.id] || attendanceLessonCount) === (i + 1) ? 'bg-red-600 text-white border-red-700' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
                                                                            >
                                                                                {i + 1}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* VIEW DESKTOP (TABLE) */}
                                        <div className="hidden lg:block bg-white rounded-lg shadow-sm border overflow-x-auto mt-6">
                                            <table className="min-w-[800px] w-full">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aluno</th>
                                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {attendanceStudents.map(student => {
                                                        const absences: StudentAbsenceSummary = absenceData[student.id] || {
                                                            bimester: { 1: { count: 0, details: {} }, 2: { count: 0, details: {} }, 3: { count: 0, details: {} }, 4: { count: 0, details: {} } },
                                                            year: 0
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
                                                                                {bimesterBreakdown[selectedFilterBimester]?.count > 0 && (
                                                                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                                                                        {Object.entries(bimesterBreakdown[selectedFilterBimester].details).map(([month, days]) => (
                                                                                            <span key={month} className="text-[10px] text-gray-500">
                                                                                                <strong className="text-gray-700">{month}:</strong> {days.map(d => `[${d.day}${d.count > 1 ? ` (${d.count})` : ''}]`).join(' ')} <span className="text-gray-300">|</span>
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <span>Total no Ano: <strong className="text-gray-700 font-bold">{absences.year} falta(s)</strong></span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <div className="flex flex-col gap-2 items-center">
                                                                        <div className="inline-flex rounded-md shadow-sm" role="group">
                                                                            <button type="button" onClick={() => handleStatusChange(student.id, AttendanceStatus.PRESENT)} className={`px-4 py-2 text-sm font-medium border rounded-l-lg transition-colors ${studentStatuses[student.id] === AttendanceStatus.PRESENT ? 'bg-blue-950 text-white border-blue-900 z-10' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-100'}`}>Presente</button>
                                                                            <button type="button" onClick={() => handleStatusChange(student.id, AttendanceStatus.ABSENT)} className={`px-4 py-2 text-sm font-medium border rounded-r-lg transition-colors ${studentStatuses[student.id] === AttendanceStatus.ABSENT ? 'bg-red-600 text-white border-red-700 z-10' : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-100'}`}>Faltou {studentStatuses[student.id] === AttendanceStatus.ABSENT && `(${studentAbsenceOverrides[student.id] || attendanceLessonCount})`}</button>
                                                                        </div>
                                                                        {studentStatuses[student.id] === AttendanceStatus.ABSENT && attendanceLessonCount > 1 && (
                                                                            <div className="flex gap-2">
                                                                                {[...Array(attendanceLessonCount)].map((_, i) => (
                                                                                    <button
                                                                                        key={i}
                                                                                        onClick={() => handleIndividualAbsenceChange(student.id, i + 1)}
                                                                                        className={`w-7 h-7 rounded border text-[10px] font-bold transition-colors ${(studentAbsenceOverrides[student.id] || attendanceLessonCount) === (i + 1) ? 'bg-red-100 text-red-700 border-red-300' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}
                                                                                        title={`Marcar ${i + 1} falta(s)`}
                                                                                    >
                                                                                        {i + 1}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="mt-6 text-right flex justify-end gap-3">
                                            {attendanceRecords.some(r => r.id === `${attendanceDate}_${activeUnit}_${attendanceGrade}_${attendanceClass}_${attendanceSubject}`) && (
                                                <Button
                                                    onClick={handleDeleteAttendance}
                                                    disabled={isAttendanceSaving}
                                                    className="bg-red-500 hover:bg-red-600 text-white border-red-700"
                                                >
                                                    {isAttendanceSaving ? 'Processando...' : 'Excluir Chamada'}
                                                </Button>
                                            )}
                                            <Button onClick={handleSaveAttendance} disabled={isAttendanceSaving}>{isAttendanceSaving ? 'Salvando...' : 'Salvar Chamada'}</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'tickets' && (
                        <div className="animate-fade-in-up">
                            <div className="p-6 border rounded-lg shadow-md bg-white">
                                <h2 className="text-xl font-bold mb-6 text-blue-950 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-950/10 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </div>
                                    Dúvidas e Perguntas
                                </h2>

                                {tickets.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                        <span className="text-4xl block mb-2">🎉</span>
                                        <p className="text-gray-500 text-lg">Nenhuma dúvida pendente no momento!</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-6">
                                        {tickets.map(ticket => (
                                            <div key={ticket.id} className={`border rounded-lg p-5 transition-shadow hover:shadow-md ${ticket.status === TicketStatus.PENDING ? 'bg-white border-l-4 border-l-yellow-400 border-gray-200' : 'bg-gray-50 border-gray-200 opacity-80'}`}>
                                                <div className="flex flex-col md:flex-row justify-between mb-4">
                                                    <div className="mb-2 md:mb-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${ticket.status === TicketStatus.PENDING ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                                                {ticket.status === TicketStatus.PENDING ? 'Pendente' : 'Respondido'}
                                                            </span>
                                                            <span className="text-xs text-gray-400">
                                                                {new Date(ticket.timestamp).toLocaleDateString()} às {new Date(ticket.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <h4 className="font-bold text-lg text-gray-900">{ticket.studentName}</h4>
                                                        <p className="text-xs text-gray-600 font-medium bg-gray-100 px-2 py-1 rounded inline-block mt-1">
                                                            {ticket.gradeLevel} - {ticket.schoolClass} | {ticket.subject}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-50 mb-4">
                                                    <p className="text-gray-800 whitespace-pre-wrap">{ticket.message}</p>
                                                </div>

                                                {ticket.response && (
                                                    <div className="bg-green-50 p-4 rounded-lg border border-green-100 mb-4 ml-4">
                                                        <p className="text-xs font-bold text-green-800 mb-1 uppercase tracking-wide">Sua Resposta</p>
                                                        <p className="text-gray-700 whitespace-pre-wrap">{ticket.response}</p>
                                                        <p className="text-[10px] text-gray-400 mt-2 text-right">Enviada em {new Date(ticket.responseTimestamp!).toLocaleDateString()}</p>
                                                    </div>
                                                )}

                                                {ticket.status === TicketStatus.PENDING && (
                                                    <div className="mt-4 border-t border-gray-100 pt-4">
                                                        {replyingTicketId === ticket.id ? (
                                                            <div className="animate-fade-in">
                                                                <label className="block text-sm font-bold text-gray-700 mb-2">Sua Resposta:</label>
                                                                <textarea
                                                                    value={replyText}
                                                                    onChange={(e) => setReplyText(e.target.value)}
                                                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] text-sm mb-3"
                                                                    placeholder="Escreva sua resposta para o aluno..."
                                                                    autoFocus
                                                                />
                                                                <div className="flex justify-end gap-3">
                                                                    <button
                                                                        onClick={() => { setReplyingTicketId(null); setReplyText(''); }}
                                                                        className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-bold transition-colors"
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                    <Button
                                                                        onClick={() => handleReplySubmit(ticket.id)}
                                                                        disabled={!replyText.trim() || isSendingReply}
                                                                        className="px-6 py-2"
                                                                    >
                                                                        {isSendingReply ? 'Enviando...' : 'Enviar Resposta'}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setReplyingTicketId(ticket.id)}
                                                                className="text-blue-600 hover:text-blue-800 font-bold text-sm flex items-center gap-1 transition-colors"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                                                                Responder
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
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
