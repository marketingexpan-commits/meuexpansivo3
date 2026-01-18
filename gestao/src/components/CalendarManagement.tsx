import React, { useState, useEffect } from 'react';
import type { CalendarEvent, EventType, AcademicSettings } from '../types';
import { db } from '../firebaseConfig';
import { subscribeToAcademicSettings, updateAcademicSettings, syncBimesterFromEvent } from '../services/academicSettings';
import { useAcademicData } from '../hooks/useAcademicData';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    writeBatch,
    orderBy
} from 'firebase/firestore';

import { MOCK_CALENDAR_EVENTS, SCHOOL_UNITS_LIST } from '../constants';
import { Button } from './Button';
import { X, Plus, Trash2, Calendar as CalendarIcon, Clock, Database, Globe, Edit2, Settings, Save, AlertCircle, Printer } from 'lucide-react';
import { generateSchoolCalendar } from '../utils/calendarGenerator';

interface CalendarManagementProps {
    isOpen: boolean;
    onClose: () => void;
    unit: string; // Current unit (for coordinators)
    isAdmin?: boolean;
}

export const CalendarManagement: React.FC<CalendarManagementProps> = ({ isOpen, onClose, unit, isAdmin }) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Partial<CalendarEvent> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'events' | 'settings'>('events');

    // Academic Settings State
    const [academicSettings, setAcademicSettings] = useState<AcademicSettings | null>(null);

    // Filter unit for Admin view
    const [filterUnit, setFilterUnit] = useState<string>(isAdmin ? 'all' : unit);

    // Academic Data for scoping
    const { segments, grades } = useAcademicData();

    useEffect(() => {
        if (!isOpen) return;
        const unsubscribe = subscribeToAcademicSettings(2026, filterUnit, (settings) => {
            setAcademicSettings(settings);
        });
        return () => unsubscribe();
    }, [isOpen, filterUnit]);

    useEffect(() => {
        if (!isOpen) return;

        const eventsRef = collection(db, 'calendar_events');
        let q;

        if (filterUnit !== 'all') {
            q = query(eventsRef, where('units', 'array-contains-any', [filterUnit, 'all']), orderBy('startDate', 'asc'));
        } else {
            q = query(eventsRef, orderBy('startDate', 'asc'));
        }

        const unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent));
            setEvents(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching events:", error);
            // Fallback if index missing for orderby
            if (error.code === 'failed-precondition') {
                // Try without orderBy if index not ready
                const qSimple = filterUnit !== 'all' ? query(eventsRef, where('units', 'array-contains-any', [filterUnit, 'all'])) : eventsRef;
                onSnapshot(qSimple, (snap) => {
                    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent));
                    data.sort((a, b) => a.startDate.localeCompare(b.startDate));
                    setEvents(data);
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [isOpen, filterUnit]);

    const handleSeedData = async () => {
        const targetUnit = isAdmin ? filterUnit : unit;

        const confirmMsg = targetUnit === 'all'
            ? "Deseja importar os eventos padrão para TODAS as unidades da rede? (Isso pode criar duplicatas se já existirem eventos)"
            : `Deseja importar os eventos padrão para a unidade ${targetUnit}?`;

        if (!window.confirm(confirmMsg)) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            MOCK_CALENDAR_EVENTS.forEach(event => {
                const { id, ...eventData } = event; // Remove mock id
                const docRef = doc(collection(db, 'calendar_events'));
                const finalUnits = targetUnit === 'all' ? ['all'] : [targetUnit];
                batch.set(docRef, { ...eventData, units: finalUnits, createdAt: new Date().toISOString() });
                // NEW: Sync bimester dates if this is a key event
                syncBimesterFromEvent(eventData.title, eventData.startDate, targetUnit, 2026, eventData.endDate);
            });
            await batch.commit();
            alert("Eventos importados com sucesso!");
        } catch (error) {
            console.error("Error seeding events:", error);
            alert("Erro ao importar eventos.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEvent?.title || !editingEvent?.startDate || !editingEvent?.type || !editingEvent?.units || editingEvent.units.length === 0) {
            alert("Por favor, preencha todos os campos obrigatórios (título, data, tipo e ao menos uma unidade).");
            return;
        }

        setIsSaving(true);
        try {
            const data = {
                ...editingEvent,
                updatedAt: new Date().toISOString()
            };

            if (editingEvent.id) {
                const docRef = doc(db, 'calendar_events', editingEvent.id);
                await updateDoc(docRef, data);
            } else {
                await addDoc(collection(db, 'calendar_events'), {
                    ...data,
                    createdAt: new Date().toISOString()
                });
            }
            // NEW: Sync bimester dates if this is a key event
            if (data.title && data.startDate) {
                const targetUnits = data.units || [];
                for (const u of targetUnits) {
                    syncBimesterFromEvent(data.title as string, data.startDate as string, u, 2026, data.endDate as string);
                }
            }
            setIsFormOpen(false);
            setEditingEvent(null);
        } catch (error) {
            console.error("Error saving event:", error);
            alert("Erro ao salvar evento.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAllEvents = async () => {
        const targetUnit = isAdmin ? filterUnit : unit;
        const confirmMsg = targetUnit === 'all'
            ? "ATENÇÃO: Você está prestes a apagar TODOS os eventos de TODAS as unidades. Esta ação não pode ser desfeita. Deseja continuar?"
            : `Deseja apagar todos os eventos da unidade ${targetUnit}? Esta ação não pode ser desfeita.`;

        if (!window.confirm(confirmMsg)) return;

        // Final double check for 'all'
        if (targetUnit === 'all' && !window.confirm("CONFIRMAÇÃO FINAL: Apagar tudo mesmo?")) return;

        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            events.forEach(event => {
                batch.delete(doc(db, 'calendar_events', event.id));
            });
            await batch.commit();
            alert("Todos os eventos foram removidos com sucesso.");
        } catch (error) {
            console.error("Error deleting all events:", error);
            alert("Erro ao apagar todos os eventos.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este evento?")) return;
        try {
            await deleteDoc(doc(db, 'calendar_events', id));
        } catch (error) {
            console.error("Error deleting event:", error);
            alert("Erro ao excluir evento.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-xl text-blue-950">
                            <CalendarIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 tracking-tight leading-none">
                                Gerenciar Calendário {isAdmin ? '(Painel Admin)' : `- ${unit}`}
                            </h2>
                            <div className="flex items-center gap-4 mt-2">
                                <button
                                    onClick={() => setActiveTab('events')}
                                    className={`text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${activeTab === 'events' ? 'text-blue-950 border-b-2 border-blue-950' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Eventos
                                </button>
                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className={`text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${activeTab === 'settings' ? 'text-blue-950 border-b-2 border-blue-950' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Configurações
                                </button>
                                {isAdmin && (
                                    <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
                                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                                        <select
                                            className="text-[10px] font-black uppercase tracking-widest text-blue-900 bg-blue-50/50 border-none rounded-xl py-1 px-2 outline-none cursor-pointer hover:bg-blue-100 transition-colors"
                                            value={filterUnit}
                                            onChange={(e) => setFilterUnit(e.target.value)}
                                        >
                                            <option value="all">Rede (Padrão)</option>
                                            {SCHOOL_UNITS_LIST.map(u => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <button
                                    onClick={() => generateSchoolCalendar(events, academicSettings, filterUnit)}
                                    className="flex items-center gap-1.5 ml-4 px-3 py-1 bg-white border border-gray-200 text-gray-500 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-gray-50 hover:text-blue-950 transition-all shadow-sm active:scale-95 cursor-pointer"
                                    title="Imprimir Calendário Escolar"
                                >
                                    <Printer className="w-3 h-3" />
                                    Imprimir
                                </button>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 p-2 rounded-xl hover:bg-gray-100 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-gray-50/50">
                    {activeTab === 'events' ? (
                        <>
                            {/* List View */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            Próximos Eventos ({events.length})
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(events.length === 0 || isAdmin) && !loading && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="secondary"
                                                    onClick={handleSeedData}
                                                    disabled={isSaving}
                                                    className="text-[10px] py-1.5 px-3 flex items-center gap-2 border-dashed border-blue-950/20 text-blue-950"
                                                >
                                                    <Database className="w-3 h-3" />
                                                    Semear Padrão
                                                </Button>

                                                {isAdmin && events.length > 0 && (
                                                    <Button
                                                        variant="secondary"
                                                        onClick={handleDeleteAllEvents}
                                                        disabled={isSaving}
                                                        className="text-[10px] py-1.5 px-3 flex items-center gap-2 border-dashed border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        Apagar Tudo
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                        <Button
                                            variant="primary"
                                            onClick={() => {
                                                setEditingEvent({
                                                    type: 'event',
                                                    startDate: new Date().toISOString().split('T')[0],
                                                    units: isAdmin ? (filterUnit === 'all' ? ['all'] : [filterUnit]) : [unit]
                                                });
                                                setIsFormOpen(true);
                                            }}
                                            className="!bg-blue-950 hover:!bg-slate-900 text-xs py-2 px-4 flex items-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Novo Evento
                                        </Button>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="text-center py-12 text-gray-400">Carregando eventos...</div>
                                ) : events.length === 0 ? (
                                    <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
                                        <p className="text-gray-500 italic">Nenhum evento cadastrado para {filterUnit === 'all' ? 'estas unidades' : filterUnit}.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {events.map(event => (
                                            <div key={event.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-blue-950/30 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-gray-50 text-gray-600 group-hover:bg-blue-50 group-hover:text-blue-950 transition-colors">
                                                        <span className="text-[10px] font-black uppercase leading-none">{new Date(event.startDate + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                                                        <span className="text-lg font-bold leading-none">{new Date(event.startDate + 'T00:00:00').getDate()}</span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-xl uppercase tracking-wider text-white ${event.type === 'holiday_national' || event.type === 'holiday_state' || event.type === 'holiday_municipal' ? 'bg-red-500' :
                                                                event.type === 'exam' ? 'bg-orange-500' :
                                                                    event.type === 'meeting' ? 'bg-gray-500' :
                                                                        event.type === 'school_day' ? 'bg-green-500' :
                                                                            event.type === 'substitution' ? 'bg-purple-500' :
                                                                                event.type === 'vacation' ? 'bg-yellow-500' :
                                                                                    event.type === 'recess' ? 'bg-orange-400' :
                                                                                        'bg-blue-800'
                                                                }`}>
                                                                {event.type === 'holiday_national' ? 'Feriado Nacional' :
                                                                    event.type === 'holiday_state' ? 'Feriado Estadual' :
                                                                        event.type === 'holiday_municipal' ? 'Feriado Municipal' :
                                                                            event.type === 'exam' ? 'Prova' :
                                                                                event.type === 'meeting' ? 'Reunião' :
                                                                                    event.type === 'school_day' ? 'Letivo' :
                                                                                        event.type === 'substitution' ? 'Reposição' :
                                                                                            event.type === 'vacation' ? 'Férias' :
                                                                                                event.type === 'recess' ? 'Recesso' : 'Evento'}
                                                            </span>
                                                            {isAdmin && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {event.units?.includes('all') ? (
                                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-xl uppercase tracking-wider bg-blue-950/10 text-blue-950 flex items-center gap-1">
                                                                            <Globe className="w-2.5 h-2.5" />
                                                                            Toda Rede
                                                                        </span>
                                                                    ) : (
                                                                        event.units?.map(u => (
                                                                            <span key={u} className="text-[9px] font-bold px-2 py-0.5 rounded-xl uppercase tracking-wider bg-blue-950/10 text-blue-950">
                                                                                {u}
                                                                            </span>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            )}
                                                            {event.endDate && (
                                                                <span className="text-[10px] text-gray-400">Até {new Date(event.endDate + 'T00:00:00').toLocaleDateString()}</span>
                                                            )}
                                                        </div>
                                                        <h4 className="font-bold text-gray-900 leading-tight">{event.title}</h4>
                                                        {(event.type === 'school_day' || event.type === 'substitution') && event.substituteDayLabel && (
                                                            <p className="text-[10px] font-bold text-purple-600 mt-0.5 uppercase tracking-tight">
                                                                Substitui: {event.substituteDayLabel}
                                                            </p>
                                                        )}
                                                        {event.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{event.description}</p>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => { setEditingEvent(event); setIsFormOpen(true); }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-blue-950 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(event.id)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Form Sidebar / Overlay */}
                            {isFormOpen && (
                                <div className="w-full md:w-80 bg-white border-l border-gray-100 p-6 shadow-xl animate-in slide-in-from-right-full duration-300 overflow-y-auto custom-scrollbar">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-black text-gray-900 uppercase tracking-wider text-sm">
                                            {editingEvent?.id ? 'Editar Evento' : 'Novo Evento'}
                                        </h3>
                                        <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-red-500">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <form onSubmit={handleSave} className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Título</label>
                                            <input
                                                type="text"
                                                placeholder="Ex: Início das Aulas"
                                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-950 outline-none"
                                                value={editingEvent?.title || ''}
                                                onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
                                                required
                                            />
                                        </div>

                                        {isAdmin && (
                                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Unidades Destino</label>
                                                <div className="space-y-2">
                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-gray-300 text-blue-950 focus:ring-blue-950"
                                                            checked={editingEvent?.units?.includes('all')}
                                                            onChange={e => {
                                                                if (e.target.checked) setEditingEvent({ ...editingEvent, units: ['all'] });
                                                                else setEditingEvent({ ...editingEvent, units: [] });
                                                            }}
                                                        />
                                                        <span className="text-sm font-bold text-gray-700 group-hover:text-blue-950 transition-colors">Toda Rede (Geral)</span>
                                                    </label>

                                                    <div className="h-px bg-gray-200 my-2" />

                                                    <div className="grid grid-cols-1 gap-2">
                                                        {SCHOOL_UNITS_LIST.map(u => (
                                                            <label key={u} className={`flex items-center gap-2 cursor-pointer group ${editingEvent?.units?.includes('all') ? 'opacity-50 pointer-events-none' : ''}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-gray-300 text-blue-950 focus:ring-blue-950"
                                                                    disabled={editingEvent?.units?.includes('all')}
                                                                    checked={editingEvent?.units?.includes(u)}
                                                                    onChange={e => {
                                                                        const current = editingEvent?.units || [];
                                                                        if (e.target.checked) {
                                                                            setEditingEvent({ ...editingEvent, units: [...current.filter(x => x !== 'all'), u] });
                                                                        } else {
                                                                            setEditingEvent({ ...editingEvent, units: current.filter(x => x !== u) });
                                                                        }
                                                                    }}
                                                                />
                                                                <span className="text-sm font-medium text-gray-600 group-hover:text-blue-950 transition-colors">{u}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Data Início</label>
                                                <input
                                                    type="date"
                                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-950 outline-none"
                                                    value={editingEvent?.startDate || ''}
                                                    onChange={e => setEditingEvent({ ...editingEvent, startDate: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Data Fim (Op.)</label>
                                                <input
                                                    type="date"
                                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-950 outline-none"
                                                    value={editingEvent?.endDate || ''}
                                                    onChange={e => setEditingEvent({ ...editingEvent, endDate: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Tipo de Evento</label>
                                            <select
                                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-950 outline-none"
                                                value={editingEvent?.type || 'event'}
                                                onChange={e => setEditingEvent({ ...editingEvent, type: e.target.value as EventType })}
                                                required
                                            >
                                                <option value="event">Evento / Geral</option>
                                                <option value="school_day">Letivo</option>
                                                <option value="substitution">Reposição</option>
                                                <option value="holiday_national">Feriado Nacional</option>
                                                <option value="holiday_state">Feriado Estadual</option>
                                                <option value="holiday_municipal">Feriado Municipal</option>
                                                <option value="vacation">Férias</option>
                                                <option value="recess">Recesso</option>
                                                <option value="meeting">Reunião</option>
                                                <option value="exam">Prova / Avaliação</option>
                                            </select>
                                        </div>

                                        {(editingEvent?.type === 'school_day' || editingEvent?.type === 'substitution') && (
                                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 animate-in slide-in-from-top-2 duration-200">
                                                <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                    <Clock className="w-3 h-3" />
                                                    Substituição de Grade
                                                </label>
                                                <p className="text-[10px] text-purple-700/70 mb-3 leading-relaxed">
                                                    Selecione qual dia da semana este evento letivo deve seguir. A grade horária deste dia será usada.
                                                </p>
                                                <select
                                                    className="w-full p-2.5 bg-white border border-purple-200 rounded-xl text-sm font-bold text-purple-900 focus:ring-2 focus:ring-purple-500 outline-none"
                                                    value={editingEvent?.substituteDayOfWeek ?? ''}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (val === '') {
                                                            const { substituteDayOfWeek, substituteDayLabel, ...rest } = editingEvent || {};
                                                            setEditingEvent(rest);
                                                        } else {
                                                            const dayMap: Record<string, string> = {
                                                                '1': 'Segunda-feira',
                                                                '2': 'Terça-feira',
                                                                '3': 'Quarta-feira',
                                                                '4': 'Quinta-feira',
                                                                '5': 'Sexta-feira',
                                                                '6': 'Sábado',
                                                                '0': 'Domingo'
                                                            };
                                                            setEditingEvent({
                                                                ...editingEvent,
                                                                substituteDayOfWeek: parseInt(val),
                                                                substituteDayLabel: dayMap[val]
                                                            });
                                                        }
                                                    }}
                                                >
                                                    <option value="">Nenhuma (Usa dia real)</option>
                                                    <option value="1">Segunda-feira</option>
                                                    <option value="2">Terça-feira</option>
                                                    <option value="3">Quarta-feira</option>
                                                    <option value="4">Quinta-feira</option>
                                                    <option value="5">Sexta-feira</option>
                                                </select>

                                                <div className="mt-4 space-y-3 pt-3 border-t border-purple-100">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-widest mb-1">Escopo: Segmento (Op.)</label>
                                                        <select
                                                            className="w-full p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none"
                                                            value={editingEvent?.targetSegments?.[0] || ''}
                                                            onChange={e => setEditingEvent({
                                                                ...editingEvent,
                                                                targetSegments: e.target.value ? [e.target.value] : []
                                                            })}
                                                        >
                                                            <option value="">Para todos os Segmentos</option>
                                                            {segments.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-widest mb-1">Escopo: Série (Op.)</label>
                                                        <select
                                                            className="w-full p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none"
                                                            value={editingEvent?.targetGrades?.[0] || ''}
                                                            onChange={e => setEditingEvent({
                                                                ...editingEvent,
                                                                targetGrades: e.target.value ? [e.target.value] : []
                                                            })}
                                                        >
                                                            <option value="">Para todas as Séries</option>
                                                            {grades.filter(g => {
                                                                const selectedSegName = editingEvent?.targetSegments?.[0];
                                                                if (!selectedSegName) return true;
                                                                const segObj = segments.find(s => s.name === selectedSegName);
                                                                return segObj ? g.segmentId === segObj.id : true;
                                                            }).map(g => (
                                                                <option key={g.id} value={g.name}>{g.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-widest mb-1">Escopo: Turma (Op.)</label>
                                                        <select
                                                            className="w-full p-2 bg-white border border-purple-200 rounded-lg text-xs font-bold text-purple-900 outline-none"
                                                            value={editingEvent?.targetClasses?.[0] || ''}
                                                            onChange={e => setEditingEvent({
                                                                ...editingEvent,
                                                                targetClasses: e.target.value ? [e.target.value] : []
                                                            })}
                                                        >
                                                            <option value="">Para todas as Turmas</option>
                                                            {['A', 'B', 'C', 'D', 'E'].map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Descrição (Op.)</label>
                                            <textarea
                                                rows={3}
                                                placeholder="Detalhes adicionais..."
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-950 resize-none"
                                                value={editingEvent?.description || ''}
                                                onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })}
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={isSaving}
                                            className="w-full py-3 !bg-blue-950 hover:!bg-slate-900 text-white font-black rounded-xl shadow-lg mt-4"
                                        >
                                            {isSaving ? 'Salvando...' : editingEvent?.id ? 'Atualizar Evento' : 'Salvar Evento'}
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={() => { setIsFormOpen(false); setEditingEvent(null); }}
                                            className="w-full py-2 text-xs"
                                        >
                                            Cancelar
                                        </Button>
                                    </form>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-8 bg-white">
                            <div className="max-w-2xl mx-auto">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="p-3 bg-blue-50 rounded-xl text-blue-950">
                                        <Settings className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Datas dos Bimestres</h3>
                                        <p className="text-sm text-gray-500">Defina os períodos letivos para o ano de {academicSettings?.year || 2026}</p>
                                    </div>
                                </div>

                                {academicSettings ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {academicSettings.bimesters.map((bim, idx) => (
                                                <div key={bim.number} className="p-5 rounded-xl bg-gray-50 border border-gray-100 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="font-black text-blue-950 uppercase tracking-wider text-sm">{bim.label}</h4>
                                                        <div className={`p-1.5 rounded-xl ${academicSettings.currentBimester === bim.number ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-400 cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-colors'}`}
                                                            onClick={() => updateAcademicSettings(academicSettings.id, { currentBimester: bim.number }, academicSettings.unit, academicSettings.year)}
                                                        >
                                                            <Save className="w-4 h-4" />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Início</label>
                                                            <input
                                                                type="date"
                                                                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-950 outline-none"
                                                                value={bim.startDate}
                                                                onChange={e => {
                                                                    const newBimesters = [...academicSettings.bimesters];
                                                                    newBimesters[idx] = { ...newBimesters[idx], startDate: e.target.value };
                                                                    updateAcademicSettings(academicSettings.id, { bimesters: newBimesters }, academicSettings.unit, academicSettings.year);
                                                                }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Fim</label>
                                                            <input
                                                                type="date"
                                                                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-950 outline-none"
                                                                value={bim.endDate}
                                                                onChange={e => {
                                                                    const newBimesters = [...academicSettings.bimesters];
                                                                    newBimesters[idx] = { ...newBimesters[idx], endDate: e.target.value };
                                                                    updateAcademicSettings(academicSettings.id, { bimesters: newBimesters }, academicSettings.unit, academicSettings.year);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex gap-3 text-orange-800">
                                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                            <div className="text-xs leading-relaxed">
                                                <p className="font-bold mb-1 uppercase tracking-tight">Nota Importante</p>
                                                Alterar essas datas afetará o cálculo de frequência, a visibilidade de avaliações no portal do aluno e os prazos de lançamento de notas para os professores.
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-400">Carregando configurações...</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
