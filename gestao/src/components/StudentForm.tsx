import { useState } from 'react';
import { Input } from './Input';
import { Select } from './Select';
import { Button } from './Button';
import { User, MapPin, Users, GraduationCap, X, Loader2, Camera, Upload } from 'lucide-react';
import { clsx } from 'clsx';
import { studentService } from '../services/studentService';
import type { Student } from '../types';
import { EDUCATION_LEVELS, GRADES_BY_LEVEL, SCHOOL_SHIFTS, SCHOOL_CLASSES_OPTIONS } from '../types';

const STUDENT_STATUS_OPTIONS = [
    { label: 'CURSANDO', value: 'CURSANDO' },
    { label: 'TRANSFERIDO', value: 'TRANSFERIDO' },
    { label: 'EVADIDO', value: 'EVADIDO' },
    { label: 'TRANCADO', value: 'TRANCADO' },
    { label: 'RESERVADO', value: 'RESERVADO' },
    { label: 'REPROVADO', value: 'REPROVADO' },
    { label: 'APROVADO', value: 'APROVADO' },
    { label: 'ATIVO', value: 'ATIVO' },
    { label: 'INATIVO', value: 'INATIVO' },
];

interface StudentFormProps {
    onClose: (shouldRefresh?: boolean) => void;
    student?: Student | null;
}
// Helper to find level from grade
import { parseGradeLevel, normalizeClass } from '../utils/academicUtils';

export function StudentForm({ onClose, student }: StudentFormProps) {
    const [activeTab, setActiveTab] = useState<'personal' | 'academic' | 'family' | 'address'>('personal');
    const [isLoading, setIsLoading] = useState(false);

    // Initial state setup
    const [formData, setFormData] = useState<Partial<Student> & any>(() => {
        // Determine initial unit based on login
        const userUnit = localStorage.getItem('userUnit');
        let initialUnit = '';

        const unitMapping: Record<string, string> = {
            'unit_zn': 'Zona Norte',
            'unit_ext': 'Extremoz',
            'unit_qui': 'Quintas',
            'unit_bs': 'Boa Sorte'
        };

        if (userUnit && userUnit !== 'admin_geral') {
            initialUnit = unitMapping[userUnit] || '';
        }

        const initialData = student ? { ...student } : {
            name: '',
            code: '', // Initialize code
            cpf_aluno: '',
            data_nascimento: '',
            identidade_rg: '',
            rg_emissor: '',
            sexo: '',
            naturalidade: '',

            unit: initialUnit, // Pre-fill unit
            gradeLevel: '',
            schoolClass: '', // Turma
            shift: '', // Turno

            nome_mae: '',
            nome_pai: '',
            nome_responsavel: '',
            cpf_responsavel: '',
            rg_responsavel: '',
            telefone_responsavel: '',
            email_responsavel: '',
            photoUrl: '',
            status: 'CURSANDO', // Default status for new students

            cep: '',
            endereco_logradouro: '',
            endereco_numero: '',
            endereco_complemento: '',
            endereco_bairro: '',
            endereco_cidade: '',
            endereco_uf: '',
            localizacao_tipo: ''
        };

        // Normalize gradeLevel for UI if existing
        if (student && student.gradeLevel) {
            const { grade } = parseGradeLevel(student.gradeLevel);
            if (grade) initialData.gradeLevel = grade;
        }

        // Normalize schoolClass (e.g. "03" -> "C")
        if (student && student.schoolClass) {
            initialData.schoolClass = normalizeClass(student.schoolClass);
        }

        // Normalize schoolClass (e.g. "03" -> "C")
        if (student && student.schoolClass) {
            initialData.schoolClass = normalizeClass(student.schoolClass);
        }

        return initialData;
    });

    // Check if unit should be disabled
    const userUnit = localStorage.getItem('userUnit');
    const isUnitLocked = !!(userUnit && userUnit !== 'admin_geral');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev: any) => {
            const newData = { ...prev, [name]: value };

            // Lógica de Automação: Bloquear acesso se não estiver ATIVO ou CURSANDO
            if (name === 'status') {
                const isActive = value === 'CURSANDO' || value === 'ATIVO' || value === 'APROVADO';
                newData.isBlocked = !isActive;
            }

            return newData;
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 1. Validar tipo
        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecione uma imagem válida.');
            return;
        }

        // 2. Validar tamanho original (máximo 1MB para evitar travamentos no processamento)
        if (file.size > 1 * 1024 * 1024) {
            alert('A imagem original é muito grande. Por favor, escolha um arquivo com menos de 1MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                // 3. Otimização: Redimensionar para 3x4 (300x400px) usando Canvas
                const targetWidth = 300;
                const targetHeight = 400;

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Desenhar mantendo o aspecto (cortando excessos se necessário)
                const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
                const x = (targetWidth / 2) - (img.width / 2) * scale;
                const y = (targetHeight / 2) - (img.height / 2) * scale;

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, targetWidth, targetHeight);
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

                // 4. Exportar como JPEG comprimido (qualidade 0.7)
                const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                console.log('Original size:', (reader.result as string).length);
                console.log('Optimized size:', optimizedBase64.length);

                setFormData((prev: any) => ({ ...prev, photoUrl: optimizedBase64 }));
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    };

    // Helper state for Level dropdown
    const [selectedLevel, setSelectedLevel] = useState<string>(() => {
        if (student && student.gradeLevel) {
            const { level } = parseGradeLevel(student.gradeLevel);
            return level;
        }
        return '';
    });

    const handleLevelChange = (newLevel: string) => {
        setSelectedLevel(newLevel);
        setFormData((prev: any) => ({ ...prev, gradeLevel: '' }));
    };

    const handleSubmit = async () => {
        try {
            setIsLoading(true);
            console.log("Saving student:", formData);
            // Basic validation
            if (!formData.name) return alert("Nome é obrigatório");
            if (!formData.unit) return alert("Unidade é obrigatória"); // Ensure unit is present

            if (student && student.id) {
                await studentService.updateStudent(student.id, formData);
                alert("Dados do aluno atualizados com sucesso!");
            } else {
                await studentService.createStudent(formData);
                alert("Aluno matriculado com sucesso!");
            }
            onClose(true);
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar dados.");
        } finally {
            setIsLoading(false);
        }
    };

    const tabs = [
        { id: 'personal', label: 'Dados Pessoais', icon: User },
        { id: 'academic', label: 'Acadêmico', icon: GraduationCap },
        { id: 'family', label: 'Responsáveis', icon: Users },
        { id: 'address', label: 'Endereço', icon: MapPin },
    ] as const;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{student ? 'Editar Matrícula' : 'Nova Matrícula'}</h2>
                        <p className="text-sm text-gray-500">{student ? 'Edite os dados do aluno.' : 'Preencha os dados do aluno para realizar a matrícula.'}</p>
                    </div>
                    <button onClick={() => onClose()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex overflow-x-auto border-b border-gray-100 px-6">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                    activeTab === tab.id
                                        ? "border-blue-600 text-blue-600"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        )
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'personal' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Photo Upload Section */}
                            <div className="md:col-span-2 lg:col-span-1 flex flex-col items-center">
                                <label className="text-sm font-medium text-gray-700 mb-2 block w-full text-center md:text-left">Foto 3x4</label>
                                <div className="relative group">
                                    <div className="w-32 h-40 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg overflow-hidden flex flex-col items-center justify-center transition-all group-hover:border-blue-400 group-hover:bg-blue-50/30">
                                        {formData.photoUrl ? (
                                            <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center text-slate-400 p-2 text-center">
                                                <Camera className="w-8 h-8 mb-2 opacity-50" />
                                                <span className="text-[10px] font-medium leading-tight">Clique para anexar foto 3x4</span>
                                            </div>
                                        )}

                                        {/* Overlay on Hover */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
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

                                    {formData.photoUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData((prev: any) => ({ ...prev, photoUrl: '' }))}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-colors z-10"
                                            title="Remover foto"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                                <div className="mt-2 text-center md:text-left">
                                    <p className="text-[10px] text-slate-500 font-medium">Padrão 3x4 (JPEG/PNG)</p>
                                    <p className="text-[9px] text-slate-400">O sistema otimiza o peso automaticamente</p>
                                </div>
                            </div>

                            <div className="md:col-span-2 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input name="name" value={formData.name} onChange={handleChange} label="Nome Completo do Aluno" placeholder="Nome completo" className="col-span-2" />
                                <Input name="cpf_aluno" value={formData.cpf_aluno} onChange={handleChange} label="CPF" placeholder="000.000.000-00" />
                                <Input name="data_nascimento" value={formData.data_nascimento} onChange={handleChange} label="Data de Nascimento" type="date" />
                                <Input name="identidade_rg" value={formData.identidade_rg} onChange={handleChange} label="RG" placeholder="Número do RG" />
                                <Input name="rg_emissor" value={formData.rg_emissor} onChange={handleChange} label="Órgão Emissor" placeholder="Ex: ITEP/RN" />
                                <Select
                                    label="Sexo"
                                    value={formData.sexo}
                                    onChange={(e) => handleSelectChange('sexo', e.target.value)}
                                    options={[
                                        { label: 'Masculino', value: 'M' },
                                        { label: 'Feminino', value: 'F' }
                                    ]}
                                />
                                <Input name="naturalidade" value={formData.naturalidade} onChange={handleChange} label="Naturalidade" placeholder="Cidade de nascimento" />
                            </div>
                        </div>
                    )}


                    {activeTab === 'academic' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select
                                label="Situação da Matrícula"
                                value={formData.status || 'CURSANDO'}
                                onChange={(e) => handleSelectChange('status', e.target.value)}
                                options={STUDENT_STATUS_OPTIONS}
                                className="bg-blue-50/30 border-blue-100"
                            />
                            <div className="hidden md:block"></div> {/* Spacer */}

                            <Select
                                label="Unidade Escolar"
                                value={formData.unit}
                                onChange={(e) => handleSelectChange('unit', e.target.value)}
                                disabled={isUnitLocked}
                                options={[
                                    { label: 'Unidade Zona Norte', value: 'Zona Norte' },
                                    { label: 'Unidade Extremoz', value: 'Extremoz' },
                                    { label: 'Unidade Quintas', value: 'Quintas' },
                                    { label: 'Unidade Boa Sorte', value: 'Boa Sorte' }
                                ]}
                            />
                            <Select
                                label="Nível de Ensino"
                                value={selectedLevel}
                                onChange={(e) => handleLevelChange(e.target.value)}
                                options={EDUCATION_LEVELS}
                            />
                            <Select
                                label="Série / Ano"
                                value={formData.gradeLevel}
                                onChange={(e) => handleSelectChange('gradeLevel', e.target.value)}
                                options={selectedLevel ? GRADES_BY_LEVEL[selectedLevel]?.map(g => ({ label: g, value: g })) || [] : []}
                                disabled={!selectedLevel}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Select
                                    label="Turno"
                                    value={formData.shift}
                                    onChange={(e) => handleSelectChange('shift', e.target.value)}
                                    options={SCHOOL_SHIFTS}
                                />
                                <Select
                                    label="Turma"
                                    value={formData.schoolClass}
                                    onChange={(e) => handleSelectChange('schoolClass', e.target.value)}
                                    options={SCHOOL_CLASSES_OPTIONS}
                                />
                            </div>
                            <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                                <Input
                                    label="Número de Matrícula"
                                    value={formData.code || ''}
                                    disabled={true}
                                    placeholder={student ? "Matrícula do aluno" : "Será gerado ao salvar"}
                                    className="bg-gray-50"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'family' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input name="nome_mae" value={formData.nome_mae} onChange={handleChange} label="Nome da Mãe" placeholder="Nome completo da mãe" className="col-span-2" />
                                <Input name="nome_pai" value={formData.nome_pai} onChange={handleChange} label="Nome do Pai" placeholder="Nome completo do pai" className="col-span-2" />
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-600" />
                                    Responsável Financeiro/Pedagógico
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input key="resp-name-input" name="nome_responsavel" value={formData.nome_responsavel} onChange={handleChange} label="Nome do Responsável" placeholder="Nome completo do responsável" className="col-span-2" />
                                    <Input name="cpf_responsavel" value={formData.cpf_responsavel} onChange={handleChange} label="CPF do Responsável" placeholder="000.000.000-00" />
                                    <Input name="rg_responsavel" value={formData.rg_responsavel} onChange={handleChange} label="RG do Responsável" placeholder="Documento de identidade" />
                                    <Input
                                        name="telefone_responsavel"
                                        value={formData.telefone_responsavel}
                                        onChange={handleChange}
                                        label="Telefone (WhatsApp)"
                                        placeholder="5584999999999"
                                        helperText="Apenas números (Ex: 5584...)"
                                    />
                                    <Input name="email_responsavel" value={formData.email_responsavel} onChange={handleChange} label="E-mail" type="email" placeholder="email@exemplo.com" />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'address' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-2 md:col-span-1">
                                <Input name="cep" value={formData.cep} onChange={handleChange} label="CEP" placeholder="00000-000" />
                            </div>
                            <div className="hidden md:block"></div> {/* Spacer */}

                            <Input name="endereco_logradouro" value={formData.endereco_logradouro} onChange={handleChange} label="Logradouro" placeholder="Rua, Av..." className="col-span-2" />
                            <Input name="endereco_numero" value={formData.endereco_numero} onChange={handleChange} label="Número" placeholder="123" />
                            <Input name="endereco_complemento" value={formData.endereco_complemento} onChange={handleChange} label="Complemento" placeholder="Apto, Bloco..." />
                            <Input name="endereco_bairro" value={formData.endereco_bairro} onChange={handleChange} label="Bairro" placeholder="Bairro" />
                            <Input name="endereco_cidade" value={formData.endereco_cidade} onChange={handleChange} label="Cidade" placeholder="Natal" />
                            <Select
                                label="UF"
                                value={formData.endereco_uf}
                                onChange={(e) => handleSelectChange('endereco_uf', e.target.value)}
                                options={[{ label: 'RN', value: 'RN' }, { label: 'PB', value: 'PB' }]}
                            />
                            <Select
                                label="Zona"
                                value={formData.localizacao_tipo}
                                onChange={(e) => handleSelectChange('localizacao_tipo', e.target.value)}
                                options={[{ label: 'Urbana', value: 'Urbana' }, { label: 'Rural', value: 'Rural' }]}
                            />
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => onClose()} disabled={isLoading}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar Matrícula'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
