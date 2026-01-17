import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import {
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    query,
    where,
    writeBatch
} from 'firebase/firestore';
import type {
    SchoolUnit,
    SchoolClass,
    ClassSchedule,
    ScheduleItem
} from '../types';
import { SCHOOL_CLASSES_OPTIONS, SCHOOL_SHIFTS } from '../utils/academicDefaults';
import { useAcademicData } from '../hooks/useAcademicData';
import {
    Calendar,
    Copy,
    Save,
    Plus,
    Trash2,
    Clock,
    AlertCircle,
    X,
    Loader2,
    Printer,
    FileText
} from 'lucide-react';

const SCHOOL_CLASSES_LIST = SCHOOL_CLASSES_OPTIONS.map((opt: { value: string }) => opt.value);
const SCHOOL_SHIFTS_LIST = SCHOOL_SHIFTS.map((opt: { value: string }) => opt.value);


interface ScheduleManagementProps {
    unit: SchoolUnit;
    isReadOnly?: boolean;
}

const DAYS_OF_WEEK = [
    { id: 1, label: 'Segunda' },
    { id: 2, label: 'Terça' },
    { id: 3, label: 'Quarta' },
    { id: 4, label: 'Quinta' },
    { id: 5, label: 'Sexta' },
    { id: 6, label: 'Sábado' },
];

export function ScheduleManagement({ unit, isReadOnly }: ScheduleManagementProps) {
    const { grades, subjects, loading: loadingAcademic } = useAcademicData();
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedClass, setSelectedClass] = useState(SCHOOL_CLASSES_LIST[0] as SchoolClass);
    const [selectedShift, setSelectedShift] = useState(SCHOOL_SHIFTS_LIST[0]);
    const [selectedDay, setSelectedDay] = useState(1);
    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [fullScheduleForPrint, setFullScheduleForPrint] = useState<ClassSchedule[] | null>(null);

    // Copy feature state
    const [copySourceGrade, setCopySourceGrade] = useState('');
    const [copySourceClass, setCopySourceClass] = useState(SCHOOL_CLASSES_LIST[0] as SchoolClass);
    const [copySourceShift, setCopySourceShift] = useState(SCHOOL_SHIFTS_LIST[0]);

    useEffect(() => {
        if (!loadingAcademic && grades.length > 0 && !selectedGrade) {
            setSelectedGrade(grades[0].name);
            setCopySourceGrade(grades[0].name);
        }
    }, [loadingAcademic, grades]);

    useEffect(() => {
        if (unit && selectedGrade && selectedClass && selectedShift && selectedDay) {
            fetchSchedule();
        }
    }, [unit, selectedGrade, selectedClass, selectedShift, selectedDay]);

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const schedulesRef = collection(db, 'class_schedules');
            const q = query(
                schedulesRef,
                where('schoolId', '==', unit),
                where('grade', '==', selectedGrade),
                where('class', '==', selectedClass),
                where('shift', '==', selectedShift),
                where('dayOfWeek', '==', selectedDay)
            );

            const snap = await getDocs(q);
            if (!snap.empty) {
                const data = snap.docs[0].data() as ClassSchedule;
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
        setItems([...items, { startTime: '', endTime: '', subject: '' }]);
    };

    const handleRemoveItem = async (index: number) => {
        if (isReadOnly) return;
        if (!confirm("Deseja apagar este horário?")) return;

        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);

        // Auto-save after removal
        setSaving(true);
        try {
            const scheduleId = `${unit}_${selectedGrade}_${selectedClass}_${selectedShift}_${selectedDay}`;
            const scheduleRef = doc(db, 'class_schedules', scheduleId);

            if (newItems.length === 0) {
                await deleteDoc(scheduleRef);
            } else {
                const sortedItems = [...newItems].sort((a, b) => a.startTime.localeCompare(b.startTime));
                await setDoc(scheduleRef, {
                    schoolId: unit,
                    grade: selectedGrade,
                    class: selectedClass,
                    shift: selectedShift,
                    dayOfWeek: selectedDay,
                    items: sortedItems,
                    lastUpdated: new Date().toISOString()
                });
                setItems(sortedItems);
            }
            // Optional: alert("Horário removido com sucesso!");
        } catch (error) {
            console.error("Error saving schedule after removal:", error);
            alert("Erro ao salvar após remover o horário.");
        } finally {
            setSaving(false);
        }
    };

    const handleItemChange = (index: number, field: keyof ScheduleItem, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleSave = async () => {
        if (isReadOnly) return;
        setSaving(true);
        try {
            const scheduleId = `${unit}_${selectedGrade}_${selectedClass}_${selectedShift}_${selectedDay}`;
            const scheduleRef = doc(db, 'class_schedules', scheduleId);

            if (items.length === 0) {
                await deleteDoc(scheduleRef);
                alert("Grade vazia detectada. Registro removido do banco de dados.");
            } else {
                // Sort items by start time before saving
                const sortedItems = [...items].sort((a, b) => a.startTime.localeCompare(b.startTime));

                await setDoc(scheduleRef, {
                    schoolId: unit,
                    grade: selectedGrade,
                    class: selectedClass,
                    shift: selectedShift,
                    dayOfWeek: selectedDay,
                    items: sortedItems,
                    lastUpdated: new Date().toISOString()
                });
                setItems(sortedItems);
                alert("Grade salva com sucesso!");
            }
        } catch (error) {
            console.error("Error saving schedule:", error);
            alert("Erro ao salvar a grade.");
        } finally {
            setSaving(false);
        }
    };

    const handleCopySchedule = async () => {
        if (isReadOnly) return;
        if (copySourceGrade === selectedGrade && copySourceClass === selectedClass && copySourceShift === selectedShift) {
            alert("A turma de origem não pode ser a mesma da de destino.");
            return;
        }

        if (!confirm(`Deseja copiar toda a grade (segunda a sábado) da turma ${copySourceGrade} ${copySourceClass} (${copySourceShift}) para a turma ${selectedGrade} ${selectedClass} (${selectedShift})? Isso sobrescreverá a grade atual do destino.`)) {
            return;
        }

        setSaving(true);
        try {
            // 1. Fetch all 5 days from source
            const schedulesRef = collection(db, 'class_schedules');
            const q = query(
                schedulesRef,
                where('schoolId', '==', unit),
                where('grade', '==', copySourceGrade),
                where('class', '==', copySourceClass),
                where('shift', '==', copySourceShift)
            );

            const snap = await getDocs(q);
            const sourceSchedules = snap.docs.map(d => d.data() as ClassSchedule);

            // 2. Prepare batch write
            const batch = writeBatch(db);

            // We iterate 1 to 6 to ensure all days are represented
            for (let day = 1; day <= 6; day++) {
                const sourceDay = sourceSchedules.find(s => s.dayOfWeek === day);
                const targetId = `${unit}_${selectedGrade}_${selectedClass}_${selectedShift}_${day}`;
                const targetRef = doc(db, 'class_schedules', targetId);

                batch.set(targetRef, {
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
            setSaving(false);
        }
    };

    const handlePrintAllDays = async () => {
        setLoading(true);
        try {
            const schedulesRef = collection(db, 'class_schedules');
            const q = query(
                schedulesRef,
                where('schoolId', '==', unit),
                where('grade', '==', selectedGrade),
                where('class', '==', selectedClass),
                where('shift', '==', selectedShift)
            );

            const snap = await getDocs(q);
            if (snap.empty) {
                alert("Não há horários cadastrados para imprimir.");
                return;
            }

            const allDays = snap.docs.map(d => d.data() as ClassSchedule);
            allDays.sort((a, b) => a.dayOfWeek - b.dayOfWeek);

            setFullScheduleForPrint(allDays);

            // Wait for render
            setTimeout(() => {
                window.print();
                setFullScheduleForPrint(null);
            }, 500);
        } catch (error) {
            console.error("Error fetching full schedule for print:", error);
            alert("Erro ao carregar horários para impressão.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Selection Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Série</label>
                    <select
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-950/20 outline-none"
                    >
                        {grades.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Turma</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value as SchoolClass)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-950/20 outline-none"
                    >
                        {SCHOOL_CLASSES_LIST.map((c: string) => <option key={c} value={c as SchoolClass}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Turno</label>
                    <select
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-950/20 outline-none"
                    >
                        {SCHOOL_SHIFTS_LIST.map((s: string) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="flex items-end gap-2">
                    <button
                        onClick={() => setIsCopyModalOpen(true)}
                        disabled={isReadOnly || loading || saving}
                        className="flex-1 flex items-center justify-center gap-2 p-2.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-xl text-sm font-bold hover:bg-orange-100 transition-colors disabled:opacity-50"
                    >
                        <Copy className="w-4 h-4" />
                        Copiar
                    </button>
                    <button
                        onClick={handlePrintAllDays}
                        disabled={loading || saving}
                        className="flex items-center justify-center p-2.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors disabled:opacity-50"
                        title="Imprimir Grade Completa"
                    >
                        <Printer className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handlePrintAllDays}
                        disabled={loading || saving}
                        className="flex items-center justify-center p-2.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                        title="Baixar PDF (via Impressora)"
                    >
                        <FileText className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Day Selector */}
            <div className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-xl">
                {DAYS_OF_WEEK.map(day => (
                    <button
                        key={day.id}
                        onClick={() => setSelectedDay(day.id)}
                        className={`flex-1 min-w-[100px] py-2 px-4 rounded-xl text-xs font-bold transition-all ${selectedDay === day.id
                            ? 'bg-blue-950 text-white shadow-md shadow-blue-950/20'
                            : 'text-gray-500 hover:bg-white/60'
                            }`}
                    >
                        {day.label}
                    </button>
                ))}
            </div>

            {/* Schedule Items */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
                <div className="p-4 border-b border-gray-50 bg-gray-50/30 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-950" />
                        Aulas de {DAYS_OF_WEEK.find(d => d.id === selectedDay)?.label}
                    </h3>
                    {!isReadOnly && (
                        <button
                            onClick={handleAddItem}
                            disabled={loading || saving}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-950 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Nova Aula
                        </button>
                    )}
                </div>

                <div className="p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-950" />
                            <p className="text-sm text-gray-400 font-medium">Carregando horários...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-40">
                            <AlertCircle className="w-12 h-12 text-gray-300 mb-2" />
                            <p className="text-sm font-medium text-gray-400">Nenhum horário registrado para este dia.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="flex flex-wrap md:flex-nowrap gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 items-center animate-fade-in-down">
                                    <div className="w-full md:w-32">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase mb-1">
                                            <Clock className="w-3 h-3" /> Início
                                        </div>
                                        <input
                                            type="time"
                                            value={item.startTime}
                                            onChange={(e) => handleItemChange(index, 'startTime', e.target.value)}
                                            readOnly={isReadOnly}
                                            className="w-full p-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-950/10 outline-none"
                                        />
                                    </div>
                                    <div className="w-full md:w-32">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase mb-1">
                                            <Clock className="w-3 h-3" /> Fim
                                        </div>
                                        <input
                                            type="time"
                                            value={item.endTime}
                                            onChange={(e) => handleItemChange(index, 'endTime', e.target.value)}
                                            readOnly={isReadOnly}
                                            className="w-full p-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-950/10 outline-none"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-[200px]">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase mb-1">
                                            Disciplina
                                        </div>
                                        <select
                                            value={item.subject}
                                            onChange={(e) => handleItemChange(index, 'subject', e.target.value)}
                                            disabled={isReadOnly}
                                            className="w-full p-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-950/10 outline-none"
                                        >
                                            <option value="">Selecione...</option>
                                            {subjects.filter(s => s.isActive).map(s => (
                                                <option key={s.id} value={s.name}>{s.name}</option>
                                            ))}
                                            {/* Legacy support - if item.subject is not in subjects list */}
                                            {item.subject && !subjects.some(s => s.name === item.subject) && (
                                                <option value={item.subject}>{item.subject} (Antigo)</option>
                                            )}
                                        </select>
                                    </div>
                                    {!isReadOnly && (
                                        <div className="flex items-end self-end md:self-center">
                                            <button
                                                onClick={() => handleRemoveItem(index)}
                                                className="p-2 text-red-500 hover:text-red-700 hover:bg-slate-100 rounded-xl transition-colors"
                                                title="Remover aula"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-50 bg-gray-50/20 flex justify-end gap-3">
                    {!isReadOnly && (
                        <button
                            onClick={handleSave}
                            disabled={loading || saving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-950 text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg shadow-blue-950/20 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Alterações
                        </button>
                    )}
                </div>
            </div>

            {/* Copy Modal */}
            {isCopyModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-fade-in-up">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Copy className="w-5 h-5 text-orange-600" />
                                <h3 className="font-bold text-gray-900">Copiar Grade</h3>
                            </div>
                            <button onClick={() => setIsCopyModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-3 bg-slate-50 text-slate-600 text-xs rounded-xl border border-slate-200 flex gap-3">
                                <AlertCircle className="w-5 h-5 shrink-0 text-orange-600" />
                                <p>Isso copiará os horários de Segunda a Sábado da turma selecionada para a turma atual.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Turma de Origem (Série)</label>
                                <select
                                    value={copySourceGrade}
                                    onChange={(e) => setCopySourceGrade(e.target.value)}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700"
                                >
                                    {grades.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Turma de Origem (Letra)</label>
                                <select
                                    value={copySourceClass}
                                    onChange={(e) => setCopySourceClass(e.target.value as SchoolClass)}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700"
                                >
                                    {SCHOOL_CLASSES_LIST.map((c: string) => <option key={c} value={c as SchoolClass}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Turma de Origem (Turno)</label>
                                <select
                                    value={copySourceShift}
                                    onChange={(e) => setCopySourceShift(e.target.value)}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700"
                                >
                                    {SCHOOL_SHIFTS_LIST.map((s: string) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <button
                                onClick={handleCopySchedule}
                                disabled={saving}
                                className="w-full py-3 bg-blue-950 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg shadow-blue-950/20 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                                Confirmar Cópia
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {fullScheduleForPrint && (
                <div className="fixed inset-0 bg-white z-[200] p-8 overflow-y-auto print:p-0">
                    <div className="mb-8 text-center border-b-2 border-blue-900 pb-4">
                        <h2 className="text-xl font-black text-blue-900 uppercase tracking-tighter">Horário Escolar - Grade Completa</h2>
                        <div className="flex justify-center gap-4 mt-2 text-[10px] font-bold text-gray-500 uppercase">
                            <span>{selectedGrade}</span>
                            <span>Turma {selectedClass}</span>
                            <span>Turno {selectedShift}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-6 gap-2">
                        {DAYS_OF_WEEK.map(day => {
                            const daySchedule = fullScheduleForPrint.find(s => s.dayOfWeek === day.id);
                            return (
                                <div key={day.id} className="flex flex-col border border-gray-100 rounded-xl overflow-hidden">
                                    <div className="bg-blue-900 text-white py-1 px-2 text-center text-[10px] font-black uppercase">
                                        {day.label}
                                    </div>
                                    <div className="p-1 space-y-1 bg-white flex-grow">
                                        {daySchedule?.items && daySchedule.items.length > 0 ? (
                                            daySchedule.items.map((item, idx) => (
                                                <div key={idx} className="bg-gray-50/50 border border-gray-100 p-1.5 rounded-xl">
                                                    <div className="font-black text-blue-900 text-[8px] mb-0.5">{item.startTime} - {item.endTime}</div>
                                                    <div className="font-bold text-gray-800 leading-tight uppercase text-[9px] break-words">{item.subject}</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-4 text-gray-300 italic text-[8px]">S/A</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-8 pt-4 border-t border-gray-100 flex justify-between items-end">
                        <div className="text-[8px] text-gray-400 italic font-medium">
                            Rede de Ensino Expansivo - Excelência em Educação<br />
                            Este documento é para fins informativos e pode sofrer alterações.
                        </div>
                        <div className="w-32 h-1 bg-blue-900/10 rounded-xl"></div>
                    </div>
                </div>
            )}
        </div>
    );
}
