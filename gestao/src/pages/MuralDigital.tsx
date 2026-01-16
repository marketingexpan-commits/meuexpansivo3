
import { useState, useEffect } from 'react';
import { db, storage } from '../firebaseConfig';
import {
    collection,
    addDoc,
    deleteDoc,
    updateDoc,
    doc,
    query,
    where,
    onSnapshot
} from 'firebase/firestore';
import {
    ref,
    uploadBytes,
    getDownloadURL
} from 'firebase/storage';
import type { MuralItem } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import {
    Image,
    FileText,
    Trash2,
    Loader2,
    Plus,
    Upload,
    ExternalLink,
    Pencil
} from 'lucide-react';

export function MuralDigital() {
    const [activeTab, setActiveTab] = useState<'flyers' | 'files'>('flyers');
    const [items, setItems] = useState<MuralItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [originalUrl, setOriginalUrl] = useState<string | null>(null);

    // Filter Items based on Tab
    const filteredItems = items.filter(item =>
        activeTab === 'flyers' ? item.type === 'flyer' : item.type === 'file'
    );

    // Fetch Items Real-time
    useEffect(() => {
        // REMOVED orderBy to avoid requiring a composite index immediately.
        // Sorting will be done client-side.
        const q = query(
            collection(db, 'mural_items'),
            where('isActive', '==', true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedItems = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as MuralItem));

            // Client-side sort
            fetchedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setItems(fetchedItems);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar itens do mural:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        // Se estiver editando, permite salvar sem arquivo (apenas titulo). Se for novo, exige arquivo.
        if ((!file && !editingId) || !title) return;

        setUploading(true);
        try {
            const type = activeTab === 'flyers' ? 'flyer' : 'file';
            let url = originalUrl || '';

            // 1. Upload to Firebase Storage (Se houver novo arquivo)
            if (file) {
                const storagePath = `mural/${type}s/${Date.now()}_${file.name}`;
                const storageRef = ref(storage, storagePath);
                const snapshot = await uploadBytes(storageRef, file);
                url = await getDownloadURL(snapshot.ref);
            }

            // 2. Prepare Metadata
            const itemData: Partial<MuralItem> = {
                type,
                title,
                url,
                isActive: true,
                order: 0,
            };

            // Se for novo item, adiciona data de criação
            if (!editingId) {
                itemData.createdAt = new Date().toISOString();
            }

            if (type === 'file' && file) {
                itemData.date = new Date().toLocaleDateString('pt-BR');
                // Calculate size approx
                const sizeInMB = file.size / (1024 * 1024);
                if (sizeInMB < 1) {
                    itemData.size = `${(file.size / 1024).toFixed(0)} KB`;
                } else {
                    itemData.size = `${sizeInMB.toFixed(1)} MB`;
                }
            }

            // 3. Save to Firestore (Add or Update)
            if (editingId) {
                await updateDoc(doc(db, 'mural_items', editingId), itemData);
                alert("Item atualizado com sucesso!");
            } else {
                await addDoc(collection(db, 'mural_items'), itemData);
                alert("Item adicionado com sucesso!");
            }

            // 4. Reset Form
            handleCancelEdit();

        } catch (error) {
            console.error("Erro no upload:", error);
            alert("Erro ao salvar item.");
        } finally {
            setUploading(false);
        }
    };

    const handleEdit = (item: MuralItem) => {
        setEditingId(item.id);
        setTitle(item.title);
        setOriginalUrl(item.url);
        setFile(null);
        // Scroll to form (opcional, simples UX)
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setTitle('');
        setFile(null);
        setOriginalUrl(null);
        const fileInput = document.getElementById('mural-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja remover este item?")) return;
        try {
            await deleteDoc(doc(db, 'mural_items', id));
        } catch (error) {
            console.error("Erro ao deletar:", error);
            alert("Erro ao remover item.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-blue-950">Mural Digital (App)</h1>
                    <p className="text-slate-500">Gerencie, os banners e arquivos exibidos na tela de login do App.</p>
                </div>
            </div>

            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('flyers')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'flyers'
                        ? 'bg-white text-blue-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Image className="w-4 h-4" />
                        Banners / Destaques
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('files')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'files'
                        ? 'bg-white text-blue-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Arquivos / Downloads
                    </div>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* FORMULÁRIO DE UPLOAD */}
                <Card className="lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-lg">
                            {editingId ? 'Editar Item' : `Adicionar Novo ${activeTab === 'flyers' ? 'Banner' : 'Arquivo'}`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                                <Input
                                    placeholder={activeTab === 'flyers' ? "Ex: Volta às Aulas 2026" : "Ex: Lista de Livros 1º Ano"}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {activeTab === 'flyers' ? 'Imagem do Banner' : 'Arquivo PDF'}
                                </label>
                                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                                    <input
                                        id="mural-file-input"
                                        type="file"
                                        accept={activeTab === 'flyers' ? "image/*" : ".pdf"}
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        required
                                    />
                                    <div className="flex flex-col items-center gap-2 pointer-events-none">
                                        <Upload className="w-8 h-8 text-slate-300" />
                                        <span className="text-sm text-slate-500">
                                            {file ? file.name : (editingId ? "Clique para substituir o arquivo (opcional)" : "Clique ou arraste para enviar")}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {activeTab === 'flyers' ? 'PNG, JPG (Recomendado: 1920x1080)' : 'PDF (Máx. 10MB)'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={uploading || (!file && !editingId) || !title}
                                isLoading={uploading}
                            >
                                {editingId ? <Pencil className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                {editingId ? 'Salvar Alterações' : 'Adicionar ao Mural'}
                            </Button>

                            {editingId && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="w-full text-sm text-slate-500 hover:text-slate-700 underline mt-2"
                                >
                                    Cancelar Edição
                                </button>
                            )}

                        </form>
                    </CardContent>
                </Card>

                {/* LISTA DE ITENS */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Itens Ativos ({filteredItems.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-950" />
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 italic">
                                Nenhum item cadastrado nesta categoria.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredItems.map(item => (
                                    <div
                                        key={item.id}
                                        className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors group"
                                    >
                                        {/* THUMBNAIL */}
                                        <div className="w-16 h-16 shrink-0 bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                                            {item.type === 'flyer' ? (
                                                <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <FileText className="w-8 h-8 text-slate-400" />
                                            )}
                                        </div>

                                        {/* INFO */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-800 truncate">{item.title}</h4>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                <span>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</span>
                                                {item.size && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                        <span>{item.size}</span>
                                                    </>
                                                )}
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                                >
                                                    <ExternalLink className="w-3 h-3" /> Ver
                                                </a>
                                            </div>
                                        </div>

                                        {/* ACTIONS */}
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar item"
                                            >
                                                <Pencil className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Remover item"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

