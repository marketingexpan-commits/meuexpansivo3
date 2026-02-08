import React, { useState, useEffect } from 'react';
import { CalendarEvent, EventType, SchoolUnit } from '../types';
import { db } from '../firebaseConfig';

import { MOCK_CALENDAR_EVENTS, SCHOOL_UNITS_LIST } from '../constants';
import { Button } from './Button';
import { X, Plus, Trash2, Calendar as CalendarIcon, Save, AlertCircle, Clock, Database, Globe } from 'lucide-react';

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

    // Filter unit for Admin view
    const [filterUnit, setFilterUnit] = useState<string>(isAdmin ? 'all' : unit);

    useEffect(() => {
        if (!isOpen) return;

        let query = db.collection('calendar_events');

        if (filterUnit !== 'all') {
            // @ts-ignore
            query = query.where('units', 'array-contains-any', [filterUnit, 'all']);
        }

        const unsubscribe = query.onSnapshot((snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent));
            // Sort in memory to avoid needing a composite index
            data.sort((a, b) => a.startDate.localeCompare(b.startDate));
            setEvents(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching events:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, filterUnit]);

    const handleSeedData = async () => {
        const targetUnit = isAdmin ? filterUnit : unit;
        if (targetUnit === 'all') {
            alert("Por favor, selecione uma unidade específica para importar os dados padrão.");
            return;
        }

        if (!window.confirm(`Deseja importar os eventos padrão para a unidade ${targetUnit}?`)) return;
        setIsSaving(true);
        try {
            const batch = db.batch();
            MOCK_CALENDAR_EVENTS.forEach(event => {
                const { id, ...eventData } = event; // Remove mock id
                const docRef = db.collection('calendar_events').doc();
                batch.set(docRef, { ...eventData, units: [targetUnit], createdAt: new Date().toISOString() });
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
        // Check for units array or unit string for legacy compatibility during save
        const unitToSave = (editingEvent as any).unit || (editingEvent?.units && editingEvent.units[0]);

        if (!editingEvent?.title || !editingEvent?.startDate || !editingEvent?.type || !unitToSave) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        setIsSaving(true);
        try {
            // Standardize to units array
            const units = (editingEvent as any).unit ? [(editingEvent as any).unit] : (editingEvent?.units || []);

            const data: any = {
                ...editingEvent,
                units,
                updatedAt: new Date().toISOString()
            };
            delete data.unit; // Remove legacy unit field if present

            if (editingEvent.id) {
                await db.collection('calendar_events').doc(editingEvent.id).update(data);
            } else {
                await db.collection('calendar_events').add({
                    ...data,
                    createdAt: new Date().toISOString()
                });
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

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este evento?")) return;
        try {
            await db.collection('calendar_events').doc(id).delete();
        } catch (error) {
            console.error("Error deleting event:", error);
            alert("Erro ao excluir evento.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                            <CalendarIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 tracking-tight leading-none">Gerenciar Calendário {isAdmin && '(Painel Admin)'}</h2>
                            <p className="text-xs text-gray-500 font-medium mt-1">Lançamento de eventos e datas importantes</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-gray-50/50">
                    {/* List View */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div className="space-y-1">
                                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Próximos Eventos ({events.length})
                                </h3>
                                {isAdmin && (
                                    <select
                                        className="text-xs font-bold text-purple-600 bg-purple-50 border-none rounded-lg p-1 outline-none"
                                        value={filterUnit}
                                        onChange={(e) => setFilterUnit(e.target.value)}
                                    >
                                        <option value="all">Todas as Unidades</option>
                                        {SCHOOL_UNITS_LIST.map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {events.length === 0 && !loading && (
                                    <Button
                                        variant="secondary"
                                        onClick={handleSeedData}
                                        disabled={isSaving}
                                        className="text-[10px] py-1.5 px-3 flex items-center gap-2 border-dashed border-purple-200 text-purple-600"
                                    >
                                        <Database className="w-3 h-3" />
                                        Semear Padrão
                                    </Button>
                                )}
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        setEditingEvent({
                                            type: 'event',
                                            startDate: new Date().toISOString().split('T')[0],
                                            units: [isAdmin ? (filterUnit === 'all' ? 'all' : filterUnit) : unit]
                                        } as any);
                                        setIsFormOpen(true);
                                    }}
                                    className="!bg-purple-600 hover:!bg-purple-700 text-xs py-2 px-4 flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Novo Evento
                                </Button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-12 text-gray-400">Carregando eventos...</div>
                        ) : events.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                                <p className="text-gray-500 italic">Nenhum evento cadastrado para {filterUnit === 'all' ? 'estas unidades' : filterUnit}.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {events.map(event => (
                                    <div key={event.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-purple-200 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-gray-50 text-gray-600 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                                                <span className="text-[10px] font-black uppercase leading-none">{new Date(event.startDate + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                                                <span className="text-lg font-bold leading-none">{new Date(event.startDate + 'T00:00:00').getDate()}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${event.type === 'holiday_national' || event.type === 'holiday_state' || event.type === 'holiday_municipal' ? 'bg-red-100 text-red-600' :
                                                            event.type === 'exam' ? 'bg-orange-100 text-orange-600' :
                                                                event.type === 'meeting' ? 'bg-gray-100 text-gray-600' :
                                                                    event.type === 'school_day' ? 'bg-green-100 text-green-600' :
                                                                        event.type === 'substitution' ? 'bg-purple-100 text-purple-600' :
                                                                            event.type === 'vacation' ? 'bg-yellow-100 text-yellow-600' :
                                                                                event.type === 'recess' ? 'bg-orange-50 text-orange-500' :
                                                                                    'bg-blue-100 text-blue-600'
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
                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-purple-100 text-purple-600 flex items-center gap-1">
                                                            {event.units && event.units.includes('all') ? < Globe className="w-2.5 h-2.5" /> : null}
                                                            {event.units && event.units.includes('all') ? 'Toda Rede' : (event.units ? event.units.join(', ') : 'N/A')}
                                                        </span>
                                                    )}
                                                    {event.endDate && (
                                                        <span className="text-[10px] text-gray-400">Até {new Date(event.endDate + 'T00:00:00').toLocaleDateString()}</span>
                                                    )}
                                                </div>
                                                <h4 className="font-bold text-gray-900 leading-tight">{event.title}</h4>
                                                {event.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{event.description}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingEvent(event); setIsFormOpen(true); }}
                                                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                            >
                                                <Save className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(event.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                        <div className="w-full md:w-80 bg-white border-l border-gray-100 p-6 shadow-xl animate-in slide-in-from-right-full duration-300">
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
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                                        value={editingEvent?.title || ''}
                                        onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
                                        required
                                    />
                                </div>

                                {isAdmin && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Unidade Destino</label>
                                        <select
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                                            value={(editingEvent as any)?.unit || (editingEvent?.units && editingEvent.units[0]) || 'all'}
                                            onChange={e => setEditingEvent({ ...editingEvent, units: [e.target.value] } as any)}
                                            required
                                        >
                                            <option value="all">Todas as Unidades (Geral)</option>
                                            {SCHOOL_UNITS_LIST.map(u => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Data Início</label>
                                        <input
                                            type="date"
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                                            value={editingEvent?.startDate || ''}
                                            onChange={e => setEditingEvent({ ...editingEvent, startDate: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Data Fim (Op.)</label>
                                        <input
                                            type="date"
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none"
                                            value={editingEvent?.endDate || ''}
                                            onChange={e => setEditingEvent({ ...editingEvent, endDate: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Tipo de Evento</label>
                                    <select
                                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none"
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

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Descrição (Op.)</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Detalhes adicionais..."
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                        value={editingEvent?.description || ''}
                                        onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })}
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full py-3 !bg-purple-600 hover:!bg-purple-700 text-white font-black rounded-xl shadow-lg mt-4"
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
                </div>
            </div>
        </div>
    );
};
