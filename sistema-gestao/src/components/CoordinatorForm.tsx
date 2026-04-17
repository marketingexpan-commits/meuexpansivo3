import React, { useState, useEffect } from 'react';
import { Input } from './Input';
import { Select } from './Select';
import { Button } from './Button';
import { User, Phone, Mail, GraduationCap, X, Loader2, Key, Layers, Shield, MapPin, Camera, Upload } from 'lucide-react';
import { PhotoCaptureModal } from './PhotoCaptureModal';
import { ImageCropperModal } from './ImageCropperModal';
import { coordinatorService } from '../services/coordinatorService';
import { type UnitContact, CoordinationSegment, SchoolShift, UserRole } from '../types';
import { useSchoolUnits } from '../hooks/useSchoolUnits';
import { sanitizePhone } from '../utils';
import { storageService } from '../services/storageService';

interface CoordinatorFormProps {
    onClose: (shouldRefresh?: boolean) => void;
    coordinator?: UnitContact | null;
}

export function CoordinatorForm({ onClose, coordinator }: CoordinatorFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { units } = useSchoolUnits();
    const [showPassword, setShowPassword] = useState(false);
    const [isUploading, setIsUploading] = useState(false); // Feedback para upload de foto

    const userUnit = localStorage.getItem('userUnit');
    const isAdminGeral = userUnit === 'admin_geral';
    const [isGeneral, setIsGeneral] = useState(false);
    
    // Photo states
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [rawPhoto, setRawPhoto] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<UnitContact>>({
        name: '',
        phoneNumber: '55',
        email: '',
        unit: (isAdminGeral ? '' : userUnit) as any,
        segment: CoordinationSegment.GERAL,
        shift: 'all',
        gender: 'F', // Default to Feminine, or whatever
        password: ''
    });

    useEffect(() => {
        if (coordinator) {
            setIsGeneral(coordinator.unit === 'all' || coordinator.role === UserRole.GENERAL_COORDINATOR);
            setFormData({
                ...coordinator,
                email: coordinator.email || '',
                password: coordinator.password || '',
                phoneNumber: coordinator.phoneNumber || '55',
                segment: coordinator.segment || CoordinationSegment.GERAL,
                shift: coordinator.shift || 'all',
                gender: coordinator.gender || 'F'
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

    // Helper: Convert base64 to Blob
    const base64ToBlob = (base64: string) => {
        const byteString = atob(base64.split(',')[1]);
        const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeString });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phoneNumber || (!coordinator && !formData.password)) {
            alert("Por favor, preencha os campos obrigatórios.");
            return;
        }

        setIsLoading(true);
        try {
            let coordinatorId = coordinator?.id;

            const dataToSave = {
                ...formData,
                phoneNumber: sanitizePhone(formData.phoneNumber!),
                unit: isGeneral ? 'all' : formData.unit,
                role: isGeneral ? UserRole.GENERAL_COORDINATOR : UserRole.COORDINATOR
            };

            // 1. Save data initially
            if (coordinator) {
                await coordinatorService.updateCoordinator(coordinator.id, dataToSave);
            } else {
                coordinatorId = await coordinatorService.createCoordinator(dataToSave);
            }

            // 2. Handle Photo Upload if it's a new Capture (base64)
            if (formData.photoUrl?.startsWith('data:image/')) {
                setIsUploading(true);
                try {
                    const blob = base64ToBlob(formData.photoUrl);
                    const storagePath = `coordinators/photos/${coordinatorId}.jpg`;
                    const downloadUrl = await storageService.uploadFile(blob as File, storagePath);
                    
                    // Update Firestore with the real URL
                    await coordinatorService.updateCoordinator(coordinatorId!, { photoUrl: downloadUrl });
                } catch (uploadError) {
                    console.error("Upload failed", uploadError);
                    alert("Aviso: Dados salvos, mas houve um erro ao enviar a foto para o Storage.");
                } finally {
                    setIsUploading(false);
                }
            }

            alert(coordinator ? "Coordenador atualizado com sucesso!" : "Coordenador cadastrado com sucesso!");
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
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
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
                        className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    <div className="flex flex-col md:flex-row gap-8 items-start mb-6">
                        {/* PHOTO 3X4 SECTION */}
                        <div className="flex flex-col items-center">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block w-full text-center">Foto 3x4</label>
                            <div className="relative group">
                                <div className="w-32 h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden flex flex-col items-center justify-center transition-all group-hover:border-blue-900/30 group-hover:bg-blue-50/50 shadow-inner">
                                    {formData.photoUrl ? (
                                        <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-300 p-4 text-center">
                                            <Camera className="w-10 h-10 mb-2 opacity-20" />
                                            <span className="text-[9px] font-bold leading-tight uppercase tracking-wider">Perfil Coordenador</span>
                                        </div>
                                    )}

                                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                        <Upload className="w-6 h-6 text-white" />
                                    </div>
                                </div>

                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    title="Anexar foto 3x4"
                                />

                                    {formData.photoUrl && !isUploading && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, photoUrl: '' }))}
                                            className="absolute -top-2 -right-2 p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors shadow-sm"
                                            title="Remover foto"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}

                                    {isUploading && (
                                        <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-4">
                                            <Loader2 className="w-8 h-8 animate-spin text-blue-950 mb-2" />
                                            <span className="text-[10px] font-black text-blue-950 uppercase tracking-widest animate-pulse">Enviando Foto...</span>
                                        </div>
                                    )}
                                </div>
                            <div className="mt-4 flex flex-col gap-2 w-full max-w-[128px]">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full gap-2 text-[10px] h-9 !bg-blue-50 border-blue-100 text-blue-600 hover:!bg-blue-100 font-bold uppercase tracking-wider"
                                    onClick={() => setIsCameraOpen(true)}
                                >
                                    <Camera className="w-3.5 h-3.5" />
                                    Tirar Foto
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                            <div className="sm:col-span-2">
                                <Input
                                    label="Nome Completo"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    startIcon={<User className="w-4 h-4" />}
                                    placeholder="Ex: Maria Silva"
                                    required
                                />
                            </div>
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
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                        <Select
                            label="Sexo"
                            name="gender"
                            value={formData.gender || 'F'}
                            onChange={handleChange}
                            options={[
                                { label: 'Feminino (Coordenadora)', value: 'F' },
                                { label: 'Masculino (Coordenador)', value: 'M' }
                            ]}
                            startIcon={<User className="w-4 h-4" />}
                            required
                        />
                        {isAdminGeral && (
                            <Select
                                label="Tipo de Acesso"
                                name="is_general"
                                value={isGeneral ? 'true' : 'false'}
                                onChange={(e) => setIsGeneral(e.target.value === 'true')}
                                options={[
                                    { label: 'Unidade Específica', value: 'false' },
                                    { label: 'Acesso Geral (Rede)', value: 'true' }
                                ]}
                                startIcon={<Shield className="w-4 h-4" />}
                                required
                            />
                        )}
                        {!isGeneral ? (
                            <Select
                                label="Unidade"
                                name="unit"
                                value={formData.unit}
                                onChange={handleChange}
                                options={isAdminGeral ? units.map(u => ({ label: u.fullName, value: u.id })) : units.filter(u => u.id === userUnit).map(u => ({ label: u.fullName, value: u.id }))}
                                startIcon={<GraduationCap className="w-4 h-4" />}
                                required
                                disabled={!isAdminGeral}
                            />
                        ) : (
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-slate-700">Unidade</label>
                                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 font-bold text-sm">
                                    <MapPin className="w-4 h-4" />
                                    Acesso Global (Todas as Unidades)
                                </div>
                            </div>
                        )}
                        <Select
                            label="Segmento de Atuação"
                            name="segment"
                            value={formData.segment}
                            onChange={handleChange}
                            options={[
                                { label: 'Educação Infantil / Fundamental I', value: CoordinationSegment.INFANTIL_FUND1 },
                                { label: 'Fundamental II / Ensino Médio', value: CoordinationSegment.FUND2_MEDIO },
                                { label: 'Ambos os Níveis', value: CoordinationSegment.BOTH },
                                { label: 'Geral (Ambos)', value: CoordinationSegment.GERAL }
                            ]}
                            startIcon={<Layers className="w-4 h-4" />}
                            required
                        />
                        <Select
                            label="Turno de Atuação"
                            name="shift"
                            value={formData.shift}
                            onChange={handleChange}
                            options={[
                                { label: 'Matutino', value: SchoolShift.MORNING },
                                { label: 'Vespertino', value: SchoolShift.AFTERNOON },
                                { label: 'Geral (Ambos)', value: 'all' }
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
                        className="px-12 bg-blue-950 hover:bg-slate-900 shadow-xl shadow-blue-950/10 font-bold"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {coordinator ? 'Atualizar' : 'Cadastrar'}
                    </Button>
                </div>

                {/* Modais de Foto */}
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
