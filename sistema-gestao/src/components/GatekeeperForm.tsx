import { useState, useEffect } from 'react';
import { Input } from './Input';
import { Select } from './Select';
import { Button } from './Button';
import { User, Key, Lock, GraduationCap, X, Loader2 } from 'lucide-react';
import { gatekeeperService } from '../services/gatekeeperService';
import { type Gatekeeper } from '../types';
import { useSchoolUnits } from '../hooks/useSchoolUnits';

interface GatekeeperFormProps {
    onClose: (shouldRefresh?: boolean) => void;
    gatekeeper?: Gatekeeper | null;
}

export function GatekeeperForm({ onClose, gatekeeper }: GatekeeperFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { units } = useSchoolUnits();
    const [showPassword, setShowPassword] = useState(false);

    const userUnit = localStorage.getItem('userUnit');
    const isAdminGeral = userUnit === 'admin_geral';

    const [formData, setFormData] = useState<Partial<Gatekeeper>>({
        name: '',
        password: '',
        unit: (isAdminGeral ? '' : userUnit) as any,
        isActive: true
    });

    useEffect(() => {
        if (gatekeeper) {
            setFormData({
                ...gatekeeper,
                password: gatekeeper.password || ''
            });
        }
    }, [gatekeeper]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const generatePassword = () => {
        const pass = "P" + "rt" + Math.floor(1000 + Math.random() * 9000); // Ex: Prt1234
        setFormData(prev => ({ ...prev, password: pass }));
        setShowPassword(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.password || !formData.unit) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        setIsLoading(true);
        try {
            if (gatekeeper) {
                await gatekeeperService.updateGatekeeper(gatekeeper.id, formData);
                alert("Porteiro atualizado com sucesso!");
            } else {
                await gatekeeperService.createGatekeeper(formData as any);
                alert("Porteiro cadastrado com sucesso!");
            }
            onClose(true);
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar porteiro.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-950 flex items-center justify-center text-white shadow-lg shadow-blue-950/20">
                            <Lock className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                {gatekeeper ? 'Editar Porteiro' : 'Novo Porteiro'}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                                {gatekeeper ? gatekeeper.name : 'Cadastro de acesso à portaria'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => onClose()}
                        className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    <div className="space-y-4">
                        <Input
                            label="Nome do Porteiro"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            startIcon={<User className="w-4 h-4" />}
                            placeholder="Ex: João da Silva"
                            required
                        />

                        <Select
                            label="Unidade Escolar"
                            name="unit"
                            value={formData.unit}
                            onChange={handleChange}
                            options={isAdminGeral ? [
                                { label: 'Selecione uma unidade...', value: '' },
                                ...units.map(u => ({ label: u.fullName, value: u.id }))
                            ] : units.filter(u => u.id === userUnit).map(u => ({ label: u.fullName, value: u.id }))}
                            startIcon={<GraduationCap className="w-4 h-4" />}
                            required
                            disabled={!isAdminGeral}
                        />

                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Senha de Acesso</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={handleChange}
                                        startIcon={<Key className="w-4 h-4" />}
                                        placeholder="Senha segura"
                                        required
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <X className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                                    </button>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-[42px] px-3 border-2 border-slate-200"
                                    onClick={generatePassword}
                                >
                                    Gerar
                                </Button>
                            </div>
                            <p className="text-[10px] text-slate-400">
                                Esta senha será usada pelo porteiro para acessar o sistema no app principal.
                            </p>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onClose()}
                        disabled={isLoading}
                        className="px-8 border-2"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="px-12 bg-blue-950 hover:bg-slate-900 shadow-xl shadow-blue-950/10"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            gatekeeper ? 'Salvar Alterações' : 'Finalizar Cadastro'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
