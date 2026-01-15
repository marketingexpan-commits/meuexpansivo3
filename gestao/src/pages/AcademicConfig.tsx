import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, updateDoc, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import type { AcademicSegment, AcademicGrade } from '../types';
import { EDUCATION_LEVELS, GRADES_BY_LEVEL } from '../utils/academicDefaults';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Loader2, Plus, Edit2, Trash2, Database, Layers, ChevronRight, ChevronDown } from 'lucide-react';
import { GradeStandardizationTool } from '../components/GradeStandardizationTool';
import { DatabaseCleanupTool } from '../components/DatabaseCleanupTool';

export default function AcademicConfig() {
    const [segments, setSegments] = useState<AcademicSegment[]>([]);
    const [grades, setGrades] = useState<AcademicGrade[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
    const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
    const [editingSegment, setEditingSegment] = useState<AcademicSegment | null>(null);
    const [editingGrade, setEditingGrade] = useState<AcademicGrade | null>(null);

    // Expanded sections state
    const [expandedSegments, setExpandedSegments] = useState<Record<string, boolean>>({});

    // Form States
    const [segmentForm, setSegmentForm] = useState({ name: '', order: 0, isActive: true });
    const [gradeForm, setGradeForm] = useState({ name: '', segmentId: '', order: 0, isActive: true });

    const fetchData = async () => {
        setLoading(true);
        try {
            const segSnap = await getDocs(collection(db, 'academic_segments'));
            const segData = segSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicSegment));
            segData.sort((a, b) => (a.order || 0) - (b.order || 0));
            setSegments(segData);

            const gradeSnap = await getDocs(collection(db, 'academic_grades'));
            const gradeData = gradeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicGrade));
            gradeData.sort((a, b) => (a.order || 0) - (b.order || 0));
            setGrades(gradeData);

            // Initialize expanded states
            const expanded: Record<string, boolean> = {};
            segData.forEach(s => {
                expanded[s.id] = true;
            });
            setExpandedSegments(expanded);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSeedData = async () => {
        if (!confirm("Deseja importar os segmentos e séries padrões para o banco de dados?")) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);

            EDUCATION_LEVELS.forEach((levelName, sIdx) => {
                const segRef = doc(collection(db, 'academic_segments'));
                const segmentId = segRef.id;

                batch.set(segRef, {
                    name: levelName,
                    isActive: true,
                    order: (sIdx + 1) * 10
                });

                const levelGrades = GRADES_BY_LEVEL.find(l => l.level === levelName)?.grades || [];
                levelGrades.forEach((gradeName, gIdx) => {
                    const gradeRef = doc(collection(db, 'academic_grades'));
                    batch.set(gradeRef, {
                        name: gradeName,
                        segmentId: segmentId,
                        isActive: true,
                        order: (gIdx + 1) * 10
                    });
                });
            });

            await batch.commit();
            alert("Dados importados com sucesso!");
            fetchData();
        } catch (error) {
            console.error("Error seeding data:", error);
            alert("Erro ao importar dados.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSegment = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingSegment) {
                await updateDoc(doc(db, 'academic_segments', editingSegment.id), segmentForm);
            } else {
                await addDoc(collection(db, 'academic_segments'), segmentForm);
            }
            setIsSegmentModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error saving segment:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGrade = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingGrade) {
                await updateDoc(doc(db, 'academic_grades', editingGrade.id), gradeForm);
            } else {
                await addDoc(collection(db, 'academic_grades'), gradeForm);
            }
            setIsGradeModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error saving grade:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSegment = async (id: string) => {
        const hasGrades = grades.some(g => g.segmentId === id);
        if (hasGrades) {
            alert("Não é possível excluir um segmento que possui séries vinculadas. Exclua as séries primeiro.");
            return;
        }
        if (!confirm("Excluir este segmento?")) return;
        try {
            await deleteDoc(doc(db, 'academic_segments', id));
            fetchData();
        } catch (error) { console.error(error); }
    };

    const handleDeleteGrade = async (id: string) => {
        if (!confirm("Excluir esta série?")) return;
        try {
            await deleteDoc(doc(db, 'academic_grades', id));
            fetchData();
        } catch (error) { console.error(error); }
    };

    const handleReset = async () => {
        if (!confirm("Isso apagará TODOS os segmentos e séries atuais e importará os padrões novamente. Deseja continuar?")) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);
            const segs = await getDocs(collection(db, 'academic_segments'));
            const grds = await getDocs(collection(db, 'academic_grades'));
            segs.docs.forEach(d => batch.delete(d.ref));
            grds.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            await handleSeedData();
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    const toggleSegment = (id: string) => {
        setExpandedSegments(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-blue-950">Séries e Segmentos</h1>
                    <p className="text-slate-500 text-sm">Gerencie os níveis de ensino e as séries da escola.</p>
                </div>
                <div className="flex items-center gap-3">
                    {segments.length > 0 && (
                        <Button variant="outline" onClick={handleReset} className="gap-2 text-red-600 border-red-300 bg-red-50 hover:bg-red-100 shadow-sm">
                            <Trash2 className="w-4 h-4" />
                            Limpar e Reiniciar
                        </Button>
                    )}
                    {(segments.length === 0 && !loading) && (
                        <Button variant="outline" onClick={handleSeedData} className="gap-2">
                            <Database className="w-4 h-4" />
                            Importar Padrões
                        </Button>
                    )}
                    <Button onClick={() => {
                        setEditingSegment(null);
                        setSegmentForm({ name: '', order: (segments.length + 1) * 10, isActive: true });
                        setIsSegmentModalOpen(true);
                    }} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Novo Segmento
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {segments.map(segment => (
                    <Card key={segment.id} className="overflow-hidden border-blue-100 shadow-sm transition-all hover:shadow-md">
                        <div
                            className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${expandedSegments[segment.id] ? 'bg-blue-50/50' : 'bg-white'}`}
                            onClick={() => toggleSegment(segment.id)}
                        >
                            <div className="flex items-center gap-3">
                                {expandedSegments[segment.id] ? <ChevronDown className="w-5 h-5 text-blue-950" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">#{segment.order}</span>
                                    <h3 className="text-lg font-bold text-blue-950">{segment.name}</h3>
                                    {!segment.isActive && <span className="text-[10px] font-bold uppercase tracking-tighter bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Inativo</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => {
                                    setEditingSegment(segment);
                                    setSegmentForm({ name: segment.name, order: segment.order, isActive: segment.isActive });
                                    setIsSegmentModalOpen(true);
                                }}>
                                    <Edit2 className="w-4 h-4 text-blue-600" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleDeleteSegment(segment.id)}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                                <Button
                                    size="sm"
                                    className="gap-1 ml-2 h-8 px-3 text-xs bg-blue-950 hover:bg-blue-900"
                                    onClick={() => {
                                        const segmentGrades = grades.filter(g => g.segmentId === segment.id);
                                        setEditingGrade(null);
                                        setGradeForm({
                                            name: '',
                                            segmentId: segment.id,
                                            order: (segmentGrades.length + 1) * 10,
                                            isActive: true
                                        });
                                        setIsGradeModalOpen(true);
                                    }}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Adicionar Série
                                </Button>
                            </div>
                        </div>

                        {expandedSegments[segment.id] && (
                            <div className="border-t border-slate-100 bg-white">
                                <div className="p-2">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                                <th className="px-4 py-2 w-20">Ordem</th>
                                                <th className="px-4 py-2">Série / Ano</th>
                                                <th className="px-4 py-2">Status</th>
                                                <th className="px-4 py-2 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {grades.filter(g => g.segmentId === segment.id).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="py-4 text-center text-slate-400 italic">Nenhuma série vinculada.</td>
                                                </tr>
                                            ) : (
                                                grades.filter(g => g.segmentId === segment.id).map(grade => (
                                                    <tr key={grade.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-3 font-mono text-slate-400">{grade.order}</td>
                                                        <td className="px-4 py-3 font-medium text-slate-700">{grade.name}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${grade.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                {grade.isActive ? 'Ativa' : 'Inativa'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right space-x-2">
                                                            <button onClick={() => {
                                                                setEditingGrade(grade);
                                                                setGradeForm({
                                                                    name: grade.name,
                                                                    segmentId: grade.segmentId,
                                                                    order: grade.order,
                                                                    isActive: grade.isActive
                                                                });
                                                                setIsGradeModalOpen(true);
                                                            }} className="text-blue-600 hover:text-blue-800 p-1">
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleDeleteGrade(grade.id)} className="text-red-500 hover:text-red-700 p-1">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </Card>
                ))}

                {segments.length === 0 && !loading && (
                    <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
                        <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-400">Nenhum segmento configurado</h3>
                        <p className="text-slate-400 mb-6">Importe os padrões ou crie o seu primeiro segmento acima.</p>
                        <Button variant="outline" onClick={handleSeedData} className="gap-2">
                            <Database className="w-4 h-4" />
                            Importar Padrões do Sistema
                        </Button>
                    </div>
                )}
            </div>

            {/* Segment Modal */}
            {isSegmentModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-950/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-blue-950">
                                {editingSegment ? 'Editar Segmento' : 'Novo Segmento'}
                            </h2>
                        </div>
                        <form onSubmit={handleSaveSegment} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nome do Segmento</label>
                                <Input
                                    required
                                    value={segmentForm.name}
                                    onChange={(e) => setSegmentForm({ ...segmentForm, name: e.target.value })}
                                    placeholder="Ex: Ensino Médio"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ordem de Exibição</label>
                                <Input
                                    type="number"
                                    value={segmentForm.order}
                                    onChange={(e) => setSegmentForm({ ...segmentForm, order: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="flex items-center gap-2 py-2">
                                <input
                                    type="checkbox"
                                    id="segActive"
                                    checked={segmentForm.isActive}
                                    onChange={(e) => setSegmentForm({ ...segmentForm, isActive: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-950"
                                />
                                <label htmlFor="segActive" className="text-sm font-medium text-slate-700">Segmento Ativo</label>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsSegmentModalOpen(false)} className="flex-1">Cancelar</Button>
                                <Button type="submit" className="flex-1" disabled={loading}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Grade Modal */}
            {isGradeModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-950/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100">
                            <h2 className="text-xl font-bold text-blue-950">
                                {editingGrade ? 'Editar Série' : 'Nova Série'}
                            </h2>
                        </div>
                        <form onSubmit={handleSaveGrade} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Segmento</label>
                                <select
                                    disabled={!!gradeForm.segmentId}
                                    className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                                    value={gradeForm.segmentId}
                                    onChange={e => setGradeForm({ ...gradeForm, segmentId: e.target.value })}
                                >
                                    <option value="">Selecione um segmento...</option>
                                    {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nome da Série / Ano</label>
                                <Input
                                    required
                                    value={gradeForm.name}
                                    onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })}
                                    placeholder="Ex: 1º Ano"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ordem de Exibição</label>
                                <Input
                                    type="number"
                                    value={gradeForm.order}
                                    onChange={(e) => setGradeForm({ ...gradeForm, order: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="flex items-center gap-2 py-2">
                                <input
                                    type="checkbox"
                                    id="gradeActive"
                                    checked={gradeForm.isActive}
                                    onChange={(e) => setGradeForm({ ...gradeForm, isActive: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-950"
                                />
                                <label htmlFor="gradeActive" className="text-sm font-medium text-slate-700">Série Ativa</label>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsGradeModalOpen(false)} className="flex-1">Cancelar</Button>
                                <Button type="submit" className="flex-1" disabled={loading}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <DatabaseCleanupTool />
            <GradeStandardizationTool />
        </div>
    );
}
