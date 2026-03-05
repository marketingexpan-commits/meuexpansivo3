import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { PhotographerForm } from '../components/PhotographerForm';
import { Search, Loader2, UserPlus, Lock, Pencil, Trash2, ShieldCheck, Camera } from 'lucide-react';
import { photographerService } from '../services/photographerService';
import { type Photographer } from '../types';
import { useSchoolUnits } from '../hooks/useSchoolUnits';

export function Fotografos() {
    const navigate = useNavigate();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [photographers, setPhotographers] = useState<Photographer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPhotographer, setSelectedPhotographer] = useState<Photographer | null>(null);

    const { units } = useSchoolUnits();

    const userUnit = localStorage.getItem('userUnit');
    const isAdminGeral = userUnit === 'admin_geral';

    useEffect(() => {
        if (!isAdminGeral) {
            navigate('/dashboard');
        }
    }, [isAdminGeral, navigate]);

    // Filters


    const loadPhotographers = async () => {
        try {
            setIsLoading(true);
            const data = await photographerService.getPhotographers(null);
            setPhotographers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPhotographers();
    }, []);

    const handleEdit = (photographer: Photographer) => {
        setSelectedPhotographer(photographer);
        setIsFormOpen(true);
    };

    const handleDelete = async (photographer: Photographer) => {
        if (window.confirm(`Tem certeza que deseja excluir o fotógrafo ${photographer.name}?`)) {
            try {
                await photographerService.deletePhotographer(photographer.id);
                loadPhotographers();
            } catch (error) {
                console.error(error);
                alert("Erro ao excluir fotógrafo.");
            }
        }
    };

    const filteredPhotographers = photographers.filter(p => {
        return p.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Helper to get unit name from ID
    const getUnitName = (unitId: string) => {
        const unit = units.find(u => u.id === unitId);
        return unit ? unit.fullName : unitId;
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Gestão de Fotógrafos</h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Gerencie o acesso dos fotógrafos para verificação de autorização de imagem nos eventos.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setSelectedPhotographer(null);
                        setIsFormOpen(true);
                    }}
                    className="bg-blue-950 hover:bg-orange-600 shadow-xl shadow-blue-950/20 px-6 py-6 rounded-xl flex items-center gap-2 group transition-all duration-300"
                >
                    <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-lg">Novo Fotógrafo</span>
                </Button>
            </div>

            {/* Filters Section */}
            <Card className="border-none shadow-sm bg-slate-50/50 backdrop-blur-sm">
                <CardContent className="p-4">
                    <div className="md:col-span-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                            placeholder="Buscar por nome..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-12 border-slate-200 focus:border-blue-950 transition-all text-lg"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Main List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-950" />
                        <p className="font-medium animate-pulse">Carregando fotógrafos...</p>
                    </div>
                ) : filteredPhotographers.length > 0 ? (
                    filteredPhotographers.map((p) => (
                        <Card key={p.id} className="group border-slate-200 hover:border-blue-950/30 hover:shadow-xl transition-all duration-300 overflow-hidden bg-white">
                            <CardContent className="p-0">
                                {/* Card Header with decorative background */}
                                <div className="h-2 bg-blue-950 w-full opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="p-6 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-blue-950/5 flex items-center justify-center text-blue-950 group-hover:bg-blue-950 group-hover:text-white transition-all duration-300 shadow-inner">
                                                <Camera className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 group-hover:text-blue-950 transition-colors truncate max-w-[150px]">
                                                    {p.name}
                                                </h3>
                                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-950/60 uppercase tracking-wider">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    {p.unit === 'all' ? 'Toda a Rede' : getUnitName(p.unit)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleEdit(p)}
                                                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-blue-950 transition-all"
                                                title="Editar"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(p)}
                                                className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-600 transition-all"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 group-hover:border-blue-950/10 group-hover:bg-white transition-all">
                                            <ShieldCheck className="w-4 h-4 text-blue-950/50" />
                                            <span className="text-xs font-semibold truncate">
                                                Status: {p.isActive ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 group-hover:border-blue-950/10 group-hover:bg-white transition-all">
                                            <Lock className="w-4 h-4 text-blue-950/50" />
                                            <span className="text-xs font-mono font-bold tracking-tight">
                                                Senha: ••••••
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-4">
                        <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center">
                            <Camera className="w-8 h-8 opacity-20" />
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-slate-900">Nenhum fotógrafo encontrado</h3>
                            <p className="text-sm font-medium">Ajuste os filtros ou cadastre um novo fotógrafo.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Form */}
            {isFormOpen && (
                <PhotographerForm
                    onClose={(refresh) => {
                        setIsFormOpen(false);
                        if (refresh) loadPhotographers();
                    }}
                    photographer={selectedPhotographer}
                />
            )}
        </div>
    );
}
