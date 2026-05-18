import { useState, useRef, useEffect } from 'react';
import { BookOpen, Plus, CreditCard, Save, Trash2, Edit3, Image as ImageIcon, CheckCircle2, X, Upload, Loader2, Volume2, Eye, EyeOff, Award, ShoppingCart, Search, Filter } from 'lucide-react';
import { db, storage } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { ACADEMIC_SEGMENTS } from '../utils/academicDefaults';
import { UNIT_LABELS, SchoolUnit } from '../types';

export function ELivros() {
    const [activeTab, setActiveTab] = useState<'books' | 'config' | 'dashboard'>('books');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState<any>(null);
    const [modalStep, setModalStep] = useState(1);
    const [pages, setPages] = useState<any[]>([]);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [coverAudioPreview, setCoverAudioPreview] = useState<string | null>(null);
    const [books, setBooks] = useState<any[]>([]);
    const [isLoadingBooks, setIsLoadingBooks] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activePositionElement, setActivePositionElement] = useState<string>('question');

    // Dashboard States
    const [progressList, setProgressList] = useState<any[]>([]);
    const [purchasesList, setPurchasesList] = useState<any[]>([]);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [segmentFilter, setSegmentFilter] = useState('all');
    const [unitFilter, setUnitFilter] = useState('all');
    const [bookFilter, setBookFilter] = useState('all');
    const [studentsMap, setStudentsMap] = useState<Record<string, any>>({});
    const [dashboardSubTab, setDashboardSubTab] = useState<'accesses' | 'purchases'>('accesses');

    // Asaas Config States
    const [asaasApiKey, setAsaasApiKey] = useState('');
    const [asaasEnv, setAsaasEnv] = useState<'sandbox' | 'production'>('sandbox');
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'e_books'), (snapshot) => {
            const booksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBooks(booksData);
            setIsLoadingBooks(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Carrega configurações do Asaas do Firestore
        const configDocRef = doc(db, 'config', 'asaas_config');
        const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setAsaasApiKey(data.apiKey || '');
                setAsaasEnv(data.environment || 'sandbox');
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (activeTab !== 'dashboard') return;

        setIsLoadingDashboard(true);

        // Fetch progress data from Firestore
        const unsubscribeProgress = onSnapshot(collection(db, 'ebook_progress'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProgressList(data);
        }, (error) => {
            console.error("Erro ao carregar progresso:", error);
        });

        // Fetch purchases data from Firestore
        const unsubscribePurchases = onSnapshot(collection(db, 'ebook_purchases'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPurchasesList(data);
            setIsLoadingDashboard(false);
        }, (error) => {
            console.error("Erro ao carregar compras:", error);
            setIsLoadingDashboard(false);
        });

        // Fetch students data from Firestore to match units
        const unsubscribeStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
            const map: Record<string, any> = {};
            snapshot.docs.forEach(doc => {
                map[doc.id] = doc.data();
            });
            setStudentsMap(map);
        }, (error) => {
            console.error("Erro ao carregar alunos:", error);
        });

        return () => {
            unsubscribeProgress();
            unsubscribePurchases();
            unsubscribeStudents();
        };
    }, [activeTab]);

    const [bookTitle, setBookTitle] = useState('');
    const [bookSegments, setBookSegments] = useState<string[]>(['seg_infantil']);
    const [bookPrice, setBookPrice] = useState('0');
    const [hidePageNumbers, setHidePageNumbers] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleOpenModal = (book: any = null) => {
        setEditingBook(book);
        setBookTitle(book?.title || '');
        setBookSegments(Array.isArray(book?.segment) ? book.segment : (book?.segment ? [book.segment] : ['seg_infantil']));
        setBookPrice(book?.price?.toString() || '0');
        setHidePageNumbers(book?.hidePageNumbers || false);
        setCoverPreview(book?.coverUrl || null);
        setCoverAudioPreview(book?.coverAudioUrl || null);
        
        // Garante que cada página carregada tenha a estrutura completa
        const loadedPages = (book?.pages || []).map((p: any) => ({
            ...p,
            audioUrl: p.audioUrl || '',
            question: p.question || { text: '', options: ['', '', '', ''], correctIndex: 0, position: { x: 50, y: 50 }, style: 'card', textColor: 'dark' }
        }));
        
        setPages(loadedPages);
        setModalStep(1);
        setIsModalOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isCover: boolean, pageId?: number, isAudio?: boolean, isPdf?: boolean) => {
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
                } else if (isPdf) {
                    setPages(pages.map(p => p.id === pageId ? { ...p, pdfUrl: url } : p));
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
            pdfUrl: '',
            pdfDescription: '',
            question: {
                text: '',
                options: ['', '', '', ''],
                correctIndex: 0
            }
        };
        setPages([...pages, newPage]);
    };

    const updatePageQuestion = (pageId: number, field: string, value: any) => {
        setPages(pages.map(p => {
            if (p.id !== pageId) return p;
            const q = p.question || { text: '', options: ['', '', '', ''], correctIndex: 0, position: { x: 50, y: 50 }, style: 'card' };
            if (field === 'text') q.text = value;
            if (field === 'correctIndex') q.correctIndex = value;
            if (field === 'position') q.position = value;
            if (field === 'style') q.style = value;
            if (field === 'textColor') q.textColor = value;
            if (field === 'optionsConfig') q.optionsConfig = value;
            if (field.startsWith('option_')) {
                const idx = parseInt(field.split('_')[1]);
                q.options[idx] = value;
            }
            if (field.startsWith('optPos_') || field.startsWith('optWidth_')) {
                const idx = parseInt(field.split('_')[1]);
                if (!q.optionsConfig) q.optionsConfig = [
                    { position: { x: 50, y: 60 }, width: 80 },
                    { position: { x: 50, y: 70 }, width: 80 },
                    { position: { x: 50, y: 80 }, width: 80 },
                    { position: { x: 50, y: 90 }, width: 80 }
                ];
                if (field.startsWith('optPos_')) q.optionsConfig[idx].position = value;
                if (field.startsWith('optWidth_')) q.optionsConfig[idx].width = value;
            }
            return { ...p, question: q };
        }));
    };

    const handleSave = async () => {
        if (!bookTitle) return alert("O título é obrigatório.");
        setIsSaving(true);
        
        try {
            let finalCoverUrl = coverPreview;
            let finalCoverAudioUrl = coverAudioPreview;
            const bookIdStr = editingBook?.id || Date.now().toString();

            // Upload cover if it's a new local file (data URL)
            if (coverPreview && coverPreview.startsWith('data:image')) {
                const coverRef = ref(storage, `e_books/${bookIdStr}/cover_${Date.now()}`);
                await uploadString(coverRef, coverPreview, 'data_url');
                finalCoverUrl = await getDownloadURL(coverRef);
            }

            // Upload cover audio if it's a new local file (data URL)
            if (coverAudioPreview && coverAudioPreview.startsWith('data:audio')) {
                const coverAudioRef = ref(storage, `e_books/${bookIdStr}/cover_audio_${Date.now()}`);
                await uploadString(coverAudioRef, coverAudioPreview, 'data_url');
                finalCoverAudioUrl = await getDownloadURL(coverAudioRef);
            }

            // Upload pages if they are new local files
            const finalPages = await Promise.all(pages.map(async (page, index) => {
                let pageImageUrl = page.imageUrl;
                let pageAudioUrl = page.audioUrl;
                let pagePdfUrl = page.pdfUrl;
                
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

                if (pagePdfUrl && pagePdfUrl.startsWith('data:application/pdf')) {
                    const pdfRef = ref(storage, `e_books/${bookIdStr}/pdf_${index}_${Date.now()}.pdf`);
                    await uploadString(pdfRef, pagePdfUrl, 'data_url');
                    pagePdfUrl = await getDownloadURL(pdfRef);
                }
                
                return { ...page, imageUrl: pageImageUrl, audioUrl: pageAudioUrl, pdfUrl: pagePdfUrl, pdfDescription: page.pdfDescription || '' };
            }));

            const bookData = {
                title: bookTitle,
                segment: bookSegments,
                price: parseFloat(bookPrice) || 0,
                status: editingBook?.status || 'Ativo',
                coverUrl: finalCoverUrl,
                coverAudioUrl: finalCoverAudioUrl || '',
                pages: finalPages,
                hidePageNumbers: hidePageNumbers,
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
            setCoverAudioPreview(null);
            setBookTitle('');
            setBookSegments(['seg_infantil']);
            setBookPrice('0');
            setHidePageNumbers(false);
            setEditingBook(null);
        } catch (error) {
            console.error("Erro ao salvar livro:", error);
            alert("Erro ao salvar o livro. Tente novamente.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (bookId: string) => {
        if (confirm("Tem certeza que deseja excluir este livro? Todos os arquivos (PDFs, imagens e áudios) anexados a ele também serão excluídos permanentemente do servidor.")) {
            try {
                // Encontra o livro na lista atual para resgatar as URLs de arquivos
                const bookToDelete = books.find(b => b.id === bookId);
                if (bookToDelete) {
                    const filesToDelete: string[] = [];
                    if (bookToDelete.coverUrl && !bookToDelete.coverUrl.startsWith('data:')) filesToDelete.push(bookToDelete.coverUrl);
                    if (bookToDelete.coverAudioUrl && !bookToDelete.coverAudioUrl.startsWith('data:')) filesToDelete.push(bookToDelete.coverAudioUrl);
                    
                    (bookToDelete.pages || []).forEach((page: any) => {
                        if (page.imageUrl && !page.imageUrl.startsWith('data:')) filesToDelete.push(page.imageUrl);
                        if (page.audioUrl && !page.audioUrl.startsWith('data:')) filesToDelete.push(page.audioUrl);
                        if (page.pdfUrl && !page.pdfUrl.startsWith('data:')) filesToDelete.push(page.pdfUrl);
                    });

                    // Exclui fisicamente todos os arquivos anexados no Firebase Storage
                    await Promise.all(filesToDelete.map(async (url) => {
                        try {
                            const fileRef = ref(storage, url);
                            await deleteObject(fileRef);
                        } catch (err) {
                            console.error("Aviso: Falha ao deletar arquivo (talvez já tenha sido removido):", url, err);
                        }
                    }));
                }

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

    const handleSaveAsaasConfig = async () => {
        setIsSavingConfig(true);
        try {
            await setDoc(doc(db, 'config', 'asaas_config'), {
                apiKey: asaasApiKey,
                environment: asaasEnv,
                updatedAt: serverTimestamp()
            });
            alert("Configurações do Asaas salvas com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar configuração do Asaas:", error);
            alert("Erro ao salvar as configurações.");
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleDeletePurchase = async (purchaseId: string) => {
        if (!window.confirm("Deseja realmente apagar o registro desta venda? Esta ação é irreversível e atualizará imediatamente todas as métricas do painel.")) return;
        
        try {
            await deleteDoc(doc(db, 'ebook_purchases', purchaseId));
        } catch (error) {
            console.error("Erro ao apagar venda:", error);
            alert("Erro ao excluir o registro de venda.");
        }
    };

    // Dashboard KPI Calculations
    const uniqueReaders = new Set(progressList.map(p => p.studentId)).size;
    const totalSales = purchasesList.length;
    const totalRevenue = purchasesList.reduce((acc, p) => acc + (p.price || 0), 0);
    const completionRate = progressList.length > 0 
        ? Math.round((progressList.filter(p => p.completed).length / progressList.length) * 100) 
        : 0;

    const bookPerformance = books.map(book => {
        const bookProgress = progressList.filter(p => p.bookId === book.id);
        const bookPurchases = purchasesList.filter(p => p.bookId === book.id);
        
        const accesses = bookProgress.length;
        const sales = bookPurchases.length;
        const revenue = bookPurchases.reduce((acc, p) => acc + (p.price || 0), 0);
        const completions = bookProgress.filter(p => p.completed).length;
        const rate = accesses > 0 ? Math.round((completions / accesses) * 100) : 0;
        
        return {
            ...book,
            accesses,
            sales,
            revenue,
            rate
        };
    });

    const matchesSegmentFilter = (gradeLevel: string) => {
        if (segmentFilter === 'all') return true;
        if (!gradeLevel) return false;
        const level = gradeLevel.toLowerCase();
        
        if (segmentFilter === 'seg_infantil') return level.includes('infantil') || level.includes('nível') || level.includes('maternal') || level.includes('jardim');
        if (segmentFilter === 'seg_fund_1') return level.includes('fundamental i') || level.includes('f.1') || level.includes('1º') || level.includes('2º') || level.includes('3º') || level.includes('4º') || level.includes('5º');
        if (segmentFilter === 'seg_fund_2') return level.includes('fundamental ii') || level.includes('f.2') || level.includes('6º') || level.includes('7º') || level.includes('8º') || level.includes('9º');
        if (segmentFilter === 'seg_medio') return level.includes('médio') || level.includes('e.m') || level.includes('série');
        
        return true;
    };

    const filteredProgress = progressList.filter(p => {
        const studentName = p.studentName || 'Estudante';
        const bookTitle = p.bookTitle || '';
        const matchesSearch = studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              bookTitle.toLowerCase().includes(searchQuery.toLowerCase());
                              
        const matchesSegment = matchesSegmentFilter(p.studentGrade || '');
        
        const studentUnit = p.studentUnit || studentsMap[p.studentId]?.unit || '';
        const matchesUnit = unitFilter === 'all' || studentUnit === unitFilter;
        
        const matchesBook = bookFilter === 'all' || p.bookId === bookFilter;
            
        return matchesSearch && matchesSegment && matchesUnit && matchesBook;
    });

    const filteredPurchases = purchasesList.filter(p => {
        const studentName = p.studentName || 'Estudante';
        const bookTitle = p.bookTitle || '';
        const matchesSearch = studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              bookTitle.toLowerCase().includes(searchQuery.toLowerCase());
                              
        const matchesSegment = matchesSegmentFilter(p.studentGrade || '');
        
        const studentUnit = p.studentUnit || studentsMap[p.studentId]?.unit || '';
        const matchesUnit = unitFilter === 'all' || studentUnit === unitFilter;
        
        const matchesBook = bookFilter === 'all' || p.bookId === bookFilter;
            
        return matchesSearch && matchesSegment && matchesUnit && matchesBook;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <BookOpen className="w-8 h-8 text-orange-500" />
                        e-Livros Digitais
                    </h1>
                    <p className="text-slate-500">Gerencie sua biblioteca digital, veja indicadores de acessos e configure pagamentos.</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('books')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'books' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Livros
                    </button>
                    <button 
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Vendas e Acessos
                    </button>
                    <button 
                        onClick={() => setActiveTab('config')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Configuração PIX
                    </button>
                </div>
            </header>

            {activeTab === 'books' && (
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
                                            {(Array.isArray(book.segment) ? book.segment : (book.segment ? [book.segment] : [])).map((segId: string) => {
                                                const segObj = Object.values(ACADEMIC_SEGMENTS).find(s => s.id === segId);
                                                return segObj?.label || segId;
                                            }).join(' / ')}
                                        </span>
                                        <span className="text-sm font-black text-orange-500 italic mt-1">{book.price === 0 ? 'Grátis' : `R$ ${book.price.toFixed(2)}`}</span>
                                    </div>
                                    
                                    {/* Actions */}
                                    <div className="flex items-center gap-3 mt-auto pt-4 border-t border-slate-100">
                                        <button 
                                            onClick={() => {
                                                setBookTitle(book.title);
                                                setBookSegments(Array.isArray(book.segment) ? book.segment : (book.segment ? [book.segment] : ['seg_infantil']));
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
            )}

            {activeTab === 'dashboard' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {isLoadingDashboard ? (
                        <div className="py-32 flex flex-col items-center justify-center text-slate-400">
                            <Loader2 size={40} className="animate-spin mb-4 text-orange-500" />
                            <p className="text-sm font-bold uppercase tracking-widest">Carregando painel de estatísticas...</p>
                        </div>
                    ) : (
                        <>
                            {/* KPI Metrics Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {/* Leitores Únicos */}
                                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all">
                                    <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 shadow-inner">
                                        <Eye size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xl font-black text-slate-800 whitespace-nowrap">{uniqueReaders}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate mt-0.5">Leitores Únicos</p>
                                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">Alunos ativos na leitura</p>
                                    </div>
                                </div>

                                {/* Livros Comprados */}
                                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all">
                                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-inner">
                                        <ShoppingCart size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xl font-black text-slate-800 whitespace-nowrap">{totalSales}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate mt-0.5">Livros Comprados</p>
                                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">Unidades adquiridas</p>
                                    </div>
                                </div>

                                {/* Faturamento Total */}
                                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all">
                                    <div className="w-11 h-11 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0 shadow-inner">
                                        <CreditCard size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xl font-black text-slate-800 whitespace-nowrap">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate mt-0.5">Receita Acumulada</p>
                                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate font-semibold">Vendas via PIX aprovadas</p>
                                    </div>
                                </div>

                                {/* Média de Conclusão */}
                                <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all">
                                    <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 shadow-inner">
                                        <Award size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xl font-black text-slate-800 whitespace-nowrap">{completionRate}%</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate mt-0.5">Taxa de Conclusão</p>
                                        <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">Média de livros terminados</p>
                                    </div>
                                </div>
                            </div>

                            {/* Desempenho por Livro Table */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Desempenho por Livro</h2>
                                    <p className="text-xs text-slate-500">Métricas consolidadas de leitura e compras para cada obra da biblioteca.</p>
                                </div>

                                <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-inner bg-slate-50/20">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">Livro</th>
                                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">Segmento</th>
                                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-center">Preço</th>
                                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-center">Acessos</th>
                                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-center">Vendas</th>
                                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-right">Faturamento</th>
                                                <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-right">Conclusão</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {bookPerformance.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                                        Nenhum livro cadastrado para exibir estatísticas.
                                                    </td>
                                                </tr>
                                            ) : bookPerformance.map((bp) => (
                                                <tr key={bp.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-4 flex items-center gap-3">
                                                        <div className="w-9 h-12 bg-slate-100 border border-slate-100 rounded overflow-hidden shrink-0">
                                                            {bp.coverUrl ? (
                                                                <img src={bp.coverUrl} alt={bp.title} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center"><BookOpen size={16} className="text-slate-300" /></div>
                                                            )}
                                                        </div>
                                                        <span className="font-bold text-slate-800 leading-tight block max-w-xs truncate" title={bp.title}>{bp.title}</span>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                                                            {(Array.isArray(bp.segment) ? bp.segment : (bp.segment ? [bp.segment] : [])).map((segId: string) => {
                                                                const segObj = Object.values(ACADEMIC_SEGMENTS).find(s => s.id === segId);
                                                                return segObj?.label || segId;
                                                            }).join(' / ')}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center font-bold text-slate-600">
                                                        {bp.price === 0 ? 'Grátis' : `R$ ${bp.price.toFixed(2)}`}
                                                    </td>
                                                    <td className="p-4 text-center font-extrabold text-slate-800">
                                                        {bp.accesses}
                                                    </td>
                                                    <td className="p-4 text-center font-extrabold text-slate-800">
                                                        {bp.price === 0 ? '-' : bp.sales}
                                                    </td>
                                                    <td className="p-4 text-right font-black text-green-600">
                                                        {bp.price === 0 ? '-' : `R$ ${bp.revenue.toFixed(2)}`}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-black text-slate-800 text-xs">{bp.rate}%</span>
                                                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden mt-1 border border-slate-200/50">
                                                                <div 
                                                                    className="h-full bg-purple-600 rounded-full" 
                                                                    style={{ width: `${bp.rate}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Detailed Logs Panel */}
                            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                                <div className="space-y-4 pb-4 border-b border-slate-100">
                                    {/* Row 1: Sub-Tabs & Counter */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex bg-slate-100 p-1 rounded-xl self-start">
                                            <button 
                                                onClick={() => setDashboardSubTab('accesses')}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${dashboardSubTab === 'accesses' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Histórico de Leitura ({filteredProgress.length})
                                            </button>
                                            <button 
                                                onClick={() => setDashboardSubTab('purchases')}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${dashboardSubTab === 'purchases' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Vendas Realizadas ({filteredPurchases.length})
                                            </button>
                                        </div>
                                        
                                        {/* Dynamic badge indicator */}
                                        <span className="text-[10px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl uppercase tracking-wider self-start sm:self-center">
                                            {dashboardSubTab === 'accesses' ? `${filteredProgress.length} acessos encontrados` : `${filteredPurchases.length} vendas encontradas`}
                                        </span>
                                    </div>

                                    {/* Row 2: Search & Filters (Premium CSS Grid Layout) */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                                        {/* Search Input */}
                                        <div className="relative w-full">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Search size={16} /></span>
                                            <input 
                                                type="text" 
                                                placeholder="Buscar aluno ou livro..." 
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 w-full transition-all font-semibold"
                                            />
                                        </div>

                                        {/* Unit Filter */}
                                        <div className="relative w-full">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Filter size={14} /></span>
                                            <select 
                                                value={unitFilter}
                                                onChange={(e) => setUnitFilter(e.target.value)}
                                                className="pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 w-full"
                                            >
                                                <option value="all">Todas as Unidades</option>
                                                {Object.entries(UNIT_LABELS).map(([code, label]) => (
                                                    <option key={code} value={code}>Unidade {label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Segment Filter */}
                                        <div className="relative w-full">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Filter size={14} /></span>
                                            <select 
                                                value={segmentFilter}
                                                onChange={(e) => setSegmentFilter(e.target.value)}
                                                className="pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 w-full"
                                            >
                                                <option value="all">Todos os Segmentos</option>
                                                <option value="seg_infantil">Infantil</option>
                                                <option value="seg_fund_1">Fundamental I</option>
                                                <option value="seg_fund_2">Fundamental II</option>
                                                <option value="seg_medio">Ensino Médio</option>
                                            </select>
                                        </div>

                                        {/* Book Filter */}
                                        <div className="relative w-full">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Filter size={14} /></span>
                                            <select 
                                                value={bookFilter}
                                                onChange={(e) => setBookFilter(e.target.value)}
                                                className="pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-blue-500 w-full truncate"
                                            >
                                                <option value="all">Todos os Livros</option>
                                                {books.map((book) => (
                                                    <option key={book.id} value={book.id}>{book.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Table contents depending on dashboardSubTab */}
                                {dashboardSubTab === 'accesses' ? (
                                    <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-inner bg-slate-50/20">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">Aluno</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">Série / Segmento</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">Unidade</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">e-Livro Lido</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-center">Progresso</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-center">Status</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-right">Última Atividade</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {filteredProgress.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                                            Nenhum registro de leitura encontrado com os filtros selecionados.
                                                        </td>
                                                    </tr>
                                                ) : filteredProgress.map((p) => {
                                                    const formattedDate = p.updatedAt?.seconds 
                                                        ? new Date(p.updatedAt.seconds * 1000).toLocaleString('pt-BR') 
                                                        : p.updatedAt instanceof Date 
                                                            ? p.updatedAt.toLocaleString('pt-BR') 
                                                            : 'Data indisponível';
                                                            
                                                    return (
                                                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-4 font-bold text-slate-800">{p.studentName || 'Estudante'}</td>
                                                            <td className="p-4 font-medium text-slate-500">{p.studentGrade || 'Série Não Informada'}</td>
                                                            <td className="p-4">
                                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                                                    {(() => {
                                                                        const studentUnit = p.studentUnit || studentsMap[p.studentId]?.unit;
                                                                        return studentUnit ? (UNIT_LABELS[studentUnit as SchoolUnit] || studentUnit) : 'Zona Norte';
                                                                    })()}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 font-bold text-slate-900">{p.bookTitle}</td>
                                                            <td className="p-4">
                                                                <div className="flex items-center justify-center gap-3">
                                                                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shrink-0">
                                                                        <div 
                                                                            className="h-full bg-blue-600 rounded-full" 
                                                                            style={{ width: `${p.progressPercent || 0}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="font-extrabold text-slate-700 text-xs w-8 text-right">{p.progressPercent || 0}%</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                {p.completed ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200/50 uppercase tracking-wide">
                                                                        <CheckCircle2 size={12} className="stroke-[2.5]" />
                                                                        Concluído
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 uppercase tracking-wide">
                                                                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                                                                        Lendo
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-4 text-right font-medium text-slate-500">{formattedDate}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-inner bg-slate-50/20">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">Aluno</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">Série / Segmento</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">Unidade</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px]">e-Livro Adquirido</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-center">Valor Pago</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-center">Método</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-center">Status</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-right">Data da Compra</th>
                                                    <th className="p-4 font-black text-slate-500 uppercase tracking-widest text-[9px] text-right">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {filteredPurchases.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                                                            Nenhum registro de venda encontrado com os filtros selecionados.
                                                        </td>
                                                    </tr>
                                                ) : filteredPurchases.map((p) => {
                                                    const formattedDate = p.purchasedAt?.seconds 
                                                        ? new Date(p.purchasedAt.seconds * 1000).toLocaleString('pt-BR') 
                                                        : p.purchasedAt instanceof Date 
                                                            ? p.purchasedAt.toLocaleString('pt-BR') 
                                                            : 'Data indisponível';
                                                            
                                                    return (
                                                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="p-4 font-bold text-slate-800">{p.studentName || 'Estudante'}</td>
                                                            <td className="p-4 font-medium text-slate-500">{p.studentGrade || 'Série Não Informada'}</td>
                                                            <td className="p-4">
                                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                                                    {(() => {
                                                                        const studentUnit = p.studentUnit || studentsMap[p.studentId]?.unit;
                                                                        return studentUnit ? (UNIT_LABELS[studentUnit as SchoolUnit] || studentUnit) : 'Zona Norte';
                                                                    })()}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 font-bold text-slate-900">{p.bookTitle}</td>
                                                            <td className="p-4 text-center font-extrabold text-orange-500">
                                                                R$ {(p.price || 0).toFixed(2)}
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <span className="inline-flex items-center text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest">
                                                                    {p.paymentMethod || 'PIX'}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200/50 uppercase tracking-wide">
                                                                    <CheckCircle2 size={12} className="stroke-[2.5]" />
                                                                    Aprovado
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-right font-medium text-slate-500">{formattedDate}</td>
                                                            <td className="p-4 text-right">
                                                                <button
                                                                    onClick={() => handleDeletePurchase(p.id)}
                                                                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                                                    title="Apagar venda"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'config' && (
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
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Ambiente de Transação</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setAsaasEnv('sandbox')}
                                        type="button"
                                        className={`py-3 rounded-xl font-bold border transition-all text-xs ${asaasEnv === 'sandbox' ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                    >
                                        Homologação / Sandbox
                                    </button>
                                    <button 
                                        onClick={() => setAsaasEnv('production')}
                                        type="button"
                                        className={`py-3 rounded-xl font-bold border transition-all text-xs ${asaasEnv === 'production' ? 'bg-green-50 border-green-200 text-green-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                                    >
                                        Produção / Real
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">API Key (Access Token)</label>
                                <input 
                                    type="password" 
                                    value={asaasApiKey}
                                    onChange={(e) => setAsaasApiKey(e.target.value)}
                                    placeholder="$a..." 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                                />
                            </div>

                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
                                <CheckCircle2 className="text-blue-500 shrink-0" size={20} />
                                <div className="text-xs text-blue-700 leading-relaxed">
                                    <strong>Dica:</strong> Você encontra sua chave de API no menu <b>Configurações de Conta &gt; Integrações</b> no painel do Asaas. {asaasEnv === 'sandbox' ? 'Use a chave obtida no painel de Sandbox (sandbox.asaas.com).' : 'Use a chave obtida no painel de Produção.'}
                                </div>
                            </div>

                            <button 
                                onClick={handleSaveAsaasConfig}
                                disabled={isSavingConfig}
                                className="w-full mt-6 py-4 bg-blue-950 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg shadow-blue-900/10 disabled:opacity-50"
                            >
                                {isSavingConfig ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                {isSavingConfig ? 'Salvando...' : 'Salvar Configurações'}
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
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Segmento Escolar (Selecione um ou mais)</label>
                                            <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2">
                                                {Object.values(ACADEMIC_SEGMENTS).map(seg => (
                                                    <label key={seg.id} className="flex items-center gap-2 cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={bookSegments.includes(seg.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setBookSegments([...bookSegments, seg.id]);
                                                                } else {
                                                                    if (bookSegments.length > 1) {
                                                                        setBookSegments(bookSegments.filter(id => id !== seg.id));
                                                                    }
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-orange-500 rounded border-slate-300 focus:ring-orange-500"
                                                        />
                                                        <span className="text-sm text-slate-700">{seg.label}</span>
                                                    </label>
                                                ))}
                                            </div>
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
                                        <div className="pt-2">
                                            <label className="flex items-center gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/50 transition-colors">
                                                <input 
                                                    type="checkbox" 
                                                    checked={hidePageNumbers}
                                                    onChange={(e) => setHidePageNumbers(e.target.checked)}
                                                    className="w-4.5 h-4.5 text-orange-500 rounded border-slate-300 focus:ring-orange-500"
                                                />
                                                <div>
                                                    <span className="text-xs font-black text-slate-700 block uppercase tracking-wider">Ocultar Paginação</span>
                                                    <span className="text-[10px] text-slate-400 font-medium">Remove os balões com número de página no app do aluno</span>
                                                </div>
                                            </label>
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

                                        {/* Cover Audio Upload Component */}
                                        <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Áudio da Capa (Opcional)</span>
                                                {coverAudioPreview && (
                                                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" title="Áudio incluído"></span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className={`flex-1 p-2.5 rounded-xl shadow-sm cursor-pointer flex items-center gap-2 text-[10px] font-bold uppercase justify-center transition-all ${coverAudioPreview ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200/80' : 'bg-white border border-slate-200 text-slate-600 hover:text-blue-500 hover:border-blue-200'}`}>
                                                    <Volume2 size={14} className={coverAudioPreview ? 'animate-bounce' : ''} />
                                                    {coverAudioPreview ? 'Alterar Áudio' : 'Inserir Áudio'}
                                                    <input 
                                                        type="file"
                                                        className="hidden"
                                                        accept="audio/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                setCoverAudioPreview(reader.result as string);
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }}
                                                    />
                                                </label>
                                                {coverAudioPreview && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => setCoverAudioPreview(null)}
                                                        className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 hover:text-red-700 transition-colors"
                                                        title="Remover áudio"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-slate-400 font-medium leading-normal">
                                                Suba um arquivo de áudio para ser tocado na visualização da capa do e-livro.
                                            </p>
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
                                            <div key={page.id} className="relative bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                                                <div className="relative aspect-[3/4] w-full group">
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
                                                <div className="p-2.5 bg-white border-t border-slate-200 flex flex-col gap-2 flex-1">
                                                    <label className={`p-1.5 rounded-lg border border-dashed flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold uppercase transition-all cursor-pointer ${page.pdfUrl ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-slate-50 border-slate-300 text-slate-500 hover:border-orange-400 hover:text-orange-600'}`}>
                                                        <div className="flex items-center gap-1"><Upload size={10} /> {page.pdfUrl ? 'PDF Anexado' : 'Anexar PDF (Colorir)'}</div>
                                                        <input 
                                                            type="file" 
                                                            className="hidden" 
                                                            accept="application/pdf"
                                                            onChange={(e) => handleFileChange(e, false, page.id, false, true)}
                                                        />
                                                    </label>
                                                    {page.pdfUrl && (
                                                        <input 
                                                            type="text"
                                                            placeholder="Descrição (ex: Baixar Desenho)"
                                                            value={page.pdfDescription || ''}
                                                            onChange={(e) => setPages(pages.map(p => p.id === page.id ? { ...p, pdfDescription: e.target.value } : p))}
                                                            className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-[9px] focus:ring-1 focus:ring-orange-500 outline-none"
                                                        />
                                                    )}
                                                    <span className="text-[7px] text-slate-400 text-center leading-tight mt-auto">Recomendado: A4, Horizontal, Margem 3mm</span>
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
                                                                        <div className="w-28 shrink-0">
                                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Estilo Visual</label>
                                                                            <select
                                                                                value={q.style || 'card'}
                                                                                onChange={(e) => updatePageQuestion(page.id, 'style', e.target.value)}
                                                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs shadow-sm font-bold text-slate-600"
                                                                            >
                                                                                <option value="card">Cartão</option>
                                                                                <option value="glass">Vidro</option>
                                                                                <option value="minimal">Minimalista</option>
                                                                            </select>
                                                                        </div>
                                                                        <div className="w-28 shrink-0">
                                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Cor do Texto</label>
                                                                            <div className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-xl shadow-sm h-[42px]">
                                                                                <input 
                                                                                    type="color" 
                                                                                    value={q.textColor || '#1e293b'} 
                                                                                    onChange={(e) => updatePageQuestion(page.id, 'textColor', e.target.value)}
                                                                                    className="w-6 h-6 border-0 rounded-lg cursor-pointer bg-transparent outline-none overflow-hidden shrink-0" 
                                                                                    style={{ padding: 0 }}
                                                                                    title="Escolher Cor"
                                                                                />
                                                                                <input 
                                                                                    type="text" 
                                                                                    maxLength={7}
                                                                                    value={q.textColor || '#1e293b'} 
                                                                                    onChange={(e) => updatePageQuestion(page.id, 'textColor', e.target.value)}
                                                                                    className="w-full text-[10px] font-bold text-slate-600 outline-none uppercase bg-transparent text-center"
                                                                                    placeholder="#1e293b"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {[0, 1, 2, 3].map(optIdx => (
                                                                            <div key={optIdx} className="relative">
                                                                                <div className="flex items-center justify-between mb-1.5 ml-1">
                                                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opção {['A', 'B', 'C', 'D'][optIdx]}</label>
                                                                                    {q.optionsConfig && (
                                                                                        <label className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                                                                            Tamanho:
                                                                                            <input 
                                                                                                type="range" 
                                                                                                min="10" max="100" 
                                                                                                value={q.optionsConfig[optIdx]?.width || 80}
                                                                                                onChange={(e) => updatePageQuestion(page.id, `optWidth_${optIdx}`, parseInt(e.target.value))}
                                                                                                className="w-16 accent-orange-500"
                                                                                                title="Ajustar largura da opção"
                                                                                            />
                                                                                            <div className="flex items-center gap-0.5 ml-1">
                                                                                                <input 
                                                                                                    type="number" 
                                                                                                    min="10" max="100"
                                                                                                    value={q.optionsConfig[optIdx]?.width || 80}
                                                                                                    onChange={(e) => {
                                                                                                        let val = parseInt(e.target.value);
                                                                                                        if (isNaN(val)) val = 10;
                                                                                                        if (val > 100) val = 100;
                                                                                                        if (val < 10) val = 10;
                                                                                                        updatePageQuestion(page.id, `optWidth_${optIdx}`, val);
                                                                                                    }}
                                                                                                    className="w-8 text-center border border-slate-200 rounded p-0.5 outline-none focus:border-orange-500"
                                                                                                />
                                                                                                <span>%</span>
                                                                                            </div>
                                                                                        </label>
                                                                                    )}
                                                                                </div>
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
                                                                    <div className="w-full md:w-56 shrink-0 flex flex-col gap-2 items-center">
                                                                        <div className="flex flex-col w-full gap-2">
                                                                            <div className="flex items-center justify-between">
                                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Layout do Quiz</label>
                                                                                <button
                                                                                    onClick={() => updatePageQuestion(page.id, 'optionsConfig', q.optionsConfig ? undefined : [
                                                                                        { position: { x: 50, y: 60 }, width: 80 },
                                                                                        { position: { x: 50, y: 70 }, width: 80 },
                                                                                        { position: { x: 50, y: 80 }, width: 80 },
                                                                                        { position: { x: 50, y: 90 }, width: 80 }
                                                                                    ])}
                                                                                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-colors ${q.optionsConfig ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                                                                >
                                                                                    {q.optionsConfig ? 'Separado' : 'Agrupado'}
                                                                                </button>
                                                                            </div>
                                                                            
                                                                            {q.optionsConfig && (
                                                                                <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-lg">
                                                                                    <button onClick={() => setActivePositionElement('question')} className={`text-[9px] py-1 rounded font-bold transition-colors ${activePositionElement === 'question' ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:bg-white/50'}`}>Tit</button>
                                                                                    <button onClick={() => setActivePositionElement('opt_0')} className={`text-[9px] py-1 rounded font-bold transition-colors ${activePositionElement === 'opt_0' ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:bg-white/50'}`}>A</button>
                                                                                    <button onClick={() => setActivePositionElement('opt_1')} className={`text-[9px] py-1 rounded font-bold transition-colors ${activePositionElement === 'opt_1' ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:bg-white/50'}`}>B</button>
                                                                                    <button onClick={() => setActivePositionElement('opt_2')} className={`text-[9px] py-1 rounded font-bold transition-colors ${activePositionElement === 'opt_2' ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:bg-white/50'}`}>C</button>
                                                                                    <button onClick={() => setActivePositionElement('opt_3')} className={`text-[9px] py-1 rounded font-bold transition-colors ${activePositionElement === 'opt_3' ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:bg-white/50'}`}>D</button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div 
                                                                            className="relative aspect-[3/4] w-full bg-slate-200 rounded-xl overflow-hidden cursor-crosshair border-2 border-transparent hover:border-orange-500 transition-colors group"
                                                                            onClick={(e) => {
                                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                                const x = ((e.clientX - rect.left) / rect.width) * 100;
                                                                                const y = ((e.clientY - rect.top) / rect.height) * 100;
                                                                                if (!q.optionsConfig || activePositionElement === 'question') {
                                                                                    updatePageQuestion(page.id, 'position', {x, y});
                                                                                } else {
                                                                                    const idx = parseInt(activePositionElement.split('_')[1]);
                                                                                    updatePageQuestion(page.id, `optPos_${idx}`, {x, y});
                                                                                }
                                                                            }}
                                                                        >
                                                                            <img src={page.imageUrl} alt="Página" className="w-full h-full object-cover" />
                                                                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors pointer-events-none" />
                                                                            
                                                                            {/* Position Markers */}
                                                                            {(!q.optionsConfig) ? (
                                                                                <div 
                                                                                    className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-300"
                                                                                    style={{ left: `${q.position?.x ?? 50}%`, top: `${q.position?.y ?? 50}%` }}
                                                                                >
                                                                                    <div className="w-3 h-3 bg-orange-500 rounded-full shadow-[0_0_0_2px_white,0_4px_8px_rgba(0,0,0,0.5)] animate-pulse" />
                                                                                    <div className="absolute w-12 h-12 border border-orange-500/50 rounded-full animate-ping" />
                                                                                </div>
                                                                            ) : (
                                                                                <>
                                                                                    <div 
                                                                                        className="absolute px-2 py-0.5 bg-white/95 backdrop-blur rounded border border-white shadow text-[6px] font-bold text-center -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all"
                                                                                        style={{ 
                                                                                            left: `${q.position?.x ?? 50}%`, 
                                                                                            top: `${q.position?.y ?? 50}%`, 
                                                                                            zIndex: activePositionElement === 'question' ? 10 : 1,
                                                                                            color: q.textColor || '#1e293b'
                                                                                        }}
                                                                                    >
                                                                                        Título
                                                                                        {activePositionElement === 'question' && <div className="absolute inset-0 border border-orange-500 rounded animate-pulse" />}
                                                                                    </div>
                                                                                    {[0, 1, 2, 3].map(optIdx => {
                                                                                        if (!q.optionsConfig[optIdx]) return null;
                                                                                        const isAc = activePositionElement === `opt_${optIdx}`;
                                                                                        const style = q.style || 'card';
                                                                                        
                                                                                        const customColor = q.textColor || '#475569';
                                                                                        
                                                                                        let previewClass = "";
                                                                                        let circleClass = "";
                                                                                        
                                                                                        if (style === 'glass') {
                                                                                            previewClass = "bg-white/20 border-white/30 backdrop-blur-[1px]";
                                                                                            circleClass = "bg-white/30 border-white/40";
                                                                                        } else if (style === 'minimal') {
                                                                                            previewClass = "bg-white/70 border-slate-200/50 backdrop-blur-[1px]";
                                                                                            circleClass = "bg-white/50 border-slate-300";
                                                                                        } else {
                                                                                            previewClass = "bg-white border-slate-200";
                                                                                            circleClass = "bg-slate-100 border-slate-200";
                                                                                        }
                                                                                        
                                                                                        return (
                                                                                            <div 
                                                                                                key={optIdx}
                                                                                                className={`absolute border rounded-[3px] text-[5px] flex items-center gap-0.5 p-0.5 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all shadow-sm overflow-hidden ${previewClass}`}
                                                                                                style={{ 
                                                                                                    left: `${q.optionsConfig[optIdx].position.x}%`, 
                                                                                                    top: `${q.optionsConfig[optIdx].position.y}%`, 
                                                                                                    width: `${q.optionsConfig[optIdx].width}%`, 
                                                                                                    zIndex: isAc ? 10 : 1,
                                                                                                    color: customColor
                                                                                                }}
                                                                                            >
                                                                                                <div 
                                                                                                    className={`w-2 h-2 shrink-0 rounded-full border flex items-center justify-center text-[4px] ${circleClass}`}
                                                                                                    style={{ borderColor: customColor, color: customColor }}
                                                                                                >
                                                                                                    {['A', 'B', 'C', 'D'][optIdx]}
                                                                                                </div>
                                                                                                <div className="line-clamp-2 flex-1 font-bold whitespace-normal leading-none break-words">{q.options[optIdx] || '...'}</div>
                                                                                                {isAc && <div className="absolute inset-0 border border-orange-500 rounded-[3px] animate-pulse" />}
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-[9px] text-slate-400 text-center px-4">
                                                                            {q.optionsConfig ? 'Selecione acima e clique na imagem para mover.' : 'Clique na imagem para mover o ponto laranja.'}
                                                                        </p>
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
