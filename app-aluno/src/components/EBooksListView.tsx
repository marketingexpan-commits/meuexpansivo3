import React, { useState, useEffect } from 'react';
import { BookOpen, Lock, ChevronRight, Loader2, ShoppingCart, Trash2, X, QrCode, Award, Check, Copy } from 'lucide-react';
import { Student } from '../types';
import { db } from '../firebaseConfig';
import { ACADEMIC_GRADES, ACADEMIC_SEGMENTS } from '../utils/academicDefaults';

interface EBooksListViewProps {
    student: Student;
    onOpenBook: (bookId: string) => void;
}

const EBooksListView: React.FC<EBooksListViewProps> = ({ student, onOpenBook }) => {
    const [books, setBooks] = useState<any[]>([]);
    const [progressData, setProgressData] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [cartItems, setCartItems] = useState<any[]>(() => {
        try {
            const savedCart = localStorage.getItem(`expansivo_cart_${student?.id}`);
            return savedCart ? JSON.parse(savedCart) : [];
        } catch (e) {
            console.error("Erro ao carregar o carrinho:", e);
            return [];
        }
    });
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [purchasedBookIds, setPurchasedBookIds] = useState<Set<string>>(new Set());
    const [showPixSimulator, setShowPixSimulator] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);
    const [pixPayload, setPixPayload] = useState<string | null>(null);
    const [pixEncodedImage, setPixEncodedImage] = useState<string | null>(null);
    const [isGeneratingPix, setIsGeneratingPix] = useState(false);
    const [pixError, setPixError] = useState<string | null>(null);

    // Sincroniza o carrinho com o localStorage sempre que mudar
    useEffect(() => {
        if (student?.id) {
            localStorage.setItem(`expansivo_cart_${student.id}`, JSON.stringify(cartItems));
        }
    }, [cartItems, student?.id]);

    useEffect(() => {
        if (!student?.id) return;

        const unsubscribePurchases = db.collection('ebook_purchases')
            .where('studentId', '==', student.id)
            .onSnapshot((snapshot) => {
                const ids = new Set<string>();
                snapshot.docs.forEach(doc => {
                    ids.add(doc.data().bookId);
                });
                setPurchasedBookIds(ids);
            }, (error) => {
                console.error("Erro ao carregar compras:", error);
            });

        return () => unsubscribePurchases();
    }, [student?.id]);

    // Monitora a liberação dos livros no Firestore para confirmar o pagamento em tempo real
    useEffect(() => {
        if (showPixSimulator && cartItems.length > 0) {
            const allItemsPurchased = cartItems.every(item => purchasedBookIds.has(item.id));
            if (allItemsPurchased) {
                setPaymentSuccess(true);
                setCartItems([]);
                
                // Fecha o modal e limpa o estado de sucesso após 3 segundos
                const timer = setTimeout(() => {
                    setShowPixSimulator(false);
                    setIsCheckoutModalOpen(false);
                    setPaymentSuccess(false);
                    setPixPayload(null);
                    setPixEncodedImage(null);
                }, 3000);

                return () => clearTimeout(timer);
            }
        }
    }, [purchasedBookIds, showPixSimulator, cartItems]);

    const handleGeneratePixPayment = async () => {
        setIsGeneratingPix(true);
        setPixError(null);
        setPixPayload(null);
        setPixEncodedImage(null);
        setShowPixSimulator(true);

        try {
            const bookIds = cartItems.map(item => item.id).join('-');
            const bookTitle = cartItems.map(item => item.title).join(', ');

            const response = await fetch('https://us-central1-meu-expansivo-app.cloudfunctions.net/criarCobrancaPixEbook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    studentId: student.id,
                    studentName: student.name,
                    studentGrade: student.gradeLevel || '',
                    bookId: bookIds,
                    bookTitle: bookTitle,
                    price: cartTotal
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Erro ao gerar cobrança PIX');
            }

            const data = await response.json();
            if (data.success) {
                setPixPayload(data.payload);
                setPixEncodedImage(data.encodedImage);
            } else {
                throw new Error('Falha ao processar resposta do Asaas');
            }
        } catch (e: any) {
            console.error("Erro ao gerar PIX do Asaas:", e);
            setPixError(e.message || "Não foi possível gerar o código PIX. Verifique se o Asaas está configurado no painel de Gestão.");
        } finally {
            setIsGeneratingPix(false);
        }
    };

    useEffect(() => {
        if (!student?.id) return;

        // Fetch Progress Data
        const unsubscribeProgress = db.collection('ebook_progress')
            .where('studentId', '==', student.id)
            .onSnapshot((snapshot) => {
                const progressMap: Record<string, any> = {};
                snapshot.docs.forEach(doc => {
                    progressMap[doc.data().bookId] = doc.data();
                });
                setProgressData(progressMap);
            });

        // Fetch only active books
        const unsubscribeBooks = db.collection('e_books')
            .where('status', '==', 'Ativo')
            .onSnapshot((snapshot) => {
                const booksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // --- FILTRAGEM POR SEGMENTO ---
                let studentSegmentId = '';
                const officialGrade = Object.values(ACADEMIC_GRADES).find(g => 
                    g.id === student?.gradeId || 
                    g.label === student?.gradeLevel
                );
                if (officialGrade) {
                    studentSegmentId = officialGrade.segmentId;
                }

                const filteredBooks = booksData.filter((book: any) => {
                    if (!book.segment) return true;
                    const segments = Array.isArray(book.segment) ? book.segment : [book.segment];
                    return segments.includes(studentSegmentId) || 
                           segments.includes('all') || 
                           segments.some(seg => 
                               seg === 'Educação Infantil' && studentSegmentId === 'seg_infantil' ||
                               seg === 'Fundamental I' && studentSegmentId === 'seg_fund_1' ||
                               seg === 'Fundamental II' && studentSegmentId === 'seg_fund_2'
                           );
                });

                setBooks(filteredBooks);
                setIsLoading(false);
            }, (error) => {
                console.error("Erro ao carregar livros:", error);
                setIsLoading(false);
            });

        return () => {
            unsubscribeProgress();
            unsubscribeBooks();
        };
    }, [student]);

    const toggleCartItem = (book: any) => {
        setCartItems(prev => {
            if (prev.find(item => item.id === book.id)) {
                return prev.filter(item => item.id !== book.id);
            }
            return [...prev, book];
        });
    };

    const cartTotal = cartItems.reduce((acc, item) => acc + item.price, 0);

    return (
        <div className="animate-fade-in-up pb-32">
            <h3 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-blue-900" />
                e-Livros Digitais
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {isLoading ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 size={32} className="animate-spin mb-4 text-blue-900" />
                        <p className="font-bold">Carregando estante...</p>
                    </div>
                ) : books.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                        <BookOpen size={48} className="mb-4 text-slate-300" />
                        <h3 className="font-bold text-slate-600 mb-1">Nenhum livro disponível</h3>
                        <p className="text-sm">Em breve teremos novidades!</p>
                    </div>
                ) : books.map((book) => {
                    const isFree = book.price === 0;
                    const isPurchased = purchasedBookIds.has(book.id);
                    const hasAccess = isFree || isPurchased;
                    const isInCart = cartItems.some(item => item.id === book.id);

                    return (
                        <div key={book.id} className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 group hover:shadow-xl transition-all ${hasAccess ? 'cursor-pointer' : ''} flex flex-col ${isInCart ? 'border-blue-600 ring-4 ring-blue-600/20' : 'border-gray-100'}`} 
                            onClick={() => {
                                if (hasAccess) {
                                    onOpenBook(book.id);
                                }
                            }}
                        >
                            <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden shrink-0">
                                {book.coverUrl ? (
                                    <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        {hasAccess ? <BookOpen size={48} className="text-blue-200" /> : <Lock size={48} className="text-blue-200" />}
                                    </div>
                                )}
                                {isInCart && (
                                    <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center animate-fade-in">
                                        <div className="bg-blue-600 text-white rounded-full p-3 shadow-xl transform scale-110">
                                            <ShoppingCart size={32} />
                                        </div>
                                    </div>
                                )}
                                {progressData[book.id]?.completed && (
                                    <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-lg shadow-lg flex items-center gap-1 animate-in slide-in-from-right duration-500">
                                        <Award size={12} fill="white" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Concluído</span>
                                    </div>
                                )}
                            </div>
                            {progressData[book.id] && !progressData[book.id]?.completed && (
                                <div className="px-4 py-2 bg-blue-50/50 border-y border-blue-100">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
                                            <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse" />
                                            Em Leitura
                                        </span>
                                        <span className="text-[10px] font-black text-blue-900">{progressData[book.id].progressPercent || 0}%</span>
                                    </div>
                                    <div className="h-1.5 bg-blue-100/50 w-full overflow-hidden rounded-full border border-blue-100/30">
                                        <div 
                                            className="h-full bg-blue-600 transition-all duration-1000 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.3)]" 
                                            style={{ width: `${Math.max(progressData[book.id].progressPercent || 0, 5)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="p-4 flex flex-col flex-1">
                                <h4 className="font-bold text-gray-800 mb-1 line-clamp-2 leading-tight" title={book.title}>{book.title}</h4>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2">
                                    {(Array.isArray(book.segment) ? book.segment : (book.segment ? [book.segment] : [])).map((segId: string) => {
                                        const segObj = Object.values(ACADEMIC_SEGMENTS).find(s => s.id === segId);
                                        return segObj?.label || segId;
                                    }).join(' / ')}
                                </p>
                                
                                {isFree ? (
                                    <span className="text-sm font-black text-blue-900 italic mb-4">Grátis</span>
                                ) : isPurchased ? (
                                    <span className="text-xs font-black text-green-600 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200/50 mb-4 self-start">Adquirido</span>
                                ) : (
                                    <span className="text-sm font-black text-orange-500 italic mb-4">R$ {book.price.toFixed(2)}</span>
                                )}
                                
                                <button 
                                    onClick={(e) => {
                                        if (!hasAccess) {
                                            e.stopPropagation();
                                            toggleCartItem(book);
                                        }
                                    }}
                                    className={`mt-auto w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                                    ${hasAccess ? 'bg-blue-900 text-white hover:bg-black shadow-md shadow-blue-900/20' : 
                                      isInCart ? 'bg-white text-blue-900 hover:bg-blue-50 border border-blue-400 shadow-sm' : 
                                      'bg-blue-900 text-white hover:bg-black shadow-md shadow-blue-900/20'}`}
                                >
                                    {hasAccess ? (
                                        progressData[book.id]?.completed ? <><BookOpen size={16} /> Reler</> : <><BookOpen size={16} /> Ler Agora</>
                                    ) : isInCart ? (
                                        <><Trash2 size={16} /> Remover</>
                                    ) : (
                                        <><ShoppingCart size={16} /> Adicionar</>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-12 p-6 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm">
                <p className="text-sm text-blue-900 text-center font-medium italic">
                    Novos livros são adicionados periodicamente pela equipe pedagógica. Fique atento!
                </p>
            </div>

            {/* Cart Floating Bar */}
            {cartItems.length > 0 && (
                <div className="fixed bottom-6 inset-x-0 mx-auto w-full max-w-4xl z-40 pointer-events-none px-4 sm:px-8">
                    <div className="pointer-events-auto bg-white border border-gray-200 rounded-[2rem] shadow-[0_15px_50px_-12px_rgba(0,0,0,0.25)] p-4 sm:px-6 sm:py-4 flex items-center justify-between animate-slide-up-fade">
                        <div className="flex items-center gap-3 sm:gap-5">
                            <div className="bg-blue-50 text-blue-950 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center relative shadow-inner">
                                <ShoppingCart size={24} className="sm:w-7 sm:h-7" />
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs font-black w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
                                    {cartItems.length}
                                </span>
                            </div>
                            <div>
                                <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Total da Compra</p>
                                <p className="text-xl sm:text-2xl font-black text-gray-800 leading-none">R$ {cartTotal.toFixed(2)}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsCheckoutModalOpen(true)}
                            className="bg-gradient-to-r from-blue-900 to-slate-900 hover:from-black hover:to-blue-950 text-white px-5 py-3 sm:px-8 sm:py-4 rounded-xl font-black transition-all flex items-center gap-2 shadow-xl shadow-blue-900/30 active:scale-95 text-sm sm:text-base"
                        >
                            Finalizar Compra
                            <ChevronRight size={20} className="sm:w-6 sm:h-6" />
                        </button>
                    </div>
                </div>
            )}

            {/* Checkout Modal */}
            {isCheckoutModalOpen && (
                <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-zoom-in">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
                            <h2 className="text-xl font-black text-gray-800 flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-900">
                                    <ShoppingCart size={20} />
                                </div>
                                Resumo do Pedido
                            </h2>
                            <button onClick={() => setIsCheckoutModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-red-500">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-widest flex items-center justify-between">
                                Livros Selecionados
                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{cartItems.length} itens</span>
                            </h3>
                            <div className="space-y-3 mb-6">
                                {cartItems.map(item => (
                                    <div key={item.id} className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
                                        <div className="w-12 h-16 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                                            {item.coverUrl ? (
                                                <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><BookOpen size={20} className="text-gray-400 opacity-50" /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-800 text-sm truncate">{item.title}</h4>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{item.segment}</p>
                                        </div>
                                        <div className="text-right shrink-0 flex flex-col items-end">
                                            <span className="font-black text-gray-800 block text-sm">R$ {item.price.toFixed(2)}</span>
                                            <button 
                                                onClick={() => toggleCartItem(item)} 
                                                className="text-[10px] text-red-500 font-bold uppercase hover:bg-red-50 px-2 py-1 rounded-md mt-1 transition-colors flex items-center gap-1"
                                            >
                                                <Trash2 size={10} /> Remover
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 flex items-start gap-4 mt-8">
                                <div className="bg-blue-100 p-3 rounded-full text-blue-600 shrink-0 mt-1">
                                    <QrCode size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-blue-900 mb-1">Pagamento via PIX Único</h4>
                                    <p className="text-xs text-blue-700/80 leading-relaxed">
                                        Ao finalizar, será gerado um único QR Code no valor total. Após o pagamento ser identificado pelo sistema, <strong>todos os livros acima</strong> serão liberados imediatamente para leitura.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-white border-t border-gray-100 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-bold text-gray-400 uppercase tracking-widest text-sm">Total a Pagar</span>
                                <span className="text-3xl font-black text-gray-900">R$ {cartTotal.toFixed(2)}</span>
                            </div>
                            <button 
                                onClick={handleGeneratePixPayment}
                                className="w-full bg-blue-900 hover:bg-blue-950 text-white py-4 rounded-xl font-black transition-colors flex items-center justify-center gap-3 shadow-xl shadow-blue-900/20 active:scale-[0.98] text-lg"
                            >
                                <QrCode size={24} />
                                Gerar PIX e Comprar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PIX Payment Modal */}
            {showPixSimulator && (
                <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-zoom-in border border-slate-100">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <QrCode size={20} className="text-blue-900" />
                                Pagamento via PIX
                            </h2>
                            <button 
                                onClick={() => {
                                    if (!isPaying && !paymentSuccess) {
                                        setShowPixSimulator(false);
                                    }
                                }} 
                                disabled={isPaying || paymentSuccess}
                                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 disabled:opacity-30"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 text-center flex-1 space-y-6">
                            {paymentSuccess ? (
                                <div className="py-8 flex flex-col items-center justify-center space-y-4 animate-in zoom-in-95 duration-500">
                                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-100/50 border-4 border-green-200 animate-bounce">
                                        <Award size={40} className="stroke-[2.5]" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-green-700">Pagamento Aprovado!</h3>
                                        <p className="text-xs text-slate-500 mt-1.5 font-medium max-w-[280px] mx-auto leading-relaxed">
                                            Seu pagamento foi compensado pelo Asaas e seus livros digitais já estão disponíveis para leitura.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Valor do PIX</p>
                                        <p className="text-4xl font-black text-slate-800">R$ {cartTotal.toFixed(2)}</p>
                                    </div>

                                    {isGeneratingPix ? (
                                        <div className="py-12 flex flex-col items-center justify-center space-y-3">
                                            <Loader2 size={40} className="animate-spin text-blue-900" />
                                            <span className="text-xs font-bold text-slate-500">Gerando cobrança PIX no Asaas...</span>
                                        </div>
                                    ) : pixError ? (
                                        <div className="p-5 bg-red-50 border border-red-100 rounded-2xl text-left space-y-2">
                                            <p className="text-xs font-bold text-red-800 flex items-center gap-2">
                                                Ocorreu um erro
                                            </p>
                                            <p className="text-[11px] text-red-600 leading-relaxed">{pixError}</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Real QR Code */}
                                            <div className="relative w-48 h-48 mx-auto bg-slate-50 rounded-3xl p-4 border-2 border-slate-100 shadow-inner flex items-center justify-center overflow-hidden group">
                                                {pixEncodedImage ? (
                                                     <img 
                                                         src={`data:image/png;base64,${pixEncodedImage}`} 
                                                         alt="QR Code PIX Asaas" 
                                                         className="w-full h-full object-contain animate-in zoom-in duration-300"
                                                     />
                                                ) : (
                                                    <QrCode size={140} className="text-slate-300" />
                                                )}
                                                <div className="absolute inset-0 border-2 border-dashed border-blue-600/30 rounded-[1.25rem] animate-spin [animation-duration:15s] pointer-events-none" />
                                            </div>

                                            {/* Copy & Paste Code */}
                                            <div className="space-y-1.5 text-left">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">PIX Copia e Cola</label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        readOnly 
                                                        value={pixPayload || 'Carregando chave PIX...'}
                                                        className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-mono text-[9px] focus:outline-none overflow-x-auto whitespace-nowrap"
                                                    />
                                                    <button 
                                                        disabled={!pixPayload}
                                                        onClick={() => {
                                                            if (pixPayload) {
                                                                navigator.clipboard.writeText(pixPayload);
                                                                setCopiedKey(true);
                                                                setTimeout(() => setCopiedKey(false), 2000);
                                                            }
                                                        }}
                                                        className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${copiedKey ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 disabled:opacity-50'}`}
                                                    >
                                                        {copiedKey ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Real-time sync message */}
                                            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl text-left flex gap-3">
                                                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0 mt-0.5 animate-pulse">
                                                    <Loader2 size={12} className="animate-spin animate-infinite" />
                                                </div>
                                                <p className="text-[10px] text-blue-800 leading-relaxed font-medium">
                                                    <strong>Aguardando Pagamento:</strong> Assim que pagar no seu banco, o sistema identificará a compensação automaticamente e liberará a leitura. Não é necessário enviar comprovante.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                            {!paymentSuccess && (
                                <button 
                                    onClick={() => setShowPixSimulator(false)} 
                                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all text-center"
                                >
                                    Voltar para o Carrinho
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EBooksListView;
