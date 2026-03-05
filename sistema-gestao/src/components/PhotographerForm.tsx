import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { User, Key, X, Loader2, CreditCard, Camera } from 'lucide-react';
import { photographerService } from '../services/photographerService';
import { type Photographer } from '../types';

interface PhotographerFormProps {
    onClose: (shouldRefresh?: boolean) => void;
    photographer?: Photographer | null;
}

export function PhotographerForm({ onClose, photographer }: PhotographerFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState<Partial<Photographer>>({
        name: '',
        cpf: '',
        password: '',
        unit: 'all',
        isActive: true
    });

    useEffect(() => {
        if (photographer) {
            setFormData({
                ...photographer,
                password: photographer.password || ''
            });
        }
    }, [photographer]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const formatCPF = (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    };

    const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, cpf: formatCPF(e.target.value) }));
    };

    const generatePassword = () => {
        const pass = "Ft" + Math.floor(1000 + Math.random() * 9000); // Ex: Ft1234
        setFormData(prev => ({ ...prev, password: pass }));
        setShowPassword(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.cpf || !formData.password || !formData.unit) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        const cleanedData = {
            ...formData,
            cpf: (formData.cpf || '').replace(/\D/g, '')
        };

        try {
            if (photographer) {
                await photographerService.updatePhotographer(photographer.id, cleanedData);
                alert("Fotógrafo atualizado com sucesso!");
            } else {
                await photographerService.createPhotographer(cleanedData as any);
                alert("Fotógrafo cadastrado com sucesso!");
            }
            onClose(true);
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar fotógrafo.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-blue-950/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-950 flex items-center justify-center text-white shadow-lg shadow-blue-950/20">
                            <Camera className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                {photographer ? 'Editar Fotógrafo' : 'Novo Fotógrafo'}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                                {photographer ? photographer.name : 'Cadastro de acesso para eventos'}
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
                            label="Nome do Fotógrafo"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            startIcon={<User className="w-4 h-4" />}
                            placeholder="Ex: Carlos Silva"
                            required
                        />

                        <Input
                            label="CPF"
                            name="cpf"
                            value={formData.cpf}
                            onChange={handleCpfChange}
                            maxLength={14}
                            startIcon={<CreditCard className="w-4 h-4" />}
                            placeholder="000.000.000-00"
                            required
                        />



                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-slate-700">Senha de Acesso ao App</label>
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
                                O fotógrafo usará o CPF e esta senha para logar no aplicativo do aluno.
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
                        className="px-12 bg-blue-950 hover:bg-orange-600 shadow-xl shadow-blue-950/10 transition-all duration-300"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            photographer ? 'Salvar Alterações' : 'Finalizar Cadastro'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
