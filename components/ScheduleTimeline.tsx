import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { ClassSchedule, ScheduleItem, SchoolUnit, SchoolShift, UNIT_LABELS, SHIFT_LABELS, AcademicSubject } from '../types';
import { resolveGradeId, normalizeUnit, normalizeShift } from '../src/utils/academicUtils';
import { Clock, Calendar, Printer, Info, Mail, Phone, MapPin } from 'lucide-react';
import { useAcademicData } from '../hooks/useAcademicData';
import { UNITS_DATA, DEFAULT_UNIT_DATA } from '../src/constants';
import { SchoolLogo } from './SchoolLogo';

interface ScheduleTimelineProps {
    unit: string;
    grade: string;
    schoolClass: string;
    shift: string;
    studentName?: string; // Optional: for display in header
    title?: string; // Optional override for print title
}

const DAYS_OF_WEEK = [
    { id: 1, name: 'Segunda', short: 'SEG' },
    { id: 2, name: 'Terça', short: 'TER' },
    { id: 3, name: 'Quarta', short: 'QUA' },
    { id: 4, name: 'Quinta', short: 'QUI' },
    { id: 5, name: 'Sexta', short: 'SEX' },
    { id: 6, name: 'Sábado', short: 'SÁB' }
];

export const ScheduleTimeline: React.FC<ScheduleTimelineProps> = ({
    unit,
    grade,
    schoolClass,
    shift,
    studentName,
    title
}) => {
    const { subjects: academicSubjects } = useAcademicData();
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() === 0 ? 1 : new Date().getDay());
    const [schedule, setSchedule] = useState<ClassSchedule | null>(null);
    const [loading, setLoading] = useState(false);
    const [fullScheduleForPrint, setFullScheduleForPrint] = useState<ClassSchedule[] | null>(null);

    // HELPER: Normalize inputs to ensure we query with Technical IDs (what is in DB)
    const normalizedUnit = useMemo(() => normalizeUnit(unit), [unit]);
    const normalizedShift = useMemo(() => normalizeShift(shift), [shift]);

    // Data for the school unit
    const unitData = useMemo(() => {
        const label = UNIT_LABELS[normalizedUnit as SchoolUnit];
        return UNITS_DATA[label] || DEFAULT_UNIT_DATA;
    }, [normalizedUnit]);

    // HELPER: Resolve technical Grade ID (e.g. "8º Ano - Fundamental II" -> "grade_8_ano")
    const resolvedGradeId = useMemo(() => resolveGradeId(grade), [grade]);

    useEffect(() => {
        if (normalizedUnit && resolvedGradeId && schoolClass && normalizedShift) {
            fetchSchedule();
        }
    }, [selectedDay, normalizedUnit, resolvedGradeId, schoolClass, normalizedShift]);


    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const snapshot = await db.collection('class_schedules')
                .where('schoolId', '==', normalizedUnit)
                .where('grade', '==', resolvedGradeId)
                .where('class', '==', schoolClass)
                .where('shift', '==', normalizedShift)
                .where('dayOfWeek', '==', selectedDay)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                setSchedule(snapshot.docs[0].data() as ClassSchedule);
            } else {
                setSchedule(null);
            }
        } catch (error) {
            console.error("Error fetching schedule:", error);
            setSchedule(null);
        } finally {
            setLoading(false);
        }
    };

    const handlePrintAll = async () => {
        setLoading(true);
        try {
            const snapshot = await db.collection('class_schedules')
                .where('schoolId', '==', normalizedUnit)
                .where('grade', '==', resolvedGradeId)
                .where('class', '==', schoolClass)
                .where('shift', '==', normalizedShift)
                .get();

            if (snapshot.empty) {
                alert("Não há horários cadastrados para imprimir.");
                return;
            }

            const allDays = snapshot.docs.map(doc => doc.data() as ClassSchedule);
            allDays.sort((a, b) => a.dayOfWeek - b.dayOfWeek);

            setFullScheduleForPrint(allDays);

            setTimeout(() => {
                window.print();
                setFullScheduleForPrint(null);
            }, 500);
        } catch (error) {
            console.error("Error fetching full schedule:", error);
            alert("Erro ao carregar horários para impressão.");
        } finally {
            setLoading(false);
        }
    };

    // DYNAMIC SCALING LOGIC:
    const printDensity = useMemo(() => {
        if (!fullScheduleForPrint) return 'normal';
        const maxItems = Math.max(...fullScheduleForPrint.map(s => s.items?.length || 0));
        if (maxItems > 10) return 'ultra-tight';
        if (maxItems > 8) return 'tight';
        return 'normal';
    }, [fullScheduleForPrint]);

    const densityStyles = {
        'ultra-tight': { itemPadding: 'py-1 px-1.5', fontSize: 'text-[9px]', timeSize: 'text-[8px]', gap: 'gap-1' },
        'tight': { itemPadding: 'py-1.5 px-2', fontSize: 'text-[10px]', timeSize: 'text-[9px]', gap: 'gap-2' },
        'normal': { itemPadding: 'py-2 px-3', fontSize: 'text-xs', timeSize: 'text-[10px]', gap: 'gap-3' }
    }[printDensity];

    return (
        <div className="animate-fade-in text-left">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-blue-950 flex items-center gap-2">
                    <Clock className="w-6 h-6" />
                    Grade Horária
                </h3>
                <button
                    onClick={handlePrintAll}
                    disabled={loading}
                    className="p-2 bg-blue-50 text-blue-950 rounded-xl hover:bg-blue-100 transition-colors shadow-sm flex items-center gap-2 text-xs font-bold"
                    title="Imprimir Grade Completa"
                >
                    <Printer className="w-5 h-5" />
                    <span className="hidden sm:inline">Imprimir</span>
                </button>
            </div>

            {/* Day Selector */}
            <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1.5 mb-8 shadow-inner overflow-x-auto scrollbar-hide">
                {DAYS_OF_WEEK.map(day => (
                    <button
                        key={day.id}
                        onClick={() => setSelectedDay(day.id)}
                        className={`flex-1 min-w-[75px] shrink-0 py-3 px-2 rounded-xl text-center transition-all duration-300 ${selectedDay === day.id
                            ? 'bg-blue-950 text-white shadow-lg scale-105'
                            : 'text-gray-500 hover:bg-white hover:text-blue-950'
                            }`}
                    >
                        <span className="block text-[10px] font-bold uppercase tracking-tighter opacity-70 mb-0.5">{day.short}</span>
                        <span className="block text-xs font-black">{day.name.split('-')[0]}</span>
                    </button>
                ))}
            </div>

            <div className="relative min-h-[300px]">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 z-10 rounded-2xl">
                        <div className="w-10 h-10 border-4 border-blue-950 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : !schedule || !schedule.items || schedule.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-blue-50/30 rounded-3xl border-2 border-dashed border-blue-100">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                            <Calendar className="w-8 h-8 text-blue-200" />
                        </div>
                        <p className="text-blue-900/60 font-bold text-center px-6">
                            Ainda não há horários cadastrados <br /> para {DAYS_OF_WEEK.find(d => d.id === selectedDay)?.name}.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-0 pl-4 relative">
                        {/* Vertical line connector */}
                        <div className="absolute left-[23px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-blue-950/20 via-blue-950/5 to-transparent"></div>

                        {schedule.items.map((item, index) => (
                            <div key={index} className="relative flex gap-6 pb-8 last:pb-0 group">
                                {/* Bullet Point */}
                                <div className="relative z-10 mt-1.5 transition-transform group-hover:scale-125 duration-300">
                                    <div className="w-4 h-4 rounded-full bg-blue-950 border-[3px] border-white shadow-sm"></div>
                                    <div className="absolute inset-0 rounded-full bg-blue-950 animate-ping opacity-20 group-hover:opacity-40"></div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 bg-white p-4 rounded-2xl border border-blue-100/50 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="w-4 h-4 text-blue-950" />
                                        <span className="text-xs font-black text-blue-950 tracking-wide uppercase">
                                            {item.startTime} <span className="mx-1 opacity-30 text-xs">às</span> {item.endTime}
                                        </span>
                                    </div>
                                    <h4 className="text-lg font-bold text-gray-800 tracking-tight">
                                        {academicSubjects?.find((s: AcademicSubject) => s.id === item.subject)?.name || item.subject}
                                    </h4>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-8 p-4 bg-orange-50 rounded-2xl border border-orange-100 flex gap-3">
                <span className="w-5 h-5 text-orange-400 shrink-0">
                    <Info className="w-5 h-5" />
                </span>
                <p className="text-xs text-orange-800 leading-relaxed font-medium">
                    Lembre-se de chegar com 10 minutos de antecedência para organizar seus materiais.
                </p>
            </div>

            {/* Print-only View */}
            {fullScheduleForPrint && (
                <div className="hidden print:block absolute top-0 left-0 w-full bg-white z-[200] p-6 text-left overflow-visible min-h-screen">
                    {/* PRINT STYLES */}
                    <style>{`
                        @media print {
                            @page { size: landscape; margin: 5mm; }
                            body { margin: 0; padding: 0; background: white; }
                        }
                    `}</style>

                    <div className="flex justify-between items-start mb-4 border-b-2 border-blue-950 pb-4">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="w-16">
                                <SchoolLogo variant="header" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-extrabold text-blue-950 uppercase tracking-wide leading-none mb-1">EXPANSIVO REDE DE ENSINO</h2>
                                <h1 className="text-xl font-bold text-gray-700 uppercase tracking-tight mb-1 leading-none">Grade Horária</h1>
                                <p className="text-sm font-bold text-gray-500 leading-tight uppercase mb-0.5">
                                    {grade} - Turma {schoolClass} - {SHIFT_LABELS[normalizedShift as SchoolShift] || shift}
                                </p>
                                <div className="flex items-start gap-4 text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                                    <p className="flex items-center gap-1"><MapPin className="w-3 h-3 text-blue-900" /> {unitData.address}</p>
                                    <p className="flex items-center gap-1"><Info className="w-3 h-3 text-blue-900" /> CNPJ: {unitData.cnpj}</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-black text-blue-950 uppercase tracking-widest leading-none mb-1">Unidade {UNIT_LABELS[normalizedUnit as SchoolUnit] || unit}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ano Letivo 2026</p>
                            <div className="mt-2 flex flex-col items-end gap-1 text-[9px] text-gray-500">
                                {unitData.phone && <p className="flex items-center gap-1 font-bold"><Phone className="w-2.5 h-2.5" /> {unitData.phone}</p>}
                                {unitData.email && <p className="flex items-center gap-1 lowercase"><Mail className="w-2.5 h-2.5" /> {unitData.email}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Column 1: Mon, Tue, Wed */}
                        <div className="flex flex-col gap-2">
                            {DAYS_OF_WEEK.slice(0, 3).map(day => {
                                const daySchedule = fullScheduleForPrint.find(s => s.dayOfWeek === day.id);
                                return (
                                    <div key={day.id} className="flex flex-col mb-1 last:mb-0">
                                        <div className="bg-blue-950 text-white py-1 px-2 rounded-t-lg text-center text-[9px] font-black uppercase mb-1 shadow-sm">
                                            {day.name}
                                        </div>
                                        <div className={`flex flex-col ${densityStyles.gap}`}>
                                            {daySchedule?.items && daySchedule.items.length > 0 ? (
                                                daySchedule.items.map((item, idx) => (
                                                    <div key={idx} className={`${densityStyles.itemPadding} bg-white border border-gray-200 rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]`}>
                                                        <div className={`font-black text-blue-950 ${densityStyles.timeSize} mb-0.5 border-b border-blue-50/50 pb-0.5`}>
                                                            {item.startTime} - {item.endTime}
                                                        </div>
                                                        <div className={`font-bold text-gray-800 leading-[1.1] uppercase ${densityStyles.fontSize} break-words`}>
                                                            {academicSubjects?.find((s: AcademicSubject) => s.id === item.subject)?.label ||
                                                                academicSubjects?.find((s: AcademicSubject) => s.id === item.subject)?.name ||
                                                                item.subject}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-2 text-gray-300 italic text-[8px] border border-dashed border-gray-100 rounded-lg">
                                                    Sem Disciplinas
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Column 2: Thu, Fri, Sat */}
                        <div className="flex flex-col gap-2">
                            {DAYS_OF_WEEK.slice(3, 6).map(day => {
                                const daySchedule = fullScheduleForPrint.find(s => s.dayOfWeek === day.id);
                                return (
                                    <div key={day.id} className="flex flex-col mb-1 last:mb-0">
                                        <div className="bg-blue-950 text-white py-1 px-2 rounded-t-lg text-center text-[9px] font-black uppercase mb-1 shadow-sm">
                                            {day.name}
                                        </div>
                                        <div className={`flex flex-col ${densityStyles.gap}`}>
                                            {daySchedule?.items && daySchedule.items.length > 0 ? (
                                                daySchedule.items.map((item, idx) => (
                                                    <div key={idx} className={`${densityStyles.itemPadding} bg-white border border-gray-200 rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]`}>
                                                        <div className={`font-black text-blue-950 ${densityStyles.timeSize} mb-0.5 border-b border-blue-50/50 pb-0.5`}>
                                                            {item.startTime} - {item.endTime}
                                                        </div>
                                                        <div className={`font-bold text-gray-800 leading-[1.1] uppercase ${densityStyles.fontSize} break-words`}>
                                                            {academicSubjects?.find((s: AcademicSubject) => s.id === item.subject)?.label ||
                                                                academicSubjects?.find((s: AcademicSubject) => s.id === item.subject)?.name ||
                                                                item.subject}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-2 text-gray-300 italic text-[8px] border border-dashed border-gray-100 rounded-lg">
                                                    Sem Disciplinas
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between items-center opacity-60">
                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest italic">
                            EXPANSIVO REDE DE ENSINO - Meu Expansivo App
                        </div>
                        <div className="text-[9px] text-gray-400 font-medium font-mono uppercase">
                            Gerado em {new Date().toLocaleDateString()} às {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
