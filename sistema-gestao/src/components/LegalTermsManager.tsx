import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, where, onSnapshot } from 'firebase/firestore';
import { Plus, Edit2, Trash2, Loader2, FileText, CheckCircle, XCircle, Users, Eye, PenTool } from 'lucide-react';
import type { LegalTerm, AcademicSegment, TermSignature } from '../types';
import { UNIT_LABELS, SchoolUnit } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Card, CardContent, CardHeader, CardTitle } from './Card';

export const LegalTermsManager = () => {
    const [terms, setTerms] = useState<LegalTerm[]>([]);
    const [segments, setSegments] = useState<AcademicSegment[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [selectedUnits, setSelectedUnits] = useState<string[]>(['all']);
    const [selectedSegments, setSelectedSegments] = useState<string[]>([]);

    // Signatures State
    const [isSignaturesModalOpen, setIsSignaturesModalOpen] = useState(false);
    const [selectedTermForSignatures, setSelectedTermForSignatures] = useState<LegalTerm | null>(null);
    const [signatures, setSignatures] = useState<TermSignature[]>([]);
    const [loadingSignatures, setLoadingSignatures] = useState(false);

    useEffect(() => {
        fetchSegments();

        const q = query(
            collection(db, 'legal_terms')
            // Removido orderBy para evitar necessidade imediata de index
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as LegalTerm));

            // Ordenação Client-Side
            fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setTerms(fetched);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar termos de aceite:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const fetchSegments = async () => {
        try {
            const snap = await getDocs(collection(db, 'academic_segments'));
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicSegment));
            data.sort((a, b) => (a.order || 0) - (b.order || 0));
            setSegments(data);

            // Se for criar um novo, preenche com todos os segmentos por padrão
            if (!editingId && data.length > 0) {
                // setSelectedSegments(data.map(s => s.id));
            }
        } catch (error) {
            console.error("Erro ao buscar segmentos:", error);
        }
    }

    const handleOpenModal = (term?: LegalTerm) => {
        if (term) {
            setEditingId(term.id);
            setTitle(term.title);
            setContent(term.content);
            setIsActive(term.isActive);
            setSelectedUnits(term.units || []);
            setSelectedSegments(term.targetSegments || []);
        } else {
            setEditingId(null);
            setTitle('');
            setContent('');
            setIsActive(true);
            setSelectedUnits(['all']);
            setSelectedSegments(segments.map(s => s.id)); // Default todos
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedUnits.length === 0) {
            alert("Selecione pelo menos uma unidade.");
            return;
        }
        if (selectedSegments.length === 0) {
            alert("Selecione pelo menos um segmento de ensino.");
            return;
        }

        setSaving(true);
        try {
            const termData: Partial<LegalTerm> = {
                title,
                content,
                units: selectedUnits,
                targetSegments: selectedSegments,
                isActive,
            };

            if (editingId) {
                await updateDoc(doc(db, 'legal_terms', editingId), termData);
            } else {
                termData.createdAt = new Date().toISOString();
                await addDoc(collection(db, 'legal_terms'), termData);
            }
            handleCloseModal();
        } catch (error) {
            console.error("Erro ao salvar termo:", error);
            alert("Erro ao salvar o termo.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Atenção: Excluir este termo NÃO exclui as assinaturas já feitas, mas removerá o termo do aplicativo do aluno. Deseja continuar?")) return;
        try {
            await deleteDoc(doc(db, 'legal_terms', id));
        } catch (error) {
            console.error("Erro ao deletar termo:", error);
            alert("Erro ao deletar o termo.");
        }
    };

    const handleViewSignatures = async (term: LegalTerm) => {
        setSelectedTermForSignatures(term);
        setIsSignaturesModalOpen(true);
        setLoadingSignatures(true);
        setSignatures([]);

        try {
            const q = query(
                collection(db, 'term_signatures'),
                where('termId', '==', term.id)
            );
            const snap = await getDocs(q);
            const sigs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TermSignature));

            sigs.sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime());
            setSignatures(sigs);
        } catch (error) {
            console.error("Erro ao buscar assinaturas:", error);
            alert("Erro ao buscar as assinaturas.");
        } finally {
            setLoadingSignatures(false);
        }
    };

    const toggleUnit = (unitId: string) => {
        if (unitId === 'all') {
            if (selectedUnits.includes('all')) {
                setSelectedUnits([]);
            } else {
                setSelectedUnits(['all']);
            }
            return;
        }

        let newUnits = selectedUnits.filter(u => u !== 'all');
        if (newUnits.includes(unitId)) {
            newUnits = newUnits.filter(u => u !== unitId);
        } else {
            newUnits.push(unitId);
        }

        setSelectedUnits(newUnits);
    };

    const toggleSegment = (segId: string) => {
        if (selectedSegments.includes(segId)) {
            setSelectedSegments(selectedSegments.filter(s => s !== segId));
        } else {
            setSelectedSegments([...selectedSegments, segId]);
        }
    };

    const getUnitNames = (termUnits: string[]) => {
        if (termUnits.includes('all')) return 'Todas as Unidades';
        return termUnits.map(u => UNIT_LABELS[u as SchoolUnit] || u).join(', ');
    };

    const getSegmentNames = (termSegments: string[]) => {
        if (!termSegments || termSegments.length === 0) return 'Nenhum';
        if (termSegments.length === segments.length && segments.length > 0) return 'Todos os Segmentos';

        return termSegments.map(id => {
            const seg = segments.find(s => s.id === id);
            return seg ? seg.name : id;
        }).join(', ');
    };

    return (
        <div className="animate-fade-in-up">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-blue-950" />
                        Termos de Aceite e Autorizações
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Gerencie os termos de consentimento e direitos de imagem.
                    </p>
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2 shrink-0">
                    <Plus className="w-4 h-4" />
                    Novo Termo
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Termos Cadastrados ({terms.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-950" />
                        </div>
                    ) : terms.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Nenhum termo cadastrado ainda.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {terms.map(term => (
                                <div key={term.id} className="flex flex-col sm:flex-row gap-4 p-5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors group">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-slate-800 truncate text-lg">{term.title}</h4>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-xl uppercase tracking-wider ${term.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                                                {term.isActive ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-sm">
                                            <div className="flex items-start gap-2 text-slate-600">
                                                <div className="p-1 bg-blue-100 text-blue-700 rounded mt-0.5">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                </div>
                                                <div>
                                                    <span className="font-semibold block text-xs tracking-wider uppercase text-slate-400">Unidades</span>
                                                    <span>{getUnitNames(term.units)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2 text-slate-600">
                                                <div className="p-1 bg-orange-100 text-orange-700 rounded mt-0.5">
                                                    <Users className="w-3 h-3" />
                                                </div>
                                                <div>
                                                    <span className="font-semibold block text-xs tracking-wider uppercase text-slate-400">Segmentos</span>
                                                    <span>{getSegmentNames(term.targetSegments)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100 italic">
                                            Criado em: {new Date(term.createdAt).toLocaleDateString('pt-BR')} às {new Date(term.createdAt).toLocaleTimeString('pt-BR')}
                                        </div>
                                    </div>

                                    <div className="flex sm:flex-col gap-2 shrink-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleViewSignatures(term)}
                                            className="h-9 px-3 text-purple-600 border-purple-200 hover:bg-purple-50 flex-1 sm:flex-none"
                                        >
                                            <Eye className="w-4 h-4 sm:mr-0 md:mr-2" />
                                            <span className="inline sm:hidden md:inline">Assinaturas</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpenModal(term)}
                                            className="h-9 px-3 text-blue-600 border-blue-200 hover:bg-blue-50 flex-1 sm:flex-none"
                                        >
                                            <Edit2 className="w-4 h-4 sm:mr-0 md:mr-2" />
                                            <span className="inline sm:hidden md:inline">Editar</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDelete(term.id)}
                                            className="h-9 px-3 text-red-500 border-red-200 hover:bg-red-50 flex-1 sm:flex-none"
                                        >
                                            <Trash2 className="w-4 h-4 sm:mr-0 md:mr-2" />
                                            <span className="inline sm:hidden md:inline">Excluir</span>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* MODAL DE CRIAÇÃO/EDIÇÃO */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingId ? 'Editar Termo de Aceite' : 'Novo Termo de Aceite'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 p-1">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <form id="term-form" onSubmit={handleSave} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Título do Termo</label>
                                    <Input
                                        required
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Ex: Termo de Autorização de Uso de Imagem"
                                        className="font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1 flex justify-between items-center">
                                        Conteúdo (Texto do Termo)
                                        <span className="text-xs font-normal text-slate-400">O pai lerá este texto antes de assinar.</span>
                                    </label>
                                    <textarea
                                        required
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        className="w-full h-48 p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none text-sm text-slate-700"
                                        placeholder="Cole aqui o texto jurídico ou explicativo completo..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    {/* Unidades */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2 border-b border-slate-200 pb-2">
                                            Unidades Aplicáveis
                                        </label>
                                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUnits.includes('all')}
                                                    onChange={() => toggleUnit('all')}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600">Todas as Unidades</span>
                                            </label>
                                            {Object.entries(UNIT_LABELS).map(([unitKey, unitLabel]) => (
                                                <label key={unitKey} className={`flex items-center gap-2 cursor-pointer group pl-2 ${selectedUnits.includes('all') ? 'opacity-50' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        disabled={selectedUnits.includes('all')}
                                                        checked={selectedUnits.includes(unitKey)}
                                                        onChange={() => toggleUnit(unitKey)}
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm text-slate-600 group-hover:text-blue-600">{unitLabel}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Segmentos */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2 border-b border-slate-200 pb-2">
                                            Segmentos / Níveis
                                        </label>
                                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                                            {segments.length === 0 ? (
                                                <span className="text-sm text-red-500 italic">Nenhum segmento configurado no sistema.</span>
                                            ) : (
                                                segments.map(seg => (
                                                    <label key={seg.id} className="flex items-center gap-2 cursor-pointer group">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedSegments.includes(seg.id)}
                                                            onChange={() => toggleSegment(seg.id)}
                                                            className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                                        />
                                                        <span className="text-sm text-slate-600 group-hover:text-orange-600">{seg.name}</span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 py-2 border-t border-slate-100 pt-4">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={isActive}
                                            onChange={(e) => setIsActive(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                        <span className="ml-3 text-sm font-bold text-slate-700">Termo Ativo (Visível no App)</span>
                                    </label>
                                </div>
                            </form>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <Button type="button" variant="outline" onClick={handleCloseModal}>
                                Cancelar
                            </Button>
                            <Button type="submit" form="term-form" disabled={saving}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                Salvar Termo
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE ASSINATURAS */}
            {isSignaturesModalOpen && selectedTermForSignatures && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <PenTool className="w-5 h-5 text-purple-600" />
                                    Assinaturas Recebidas
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">Termo: <span className="font-semibold text-slate-700">{selectedTermForSignatures.title}</span></p>
                            </div>
                            <button onClick={() => setIsSignaturesModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                            {loadingSignatures ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
                                    Buscando assinaturas...
                                </div>
                            ) : signatures.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                                    <PenTool className="w-12 h-12 text-slate-300 mx-auto mb-3 opacity-50" />
                                    <p className="text-slate-500 font-medium">Nenhum responsável assinou este termo ainda.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {signatures.map(sig => (
                                        <div key={sig.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                                            <div className="flex items-start justify-between mb-3 border-b border-slate-100 pb-3">
                                                <div>
                                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Aluno</span>
                                                    <h4 className="font-bold text-slate-800 text-sm">{sig.studentName}</h4>
                                                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block">
                                                        {UNIT_LABELS[sig.unit as SchoolUnit] || sig.unit}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-lg border border-slate-100 p-2 mb-3 min-h-[100px]">
                                                {sig.signatureBase64 ? (
                                                    <img src={sig.signatureBase64} alt="Assinatura" className="max-h-20 object-contain mix-blend-multiply" />
                                                ) : (
                                                    <span className="text-xs text-slate-300 italic">Assinatura corrompida</span>
                                                )}
                                            </div>

                                            <div className="text-[10px] text-slate-400 text-center font-mono">
                                                Assinado em: {new Date(sig.signedAt).toLocaleDateString('pt-BR')} às {new Date(sig.signedAt).toLocaleTimeString('pt-BR')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
