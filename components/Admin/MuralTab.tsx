import React, { useState, useEffect } from 'react';
import { db, storage } from '../../firebaseConfig';
import { MuralItem } from '../../types';
import { Button } from '../Button';
import { TableSkeleton } from '../Skeleton';
import { Upload, Trash2, FileText, Image, Loader2, Plus } from 'lucide-react';

interface MuralTabProps {
    isGeneralAdmin: boolean;
}

export const MuralTab: React.FC<MuralTabProps> = ({ isGeneralAdmin }) => {
    const [items, setItems] = useState<MuralItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Form States
    const [type, setType] = useState<'flyer' | 'file'>('flyer');
    const [title, setTitle] = useState('');
    const [file, setFile] = useState<File | null>(null);

    // Fetch Items
    useEffect(() => {
        const unsubscribe = db.collection('mural_items')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snap => {
                const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MuralItem));
                setItems(data);
                setLoading(false);
            }, (error) => {
                console.error("Erro ao buscar mural:", error);
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
        if (!file || !title) return;

        setUploading(true);
        try {
            // 1. Upload to Firebase Storage
            const storageRef = storage.ref();
            const fileRef = storageRef.child(`mural/${type}s/${Date.now()}_${file.name}`);
            const snapshot = await fileRef.put(file);
            const url = await snapshot.ref.getDownloadURL();

            // 2. Prepare Metadata
            const newItem: Partial<MuralItem> = {
                type,
                title,
                url,
                isActive: true,
                order: 0,
                createdAt: new Date().toISOString()
            };

            if (type === 'file') {
                newItem.date = new Date().toLocaleDateString('pt-BR');
                // Calculate size approx
                const sizeInMB = file.size / (1024 * 1024);
                if (sizeInMB < 1) {
                    newItem.size = `${(file.size / 1024).toFixed(0)} KB`;
                } else {
                    newItem.size = `${sizeInMB.toFixed(1)} MB`;
                }
            }

            // 3. Save to Firestore
            await db.collection('mural_items').add(newItem);

            // 4. Reset Form
            setTitle('');
            setFile(null);
            // Reset file input manually if needed, but state is null
            const fileInput = document.getElementById('mural-file-input') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

            alert("Item adicionado com sucesso!");

        } catch (error) {
            console.error("Erro no upload:", error);
            alert("Erro ao enviar arquivo.");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string, url: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este item?")) return;

        try {
            // 1. Delete from Firestore
            await db.collection('mural_items').doc(id).delete();

            // 2. Try delete from Storage (optional, but good practice)
            // Extract path from URL if possible, or just ignore if complex
            // Simple attempt:
            try {
                const storageRef = storage.refFromURL(url);
                await storageRef.delete();
            } catch (ignore) {
                console.warn("Could not delete file from storage (might rely on ID match)", ignore);
            }

        } catch (error) {
            console.error("Erro ao excluir:", error);
            alert("Erro ao excluir item.");
        }
    };

    const flyers = items.filter(i => i.type === 'flyer');
    const files = items.filter(i => i.type === 'file');

    if (!isGeneralAdmin) {
        return (
            <div className="p-8 text-center text-gray-500">
                Acesso restrito ao Administrador Geral.
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto animate-fade-in-up">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <div className="bg-blue-950 p-2 rounded-lg text-white">
                            <Image className="w-6 h-6" />
                        </div>
                        Gerenciamento do Mural Digital
                    </h1>
                    <p className="text-gray-500 mt-1">Gerencie os banners e arquivos que aparecem na tela de login do aluno.</p>
                </div>
            </div>

            {/* FORMULÁRIO DE UPLOAD */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-600" />
                    Adicionar Novo Item
                </h3>
                <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as 'flyer' | 'file')}
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="flyer">Banner (Imagem)</option>
                            <option value="file">Arquivo (PDF)</option>
                        </select>
                    </div>

                    <div className="md:col-span-4">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título / Descrição</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder={type === 'flyer' ? "Ex: Volta às Aulas" : "Ex: Lista de Materiais"}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>

                    <div className="md:col-span-4">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Arquivo ({type === 'flyer' ? 'Imagem' : 'PDF'})</label>
                        <div className="relative">
                            <input
                                id="mural-file-input"
                                type="file"
                                accept={type === 'flyer' ? "image/*" : "application/pdf"}
                                onChange={handleFileChange}
                                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                required
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <Button
                            type="submit"
                            disabled={uploading || !file || !title}
                            className={`w-full py-3 font-bold flex items-center justify-center gap-2 ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            {uploading ? 'Enviando...' : 'Adicionar'}
                        </Button>
                    </div>
                </form>
            </div>

            {loading ? (
                <TableSkeleton />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* COLUNA 1: BANNERS */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center justify-between">
                            <span>Banners (Destaques)</span>
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{flyers.length}</span>
                        </h3>
                        {flyers.length === 0 && <p className="text-gray-400 text-sm italic py-4">Nenhum banner cadastrado.</p>}
                        <div className="grid grid-cols-1 gap-4">
                            {flyers.map(item => (
                                <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-all flex flex-col">
                                    <div className="aspect-video w-full bg-gray-100 relative">
                                        <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
                                                title="Ver Imagem"
                                            >
                                                <Image className="w-5 h-5" />
                                            </a>
                                            <button
                                                onClick={() => handleDelete(item.id, item.url)}
                                                className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-3 border-t border-gray-100">
                                        <h4 className="font-bold text-gray-800 text-sm">{item.title}</h4>
                                        <p className="text-xs text-gray-400 mt-1">Adicionado em {new Date(item.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* COLUNA 2: ARQUIVOS */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center justify-between">
                            <span>Arquivos (Downloads)</span>
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{files.length}</span>
                        </h3>
                        {files.length === 0 && <p className="text-gray-400 text-sm italic py-4">Nenhum arquivo cadastrado.</p>}
                        <div className="space-y-3">
                            {files.map(item => (
                                <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 group hover:border-blue-300 transition-colors">
                                    <div className="p-3 bg-red-50 text-red-500 rounded-lg">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-800 text-sm truncate" title={item.title}>{item.title}</h4>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                            <span>{item.date}</span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <span className="bg-gray-100 px-1.5 rounded">{item.size}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a
                                            href={item.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                            title="Baixar/Visualizar"
                                        >
                                            <Upload className="w-5 h-5 rotate-180" />
                                        </a>
                                        <button
                                            onClick={() => handleDelete(item.id, item.url)}
                                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
