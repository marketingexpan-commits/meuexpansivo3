import { useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, doc as firebaseDoc, setDoc, getDoc, limit, deleteDoc } from 'firebase/firestore';
import { Button } from './Button';
import { pedagogicalService } from '../services/pedagogicalService';
import { studentService } from '../services/studentService';
import { Loader2, ShieldCheck, Search, X, Trash2, AlertTriangle, Database, Zap, Calendar, Bug, Layers } from 'lucide-react';
import { getCurrentSchoolYear, isClassScheduled } from '../utils/academicUtils';
import { getAcademicSettings } from '../services/academicSettings';
import type { GradeEntry, ClassSchedule, AcademicSubject } from '../types';
import { SchoolUnit, UNIT_LABELS, Subject, SUBJECT_LABELS } from '../types';
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



interface IdDiscrepancy {
    id: string;
    collection: string;
    studentName: string;
    studentUnit: string;
    currentSubject: string;
    suggestedSubject: string;
    date?: string;
}

interface DuplicateGrade {
    studentId: string;
    studentName: string;
    normalizedSubject: string;
    items: {
        id: string;
        subject: string;
        lastUpdated: string;
        hasData: boolean;
    }[];
}

type Mode = 'SYNC_ABSENCES' | 'GHOST_GRADES' | 'GHOST_SCHEDULES' | 'GLOBAL_RESET' | 'NORMALIZE_IDS' | 'MIGRATE_UNITS' | 'DEBUG_INSPECTOR' | 'DEDUPLICATE_SUBJECTS';


export const DatabaseCleanupTool = () => {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Mode>('NORMALIZE_IDS');
    const [isOpen, setIsOpen] = useState(false);

    // Scan Results
    const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
    const [selectedDiscrepancies, setSelectedDiscrepancies] = useState<number[]>([]);
    const [debugStats, setDebugStats] = useState<string>('');
    const [ghostGrades, setGhostGrades] = useState<GhostGrade[]>([]);
    const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
    const [ghostSchedules, setGhostSchedules] = useState<ClassSchedule[]>([]);
    const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);
    const [idDiscrepancies, setIdDiscrepancies] = useState<IdDiscrepancy[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [unitMigrationStats, setUnitMigrationStats] = useState<{ collection: string; count: number }[]>([]);
    const [duplicateGrades, setDuplicateGrades] = useState<DuplicateGrade[]>([]);
    const [selectedDuplicates, setSelectedDuplicates] = useState<string[]>([]);

    // Filters & Context

    const { grades: allGradesList, subjects } = useAcademicData();
    const [selectedUnit, setSelectedUnit] = useState<SchoolUnit>(SchoolUnit.UNIT_BS);
    const [selectedGrade, setSelectedGrade] = useState<string>('');

    // Auth Check
    const userUnitCode = localStorage.getItem('userUnit') || '';
    const isAdminGeral = userUnitCode === 'admin_geral';

    const suggestSubject = (subjectStr: string): string => {
        if (!subjectStr) return 'ACIONE O SUPORTE';
        const validSubjects = Object.values(Subject);

        // Robust normalization: lowercase, remove accents, remove dots, trim
        const normalized = subjectStr.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\./g, '')
            .trim();

        // 0. Exclude support placeholders before keyword matching
        if (normalized.includes('suporte')) return 'ACIONE O SUPORTE';

        // 1. Direct key match (e.g., 'sub_biology')
        if (validSubjects.includes(subjectStr as Subject)) return subjectStr;

        // 2. Search database subjects by name
        const dbMatch = subjects.find((s: AcademicSubject) =>
            s.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, '').trim() === normalized ||
            (s.shortName && s.shortName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, '').trim() === normalized)
        );
        if (dbMatch) return dbMatch.id;

        // 3. Logic based on patterns (Fallback to Enum defaults)
        if (normalized.includes('mat')) return Subject.MATH;
        if (normalized.includes('port') || normalized.includes('lingua')) return Subject.PORTUGUESE;
        if (normalized.includes('hist')) return Subject.HISTORY;
        if (normalized.includes('geo')) return Subject.GEOGRAPHY;
        if (normalized.includes('cienc')) return Subject.SCIENCE;
        if (normalized.includes('ing') || normalized.includes('engl')) return Subject.ENGLISH;
        if (normalized.includes('art')) return Subject.ARTS;
        if (normalized.includes('rel')) return Subject.RELIGIOUS_ED;
        if (normalized.includes('fis') && !normalized.includes('ed')) return Subject.PHYSICS;
        if (normalized.includes('ed') && normalized.includes('fis')) return Subject.PHYSICAL_ED;
        if (normalized.includes('bio')) return Subject.BIOLOGY;
        if (normalized.includes('qui')) return Subject.CHEMISTRY;
        if (normalized.includes('empreend')) return Subject.ENTREPRENEURSHIP;
        if (normalized.includes('vida')) return Subject.LIFE_PROJECT;
        if (normalized.includes('fili')) return Subject.PHILOSOPHY;
        if (normalized.includes('soci')) return Subject.SOCIOLOGY;
        if (normalized.includes('lite')) return Subject.LITERATURE;
        if (normalized.includes('reda')) return Subject.WRITING;

        return `ACIONE O SUPORTE (${normalized})`;
    };

    if (!isAdminGeral) return null;

    // --- LOGIC FUNCTIONS ---

    const scanAbsences = async () => {
        setLoading(true);
        setDiscrepancies([]);
        setSelectedDiscrepancies([]);
        try {
            const [allStudents, allGrades, allAttendance, allSchedules, allEvents, settings] = await Promise.all([
                studentService.getStudents(),
                pedagogicalService.getAllGrades(),
                pedagogicalService.getAllAttendance(),
                pedagogicalService.getAllSchedules(),
                pedagogicalService.getCalendarEvents(),
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
                                // NEW: Verify if the day is a valid school day for this subject
                                const scheduled = isClassScheduled(
                                    record.date,
                                    record.discipline,
                                    allSchedules || [],
                                    allEvents || [],
                                    student.unit,
                                    student.gradeLevel,
                                    student.schoolClass
                                );

                                if (scheduled) {
                                    const individualCount = record.studentAbsenceCount?.[student.id];
                                    const weight = individualCount !== undefined ? individualCount : (record.lessonCount || 1);
                                    actualAbsences += weight;
                                }
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
                (selectedGrade === '' || s.grade === selectedGrade) &&
                (!s.items || s.items.length === 0)
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

    const scanForBadIds = async () => {
        setLoading(true);
        setIdDiscrepancies([]);
        try {
            const allStudents = await studentService.getStudents();
            const validSubjects = Object.values(Subject);
            const bad: IdDiscrepancy[] = [];

            const targetCollections = [
                { name: 'grades', field: 'subject' },
                { name: 'attendance', field: 'discipline' },
                { name: 'class_materials', field: 'subject' },
                { name: 'daily_agenda', field: 'subject' },
                { name: 'exam_guides', field: 'subject' },
                { name: 'tickets_pedagogicos', field: 'subject' }
            ];

            const teachersSnap = await getDocs(collection(db, 'teachers'));
            const allTeachers = teachersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

            for (const target of targetCollections) {
                const snap = await getDocs(collection(db, target.name));
                const allSubjectIds = [...validSubjects, ...subjects.map((s: AcademicSubject) => s.id)];

                snap.docs.forEach(doc => {
                    const data = doc.data();
                    const val = data[target.field];

                    if (val && !allSubjectIds.includes(val)) {
                        let suggested = suggestSubject(val);

                        // fallback: if we still don't know the subject, but we have a teacher, try to use teacher's data
                        if (suggested === 'ACIONE O SUPORTE' && (data.teacherId || data.teacherName)) {
                            const teacher = allTeachers.find(t => t.id === data.teacherId || t.name === data.teacherName);
                            if (teacher) {
                                // if teacher has only one subject, it's a very safe bet
                                if (teacher.subjects?.length === 1) {
                                    suggested = teacher.subjects[0];
                                } else if (data.gradeLevel) {
                                    // check if there's a specific assignment for this grade
                                    const assignment = teacher.assignments?.find((a: any) => a.gradeLevel === data.gradeLevel);
                                    if (assignment && assignment.subjects?.length === 1) {
                                        suggested = assignment.subjects[0];
                                    }
                                }
                            }
                        }

                        // Only show if the suggestion is actually different from current
                        if (val !== suggested) {
                            let contextName = '?';
                            if (target.name === 'grades') {
                                const student = allStudents.find(s => s.id === data.studentId);
                                contextName = student?.name || 'ID Aluno: ' + data.studentId;
                            } else if (data.studentName) {
                                contextName = data.studentName;
                            } else if (data.schoolClass) {
                                contextName = `Turma: ${data.schoolClass}`;
                            } else if (data.teacherName) {
                                contextName = `Prof: ${data.teacherName}`;
                            }

                            bad.push({
                                id: doc.id,
                                collection: target.name as any,
                                studentName: contextName,
                                studentUnit: data.unit || '?',
                                currentSubject: val,
                                suggestedSubject: suggested,
                                date: data.date || data.examDate || (data.timestamp && typeof data.timestamp === 'string' ? data.timestamp.split('T')[0] : undefined)
                            });
                        }
                    }
                });
            }

            // Teachers Special Scan
            teachersSnap.docs.forEach(doc => {
                const data = doc.data();

                // Generic subjects array
                const allSubjectIds = [...validSubjects, ...subjects.map((s: AcademicSubject) => s.id)];
                const badSubjects = data.subjects?.filter((s: any) => s && !allSubjectIds.includes(s)) || [];
                badSubjects.forEach((s: string) => {
                    const suggested = suggestSubject(s);
                    if (s !== suggested) {
                        bad.push({
                            id: doc.id,
                            collection: 'teachers' as any,
                            studentName: `Prof: ${data.name}`,
                            studentUnit: data.unit || '?',
                            currentSubject: s,
                            suggestedSubject: suggested
                        });
                    }
                });

                // Detailed assignments
                data.assignments?.forEach((assign: any, idx: number) => {
                    const badAssignSubjects = assign.subjects?.filter((s: any) => s && !allSubjectIds.includes(s)) || [];
                    badAssignSubjects.forEach((s: string) => {
                        const suggested = suggestSubject(s);
                        if (s !== suggested) {
                            bad.push({
                                id: `${doc.id}_assign_${idx}_${s}`, // Unique ID for selection table
                                collection: 'teachers_assignments' as any,
                                studentName: `Prof: ${data.name} (${assign.gradeLevel})`,
                                studentUnit: data.unit || '?',
                                currentSubject: s,
                                suggestedSubject: suggested
                            });
                        }
                    });
                });
            });

            setDebugStats(`Escaneadas ${targetCollections.length + 1} coleções. Encontradas ${bad.length} discrepâncias.`);
            setIdDiscrepancies(bad);
            setSelectedIds([]);
        } catch (error) {
            console.error(error);
            alert("Erro ao buscar IDs incorretos.");
        } finally {
            setLoading(false);
        }
    };

    const normalizeIds = async () => {
        if (selectedIds.length === 0) return;
        setLoading(true);
        try {
            // Group by real document ID to avoid race conditions (especially on teachers)
            const grouped: Record<string, { coll: string, realId: string, discrepancies: IdDiscrepancy[] }> = {};
            selectedIds.forEach(selectId => {
                const disc = idDiscrepancies.find(d => d.id === selectId);
                if (disc) {
                    const realId = disc.collection === 'teachers_assignments' ? selectId.split('_assign_')[0] : disc.id;
                    const key = `${disc.collection}:${realId}`;
                    if (!grouped[key]) grouped[key] = { coll: disc.collection, realId, discrepancies: [] };
                    grouped[key].discrepancies.push(disc);
                }
            });

            for (const key of Object.keys(grouped)) {
                const { coll, realId, discrepancies } = grouped[key];

                if (coll === 'teachers' || coll === 'teachers_assignments') {
                    const docRef = firebaseDoc(db, 'teachers', realId);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const data = snap.data();
                        let subjects = [...(data.subjects || [])];
                        let assignments = [...(data.assignments || [])];

                        discrepancies.forEach(d => {
                            if (d.collection === 'teachers') {
                                subjects = subjects.map((s: string) => s === d.currentSubject ? d.suggestedSubject : s);
                            } else if (d.collection === 'teachers_assignments') {
                                assignments = assignments.map((a: any) => ({
                                    ...a,
                                    subjects: (a.subjects || []).map((s: string) => s === d.currentSubject ? d.suggestedSubject : s)
                                }));
                            }
                        });

                        await setDoc(docRef, { subjects, assignments }, { merge: true });
                    }
                } else {
                    // Standard scalar update
                    const d = discrepancies[0];
                    const field = d.collection === 'attendance' ? 'discipline' : 'subject';
                    await pedagogicalService.updateGeneric(d.collection, realId, { [field]: d.suggestedSubject });
                }
            }

            alert("Normalização concluída!");
            setIdDiscrepancies(prev => prev.filter(d => !selectedIds.includes(d.id)));
            setSelectedIds([]);
        } catch (error) {
            console.error(error);
            alert("Erro ao normalizar IDs.");
        } finally {
            setLoading(false);
        }
    };

    const scanDuplicates = async () => {
        setLoading(true);
        setDuplicateGrades([]);
        try {
            const [allStudents, allGrades] = await Promise.all([
                studentService.getStudents(),
                pedagogicalService.getAllGrades()
            ]);

            const duplicates: DuplicateGrade[] = [];

            // Group grades by student
            const studentGradesMap = new Map<string, any[]>();
            allGrades.forEach(g => {
                const list = studentGradesMap.get(g.studentId) || [];
                list.push(g);
                studentGradesMap.set(g.studentId, list);
            });

            studentGradesMap.forEach((gradeList, studentId) => {
                const normalizedMap = new Map<string, any[]>();
                gradeList.forEach(g => {
                    const nid = suggestSubject(g.subject);
                    const list = normalizedMap.get(nid) || [];
                    list.push(g);
                    normalizedMap.set(nid, list);
                });

                normalizedMap.forEach((items, nid) => {
                    if (items.length > 1) {
                        const student = allStudents.find(s => s.id === studentId);
                        duplicates.push({
                            studentId,
                            studentName: student?.name || `ID: ${studentId}`,
                            normalizedSubject: nid,
                            items: items.map(it => ({
                                id: it.id,
                                subject: it.subject,
                                lastUpdated: it.lastUpdated,
                                hasData: Object.values(it.bimesters || {}).some((b: any) => b.nota !== null || b.faltas > 0)
                            }))
                        });
                    }
                });
            });

            setDuplicateGrades(duplicates);
            setDebugStats(`Escaneados ${allGrades.length} registros de ${allStudents.length} alunos.`);

            if (duplicates.length === 0) {
                alert(`Nenhuma duplicidade encontrada entre os ${allGrades.length} registros escaneados.`);
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao buscar duplicidades.");
        } finally {
            setLoading(false);
        }
    };



    const mergeDuplicates = async () => {
        if (selectedDuplicates.length === 0) return;
        if (!confirm(`Deseja mesclar os ${selectedDuplicates.length} grupos de duplicidade selecionados? Isso moverá os dados para o ID padrão e removerá os extras.`)) return;

        setLoading(true);
        try {
            for (const groupIndexStr of selectedDuplicates) {
                const group = duplicateGrades[parseInt(groupIndexStr)];
                if (!group) continue;

                const target = group.items.find(it => it.subject.startsWith('sub_')) || group.items[0];
                const others = group.items.filter(it => it.id !== target.id);

                const targetRef = firebaseDoc(db, 'grades', target.id);
                const targetSnap = await getDoc(targetRef);
                if (!targetSnap.exists()) continue;

                const targetData = targetSnap.data() as GradeEntry;
                const finalBimesters = { ...targetData.bimesters };

                for (const other of others) {
                    const otherSnap = await getDoc(firebaseDoc(db, 'grades', other.id));
                    if (otherSnap.exists()) {
                        const data = otherSnap.data() as GradeEntry;
                        ['bimester1', 'bimester2', 'bimester3', 'bimester4'].forEach(bKey => {
                            const key = bKey as keyof typeof finalBimesters;
                            const tBim = finalBimesters[key];
                            const oBim = data.bimesters?.[key];

                            if (oBim && (oBim.nota !== null || oBim.faltas > 0)) {
                                if (!tBim || tBim.nota === null) {
                                    finalBimesters[key] = { ...oBim };
                                } else {
                                    finalBimesters[key] = {
                                        ...tBim,
                                        nota: tBim.nota ?? oBim.nota,
                                        faltas: Math.max(tBim.faltas, oBim.faltas),
                                        recuperacao: tBim.recuperacao ?? oBim.recuperacao
                                    };
                                }
                            }
                        });
                        await deleteDoc(firebaseDoc(db, 'grades', other.id));
                    }
                }

                await setDoc(targetRef, { bimesters: finalBimesters, subject: group.normalizedSubject }, { merge: true });
            }

            alert("Mesclagem concluída com sucesso!");
            setDuplicateGrades(prev => prev.filter((_, idx) => !selectedDuplicates.includes(idx.toString())));
            setSelectedDuplicates([]);
        } catch (error) {
            console.error(error);
            alert("Erro ao mesclar duplicidades.");
        } finally {
            setLoading(false);
        }
    };


    const scanUnitsForMigration = async () => {
        setLoading(true);
        setUnitMigrationStats([]);
        try {
            const collectionsToScan = ['students', 'grades', 'attendance', 'calendarEvents', 'classSchedules', 'unitContacts', 'schoolMessages', 'class_materials', 'daily_agenda', 'exam_guides', 'tickets_pedagogicos', 'teachers'];
            const stats: { collection: string; count: number }[] = [];

            const legacyUnits = ['Boa Sorte', 'Zona Norte', 'Extremoz', 'Quintas'];

            for (const coll of collectionsToScan) {
                const q = query(collection(db, coll), where('unit', 'in', legacyUnits));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    stats.push({ collection: coll, count: snap.size });
                }
            }

            setUnitMigrationStats(stats);
            if (stats.length === 0) setDebugStats("Nenhum registro com ID legado encontrado.");
            else setDebugStats(`Encontrados ${stats.reduce((acc, curr) => acc + curr.count, 0)} registros para migrar.`);

        } catch (error) {
            console.error(error);
            alert("Erro ao escanear unidades.");
        } finally {
            setLoading(false);
        }
    };

    const migrateUnits = async () => {
        // PERMITIR EXECUÇÃO MESMO SE O SCAN ESTIVER VAZIO,
        // apenas para garantir que podemos "Destravar" a migração de alunos se as unidades já existirem.
        if (unitMigrationStats.length === 0 && !confirm("O scan não encontrou referências. Deseja rodar a verificação de integridade das unidades mesmo assim?")) {
            return;
        }

        const input = prompt("ATENÇÃO: MODO DE RECUPERAÇÃO.\\n\\nIsso irá verificar se as unidades 'unit_bs', etc existem.\\nSe existirem, irá focar em atualizar os Alunos e Notas que ainda estão presos nas unidades antigas.\\n\\nDigite 'CONFIRMAR' para continuar:");
        if (input !== 'CONFIRMAR') return;

        setLoading(true);
        try {
            const mapping: Record<string, string> = {
                'Boa Sorte': 'unit_bs',
                'Zona Norte': 'unit_zn',
                'Extremoz': 'unit_ext',
                'Quintas': 'unit_qui'
            };

            // 1. MIGRATE THE ROOT DOCUMENTS IN 'school_units'
            console.log("--- FASE 1: Verificação de Unidades Mestre ---");
            for (const [legacyId, newId] of Object.entries(mapping)) {
                try {
                    // Check if NEW doc already exists
                    const newDocRef = firebaseDoc(db, 'school_units', newId);
                    const newSnap = await getDoc(newDocRef);

                    if (newSnap.exists()) {
                        console.log(`[OK] Unidade '${newId}' já existe. Nada a fazer.`);
                    } else {
                        // Check if legacy doc exists to copy from
                        const legacyDocRef = firebaseDoc(db, 'school_units', legacyId);
                        const legacySnap = await getDoc(legacyDocRef);

                        if (legacySnap.exists()) {
                            console.log(`[CRIANDO] Copiando '${legacyId}' para '${newId}'...`);
                            const data = legacySnap.data();
                            await setDoc(newDocRef, { ...data, id: newId });
                        } else {
                            console.warn(`[SKIP] Unidade fonte '${legacyId}' não encontrada.`);
                        }
                    }
                } catch (err) {
                    console.error(`Error in Phase 1 for ${legacyId}:`, err);
                }
            }

            // 2. MIGRATE REFERENCES IN OTHER COLLECTIONS
            console.log("--- FASE 2: Varredura de Alunos e Notas ---");
            const targetCollections = ['students', 'grades', 'attendance', 'calendarEvents', 'classSchedules', 'unitContacts', 'schoolMessages', 'class_materials', 'daily_agenda', 'exam_guides', 'tickets_pedagogicos', 'teachers'];
            let migrationCount = 0;

            for (const collectionName of targetCollections) {
                // Determine which field to check (unit or units)
                const snap = await getDocs(collection(db, collectionName));

                if (!snap.empty) {
                    const updates = snap.docs.map(async doc => {
                        const data = doc.data();
                        let needsUpdate = false;
                        const updatedData: any = {};

                        // Handle 'unit' field (scalar)
                        if (data.unit && Object.keys(mapping).includes(data.unit)) {
                            updatedData.unit = mapping[data.unit];
                            needsUpdate = true;
                        }

                        // Handle 'units' field (array)
                        if (data.units && Array.isArray(data.units)) {
                            const newUnits = data.units.map((u: string) => mapping[u] || u);
                            if (JSON.stringify(newUnits) !== JSON.stringify(data.units)) {
                                updatedData.units = newUnits;
                                needsUpdate = true;
                            }
                        }

                        if (needsUpdate) {
                            await pedagogicalService.updateGeneric(collectionName, doc.id, updatedData);
                            migrationCount++;
                        }
                    });
                    await Promise.all(updates);
                }
            }

            alert(`Migração Finalizada!\\n\\nRegistros corrigidos: ${migrationCount}\\n\\nA carga horária deve estar visível agora.`);
            setUnitMigrationStats([]);
            setDebugStats(`Processo completo. ${migrationCount} registros atualizados.`);
        } catch (error) {
            console.error(error);
            alert("Erro durante a migração. Verifique o console.");
        } finally {
            setLoading(false);
        }
    };

    // --- UI RENDERING ---

    if (!isOpen) {
        return (
            <div className="mt-8 p-6 bg-blue-900 text-white border border-blue-950 rounded-xl shadow-2xl transition-all hover:scale-[1.01] hover:shadow-xl group relative overflow-hidden">
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-950 text-white rounded-xl flex items-center justify-center shadow-lg transform -rotate-1">
                            <Database className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Faxina de Dados</h2>
                            <p className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Ações Destrutivas - Use com Cautela
                            </p>
                            {debugStats && <p className="text-xs text-blue-600 mt-1 font-mono bg-blue-50 px-2 py-1 rounded inline-block border border-blue-100">{debugStats}</p>}
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-3 hover:bg-slate-200/50 rounded-xl transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex gap-2 overflow-x-auto shrink-0 no-scrollbar">
                    {[
                        { id: 'SYNC_ABSENCES', label: 'Sincronizar Faltas', icon: ShieldCheck },
                        { id: 'MIGRATE_UNITS', label: 'Migrar Unidades', icon: Database },
                        { id: 'NORMALIZE_IDS', label: 'Normalizar IDs', icon: Zap },
                        { id: 'DEDUPLICATE_SUBJECTS', label: 'Deduplicar Matérias', icon: Layers },
                        { id: 'GHOST_GRADES', label: 'Notas Fantasmas', icon: Search },
                        { id: 'GHOST_SCHEDULES', label: 'Grades Fantasmas', icon: Calendar },
                        { id: 'DEBUG_INSPECTOR', label: 'Inspetor', icon: Bug },
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
                    {activeTab === 'MIGRATE_UNITS' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm mb-6">
                                <h4 className="font-black text-slate-800 text-xl mb-4 flex items-center gap-2">
                                    <Database className="w-6 h-6 text-blue-600" />
                                    Migração em Lote: Unidades (ID Técnico)
                                </h4>
                                <p className="text-slate-500 mb-8 font-medium">
                                    Esta ferramenta converte os nomes de exibição (ex: "Boa Sorte") armazenados no banco de dados para os novos IDs padronizados (ex: "unit_bs").
                                    Isso é necessário para que os cálculos de carga horária e filtros funcionem corretamente em ambos os aplicativos.
                                </p>

                                {unitMigrationStats.length === 0 ? (
                                    <div className="bg-slate-50 border border-slate-200 p-8 rounded-xl text-center">
                                        <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <h5 className="font-bold text-slate-800 mb-1">Pronto para escanear</h5>
                                        <p className="text-slate-500 text-sm mb-6">O sistema verificará as coleções de Alunos, Notas, Chamadas e Calendário.</p>
                                        <div className="flex gap-4 justify-center">
                                            <Button onClick={scanUnitsForMigration} disabled={loading} className="bg-blue-950 px-10 py-3 rounded-xl shadow-lg shadow-blue-900/10">
                                                {loading ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2 w-4 h-4" />}
                                                Escanear Banco de Dados
                                            </Button>
                                            <Button onClick={() => {
                                                // Force stats to be non-empty just to trigger the migration function flow if empty
                                                // Alternatively, just call migrateUnits() directly but bypass the length check inside
                                                if (confirm("Deseja forçar a migração dos documentos MESTRE (school_units)? Use isso se o scan não encontrar referências mas você souber que as unidades precisam ser atualizadas.")) {
                                                    setUnitMigrationStats([{ collection: 'school_units (FORCE)', count: 4 }]);
                                                    setTimeout(() => migrateUnits(), 500);
                                                }
                                            }}
                                                variant="outline"
                                                disabled={loading}
                                                className="border-blue-200 text-blue-700 hover:bg-blue-50 px-6 py-3 rounded-xl">
                                                Forçar Migração (Docs Mestre)
                                            </Button>

                                            <Button onClick={async () => {
                                                if (!confirm("TEM CERTEZA? Isso apagará as unidades antigas (Boa Sorte, etc) da lista de unidades. SO FAÇA ISSO SE OS ALUNOS JÁ ESTIVEREM MIGRADOS.")) return;
                                                setLoading(true);
                                                try {
                                                    const legacy = ['Boa Sorte', 'Zona Norte', 'Extremoz', 'Quintas'];
                                                    for (const id of legacy) {
                                                        await deleteDoc(firebaseDoc(db, 'school_units', id));
                                                        console.log(`Deleted ${id}`);
                                                    }
                                                    alert("Unidades legadas removidas! O login de professores deve estar normalizado agora.");
                                                } catch (e) {
                                                    console.error(e);
                                                    alert("Erro ao deletar: " + e);
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                                variant="outline"
                                                disabled={loading}
                                                className="border-red-200 text-red-700 hover:bg-red-50 px-6 py-3 rounded-xl ml-2">
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Deletar Unidades Legadas (Fix Login)
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {unitMigrationStats.map(s => (
                                                <div key={s.collection} className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between shadow-sm">
                                                    <div>
                                                        <span className="block text-[10px] font-black uppercase text-blue-400 tracking-wider">Coleção</span>
                                                        <span className="font-bold text-blue-900">{s.collection}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="block text-[10px] font-black uppercase text-blue-400 tracking-wider">Afetados</span>
                                                        <span className="text-xl font-black text-blue-600">{s.count}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-xl flex gap-4">
                                            <AlertTriangle className="w-8 h-8 text-yellow-500 shrink-0" />
                                            <div>
                                                <h5 className="font-bold text-yellow-800">Ação Crítica</h5>
                                                <p className="text-sm text-yellow-700 font-medium">Você está prestes a alterar permanentemente {unitMigrationStats.reduce((acc, curr) => acc + curr.count, 0)} registros. Certifique-se de que nenhum lançamento está sendo feito no momento.</p>
                                            </div>
                                        </div>

                                        <Button
                                            onClick={migrateUnits}
                                            disabled={loading}
                                            className="w-full py-8 text-xl font-black bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 rounded-xl flex flex-col gap-1"
                                        >
                                            <div className="flex items-center gap-2">
                                                {loading ? <Loader2 className="animate-spin" /> : <Database className="w-6 h-6" />}
                                                EXECUTAR MIGRAÇÃO AGORA
                                            </div>
                                            <span className="text-xs font-medium opacity-70">Converterá strings legadas para IDs técnicos em {unitMigrationStats.length} coleções</span>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'NORMALIZE_IDS' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                                <h4 className="font-bold text-slate-800 mb-2">Normalização de IDs de Disciplinas</h4>
                                <p className="text-sm text-slate-500 mb-6 font-medium">Converte códigos legados (ex: SUB_MATH.) para o padrão do sistema (sub_math). Essencial para exibição correta no boletim.</p>

                                {idDiscrepancies.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Button onClick={scanForBadIds} disabled={loading} className="bg-blue-950 px-8">
                                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2 w-4 h-4" />}
                                            Escanear IDs Incorretos
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-4 flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-600 font-bold">{idDiscrepancies.length} registros fora do padrão</span>
                                            <Button onClick={() => setIdDiscrepancies([])} variant="ghost" className="text-xs">Limpar</Button>
                                        </div>
                                        <div className="border rounded-xl overflow-hidden bg-white max-h-64 overflow-y-auto mb-6">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 sticky top-0">
                                                    <tr>
                                                        <th className="p-3 w-10">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.length === idDiscrepancies.length && idDiscrepancies.length > 0}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedIds(idDiscrepancies.map(d => d.id));
                                                                    else setSelectedIds([]);
                                                                }}
                                                                className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                                                            />
                                                        </th>
                                                        <th className="p-3">Origem</th>
                                                        <th className="p-3">Contexto</th>
                                                        <th className="p-3">Unidade</th>
                                                        <th className="p-3">ID Atual</th>
                                                        <th className="p-3">Sugestão</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {idDiscrepancies.map((d) => (
                                                        <tr key={d.id} className={selectedIds.includes(d.id) ? 'bg-blue-50/30' : ''}>
                                                            <td className="p-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedIds.includes(d.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) setSelectedIds(prev => [...prev, d.id]);
                                                                        else setSelectedIds(prev => prev.filter(id => id !== d.id));
                                                                    }}
                                                                    className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                                                                />
                                                            </td>
                                                            <td className="p-3">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${d.collection === 'grades' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                    {d.collection === 'grades' ? 'Boletim' : 'Chamada'}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 font-medium">
                                                                {d.studentName}
                                                                {d.date && <span className="block text-[10px] text-slate-400 font-bold">{d.date}</span>}
                                                            </td>
                                                            <td className="p-3 text-slate-500 font-medium">{d.studentUnit}</td>
                                                            <td className="p-3 text-red-500 font-mono">
                                                                {subjects.find((s: AcademicSubject) => s.id === d.currentSubject)?.name || SUBJECT_LABELS[d.currentSubject as Subject] || d.currentSubject}
                                                            </td>
                                                            <td className="p-3 text-green-600 font-mono font-bold">
                                                                {subjects.find((s: AcademicSubject) => s.id === d.suggestedSubject)?.name || SUBJECT_LABELS[d.suggestedSubject as Subject] || d.suggestedSubject}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <Button
                                            onClick={normalizeIds}
                                            disabled={loading || selectedIds.length === 0}
                                            className={`w-full py-6 text-lg font-black ${selectedIds.length > 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-300 cursor-not-allowed'}`}
                                        >
                                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Zap className="mr-2" />}
                                            Corrigir {selectedIds.length} Registros Selecionados
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'DEDUPLICATE_SUBJECTS' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-bold text-slate-800">Deduplicação de Matérias</h4>
                                    <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Beta</span>
                                </div>
                                <p className="text-sm text-slate-500 mb-6 font-medium">Localiza e mescla registros duplicados da mesma matéria para o mesmo aluno (ex: "Biologia" e "sub_biology"). Consolida as notas em um único registro e remove o excedente.</p>

                                {duplicateGrades.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Button onClick={scanDuplicates} disabled={loading} className="bg-blue-950 px-8">
                                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2 w-4 h-4" />}
                                            Escanear Duplicidades
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-4 flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-600 font-bold">{duplicateGrades.length} grupos de duplicidade encontrados</span>
                                            <Button onClick={() => setDuplicateGrades([])} variant="ghost" className="text-xs">Limpar</Button>
                                        </div>
                                        <div className="border rounded-xl overflow-hidden bg-white max-h-64 overflow-y-auto mb-6">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 sticky top-0">
                                                    <tr>
                                                        <th className="p-3 w-10">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedDuplicates.length === duplicateGrades.length && duplicateGrades.length > 0}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedDuplicates(duplicateGrades.map((_, i) => i.toString()));
                                                                    else setSelectedDuplicates([]);
                                                                }}
                                                                className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                                                            />
                                                        </th>
                                                        <th className="p-3">Aluno</th>
                                                        <th className="p-3">Matéria Normalizada</th>
                                                        <th className="p-3">Registros Encontrados</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {duplicateGrades.map((group, i) => (
                                                        <tr key={i} className={selectedDuplicates.includes(i.toString()) ? 'bg-blue-50/30' : ''}>
                                                            <td className="p-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedDuplicates.includes(i.toString())}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) setSelectedDuplicates(prev => [...prev, i.toString()]);
                                                                        else setSelectedDuplicates(prev => prev.filter(id => id !== i.toString()));
                                                                    }}
                                                                    className="w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                                                                />
                                                            </td>
                                                            <td className="p-3 font-medium">{group.studentName}</td>
                                                            <td className="p-3">
                                                                <span className="font-bold text-blue-900">
                                                                    {SUBJECT_LABELS[group.normalizedSubject as Subject] || group.normalizedSubject}
                                                                </span>
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex flex-col gap-1">
                                                                    {group.items.map(it => (
                                                                        <span key={it.id} className={`text-[10px] px-1.5 py-0.5 rounded border ${it.subject.startsWith('sub_') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
                                                                            {it.subject} {it.hasData && <span className="font-black underline ml-1">(DADOS)</span>}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <Button
                                            onClick={mergeDuplicates}
                                            disabled={loading || selectedDuplicates.length === 0}
                                            className={`w-full py-6 text-lg font-black ${selectedDuplicates.length > 0 ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20' : 'bg-slate-300 cursor-not-allowed shadow-none'}`}
                                        >
                                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Layers className="mr-2" />}
                                            Mesclar {selectedDuplicates.length} Grupos Selecionados
                                        </Button>
                                    </>
                                )}

                                {/* Technical Inspector */}
                                <div className="mt-12 pt-8 border-t border-slate-200">
                                    <h5 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                                        <Bug className="w-4 h-4 text-slate-400" />
                                        Inspecionar Aluno (Debug Especial)
                                    </h5>
                                    <div className="flex gap-2 mb-4">
                                        <input
                                            type="text"
                                            id="inspect-student-id"
                                            placeholder="Cole o ID do Aluno aqui..."
                                            className="grow bg-slate-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                        <Button
                                            onClick={async () => {
                                                const queryTerm = (document.getElementById('inspect-student-id') as HTMLInputElement).value;
                                                if (!queryTerm) return;
                                                setLoading(true);
                                                try {
                                                    const allStudents = await studentService.getStudents();

                                                    // 1. Precise Match (ID)
                                                    let targetStudent = allStudents.find(s => s.id === queryTerm);

                                                    // 2. Fuzzy Match (Name)
                                                    if (!targetStudent) {
                                                        const matches = allStudents.filter(s =>
                                                            s.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(
                                                                queryTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                                                            )
                                                        );

                                                        if (matches.length > 1) {
                                                            let list = "Múltiplos alunos encontrados. Use o ID correto:\n\n";
                                                            matches.forEach(m => list += `${m.name} -> ID: ${m.id}\n`);
                                                            setDebugStats(list);
                                                            alert("Vários alunos encontrados. Códigos listados abaixo.");
                                                            setLoading(false);
                                                            return;
                                                        }
                                                        targetStudent = matches[0];
                                                    }

                                                    if (!targetStudent) {
                                                        alert("Nenhum aluno encontrado com este nome ou ID.");
                                                        setLoading(false);
                                                        return;
                                                    }

                                                    const studentId = targetStudent.id;
                                                    const grades = await pedagogicalService.getGrades(studentId);
                                                    let report = `REFORÇO DE DEBUG: ALUNO ENCONTRADO\n`;
                                                    report += `Nome: ${targetStudent.name}\n`;
                                                    report += `ID: ${targetStudent.id}\n`;
                                                    report += `Total de Grades: ${grades.length}\n\n`;

                                                    grades.forEach(g => {
                                                        const nid = suggestSubject(g.subject);
                                                        report += `ID: ${g.id} | Original: "${g.subject}" -> Normalizado: "${nid}"\n`;
                                                    });

                                                    setDebugStats(report);
                                                    alert(`Relatório para ${targetStudent.name} gerado.`);
                                                } catch (e) {
                                                    alert("Erro ao buscar: " + e);
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                            className="bg-slate-800 text-white rounded-xl px-6"
                                        >
                                            Inspecionar
                                        </Button>

                                    </div>
                                    {debugStats && (
                                        <pre className="bg-slate-900 text-green-400 p-4 rounded-xl text-[10px] whitespace-pre-wrap font-mono overflow-auto max-h-64 border border-slate-800 shadow-inner">
                                            {debugStats}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}



                    {activeTab === 'SYNC_ABSENCES' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
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
                                                            <td className="p-3">{SUBJECT_LABELS[d.subject as Subject] || d.subject}</td>
                                                            <td className="p-3 text-center">{d.bimester}º</td>
                                                            <td className="p-3 text-center text-red-500 font-bold">{d.gradeValue}</td>
                                                            <td className="p-3 text-center text-blue-600 font-bold">{d.actualValue}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <Button
                                            onClick={fixAbsences}
                                            disabled={loading || selectedDiscrepancies.length === 0}
                                            className={`w-full py-6 text-lg font-black ${selectedDiscrepancies.length > 0 ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20' : 'bg-slate-300 cursor-not-allowed shadow-none'}`}
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
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
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
                                                            <td className="p-3">{SUBJECT_LABELS[g.subject as Subject] || g.subject}</td>
                                                            <td className="p-3">
                                                                <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-xl font-bold">
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
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                                <h4 className="font-bold text-slate-800 mb-2">Exclusão de Grades Horárias Fantasmas</h4>
                                <p className="text-sm text-slate-500 mb-6 font-medium">Remove registros de grade horária para uma unidade e série específica. Útil para limpar dados corrompidos que geram cálculos de C.H. Min. errados.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Unidade</label>
                                        <select
                                            value={selectedUnit}
                                            onChange={(e) => setSelectedUnit(e.target.value as SchoolUnit)}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-950/10"
                                        >
                                            {Object.values(SchoolUnit).map((value) => (
                                                <option key={value} value={value}>{UNIT_LABELS[value]}</option>
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
                                                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-xl font-bold">
                                                                    {s.items?.length || 0} aulas
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
                            <div className="bg-red-50 p-8 rounded-xl border-2 border-dashed border-red-200 text-center">
                                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                                    <AlertTriangle className="w-10 h-10" />
                                </div>
                                <h4 className="text-2xl font-black text-red-900 mb-3">RESET GLOBAL DE BOLETINS</h4>
                                <p className="text-red-700 max-w-lg mx-auto mb-8 font-medium">
                                    Esta ação apagará permanentemente **TODOS os lançamentos de notas e faltas** (coleção grades) de todas as unidades para o ano corrente.
                                    <br /><br />
                                    <span className="font-bold underline">Não afeta os dados de presença diária (attendance)</span>, apenas o que foi consolidado no boletim.
                                </p>

                                <Button onClick={runGlobalReset} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white px-12 py-4 rounded-xl text-xl font-black shadow-xl shadow-red-500/20">
                                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Database className="mr-2" />}
                                    Zerar Todo o Banco de Dados
                                </Button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'DEBUG_INSPECTOR' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                                <h4 className="font-bold text-slate-800 mb-4">Inspetor de Dados Brutos</h4>
                                <Button
                                    onClick={async () => {
                                        setLoading(true);
                                        try {
                                            const debugData: any[] = [];

                                            // Check Unit Doc
                                            const unitSnap = await getDoc(firebaseDoc(db, 'school_units', 'unit_bs'));
                                            debugData.push({
                                                type: 'UNIT DOC (unit_bs)',
                                                exists: unitSnap.exists(),
                                                data: unitSnap.exists() ? unitSnap.data() : 'N/A'
                                            });

                                            // Check Legacy Unit Doc
                                            const legacySnap = await getDoc(firebaseDoc(db, 'school_units', 'Boa Sorte'));
                                            debugData.push({
                                                type: 'LEGACY UNIT DOC (Boa Sorte)',
                                                exists: legacySnap.exists(),
                                                data: legacySnap.exists() ? legacySnap.data() : 'N/A'
                                            });

                                            // Check 1 Student
                                            const studentsSnap = await getDocs(query(collection(db, 'students'), limit(1)));
                                            if (!studentsSnap.empty) {
                                                const s = studentsSnap.docs[0].data();
                                                debugData.push({
                                                    type: `SAMPLE STUDENT (${s.name})`,
                                                    unit: s.unit,
                                                    id: studentsSnap.docs[0].id
                                                });
                                            } else {
                                                debugData.push("NO STUDENTS FOUND");
                                            }

                                            console.log("DEBUG DATA:", debugData);
                                            setDebugStats(JSON.stringify(debugData, null, 2));
                                        } catch (e) {
                                            console.error(e);
                                            setDebugStats("Erro ao inspecionar: " + e);
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    className="bg-purple-600 text-white px-6 py-2 rounded-lg mb-4"
                                >
                                    <Search className="w-4 h-4 mr-2" />
                                    Inspecionar Dados
                                </Button>
                                <pre className="bg-slate-900 text-green-400 p-4 rounded-xl text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                                    {debugStats || "Clique para inspecionar..."}
                                </pre>
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
