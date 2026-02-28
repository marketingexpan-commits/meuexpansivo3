import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { Student, LegalTerm, TermSignature } from '../types';
import { parseGradeLevel } from '../utils/academicUtils';
import { Loader2, FileText, CheckCircle, PenTool, AlertCircle, XCircle } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from './Button';

interface TermsSignerProps {
    student: Student;
}

export const TermsSigner: React.FC<TermsSignerProps> = ({ student }) => {
    const [terms, setTerms] = useState<LegalTerm[]>([]);
    const [signatures, setSignatures] = useState<TermSignature[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [selectedTerm, setSelectedTerm] = useState<LegalTerm | null>(null);
    const [isSigningMode, setIsSigningMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const sigCanvas = useRef<SignatureCanvas>(null);

    // Canvas scaling fix for responsive/mobile layouts
    useEffect(() => {
        const handleResize = () => {
            if (sigCanvas.current && isSigningMode) {
                const canvas = sigCanvas.current.getCanvas();
                const ratio = Math.max(window.devicePixelRatio || 1, 1);

                // Only resize if the container actually has a width
                if (canvas.offsetWidth === 0) return;

                // Save current drawing if any
                const data = sigCanvas.current.toData();

                canvas.width = canvas.offsetWidth * ratio;
                canvas.height = canvas.offsetHeight * ratio;
                canvas.getContext('2d')?.scale(ratio, ratio);

                sigCanvas.current.clear();
                if (data && data.length > 0) {
                    sigCanvas.current.fromData(data);
                }
            }
        };

        if (isSigningMode) {
            // Slight delay ensures the modal DOM is fully painted and sized
            const timer = setTimeout(handleResize, 100);
            window.addEventListener('resize', handleResize);

            return () => {
                clearTimeout(timer);
                window.removeEventListener('resize', handleResize);
            };
        }
    }, [isSigningMode]);

    useEffect(() => {
        const fetchTermsAndSignatures = async () => {
            setLoading(true);
            try {
                // 1. Fetch active terms
                const termsQ = query(collection(db, 'legal_terms'), where('isActive', '==', true));
                const termsSnap = await getDocs(termsQ);
                const allActiveTerms = termsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LegalTerm));

                // Filter by unit and segment
                const segmentId = parseGradeLevel(student.gradeLevel).segmentId;
                const applicableTerms = allActiveTerms.filter(term => {
                    const servesUnit = term.units.includes('all') || term.units.includes(student.unit);
                    const servesSegment = term.targetSegments.includes(segmentId);
                    return servesUnit && servesSegment;
                });

                // 2. Fetch student's signatures
                const sigsQ = query(collection(db, 'term_signatures'), where('studentId', '==', student.id));
                const sigsSnap = await getDocs(sigsQ);
                const mySigs = sigsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TermSignature));

                // Sort terms (newest creation first)
                applicableTerms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                setTerms(applicableTerms);
                setSignatures(mySigs);
            } catch (error) {
                console.error("Erro ao carregar os termos:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTermsAndSignatures();
    }, [student.id, student.unit, student.gradeLevel]);

    const getSignatureForTerm = (termId: string) => {
        return signatures.find(s => s.termId === termId);
    };

    const pendingTerms = terms.filter(t => !getSignatureForTerm(t.id));
    const signedTerms = terms.filter(t => getSignatureForTerm(t.id));

    const handleClearSignature = () => {
        if (sigCanvas.current) {
            sigCanvas.current.clear();
        }
    };

    const handleSaveSignature = async () => {
        if (!selectedTerm || !sigCanvas.current || sigCanvas.current.isEmpty()) {
            alert("Por favor, assine no campo indicado antes de salvar.");
            return;
        }

        setIsSubmitting(true);
        try {
            const signatureData = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');

            const sigPayload: Omit<TermSignature, 'id'> = {
                termId: selectedTerm.id,
                studentId: student.id,
                studentName: student.name,
                unit: student.unit,
                signatureBase64: signatureData,
                signedAt: new Date().toISOString()
            };

            const docRef = await addDoc(collection(db, 'term_signatures'), sigPayload);
            const newSignature: TermSignature = { id: docRef.id, ...sigPayload };

            setSignatures(prev => [...prev, newSignature]);

            setSelectedTerm(null);
            setIsSigningMode(false);

            alert("Termo assinado com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar assinatura", error);
            alert("Erro ao validar assinatura. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openTermDetails = (term: LegalTerm) => {
        setSelectedTerm(term);
        setIsSigningMode(!getSignatureForTerm(term.id)); // Only signing mode if not signed
    };

    return (
        <div className="animate-fade-in-up pb-20">
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-orange-100 p-2 rounded-xl">
                    <PenTool className="w-6 h-6 text-orange-700" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-800">Autorizações e Termos</h2>
                    <p className="text-gray-500 text-sm mt-0.5">Assine os termos enviados pela coordenação.</p>
                </div>
            </div>

            {loading ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-4" />
                    <p className="text-gray-500 font-medium">Buscando termos aplicáveis...</p>
                </div>
            ) : terms.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center">
                    <CheckCircle className="w-12 h-12 text-green-400 mb-4 opacity-70" />
                    <h3 className="font-bold text-gray-800 text-lg mb-1">Tudo certo por aqui!</h3>
                    <p className="text-gray-500 text-sm">Nenhum termo pendente ou direcionado para a sua turma no momento.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* PEDING TERMS */}
                    {pendingTerms.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-orange-500" />
                                Pendentes de Assinatura ({pendingTerms.length})
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {pendingTerms.map(term => (
                                    <div
                                        key={term.id}
                                        onClick={() => openTermDetails(term)}
                                        className="bg-white p-4 border-2 border-orange-200 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 bg-orange-100 p-1.5 rounded-lg text-orange-600">
                                                <PenTool className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                                    {term.title}
                                                </h4>
                                                <p className="text-[10px] text-slate-400 mt-1 italic font-medium">Toque para ler os termos completos</p>
                                            </div>
                                        </div>
                                        <Button size="sm" className="shrink-0 bg-blue-950 text-white hover:bg-blue-900 shadow-sm transition-colors border-0">
                                            Assinar
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SIGNED TERMS */}
                    {signedTerms.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Assinados ({signedTerms.length})
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {signedTerms.map(term => {
                                    const sig = getSignatureForTerm(term.id);
                                    return (
                                        <div
                                            key={term.id}
                                            onClick={() => openTermDetails(term)}
                                            className="bg-white p-4 border border-gray-100 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between group opacity-75 hover:opacity-100"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 bg-green-50 p-1.5 rounded-lg text-green-600">
                                                    <CheckCircle className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 line-through decoration-gray-300">
                                                        {term.title}
                                                    </h4>
                                                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                                                        Assinado em: {sig ? new Date(sig.signedAt).toLocaleDateString('pt-BR') : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-blue-500 font-bold group-hover:underline">Ver Termo</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL DO TERMO */}
            {selectedTerm && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-300">
                        {/* HEADER */}
                        <div className="p-4 sm:p-5 border-b border-gray-100 bg-slate-50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedTerm.title}</h3>
                                {getSignatureForTerm(selectedTerm.id) && (
                                    <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full uppercase tracking-wider mt-1 inline-block">
                                        Assinado Eletronicamente
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedTerm(null)}
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        {/* SCROLLABLE BODY */}
                        <div className="flex-1 overflow-y-auto flex flex-col">
                            {/* CONTENT */}
                            <div
                                className="p-5 flex-1 text-sm text-gray-700 leading-relaxed font-serif prose prose-slate max-w-none"
                                dangerouslySetInnerHTML={{ __html: selectedTerm.content }}
                            />

                            {/* FOOTER / SIGNATURE AREA */}
                            <div className="p-5 border-t border-gray-100 bg-gray-50 shrink-0">
                                {isSigningMode ? (
                                    <div className="space-y-4">
                                        <div className="text-center">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                                Assine no quadro abaixo
                                            </p>
                                            <div className="border-2 border-dashed border-gray-300 rounded-xl bg-white overflow-hidden relative touch-none">
                                                <SignatureCanvas
                                                    ref={sigCanvas}
                                                    canvasProps={{
                                                        className: 'signature-canvas w-full h-40 cursor-crosshair'
                                                    }}
                                                    backgroundColor="white"
                                                />
                                                <button
                                                    onClick={handleClearSignature}
                                                    className="absolute top-2 right-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 py-1 px-2 rounded-lg transition-colors border border-gray-200 shadow-sm"
                                                >
                                                    Limpar
                                                </button>
                                            </div>
                                        </div>
                                        <Button
                                            className="w-full text-base font-bold h-12 bg-blue-950 hover:bg-blue-900 shadow-lg shadow-blue-900/20"
                                            onClick={handleSaveSignature}
                                            isLoading={isSubmitting}
                                        >
                                            EU CONCORDO E ASSINO ESTE TERMO
                                        </Button>
                                        <p className="text-[10px] text-gray-400 text-center leading-tight">
                                            Ao clicar neste botão, o responsável/pai do aluno ({student.name}) concorda integralmente com as disposições legais listadas no termo acima, possuindo este clique o mesmo valor legal de uma assinatura física.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        {getSignatureForTerm(selectedTerm.id) ? (
                                            <div className="flex flex-col items-center">
                                                <p className="font-bold text-green-600 mb-2 flex items-center gap-1">
                                                    <CheckCircle className="w-5 h-5" />
                                                    Assinatura Registrada
                                                </p>
                                                <div className="border border-gray-200 bg-white p-2 rounded-lg mb-2">
                                                    <img
                                                        src={getSignatureForTerm(selectedTerm.id)?.signatureBase64}
                                                        alt="Assinatura"
                                                        className="max-h-24 mix-blend-multiply"
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 font-mono">
                                                    Data: {new Date(getSignatureForTerm(selectedTerm.id)!.signedAt).toLocaleString('pt-BR')}
                                                </p>
                                            </div>
                                        ) : (
                                            <Button variant="outline" className="w-full" onClick={() => setSelectedTerm(null)}>
                                                Fechar Módulo
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* CSS fix for list visibility in terms */}
            <style>{`
                .prose ul {
                    list-style-type: disc !important;
                    padding-left: 1.5rem !important;
                    margin: 1rem 0 !important;
                }
                .prose ol {
                    list-style-type: decimal !important;
                    padding-left: 1.5rem !important;
                    margin: 1rem 0 !important;
                }
                .prose li {
                    display: list-item !important;
                    margin-bottom: 0.25rem !important;
                }
                .prose p {
                    margin: 0.5rem 0 !important;
                }
            `}</style>
        </div>
    );
};

