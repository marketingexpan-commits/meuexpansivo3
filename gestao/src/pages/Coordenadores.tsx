import { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { CoordinatorForm } from '../components/CoordinatorForm';
import { Search, Loader2, UserPlus, User, Pencil, Trash2, MessagesSquare, GraduationCap, Layers } from 'lucide-react';
import { coordinatorService } from '../services/coordinatorService';
import { type UnitContact, CoordinationSegment } from '../types';
import { useSchoolUnits } from '../hooks/useSchoolUnits';

export function Coordenadores() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [coordinators, setCoordinators] = useState<UnitContact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCoordinator, setSelectedCoordinator] = useState<UnitContact | null>(null);

    const { units } = useSchoolUnits();

    const userUnit = localStorage.getItem('userUnit');
    const isAdminGeral = userUnit === 'admin_geral';

    // Filters
    const [filterUnit, setFilterUnit] = useState(isAdminGeral ? '' : userUnit || '');

    const loadCoordinators = async () => {
        try {
            setIsLoading(true);
            const data = await coordinatorService.getCoordinators(isAdminGeral ? null : userUnit);
            setCoordinators(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCoordinators();
    }, []);

    const handleEdit = (coordinator: UnitContact) => {
        setSelectedCoordinator(coordinator);
        setIsFormOpen(true);
    };

    const handleDelete = async (coordinator: UnitContact) => {
        if (window.confirm(`Tem certeza que deseja excluir o coordenador ${coordinator.name}?`)) {
            try {
                await coordinatorService.deleteCoordinator(coordinator.id);
                alert("Coordenador excluído com sucesso!");
                loadCoordinators();
            } catch (error) {
                console.error(error);
                alert("Erro ao excluir coordenador.");
            }
        }
    };

    const filteredCoordinators = coordinators.filter(coord => {
        const matchesSearch = coord.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            coord.phoneNumber.includes(searchTerm);
        const matchesUnit = !filterUnit || coord.unit === filterUnit;
        return matchesSearch && matchesUnit;
    });

    const getSegmentLabel = (segment?: CoordinationSegment | string) => {
        switch (segment) {
            case CoordinationSegment.INFANTIL_FUND1: return 'Educação Infantil / Fundamental I';
            case CoordinationSegment.FUND2_MEDIO: return 'Fundamental II / Ensino Médio';
            case CoordinationSegment.GERAL: return 'Geral (Ambos)';
            default: return 'Geral (Ambos)';
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Gestão de Coordenadores</h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Gerencie a liderança pedagógica, segmentos e acessos administrativos.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setSelectedCoordinator(null);
                        setIsFormOpen(true);
                    }}
                    className="bg-blue-950 hover:bg-slate-900 shadow-xl shadow-blue-950/20 px-6 py-6 rounded-xl flex items-center gap-2 group transition-all"
                >
                    <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-lg">Novo Coordenador</span>
                </Button>
            </div>

            {/* Filters Section */}
            <Card className="border-none shadow-sm bg-slate-50/50 backdrop-blur-sm">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar por nome ou telefone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-10 border-slate-200 focus:border-blue-950 transition-all"
                            />
                        </div>
                        <Select
                            value={filterUnit}
                            onChange={(e) => setFilterUnit(e.target.value)}
                            options={isAdminGeral ? [
                                { label: 'Todas as Unidades', value: '' },
                                ...units.map(u => ({ label: u.fullName, value: u.id }))
                            ] : units.filter(u => u.id === userUnit).map(u => ({ label: u.fullName, value: u.id }))}
                            className="h-10 border-slate-200"
                            disabled={!isAdminGeral}
                            startIcon={<GraduationCap className="w-4 h-4 text-slate-400" />}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Main List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-950" />
                        <p className="font-medium animate-pulse">Carregando coordenadores...</p>
                    </div>
                ) : filteredCoordinators.length > 0 ? (
                    filteredCoordinators.map((coord) => (
                        <Card key={coord.id} className="group border-slate-200 hover:border-blue-950/30 hover:shadow-xl transition-all duration-300 overflow-hidden bg-white">
                            <CardContent className="p-0">
                                {/* Card Header with decorative background */}
                                <div className="h-2 bg-blue-950 w-full opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="p-6 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-blue-950/5 flex items-center justify-center text-blue-950 group-hover:bg-blue-950 group-hover:text-white transition-all duration-300 shadow-inner">
                                                <User className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 group-hover:text-blue-950 transition-colors truncate max-w-[150px]">
                                                    {coord.name}
                                                </h3>
                                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <GraduationCap className="w-3 h-3" />
                                                    {coord.unit}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleEdit(coord)}
                                                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-blue-950 transition-all"
                                                title="Editar"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(coord)}
                                                className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-600 transition-all"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 group-hover:border-blue-950/10 group-hover:bg-white transition-all">
                                            <Layers className="w-4 h-4 text-blue-950/50" />
                                            <span className="text-xs font-semibold truncate">
                                                {getSegmentLabel(coord.segment)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 group-hover:border-blue-950/10 group-hover:bg-white transition-all">
                                            <MessagesSquare className="w-4 h-4 text-blue-950/50" />
                                            <span className="text-xs font-mono font-bold tracking-tight">
                                                +{coord.phoneNumber}
                                            </span>
                                        </div>
                                    </div>

                                    <a
                                        href={`https://wa.me/${coord.phoneNumber}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-950 transition-all shadow-lg shadow-slate-900/10 group-hover:translate-y-[-2px] active:translate-y-0"
                                    >
                                        <MessagesSquare className="w-4 h-4" />
                                        Conversar no WhatsApp
                                    </a>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-4">
                        <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center">
                            <UserPlus className="w-8 h-8 opacity-20" />
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-slate-900">Nenhum coordenador encontrado</h3>
                            <p className="text-sm font-medium">Ajuste os filtros ou cadastre um novo coordenador.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Form */}
            {isFormOpen && (
                <CoordinatorForm
                    onClose={(refresh) => {
                        setIsFormOpen(false);
                        if (refresh) loadCoordinators();
                    }}
                    coordinator={selectedCoordinator}
                />
            )}
        </div>
    );
}
