import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { ClassSchedule, ScheduleItem, Student } from '../types';
import { Clock, Calendar, ChevronLeft, ChevronRight, Info } from 'lucide-react';

interface ScheduleTimelineProps {
    student: Student;
}

const DAYS_OF_WEEK = [
    { id: 1, name: 'Segunda', short: 'SEG' },
    { id: 2, name: 'Terça', short: 'TER' },
    { id: 3, name: 'Quarta', short: 'QUA' },
    { id: 4, name: 'Quinta', short: 'QUI' },
    { id: 5, name: 'Sexta', short: 'SEX' },
    { id: 6, name: 'Sábado', short: 'SÁB' }
];

export const ScheduleTimeline: React.FC<ScheduleTimelineProps> = ({ student }) => {
    const [selectedDay, setSelectedDay] = useState(() => {
        const today = new Date().getDay();
        // 1 = Segunda, 2 = Terça, ..., 6 = Sábado. 
        // Se for Domingo (0), retorna Segunda (1).
        return (today >= 1 && today <= 6) ? today : 1;
    });
    const [schedule, setSchedule] = useState<ClassSchedule | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchSchedule();
    }, [selectedDay, student.unit, student.gradeLevel, student.schoolClass, student.shift]);

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const snapshot = await db.collection('class_schedules')
                .where('schoolId', '==', student.unit)
                .where('grade', '==', student.gradeLevel)
                .where('class', '==', student.schoolClass)
                .where('shift', '==', student.shift)
                .where('dayOfWeek', '==', selectedDay)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                setSchedule(snapshot.docs[0].data() as ClassSchedule);
            } else {
                setSchedule(null);
            }
        } catch (error) {
            console.error("Error fetching student schedule:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in text-left">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-blue-950 flex items-center gap-2">
                    <Clock className="w-6 h-6" />
                    Grade Horária
                </h3>
            </div>

            {/* Day Selector */}
            <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-1.5 mb-8 shadow-inner">
                {DAYS_OF_WEEK.map(day => (
                    <button
                        key={day.id}
                        onClick={() => setSelectedDay(day.id)}
                        className={`flex-1 py-3 px-2 rounded-xl text-center transition-all duration-300 ${selectedDay === day.id
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
                                    <h4 className="text-lg font-bold text-gray-800 tracking-tight">{item.subject}</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-8 p-4 bg-orange-50 rounded-2xl border border-orange-100 flex gap-3">
                <Info className="w-5 h-5 text-orange-400 shrink-0" />
                <p className="text-xs text-orange-800 leading-relaxed font-medium">
                    Lembre-se de chegar com 10 minutos de antecedência para organizar seus materiais.
                </p>
            </div>
        </div>
    );
};
