import React, { useState, useMemo } from 'react';
import { CalendarEvent } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info } from 'lucide-react';

interface SchoolCalendarProps {
    events: CalendarEvent[];
    academicSubjects?: any[]; // Keep as any[] or precise type to avoid deep imports if possible, but AcademicSubject[] is better
}

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const SchoolCalendar: React.FC<SchoolCalendarProps> = ({ events, academicSubjects }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString().split('T')[0]);

    // Navigation Helpers
    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        setSelectedDate(null);
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        setSelectedDate(null);
    };

    const jumpToToday = () => {
        const today = new Date();
        setCurrentDate(today);
        setSelectedDate(today.toISOString().split('T')[0]);
    };

    // Calendar Grid Logic
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

    const calendarGrid = useMemo(() => {
        const grid = [];
        // Empty cells for days before the 1st
        for (let i = 0; i < firstDayOfMonth; i++) {
            grid.push(null);
        }
        // Days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            grid.push(i);
        }
        return grid;
    }, [daysInMonth, firstDayOfMonth]);

    // Check for events on a specific day
    const getEventsForDay = (day: number) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return events.filter(e => {
            if (!e.endDate) {
                return e.startDate === dateStr;
            } else {
                return dateStr >= e.startDate && dateStr <= e.endDate;
            }
        });
    };

    const getEventColor = (type: string) => {
        switch (type) {
            case 'holiday_national':
            case 'holiday_state':
            case 'holiday_municipal':
            case 'holiday_school':
                return '#ef4444'; // red-500
            case 'vacation':
                return '#eab308'; // yellow-500
            case 'recess':
                return '#fb923c'; // orange-400
            case 'exam':
                return '#f97316'; // orange-500
            case 'meeting':
                return '#6b7280'; // gray-500
            case 'school_day':
                return '#22c55e'; // green-500
            case 'substitution':
                return '#a855f7'; // purple-500
            case 'event':
                return '#1e40af'; // blue-800
            default:
                return '#3b82f6';
        }
    };

    const getEventColorClass = (type: string) => {
        switch (type) {
            case 'holiday_national':
            case 'holiday_state':
            case 'holiday_municipal':
            case 'holiday_school':
                return 'bg-red-500';
            case 'vacation':
                return 'bg-yellow-500';
            case 'recess':
                return 'bg-orange-400';
            case 'exam':
                return 'bg-orange-500';
            case 'meeting':
                return 'bg-gray-500';
            case 'school_day':
                return 'bg-green-500';
            case 'substitution':
                return 'bg-purple-500';
            case 'event':
                return 'bg-blue-800';
            default:
                return 'bg-blue-500';
        }
    };

    const getEventLabel = (type: string) => {
        switch (type) {
            case 'holiday_national': return 'Feriado Nacional';
            case 'holiday_state': return 'Feriado Estadual';
            case 'holiday_municipal': return 'Feriado Municipal';
            case 'holiday_school': return 'Feriado Escolar';
            case 'vacation': return 'Férias';
            case 'recess': return 'Recesso';
            case 'school_day': return 'Letivo';
            case 'substitution': return 'Reposição';
            case 'exam': return 'Prova/Avaliação';
            case 'meeting': return 'Reunião';
            case 'event': return 'Evento Escolar';
            default: return 'Geral';
        }
    };

    // Events List for Selected Day or Month
    const filteredEvents = useMemo(() => {
        if (selectedDate) {
            return events.filter(e => {
                if (!e.endDate) {
                    return e.startDate === selectedDate;
                } else {
                    return selectedDate >= e.startDate && selectedDate <= e.endDate;
                }
            });
        }

        // If no day selected, show all events for the current YEAR
        const year = currentDate.getFullYear();
        const startOfYear = `${year}-01-01`;
        const endOfYear = `${year}-12-31`;

        return events.filter(e => {
            const eStart = e.startDate;
            const eEnd = e.endDate || e.startDate;

            // Overlap check with the year
            return (eStart <= endOfYear && eEnd >= startOfYear);
        }).sort((a, b) => a.startDate.localeCompare(b.startDate));
    }, [selectedDate, events, currentDate]);


    return (
        <div className="flex flex-col gap-6 animate-fade-in-up">


            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* CALENDAR GRID */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-blue-950 capitalize">
                            {MONTH_NAMES[currentDate.getMonth()]} <span className="text-gray-400">{currentDate.getFullYear()}</span>
                        </h2>
                        <div className="flex items-center gap-2">
                            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button onClick={jumpToToday} className="px-3 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors">
                                Hoje
                            </button>
                            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Week Days */}
                    <div className="grid mb-2" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                        {WEEK_DAYS.map(day => (
                            <div key={day} className="text-center text-[10px] md:text-xs font-bold text-gray-400 uppercase py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid gap-1 md:gap-2" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                        {calendarGrid.map((day, index) => {
                            if (day === null) return <div key={`empty-${index}`} className="aspect-square" />;

                            const allDayEvents = getEventsForDay(day);
                            const weekDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getDay();

                            // Filter events for visualization
                            const dayEvents = allDayEvents.filter(ev => {
                                if (ev.type === 'school_day') {
                                    // 1. Omit if weekend (0=Sun, 6=Sat)
                                    if (weekDay === 0 || weekDay === 6) return false;
                                    // 2. Omit if there's a holiday, recess or vacation on the same day
                                    const hasConflict = allDayEvents.some(other =>
                                        ['holiday_national', 'holiday_state', 'holiday_municipal', 'holiday_school', 'recess', 'vacation', 'exam'].includes(other.type)
                                    );
                                    if (hasConflict) return false;
                                }
                                return true;
                            });

                            const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();

                            const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const isSelected = selectedDate === dateString;

                            return (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDate(dateString)}
                                    className={`
                                        aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all border
                                        ${isSelected
                                            ? 'bg-blue-600 text-white shadow-lg scale-105 border-blue-600 z-10'
                                            : isToday
                                                ? 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
                                                : 'bg-white text-gray-700 border-gray-100 hover:border-blue-300 hover:shadow-sm'
                                        }
                                    `}
                                >
                                    <span className="text-sm md:text-base">{day}</span>

                                    {/* Event Dots */}
                                    <div className="flex gap-1 mt-1">
                                        {dayEvents.slice(0, 3).map((ev, i) => (
                                            <div
                                                key={i}
                                                className="w-1.5 h-1.5 rounded-full"
                                                style={{ backgroundColor: isSelected ? 'white' : getEventColor(ev.type) }}
                                            />
                                        ))}
                                        {dayEvents.length > 3 && (
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.5)' : '#d1d5db' }} />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend - More compact on mobile */}
                    <div className="flex flex-wrap gap-2 sm:gap-4 mt-6 border-t border-gray-100 pt-4 justify-center">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-gray-600">
                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: '#22c55e' }}></div> Letivo
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-gray-600">
                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: '#a855f7' }}></div> Reposição
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-gray-600">
                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: '#ef4444' }}></div> Feriado
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-gray-600">
                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: '#eab308' }}></div> Férias
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-gray-600">
                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: '#fb923c' }}></div> Recesso
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-gray-600">
                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: '#f97316' }}></div> Prova
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-gray-600">
                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: '#1e40af' }}></div> Evento/Geral
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-gray-600">
                            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ backgroundColor: '#6b7280' }}></div> Reunião
                        </div>
                    </div>
                </div>

                {/* EVENTS LIST (Sidebar) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col h-auto lg:h-full lg:max-h-[600px] overflow-visible lg:overflow-hidden">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span>Eventos</span>
                            {!selectedDate && (
                                <button
                                    onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-widest mt-0.5 text-left"
                                >
                                    ← Voltar ao Mês
                                </button>
                            )}
                        </div>
                        {selectedDate ? (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </span>
                        ) : (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">
                                Todo o Ano
                            </span>
                        )}
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {filteredEvents.length > 0 ? (
                            filteredEvents.map(ev => (
                                <div key={ev.id} className="group p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all bg-gray-50/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <span
                                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
                                            style={{ backgroundColor: getEventColor(ev.type) }}
                                        >
                                            {getEventLabel(ev.type)}
                                        </span>
                                        {!selectedDate && (
                                            <span className="text-xs font-bold text-gray-500">
                                                {new Date(ev.startDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-gray-800 text-sm mb-1">{ev.title}</h4>
                                    {ev.targetSubjectIds && ev.targetSubjectIds.length > 0 && academicSubjects && (
                                        <div className="mb-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">Disciplina(s):</span>
                                            <div className="flex flex-wrap gap-1">
                                                {ev.targetSubjectIds.map(sid => {
                                                    const subName = academicSubjects.find(s => s.id === sid)?.name || 'Desconhecida';
                                                    return (
                                                        <span key={sid} className="text-[10px] bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600 font-semibold">
                                                            {subName}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {ev.description && (
                                        <p className="text-xs text-gray-600 leading-relaxed">{ev.description}</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Nenhum evento encontrado para este período.</p>
                            </div>
                        )}
                    </div>
                    {selectedDate && (
                        <button
                            onClick={() => setSelectedDate(null)}
                            className="w-full mt-4 py-2 border border-blue-200 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors"
                        >
                            Ver Todos do Ano
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
