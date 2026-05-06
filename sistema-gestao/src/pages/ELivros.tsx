import { useState, useRef, useEffect } from 'react';
import { BookOpen, Plus, CreditCard, Save, Trash2, Edit3, Image as ImageIcon, CheckCircle2, X, Upload, Loader2, Volume2, Eye, EyeOff } from 'lucide-react';
import { db, storage } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { ACADEMIC_SEGMENTS } from '../utils/academicDefaults';

export function ELivros() {
    const [activeTab, setActiveTab] = useState<'books' | 'config'>('books');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState<any>(null);
    const [modalStep, setModalStep] = useState(1);
    const [pages, setPages] = useState<any[]>([]);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [books, setBooks] = useState<any[]>([]);
    const [isLoadingBooks, setIsLoadingBooks] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'e_books'), (snapshot) => {
            const booksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBooks(booksData);
            setIsLoadingBooks(false);
        });
        return () => unsubscribe();
    }, []);

    // Form States
    const [bookTitle, setBookTitle] = useState('');
    const [bookSegment, setBookSegment] = useState('seg_infantil');
    const [bookPrice, setBookPrice] = useState('0');
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleOpenModal = (book: any = null) => {
        setEditingBook(book);
        setBookTitle(book?.title || '');
        setBookSegment(book?.segment || 'seg_infantil');
        setBookPrice(book?.price?.toString() || '0');
        setCoverPreview(book?.coverUrl || null);
        
        // Garante que cada página carregada tenha a estrutura completa
        const loadedPages = (book?.pages || []).map((p: any) => ({
            ...p,
            audioUrl: p.audioUrl || '',
            question: p.question || { text: '', options: ['', '', ''], correctIndex: 0, position: { x: 50, y: 50 }, style: 'card' }
        }));
        
        setPages(loadedPages);
        setModalStep(1);
        setIsModalOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isCover: boolean, pageId?: number, isAudio?: boolean) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const url = reader.result as string;
            if (isCover) {
                setCoverPreview(url);
            } else if (pageId) {
                if (isAudio) {
                    setPages(pages.map(p => p.id === pageId ? { ...p, audioUrl: url } : p));
                } else {
                    setPages(pages.map(p => p.id === pageId ? { ...p, imageUrl: url } : p));
                }
            }
        };
        reader.readAsDataURL(file);
    };

    const addPage = () => {
        const newPage = {
            id: Date.now(),
            pageNumber: pages.length + 1,
            type: 'story',
            imageUrl: '',
            audioUrl: '',
            question: {
                text: '',
                options: ['', '', ''],
                correctIndex: 0
            }
        };
        setPages([...pages, newPage]);
    };

    const updatePageQuestion = (pageId: number, field: string, value: any) => {
        setPages(pages.map(p => {
            if (p.id !== pageId) return p;
            const q = p.question || { text: '', options: ['', '', ''], correctIndex: 0, position: { x: 50, y: 50 }, style: 'card' };
            if (field === 'text') q.text = value;
            if (field === 'correctIndex') q.correctIndex = value;
            if (field === 'position') q.position = value;
            if (field === 'style') q.style = value;
            if (field.startsWith('option_')) {
                const idx = parseInt(field.split('_')[1]);
                q.options[idx] = value;
            }
            return { ...p, question: q };
        }));
    };

    const handleSave = async () => {
        if (!bookTitle) return alert("O título é obrigatório.");
        setIsSaving(true);
        
        try {
            let finalCoverUrl = coverPreview;
            const bookIdStr = editingBook?.id || Date.now().toString();

            // Upload cover if it's a new local file (data URL)
            if (coverPreview && coverPreview.startsWith('data:image')) {
                const coverRef = ref(storage, `e_books/${bookIdStr}/cover_${Date.now()}`);
                await uploadString(coverRef, coverPreview, 'data_url');
                finalCoverUrl = await getDownloadURL(coverRef);
            }

            // Upload pages if they are new local files
            const finalPages = await Promise.all(pages.map(async (page, index) => {
                let pageImageUrl = page.imageUrl;
                let pageAudioUrl = page.audioUrl;
                
                if (pageImageUrl && pageImageUrl.startsWith('data:image')) {
                    const pageRef = ref(storage, `e_books/${bookIdStr}/page_${index}_${Date.now()}`);
                    await uploadString(pageRef, pageImageUrl, 'data_url');
                    pageImageUrl = await getDownloadURL(pageRef);
                }
                
                if (pageAudioUrl && pageAudioUrl.startsWith('data:audio')) {
                    const audioRef = ref(storage, `e_books/${bookIdStr}/audio_${index}_${Date.now()}`);
                    await uploadString(audioRef, pageAudioUrl, 'data_url');
                    pageAudioUrl = await getDownloadURL(audioRef);
                }
                
                return { ...page, imageUrl: pageImageUrl, audioUrl: pageAudioUrl };
            }));

            const bookData = {
                title: bookTitle,
                segment: bookSegment,
                price: parseFloat(bookPrice) || 0,
                status: editingBook?.status || 'Ativo',
                coverUrl: finalCoverUrl,
                pages: finalPages,
                updatedAt: serverTimestamp()
            };

            if (editingBook) {
                await updateDoc(doc(db, 'e_books', editingBook.id), bookData);
            } else {
                await addDoc(collection(db, 'e_books'), {
                    ...bookData,
                    createdAt: serverTimestamp()
                });
            }

            setIsModalOpen(false);
            setModalStep(1);
            setPages([]);
            setCoverPreview(null);
            setBookTitle('');
            setBookPrice('0');
            setEditingBook(null);
        } catch (error) {
            console.error("Erro ao salvar livro:", error);
            alert("Erro ao salvar o livro. Tente novamente.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (bookId: string) => {
        if (confirm("Tem certeza que deseja excluir este livro?")) {
            try {
                await deleteDoc(doc(db, 'e_books', bookId));
            } catch (error) {
                console.error("Erro ao excluir livro:", error);
                alert("Erro ao excluir o livro.");
            }
        }
    };

    const handleToggleStatus = async (book: any) => {
        const newStatus = book.status === 'Ativo' ? 'Inativo' : 'Ativo';
        try {
            await updateDoc(doc(db, 'e_books', book.id), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Erro ao alterar status:", error);
            alert("Erro ao alterar a visibilidade do livro.");
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <BookOpen className="w-8 h-8 text-orange-500" />
                        e-Livros Digitais
                    </h1>
                    <p className="text-slate-500">Gerencie sua biblioteca digital e configurações de pagamento.</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('books')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'books' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Livros
                    </button>
                    <button 
                        onClick={() => setActiveTab('config')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Configuração PIX
                    </button>
                </div>
            </header>

            {activeTab === 'books' ? (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <button 
                            onClick={() => handleOpenModal()}
                            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm active:scale-95"
                        >
                            <Plus size={20} />
                            Novo Livro
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {isLoadingBooks ? (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                                <Loader2 size={32} className="animate-spin mb-4 text-orange-500" />
                                <p className="text-sm font-bold">Carregando livros da nuvem...</p>
                            </div>
                        ) : books.length === 0 ? (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                                <BookOpen size={48} className="mb-4 text-slate-300" />
                                <h3 className="font-bold text-slate-600 mb-1">Nenhum livro criado</h3>
                                <p className="text-sm">Clique em "Novo Livro" para começar.</p>
                            </div>
                        ) : books.map((book) => (
                            <div key={book.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">
                                {/* Thumbnail (Proporção Real 3:4) */}
                                <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden shrink-0 border-b border-slate-100">
                                    {book.coverUrl ? (
                                        <img src={book.coverUrl} alt={book.title} className={`w-full h-full object-cover transition-all duration-500 ${book.status === 'Inativo' ? 'grayscale opacity-50' : ''}`} />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                                            <ImageIcon size={48} />
                                        </div>
                                    )}
                                    <div className={`absolute top-3 left-3 text-white text-[10px] font-black px-2.5 py-1 rounded uppercase shadow-sm z-10 ${book.status === 'Ativo' ? 'bg-green-500' : 'bg-slate-500'}`}>
                                        {book.status === 'Ativo' ? 'Visível' : 'Oculto'}
                                    </div>
                                    
                                    <button 
                                        onClick={() => handleToggleStatus(book)}
                                        className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all shadow-lg z-20 ${book.status === 'Ativo' ? 'bg-white/90 text-blue-600 hover:bg-white' : 'bg-slate-900/90 text-white hover:bg-slate-900'}`}
                                        title={book.status === 'Ativo' ? 'Tornar Invisível para Alunos' : 'Tornar Visível para Alunos'}
                                    >
                                        {book.status === 'Ativo' ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                </div>
                                
                                {/* Info (Sem cortes) */}
                                <div className="p-5 flex flex-col flex-1 bg-white">
                                    <div className="flex flex-col items-start mb-4 gap-1.5 flex-1">
                                        {/* Título livre para quebrar em quantas linhas precisar */}
                                        <h3 className="font-bold text-slate-900 text-base leading-tight break-words w-full">{book.title}</h3>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {Object.values(ACADEMIC_SEGMENTS).find(s => s.id === book.segment)?.label || book.segment}
                                        </span>
                                        <span className="text-sm font-black text-orange-500 italic mt-1">{book.price === 0 ? 'Grátis' : `R$ ${book.price.toFixed(2)}`}</span>
                                    </div>
                                    
                                    {/* Actions */}
                                    <div className="flex items-center gap-3 mt-auto pt-4 border-t border-slate-100">
                                        <button 
                                            onClick={() => {
                                                setBookTitle(book.title);
                                                setBookSegment(book.segment);
                                                setBookPrice(book.price.toString());
                                                handleOpenModal(book);
                                            }}
                                            className="flex-1 px-4 py-2.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border border-slate-200/60"
                                        >
                                            <Edit3 size={16} />
                                            Editar
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(book.id)}
                                            className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center border border-transparent hover:border-red-100"
                                            title="Excluir"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                                <CreditCard className="text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Configuração Asaas (PIX)</h2>
                                <p className="text-xs text-slate-500">Insira suas credenciais do Asaas para automatizar cobranças.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">API Key (Access Token)</label>
                                <input 
                                    type="password" 
                                    placeholder="$a..." 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                                />
                            </div>

                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
                                <CheckCircle2 className="text-blue-500 shrink-0" size={20} />
                                <div className="text-xs text-blue-700 leading-relaxed">
                                    <strong>Dica:</strong> Você encontra sua chave de API no menu <b>Configurações de Conta &gt; Integrações</b> no painel do Asaas.
                                </div>
                            </div>

                            <button className="w-full mt-6 py-4 bg-blue-950 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg shadow-blue-900/10">
                                <Save size={20} />
                                Salvar Configurações
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Cadastro/Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${modalStep >= 1 ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${modalStep === 1 ? 'text-orange-600' : 'text-slate-400'}`}>Info</span>
                                </div>
                                <div className="w-4 h-px bg-slate-200"></div>
                                <div className="flex items-center gap-1">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${modalStep >= 2 ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${modalStep === 2 ? 'text-orange-600' : 'text-slate-400'}`}>Páginas</span>
                                </div>
                                <div className="w-4 h-px bg-slate-200"></div>
                                <div className="flex items-center gap-1">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${modalStep >= 3 ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>3</div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${modalStep === 3 ? 'text-orange-600' : 'text-slate-400'}`}>Interação</span>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 max-h-[70vh] overflow-y-auto">
                            {modalStep === 1 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Título do Livro</label>
                                            <input 
                                                type="text" 
                                                value={bookTitle}
                                                onChange={(e) => setBookTitle(e.target.value)}
                                                placeholder="Ex: O Pequeno Príncipe" 
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm" 
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Segmento Escolar</label>
                                            <select 
                                                value={bookSegment}
                                                onChange={(e) => setBookSegment(e.target.value)}
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm appearance-none"
                                            >
                                                {Object.values(ACADEMIC_SEGMENTS).map(seg => (
                                                    <option key={seg.id} value={seg.id}>{seg.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Preço (R$)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">R$</span>
                                                <input 
                                                    type="number" 
                                                    value={bookPrice}
                                                    onChange={(e) => setBookPrice(e.target.value)}
                                                    placeholder="0,00" 
                                                    className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-sm" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Capa do Livro</label>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={(e) => handleFileChange(e, true)}
                                        />
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="aspect-[3/4] border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group overflow-hidden relative"
                                        >
                                            {coverPreview ? (
                                                <>
                                                    <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">Trocar Imagem</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-orange-500 transition-colors">
                                                        <Upload size={24} />
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs font-bold text-slate-600">Clique para subir a capa</p>
                                                        <p className="text-[10px] text-slate-400">Dimensão ideal: 900x1200 (3:4)</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {modalStep === 2 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-slate-800">Páginas do Livro ({pages.length})</h3>
                                        <button 
                                            onClick={addPage}
                                            className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition-all"
                                        >
                                            <Plus size={14} />
                                            Adicionar Página
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {pages.map((page, idx) => (
                                            <div key={page.id} className="relative aspect-[3/4] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden group">
                                                {page.imageUrl ? (
                                                    <img src={page.imageUrl} alt={`Pág ${idx+1}`} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                                                        <ImageIcon size={24} />
                                                    </div>
                                                )}
                                                <div className="absolute top-1 left-1 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 shadow-sm flex items-center gap-1">
                                                    Pág {idx + 1}
                                                    {page.audioUrl && <span className="w-2 h-2 rounded-full bg-green-500" title="Áudio incluído"></span>}
                                                </div>
                                                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                                    <label className="p-2 bg-white rounded-full text-slate-600 hover:text-orange-500 shadow-lg cursor-pointer flex items-center gap-2 text-[10px] font-bold uppercase w-24 justify-center">
                                                        <Upload size={14} /> Imagem
                                                        <input 
                                                            type="file" 
                                                            className="hidden" 
                                                            accept="image/*"
                                                            onChange={(e) => handleFileChange(e, false, page.id)}
                                                        />
                                                    </label>
                                                    <label className={`p-2 rounded-full shadow-lg cursor-pointer flex items-center gap-2 text-[10px] font-bold uppercase w-24 justify-center ${page.audioUrl ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white text-slate-600 hover:text-blue-500'}`}>
                                                        <Upload size={14} /> Áudio
                                                        <input 
                                                            type="file" 
                                                            className="hidden" 
                                                            accept="audio/*"
                                                            onChange={(e) => handleFileChange(e, false, page.id, true)}
                                                        />
                                                    </label>
                                                    <button 
                                                        onClick={() => setPages(pages.filter(p => p.id !== page.id))}
                                                        className="p-2 bg-white rounded-full text-slate-600 hover:text-red-500 shadow-lg absolute top-2 right-2"
                                                        title="Excluir Página"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {pages.length === 0 && (
                                            <div className="col-span-full py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 italic text-sm">
                                                Nenhuma página adicionada ainda.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {modalStep === 3 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                                        <p className="text-xs text-orange-800 leading-relaxed">
                                            Selecione as páginas que terão atividades interativas e configure as perguntas abaixo.
                                        </p>
                                    </div>
                                     {pages.length > 0 ? (
                                        <div className="space-y-8">
                                            {pages.map((page, idx) => {
                                                const q = page.question || { text: '', options: ['', '', ''], correctIndex: 0 };
                                                return (
                                                <div key={page.id} className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <span className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-600 text-xs shadow-sm">{idx + 1}</span>
                                                        <h4 className="font-bold text-slate-800 text-sm">Página {idx + 1}</h4>
                                                        {page.audioUrl && (
                                                            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border border-blue-100">
                                                                <Volume2 size={12} />
                                                                Com Áudio
                                                            </div>
                                                        )}
                                                        <div className="ml-auto flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo:</span>
                                                            <select 
                                                                value={page.type}
                                                                onChange={(e) => setPages(pages.map(p => p.id === page.id ? { ...p, type: e.target.value } : p))}
                                                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 outline-none"
                                                            >
                                                                <option value="story">História (Só leitura)</option>
                                                                <option value="activity">Atividade (Quiz)</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {page.type === 'activity' ? (
                                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl mb-4">
                                                                <p className="text-xs text-blue-800 flex items-center gap-2">
                                                                    <ImageIcon size={16} />
                                                                    <strong>Dica:</strong> Clique na miniatura da página ao lado para posicionar onde o botão do Quiz deve aparecer!
                                                                </p>
                                                            </div>
                                                            
                                                            <div className="flex flex-col md:flex-row gap-6">
                                                                <div className="flex-1 space-y-4">
                                                                    <div className="flex gap-4">
                                                                        <div className="flex-1">
                                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Pergunta da Página</label>
                                                                            <input 
                                                                                type="text" 
                                                                                value={q.text}
                                                                                onChange={(e) => updatePageQuestion(page.id, 'text', e.target.value)}
                                                                                placeholder="Ex: Qual era a cor do pássaro?" 
                                                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm shadow-sm" 
                                                                            />
                                                                        </div>
                                                                        <div className="w-32 shrink-0">
                                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Estilo Visual</label>
                                                                            <select
                                                                                value={q.style || 'card'}
                                                                                onChange={(e) => updatePageQuestion(page.id, 'style', e.target.value)}
                                                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm shadow-sm font-bold text-slate-600"
                                                                            >
                                                                                <option value="card">Cartão</option>
                                                                                <option value="glass">Vidro</option>
                                                                                <option value="minimal">Minimalista</option>
                                                                            </select>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {[0, 1, 2].map(optIdx => (
                                                                            <div key={optIdx} className="relative">
                                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Opção {optIdx + 1}</label>
                                                                                <div className="flex items-center gap-2">
                                                                                    <input 
                                                                                        type="text" 
                                                                                        value={q.options[optIdx] || ''}
                                                                                        onChange={(e) => updatePageQuestion(page.id, `option_${optIdx}`, e.target.value)}
                                                                                        placeholder={`Alternativa ${optIdx + 1}`} 
                                                                                        className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-xs" 
                                                                                    />
                                                                                    <input 
                                                                                        type="radio" 
                                                                                        name={`correct_${page.id}`} 
                                                                                        checked={q.correctIndex === optIdx}
                                                                                        onChange={() => updatePageQuestion(page.id, 'correctIndex', optIdx)}
                                                                                        className="w-4 h-4 accent-orange-500 cursor-pointer" 
                                                                                        title="Marcar como correta" 
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {page.imageUrl ? (
                                                                    <div className="w-full md:w-48 shrink-0 flex flex-col gap-2 items-center">
                                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Posição do Quiz</label>
                                                                        <div 
                                                                            className="relative aspect-[3/4] w-full bg-slate-200 rounded-xl overflow-hidden cursor-crosshair border-2 border-transparent hover:border-orange-500 transition-colors group"
                                                                            onClick={(e) => {
                                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                                const x = ((e.clientX - rect.left) / rect.width) * 100;
                                                                                const y = ((e.clientY - rect.top) / rect.height) * 100;
                                                                                updatePageQuestion(page.id, 'position', {x, y});
                                                                            }}
                                                                        >
                                                                            <img src={page.imageUrl} alt="Página" className="w-full h-full object-cover" />
                                                                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors pointer-events-none" />
                                                                            
                                                                            {/* Position Marker */}
                                                                            <div 
                                                                                className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-300"
                                                                                style={{ 
                                                                                    left: `${q.position?.x ?? 50}%`, 
                                                                                    top: `${q.position?.y ?? 50}%` 
                                                                                }}
                                                                            >
                                                                                <div className="w-3 h-3 bg-orange-500 rounded-full shadow-[0_0_0_2px_white,0_4px_8px_rgba(0,0,0,0.5)] animate-pulse" />
                                                                                <div className="absolute w-12 h-12 border border-orange-500/50 rounded-full animate-ping" />
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-[9px] text-slate-400 text-center px-4">Clique na imagem para mover o ponto laranja.</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-full md:w-48 shrink-0 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 text-center aspect-[3/4]">
                                                                        <ImageIcon size={24} className="text-slate-300 mb-2" />
                                                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Sem Imagem</span>
                                                                        <span className="text-xs text-slate-400 mt-1">Faça o upload no Passo 2.</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-4 text-xs text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl">
                                                            Esta página é apenas para leitura. Mude o tipo para "Atividade" para adicionar perguntas.
                                                        </div>
                                                    )}
                                                </div>
                                            )})}
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center text-slate-400 italic text-sm">
                                            Adicione páginas no Passo 2 antes de configurar a interatividade.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                            <div className="flex gap-2">
                                {modalStep > 1 && (
                                    <button 
                                        onClick={() => setModalStep(modalStep - 1)}
                                        className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
                                    >
                                        Voltar
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">Cancelar</button>
                                {modalStep < 3 ? (
                                    <button 
                                        onClick={() => setModalStep(modalStep + 1)}
                                        className="bg-slate-900 hover:bg-black text-white px-8 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95"
                                    >
                                        Próximo Passo
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white px-8 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center gap-2"
                                    >
                                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        {isSaving ? 'Salvando...' : (editingBook ? 'Salvar Alterações' : 'Finalizar e Criar')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
