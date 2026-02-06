import { useState, useEffect, useCallback, memo } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, getDocs, addDoc, updateDoc, doc, writeBatch, deleteDoc, orderBy } from 'firebase/firestore';
import type { AcademicSubject, AcademicGrade } from '../types';
import { GRADES_BY_LEVEL } from '../utils/academicDefaults';
import { Card, CardContent, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Loader2, Plus, Edit2, ToggleLeft, ToggleRight, Trash2, Search, LayoutGrid, List as ListIcon, Filter, Clock } from 'lucide-react';
import { SchoolUnit, SchoolShift, UNIT_LABELS, SHIFT_LABELS } from '../types';
import type { CurriculumMatrix } from '../types';
import { getCurrentSchoolYear } from '../utils/academicUtils';
import { setDoc } from 'firebase/firestore';
import { CURRICULUM_MATRIX, ACADEMIC_SEGMENTS } from '../utils/academicDefaults';

export default function Disciplinas() {
    const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
    const [grades, setGrades] = useState<AcademicGrade[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'list' | 'matrix'>('list');
    const [editingSubject, setEditingSubject] = useState<AcademicSubject | null>(null);

    // Modal Form State
    const [formData, setFormData] = useState({
        name: '',
        shortName: '',
        order: 0,
        isActive: true,
        classDuration: 60,
        weeklyHours: {
            'Fundamental I': 0,
            'Fundamental II': 0,
            'Ensino Médio': 0
        } as Record<string, number>
    });

    // Matrix Context Filters
    const [selectedUnit, setSelectedUnit] = useState<SchoolUnit>(SchoolUnit.UNIT_BS);
    const [selectedShift, setSelectedShift] = useState<SchoolShift>(SchoolShift.MORNING);
    const [selectedYear] = useState(getCurrentSchoolYear().toString());
    const [matrices, setMatrices] = useState<CurriculumMatrix[]>([]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load Subjects
            const subjectSnap = await getDocs(query(collection(db, 'academic_subjects'), orderBy('order', 'asc')));
            const subjectData = subjectSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicSubject));
            setSubjects(subjectData);

            // Load Grades
            const gradeSnap = await getDocs(query(collection(db, 'academic_grades'), orderBy('order', 'asc')));
            let gradeData = gradeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicGrade));

            // Chronological sorting based on GRADES_BY_LEVEL structure
            const flattenGradesOrder = GRADES_BY_LEVEL.flatMap(level => level.grades);
            gradeData.sort((a, b) => {
                const indexA = flattenGradesOrder.indexOf(a.name);
                const indexB = flattenGradesOrder.indexOf(b.name);

                // If not found in the predefined list, put at the end
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;

                return indexA - indexB;
            });

            setGrades(gradeData);

            // Load Matrices
            const matrixSnap = await getDocs(collection(db, 'academic_matrices'));
            const matrixData = matrixSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CurriculumMatrix));
            setMatrices(matrixData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);


    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingSubject) {
                await updateDoc(doc(db, 'academic_subjects', editingSubject.id), formData);
            } else {
                await addDoc(collection(db, 'academic_subjects'), formData);
            }
            setIsModalOpen(false);
            setEditingSubject(null);
            setFormData({
                name: '',
                shortName: '',
                order: 0,
                isActive: true,
                classDuration: 60,
                weeklyHours: {
                    'Fundamental I': 0,
                    'Fundamental II': 0,
                    'Ensino Médio': 0
                }
            });
            loadData();
        } catch (error) {
            console.error("Error saving subject:", error);
            alert("Erro ao salvar disciplina.");
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (subject: AcademicSubject) => {
        try {
            await updateDoc(doc(db, 'academic_subjects', subject.id), {
                isActive: !subject.isActive
            });
            loadData();
        } catch (error) {
            console.error("Error toggling status:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta disciplina?")) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, 'academic_subjects', id));
            loadData();
        } catch (error) {
            console.error("Error deleting subject:", error);
            alert("Erro ao excluir disciplina.");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        if (!confirm("Isso apagará TODAS as disciplinas atuais e importará as padrões novamente. Deseja continuar?")) return;

        setLoading(true);
        try {
            // 1. Delete all current
            const snapshot = await getDocs(collection(db, 'academic_subjects'));
            const deleteBatch = writeBatch(db);
            snapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
            await deleteBatch.commit();

            // 2. Import defaults
            // await handleSeedData(); // REMOVED: Function not available in this scope
            console.log("Reset complete (seed disabled)");
        } catch (error) {
            console.error("Error resetting subjects:", error);
            alert("Erro ao resetar disciplinas.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateMatrixHour = useCallback(async (subjectId: string, gradeId: string, hours: number) => {
        try {
            const matrixId = `matrix_${selectedUnit}_${gradeId}_${selectedShift}_${selectedYear}`;
            const existingMatrix = matrices.find(m => m.id === matrixId);

            let newSubjects = existingMatrix ? [...existingMatrix.subjects] : [];
            const subjectIdx = newSubjects.findIndex(s => s.id === subjectId);

            if (subjectIdx >= 0) {
                if (hours > 0) {
                    newSubjects[subjectIdx] = { ...newSubjects[subjectIdx], weeklyHours: hours };
                } else {
                    newSubjects = newSubjects.filter(s => s.id !== subjectId);
                }
            } else if (hours > 0) {
                const subjectInfo = subjects.find(s => s.id === subjectId);
                newSubjects.push({
                    id: subjectId,
                    weeklyHours: hours,
                    order: subjectInfo?.order || 0
                });
            }

            // Re-sort by order
            newSubjects.sort((a, b) => a.order - b.order);

            const updatedMatrix: CurriculumMatrix = {
                id: matrixId,
                unit: selectedUnit,
                gradeId,
                shift: selectedShift,
                academicYear: selectedYear,
                subjects: newSubjects
            };

            await setDoc(doc(db, 'academic_matrices', matrixId), updatedMatrix);

            // Optimistic local update
            setMatrices(prev => {
                const others = prev.filter(m => m.id !== matrixId);
                return [...others, updatedMatrix];
            });
        } catch (error) {
            console.error("Error updating matrix hour:", error);
            alert("Erro ao atualizar carga horária.");
            loadData(); // Rollback
        }
    }, [selectedUnit, selectedShift, selectedYear, matrices, subjects]);

    // Isolated Input Component to handle local state and prevent page-wide re-renders during typing
    const MatrixInput = memo(({ value, onUpdate }: { value: number, onUpdate: (val: number) => void }) => {
        const [localValue, setLocalValue] = useState(value);

        useEffect(() => {
            setLocalValue(value);
        }, [value]);

        return (
            <input
                type="number"
                min="0"
                className="w-14 h-9 text-center rounded-xl border-slate-100 bg-slate-50/50 hover:bg-slate-100 focus:border-blue-500 focus:bg-white transition-all font-bold text-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none border"
                value={localValue}
                onChange={(e) => setLocalValue(parseInt(e.target.value) || 0)}
                onBlur={() => {
                    if (localValue !== value) {
                        onUpdate(localValue);
                    }
                }}
            />
        );
    });

    // Memoized Row to prevent re-rendering all rows when one changes
    const MatrixRow = memo(({ subject, grades, matrices, onUpdate }: { subject: AcademicSubject, grades: AcademicGrade[], matrices: CurriculumMatrix[], onUpdate: (subjectId: string, gradeId: string, val: number) => void }) => {
        return (
            <tr className="hover:bg-blue-50/30 transition-colors group">
                <td className="sticky left-0 z-10 bg-white group-hover:bg-blue-50/30 py-4 px-6 font-bold text-blue-950 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    {subject.name}
                </td>
                {grades.map(grade => {
                    const matrixId = `matrix_${selectedUnit}_${grade.id}_${selectedShift}_${selectedYear}`;
                    const matrix = matrices.find(m => m.id === matrixId);
                    const subjectInMatrix = matrix?.subjects.find(s => s.id === subject.id);

                    // Logic: Matrix value first, then global subject default, then 0
                    const segment = Object.values(ACADEMIC_SEGMENTS).find(s => s.id === grade.segmentId);
                    const gradeKey = segment?.label || '';

                    const codeDefault = CURRICULUM_MATRIX[gradeKey]?.[subject.id] || 0;
                    const globalDefault = (subject.weeklyHours?.[gradeKey] !== undefined && subject.weeklyHours[gradeKey] > 0)
                        ? subject.weeklyHours[gradeKey]
                        : codeDefault;

                    const hours = subjectInMatrix?.weeklyHours !== undefined ? subjectInMatrix.weeklyHours : globalDefault;
                    const isDefault = subjectInMatrix?.weeklyHours === undefined && globalDefault > 0;
                    const isCodeDefault = subjectInMatrix?.weeklyHours === undefined && (subject.weeklyHours?.[gradeKey] === undefined || subject.weeklyHours[gradeKey] === 0) && codeDefault > 0;

                    // Calculation: (Hours * Duration / 60) * 40 weeks
                    const duration = subject.classDuration || 60;
                    const annualWorkload = Math.round((hours * duration / 60) * 40);

                    return (
                        <td key={grade.id} className={`p-2 border-r border-slate-50 ${isDefault ? 'bg-blue-50/20' : ''}`}>
                            <div className="relative flex items-center justify-center">
                                <MatrixInput
                                    value={hours}
                                    onUpdate={(val) => onUpdate(subject.id, grade.id, val)}
                                />
                                <div className={`absolute -bottom-1 text-[7px] font-bold uppercase pointer-events-none tracking-tighter ${isDefault ? 'text-blue-400' : 'text-slate-400'}`}>
                                    {annualWorkload}h/ano {isDefault && (isCodeDefault ? '• Código' : '• Padrão')}
                                </div>
                            </div>
                        </td>
                    );
                })}
            </tr>
        );
    });

    const filteredSubjects = subjects.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.shortName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-blue-950">Disciplinas</h1>
                    <p className="text-slate-500 text-sm">Gerencie as matérias oferecidas pela escola.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <ListIcon className="w-4 h-4" />
                        Lista
                    </button>
                    <button
                        onClick={() => setActiveTab('matrix')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'matrix' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Matriz Curricular
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {activeTab === 'list' && (
                        <>
                            {subjects.length > 0 && (
                                <Button variant="outline" onClick={handleReset} className="gap-2 text-red-600 border-red-300 bg-red-50 hover:bg-red-100 shadow-sm">
                                    <Trash2 className="w-4 h-4" />
                                    Limpar e Reiniciar
                                </Button>
                            )}

                            <Button onClick={() => {
                                setEditingSubject(null);
                                setFormData({
                                    name: '',
                                    shortName: '',
                                    order: (subjects.length + 1) * 10,
                                    isActive: true,
                                    classDuration: 60,
                                    weeklyHours: {
                                        'Fundamental I': 0,
                                        'Fundamental II': 0,
                                        'Ensino Médio': 0
                                    }
                                });
                                setIsModalOpen(true);
                            }} className="gap-2">
                                <Plus className="w-4 h-4" />
                                Nova Disciplina
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {activeTab === 'list' ? (
                <>
                    <Card>
                        <CardHeader>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Buscar disciplina..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Ordem</th>
                                            <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Nome</th>
                                            <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Abreviatura</th>
                                            <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                            <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {loading && subjects.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-12 flex justify-center">
                                                    <Loader2 className="w-8 h-8 animate-spin text-blue-950" />
                                                </td>
                                            </tr>
                                        ) : filteredSubjects.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-12 text-center text-slate-400">
                                                    Nenhuma disciplina encontrada.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredSubjects.map((subject) => (
                                                <tr key={subject.id} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="py-4 px-4 font-mono text-sm text-slate-500">{subject.order}</td>
                                                    <td className="py-4 px-4 font-bold text-blue-950">{subject.name}</td>
                                                    <td className="py-4 px-4">
                                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase">
                                                            {subject.shortName || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <button
                                                            onClick={() => toggleStatus(subject)}
                                                            className={`flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-bold transition-all ${subject.isActive
                                                                ? 'bg-blue-100/50 text-blue-950'
                                                                : 'bg-slate-100 text-slate-500'
                                                                }`}
                                                        >
                                                            {subject.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                                            {subject.isActive ? 'Ativa' : 'Inativa'}
                                                        </button>
                                                    </td>
                                                    <td className="py-4 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingSubject(subject);
                                                                    setFormData({
                                                                        name: subject.name,
                                                                        shortName: subject.shortName || '',
                                                                        order: subject.order || 0,
                                                                        isActive: subject.isActive,
                                                                        classDuration: subject.classDuration || 60,
                                                                        weeklyHours: {
                                                                            'Fundamental I': subject.weeklyHours?.['Fundamental I'] || CURRICULUM_MATRIX['Fundamental I']?.[subject.id] || 0,
                                                                            'Fundamental II': subject.weeklyHours?.['Fundamental II'] || CURRICULUM_MATRIX['Fundamental II']?.[subject.id] || 0,
                                                                            'Ensino Médio': subject.weeklyHours?.['Ensino Médio'] || CURRICULUM_MATRIX['Ensino Médio']?.[subject.id] || 0
                                                                        }
                                                                    });
                                                                    setIsModalOpen(true);
                                                                }}
                                                                className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl"
                                                                title="Editar"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(subject.id)}
                                                                className="p-2 hover:bg-red-50 text-red-500 rounded-xl"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            ) : (
                <div className="space-y-4">
                    {/* Matrix Filters */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Configuração da Matriz:</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Unidade</label>
                                <select
                                    className="bg-slate-50 border-none rounded-lg text-sm font-bold text-blue-950 focus:ring-2 focus:ring-blue-500 py-1.5"
                                    value={selectedUnit}
                                    onChange={(e) => setSelectedUnit(e.target.value as SchoolUnit)}
                                >
                                    {Object.values(SchoolUnit).map(unit => (
                                        <option key={unit} value={unit}>{UNIT_LABELS[unit]}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Turno</label>
                                <select
                                    className="bg-slate-50 border-none rounded-lg text-sm font-bold text-blue-950 focus:ring-2 focus:ring-blue-500 py-1.5"
                                    value={selectedShift}
                                    onChange={(e) => setSelectedShift(e.target.value as SchoolShift)}
                                >
                                    {Object.values(SchoolShift).map(shift => (
                                        <option key={shift} value={shift}>{SHIFT_LABELS[shift]}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ano Letivo</label>
                                <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-black text-slate-500">
                                    {selectedYear}
                                </div>
                            </div>
                        </div>

                        <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-bold italic">As alterações são salvas automaticamente</span>
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse min-w-[1200px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="sticky left-0 z-20 bg-slate-50 py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-r border-slate-200 min-w-[200px]">Disciplina</th>
                                            {grades.map(grade => {
                                                const matrixId = `matrix_${selectedUnit}_${grade.id}_${selectedShift}_${selectedYear}`;
                                                const matrix = matrices.find(m => m.id === matrixId);
                                                const totalHours = matrix?.subjects.reduce((sum, s) => sum + s.weeklyHours, 0) || 0;

                                                return (
                                                    <th key={grade.id} className="py-4 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-tighter text-center border-r border-slate-100 min-w-[100px]">
                                                        <div className="text-slate-600 mb-1">{grade.name}</div>
                                                        <div className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-xl text-[9px]">
                                                            {totalHours} aulas
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {subjects.filter(s => s.isActive).map(subject => (
                                            <MatrixRow
                                                key={subject.id}
                                                subject={subject}
                                                grades={grades}
                                                matrices={matrices}
                                                onUpdate={handleUpdateMatrixHour}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-950/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-blue-950">
                                {editingSubject ? 'Editar Disciplina' : 'Nova Disciplina'}
                            </h2>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-grow custom-scrollbar">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nome da Disciplina</label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ex: Português"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Abreviatura</label>
                                    <Input
                                        value={formData.shortName}
                                        onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                                        placeholder="Ex: POR"
                                        maxLength={10}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ordem</label>
                                    <Input
                                        type="number"
                                        value={formData.order}
                                        onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 py-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-950 focus:ring-blue-950"
                                />
                                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Disciplina Ativa</label>
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Carga Horária Padrão</h3>

                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Duração da Aula (minutos)</label>
                                    <div className="flex items-center gap-3">
                                        <Input
                                            type="number"
                                            value={formData.classDuration}
                                            onChange={(e) => setFormData({ ...formData, classDuration: parseInt(e.target.value) || 0 })}
                                            className="w-24 font-bold"
                                        />
                                        <span className="text-xs text-slate-500 font-medium italic">Geralmente 50 ou 60 min.</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    {['Fundamental I', 'Fundamental II', 'Ensino Médio'].map(segment => (
                                        <div key={segment} className="flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-bold text-blue-950">{segment}</p>
                                                <p className="text-[10px] text-slate-500 font-medium">Aulas por semana</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={formData.weeklyHours[segment] || 0}
                                                    onChange={(e) => setFormData({
                                                        ...formData,
                                                        weeklyHours: {
                                                            ...formData.weeklyHours,
                                                            [segment]: parseInt(e.target.value) || 0
                                                        }
                                                    })}
                                                    className="w-16 text-center font-bold"
                                                />
                                                <div className="w-16 text-right">
                                                    <span className="text-[10px] font-black text-blue-600">
                                                        {Math.round(((formData.weeklyHours[segment] || 0) * (formData.classDuration || 60) / 60) * 40)}h/ano
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
