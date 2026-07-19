import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { User, Key, X, Loader2, CreditCard, Camera, Upload, Phone } from 'lucide-react';
import { photographerService } from '../services/photographerService';
import { type Photographer } from '../types';
import { PhotoCaptureModal } from './PhotoCaptureModal';
import { ImageCropperModal } from './ImageCropperModal';

interface PhotographerFormProps {
    onClose: (shouldRefresh?: boolean) => void;
    photographer?: Photographer | null;
}

export function PhotographerForm({ onClose, photographer }: PhotographerFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    // Photo states
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [rawPhoto, setRawPhoto] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<Photographer>>({
        name: '',
        cpf: '',
        password: '',
        unit: 'all',
        isActive: true,
        isBlocked: false,
        photoUrl: ''
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
        const { name, value, type } = e.target;
        let finalValue: any = value;
        if (type === 'checkbox') {
            finalValue = (e.target as HTMLInputElement).checked;
        }
        setFormData(prev => ({ ...prev, [name]: finalValue }));
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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecione uma imagem válida.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setRawPhoto(reader.result as string);
            setIsCropperOpen(true);
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = (croppedBase64: string) => {
        setFormData(prev => ({ ...prev, photoUrl: croppedBase64 }));
        setRawPhoto(null);
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
            cpf: (formData.cpf || '').replace(/\D/g, ''),
            whatsapp: (formData.whatsapp || '').replace(/\D/g, '')
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
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
                    <div className="flex gap-6 items-start">
                        {/* Photo Upload Section */}
                        <div className="flex flex-col items-center shrink-0">
                            <label className="text-sm font-medium text-gray-700 mb-2 block w-full text-center">Foto 3x4</label>
                            <div className="flex flex-col gap-3 items-center">
                                <div className="relative group">
                                    <div className="w-28 h-36 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden flex flex-col items-center justify-center transition-all group-hover:border-blue-950/40 group-hover:bg-blue-950/5">
                                        {formData.photoUrl ? (
                                            <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center text-slate-400 p-2 text-center">
                                                <Camera className="w-8 h-8 mb-2 opacity-50" />
                                                <span className="text-[10px] font-medium leading-tight">Anexar</span>
                                            </div>
                                        )}

                                        {/* Overlay on Hover */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Upload className="w-6 h-6 text-white" />
                                        </div>

                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            title="Anexar foto 3x4"
                                        />
                                    </div>

                                    {formData.photoUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, photoUrl: '' }))}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-xl shadow-lg hover:bg-red-600 transition-colors z-10"
                                            title="Remover foto"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsCameraOpen(true)}
                                    className="w-full h-8 text-xs text-slate-600 border-slate-300 px-2"
                                >
                                    <Camera className="w-3 h-3 mr-1.5 shrink-0" />
                                    Tirar Foto
                                </Button>
                            </div>
                        </div>

                        {/* Text Fields */}
                        <div className="flex-1 space-y-4">
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
                            
                            <Input
                                label="WhatsApp (Com DDD)"
                                name="whatsapp"
                                value={formData.whatsapp || ''}
                                onChange={handleChange}
                                startIcon={<Phone className="w-4 h-4" />}
                                placeholder="5584999999999"
                            />
                        </div>
                    </div>

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
                        
                        <div className="pt-2">
                            <Checkbox
                                label="Status de Acesso ao App (Ativo / Bloqueado)"
                                name="isBlocked"
                                checked={formData.isBlocked}
                                onChange={handleChange}
                                className={formData.isBlocked ? "text-red-600" : "text-blue-600"}
                            />
                            <p className="text-[10px] text-slate-500 mt-1 ml-7 italic">
                                {formData.isBlocked
                                    ? "O acesso deste fotógrafo ao aplicativo do aluno está atualmente BLOQUEADO."
                                    : "Este fotógrafo tem permissão ativa para acessar o aplicativo do aluno."}
                            </p>
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
                
                {/* Modals for Photo */}
                <PhotoCaptureModal
                    isOpen={isCameraOpen}
                    onClose={() => setIsCameraOpen(false)}
                    onCapture={(base64) => setFormData(prev => ({ ...prev, photoUrl: base64 }))}
                />

                <ImageCropperModal
                    isOpen={isCropperOpen}
                    imageSrc={rawPhoto}
                    onClose={() => {
                        setIsCropperOpen(false);
                        setRawPhoto(null);
                    }}
                    onCropComplete={handleCropComplete}
                />
            </div>
        </div>
    );
}
