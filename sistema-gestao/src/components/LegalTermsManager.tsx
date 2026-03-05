import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, where, onSnapshot } from 'firebase/firestore';
import { Plus, Edit2, Trash2, Loader2, FileText, CheckCircle, XCircle, Users, Eye, PenTool, Bold, Italic, List, ListOrdered, Smile, Undo, Redo, Search } from 'lucide-react';
import type { LegalTerm, AcademicSegment, TermSignature, Student } from '../types';
import { UNIT_LABELS, SchoolUnit, SchoolShift, SHIFT_LABELS, SchoolClass } from '../types';
import { useAcademicData } from '../hooks/useAcademicData';

// Tiptap Imports
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { ListItem } from '@tiptap/extension-list-item';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) {
        return null;
    }

    const insertEmoji = (type: 'smile' | 'dot', color: 'orange' | 'navy') => {
        const hex = color === 'orange' ? '#ea580c' : '#172554';
        const content = type === 'smile' ? '☺ ' : '● ';
        editor.chain()
            .focus()
            .insertContent(`<span style="color: ${hex}">${content}</span>`)
            .run();
    };

    return (
        <div className="flex flex-wrap gap-1 p-2 bg-slate-50 border-b border-slate-200 sticky top-0 z-10 rounded-t-xl">
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`p-2 rounded hover:bg-slate-200 transition-colors ${editor.isActive('bold') ? 'bg-slate-200 text-blue-900 shadow-inner' : 'text-slate-600'}`}
                title="Negrito"
            >
                <Bold className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`p-2 rounded hover:bg-slate-200 transition-colors ${editor.isActive('italic') ? 'bg-slate-200 text-blue-900 shadow-inner' : 'text-slate-600'}`}
                title="Itálico"
            >
                <Italic className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-2 rounded hover:bg-slate-200 transition-colors ${editor.isActive('underline') ? 'bg-slate-200 text-blue-900 shadow-inner' : 'text-slate-600'}`}
                title="Sublinhado"
            >
                <span className="font-bold underline text-xs">U</span>
            </button>

            <div className="w-px h-6 bg-slate-200 mx-1 align-self-center my-auto"></div>

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded hover:bg-slate-200 transition-colors ${editor.isActive('bulletList') ? 'bg-slate-200 text-blue-900 shadow-inner' : 'text-slate-600'}`}
                title="Lista com marcadores"
            >
                <List className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded hover:bg-slate-200 transition-colors ${editor.isActive('orderedList') ? 'bg-slate-200 text-blue-900 shadow-inner' : 'text-slate-600'}`}
                title="Lista numerada"
            >
                <ListOrdered className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-slate-200 mx-1 align-self-center my-auto"></div>

            {/* GRUPO AZUL MARINHO */}
            <button
                type="button"
                onClick={() => insertEmoji('smile', 'navy')}
                className="p-1.5 rounded hover:bg-slate-200 transition-colors text-[#172554]"
                title="Rostinho Azul Marinho"
            >
                <Smile className="w-5 h-5" />
            </button>
            <button
                type="button"
                onClick={() => insertEmoji('dot', 'navy')}
                className="p-1.5 rounded hover:bg-slate-200 transition-colors"
                title="Ponto Azul Marinho"
            >
                <span className="w-4 h-4 rounded-full bg-[#172554] block"></span>
            </button>

            <div className="w-2"></div>

            {/* GRUPO LARANJA */}
            <button
                type="button"
                onClick={() => insertEmoji('smile', 'orange')}
                className="p-1.5 rounded hover:bg-slate-200 transition-colors text-[#ea580c]"
                title="Rostinho Laranja"
            >
                <Smile className="w-5 h-5" />
            </button>
            <button
                type="button"
                onClick={() => insertEmoji('dot', 'orange')}
                className="p-1.5 rounded hover:bg-slate-200 transition-colors"
                title="Ponto Laranja"
            >
                <span className="w-4 h-4 rounded-full bg-[#ea580c] block"></span>
            </button>

            <div className="flex-1"></div>

            <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                className="p-2 rounded hover:bg-slate-200 text-slate-500"
                title="Desfazer"
            >
                <Undo className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                className="p-2 rounded hover:bg-slate-200 text-slate-500"
                title="Refazer"
            >
                <Redo className="w-4 h-4" />
            </button>
        </div>
    );
};

interface EnrichedSignature extends TermSignature {
    studentData?: Student;
}

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

    const { grades } = useAcademicData();

    // Signatures State
    const [isSignaturesModalOpen, setIsSignaturesModalOpen] = useState(false);
    const [selectedTermForSignatures, setSelectedTermForSignatures] = useState<LegalTerm | null>(null);
    const [viewingTermContent, setViewingTermContent] = useState<LegalTerm | null>(null);
    const [signatures, setSignatures] = useState<EnrichedSignature[]>([]);
    const [loadingSignatures, setLoadingSignatures] = useState(false);
    const [expandedSignatureId, setExpandedSignatureId] = useState<string | null>(null);

    // Global Search State
    const [isGlobalSearchMode, setIsGlobalSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    // Filters for Signatures
    const [filterLevel, setFilterLevel] = useState<string>('');
    const [filterUnit, setFilterUnit] = useState<string>('');
    const [filterGrade, setFilterGrade] = useState<string>('');
    const [filterClass, setFilterClass] = useState<string>('');
    const [filterShift, setFilterShift] = useState<string>('');

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

            // Sync editor content only when opening
            if (editor) {
                editor.commands.setContent(term.content || '');
            }
        } else {
            setEditingId(null);
            setTitle('');
            setContent('');
            setIsActive(true);
            setSelectedUnits(['all']);
            setSelectedSegments(segments.map(s => s.id)); // Default todos

            if (editor) {
                editor.commands.setContent('');
            }
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextStyle,
            Color,
            ListItem,
            BulletList.configure({
                HTMLAttributes: {
                    class: 'list-disc ml-4',
                },
            }),
            OrderedList.configure({
                HTMLAttributes: {
                    class: 'list-decimal ml-4',
                },
            }),
            Link.configure({
                openOnClick: false,
            }),
        ],
        content: '',
        onUpdate: ({ editor }) => {
            setContent(editor.getHTML());
        },
    });

    // Remove the problematic useEffect that was syncing content back to editor
    // We now sync explicitly in handleOpenModal

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
                content: editor?.getHTML() || content,
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

            if (sigs.length > 0) {
                // Fetch student data to allow filtering by current academic position
                const studentIds = Array.from(new Set(sigs.map(s => s.studentId)));
                const studentsMap: Record<string, Student> = {};

                for (let i = 0; i < studentIds.length; i += 30) {
                    const chunk = studentIds.slice(i, i + 30);
                    const sq = query(collection(db, 'students'), where('__name__', 'in', chunk));
                    const sSnap = await getDocs(sq);
                    sSnap.docs.forEach(doc => {
                        studentsMap[doc.id] = { id: doc.id, ...doc.data() } as Student;
                    });
                }

                const enrichedSigs: EnrichedSignature[] = sigs.map(sig => ({
                    ...sig,
                    studentData: studentsMap[sig.studentId]
                }));

                enrichedSigs.sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime());
                setSignatures(enrichedSigs);
            } else {
                setSignatures([]);
            }

        } catch (error) {
            console.error("Erro ao buscar assinaturas:", error);
            alert("Erro ao buscar as assinaturas.");
        } finally {
            setLoadingSignatures(false);
        }
    };

    const handleOpenGlobalSearch = () => {
        setIsGlobalSearchMode(true);
        setSelectedTermForSignatures(null);
        setSignatures([]);
        setSearchQuery('');
        setHasSearched(false);
        setIsSignaturesModalOpen(true);
    };

    const handleGlobalSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setLoadingSignatures(true);
        setHasSearched(true);
        setSignatures([]);

        try {
            const queryTerm = searchQuery.trim();
            const isCpfFormat = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(queryTerm) || /^\d{11}$/.test(queryTerm);

            let matchedStudentIds: string[] = [];

            // Step 1: Search in students if it doesn't look like a CPF right away
            if (!isCpfFormat) {
                // Try to find by code first (exact match)
                let sQuery = query(collection(db, 'students'), where('code', '==', queryTerm));
                let sSnap = await getDocs(sQuery);

                if (!sSnap.empty) {
                    matchedStudentIds = sSnap.docs.map(d => d.id);
                } else {
                    // Try by name (prefix search - simplistic approach for now, usually requires full text search like algolia)
                    // We'll trust code more for direct hits, but let's try a basic query
                    // Firestore is limited here, so we might need a more robust approach in production if names are common
                    // For now, if no code matches, we proceed to check CPF or just rely on the studentId matching later
                }
            }

            let fetchedSigs: TermSignature[] = [];

            // Step 2: Search signatures
            if (matchedStudentIds.length > 0) {
                // Found student(s), get their signatures
                // Firestore 'in' query supports up to 10 items.
                const chunks = [];
                for (let i = 0; i < matchedStudentIds.length; i += 10) {
                    chunks.push(matchedStudentIds.slice(i, i + 10));
                }

                for (const chunk of chunks) {
                    const q = query(collection(db, 'term_signatures'), where('studentId', 'in', chunk));
                    const res = await getDocs(q);
                    res.docs.forEach(d => fetchedSigs.push({ id: d.id, ...d.data() } as TermSignature));
                }
            } else {
                // Search directly by CPF
                // Try exact format or clean format if stored consistently. Assuming exact format typed for now.
                const q = query(collection(db, 'term_signatures'), where('signerCpf', '==', queryTerm));
                const res = await getDocs(q);
                fetchedSigs = res.docs.map(d => ({ id: d.id, ...d.data() } as TermSignature));
            }

            if (fetchedSigs.length > 0) {
                // Enrich with student data just like in term view
                const studentIds = Array.from(new Set(fetchedSigs.map(s => s.studentId)));
                const studentsMap: Record<string, Student> = {};

                for (let i = 0; i < studentIds.length; i += 30) {
                    const chunk = studentIds.slice(i, i + 30);
                    const sq = query(collection(db, 'students'), where('__name__', 'in', chunk));
                    const sSnap = await getDocs(sq);
                    sSnap.docs.forEach(doc => {
                        studentsMap[doc.id] = { id: doc.id, ...doc.data() } as Student;
                    });
                }

                // Also get term details to display term title in global search
                const termIds = Array.from(new Set(fetchedSigs.map(s => s.termId)));
                const termsMap: Record<string, string> = {}; // id -> title

                for (let i = 0; i < termIds.length; i += 30) {
                    const chunk = termIds.slice(i, i + 30);
                    const tq = query(collection(db, 'legal_terms'), where('__name__', 'in', chunk));
                    const tSnap = await getDocs(tq);
                    tSnap.docs.forEach(doc => {
                        termsMap[doc.id] = doc.data().title;
                    });
                }

                const enrichedSigs: EnrichedSignature[] = fetchedSigs.map(sig => ({
                    ...sig,
                    studentData: studentsMap[sig.studentId],
                    termTitle: termsMap[sig.termId] || 'Termo Excluído/Desconhecido' // Add term title
                }));

                enrichedSigs.sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime());
                setSignatures(enrichedSigs);
            }

        } catch (error) {
            console.error("Erro na busca global:", error);
            alert("Erro ao realizar a busca.");
        } finally {
            setLoadingSignatures(false);
        }
    };

    const handleOverrideRejection = async (signatureId: string, studentName: string) => {
        if (!window.confirm(`Tem certeza que deseja marcar a assinatura de ${studentName} como NÃO AUTORIZADA? Essa ação não pode ser desfeita e refletirá imediatamente no painel do fotógrafo.`)) {
            return;
        }

        try {
            await updateDoc(doc(db, 'term_signatures', signatureId), {
                isAuthorized: false
            });

            // Update local state
            setSignatures(prev => prev.map(sig =>
                sig.id === signatureId ? { ...sig, isAuthorized: false } : sig
            ));

            alert('Assinatura marcada como NÃO AUTORIZADA com sucesso.');
        } catch (error) {
            console.error("Erro ao atualizar assinatura:", error);
            alert("Erro ao tentar atualizar o status da assinatura.");
        }
    };

    const handleResetSignature = async (signatureId: string, studentName: string) => {
        if (!window.confirm(`Tem certeza que deseja apagar a assinatura de ${studentName}? O termo ficará pendente novamente para o responsável assinar.`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'term_signatures', signatureId));

            // Remove from local state
            setSignatures(prev => prev.filter(sig => sig.id !== signatureId));

            alert('Assinatura apagada com sucesso. O termo está disponível para nova assinatura.');

            if (expandedSignatureId === signatureId) {
                setExpandedSignatureId(null);
            }
        } catch (error) {
            console.error("Erro ao apagar assinatura:", error);
            alert("Erro ao tentar apagar a assinatura.");
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

    // Apply filters to signatures
    const filteredSignatures = signatures.filter(sig => {
        if (!sig.studentData) return true; // If somehow student data failed to load, don't hide them outright, but they might lack filter fields

        const sData = sig.studentData;
        const matchesLevel = !filterLevel || sData.gradeId?.startsWith(filterLevel) || sData.gradeLevel?.includes(segments.find(sg => sg.id === filterLevel)?.name || '');
        const matchesUnit = !filterUnit || sig.unit === filterUnit;
        const matchesGrade = !filterGrade || sData.gradeLevel === filterGrade;
        const matchesClass = !filterClass || sData.schoolClass === filterClass;
        const matchesShift = !filterShift || sData.shift === filterShift;

        return matchesLevel && matchesUnit && matchesGrade && matchesClass && matchesShift;
    });

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
                <div className="flex gap-2 w-full sm:w-auto shrink-0">
                    <Button onClick={handleOpenGlobalSearch} variant="outline" className="gap-2 shrink-0 border-blue-200 text-blue-950 hover:bg-blue-50 flex-1 sm:flex-none">
                        <Search className="w-4 h-4" />
                        Buscar Assinaturas
                    </Button>
                    <Button onClick={() => handleOpenModal()} className="gap-2 shrink-0 flex-1 sm:flex-none">
                        <Plus className="w-4 h-4" />
                        Novo Termo
                    </Button>
                </div>
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
                                            <div className="flex items-start gap-2 text-blue-950">
                                                <div className="p-1 bg-blue-100 text-blue-900 rounded mt-0.5">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                </div>
                                                <div>
                                                    <span className="font-semibold block text-xs tracking-wider uppercase text-slate-400">Unidades</span>
                                                    <span>{getUnitNames(term.units)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2 text-slate-600">
                                                <div className="p-1 bg-orange-100 text-orange-600 rounded mt-0.5">
                                                    <Users className="w-3 h-3" />
                                                </div>
                                                <div>
                                                    <span className="font-semibold block text-xs tracking-wider uppercase text-slate-400">Segmentos</span>
                                                    <span>{getSegmentNames(term.targetSegments)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-blue-950 font-bold hover:bg-blue-50 gap-2 p-0 h-auto hover:underline"
                                                onClick={() => setViewingTermContent(term)}
                                            >
                                                <FileText className="w-3 h-3" />
                                                Ver Termo
                                            </Button>
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100 italic">
                                            Criado em: {new Date(term.createdAt).toLocaleDateString('pt-BR')} às {new Date(term.createdAt).toLocaleTimeString('pt-BR')}
                                        </div>
                                    </div>

                                    <div className="flex sm:flex-col gap-2 shrink-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleViewSignatures(term)}
                                            className="h-9 px-3 text-orange-600 border-orange-200 hover:bg-orange-50 flex-1 sm:flex-none"
                                        >
                                            <Eye className="w-4 h-4 sm:mr-0 md:mr-2" />
                                            <span className="inline sm:hidden md:inline">Assinaturas</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpenModal(term)}
                                            className="h-9 px-3 text-blue-950 border-blue-200 hover:bg-blue-50 flex-1 sm:flex-none"
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

                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between items-center">
                                        Conteúdo do Termo
                                        <span className="text-xs font-normal text-slate-400">O pai lerá este texto antes de assinar.</span>
                                    </label>
                                    <div className="border border-slate-300 rounded-xl focus-within:ring-2 focus-within:ring-blue-950/20 focus-within:border-blue-950 transition-all overflow-hidden bg-white min-h-[300px] flex flex-col">
                                        <MenuBar editor={editor} />
                                        <EditorContent
                                            editor={editor}
                                            className="prose prose-sm max-w-none p-4 focus:outline-none flex-1 overflow-y-auto min-h-[250px] tiptap-editor !border-none"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 font-medium italic">O texto formatado será exibido exatamente assim para o aluno.</p>
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

            {/* MODAL DE ASSINATURAS E BUSCA GLOBAL */}
            {isSignaturesModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    {isGlobalSearchMode ? (
                                        <>
                                            <Search className="w-5 h-5 text-blue-950" />
                                            Busca Global de Assinaturas
                                        </>
                                    ) : (
                                        <>
                                            <PenTool className="w-5 h-5 text-orange-600" />
                                            Assinaturas Recebidas
                                        </>
                                    )}
                                </h2>
                                {!isGlobalSearchMode && selectedTermForSignatures && (
                                    <p className="text-sm text-slate-500 mt-1">Termo: <span className="font-semibold text-slate-700">{selectedTermForSignatures.title}</span></p>
                                )}
                            </div>
                            <button onClick={() => setIsSignaturesModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        {/* FILTERS / SEARCH SECTION */}
                        <div className="bg-white border-b border-slate-200 p-4 shrink-0">
                            {isGlobalSearchMode ? (
                                <form onSubmit={handleGlobalSearch} className="flex gap-3">
                                    <Input
                                        type="text"
                                        placeholder="Digite o Nome do Aluno, Código ou CPF do Responsável (Ex: 000.000.000-00)"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="flex-1 font-medium bg-slate-50 border-slate-300 focus:bg-white focus:ring-blue-500/20"
                                        autoFocus
                                    />
                                    <Button type="submit" disabled={loadingSignatures} className="bg-blue-950 hover:bg-blue-900 shrink-0">
                                        {loadingSignatures ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                                        Buscar
                                    </Button>
                                </form>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Unidade</label>
                                        <select
                                            value={filterUnit}
                                            onChange={e => setFilterUnit(e.target.value)}
                                            className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">Todas as Unidades</option>
                                            {Object.entries(UNIT_LABELS).map(([unitKey, unitLabel]) => (
                                                <option key={unitKey} value={unitKey}>{unitLabel}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nível / Segmento</label>
                                        <select
                                            value={filterLevel}
                                            onChange={e => setFilterLevel(e.target.value)}
                                            className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">Todos os Níveis</option>
                                            {segments.map(seg => (
                                                <option key={seg.id} value={seg.id}>{seg.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Série / Ano</label>
                                        <select
                                            value={filterGrade}
                                            onChange={e => setFilterGrade(e.target.value)}
                                            className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-400"
                                            disabled={!filterLevel}
                                        >
                                            <option value="">{filterLevel ? 'Todas as Séries' : 'Selecione o Nível 1º'}</option>
                                            {grades
                                                .filter(g => g.segmentId === filterLevel)
                                                .map(g => (
                                                    <option key={g.id} value={`${g.name} - ${segments.find(s => s.id === g.segmentId)?.name}`}>
                                                        {g.name}
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Turma</label>
                                        <select
                                            value={filterClass}
                                            onChange={e => setFilterClass(e.target.value)}
                                            className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">Todas</option>
                                            {Object.values(SchoolClass).map(c => (
                                                <option key={c} value={c}>Turma {c}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Turno</label>
                                        <select
                                            value={filterShift}
                                            onChange={e => setFilterShift(e.target.value)}
                                            className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">Todos</option>
                                            {Object.values(SchoolShift).map(shift => (
                                                <option key={shift} value={shift}>{SHIFT_LABELS[shift]}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                            {loadingSignatures ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-4" />
                                    Buscando assinaturas...
                                </div>
                            ) : filteredSignatures.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                                    {isGlobalSearchMode ? (
                                        <>
                                            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3 opacity-50" />
                                            <p className="text-slate-500 font-medium">
                                                {hasSearched ? "Nenhuma assinatura encontrada para esta busca." : "Digite os dados acima para buscar um registro."}
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <PenTool className="w-12 h-12 text-slate-300 mx-auto mb-3 opacity-50" />
                                            <p className="text-slate-500 font-medium">Nenhum responsável com este filtro assinou este termo ainda.</p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex gap-4 mb-4 text-sm">
                                        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200">
                                            <CheckCircle className="w-4 h-4" />
                                            <span className="font-bold mb-0.5">Autorizados:</span>
                                            <span className="font-bold bg-green-200 text-green-800 px-2 py-0.5 rounded-full text-xs">
                                                {filteredSignatures.filter(s => s.isAuthorized !== false).length}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-200">
                                            <XCircle className="w-4 h-4" />
                                            <span className="font-bold mb-0.5">Não Autorizados:</span>
                                            <span className="font-bold bg-red-200 text-red-800 px-2 py-0.5 rounded-full text-xs">
                                                {filteredSignatures.filter(s => s.isAuthorized === false).length}
                                            </span>
                                        </div>
                                    </div>
                                    {filteredSignatures.map(sig => (
                                        <div key={sig.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-slate-800 text-sm uppercase">{sig.studentData?.name || sig.studentName}</h4>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 text-[10px] font-bold mt-2">
                                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                                            <div className="flex items-center bg-blue-50 text-blue-800 px-3 py-1 rounded-lg border border-blue-100 shadow-sm">
                                                                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                                                    CÓD: <span className="text-blue-600">{sig.studentData?.code || '---'}</span>
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center bg-slate-100 text-slate-600 px-3 py-1 rounded-lg border border-slate-200">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{sig.unit}</span>
                                                            </div>
                                                            <div className="flex items-center bg-orange-50 text-orange-700 px-3 py-1 rounded-lg border border-orange-100">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{sig.studentData?.gradeLevel}</span>
                                                            </div>
                                                            <div className="flex items-center bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg border border-emerald-100">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{sig.studentData?.schoolClass}</span>
                                                            </div>
                                                            <div className="flex items-center bg-amber-50 text-amber-700 px-3 py-1 rounded-lg border border-amber-100">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{SHIFT_LABELS[sig.studentData?.shift as SchoolShift] || sig.studentData?.shift}</span>
                                                            </div>
                                                            {isGlobalSearchMode && (sig as any).termTitle && (
                                                                <div className="flex items-center bg-blue-50 text-blue-900 px-3 py-1 rounded-lg border border-blue-200 w-full sm:w-auto mt-1 sm:mt-0">
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[200px] md:max-w-xs block" title={(sig as any).termTitle}>
                                                                        📄 {(sig as any).termTitle}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* SIGNER DETAILS */}
                                                    {(sig as any).signerName && (
                                                        <div className="mt-3 p-2 bg-slate-50 border border-slate-100 rounded-lg">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <PenTool className="w-3 h-3 text-orange-600" />
                                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assinado por</span>
                                                            </div>
                                                            <div className="flex flex-wrap items-baseline gap-2">
                                                                <span className="text-sm font-bold text-slate-800">{(sig as any).signerName}</span>
                                                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">{(sig as any).signerRole}</span>
                                                                <span className="text-[10px] text-slate-500 font-mono">CPF: {(sig as any).signerCpf}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col sm:items-end gap-2 shrink-0 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                                                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                                        {sig.isAuthorized === false ? (
                                                            <>
                                                                <XCircle className="w-3 h-3 text-red-500" />
                                                                <span className="text-red-500 font-bold uppercase">Não Autorizado em:</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CheckCircle className="w-3 h-3 text-green-500" />
                                                                <span className="text-green-500 font-bold uppercase">Autorizado em:</span>
                                                            </>
                                                        )}
                                                        {new Date(sig.signedAt).toLocaleDateString('pt-BR')} às {new Date(sig.signedAt).toLocaleTimeString('pt-BR')}
                                                    </div>
                                                    <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                                        {sig.isAuthorized !== false && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 text-xs py-0 flex-1 sm:flex-none text-red-600 border-red-200 hover:bg-red-50"
                                                                onClick={() => handleOverrideRejection(sig.id, sig.studentData?.name || sig.studentName)}
                                                            >
                                                                Tornar 'Não Autorizado'
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 text-xs py-0 flex-1 sm:flex-none text-orange-600 border-orange-200 hover:bg-orange-50"
                                                            onClick={() => handleResetSignature(sig.id, sig.studentData?.name || sig.studentName)}
                                                            title="Apagar assinatura para que o responsável assine novamente"
                                                        >
                                                            <Undo className="w-3 h-3 mr-1" />
                                                            Liberar p/ Assinar
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 text-xs py-0 flex-1 sm:flex-none text-blue-950 hover:text-blue-900 border-blue-950/20 hover:bg-slate-50"
                                                            onClick={() => setExpandedSignatureId(expandedSignatureId === sig.id ? null : sig.id)}
                                                        >
                                                            {expandedSignatureId === sig.id ? 'Ocultar Assinatura' : 'Ver Assinatura'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* EXPANDABLE SIGNATURE VIEWER */}
                                            {expandedSignatureId === sig.id && (
                                                <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex justify-center">
                                                        {sig.signatureBase64 ? (
                                                            <img src={sig.signatureBase64} alt="Assinatura Digital" className="max-h-32 object-contain mix-blend-multiply" />
                                                        ) : (
                                                            <span className="text-sm text-slate-400 italic">Assinatura corrompida ou não disponível.</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PARA VISUALIZAR TEXTO DO TERMO */}
            {viewingTermContent && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Texto do Termo</h2>
                                <p className="text-sm text-slate-500 mt-0.5">{viewingTermContent.title}</p>
                            </div>
                            <button onClick={() => setViewingTermContent(null)} className="text-slate-400 hover:text-slate-600 p-1">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto flex-1">
                            <div className="prose prose-slate max-w-none">
                                <div
                                    className="text-slate-700 leading-relaxed text-base prose prose-slate"
                                    dangerouslySetInnerHTML={{ __html: viewingTermContent.content }}
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <Button onClick={() => setViewingTermContent(null)} className="px-8">
                                Fechar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS fix for list visibility and editor appearance */}
            <style>{`
                .tiptap-editor {
                    min-height: 250px;
                    outline: none;
                }
                .tiptap-editor .ProseMirror {
                    outline: none !important;
                    border: none !important;
                    min-height: 250px;
                }
                .tiptap-editor .ProseMirror:focus {
                    outline: none !important;
                    border: none !important;
                }
                .tiptap-editor ul {
                    list-style-type: disc !important;
                    padding-left: 1.5rem !important;
                    margin: 1rem 0 !important;
                    display: block !important;
                }
                .tiptap-editor ol {
                    list-style-type: decimal !important;
                    padding-left: 1.5rem !important;
                    margin: 1rem 0 !important;
                    display: block !important;
                }
                .tiptap-editor li {
                    display: list-item !important;
                    margin-bottom: 0.25rem !important;
                }
                .tiptap-editor p {
                    margin: 0.5rem 0 !important;
                }
                .prose ul, .prose ol {
                    list-style-position: inside;
                }
                .prose li p {
                    display: inline;
                }
            `}</style>
        </div>
    );
};
