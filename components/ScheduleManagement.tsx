import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { ClassSchedule, SchoolUnit, ScheduleItem, SchoolClass, SchoolShift } from '../types';
import { SCHOOL_CLASSES_LIST, SUBJECT_LIST, SCHOOL_GRADES_LIST, SCHOOL_SHIFTS_LIST } from '../constants';
import { Button } from './Button';
import {
    Clock,
    Plus,
    Trash2,
    Copy,
    Save,
    Calendar,
    AlertCircle
} from 'lucide-react';

interface ScheduleManagementProps {
    unit: SchoolUnit;
    isReadOnly?: boolean;
}

const DAYS_OF_WEEK = [
    { id: 1, name: 'Segunda-feira' },
    { id: 2, name: 'Terça-feira' },
    { id: 3, name: 'Quarta-feira' },
    { id: 4, name: 'Quinta-feira' },
    { id: 5, name: 'Sexta-feira' },
    { id: 6, name: 'Sábado' }
];

export const ScheduleManagement: React.FC<ScheduleManagementProps> = ({ unit, isReadOnly = false }) => {
    const [selectedGrade, setSelectedGrade] = useState(SCHOOL_GRADES_LIST[0]);
    const [selectedClass, setSelectedClass] = useState<SchoolClass>(SchoolClass.A);
    const [selectedShift, setSelectedShift] = useState<SchoolShift>(SchoolShift.MORNING);
    const [selectedDay, setSelectedDay] = useState(1);
    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Copy Feature State
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [copySourceGrade, setCopySourceGrade] = useState(SCHOOL_GRADES_LIST[0]);
    const [copySourceClass, setCopySourceClass] = useState<SchoolClass>(SchoolClass.A);
    const [copySourceShift, setCopySourceShift] = useState<SchoolShift>(SchoolShift.MORNING);

    useEffect(() => {
        fetchSchedule();
    }, [selectedGrade, selectedClass, selectedShift, selectedDay]);

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const snapshot = await db.collection('class_schedules')
                .where('schoolId', '==', unit)
                .where('grade', '==', selectedGrade)
                .where('class', '==', selectedClass)
                .where('shift', '==', selectedShift)
                .where('dayOfWeek', '==', selectedDay)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const data = snapshot.docs[0].data() as ClassSchedule;
                setItems(data.items || []);
            } else {
                setItems([]);
            }
        } catch (error) {
            console.error("Error fetching schedule:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = () => {
        setItems([...items, { startTime: '', endTime: '', subject: SUBJECT_LIST[0] }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleUpdateItem = (index: number, field: keyof ScheduleItem, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        // Basic sort by startTime
        newItems.sort((a, b) => a.startTime.localeCompare(b.startTime));
        setItems(newItems);
    };

    const handleSave = async () => {
        if (loading || saving) return;
        setSaving(true);
        try {
            const scheduleId = `${unit}_${selectedGrade}_${selectedClass}_${selectedShift}_${selectedDay}`.replace(/\s+/g, '_');

            await db.collection('class_schedules').doc(scheduleId).set({
                schoolId: unit,
                grade: selectedGrade,
                class: selectedClass,
                shift: selectedShift,
                dayOfWeek: selectedDay,
                items: items,
                lastUpdated: new Date().toISOString()
            });

            alert("Grade salva com sucesso!");
        } catch (error) {
            console.error("Error saving schedule:", error);
            alert("Erro ao salvar a grade.");
        } finally {
            setSaving(false);
        }
    };

    const handleCopySchedule = async () => {
        if (copySourceGrade === selectedGrade && copySourceClass === selectedClass && copySourceShift === selectedShift) {
            alert("A turma de origem não pode ser a mesma da atual.");
            return;
        }

        if (!confirm(`Deseja copiar TODA a grade (Segunda a Sábado) de ${copySourceGrade} - ${copySourceClass} (${copySourceShift}) para a turma atual?`)) return;

        setLoading(true);
        try {
            // Fetch all 5 days from source
            const snapshot = await db.collection('class_schedules')
                .where('schoolId', '==', unit)
                .where('grade', '==', copySourceGrade)
                .where('class', '==', copySourceClass)
                .where('shift', '==', copySourceShift)
                .get();

            if (snapshot.empty) {
                alert("A turma de origem não possui grade cadastrada.");
                setLoading(false);
                return;
            }

            const sourceSchedules = snapshot.docs.map(d => d.data() as ClassSchedule);
            const batch = db.batch();

            // We iterate 1 to 6 to ensure all days are represented
            for (let day = 1; day <= 6; day++) {
                const sourceDay = sourceSchedules.find(s => s.dayOfWeek === day);
                const newId = `${unit}_${selectedGrade}_${selectedClass}_${selectedShift}_${day}`.replace(/\s+/g, '_');
                const newRef = db.collection('class_schedules').doc(newId);

                batch.set(newRef, {
                    schoolId: unit,
                    grade: selectedGrade,
                    class: selectedClass,
                    shift: selectedShift,
                    dayOfWeek: day,
                    items: sourceDay ? sourceDay.items : [],
                    lastUpdated: new Date().toISOString()
                });
            }

            await batch.commit();
            alert("Grade copiada com sucesso para todos os dias!");
            setIsCopyModalOpen(false);
            fetchSchedule(); // Refresh current day
        } catch (error) {
            console.error("Error copying schedule:", error);
            alert("Erro ao copiar a grade.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-left">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-blue-950 flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Gerenciar Grade Horária
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Configure o horário semanal das turmas</p>
                    </div>
                    {!isReadOnly && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsCopyModalOpen(true)}
                            className="flex items-center gap-2 text-blue-950 border-blue-200"
                        >
                            <Copy className="w-4 h-4" />
                            Copiar de outra Turma
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Série</label>
                        <select
                            value={selectedGrade}
                            onChange={(e) => setSelectedGrade(e.target.value)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-950 shadow-sm"
                        >
                            {SCHOOL_GRADES_LIST.map(grade => (
                                <option key={grade} value={grade}>{grade}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Turma</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value as SchoolClass)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-950 shadow-sm"
                        >
                            {SCHOOL_CLASSES_LIST.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Turno</label>
                        <select
                            value={selectedShift}
                            onChange={(e) => setSelectedShift(e.target.value as SchoolShift)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-950 shadow-sm"
                        >
                            {SCHOOL_SHIFTS_LIST.map(sh => (
                                <option key={sh} value={sh}>{sh}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Dia da Semana</label>
                        <div className="flex bg-gray-100 p-1 rounded-xl gap-1 overflow-x-auto">
                            {DAYS_OF_WEEK.map(day => (
                                <button
                                    key={day.id}
                                    onClick={() => setSelectedDay(day.id)}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex-1 ${selectedDay === day.id
                                        ? 'bg-blue-950 text-white shadow-md'
                                        : 'text-gray-500 hover:bg-gray-200'
                                        }`}
                                >
                                    {day.name.split('-')[0]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="min-h-[300px] relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                            <div className="w-8 h-8 border-4 border-blue-950 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : null}

                    <div className="space-y-3">
                        {items.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-2xl">
                                <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                <p className="text-gray-400 font-medium">Nenhum horário cadastrado para este dia.</p>
                                {!isReadOnly && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddItem}
                                        className="mt-4"
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> Começar Agora
                                    </Button>
                                )}
                            </div>
                        ) : (
                            items.map((item, index) => (
                                <div key={index} className="flex flex-col md:flex-row items-start md:items-center gap-3 p-4 bg-gray-50/50 rounded-xl border border-gray-100 animate-fade-in text-left">
                                    <div className="flex items-center gap-2 flex-1 w-full">
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="time"
                                                value={item.startTime}
                                                onChange={(e) => handleUpdateItem(index, 'startTime', e.target.value)}
                                                className="p-2 border border-blue-100 rounded-lg text-sm font-bold text-blue-900 bg-white"
                                            />
                                            <span className="text-gray-400 font-bold">às</span>
                                            <input
                                                type="time"
                                                value={item.endTime}
                                                onChange={(e) => handleUpdateItem(index, 'endTime', e.target.value)}
                                                className="p-2 border border-blue-100 rounded-lg text-sm font-bold text-blue-900 bg-white"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <select
                                                value={item.subject}
                                                onChange={(e) => handleUpdateItem(index, 'subject', e.target.value)}
                                                className="w-full p-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 bg-white"
                                            >
                                                {SUBJECT_LIST.map(sub => (
                                                    <option key={sub} value={sub}>{sub}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {!isReadOnly && (
                                            <button
                                                onClick={() => handleRemoveItem(index)}
                                                className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}

                        {!isReadOnly && items.length > 0 && (
                            <button
                                onClick={handleAddItem}
                                className="w-full py-3 border-2 border-dashed border-blue-100 rounded-xl text-blue-950 font-bold text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Adicionar Aula
                            </button>
                        )}
                    </div>
                </div>

                {!isReadOnly && (
                    <div className="mt-10 pt-6 border-t border-gray-100 flex justify-end">
                        <Button
                            onClick={handleSave}
                            isLoading={saving}
                            className="w-full md:w-auto px-10 gap-2"
                        >
                            <Save className="w-4 h-4" /> Salvar Grade de {DAYS_OF_WEEK.find(d => d.id === selectedDay)?.name}
                        </Button>
                    </div>
                )}
            </div>

            {/* Copy Modal */}
            {isCopyModalOpen && (
                <div className="fixed inset-0 bg-blue-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                            <h3 className="text-lg font-bold text-blue-950 flex items-center gap-2">
                                <Copy className="w-5 h-5" /> Copiar Grade Horária
                            </h3>
                            <button onClick={() => setIsCopyModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold p-2">X</button>
                        </div>
                        <div className="p-6 space-y-4 bg-white text-left">
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4 flex gap-3 text-left">
                                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                                <p className="text-xs text-blue-800 font-medium leading-relaxed">
                                    Isso irá substituir **todos os horários** da turma atual (de segunda a sexta) pelos horários da turma de origem selecionada.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Turma de Origem (Série)</label>
                                <select
                                    value={copySourceGrade}
                                    onChange={(e) => setCopySourceGrade(e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-950"
                                >
                                    {SCHOOL_GRADES_LIST.map(grade => (
                                        <option key={grade} value={grade}>{grade}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Turma de Origem (Letra)</label>
                                <select
                                    value={copySourceClass}
                                    onChange={(e) => setCopySourceClass(e.target.value as SchoolClass)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-950"
                                >
                                    {SCHOOL_CLASSES_LIST.map(cls => (
                                        <option key={cls} value={cls}>{cls}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Turma de Origem (Turno)</label>
                                <select
                                    value={copySourceShift}
                                    onChange={(e) => setCopySourceShift(e.target.value as SchoolShift)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-950"
                                >
                                    {SCHOOL_SHIFTS_LIST.map(sh => (
                                        <option key={sh} value={sh}>{sh}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="p-6 bg-gray-50 flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setIsCopyModalOpen(false)}>Cancelar</Button>
                            <Button className="flex-1 gap-2" onClick={handleCopySchedule}>Confirmar Cópia</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
