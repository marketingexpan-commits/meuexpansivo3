import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, getDocs, addDoc, updateDoc, doc, writeBatch, deleteDoc, orderBy } from 'firebase/firestore';
import type { AcademicSubject, AcademicGrade } from '../types';
import { CURRICULUM_MATRIX, GRADES_BY_LEVEL } from '../utils/academicDefaults';
import { Card, CardContent, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Loader2, Plus, Edit2, ToggleLeft, ToggleRight, Trash2, Search, Database, LayoutGrid, List as ListIcon } from 'lucide-react';

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
        weeklyHours: {} as Record<string, number>
    });

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
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSeedData = async () => {
        if (!confirm("Deseja sincronizar a matriz legada com o Firestore? Isso criará as disciplinas com carga horária pré-definida para cada série.")) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);

            // Map legacy matrix to dynamic subjects
            // Group by subject name to avoid duplicates across segments and merge hours
            const subjectMap: Record<string, Record<string, number>> = {};

            Object.entries(CURRICULUM_MATRIX).forEach(([segment, subjects]) => {
                const levelConfig = GRADES_BY_LEVEL.find(l => l.level === segment || (segment === 'Ens. Médio' && l.level === 'Ensino Médio'));
                const segmentGrades = levelConfig ? levelConfig.grades : [];

                Object.entries(subjects).forEach(([subjectName, hours]) => {
                    if (!subjectMap[subjectName]) {
                        subjectMap[subjectName] = {};
                    }
                    segmentGrades.forEach(gradeName => {
                        subjectMap[subjectName][gradeName] = hours;
                    });
                });
            });

            // Create subjects in Firestore
            Object.entries(subjectMap).forEach(([name, hours], index) => {
                const newDocRef = doc(collection(db, 'academic_subjects'));
                batch.set(newDocRef, {
                    name,
                    shortName: name.substring(0, 3).toUpperCase(),
                    isActive: true,
                    order: (index + 1) * 10,
                    weeklyHours: hours
                });
            });

            await batch.commit();
            alert("Matriz sincronizada com sucesso!");
            loadData();
        } catch (error) {
            console.error("Error seeding subjects:", error);
            alert("Erro ao sincronizar dados.");
        } finally {
            setLoading(false);
        }
    };

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
            setFormData({ name: '', shortName: '', order: 0, isActive: true, weeklyHours: {} });
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
            await handleSeedData();
        } catch (error) {
            console.error("Error resetting subjects:", error);
            alert("Erro ao resetar disciplinas.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateMatrixHour = async (subjectId: string, gradeName: string, hours: number) => {
        try {
            const subject = subjects.find(s => s.id === subjectId);
            if (!subject) return;

            const updatedWeeklyHours = {
                ...(subject.weeklyHours || {}),
                [gradeName]: hours
            };

            await updateDoc(doc(db, 'academic_subjects', subjectId), {
                weeklyHours: updatedWeeklyHours
            });

            // Optimistic local update
            setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, weeklyHours: updatedWeeklyHours } : s));
        } catch (error) {
            console.error("Error updating matrix hour:", error);
            alert("Erro ao atualizar carga horária.");
            loadData(); // Rollback
        }
    };

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
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <ListIcon className="w-4 h-4" />
                        Lista
                    </button>
                    <button
                        onClick={() => setActiveTab('matrix')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'matrix' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                            <Button variant="outline" onClick={handleSeedData} className="gap-2 text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-100 shadow-sm">
                                <Database className="w-4 h-4" />
                                Sincronizar Matriz Legada
                            </Button>
                            <Button onClick={() => {
                                setEditingSubject(null);
                                setFormData({ name: '', shortName: '', order: (subjects.length + 1) * 10, isActive: true, weeklyHours: {} });
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
                                                            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${subject.isActive
                                                                ? 'bg-green-100 text-green-700'
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
                                                                        weeklyHours: subject.weeklyHours || {}
                                                                    });
                                                                    setIsModalOpen(true);
                                                                }}
                                                                className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                                                                title="Editar"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(subject.id)}
                                                                className="p-2 hover:bg-red-50 text-red-500 rounded-lg"
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
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[1200px]">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="sticky left-0 z-20 bg-slate-50 py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest border-r border-slate-200 min-w-[200px]">Disciplina</th>
                                        {grades.map(grade => (
                                            <th key={grade.id} className="py-4 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-tighter text-center border-r border-slate-100 min-w-[100px]">
                                                <div className="text-slate-600 mb-1">{grade.name}</div>
                                                <div className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px]">
                                                    {subjects.reduce((sum, s) => sum + (s.isActive ? (s.weeklyHours?.[grade.name] || 0) : 0), 0)} aulas
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {subjects.filter(s => s.isActive).map(subject => (
                                        <tr key={subject.id} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="sticky left-0 z-10 bg-white group-hover:bg-blue-50/30 py-4 px-6 font-bold text-blue-950 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                {subject.name}
                                            </td>
                                            {grades.map(grade => (
                                                <td key={grade.id} className="p-2 border-r border-slate-50">
                                                    <div className="relative flex items-center justify-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className="w-14 h-9 text-center rounded-lg border-slate-100 bg-slate-50/50 hover:bg-slate-100 focus:border-blue-500 focus:bg-white transition-all font-bold text-blue-600 focus:ring-4 focus:ring-blue-500/10 outline-none border"
                                                            value={subject.weeklyHours?.[grade.name] || 0}
                                                            onChange={(e) => handleUpdateMatrixHour(subject.id, grade.name, parseInt(e.target.value) || 0)}
                                                        />
                                                        <div className="absolute -bottom-1 text-[7px] font-bold text-slate-400 uppercase pointer-events-none tracking-tighter">
                                                            {(subject.weeklyHours?.[grade.name] || 0) * 40}h/ano
                                                        </div>
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-950/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
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

                            {/* Horas Semanais por Série */}
                            <div className="pt-4 border-t border-slate-100">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Carga Horária Semanal (Matriz)</label>
                                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {grades.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">Nenhuma série configurada em "Séries e Segmentos".</p>
                                    ) : (
                                        grades.map(grade => (
                                            <div key={grade.id} className="flex items-center justify-between gap-4 p-2 rounded-lg bg-slate-50 border border-slate-100 transition-colors hover:border-blue-200">
                                                <span className="text-sm font-medium text-blue-950">{grade.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="20"
                                                        value={formData.weeklyHours[grade.name] || 0}
                                                        onChange={(e) => {
                                                            const hours = parseInt(e.target.value) || 0;
                                                            setFormData({
                                                                ...formData,
                                                                weeklyHours: {
                                                                    ...formData.weeklyHours,
                                                                    [grade.name]: hours
                                                                }
                                                            });
                                                        }}
                                                        className="w-16 h-8 px-2 text-center rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-blue-700"
                                                    />
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">aulas</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
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
