import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db, storage } from '../firebaseConfig';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';
import { X, Download, AlertCircle, Calendar, FileText, Plus, Trash2, Paperclip, CheckCircle } from 'lucide-react';
import { useAcademicData } from '../hooks/useAcademicData';

import { 
    AttendanceRecord, 
    Student, 
    GradeEntry, 
    SchoolUnit, 
    SchoolShift, 
    AttendanceStatus, 
    AcademicSettings,
    CalendarEvent,
    UNIT_LABELS,
    SHIFT_LABELS,
    EarlyChildhoodReport,
    CompetencyStatus,
    StudentLicense
} from '../types';

import { 
    normalizeClass, 
    parseGradeLevel, 
    getDynamicBimester,
    isClassScheduled,
    getSubjectDurationForDay
} from '../utils/academicUtils';

import { 
    UNITS_DATA,
    DEFAULT_UNIT_DATA,
    calculateBimesterMedia, 
    calculateFinalData, 
    getCurriculumSubjects 
} from '../constants';

import { getAcademicSettings } from '../services/academicSettings';

import { 
    calculateAttendancePercentage, 
    calculateTaughtClasses,
    calculateAnnualAttendancePercentage,
    calculateGeneralFrequency
} from '../utils/frequency';

interface CoordinatorStudentReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student | null;
    academicSettings: any;
    calendarEvents: CalendarEvent[];
    earlyChildhoodReports?: EarlyChildhoodReport[];
}

export const CoordinatorStudentReportModal: React.FC<CoordinatorStudentReportModalProps> = ({
    isOpen,
    onClose,
    student,
    academicSettings,
    calendarEvents,
    earlyChildhoodReports = []
}) => {
    const { subjects: academicSubjects, matrices, grades: allGrades, schedules: classSchedules } = useAcademicData();

    const [rawGrades, setRawGrades] = useState<GradeEntry[]>([]);
    const [studentAttendance, setStudentAttendance] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [localAcademicSettings, setLocalAcademicSettings] = useState<AcademicSettings | null>(null);
    const [selectedSemesterModal, setSelectedSemesterModal] = useState<1 | 2>(1);

    // NOVO: Estado das Licenças por Período (Abordagem A)
    const [studentLicenses, setStudentLicenses] = useState<StudentLicense[]>([]);
    const [showLicenseModal, setShowLicenseModal] = useState(false);

    const LICENSE_REASONS = [
        'Atestado Médico',
        'Acompanhamento Médico / Consulta',
        'Representação Escolar / Olimpíada / Esporte',
        'Motivos Familiares / Luto',
        'Casos Fortuitos (Chuva / Trânsito / Força Maior)',
        'Outros'
    ];

    // Use prop if valid (has bimesters), otherwise fall back to locally fetched settings
    const effectiveSettings = (academicSettings?.bimesters?.length > 0) ? academicSettings : localAcademicSettings;

    const currentYear = new Date().getFullYear();
    const isYearFinished = useMemo(() => {
        if (!effectiveSettings?.bimesters) return false;
        const b4 = effectiveSettings.bimesters.find((b: any) => b.number === 4);
        if (!b4) return false;
        const today = new Date().toLocaleDateString('en-CA');
        return today > b4.endDate;
    }, [effectiveSettings]);

    const isEarlyChildhood = student?.gradeLevel?.toLowerCase().includes('infantil');
    const headerText = isEarlyChildhood ? 'RELATÓRIO DE DESENVOLVIMENTO' : 'BOLETIM ESCOLAR 2026';

    const today = new Date().toLocaleDateString('en-CA');

    const isBimStarted = (bimNum: 1|2|3|4) => {
        if (!effectiveSettings?.bimesters) return false;
        const b = effectiveSettings.bimesters.find((bc: any) => bc.number === bimNum);
        return b ? today >= b.startDate : false;
    };

    // SYNC FIX: Dynamic detection of elapsed bimesters matching StudentDashboard.tsx
    const elapsedBimesters = useMemo(() => {
        if (!effectiveSettings) return 1;
        const calendarBim = getDynamicBimester(today, effectiveSettings);
        const maxDataBim = (studentAttendance || []).reduce((max, record) => {
            if (!record?.studentStatus || !record.studentStatus[student!.id]) return max;
            const b = getDynamicBimester(record.date, effectiveSettings);
            return b > max ? b : max;
        }, 1);
        return Math.max(calendarBim, maxDataBim);
    }, [studentAttendance, effectiveSettings, student, today]);

    useEffect(() => {
        if (!isOpen || !student) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const gradesSnap = await db.collection('grades')
                    .where('studentId', '==', student.id)
                    .get();
                const gradesData = gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GradeEntry));
                setRawGrades(gradesData);

                const historyUnits = (student.enrollmentHistory || []).map((h: any) => h.unit).filter(Boolean);
                const queryUnits = Array.from(new Set([student.unit, ...historyUnits]));

                const attSnap = await db.collection('attendance')
                    .where('unit', 'in', queryUnits)
                    .get();
                
                const attData = attSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
                // Filter in memory by student presence in studentStatus (matches App.tsx student logic)
                const studentAtt = attData.filter(att => 
                    att.studentStatus && att.studentStatus[student.id] !== undefined
                );
                setStudentAttendance(studentAtt);

                // Fetch real effectiveSettings if prop is missing/null
                if (!academicSettings?.bimesters?.length) {
                    const fetchedSettings = await getAcademicSettings(2026, student.unit);
                    setLocalAcademicSettings(fetchedSettings);
                }

            } catch (error) {
                console.error('Error fetching student data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isOpen, student]);

    // NOVO: Carregar e escutar licenças do aluno em tempo real (Abordagem A)
    useEffect(() => {
        if (!isOpen || !student) { setStudentLicenses([]); return; }
        const unsubscribe = db.collection('studentLicenses')
            .where('studentId', '==', student.id)
            .onSnapshot(snap => {
                const licenses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentLicense));
                setStudentLicenses(licenses.sort((a, b) => b.startDate.localeCompare(a.startDate)));
            }, err => console.error('Erro ao carregar licenças:', err));
        return () => unsubscribe();
    }, [isOpen, student]);

    // NOVO: Excluir licença e seu comprovante
    const handleDeleteLicense = async (licenseId: string) => {
        if (!window.confirm('Excluir esta licença? O abono será removido retroativamente dos cálculos de frequência.')) return;
        try {
            // Busca o documento para verificar se há comprovante associado
            const docSnap = await db.collection('studentLicenses').doc(licenseId).get();
            if (docSnap.exists) {
                const licenseData = docSnap.data() as StudentLicense;
                if (licenseData.attachmentUrl) {
                    try {
                        const fileRef = storage.refFromURL(licenseData.attachmentUrl);
                        await fileRef.delete();
                    } catch (storageErr) {
                        console.error('Erro ao remover arquivo do Firebase Storage:', storageErr);
                    }
                }
            }
            await db.collection('studentLicenses').doc(licenseId).delete();
        } catch (err) {
            console.error('Erro ao excluir licença:', err);
        }
    };

    const handleDownloadPDF = () => {
        window.print();
    };

    const getUnitLabel = (unitId: string): string => {
        return UNIT_LABELS[unitId as SchoolUnit] || unitId;
    };

    const formatGrade = (val: number | undefined | null) => typeof val === 'number' && val >= 0 ? val.toFixed(1) : '-';
    const formatWorkload = (val: number) => val % 1 === 0 ? val + 'h' : val.toFixed(1) + 'h';

    // CANONICAL SYNC LOGIC (Matches StudentDashboard.tsx)
    const studentGrades = useMemo(() => {
        if (!student) return [];
        
        const studentGradeObj = allGrades.find(g => g.name === student.gradeLevel);
        const gradeIdToUse = studentGradeObj ? studentGradeObj.id : student.gradeLevel;

        // SYNC FIX: Strict matrix lookup matching StudentDashboard.tsx logic
        let initialMatrixSubjects: string[] = [];
        const currentYear = new Date().getFullYear().toString();
        
        if (matrices) {
            const matchingMatrix = matrices.find(m =>
                (m.unit === student.unit || m.unit === 'all') &&
                (m.shift === student.shift || m.shift === 'all') &&
                (m.gradeId === gradeIdToUse || m.gradeId === student.gradeLevel || student.gradeLevel.includes(m.gradeId)) &&
                (m.id.includes(currentYear) || m.id.includes('2026'))
            );
            if (matchingMatrix) {
                initialMatrixSubjects = matchingMatrix.subjects.map(s => s.id);
            }
        }

        // Fallback if no matrix found
        if (initialMatrixSubjects.length === 0) {
            initialMatrixSubjects = getCurriculumSubjects(gradeIdToUse, academicSubjects, matrices, student.unit, student.shift, student.gradeLevel);
        }
        
        const matrixSubjects = [...initialMatrixSubjects];

        if (classSchedules && classSchedules.length > 0) {
            const sGrade = parseGradeLevel(student.gradeLevel).grade;
            const sClass = normalizeClass(student.schoolClass);

            classSchedules.forEach(sch => {
                // SYNC FIX: Must check unit (schoolId) because useAcademicData returns all schedules
                if (sch.schoolId !== student.unit) return;

                const schGrade = parseGradeLevel(sch.grade).grade;
                const schClass = normalizeClass(sch.class);

                if (schGrade === sGrade && schClass === sClass && sch.items) {

                    sch.items.forEach((item: any) => {
                        if (item.subject) {
                            const subObj = academicSubjects.find(s => s.id === item.subject);
                            const subjectId = subObj ? subObj.id : item.subject;
                            if (subjectId && !matrixSubjects.includes(subjectId)) {
                                matrixSubjects.push(subjectId);
                            }
                        }
                    });
                }
            });
        }

        const rawGradesArray = (rawGrades || []).filter(g => g.studentId === student.id);
        const mergedGradesMap = new Map<string, GradeEntry>();

        rawGradesArray.forEach(g => {
            const subjectId = g.subject;
            const existing = mergedGradesMap.get(subjectId);

            if (!existing) {
                mergedGradesMap.set(subjectId, { ...g, subject: subjectId });
            } else {
                const mergedBimesters = { ...existing.bimesters };
                ['bimester1', 'bimester2', 'bimester3', 'bimester4'].forEach(bKey => {
                    const key = bKey as keyof typeof existing.bimesters;
                    const val1 = existing.bimesters[key];
                    const val2 = g.bimesters[key as keyof typeof g.bimesters];

                    if (val2 && (val2.nota !== null || val2.recuperacao !== null || val2.faltas > 0)) {
                        if (!val1 || val1.nota === null) {
                            mergedBimesters[key] = val2 as any;
                        } else {
                            mergedBimesters[key] = {
                                ...val1,
                                nota: val2.nota ?? val1.nota,
                                recuperacao: val2.recuperacao ?? val1.recuperacao,
                                faltas: Math.max(val1.faltas, val2.faltas),
                                isNotaApproved: val2.isNotaApproved ?? val1.isNotaApproved,
                                isRecuperacaoApproved: val2.isRecuperacaoApproved ?? val1.isRecuperacaoApproved
                            } as any;
                        }
                    }
                });

                mergedGradesMap.set(subjectId, {
                    ...existing,
                    bimesters: mergedBimesters,
                    recuperacaoFinal: g.recuperacaoFinal ?? existing.recuperacaoFinal,
                    lastUpdated: g.lastUpdated > existing.lastUpdated ? g.lastUpdated : existing.lastUpdated
                });
            }
        });

        const existingGrades = Array.from(mergedGradesMap.values())
            .filter(g => matrixSubjects.length === 0 || matrixSubjects.includes(g.subject))
            .map(grade => {
                // Real-time attendance sync from studentAttendance records
                const bimFaltas = { bimester1: 0, bimester2: 0, bimester3: 0, bimester4: 0 };
                
                if (studentAttendance && studentAttendance.length > 0 && effectiveSettings?.bimesters) {
                    studentAttendance.forEach(att => {
                        if (att.discipline === grade.subject) {
                            const bimester = effectiveSettings.bimesters.find((b: any) => 
                                att.date >= b.startDate && att.date <= b.endDate
                            );
                            if (bimester) {
                                const bKey = `bimester${bimester.number}` as keyof typeof bimFaltas;
                                const status = att.studentStatus?.[student.id];
                                if (status === 'Faltou') {
                                    bimFaltas[bKey] += 1;
                                }
                            }
                        }
                    });
                }

                const calculatedBimesters = {
                    bimester1: calculateBimesterMedia({ ...grade.bimesters.bimester1, faltas: Math.max(grade.bimesters.bimester1.faltas || 0, bimFaltas.bimester1) }),
                    bimester2: calculateBimesterMedia({ ...grade.bimesters.bimester2, faltas: Math.max(grade.bimesters.bimester2.faltas || 0, bimFaltas.bimester2) }),
                    bimester3: calculateBimesterMedia({ ...grade.bimesters.bimester3, faltas: Math.max(grade.bimesters.bimester3.faltas || 0, bimFaltas.bimester3) }),
                    bimester4: calculateBimesterMedia({ ...grade.bimesters.bimester4, faltas: Math.max(grade.bimesters.bimester4.faltas || 0, bimFaltas.bimester4) }),
                };
                const finalData = calculateFinalData(calculatedBimesters, grade.recuperacaoFinal, isYearFinished);
                return { ...grade, bimesters: calculatedBimesters, ...finalData };
            });

        if (matrixSubjects.length > 0) {
            const finalGrades: GradeEntry[] = [...existingGrades];
            matrixSubjects.forEach((subjectId) => {
                const exists = existingGrades.some(g => g.subject === subjectId);
                if (!exists) {
                    const bimFaltas = { bimester1: 0, bimester2: 0, bimester3: 0, bimester4: 0 };
                    if (studentAttendance && studentAttendance.length > 0 && effectiveSettings?.bimesters) {
                        studentAttendance.forEach(att => {
                            if (att.discipline === subjectId) {
                                const bimester = effectiveSettings.bimesters.find((b: any) => 
                                    att.date >= b.startDate && att.date <= b.endDate
                                );
                                if (bimester) {
                                    const bKey = `bimester${bimester.number}` as keyof typeof bimFaltas;
                                    const status = att.studentStatus?.[student.id];
                                    if (status === 'Faltou') {
                                        bimFaltas[bKey] += 1;
                                    }
                                }
                            }
                        });
                    }

                    const emptyGradesBimesters = {
                        bimester1: { nota: null, recuperacao: null, media: -1, faltas: bimFaltas.bimester1 },
                        bimester2: { nota: null, recuperacao: null, media: -1, faltas: bimFaltas.bimester2 },
                        bimester3: { nota: null, recuperacao: null, media: -1, faltas: bimFaltas.bimester3 },
                        bimester4: { nota: null, recuperacao: null, media: -1, faltas: bimFaltas.bimester4 },
                    };
                    const finalData = calculateFinalData(emptyGradesBimesters, null, isYearFinished);
                    finalGrades.push({
                        id: `empty_${subjectId}_${student.id}`,
                        studentId: student.id,
                        subject: subjectId,
                        bimesters: emptyGradesBimesters,
                        ...finalData,
                        lastUpdated: new Date().toISOString()
                    } as GradeEntry);
                }
            });

            return finalGrades.sort((a, b) => matrixSubjects.indexOf(a.subject) - matrixSubjects.indexOf(b.subject));
        }

        return existingGrades;
    }, [student, rawGrades, academicSubjects, matrices, effectiveSettings, isYearFinished, classSchedules, allGrades]);

    const filteredStudentGrades = useMemo(() => {
        if (!student || !classSchedules || classSchedules.length === 0) return studentGrades;

        const validSubjects = new Set<string>();
        const sGrade = parseGradeLevel(student.gradeLevel).grade;
        const sClass = normalizeClass(student.schoolClass);

        let hasScheduleForClass = false;
        classSchedules.forEach(sch => {
            // SYNC FIX: Filter by unit as useAcademicData provides global schedules
            if (sch.schoolId !== student.unit) return;

            const schGrade = parseGradeLevel(sch.grade).grade;
            const schClass = normalizeClass(sch.class);
            if (schGrade === sGrade && schClass === sClass && sch.items && sch.items.length > 0) {
                hasScheduleForClass = true;

                sch.items.forEach((item: any) => {
                    if (item.subject) {
                        const subObj = academicSubjects.find(s => s.id === item.subject || s.name === item.subject);
                        validSubjects.add(subObj ? subObj.id : item.subject);
                    }
                });
            }
        });

        return studentGrades.filter(g => {
            const subjectObj = academicSubjects?.find(s => s.id === g.subject);
            const subjectName = subjectObj ? subjectObj.name.toLowerCase() : g.subject.toLowerCase();
            if (subjectName.includes('intervalo') || subjectName.includes('break')) return false;
            return hasScheduleForClass ? validSubjects.has(g.subject) : true;
        });
    }, [studentGrades, classSchedules, student, academicSubjects]);

    if (!isOpen || !student) return null;

    return (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:p-0 print:bg-white print:static print:block backdrop-blur-sm overflow-y-auto coordinator-report-modal-backdrop">
            <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-7xl max-h-[90vh] flex flex-col relative print:w-full print:max-w-none print:shadow-none print:max-h-none print:overflow-visible my-auto animate-fade-in-up coordinator-report-modal-content">
                
                {/* Actions Bar */}
                <div className="flex justify-between items-center p-4 border-b border-gray-100 print:hidden sticky top-0 bg-white z-50 rounded-t-xl shadow-sm">
                    <button
                        onClick={() => setShowLicenseModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold rounded-lg border border-orange-300 transition-all active:scale-95 text-sm"
                    >
                        <Calendar className="w-4 h-4" />
                        Gerenciar Licenças
                        {studentLicenses.length > 0 && (
                            <span className="bg-orange-600 text-white text-xs font-black rounded-full px-1.5 py-0.5 leading-none">{studentLicenses.length}</span>
                        )}
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                <div className="overflow-y-auto p-2 md:p-8 print:p-0 bg-gray-50 print:bg-white flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <div className="w-8 h-8 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
                            <p className="mt-4 text-gray-500 font-medium">Carregando dados...</p>
                        </div>
                    ) : (
                        <div className="animate-fade-in-up">
                            <style>{`
                                @media print {
                                    @page { size: ${isEarlyChildhood ? 'portrait' : 'landscape'}; margin: 8mm; }
                                    
                                    /* 1. Hide the background dashboard elements that cause extra pages */
                                    main, 
                                    header, 
                                    nav, 
                                    aside,
                                    footer,
                                    #root > div > div:first-child,
                                    .welcome-card-wrapper { 
                                        display: none !important; 
                                        height: 0 !important;
                                        margin: 0 !important;
                                        padding: 0 !important;
                                        overflow: hidden !important;
                                    }
                                    
                                    /* 2. Reset body and html */
                                    html, body {
                                        height: auto !important;
                                        min-height: 0 !important;
                                        background: white !important;
                                        margin: 0 !important;
                                        padding: 0 !important;
                                    }
                                    
                                    /* 3. Ensure the modal backdrop is the only visible container */
                                    .coordinator-report-modal-backdrop { 
                                        display: block !important; 
                                        position: static !important;
                                        top: 0 !important;
                                        left: 0 !important;
                                        width: 100% !important;
                                        height: auto !important;
                                        background: white !important;
                                        z-index: 9999 !important;
                                        padding: 0 !important;
                                        margin: 0 !important;
                                        visibility: visible !important;
                                        overflow: visible !important;
                                    }

                                    .coordinator-report-modal-content {
                                        display: block !important;
                                        width: 100% !important;
                                        max-width: none !important;
                                        box-shadow: none !important;
                                        border: none !important;
                                        overflow: visible !important;
                                        position: static !important;
                                        visibility: visible !important;
                                        height: auto !important;
                                    }
                                    
                                    /* 4. Force all scrollable containers inside the modal to be fully expanded for Safari */
                                    .coordinator-report-modal-backdrop *,
                                    .coordinator-report-modal-content *,
                                    .print-bulletin-container,
                                    .print-bulletin-container * {
                                        overflow: visible !important;
                                    }

                                    /* Ensure all children of the modal are visible */
                                    .coordinator-report-modal-backdrop * {
                                        visibility: visible !important;
                                    }

                                    /* Standard print helpers */
                                    .print-scale-wrapper {
                                        width: ${isEarlyChildhood ? '100%' : '181.818%'} !important;
                                        transform: ${isEarlyChildhood ? 'scale(0.88)' : 'scale(0.55)'} !important;
                                        transform-origin: ${isEarlyChildhood ? 'top center' : 'top left'} !important;
                                        display: flex !important;
                                        justify-content: center !important;
                                        margin: 0 !important;
                                        padding: 0 !important;
                                    }
                                    .print-bulletin-container { 
                                        border: none !important; 
                                        padding: 0 !important; 
                                        margin: 0 auto !important; 
                                        display: block !important;
                                        width: ${isEarlyChildhood ? '100%' : 'max-content'} !important;
                                        max-width: none !important;
                                    }

                                    table {
                                        font-size: 12px !important;
                                    }
                                    
                                    /* Force colors */
                                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

                                    ${isEarlyChildhood ? `
                                    /* Additional compact rules for Early Childhood to guarantee 1 page */
                                    .print-bulletin-container {
                                        width: 100% !important;
                                        max-width: 100% !important;
                                    }
                                    h4.text-xs {
                                        font-size: 10px !important;
                                        margin-bottom: 2px !important;
                                        padding-bottom: 1px !important;
                                    }
                                    .space-y-4 > * + * {
                                        margin-top: 4px !important;
                                    }
                                    .space-y-1 > * + * {
                                        margin-top: 1px !important;
                                    }
                                    .py-1 {
                                        padding-top: 1px !important;
                                        padding-bottom: 1px !important;
                                    }
                                    .gap-3 {
                                        gap: 4px !important;
                                    }
                                    .text-xs {
                                        font-size: 10px !important;
                                    }
                                    .text-[10px] {
                                        font-size: 8px !important;
                                        padding-top: 1px !important;
                                        padding-bottom: 1px !important;
                                    }
                                    .p-4 {
                                        padding: 8px !important;
                                    }
                                    .mb-8 {
                                        margin-bottom: 24px !important;
                                        padding-bottom: 8px !important;
                                    }
                                    .mt-6 {
                                        margin-top: 4px !important;
                                        padding: 6px !important;
                                    }
                                    .mt-8, .mt-16 {
                                        margin-top: 80px !important;
                                    }
                                    ` : ''}
                                }
                            `}</style>
                            

                            <div className="print-scale-wrapper">
                                <div className="print-bulletin-container bg-white p-4 md:p-8 rounded-lg shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
                                
                                {/* RESTRUCTURED HEADER */}
                                <div className="mb-8 border-b-2 border-blue-950 pb-4 print:mb-2 print:pb-2">
                                    <div className="flex flex-col md:flex-row print:flex-row justify-between items-start print:items-center gap-4 print:gap-1">
                                        <div className="flex items-center gap-4 print:gap-2">
                                            <div className="print:block hidden w-16">
                                                <SchoolLogo variant="header" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl md:text-2xl font-extrabold text-blue-950 uppercase tracking-wide print:text-lg">EXPANSIVO REDE DE ENSINO</h2>
                                                <h3 className="text-base md:text-lg font-bold text-gray-700 uppercase print:text-sm">UNIDADE: {getUnitLabel(student.unit)}</h3>


                                            </div>
                                        </div>
                                        <div className="text-left md:text-right print:text-right w-full md:w-auto print:w-auto">
                                            <h4 className={`font-bold uppercase print:text-base ${isEarlyChildhood ? 'text-lg md:text-xl text-blue-950' : 'text-xl text-gray-800'}`}>{headerText}</h4>
                                            {isEarlyChildhood ? (
                                                <p className="text-sm text-slate-500 mt-1 font-medium tracking-wider print:mt-0">
                                                    {academicSettings?.year || new Date().getFullYear()}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-gray-500 mt-1 print:mt-0">Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-y-2 gap-x-8 text-sm print:text-xs print:p-2 print:mt-2">
                                        <div>
                                            <span className="font-bold text-gray-600 uppercase text-xs block">Aluno</span>
                                            <span className="font-bold text-gray-900 text-lg">{student.name}</span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-600 uppercase text-xs block">Código</span>
                                            <span className="font-mono text-gray-900">{student.code}</span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-600 uppercase text-xs block">Série/Ano</span>
                                            <span className="text-gray-900">{student.gradeLevel}</span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-600 uppercase text-xs block">Turma/Turno</span>
                                            <span className="text-gray-900">{student.schoolClass} - {SHIFT_LABELS[student.shift as SchoolShift] || student.shift}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Grades Table */}
                                {!isEarlyChildhood ? (
                                    <div className="overflow-x-auto w-full pb-4">
                                        {/* Action Button above table */}
                                        <div className="mb-4 flex justify-end print:hidden">
                                            <Button onClick={handleDownloadPDF} variant="outline" className="flex items-center gap-2 bg-white shadow-sm border-slate-200 hover:bg-slate-50 text-blue-950 font-bold px-4 py-2 rounded-lg transition-all active:scale-95">
                                                <Download className="w-4 h-4" /> Imprimir Boletim
                                            </Button>
                                        </div>
                                        <table className="w-full border-collapse border border-slate-300 text-[11px] print:text-[12px]">
                                            <thead>
                                                <tr className="bg-slate-100">
                                                    <th rowSpan={2} className="border border-slate-300 p-2 text-left w-36 bg-slate-200">DISCIPLINA</th>
                                                    <th rowSpan={2} className="border border-slate-300 p-2 text-center w-14 bg-slate-200">C.H. PREV.</th>
                                                    <th rowSpan={2} className="border border-slate-300 p-2 text-center w-14 bg-slate-200">C.H. MIN.</th>
                                                    <th colSpan={6} className="border border-slate-300 p-1 text-center bg-blue-50/50">1º BIMESTRE</th>
                                                    <th colSpan={6} className="border border-slate-300 p-1 text-center bg-slate-50">2º BIMESTRE</th>
                                                    <th colSpan={6} className="border border-slate-300 p-1 text-center bg-blue-50/50">3º BIMESTRE</th>
                                                    <th colSpan={6} className="border border-slate-300 p-1 text-center bg-slate-50">4º BIMESTRE</th>
                                                    <th rowSpan={2} className="border border-slate-300 p-1 text-center w-12 bg-yellow-50 font-bold">MÉD. ANUAL</th>
                                                    <th rowSpan={2} className="border border-slate-300 p-1 text-center w-12 bg-orange-50 text-orange-800 font-bold">PROV. FINAL</th>
                                                    <th rowSpan={2} className="border border-slate-300 p-1 text-center w-12 bg-blue-50 text-blue-900 font-bold">MÉD. FINAL</th>
                                                    <th rowSpan={2} className="border border-slate-300 p-1 text-center w-8 bg-slate-100">F</th>
                                                    <th rowSpan={2} className="border border-slate-300 p-1 text-center w-12 bg-slate-100">%</th>
                                                    <th rowSpan={2} className="border border-slate-300 p-2 text-center w-24 bg-slate-200">SITUAÇÃO</th>
                                                </tr>
                                                <tr className="bg-slate-50 text-[9px]">
                                                    <th className="border border-slate-300 p-1 text-center w-7">N1</th><th className="border border-slate-300 p-1 text-center w-7">R1</th><th className="border border-slate-300 p-1 text-center w-7 font-bold">M1</th><th className="border border-slate-300 p-1 text-center w-7">F1</th><th className="border border-slate-300 p-1 text-center w-8">%</th><th className="border border-slate-300 p-1 text-center w-10">Min.</th>
                                                    <th className="border border-slate-300 p-1 text-center w-7">N2</th><th className="border border-slate-300 p-1 text-center w-7">R2</th><th className="border border-slate-300 p-1 text-center w-7 font-bold">M2</th><th className="border border-slate-300 p-1 text-center w-7">F2</th><th className="border border-slate-300 p-1 text-center w-8">%</th><th className="border border-slate-300 p-1 text-center w-10">Min.</th>
                                                    <th className="border border-slate-300 p-1 text-center w-7">N3</th><th className="border border-slate-300 p-1 text-center w-7">R3</th><th className="border border-slate-300 p-1 text-center w-7 font-bold">M3</th><th className="border border-slate-300 p-1 text-center w-7">F3</th><th className="border border-slate-300 p-1 text-center w-8">%</th><th className="border border-slate-300 p-1 text-center w-10">Min.</th>
                                                    <th className="border border-slate-300 p-1 text-center w-7">N4</th><th className="border border-slate-300 p-1 text-center w-7">R4</th><th className="border border-slate-300 p-1 text-center w-7 font-bold">M4</th><th className="border border-slate-300 p-1 text-center w-7">F4</th><th className="border border-slate-300 p-1 text-center w-8">%</th><th className="border border-slate-300 p-1 text-center w-10">Min.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredStudentGrades.map((grade) => {
                                                    const subjectObj = academicSubjects.find(s => s.id === grade.subject);
                                                    const subjectName = subjectObj ? subjectObj.name : grade.subject;
                                                    
                                                    // Calculate Annual CH Prev (Workload)
                                                    let weeklyClasses = 0;
                                                    if (matrices && student) {
                                                        const matchingMatrix = matrices.find(m =>
                                                            m.unit === student.unit &&
                                                            m.shift === student.shift &&
                                                            (m.gradeId === student.gradeLevel)
                                                        );
                                                        if (matchingMatrix) {
                                                            const ms = matchingMatrix.subjects.find(s => s.id === grade.subject);
                                                            if (ms) weeklyClasses = ms.weeklyHours;
                                                        }
                                                    }
                                                    if (weeklyClasses === 0 && subjectObj?.weeklyHours && student) {
                                                        const k = Object.keys(subjectObj.weeklyHours).find(key => student.gradeLevel.includes(key));
                                                        if (k) weeklyClasses = subjectObj.weeklyHours[k];
                                                    }
                                                    
                                                    const finalDuration = subjectObj?.classDuration || 60;
                                                    const annualWorkload = Math.round((weeklyClasses * finalDuration / 60) * 40);

                                                    // Calculate Annual CH Min (Taught)
                                                    const annualTaught = calculateTaughtClasses(
                                                        grade.subject, 
                                                        student.gradeLevel, 
                                                        effectiveSettings?.bimesters?.[0]?.startDate || `${currentYear}-01-01`, 
                                                        new Date().toLocaleDateString('en-CA'), 
                                                        student.unit, 
                                                        academicSubjects, 
                                                        classSchedules, 
                                                        calendarEvents, 
                                                        student.schoolClass, 
                                                        student.shift, 
                                                        matrices
                                                    ).taught;
                                                    
                                                    // Real-time absences (with Abordagem A: dynamic cross-check with license periods)
                                                    const getRealtimeAbsences = (bimNum: 1|2|3|4) => {
                                                        let raw = 0;
                                                        let unexcused = 0;
                                                        studentAttendance.forEach(att => {
                                                            if (att.discipline !== grade.subject) return;
                                                            if (att.studentStatus[student.id] !== AttendanceStatus.ABSENT) return;
                                                            if (getDynamicBimester(att.date, effectiveSettings) !== bimNum) return;

                                                            const subjectObj = academicSubjects?.find(s => s.id === grade.subject);
                                                            const isSameUnit = att.unit === student.unit;
                                                            const individualCount = att.studentAbsenceCount?.[student.id];
                                                            const lessonCount = individualCount !== undefined ? individualCount : (att.lessonCount || 1);
                                                            // Cruzamento dinâmico: verifica se a data está coberta por alguma licença
                                                            const isCoveredByLicense = studentLicenses.some(lic => lic.studentId === student.id && att.date >= lic.startDate && att.date <= lic.endDate);
                                                            const isExcused = isCoveredByLicense || att.studentExcusedAbsences?.[student.id] === true;

                                                            let duration = lessonCount;
                                                            if (isSameUnit) {
                                                                if (classSchedules && classSchedules.length > 0) {
                                                                    if (!isClassScheduled(att.date, grade.subject, classSchedules, calendarEvents, student.unit, student.gradeLevel, student.schoolClass, student.shift, subjectObj?.id)) {
                                                                        return;
                                                                    }
                                                                    duration = getSubjectDurationForDay(att.date, grade.subject, classSchedules, lessonCount, student.gradeLevel, student.schoolClass, calendarEvents, student.unit, student.shift, subjectObj?.id);
                                                                }
                                                            }
                                                            raw += duration;
                                                            if (!isExcused) unexcused += duration;
                                                        });
                                                        return { raw, unexcused };
                                                    };

                                                    const absencesBim1 = getRealtimeAbsences(1);
                                                    const absencesBim2 = getRealtimeAbsences(2);
                                                    const absencesBim3 = getRealtimeAbsences(3);
                                                    const absencesBim4 = getRealtimeAbsences(4);
                                                    const totalAbsencesRaw = absencesBim1.raw + absencesBim2.raw + absencesBim3.raw + absencesBim4.raw;
                                                    const totalAbsencesUnexcused = absencesBim1.unexcused + absencesBim2.unexcused + absencesBim3.unexcused + absencesBim4.unexcused;

                                                    // Per-bimester taught classes (Min.) - same logic as CoordinatorDashboard
                                                    const getBimMin = (bimNum: 1|2|3|4): number => {
                                                        if (!effectiveSettings?.bimesters) return 0;
                                                        const bimConfig = effectiveSettings.bimesters.find((b: any) => b.number === bimNum);
                                                        if (!bimConfig) return 0;
                                                        const effectiveEnd = today < bimConfig.endDate ? today : bimConfig.endDate;
                                                        if (bimConfig.startDate > today) return 0; // bimester not started
                                                        return calculateTaughtClasses(grade.subject, student.gradeLevel, bimConfig.startDate, effectiveEnd, student.unit, academicSubjects, classSchedules, calendarEvents, student.schoolClass, student.shift, matrices).taught;
                                                    };
                                                    const bMin1 = getBimMin(1);
                                                    const bMin2 = getBimMin(2);
                                                    const bMin3 = getBimMin(3);
                                                    const bMin4 = getBimMin(4);

                                                    const annualFreqResult = calculateAnnualAttendancePercentage(
                                                        grade.subject, 
                                                        totalAbsencesUnexcused, 
                                                        student.gradeLevel, 
                                                        elapsedBimesters, 
                                                        academicSubjects, 
                                                        effectiveSettings, 
                                                        calendarEvents, 
                                                        student.unit, 
                                                        classSchedules, 
                                                        student.schoolClass, 
                                                        student.shift, 
                                                        matrices
                                                    );
                                                    const annualFrequency = annualFreqResult?.percent ?? 100;

                                                    return (
                                                        <tr key={grade.subject} className="hover:bg-slate-50 transition-colors">
                                                            <td className="border border-slate-300 p-2 font-bold text-slate-800 uppercase">{subjectName}</td>
                                                            <td className="border border-slate-300 p-1 text-center text-slate-500 font-medium">{formatWorkload(annualWorkload)}</td>
                                                            <td className="border border-slate-300 p-1 text-center text-slate-400 font-medium">{annualTaught > 0 ? formatWorkload(Math.round(annualTaught * 10) / 10) : '-'}</td>
                                                            
                                                            {/* BIM 1 */}
                                                            <td className="border border-slate-300 p-1 text-center">{formatGrade(grade.bimesters.bimester1.nota)}</td>
                                                            <td className="border border-slate-300 p-1 text-center text-orange-600">{formatGrade(grade.bimesters.bimester1.recuperacao)}</td>
                                                            <td className="border border-slate-300 p-1 text-center font-black bg-blue-50/30 text-blue-900">{formatGrade(grade.bimesters.bimester1.media)}</td>
                                                            <td className="border border-slate-300 p-1 text-center text-slate-400 relative" title={absencesBim1.raw > absencesBim1.unexcused ? `${Math.round(absencesBim1.raw)} falta(s) (${Math.round(absencesBim1.raw - absencesBim1.unexcused)} abonada(s))` : undefined}>
                                                                {Math.round(absencesBim1.raw)}
                                                                {absencesBim1.raw > absencesBim1.unexcused && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-green-500 rounded-full" title="Faltas Abonadas"></span>}
                                                            </td>
                                                            <td className="border border-slate-300 p-1 text-center text-[9px] text-slate-500">
                                                                {isBimStarted(1) ? `${Math.round(calculateAttendancePercentage(grade.subject, absencesBim1.unexcused, student.gradeLevel, 1, academicSubjects, effectiveSettings, calendarEvents, student.unit, classSchedules, student.schoolClass, student.shift, matrices)?.percent || 100)}%` : '-'}
                                                            </td>
                                                            <td className="border border-slate-300 p-1 text-center text-[9px] text-slate-400">{bMin1 > 0 ? formatWorkload(Math.round(bMin1 * 10) / 10) : '-'}</td>

                                                            {/* BIM 2 */}
                                                            <td className="border border-slate-300 p-1 text-center">{formatGrade(grade.bimesters.bimester2.nota)}</td>
                                                            <td className="border border-slate-300 p-1 text-center text-orange-600">{formatGrade(grade.bimesters.bimester2.recuperacao)}</td>
                                                            <td className="border border-slate-300 p-1 text-center font-black bg-slate-50 text-slate-900">{formatGrade(grade.bimesters.bimester2.media)}</td>
                                                            <td className="border border-slate-300 p-1 text-center text-slate-400 relative" title={absencesBim2.raw > absencesBim2.unexcused ? `${Math.round(absencesBim2.raw)} falta(s) (${Math.round(absencesBim2.raw - absencesBim2.unexcused)} abonada(s))` : undefined}>
                                                                {Math.round(absencesBim2.raw)}
                                                                {absencesBim2.raw > absencesBim2.unexcused && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-green-500 rounded-full" title="Faltas Abonadas"></span>}
                                                            </td>
                                                            <td className="border border-slate-300 p-1 text-center text-[9px] text-slate-500">
                                                                {isBimStarted(2) ? `${Math.round(calculateAttendancePercentage(grade.subject, absencesBim2.unexcused, student.gradeLevel, 2, academicSubjects, effectiveSettings, calendarEvents, student.unit, classSchedules, student.schoolClass, student.shift, matrices)?.percent || 100)}%` : '-'}
                                                            </td>
                                                            <td className="border border-slate-300 p-1 text-center text-[9px] text-slate-400">{bMin2 > 0 ? formatWorkload(Math.round(bMin2 * 10) / 10) : '-'}</td>

                                                            {/* BIM 3 */}
                                                            <td className="border border-slate-300 p-1 text-center">{formatGrade(grade.bimesters.bimester3.nota)}</td>
                                                            <td className="border border-slate-300 p-1 text-center text-orange-600">{formatGrade(grade.bimesters.bimester3.recuperacao)}</td>
                                                            <td className="border border-slate-300 p-1 text-center font-black bg-blue-50/30 text-blue-900">{formatGrade(grade.bimesters.bimester3.media)}</td>
                                                            <td className="border border-slate-300 p-1 text-center text-slate-400 relative" title={absencesBim3.raw > absencesBim3.unexcused ? `${Math.round(absencesBim3.raw)} falta(s) (${Math.round(absencesBim3.raw - absencesBim3.unexcused)} abonada(s))` : undefined}>
                                                                {Math.round(absencesBim3.raw)}
                                                                {absencesBim3.raw > absencesBim3.unexcused && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-green-500 rounded-full" title="Faltas Abonadas"></span>}
                                                            </td>
                                                            <td className="border border-slate-300 p-1 text-center text-[9px] text-slate-500">
                                                                {isBimStarted(3) ? `${Math.round(calculateAttendancePercentage(grade.subject, absencesBim3.unexcused, student.gradeLevel, 3, academicSubjects, effectiveSettings, calendarEvents, student.unit, classSchedules, student.schoolClass, student.shift, matrices)?.percent || 100)}%` : '-'}
                                                            </td>
                                                            <td className="border border-slate-300 p-1 text-center text-[9px] text-slate-400">{bMin3 > 0 ? formatWorkload(Math.round(bMin3 * 10) / 10) : '-'}</td>

                                                            {/* BIM 4 */}
                                                            <td className="border border-slate-300 p-1 text-center">{formatGrade(grade.bimesters.bimester4.nota)}</td>
                                                            <td className="border border-slate-300 p-1 text-center text-orange-600">{formatGrade(grade.bimesters.bimester4.recuperacao)}</td>
                                                            <td className="border border-slate-300 p-1 text-center font-black bg-slate-50 text-slate-900">{formatGrade(grade.bimesters.bimester4.media)}</td>
                                                            <td className="border border-slate-300 p-1 text-center text-slate-400 relative" title={absencesBim4.raw > absencesBim4.unexcused ? `${Math.round(absencesBim4.raw)} falta(s) (${Math.round(absencesBim4.raw - absencesBim4.unexcused)} abonada(s))` : undefined}>
                                                                {Math.round(absencesBim4.raw)}
                                                                {absencesBim4.raw > absencesBim4.unexcused && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-green-500 rounded-full" title="Faltas Abonadas"></span>}
                                                            </td>
                                                            <td className="border border-slate-300 p-1 text-center text-[9px] text-slate-500">
                                                                {isBimStarted(4) ? `${Math.round(calculateAttendancePercentage(grade.subject, absencesBim4.unexcused, student.gradeLevel, 4, academicSubjects, effectiveSettings, calendarEvents, student.unit, classSchedules, student.schoolClass, student.shift, matrices)?.percent || 100)}%` : '-'}
                                                            </td>
                                                            <td className="border border-slate-300 p-1 text-center text-[9px] text-slate-400">{bMin4 > 0 ? formatWorkload(Math.round(bMin4 * 10) / 10) : '-'}</td>

                                                            {/* Final Totals */}
                                                            <td className="border border-slate-300 p-1 text-center font-black bg-yellow-50/50">{formatGrade(grade.mediaAnual)}</td>
                                                            <td className="border border-slate-300 p-1 text-center font-black bg-orange-50/50 text-orange-700">{formatGrade(grade.recuperacaoFinal)}</td>
                                                            <td className="border border-slate-300 p-1 text-center font-black bg-blue-100/50 text-blue-900">{formatGrade(grade.mediaFinal)}</td>
                                                            <td className="border border-slate-300 p-1 text-center font-bold relative" title={totalAbsencesRaw > totalAbsencesUnexcused ? `${Math.round(totalAbsencesRaw)} falta(s) (${Math.round(totalAbsencesRaw - totalAbsencesUnexcused)} abonada(s))` : undefined}>
                                                                {Math.round(totalAbsencesRaw)}
                                                                {totalAbsencesRaw > totalAbsencesUnexcused && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-green-500 rounded-full" title="Faltas Abonadas no Ano"></span>}
                                                            </td>
                                                            <td className={`border border-slate-300 p-1 text-center font-bold ${annualFrequency < 75 ? 'text-red-600' : 'text-slate-700'}`}>{Math.round(annualFrequency)}%</td>
                                                            <td className="border border-slate-300 p-1 text-center">
                                                                <span className={`px-2 py-1 rounded-full text-[9px] font-black tracking-tight ${
                                                                    grade.situacaoFinal === 'Aprovado' ? 'bg-green-100 text-green-700' :
                                                                    grade.situacaoFinal === 'Reprovado' ? 'bg-red-100 text-red-700' :
                                                                    'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                    {grade.situacaoFinal}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {/* SYNC FIX: General Frequency Footer */}
                                                {filteredStudentGrades.length > 0 && (() => {
                                                    const generalFreq = calculateGeneralFrequency(
                                                        filteredStudentGrades, 
                                                        studentAttendance, 
                                                        student.id, 
                                                        student.gradeLevel, 
                                                        academicSubjects, 
                                                        effectiveSettings, 
                                                        calendarEvents, 
                                                        student.unit, 
                                                        classSchedules, 
                                                        student.schoolClass, 
                                                        student.shift, 
                                                        matrices
                                                    );
                                                    return (
                                                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                                                            <td colSpan={31} className="p-2 text-right uppercase tracking-wider text-blue-950 font-extrabold text-[10px]">
                                                                FREQUÊNCIA GERAL NO ANO LETIVO:
                                                            </td>
                                                            <td className="p-1 text-center text-blue-900 font-extrabold text-[11px] bg-blue-50/50 border border-slate-300">
                                                                {generalFreq}
                                                            </td>
                                                            <td className="bg-slate-100 border border-slate-300"></td>
                                                        </tr>
                                                    );
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : isEarlyChildhood ? (
                                    <div>
                                        {/* Controls */}
                                        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Semestre:</label>
                                                <select
                                                    value={selectedSemesterModal}
                                                    onChange={(e) => setSelectedSemesterModal(Number(e.target.value) as 1 | 2)}
                                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-950 bg-white focus:ring-2 focus:ring-blue-950 outline-none shadow-sm"
                                                >
                                                    <option value={1}>1º Semestre</option>
                                                    <option value={2}>2º Semestre</option>
                                                </select>
                                            </div>
                                            <Button
                                                onClick={() => window.print()}
                                                variant="outline"
                                                className="flex items-center gap-2 bg-white shadow-sm border-slate-200 hover:bg-slate-50 text-blue-950 font-bold px-4 py-2 rounded-lg transition-all active:scale-95"
                                            >
                                                <Download className="w-4 h-4" /> Imprimir Relatório
                                            </Button>
                                        </div>

                                        {/* Report content for selected semester */}
                                        {(() => {
                                            const year = academicSettings?.year || new Date().getFullYear();
                                            const reportId = `${student!.id}_${selectedSemesterModal}_${year}`;
                                            const report = earlyChildhoodReports.find(r => r.id === reportId);
                                            return (
                                                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                                                    <div className="bg-blue-950 text-white px-5 py-3 flex items-center justify-between print:hidden">
                                                        <span className="font-bold text-sm uppercase tracking-wider">{selectedSemesterModal}º Semestre</span>
                                                        {report ? (
                                                            <span className="text-xs bg-green-400 text-green-900 font-bold px-3 py-1 rounded-full">Lançado</span>
                                                        ) : (
                                                            <span className="text-xs bg-amber-400 text-amber-900 font-bold px-3 py-1 rounded-full">Pendente</span>
                                                        )}
                                                    </div>
                                                    {/* Print-only semester header */}
                                                    <div className="hidden print:flex items-center justify-between px-5 py-3 bg-slate-100 border-b border-slate-300 mb-4">
                                                        <span className="font-bold text-sm uppercase tracking-wider text-blue-950">{selectedSemesterModal}º Semestre — {year}</span>
                                                    </div>
                                                    {report ? (
                                                        <div className="p-4 space-y-4">
                                                            {report.fields.map(field => (
                                                                <div key={field.id}>
                                                                    <h4 className="text-xs font-black uppercase tracking-wider text-blue-950 mb-2 border-b border-slate-100 pb-1">{field.name}</h4>
                                                                    <div className="space-y-1">
                                                                        {field.competencies.map(comp => (
                                                                            <div key={comp.id} className="flex items-start gap-3 py-1">
                                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                                                                                    comp.status === CompetencyStatus.DEVELOPED ? 'bg-green-100 text-green-700' :
                                                                                    comp.status === CompetencyStatus.IN_PROCESS ? 'bg-amber-100 text-amber-700' :
                                                                                    comp.status === CompetencyStatus.NOT_OBSERVED ? 'bg-slate-100 text-slate-500' :
                                                                                    'bg-slate-100 text-slate-400'
                                                                                }`}>
                                                                                    {comp.status || 'Não avaliado'}
                                                                                </span>
                                                                                <span className="text-xs text-slate-700 leading-relaxed">{comp.description}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {report.teacherObservations && (
                                                                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Observações do Professor</p>
                                                                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{report.teacherObservations}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="p-8 text-center text-slate-400">
                                                            <p className="text-sm">Relatório ainda não lançado pelo professor.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <div className="p-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                                        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500 font-medium italic">O Relatório de Desenvolvimento da Educação Infantil deve ser consultado no Dashboard do Aluno.</p>
                                    </div>
                                )}

                                {/* SIGNATURES */}
                                <div className="mt-8 md:mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-20 print:grid-cols-2 print:gap-20 print:mt-8">
                                    <div className="text-center">
                                        <div className="border-t border-black mx-auto w-full max-w-[280px] md:max-w-96 print:max-w-96 pt-3">
                                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Coordenação Pedagógica</p>
                                            <p className="text-[9px] text-slate-400 mt-1 uppercase">Assinatura e Carimbo</p>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="border-t border-black mx-auto w-full max-w-[280px] md:max-w-96 print:max-w-96 pt-3">
                                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Direção Escolar</p>
                                            <p className="text-[9px] text-slate-400 mt-1 uppercase">Assinatura e Carimbo</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Sub-Modal: Gerenciamento de Licenças/Afastamentos por Período (Abordagem A) */}
        {showLicenseModal && student && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col animate-fade-in-up max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-orange-100 bg-white rounded-t-2xl">
                        <div>
                            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-orange-500" />
                                Licenças / Afastamentos
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">{student.name}</p>
                        </div>
                        <button onClick={() => setShowLicenseModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="p-5 space-y-6">
                        {/* Formulário de Nova Licença (Isolado em sub-componente para evitar lag ao digitar) */}
                        <LicenseRegisterForm 
                            student={student} 
                            reasons={LICENSE_REASONS}
                        />

                        {/* Lista de Licenças Cadastradas */}
                        <div>
                            <h4 className="text-sm font-extrabold text-blue-950 mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-orange-500" />
                                Licenças Cadastradas
                            </h4>
                            {studentLicenses.length === 0 ? (
                                <div className="text-center py-8 text-blue-950/40">
                                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Nenhuma licença cadastrada para este aluno.</p>
                                    <p className="text-xs mt-1 opacity-70">Cadastre acima para abonar faltas automaticamente.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {studentLicenses.map(lic => (
                                        <div key={lic.id} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-extrabold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">{lic.reason}</span>
                                                    <span className="text-xs text-slate-500 font-mono">
                                                        {new Date(lic.startDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                        {lic.endDate !== lic.startDate && ` → ${new Date(lic.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                                                    </span>
                                                </div>
                                                {lic.description && (
                                                    <p className="text-xs text-slate-500 mt-1 italic">{lic.description}</p>
                                                )}
                                                {lic.attachmentUrl && (
                                                    <a
                                                        href={lic.attachmentUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 mt-1.5 text-xs text-orange-600 hover:text-orange-800 font-medium hover:underline"
                                                        title={lic.attachmentName || 'Ver comprovante'}
                                                    >
                                                        <Paperclip className="w-3 h-3" />
                                                        {lic.attachmentName || 'Ver comprovante'}
                                                    </a>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteLicense(lic.id)}
                                                className="p-1.5 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-lg transition-colors flex-shrink-0"
                                                title="Excluir licença"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

// Componente Isolado para o Formulário de Licenças (Evita lag de digitação no modal pai)
interface LicenseRegisterFormProps {
    student: Student;
    reasons: string[];
}

const LicenseRegisterForm: React.FC<LicenseRegisterFormProps> = ({ student, reasons }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('Atestado Médico');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
    const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ACCEPTED_TYPES.includes(file.type)) {
            setError('Formato inválido. Aceito apenas: PDF, JPG ou PNG.');
            e.target.value = '';
            return;
        }

        if (file.size > MAX_SIZE_BYTES) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            setError(`Arquivo muito grande (${fileSizeMB} MB). O limite é 1 MB. Reduza o tamanho ou use outro arquivo.`);
            e.target.value = '';
            return;
        }

        setError('');
        setSelectedFile(file);
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSave = async () => {
        if (!startDate || !endDate) {
            setError('Preencha as datas de início e fim.');
            return;
        }
        if (endDate < startDate) {
            setError('A data de fim não pode ser anterior à data de início.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            let attachmentUrl: string | undefined;
            let attachmentName: string | undefined;

            // Upload do comprovante, se houver arquivo selecionado
            if (selectedFile) {
                const timestamp = Date.now();
                const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const storagePath = `licencas/${student.id}/${timestamp}_${safeFileName}`;
                const fileRef = storage.ref(storagePath);
                await fileRef.put(selectedFile);
                attachmentUrl = await fileRef.getDownloadURL();
                attachmentName = selectedFile.name;
            }

            const newLicense: Omit<StudentLicense, 'id'> = {
                studentId: student.id,
                studentName: student.name,
                unit: student.unit,
                startDate,
                endDate,
                reason,
                description,
                ...(attachmentUrl && { attachmentUrl, attachmentName }),
                createdAt: new Date().toISOString(),
                createdBy: 'coordinator',
            };
            await db.collection('studentLicenses').add(newLicense);
            setStartDate('');
            setEndDate('');
            setReason('Atestado Médico');
            setDescription('');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
            setError('Erro ao salvar licença. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-extrabold text-blue-950 flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-500" /> Nova Licença / Afastamento
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-blue-950 mb-1">Data de Início</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-blue-950 mb-1">Data de Fim</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-blue-950 mb-1">Motivo</label>
                <select
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                >
                    {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs font-bold text-blue-950 mb-1">Observações (opcional)</label>
                <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Ex: Atestado de 3 dias entregue na secretaria..."
                    className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
            </div>

            {/* Campo de Upload do Comprovante */}
            <div>
                <label className="block text-xs font-bold text-blue-950 mb-1">
                    Comprovante / Atestado <span className="text-gray-400 font-normal">(opcional · máx. 1 MB · PDF, JPG ou PNG)</span>
                </label>
                {selectedFile ? (
                    <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-xs text-green-800 font-medium flex-1 truncate" title={selectedFile.name}>
                            {selectedFile.name}
                        </span>
                        <span className="text-[10px] text-green-600 flex-shrink-0">
                            {(selectedFile.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="p-1 hover:bg-green-100 rounded-full transition-colors flex-shrink-0"
                            title="Remover arquivo"
                        >
                            <X className="w-3.5 h-3.5 text-green-700" />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all bg-blue-950 hover:bg-blue-900 text-white shadow-md active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Paperclip className="w-4 h-4 text-white" />
                        Anexar comprovante
                    </button>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>

            {error && (
                <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
                onClick={handleSave}
                disabled={loading}
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-all active:scale-95 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
                {loading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <Plus className="w-4 h-4" />
                )}
                {loading ? 'Salvando...' : 'Salvar Licença'}
            </button>
        </div>
    );
};

