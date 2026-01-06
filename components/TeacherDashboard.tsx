// src/components/TeacherDashboard.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Teacher, Student, GradeEntry, BimesterData, SchoolUnit, Subject, SchoolClass, AttendanceRecord, AttendanceStatus, EarlyChildhoodReport, CompetencyStatus, Ticket, TicketStatus, AppNotification, ClassMaterial } from '../types';
import { db, storage } from '../firebaseConfig';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

import { getAttendanceBreakdown, AttendanceBreakdown } from '../src/utils/attendanceUtils';
import { getBimesterFromDate, getCurrentSchoolYear } from '../src/utils/academicUtils';
import { calculateBimesterMedia, calculateFinalData, CURRICULUM_MATRIX, getCurriculumSubjects, SCHOOL_GRADES_LIST, SCHOOL_SHIFTS_LIST, SCHOOL_CLASSES_LIST, EARLY_CHILDHOOD_REPORT_TEMPLATE } from '../constants';
import { calculateAttendancePercentage, calculateAnnualAttendancePercentage, calculateGeneralFrequency } from '../utils/frequency';
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
    onSaveEarlyChildhoodReport: (report: EarlyChildhoodReport) => Promise<void>;
    onLogout: () => void;
    notifications?: AppNotification[];
    onMarkNotificationAsRead?: (id: string) => Promise<void>;
}

const formatGrade = (value: number | undefined | null) => {
    return value !== undefined && value !== null && value !== -1 ? value.toFixed(1) : '-';
};

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ teacher, students, grades, attendanceRecords, earlyChildhoodReports, onSaveGrade, onSaveAttendance, onSaveEarlyChildhoodReport, onLogout, notifications = [], onMarkNotificationAsRead }) => {
    const [activeTab, setActiveTab] = useState<'menu' | 'grades' | 'attendance' | 'tickets' | 'materials'>('menu');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const activeUnit = teacher.unit;
    const [filterGrade, setFilterGrade] = useState<string>('');
    const [filterShift, setFilterShift] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');

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

    // Estados para o Sistema de Dúvidas (Tickets)
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [isLoadingTickets, setIsLoadingTickets] = useState(false);
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
    const [uploadedMaterials, setUploadedMaterials] = useState<ClassMaterial[]>([]);
    const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);

    // Estados para Notificações
    const [showNotifications, setShowNotifications] = useState(false);

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
        const currentYear = getCurrentSchoolYear();

        attendanceRecords.forEach(record => {
            // Filter: Only count absences for the currently selected subject
            if (selectedSubject && record.discipline !== selectedSubject) return;

            if (record.studentStatus[selectedStudent.id] === AttendanceStatus.ABSENT) {
                const [y] = record.date.split('-');
                const yNum = Number(y);

                if (yNum === currentYear) {
                    const bimester = getBimesterFromDate(record.date);
                    absences[bimester]++;
                }
            }
        });
        return absences;
    }, [selectedStudent, attendanceRecords, selectedSubject]);

    const filteredStudents = useMemo(() => students.filter(student => {
        const matchesUnit = student.unit === activeUnit;
        const matchesGrade = filterGrade ? student.gradeLevel === filterGrade : true;
        const matchesShift = filterShift ? student.shift === filterShift : true;
        const matchesSearch = searchTerm ? (
            student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.code.toLowerCase().includes(searchTerm.toLowerCase())
        ) : true;
        return matchesUnit && matchesGrade && matchesShift && matchesSearch;
    }), [students, activeUnit, filterGrade, filterShift, searchTerm]);

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

        const finalData = calculateFinalData(sanitizedBimesters, newRecFinal);
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
            studentStatus: studentStatuses
        };

        try {
            await onSaveAttendance(record);

            // 2. TRIGGER: Synchronize Absences to 'Grades' Collection
            // Goal: Immediately reflect "Faltas" in the Grade/Bulletin document without manual "Save Grade"

            const [yearStr] = attendanceDate.split('-');
            const yearNum = Number(yearStr);
            const currentSchoolYear = getCurrentSchoolYear();

            // Determine Bimester
            const targetBimester = getBimesterFromDate(attendanceDate);

            if (targetBimester && yearNum === currentSchoolYear) {
                const bimesterKey = `bimester${targetBimester}` as keyof GradeEntry['bimesters'];

                // Helper to calculate total absences for a specific student/subject/bimester
                // We must use the *updated* record we just created, plus *other* records from the list
                // Since 'attendanceRecords' might be stale, we filter out the OPEN record from 'attendanceRecords' and add our 'record'

                const otherRecords = attendanceRecords.filter(r => r.id !== recordId && r.discipline === attendanceSubject);
                const allRelevantRecords = [...otherRecords, record];

                const updates: Promise<void>[] = [];

                for (const student of attendanceStudents) {
                    // Calculate Total Absences for this Student/Bimester
                    let totalAbsences = 0;

                    allRelevantRecords.forEach(r => {
                        if (r.studentStatus[student.id] === AttendanceStatus.ABSENT) {
                            const [y] = r.date.split('-');
                            const yN = Number(y);
                            if (yN !== currentSchoolYear) return;

                            if (getBimesterFromDate(r.date) === targetBimester) {
                                totalAbsences++;
                            }
                        }
                    });

                    // Find or Create partial Grade Entry
                    const existingGrade = grades.find(g => g.studentId === student.id && g.subject === attendanceSubject);

                    // Construct new bimesters object
                    const baseBimesters = existingGrade?.bimesters || {
                        bimester1: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                        bimester2: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                        bimester3: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                        bimester4: { nota: null, recuperacao: null, media: 0, faltas: 0 }
                    };

                    const currentBimesterData = baseBimesters[bimesterKey];

                    // If the absence count hasn't changed, skip write to save bandwidth? 
                    // No, 'existingGrade.faltas' might be stale. Better to ensure sync.
                    if (currentBimesterData.faltas === totalAbsences) continue;

                    const newBimesterData = { ...currentBimesterData, faltas: totalAbsences };
                    const newBimesters = { ...baseBimesters, [bimesterKey]: newBimesterData };

                    // Recalculate Final Data (Media Annual might not change if only faltas changed, but good to be safe)
                    // Note: calculateFinalData usually inputs bimesters and recuperacaoFinal
                    const finalData = calculateFinalData(newBimesters, existingGrade?.recuperacaoFinal ?? null);

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

    // --- TICKET SYSTEM LOGIC ---
    useEffect(() => {
        loadTickets();
    }, [teacher.unit, teacher.subjects]); // Reloads if teacher unit or subjects change, or on mount

    const loadTickets = async () => {
        setIsLoadingTickets(true);
        try {
            // Fetch tickets for this unit and teacher's subjects
            // Note: Firestore 'in' query supports max 10 values. If teacher has more than 10 subjects, we need to batch or client-side filter.
            // Assuming for now teacher has <= 10 subjects usually. 
            // If empty subjects, don't query.
            if (teacher.subjects.length === 0) {
                setTickets([]);
                return;
            }

            // We filter primarily by Unit
            let query = db.collection('tickets_pedagogicos')
                .where('unit', '==', teacher.unit);

            // Client side filtering for subjects might be safer if list is long
            const snapshot = await query.get();
            const allUnitTickets = snapshot.docs.map(doc => doc.data() as Ticket);

            // Filter by teacher subjects
            const relevantTickets = allUnitTickets.filter(t => teacher.subjects.includes(t.subject as any));

            // Sort: Pending first, then by date (newest first)
            const sorted = relevantTickets.sort((a, b) => {
                if (a.status === TicketStatus.PENDING && b.status !== TicketStatus.PENDING) return -1;
                if (a.status !== TicketStatus.PENDING && b.status === TicketStatus.PENDING) return 1;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });

            setTickets(sorted);
        } catch (error) {
            console.error("Erro ao carregar tickets:", error);
        } finally {
            setIsLoadingTickets(false);
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

            // Update local state
            setTickets(prev => prev.map(t =>
                t.id === ticketId
                    ? { ...t, response: replyText, responseTimestamp: timestamp, status: TicketStatus.ANSWERED, responderName: teacher.name }
                    : t
            ));

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

    // --- MATERIALS LOGIC ---
    // Load Materials on Tab Switch or Mount
    useEffect(() => {
        if (activeTab === 'materials') {
            loadMaterials();
        }
    }, [activeTab]);

    const loadMaterials = async () => {
        setIsLoadingMaterials(true);
        try {
            const snapshot = await db.collection('materials')
                .where('teacherId', '==', teacher.id)
                .get();
            const mats = snapshot.docs.map(doc => doc.data() as ClassMaterial);
            // Sort by date desc
            mats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setUploadedMaterials(mats);
        } catch (error) {
            console.error("Erro ao carregar materiais:", error);
        } finally {
            setIsLoadingMaterials(false);
        }
    };

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
            loadMaterials();

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

            setUploadedMaterials(prev => prev.filter(m => m.id !== material.id));
            alert("Material removido.");
        } catch (error) {
            console.error("Erro ao deletar material:", error);
            alert("Erro ao deletar material.");
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
                                        {notifications.length > 0 ? (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}
                                                    onClick={() => {
                                                        if (!n.read && onMarkNotificationAsRead) onMarkNotificationAsRead(n.id);

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
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="h-9 w-auto">
                                        <SchoolLogo className="!h-full w-auto drop-shadow-sm" />
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <span className="text-[10px] text-blue-950 font-bold uppercase tracking-widest leading-none mb-0">Aplicativo</span>
                                        <h1 className="text-lg font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                                        <span className="text-[10px] text-blue-950/60 font-semibold uppercase tracking-wider leading-none mt-1.5">Portal do Professor</span>
                                    </div>
                                </div>
                                <div className="text-left pb-4">
                                    <p className="text-gray-500 text-sm">Selecione uma opção para gerenciar suas atividades.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setActiveTab('grades')}
                                        className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Lançar Notas</h3>
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('attendance')}
                                        className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-green-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-100 transition-colors">
                                            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Chamada Diária</h3>
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('tickets')}
                                        className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-yellow-500 hover:shadow-md transition-all group aspect-square relative"
                                    >
                                        <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-yellow-100 transition-colors">
                                            <svg className="w-7 h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Dúvidas dos Alunos</h3>
                                        {pendingTicketsCount > 0 && (
                                            <span className="absolute top-2 right-2 bg-red-500 text-white rounded-full px-2 py-0.5 text-xs font-bold animate-pulse">
                                                {pendingTicketsCount}
                                            </span>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => setActiveTab('materials')}
                                        className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-purple-500 hover:shadow-md transition-all group aspect-square"
                                    >
                                        <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-100 transition-colors">
                                            <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm text-center">Materiais de Aula</h3>
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
                                    <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
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
                                            {teacherSubjects.map(subject => (<option key={subject} value={subject as string}>{subject as string}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Série</label>
                                        <select value={materialGrade} onChange={(e) => setMaterialGrade(e.target.value)} className="w-full p-2 border border-gray-300 rounded bg-white" required>
                                            <option value="">Selecione...</option>
                                            {SCHOOL_GRADES_LIST.map((grade) => (<option key={grade} value={grade}>{grade}</option>))}
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
                                    {isLoadingMaterials ? (
                                        <div className="text-center py-10 text-gray-500">Carregando...</div>
                                    ) : uploadedMaterials.length > 0 ? (
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
                                        {SCHOOL_GRADES_LIST.map((grade) => (<option key={grade} value={grade}>{grade}</option>))}
                                    </select>
                                    <select value={filterShift} onChange={e => setFilterShift(e.target.value)} className="w-full text-sm p-2 border border-gray-300 rounded focus:ring-blue-950 focus:border-blue-950">
                                        <option value="">Todos os Turnos</option>
                                        {SCHOOL_SHIFTS_LIST.map((shift) => (<option key={shift} value={shift}>{shift}</option>))}
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
                                                <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center mr-3">
                                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
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
                                                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center mr-3">
                                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                                    </div>
                                                    Lançamento de Notas
                                                </h2>
                                                {selectedStudent && (
                                                    <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 animate-fade-in">
                                                        <span className="text-blue-400">👤</span>
                                                        {selectedStudent.name}
                                                        <span className="text-xs font-normal text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded ml-1">#{selectedStudent.code}</span>
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
                                                                    {[1, 2, 3, 4].map(num => (<th key={num} colSpan={5} className="px-1 py-2 text-center font-bold text-gray-700 uppercase tracking-wider border-l border-r border-gray-300">{num}º BIM</th>))}
                                                                    <th rowSpan={2} className="px-1 py-2 text-center font-bold text-gray-700 uppercase tracking-wider border-l border-r border-gray-300">Média<br />Anual</th>
                                                                    <th rowSpan={2} className="px-1 py-2 text-center font-bold text-amber-700 uppercase tracking-wider border-r border-gray-300 bg-amber-50">Prova<br />Final</th>
                                                                    <th rowSpan={2} className="px-1 py-2 text-center font-bold text-blue-900 uppercase tracking-wider border-r border-gray-300 bg-blue-50">Média<br />Final</th>
                                                                    <th rowSpan={2} className="px-1 py-2 text-center font-bold text-gray-700 uppercase tracking-wider border-r border-gray-300">%<br />Tot</th>
                                                                    <th rowSpan={2} className="px-1 py-2 text-center font-bold text-gray-700 uppercase tracking-wider">Situação</th>
                                                                </tr>
                                                                <tr className="bg-blue-50 text-[10px]">
                                                                    {[1, 2, 3, 4].map(num => (
                                                                        <React.Fragment key={num}>
                                                                            <th className="px-1 py-1 text-center font-semibold text-gray-600 border-r border-gray-300" title={`Nota ${num}º Bimestre`}>N{num}</th>
                                                                            <th className="px-1 py-1 text-center font-semibold text-gray-600 border-r border-gray-300" title={`Recuperação ${num}º Bimestre`}>R{num}</th>
                                                                            <th className="px-1 py-1 text-center font-bold text-blue-950 bg-blue-50 border-r border-gray-300" title={`Média ${num}º Bimestre`}>M{num}</th>
                                                                            <th className="px-1 py-1 text-center font-semibold text-gray-600 border-r border-gray-300" title={`Faltas ${num}º Bimestre`}>F{num}</th>
                                                                            <th className="px-1 py-1 text-center font-semibold text-gray-600 border-r border-gray-300" title={`Frequência ${num}º Bimestre`}>%</th>
                                                                        </React.Fragment>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white divide-y divide-gray-200">
                                                                {(() => {
                                                                    const subjectsInCurriculum = getCurriculumSubjects(selectedStudent.gradeLevel || "");
                                                                    const studentId = selectedStudent.id;

                                                                    // 1. Matérias que já possuem registros
                                                                    const existingGrades = (grades.filter(g => g.studentId === studentId) || [])
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

                                                                    // 2. Garantir que todas as matérias da matriz apareçam
                                                                    let finalGrades: GradeEntry[] = [...existingGrades];
                                                                    if (subjectsInCurriculum.length > 0) {
                                                                        subjectsInCurriculum.forEach(subjectName => {
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
                                                                        finalGrades.sort((a, b) => subjectsInCurriculum.indexOf(a.subject) - subjectsInCurriculum.indexOf(b.subject));
                                                                    }

                                                                    const generalFreq = calculateGeneralFrequency(finalGrades, attendanceRecords, selectedStudent.id, selectedStudent.gradeLevel || "");

                                                                    return (
                                                                        <>
                                                                            {finalGrades.map((grade) => (
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

                                                                                                if (yNum === getCurrentSchoolYear()) {
                                                                                                    // Explicit check against bimesterNum (1,2,3,4)
                                                                                                    if (getBimesterFromDate(record.date) === bimesterNum) return acc + 1;



                                                                                                }
                                                                                            }
                                                                                            return acc;
                                                                                        }, 0);

                                                                                        return (
                                                                                            <React.Fragment key={key}>
                                                                                                <td className="px-1 py-2 text-center text-gray-600 text-xs border-r border-gray-300">{formatGrade(bData.nota)}</td>
                                                                                                <td className="px-1 py-2 text-center text-gray-600 text-xs border-r border-gray-300">{formatGrade(bData.recuperacao)}</td>
                                                                                                <td className="px-1 py-2 text-center text-black font-bold bg-gray-50 border-r border-gray-300 text-xs">{formatGrade(bData.media)}</td>
                                                                                                <td className="px-1 py-2 text-center text-gray-500 text-xs border-r border-gray-300">
                                                                                                    {currentStudentAbsences || 0}
                                                                                                </td>
                                                                                                {(() => {
                                                                                                    const absences = currentStudentAbsences;
                                                                                                    const freqPercent = calculateAttendancePercentage(grade.subject, absences, selectedStudent?.gradeLevel || "");

                                                                                                    // Só exibe a porcentagem se houver pelo menos uma falta
                                                                                                    const hasAbsence = absences > 0;
                                                                                                    const isLowFreq = hasAbsence && freqPercent !== null && freqPercent < 75;

                                                                                                    return (
                                                                                                        <td className={`px-1 py-2 text-center font-bold border-r border-gray-300 text-[10px] md:text-xs ${isLowFreq ? 'text-red-600 bg-red-50' : 'text-gray-500'}`} title="Frequência">
                                                                                                            {hasAbsence && freqPercent !== null ? `${freqPercent}%` : '-'}
                                                                                                        </td>
                                                                                                    );
                                                                                                })()}
                                                                                            </React.Fragment>
                                                                                        );
                                                                                    })}
                                                                                    <td className="px-1 py-2 text-center font-bold text-gray-700 border-r border-gray-300 bg-gray-50 text-sm">{formatGrade(grade.mediaAnual)}</td>
                                                                                    <td className="px-1 py-2 text-center font-bold text-amber-600 bg-amber-50/30 text-sm border-r border-gray-300">{formatGrade(grade.recuperacaoFinal)}</td>
                                                                                    <td className="px-1 py-2 text-center font-extrabold text-blue-950 bg-blue-50 text-sm border-r border-gray-300">{formatGrade(grade.mediaFinal)}</td>
                                                                                    {(() => {
                                                                                        const totalAbsences = [grade.bimesters.bimester1, grade.bimesters.bimester2, grade.bimesters.bimester3, grade.bimesters.bimester4].reduce((sum, b, idx) => {
                                                                                            const bNum = (idx + 1) as 1 | 2 | 3 | 4;
                                                                                            if (false) return sum;

                                                                                            const studentAbsSnapshot = attendanceRecords.filter(att =>
                                                                                                att.discipline === grade.subject &&
                                                                                                att.studentStatus[selectedStudent.id] === AttendanceStatus.ABSENT
                                                                                            ).filter(att => {
                                                                                                const d = new Date(att.date + 'T00:00:00');
                                                                                                const m = d.getMonth() + 1;
                                                                                                if (getBimesterFromDate(att.date) === bNum && parseInt(att.date.split('-')[0], 10) === getCurrentSchoolYear()) return true;



                                                                                                return false;
                                                                                            }).length;

                                                                                            return sum + studentAbsSnapshot;
                                                                                        }, 0);

                                                                                        const annualFreq = calculateAnnualAttendancePercentage(grade.subject, totalAbsences, selectedStudent.gradeLevel || "");
                                                                                        const isCritical = annualFreq !== null && annualFreq < 75;
                                                                                        const hasAbsenceTotal = totalAbsences > 0;

                                                                                        return (
                                                                                            <td className={`px-1 py-2 text-center font-bold border-r border-gray-300 text-[10px] md:text-xs ${isCritical ? 'text-red-600 bg-red-50' : 'text-gray-500'}`} title="Frequência Anual">
                                                                                                {hasAbsenceTotal && annualFreq !== null ? `${annualFreq}%` : '-'}
                                                                                            </td>
                                                                                        );
                                                                                    })()}
                                                                                    <td className="px-1 py-2 text-center align-middle">
                                                                                        <span className={`inline-block w-full py-0.5 rounded text-[9px] uppercase font-bold border ${grade.situacaoFinal === 'Aprovado' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                                            grade.situacaoFinal === 'Recuperação' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                                                (grade.situacaoFinal === 'Cursando' || grade.situacaoFinal === 'Pendente') ? 'bg-gray-50 text-gray-500 border-gray-200' :
                                                                                                    'bg-red-50 text-red-700 border-red-200'
                                                                                            }`}>
                                                                                            {grade.situacaoFinal}
                                                                                        </span>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                            {/* Summary Row */}
                                                                            <tr className="bg-gray-100/80 font-bold border-t-2 border-gray-400">
                                                                                <td colSpan={24} className="px-4 py-2 text-right uppercase tracking-wider text-blue-950 font-extrabold text-[11px]">
                                                                                    FREQUÊNCIA GERAL NO ANO LETIVO:
                                                                                </td>
                                                                                <td className="px-1 py-1 text-center text-blue-900 font-extrabold text-[11px] md:text-sm bg-blue-50/50 border-r border-gray-300">
                                                                                    {generalFreq}
                                                                                </td>
                                                                                <td className="bg-gray-100/50"></td>
                                                                            </tr>
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
                                    <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                                    </div>
                                    Chamada Diária
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg border mb-6">
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
                                                                    {status === AttendanceStatus.PRESENT && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">PRESENTE</span>}
                                                                    {status === AttendanceStatus.ABSENT && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">FALTOU</span>}
                                                                </div>
                                                                <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                                                                    <div className="text-gray-700">
                                                                        <p>{selectedFilterBimester}º Bimestre: <span className="font-bold text-red-600">{bimesterBreakdown[selectedFilterBimester]?.count || 0} falta(s)</span></p>

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
                                                                                                <strong className="text-gray-700">{month}:</strong> {days.map(d => `[${d}]`).join(' ')} <span className="text-gray-300">|</span>
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
                    {activeTab === 'tickets' && (
                        <div className="animate-fade-in-up">
                            <div className="p-6 border rounded-lg shadow-md bg-white">
                                <h2 className="text-xl font-bold mb-6 text-blue-950 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-yellow-50 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </div>
                                    Dúvidas e Perguntas
                                </h2>

                                {isLoadingTickets ? (
                                    <TableSkeleton rows={5} />
                                ) : tickets.length === 0 ? (
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
