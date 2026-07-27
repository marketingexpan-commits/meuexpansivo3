import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { SchoolUnit, DailyAgenda, Teacher, ClassSchedule, SchoolShift, SHIFT_LABELS, UnitContact, CoordinationSegment } from '../types';
import { useAcademicData } from '../hooks/useAcademicData';
import { SCHOOL_CLASSES_LIST, SCHOOL_SHIFTS_LIST } from '../constants';
import { Loader2, BookCheck, AlertCircle, CheckCircle2, ChevronDown, User, Calendar as CalendarIcon, Filter, Eye } from 'lucide-react';
import { parseGradeLevel, formatDateWithTimeBr } from '../utils/academicUtils';

interface CoordinatorAgendaReportProps {
    unit: SchoolUnit;
    coordinator: UnitContact;
}

export const CoordinatorAgendaReport: React.FC<CoordinatorAgendaReportProps> = ({ unit, coordinator }) => {
    const { grades, subjects, schedules, loading: academicLoading } = useAcademicData();
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedGradeId, setSelectedGradeId] = useState<string>('all');
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [selectedShift, setSelectedShift] = useState<string>('all');
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'pending' | 'partial'>('all');

    const [agendas, setAgendas] = useState<DailyAgenda[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewingAgenda, setViewingAgenda] = useState<DailyAgenda | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!date) return;
            setLoading(true);
            try {
                // Fetch Agendas for the selected date and unit
                const agendaSnap = await db.collection('daily_agenda')
                    .where('unit', '==', unit)
                    .where('date', '==', date)
                    .get();

                const fetchedAgendas = agendaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAgenda));
                setAgendas(fetchedAgendas);

                // Fetch Teachers for the unit
                if (teachers.length === 0) {
                    const teachersSnap = await db.collection('teachers').get();
                    // Filter by unit to ensure strict mapping
                    const fetchedTeachers = teachersSnap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() } as Teacher))
                        .filter(t => t.unit === unit);
                    setTeachers(fetchedTeachers);
                }
            } catch (error) {
                console.error("Error fetching agenda report data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [date, unit, teachers.length]);

    const expectedSchedules = useMemo(() => {
        if (!date || academicLoading) return [];
        const dateObj = new Date(date + 'T12:00:00');
        const targetDay = dateObj.getDay();

        let baseSchedules = schedules.filter(sch => {
            if (sch.schoolId !== unit) return false;
            if (sch.dayOfWeek !== targetDay) return false;
            return true;
        });

        const eChildSchedules: ClassSchedule[] = [];
        const existingClassSignatures = new Set(baseSchedules.map(s => `${s.grade}-${s.class}-${s.shift}`));

        teachers.forEach(teacher => {
            if (teacher.unit !== unit) return;
            teacher.assignments?.forEach(a => {
                const gradeId = a.gradeId || a.gradeLevel;
                if (!gradeId) return;

                const parsed = parseGradeLevel(gradeId);
                if (parsed.segmentId === 'seg_infantil') {
                    const postedClassesForGrade = agendas
                        .filter(ag => ag.teacherId === teacher.id && (ag.gradeLevel === gradeId || parseGradeLevel(ag.gradeLevel).grade === parsed.grade) && ag.shift === a.shift)
                        .map(ag => ag.schoolClass);

                    let classesToAdd = Array.from(new Set(postedClassesForGrade));

                    if (classesToAdd.length === 0) {
                        classesToAdd = ['Única'];
                    }

                    classesToAdd.forEach(cls => {
                        const sig = `${gradeId}-${cls}-${a.shift}`;
                        if (!existingClassSignatures.has(sig)) {
                            existingClassSignatures.add(sig);
                            eChildSchedules.push({
                                id: `syn-${sig}`,
                                schoolId: unit,
                                grade: gradeId,
                                class: cls,
                                shift: a.shift,
                                dayOfWeek: targetDay,
                                items: [{ startTime: '00:00', endTime: '23:59', subject: 'general_early_childhood' }],
                                lastUpdated: new Date().toISOString()
                            });
                        }
                    });
                }
            });
        });

        const allSchedules = [...baseSchedules, ...eChildSchedules];

        return allSchedules.filter(sch => {
            if (selectedGradeId !== 'all' && sch.grade !== selectedGradeId) return false;
            if (selectedClass !== 'all' && sch.class !== selectedClass && sch.class !== 'Única') return false;
            if (selectedShift !== 'all' && sch.shift !== selectedShift) return false;

            if (selectedSubjectId !== 'all') {
                if (!sch.items || !sch.items.some(item => item.subject === selectedSubjectId)) {
                    return false;
                }
            }

            return true;
        });
    }, [schedules, date, selectedGradeId, selectedClass, selectedShift, selectedSubjectId, unit, academicLoading, teachers, agendas]);

    // Grouping status by teacher
    const reportData = useMemo(() => {
        let data = teachers.map(teacher => {
            const teacherSchedules = expectedSchedules.filter(sch => {
                // First, try to match via formal assignments (gradeId/gradeLevel + shift + optional class)
                const matchedByAssignment = teacher.assignments?.some(a => {
                    const gradeMatch = (a.gradeId === sch.grade || a.gradeLevel === sch.grade);
                    const shiftMatch = a.shift === sch.shift;
                    // If assignment has a specific class, also validate it
                    const classMatch = !a.class || a.class === sch.class || sch.class === 'Única';
                    return gradeMatch && shiftMatch && classMatch;
                });
                if (matchedByAssignment) return true;

                // Fallback: teacher has gradeIds/gradeLevels but no formal assignments — only include if
                // the schedule's shift matches the teacher's own shift field (respect turno!)
                if (!teacher.assignments || teacher.assignments.length === 0) {
                    const gradeMatch = teacher.gradeIds?.includes(sch.grade) || teacher.gradeLevels?.includes(sch.grade);
                    const shiftMatch = !teacher.shift || teacher.shift === sch.shift;
                    return !!(gradeMatch && shiftMatch);
                }

                return false;
            });

            if (teacherSchedules.length === 0) return null;

            const teacherAgendas = agendas.filter(a => a.teacherId === teacher.id);

            const scheduleDetails: Array<{ grade: string, gradeName: string, class: string, shift: string, expectedSubjects: { id: string, name: string, posted: boolean }[] }> = [];

            teacherSchedules.forEach(sch => {
                let teacherSubjectsForSch: string[] = [];
                const assignment = teacher.assignments?.find(a => (a.gradeId === sch.grade || a.gradeLevel === sch.grade) && a.shift === sch.shift);
                if (assignment && assignment.subjects) {
                    teacherSubjectsForSch = assignment.subjects;
                } else if (teacher.subjects) {
                    teacherSubjectsForSch = teacher.subjects as unknown as string[];
                }

                const scheduleSubjects = Array.from(new Set(sch.items?.map(i => i.subject) || []));

                const parsedGrade = parseGradeLevel(sch.grade);
                const isEarlyChildhoodSch = parsedGrade.segmentId === 'seg_infantil';

                if (isEarlyChildhoodSch && teacherSubjectsForSch.length === 0) {
                    teacherSubjectsForSch = ['general_early_childhood'];
                }

                let expectedSubjectIds: string[] = [];

                if (isEarlyChildhoodSch) {
                    expectedSubjectIds = ['general_early_childhood'];
                } else {
                    let relevantScheduleSubjects = scheduleSubjects;
                    if (selectedSubjectId !== 'all') {
                        relevantScheduleSubjects = relevantScheduleSubjects.filter(sub => sub === selectedSubjectId);
                    }
                    expectedSubjectIds = relevantScheduleSubjects.filter(subId => teacherSubjectsForSch.includes(subId));

                    if (expectedSubjectIds.length === 0 && teacherSubjectsForSch.length === 0) {
                        expectedSubjectIds = relevantScheduleSubjects;
                    }
                }

                if (expectedSubjectIds.length > 0) {
                    const gradeName = grades.find(g => g.id === sch.grade)?.name || sch.grade;

                    const expectedSubjects = expectedSubjectIds.map(subId => {
                        const subName = isEarlyChildhoodSch ? 'Geral (Ens. Infantil)' : (subjects.find(s => s.id === subId)?.name || subId);
                        const posted = teacherAgendas.some(a =>
                            a.gradeLevel === gradeName &&
                            a.schoolClass === sch.class &&
                            a.subject === subId
                        );
                        return { id: subId, name: subName, posted };
                    });

                    scheduleDetails.push({
                        grade: sch.grade,
                        gradeName,
                        class: sch.class,
                        shift: sch.shift,
                        expectedSubjects
                    });
                }
            });

            if (scheduleDetails.length === 0) return null;

            const totalExpected = scheduleDetails.reduce((acc, sch) => acc + sch.expectedSubjects.length, 0);
            const totalPosted = scheduleDetails.reduce((acc, sch) => acc + sch.expectedSubjects.filter(s => s.posted).length, 0);

            let overallStatus: 'posted' | 'pending' | 'partial' = 'pending';
            if (totalPosted === totalExpected && totalExpected > 0) overallStatus = 'posted';
            else if (totalPosted > 0) overallStatus = 'partial';

            return {
                teacherId: teacher.id,
                teacher: teacher,
                agendas: teacherAgendas,
                scheduleDetails,
                overallStatus,
                totalExpected,
                totalPosted
            };
        }).filter(Boolean) as Array<{
            teacherId: string,
            teacher: Teacher,
            agendas: DailyAgenda[],
            scheduleDetails: Array<{ grade: string, gradeName: string, class: string, shift: string, expectedSubjects: { id: string, name: string, posted: boolean }[] }>,
            overallStatus: 'posted' | 'pending' | 'partial',
            totalExpected: number,
            totalPosted: number
        }>;

        if (statusFilter !== 'all') {
            data = data.filter(d => d.overallStatus === statusFilter);
        }

        // Sort: pending first, partial second, posted last, then alphabetically
        return data.sort((a, b) => {
            const statusOrder = { 'pending': 0, 'partial': 1, 'posted': 2 };
            if (a.overallStatus !== b.overallStatus) {
                return statusOrder[a.overallStatus] - statusOrder[b.overallStatus];
            }
            return (a.teacher.name || '').localeCompare(b.teacher.name || '');
        });

    }, [expectedSchedules, agendas, teachers, selectedGradeId, selectedClass, selectedSubjectId, statusFilter, grades, subjects]);

    const postedCount = useMemo(() => reportData.filter(d => d.overallStatus === 'posted').length, [reportData]);
    const pendingCount = useMemo(() => reportData.filter(d => d.overallStatus === 'pending' || d.overallStatus === 'partial').length, [reportData]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header and Summary */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-blue-950 tracking-tight flex items-center gap-2 mb-2">
                        <BookCheck className="w-6 h-6 text-orange-600" />
                        Relatório de Agendas Diárias
                    </h2>
                    <p className="text-sm text-gray-500 font-medium">Acompanhe as postagens de agenda diária dos professores da unidade.</p>
                </div>

                <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 w-full md:w-auto">
                    <div className="text-center px-4 border-r border-gray-200">
                        <p className="text-2xl font-black text-green-600 leading-none">{postedCount}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Postaram</p>
                    </div>
                    <div className="text-center px-4">
                        <p className="text-2xl font-black text-red-500 leading-none">{pendingCount}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Faltam</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Filtros de Busca</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 ml-1 tracking-widest">Data da Aula</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-950 outline-none font-bold text-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 ml-1 tracking-widest">Série</label>
                        <select
                            value={selectedGradeId}
                            onChange={(e) => setSelectedGradeId(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-950 outline-none font-bold text-gray-700"
                        >
                            <option value="all">Todas as Séries</option>
                            {grades
                                .filter(g => g.isActive)
                                .filter(g => {
                                    // 1. If coordinator has specific gradeIds assigned, use them
                                    if (coordinator.gradeIds && coordinator.gradeIds.length > 0) {
                                        return coordinator.gradeIds.includes(g.id);
                                    }

                                    // 2. Fallback to Segment based filtering
                                    if (coordinator.segment === CoordinationSegment.GERAL || !coordinator.segment) return true;
                                    
                                    const infantilFund1 = ['seg_infantil', 'seg_fund_1'];
                                    const fund2Medio = ['seg_fund_2', 'seg_medio'];
                                    
                                    if (coordinator.segment === CoordinationSegment.INFANTIL_FUND1) return infantilFund1.includes(g.segmentId);
                                    if (coordinator.segment === CoordinationSegment.FUND2_MEDIO) return fund2Medio.includes(g.segmentId);
                                    if (coordinator.segment === CoordinationSegment.BOTH) return true;
                                    
                                    return true;
                                })
                                .map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 ml-1 tracking-widest">Turma</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-950 outline-none font-bold text-gray-700"
                        >
                            <option value="all">Todas as Turmas</option>
                            {SCHOOL_CLASSES_LIST.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 ml-1 tracking-widest">Turno</label>
                        <select
                            value={selectedShift}
                            onChange={(e) => setSelectedShift(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-950 outline-none font-bold text-gray-700"
                        >
                            <option value="all">Todos os Turnos</option>
                            {SCHOOL_SHIFTS_LIST.map(s => (
                                <option key={s} value={s}>{SHIFT_LABELS[s as SchoolShift] || s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 ml-1 tracking-widest">Disciplina</label>
                        <select
                            value={selectedSubjectId}
                            onChange={(e) => setSelectedSubjectId(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-950 outline-none font-bold text-gray-700"
                        >
                            <option value="all">Todas as Disciplinas</option>
                            {subjects.filter(s => s.isActive).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-2 mt-6 border-t border-gray-100 pt-6 flex-wrap">
                    {(['all', 'pending', 'partial', 'posted'] as const).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setStatusFilter(filter)}
                            className={`px-4 py-2 text-xs font-bold rounded-full transition-all border ${statusFilter === filter
                                ? filter === 'pending' ? 'bg-red-50 text-red-600 border-red-200'
                                    : filter === 'partial' ? 'bg-orange-50 text-orange-600 border-orange-200'
                                        : filter === 'posted' ? 'bg-green-50 text-green-700 border-green-200'
                                            : 'bg-blue-950 text-white border-blue-950 shadow-md'
                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {filter === 'all' && 'Todos os Professores'}
                            {filter === 'pending' && 'Pendentes'}
                            {filter === 'partial' && 'Parciais'}
                            {filter === 'posted' && 'Postados'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content List */}
            {loading || academicLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
                    <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">Processando vínculos e relatórios...</p>
                </div>
            ) : expectedSchedules.length === 0 && selectedGradeId !== 'all' ? (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-300">
                    <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium text-sm">Nenhuma grade horária encontrada para esta data e filtros.</p>
                </div>
            ) : reportData.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-300">
                    <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium text-sm">Nenhum professor encontrado com os filtros selecionados.</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* Cabeçalho Desktop */}
                        <div className="hidden md:grid md:grid-cols-12 gap-4 bg-gray-50 border-b border-gray-100 px-6 py-4">
                            <div className="col-span-12 md:col-span-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Professor</div>
                            <div className="col-span-12 md:col-span-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Turmas (Aulas Esperadas)</div>
                            <div className="col-span-12 md:col-span-3 text-[10px] items-center font-black uppercase tracking-widest text-gray-400 md:text-right">Status da Agenda</div>
                        </div>

                        <div className="divide-y divide-gray-100">
                            {reportData.map((item) => (
                                <div key={item.teacherId} className="flex flex-col md:grid md:grid-cols-12 gap-4 md:items-start p-6 hover:bg-gray-50/50 transition-colors group">

                                    {/* Info do Professor */}
                                    <div className="col-span-12 md:col-span-4 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200">
                                            <span className="text-blue-900 font-black text-xs uppercase">
                                                {(item.teacher.name || '?').substring(0, 2)}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm group-hover:text-blue-950 transition-colors">{item.teacher.name || 'Professor não especificado'}</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                                {item.agendas.length} Registros postados
                                            </p>
                                        </div>
                                    </div>

                                    {/* Turmas e Disciplinas */}
                                    <div className="col-span-12 md:col-span-5 flex flex-col gap-3 mt-2 md:mt-0">
                                        <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Turmas (Aulas Esperadas)</div>
                                        <div className="flex flex-col gap-3">
                                            {item.scheduleDetails.map((sch, idx) => (
                                                <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-3 shadow-sm w-full">
                                                    <p className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                                                        <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                                                        {sch.gradeName} - {sch.class} ({SHIFT_LABELS[sch.shift as SchoolShift] || sch.shift})
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {sch.expectedSubjects.map((sub, sIdx) => {
                                                            const matchingAgenda = sub.posted ? item.agendas.find(a =>
                                                                a.gradeLevel === sch.gradeName &&
                                                                a.schoolClass === sch.class &&
                                                                a.subject === sub.id
                                                            ) : undefined;

                                                            return (
                                                                <button
                                                                    key={sIdx}
                                                                    type="button"
                                                                    disabled={!sub.posted}
                                                                    onClick={() => matchingAgenda && setViewingAgenda(matchingAgenda)}
                                                                    title={sub.posted ? "Clique para visualizar a agenda" : "Agenda pendente"}
                                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all ${
                                                                        sub.posted
                                                                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:border-green-300 cursor-pointer active:scale-95'
                                                                            : 'bg-red-50 text-red-600 border-red-200 cursor-default opacity-80'
                                                                    }`}
                                                                >
                                                                    {sub.posted ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                                                                    {sub.name}
                                                                    {sub.posted && <Eye className="w-3 h-3 ml-0.5 text-green-700/70" />}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-12 md:col-span-3 flex flex-row items-center justify-between md:justify-end mt-4 md:mt-0 pt-4 border-t border-gray-100 md:border-t-0 md:pt-0">
                                        <div className="md:hidden text-[10px] font-black uppercase tracking-widest text-gray-400">Status da Agenda</div>
                                        {item.overallStatus === 'posted' ? (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-200 shadow-sm whitespace-nowrap">
                                                <CheckCircle2 className="w-4 h-4" />
                                                <span className="text-xs font-black uppercase tracking-wider">Postado ({item.totalPosted}/{item.totalExpected})</span>
                                            </div>
                                        ) : item.overallStatus === 'partial' ? (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full border border-orange-200 shadow-sm whitespace-nowrap">
                                                <AlertCircle className="w-4 h-4" />
                                                <span className="text-xs font-black uppercase tracking-wider">Parcial ({item.totalPosted}/{item.totalExpected})</span>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-full border border-red-200 shadow-sm whitespace-nowrap">
                                                <AlertCircle className="w-4 h-4" />
                                                <span className="text-xs font-black uppercase tracking-wider">Pendente ({item.totalPosted}/{item.totalExpected})</span>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE VISUALIZAÇÃO DA AGENDA DIÁRIA */}
            {viewingAgenda && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in-up">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100 flex flex-col">
                        {/* Header */}
                        <div className="bg-white p-6 flex justify-between items-center sticky top-0 z-10 border-b border-gray-100 rounded-t-3xl">
                            <div>
                                <h2 className="text-gray-950 text-lg font-black tracking-tight">Detalhes da Agenda</h2>
                                <p className="text-gray-500 text-xs mt-0.5">Visualização do Coordenador</p>
                            </div>
                            <button
                                onClick={() => setViewingAgenda(null)}
                                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-all active:scale-95"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 text-left overflow-y-auto">
                            {/* Meta Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-gray-100 pb-5">
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Disciplina</label>
                                    <p className="text-sm font-black text-gray-800">
                                        {viewingAgenda.subject === 'general_early_childhood'
                                            ? 'Geral (Ens. Infantil)'
                                            : (subjects.find(s => s.id === viewingAgenda.subject)?.name || viewingAgenda.subject)}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Professor(a)</label>
                                    <p className="text-sm font-bold text-gray-700">{viewingAgenda.teacherName || 'Não informado'}</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Série / Turma / Turno</label>
                                    <p className="text-xs font-medium text-gray-600">
                                        {viewingAgenda.gradeLevel} - {viewingAgenda.schoolClass} ({SHIFT_LABELS[viewingAgenda.shift as SchoolShift] || viewingAgenda.shift})
                                    </p>
                                </div>
                                <div className="md:text-right">
                                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Data da Aula</label>
                                    <span className="inline-flex text-blue-900 font-bold bg-blue-50 px-3 py-1 rounded-full text-xs border border-blue-100">
                                        {new Date(viewingAgenda.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                    </span>
                                    {viewingAgenda.timestamp && (
                                        <p className="text-[10px] text-gray-400 mt-1">Postado em: {formatDateWithTimeBr(viewingAgenda.timestamp)}</p>
                                    )}
                                </div>
                            </div>

                            {/* Conteúdo em Sala */}
                            <div>
                                <label className="block text-blue-950 text-xs uppercase font-extrabold mb-2 tracking-wider">Conteúdo em Sala</label>
                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/60 text-gray-700 whitespace-pre-wrap leading-relaxed text-sm shadow-inner">
                                    {viewingAgenda.contentInClass || <span className="text-gray-400 italic font-medium">Nenhum conteúdo informado.</span>}
                                </div>
                            </div>

                            {/* Tarefa de Casa */}
                            <div>
                                <label className="block text-orange-700 text-xs uppercase font-extrabold mb-2 tracking-wider">Trabalho para Casa / Tarefas</label>
                                <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 text-orange-950 whitespace-pre-wrap leading-relaxed text-sm shadow-inner">
                                    {viewingAgenda.homework || <span className="text-gray-400 italic font-medium">Nenhuma tarefa informada.</span>}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-gray-50 flex justify-end border-t border-gray-100 rounded-b-3xl">
                            <button
                                type="button"
                                onClick={() => setViewingAgenda(null)}
                                className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all text-xs uppercase tracking-wider active:scale-95"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
