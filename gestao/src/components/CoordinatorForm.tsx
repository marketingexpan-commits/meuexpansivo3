import { useState, useEffect } from 'react';
import { Input } from './Input';
import { Select } from './Select';
import { Button } from './Button';
import { User, Phone, Mail, GraduationCap, X, Loader2, Key, Layers } from 'lucide-react';
import { coordinatorService } from '../services/coordinatorService';
import { type UnitContact, CoordinationSegment } from '../types';
import { useSchoolUnits } from '../hooks/useSchoolUnits';
import { sanitizePhone } from '../utils';

interface CoordinatorFormProps {
    onClose: (shouldRefresh?: boolean) => void;
    coordinator?: UnitContact | null;
}

export function CoordinatorForm({ onClose, coordinator }: CoordinatorFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { units } = useSchoolUnits();
    const [showPassword, setShowPassword] = useState(false);

    const userUnit = localStorage.getItem('userUnit');
    const isAdminGeral = userUnit === 'admin_geral';

    const unitMapping: Record<string, string> = {
        'unit_zn': 'Zona Norte',
        'unit_ext': 'Extremoz',
        'unit_qui': 'Quintas',
        'unit_bs': 'Boa Sorte'
    };

    const mappedUnit = (userUnit && !isAdminGeral) ? unitMapping[userUnit] : userUnit;

    const [formData, setFormData] = useState<Partial<UnitContact>>({
        name: '',
        phoneNumber: '55',
        email: '',
        unit: (isAdminGeral ? '' : mappedUnit) as any,
        segment: CoordinationSegment.GERAL,
        password: ''
    });

    useEffect(() => {
        if (coordinator) {
            setFormData({
                ...coordinator,
                segment: coordinator.segment || CoordinationSegment.GERAL
            });
        }
    }, [coordinator]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let pass = "C" + "o" + "1" + Array(5).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        setFormData(prev => ({ ...prev, password: pass }));
        setShowPassword(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phoneNumber || (!coordinator && !formData.password)) {
            alert("Por favor, preencha os campos obrigatórios.");
            return;
        }

        setIsLoading(true);
        try {
            const dataToSave = {
                ...formData,
                phoneNumber: sanitizePhone(formData.phoneNumber || '')
            };

            if (coordinator) {
                await coordinatorService.updateCoordinator(coordinator.id, dataToSave);
                alert("Coordenador atualizado com sucesso!");
            } else {
                await coordinatorService.createCoordinator(dataToSave);
                alert("Coordenador cadastrado com sucesso!");
            }
            onClose(true);
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar coordenador.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-950 flex items-center justify-center text-white shadow-lg shadow-blue-950/20">
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                {coordinator ? 'Editar Coordenador' : 'Novo Coordenador'}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                                {coordinator ? coordinator.name : 'Cadastro de liderança'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => onClose()}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Nome Completo"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            startIcon={<User className="w-4 h-4" />}
                            placeholder="Ex: Maria Silva"
                            required
                        />
                        <Input
                            label="WhatsApp (Com DDD)"
                            name="phoneNumber"
                            value={formData.phoneNumber}
                            onChange={handleChange}
                            startIcon={<Phone className="w-4 h-4" />}
                            placeholder="5584999999999"
                            required
                        />
                        <Input
                            label="E-mail"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            startIcon={<Mail className="w-4 h-4" />}
                            placeholder="coordenacao@escola.com"
                        />
                        <Select
                            label="Unidade"
                            name="unit"
                            value={formData.unit}
                            onChange={handleChange}
                            options={isAdminGeral ? units.map(u => ({ label: u.fullName, value: u.id })) : units.filter(u => u.id === mappedUnit || u.fullName === mappedUnit).map(u => ({ label: u.fullName, value: u.id }))}
                            startIcon={<GraduationCap className="w-4 h-4" />}
                            required
                            disabled={!isAdminGeral}
                        />
                        <Select
                            label="Segmento de Atuação"
                            name="segment"
                            value={formData.segment}
                            onChange={handleChange}
                            options={[
                                { label: 'Educação Infantil / Fundamental I', value: CoordinationSegment.INFANTIL_FUND1 },
                                { label: 'Fundamental II / Ensino Médio', value: CoordinationSegment.FUND2_MEDIO },
                                { label: 'Geral (Ambos)', value: CoordinationSegment.GERAL }
                            ]}
                            startIcon={<Layers className="w-4 h-4" />}
                            required
                        />
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Senha de Acesso (Login)</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={handleChange}
                                        startIcon={<Key className="w-4 h-4" />}
                                        placeholder="Mínimo 6 caracteres"
                                        required={!coordinator}
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
                            coordinator ? 'Salvar Alterações' : 'Finalizar Cadastro'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
