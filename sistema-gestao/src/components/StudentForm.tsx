import { useState, useEffect } from 'react';
import { Input } from './Input';
import { Select } from './Select';
import { Checkbox } from './Checkbox';
import { Button } from './Button';
import { User, MapPin, Users, GraduationCap, X, Loader2, Camera, Upload, MessagesSquare, Heart, FileText, Printer, Barcode, Trash2, Eye, EyeOff, ShieldAlert, ShieldCheck, Plus } from 'lucide-react';
import { StudentEnrollmentPrint } from './StudentEnrollmentPrint';
import { PhotoCaptureModal } from './PhotoCaptureModal';
import { clsx } from 'clsx';
import { ImageCropperModal } from './ImageCropperModal';
import { studentService } from '../services/studentService';
import { storageService } from '../services/storageService';
import type { Student } from '../types';
import { UNIT_LABELS, SchoolUnit, SHIFT_LABELS, SchoolShift } from '../types';
import { SCHOOL_CLASSES_OPTIONS, ACADEMIC_SEGMENTS, ACADEMIC_GRADES } from '../utils/academicDefaults';
import { useAcademicData } from '../hooks/useAcademicData';
import { useSchoolUnits } from '../hooks/useSchoolUnits';
import { financialService } from '../services/financialService';
import { generateCarne } from '../utils/carneGenerator';
import { Modal } from './Modal';
import { getCurrentSchoolYear, parseGradeLevel, normalizeClass } from '../utils/academicUtils';

const MONTHS = [
    { label: 'Janeiro', value: '1' },
    { label: 'Fevereiro', value: '2' },
    { label: 'Março', value: '3' },
    { label: 'Abril', value: '4' },
    { label: 'Maio', value: '5' },
    { label: 'Junho', value: '6' },
    { label: 'Julho', value: '7' },
    { label: 'Agosto', value: '8' },
    { label: 'Setembro', value: '9' },
    { label: 'Outubro', value: '10' },
    { label: 'Novembro', value: '11' },
    { label: 'Dezembro', value: '12' }
];

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
    { label: 'CONCLUÍDO', value: 'CONCLUÍDO' },
];

const PAYMENT_METHOD_OPTIONS = [
    { label: 'Sistema Interno', value: 'Interno' },
    { label: 'Parceiro Isaac', value: 'Isaac' }
];

const STUDENT_DOCUMENTS_CHECKLIST = [
    'Certidão de Nascimento',
    'RG do Aluno',
    'CPF do Aluno',
    'RG do Responsável',
    'CPF do Responsável',
    'Comprovante de Residência',
    'Foto 3x4',
    'Histórico Escolar',
    'Declaração de Transferência',
    'Cartão de Vacinas',
    'Carteira do Plano de Saúde',
    'Contrato de Prestação de Serviços'
];

interface StudentFormProps {
    onClose: (shouldRefresh?: boolean) => void;
    onSaveSuccess?: () => void;
    student?: Student | null;
}


export function StudentForm({ onClose, onSaveSuccess, student }: StudentFormProps) {
    const [activeTab, setActiveTab] = useState<'personal' | 'academic' | 'family' | 'filiation' | 'address' | 'health' | 'documents' | 'observations'>('personal');
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingBoleto, setIsGeneratingBoleto] = useState(false);
    const { loading: loadingAcademic, grades: dynamicGrades } = useAcademicData();
    const { getUnitById } = useSchoolUnits();
    const [printBlank, setPrintBlank] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [rawPhoto, setRawPhoto] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [isCarneConfigOpen, setIsCarneConfigOpen] = useState(false);
    const [carneConfig, setCarneConfig] = useState({
        year: new Date().getFullYear(),
        startMonth: '1',
        endMonth: '12',
        withBoletos: false
    });

    const [selectedYear, setSelectedYear] = useState(getCurrentSchoolYear());
    const [loadingCep, setLoadingCep] = useState(false);

    const handleCepSearch = async () => {
        if (!formData.cep || formData.cep.replace(/\D/g, '').length !== 8) {
            return;
        }

        try {
            setLoadingCep(true);
            const response = await fetch(`https://viacep.com.br/ws/${formData.cep.replace(/\D/g, '')}/json/`);
            const data = await response.json();

            if (data.erro) {
                alert('CEP não encontrado.');
                return;
            }

            setFormData((prev: any) => ({
                ...prev,
                endereco_logradouro: data.logradouro || prev.endereco_logradouro,
                endereco_bairro: data.bairro || prev.endereco_bairro,
                endereco_cidade: data.localidade || prev.endereco_cidade,
                endereco_uf: data.uf || prev.endereco_uf
            }));
        } catch (error) {
            console.error("Erro ao buscar CEP:", error);
        } finally {
            setLoadingCep(false);
        }
    };

    // Helper state for Level dropdown - MUST BE INITIALIZED BEFORE formData TO SYNC
    const [selectedLevel, setSelectedLevel] = useState<string>(() => {
        if (student && student.gradeLevel) {
            const { level } = parseGradeLevel(student.gradeLevel);
            return level;
        }
        return '';
    });

    // Initial state setup
    const [formData, setFormData] = useState<Partial<Student> & any>(() => {
        // Determine initial unit based on login
        const userUnit = localStorage.getItem('userUnit');
        let initialUnit = '';

        if (userUnit && userUnit !== 'admin_geral') {
            initialUnit = userUnit;
        }

        const initialData = student ? { ...student } : {
            name: '',
            code: '', // Initialize code
            matricula: '', // NOVO
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
            mae_profissao: '',
            mae_nacionalidade: '',
            mae_naturalidade: '',
            mae_local_trabalho: '',
            mae_telefone: '',
            mae_renda_mensal: '',

            nome_pai: '',
            pai_profissao: '',
            pai_nacionalidade: '',
            pai_naturalidade: '',
            pai_local_trabalho: '',
            pai_telefone: '',
            pai_renda_mensal: '',

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
            localizacao_tipo: '',
            isScholarship: false,
            metodo_pagamento: 'Interno',

            // New Fields
            alias: '',
            socialName: '',
            data_inicio: new Date().toISOString().split('T')[0], // Default to today
            procedencia_escolar: '',
            autorizacao_bolsa: '',
            observacoes_gerais: '',

            // Civil Docs
            certidao_tipo: 'Nascimento',
            certidao_numero: '',
            certidao_livro: '',
            certidao_folha: '',
            certidao_cartorio: '',
            certidao_data_emissao: '',

            // Initialize ficha_saude properly
            ficha_saude: {
                neurodiversidade: [],
                neurodiversidade_outra: '',
                doencas_cronicas: [],
                doencas_cronicas_outra: '',
                deficiencias: [],
                deficiencias_outra: '',
                doencas_contraidas: [],
                doencas_contraidas_outra: '',
                vacinas: [],
                vacinas_outra: '',
                medicamentos_continuos: '',
                contato_emergencia_nome: '',
                contato_emergencia_fone: '',
                hospital_preferencia: '',
                medico_particular: '',
                medico_telefone: '',
                instrucoes_febre: '',
                plano_saude_nome: '',
                plano_saude_numero: '',
                observacoes_adicionais: '',
                restricoes_alimentares: '',
                intolerancias: []
            },

            documentos_entregues: [] as string[],
            nacionalidade: '',
            uf_naturalidade: '',
            enrollmentHistory: [] as any[]
        };

        // Sync phone fields if editing existing student
        if (student) {
            initialData.telefone_responsavel = student.telefone_responsavel || student.phoneNumber || '';
        }

        // Initialize gradeLevel from student if existing - CRITICAL FIX
        if (student && student.gradeLevel) {
            const { grade } = parseGradeLevel(student.gradeLevel);
            initialData.gradeLevel = grade; // Set only the Grade part
        }

        // Normalize schoolClass (e.g. "03" -> "C")
        if (student && student.schoolClass) {
            const normalized = normalizeClass(student.schoolClass);
            initialData.schoolClass = normalized === 'U' ? 'A' : normalized;
        }

        // AUTO-FIX: Sync history with root class for Current Year
        // If the student has a root class like "A" but history says "U", we fix it here.
        if (student) {
            const currentYear = getCurrentSchoolYear();
            const history = [...(initialData.enrollmentHistory || [])];
            const currentIndex = history.findIndex((h: any) => h.year === currentYear);

            if (currentIndex >= 0) {
                const historyClass = history[currentIndex].schoolClass;
                const targetClass = initialData.schoolClass;

                // FORCE 'A' if 'U' appears in history
                // OR sync if history differs from root
                if (historyClass === 'U' || (targetClass && historyClass !== targetClass)) {
                    // console.log(`Auto-fixing class for ${student.name}: ${historyClass} -> ${targetClass}`);
                    history[currentIndex] = { ...history[currentIndex], schoolClass: targetClass || 'A' };
                    initialData.enrollmentHistory = history;
                }
            }
        }

        return initialData;
    });

    // --- LOGICA DE GERADOR DE MATRÍCULA ---
    useEffect(() => {
        const fetchNextCode = async () => {
            if (!student && !formData.code) {
                setIsLoading(true);
                const nextCode = await studentService.getNextStudentCode();
                if (nextCode) {
                    setFormData((prev: any) => ({ ...prev, code: nextCode }));
                }
                setIsLoading(false);
            }
        };
        fetchNextCode();
    }, [student]); // Carrega ao abrir nova matrícula

    // Check if unit should be disabled
    const userUnit = localStorage.getItem('userUnit');
    const isUnitLocked = !!(userUnit && userUnit !== 'admin_geral');

    // Base Tuition State for Calculation
    const [baseTuition, setBaseTuition] = useState<string>(() => {
        if (student && student.valor_mensalidade) {
            const final = Number(student.valor_mensalidade);
            const discount = student.bolsa_percentual ? parseFloat(student.bolsa_percentual) : 0;

            // Revert calculation: Base = Final / (1 - Discount/100)
            if (discount > 0 && discount < 100) {
                return (final / (1 - discount / 100)).toFixed(2);
            }
            return final.toFixed(2);
        }
        return '';
    });



    // Helper for currency formatting
    const formatCurrencyValue = (value: string) => {
        if (!value) return '';
        // Remove non-numeric chars except comma and dot
        const clean = value.replace(/[^\d,.]/g, '');
        // Parse to float
        const floatVal = parseFloat(clean.replace(',', '.')) || 0;
        // Format to standard BRL string (without R$ symbol as we use prefix)
        return floatVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Handlers for Bidirectional Calculation
    const handleBaseTuitionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Allow digits, comma, dot
        const newVal = e.target.value.replace(/[^\d,.]/g, '');
        setBaseTuition(newVal);

        // Calculate immediately using the partial value for responsive UI
        const base = parseFloat(newVal.replace(/\./g, '').replace(',', '.')) || 0;
        const discount = parseFloat((formData.bolsa_percentual || '0').toString().replace(',', '.')) || 0;

        const finalValue = base * (1 - discount / 100);

        // We update the state, but we don't force-format immediately to allow typing
        setFormData((prev: any) => ({
            ...prev,
            valor_mensalidade: finalValue
        }));
    };

    const handleBaseTuitionBlur = () => {
        setBaseTuition(prev => formatCurrencyValue(prev));
    };

    const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDiscount = e.target.value;

        const base = parseFloat(baseTuition.replace(/\./g, '').replace(',', '.')) || 0;
        const discount = parseFloat(newDiscount.replace(',', '.')) || 0;

        const finalValue = base * (1 - discount / 100);

        setFormData((prev: any) => ({
            ...prev,
            bolsa_percentual: newDiscount,
            valor_mensalidade: finalValue
        }));
    };

    const handleFinalValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Allow digits, comma, dot
        const rawVal = e.target.value.replace(/[^\d,.]/g, '');

        // Update the display value in state primarily
        setFormData((prev: any) => ({
            ...prev,
            valor_mensalidade: rawVal
        }));

        // Calculate discount based on this interim values
        const newFinalVal = parseFloat(rawVal.replace(/\./g, '').replace(',', '.')) || 0;
        const base = parseFloat(baseTuition.replace(/\./g, '').replace(',', '.')) || 0;

        if (base > 0) {
            const impliedDiscount = (1 - (newFinalVal / base)) * 100;
            setFormData((prev: any) => ({
                ...prev,
                valor_mensalidade: rawVal,
                bolsa_percentual: impliedDiscount > 0 ? impliedDiscount.toFixed(2) : '0'
            }));
        }
    };

    const handleFinalValueBlur = () => {
        setFormData((prev: any) => ({
            ...prev,
            valor_mensalidade: formatCurrencyValue(prev.valor_mensalidade?.toString())
        }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        let finalValue: any = value;
        if (type === 'checkbox') {
            finalValue = (e.target as HTMLInputElement).checked;
        }

        // Special handling for scholarship toggle
        if (name === 'isScholarship' && finalValue === true) {
            setBaseTuition(''); // Clear base tuition
            setFormData((prev: any) => ({
                ...prev,
                [name]: finalValue,
                bolsa_percentual: '', // Clear discount
                valor_mensalidade: 0
            }));
            return;
        }

        setFormData((prev: any) => {
            const newData = { ...prev, [name]: finalValue };

            // Sync with history if academic field
            if (['gradeLevel', 'schoolClass', 'shift'].includes(name)) {
                return syncHistoryRow(newData, selectedYear, {});
            }

            return newData;
        });
    };


    const handleSelectChange = (name: string, value: string) => {
        setFormData((prev: any) => {
            let newData = { ...prev, [name]: value };

            // Lógica de Automação: Bloquear acesso se não estiver ATIVO ou CURSANDO
            if (name === 'status') {
                const isActive = value === 'CURSANDO' || value === 'ATIVO' || value === 'APROVADO';
                newData.isBlocked = !isActive;
            }

            // Sync with history if academic field
            if (['shift', 'status', 'gradeLevel', 'schoolClass'].includes(name)) {
                newData = syncHistoryRow(newData, selectedYear, {});
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

        const reader = new FileReader();
        reader.onloadend = () => {
            setRawPhoto(reader.result as string);
            setIsCropperOpen(true);
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = (croppedBase64: string) => {
        setFormData((prev: any) => ({ ...prev, photoUrl: croppedBase64 }));
        setRawPhoto(null);
    };



    const handleLevelChange = (newLevel: string) => {
        const segment = Object.values(ACADEMIC_SEGMENTS).find(s => s.label === newLevel);
        setSelectedLevel(newLevel);

        const newSegmentId = segment?.id || '';
        setFormData((prev: any) => {
            const newData = {
                ...prev,
                gradeLevel: '',
                segmentId: newSegmentId
            };

            // Sync with history
            return syncHistoryRow(newData, selectedYear, { segmentId: newSegmentId, gradeLevel: '' });
        });
    };

    const handleYearChange = (year: string) => {
        setSelectedYear(year);

        // Find existing enrollment for this year
        const enrollment = formData.enrollmentHistory?.find((h: any) => h.year === year);

        if (enrollment) {
            // Load enrollment into form
            const { grade, level } = parseGradeLevel(enrollment.gradeLevel);
            setSelectedLevel(level);

            setFormData((prev: any) => ({
                ...prev,
                gradeLevel: grade,
                schoolClass: normalizeClass(enrollment.schoolClass),
                shift: enrollment.shift,
                status: enrollment.status || prev.status
            }));
        } else {
            // Clear current fields for new year
            setFormData((prev: any) => ({
                ...prev,
                gradeLevel: '',
                schoolClass: '',
                shift: '',
                // Keep status as it is (global student status)
            }));
            setSelectedLevel('');
        }
    };

    // Helper to sync main fields with history
    const syncHistoryRow = (currentData: any, year: string, updates: any) => {
        const history = [...(currentData.enrollmentHistory || [])];
        let index = history.findIndex((h: any) => h.year === year);

        const enrollmentUpdate = {
            year,
            unit: currentData.unit || '',
            gradeLevel: currentData.gradeLevel ? `${currentData.gradeLevel} - ${selectedLevel}` : '',
            schoolClass: currentData.schoolClass || '',
            shift: currentData.shift || '',
            status: currentData.status || 'CURSANDO',
            ...updates
        };

        if (index >= 0) {
            history[index] = { ...history[index], ...enrollmentUpdate };
        } else {
            history.push(enrollmentUpdate);
            history.sort((a, b) => b.year.localeCompare(a.year));
        }

        return { ...currentData, enrollmentHistory: history };
    };

    const handleAddHistoryRow = () => {
        const newRecord = {
            year: new Date().getFullYear().toString(),
            unit: formData.unit || '',
            gradeLevel: formData.gradeLevel ? `${formData.gradeLevel} - ${selectedLevel}` : '',
            schoolClass: formData.schoolClass || 'A',
            shift: formData.shift ? SHIFT_LABELS[formData.shift as SchoolShift] || formData.shift : 'Matutino',
            status: 'CURSANDO'
        };
        setFormData((prev: any) => {
            const history = [...(prev.enrollmentHistory || []), newRecord];
            history.sort((a, b) => b.year.localeCompare(a.year));
            return {
                ...prev,
                enrollmentHistory: history
            };
        });
    };

    const handleRemoveHistoryRow = (index: number) => {
        setFormData((prev: any) => ({
            ...prev,
            enrollmentHistory: (prev.enrollmentHistory || []).filter((_: any, i: number) => i !== index)
        }));
    };

    const handleUpdateHistoryRow = (index: number, field: string, value: string) => {
        setFormData((prev: any) => {
            const history = [...(prev.enrollmentHistory || [])];
            history[index] = { ...history[index], [field]: value };

            // If we updated the YEAR, we should re-sort
            if (field === 'year') {
                history.sort((a, b) => b.year.localeCompare(a.year));
            }

            return { ...prev, enrollmentHistory: history };
        });
    };

    // Helper to remove undefined/null from object before saving to Firestore
    const cleanObject = (obj: any): any => {
        const cleaned = { ...obj };
        Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === undefined) {
                delete cleaned[key];
            } else if (cleaned[key] !== null && typeof cleaned[key] === 'object' && !Array.isArray(cleaned[key])) {
                cleaned[key] = cleanObject(cleaned[key]);
            }
        });
        return cleaned;
    };

    const handleGenerateBoletos = async () => {
        if (!student?.id) {
            alert("O cadastro precisa estar salvo antes de gerar boletos.");
            return;
        }

        const year = new Date().getFullYear();
        const now = new Date();
        const limitDate = new Date();
        limitDate.setDate(now.getDate() + 28);

        try {
            const installments = await financialService.getInstallmentsForPrint(student.id, year) as any[];
            const pending = installments.filter(inst => inst.status !== 'Pago' && !inst.barcode);

            // Filter for installments eligible for Mercado Pago (limit 29 days)
            const eligible = pending.filter(inst => {
                const dueDate = new Date(inst.dueDate);
                return dueDate <= limitDate;
            });

            if (eligible.length === 0) {
                alert("Não há mensalidades pendentes com vencimento nos próximos 28 dias. O Mercado Pago não permite gerar boletos para datas muito distantes.");
                return;
            }

            // For the test, we take only the first one (avulso)
            const inst = eligible[0];

            if (!confirm(`Gerar boleto AVULSO para a mensalidade de ${inst.month}?`)) return;

            setIsGeneratingBoleto(true);
            const payerName = formData.nome_responsavel || formData.name;
            const payer = {
                email: formData.email_responsavel || 'email@padrao.com',
                firstName: payerName.split(' ')[0],
                lastName: payerName.split(' ').slice(1).join(' ') || 'Responsável',
                cpf: formData.cpf_responsavel || '00000000000',
                address: {
                    zipCode: (formData.cep || '').replace(/\D/g, '') || '59000000',
                    streetName: formData.endereco_logradouro || 'Endereço não informado',
                    streetNumber: formData.endereco_numero || 'S/N',
                    neighborhood: formData.endereco_bairro || 'Bairro',
                    city: formData.endereco_cidade || 'Natal',
                    state: formData.endereco_uf || 'RN'
                }
            };

            const parseCurrency = (val: any) => {
                if (typeof val === 'number') return val;
                if (!val) return 0;
                const clean = String(val).replace(/[^\d,.]/g, '');
                if (clean.includes(',') && clean.includes('.')) {
                    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
                } else if (clean.includes(',')) {
                    return parseFloat(clean.replace(',', '.'));
                }
                return parseFloat(clean) || 0;
            };

            const cleanAmount = parseCurrency(inst.value);

            const boletoData = await financialService.generateBoleto({
                studentId: student.id,
                amount: cleanAmount,
                dueDate: new Date(inst.dueDate).toISOString(),
                description: `Mensalidade ${inst.month} - ${formData.name}`,
                payer: payer
            });

            const updates: any = {
                barcode: boletoData.barcode,
                digitableLine: boletoData.digitableLine,
                mpPaymentId: boletoData.id,
                ticketUrl: boletoData.ticketUrl,
                qrCode: boletoData.qrCode,
                qrCodeBase64: boletoData.qrCodeBase64
            };

            if (!inst.documentNumber) {
                const monthIdx = parseInt(financialService._getMonthNumber(inst.month));
                updates.documentNumber = financialService._generateDocumentNumber(monthIdx);
            }

            await financialService.updateInstallment(inst.id, updates);

            alert(`Boleto de ${inst.month} gerado com sucesso para ${formData.name}!`);
        } catch (error: any) {
            console.error("Erro ao gerar boleto:", error);
            alert(`Erro ao gerar boleto: ${error.message}\n\nVerifique o cadastro do aluno (CPF, Endereço, etc) ou se a parcela está dentro do prazo de 29 dias.`);
        } finally {
            setIsGeneratingBoleto(false);
        }
    };

    const handleGenerateCarne = async () => {
        if (!student?.id) {
            alert("O cadastro precisa estar salvo antes de gerar o carnê.");
            return;
        }
        setIsCarneConfigOpen(true);
    };

    const handleConfirmGenerateCarne = async () => {
        if (!student?.id) return;

        try {
            setIsLoading(true);
            // Removido setIsCarneConfigOpen(false) daqui para manter o modal aberto com feedback visual

            // --- LÓGICA DE VALOR: Usar o valor do cadastro atual ---
            const parseCurrency = (val: any) => {
                if (typeof val === 'number') return val;
                if (!val) return 0;
                const clean = String(val).replace(/[^\d,.]/g, '');
                if (clean.includes(',') && clean.includes('.')) {
                    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
                } else if (clean.includes(',')) {
                    return parseFloat(clean.replace(',', '.'));
                }
                return parseFloat(clean) || 0;
            };

            const tuitionValue = parseCurrency(formData.valor_mensalidade);

            // 1. GERAR/GARANTIR PARCELAS NO BANCO (Isso reflete no App do Aluno)
            await financialService.generateInstallments(
                student.id,
                parseInt(carneConfig.startMonth),
                parseInt(carneConfig.endMonth),
                carneConfig.year,
                tuitionValue,
                carneConfig.withBoletos
            );

            // 2. BUSCAR PARCELAS PARA IMPRESSÃO
            const rawInstallments = await financialService.getInstallmentsForPrint(student.id, carneConfig.year) as any[];

            // Filtrar pelo range solicitado para garantir exatidão no print
            const monthsList = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const startIdx = parseInt(carneConfig.startMonth) - 1;
            const endIdx = parseInt(carneConfig.endMonth);
            const requestedMonths = monthsList.slice(startIdx, endIdx);

            const filteredInstallments = rawInstallments.filter(inst => {
                const m = inst.month.split('/')[0];
                return requestedMonths.includes(m);
            });

            if (filteredInstallments.length === 0) {
                alert("Nenhuma parcela encontrada ou gerada para este período.");
                return;
            }

            // Garantir que todas as parcelas têm Código de Baixa Sequencial e Valor do Cadastro
            const installmentsWithCorrectValue = filteredInstallments.map(inst => ({
                ...inst,
                value: tuitionValue // Forçar o valor que está no cadastro no carnê impresso
            }));

            const installments = await financialService.ensureSequentialDocumentNumbers(installmentsWithCorrectValue);

            const unitDetail = getUnitById(formData.unit || '');
            if (!unitDetail) {
                alert("Dados da unidade não encontrados.");
                return;
            }

            generateCarne(formData as Student, installments, unitDetail);
            setIsCarneConfigOpen(false);
        } catch (error) {
            console.error(error);
            alert("Erro ao processar e gerar o carnê.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            setIsLoading(true);

            // --- BLINDAGEM: VALIDAÇÃO RIGOROSA ---
            const requiredFields = [
                { key: 'name', label: 'Nome do Aluno' },
                { key: 'unit', label: 'Unidade Escolar' },
                { key: 'gradeLevel', label: 'Série / Ano' },
                { key: 'shift', label: 'Turno' },
                { key: 'schoolClass', label: 'Turma' },
                { key: 'code', label: 'Código do Aluno' },
                { key: 'nome_responsavel', label: 'Nome do Responsável' }
            ];

            for (const field of requiredFields) {
                if (!formData[field.key]) {
                    setIsLoading(false);
                    return alert(`O campo "${field.label}" é obrigatório para realizar a matrícula.`);
                }
            }

            // Segment validation (Ensures consistency)
            if (!selectedLevel) {
                setIsLoading(false);
                return alert("O Nível de Ensino (Segmento) é obrigatório.");
            }

            // Validação de Unicidade Global (Agora Escopada por Unidade)
            // Se já tem cadastro em outra unidade com mesmo código, tudo bem.
            // Mas na MESMA unidade, não pode repetir.
            const isUnique = await studentService.isCodeUnique(formData.code, student?.id, formData.unit);
            if (!isUnique) {
                setIsLoading(false);
                return alert(`O código ${formData.code} já está em uso por outro aluno nesta unidade. Por favor, utilize um código diferente.`);
            }

            // Robust Currency Parser
            const parseCurrency = (val: any) => {
                if (typeof val === 'number') return val;
                if (!val) return 0;

                const clean = String(val).replace(/[^\d,.]/g, '');
                // Se tem vírgula e ponto, ou só vírgula, assume que a vírgula é o decimal (BR)
                if (clean.includes(',') && clean.includes('.')) {
                    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
                } else if (clean.includes(',')) {
                    return parseFloat(clean.replace(',', '.'));
                }
                return parseFloat(clean) || 0;
            };

            // Synchronize phone fields & Sanitize Financials
            const cleanTuition = parseCurrency(formData.valor_mensalidade);

            // STANDARDIZATION: Enforce absolute naming convention "GradeLabel - SegmentLabel"
            const officialGrade = Object.values(ACADEMIC_GRADES).find(g => g.label === formData.gradeLevel && g.segmentId === Object.values(ACADEMIC_SEGMENTS).find(s => s.label === selectedLevel)?.id);

            let finalGradeLevel = formData.gradeLevel;
            if (officialGrade) {
                finalGradeLevel = `${officialGrade.label} - ${selectedLevel}`;
            } else {
                // Se por algum motivo não achou no objeto, faz o join manual limpo
                finalGradeLevel = `${formData.gradeLevel} - ${selectedLevel}`;
            }

            // Banish any "Ens. Médio" or "Fund. I" abbreviations from being saved
            finalGradeLevel = finalGradeLevel
                .replace('Ens. Médio', 'Ensino Médio')
                .replace('Fund. I', 'Fundamental I')
                .replace('Fund. II', 'Fundamental II')
                .replace('Edu. Infantil', 'Educação Infantil');

            // Build the complete ficha_saude object - USE FORM DATA DIRECTLY
            const fichaSaude = {
                ...student?.ficha_saude, // Preserve existing data
                ...formData.ficha_saude   // Overwrite with form data
            };

            // Final sanitization: ROOT fields should always reflect the LATEST enrollment year
            const latestEnrollment = [...(formData.enrollmentHistory || [])].sort((a, b) => b.year.localeCompare(a.year))[0];

            // Sync enrolledYears array for efficient filtering in studentService
            const enrolledYears = Array.from(new Set((formData.enrollmentHistory || []).map((h: any) => h.year.toString()))).sort();

            const finalData = cleanObject({
                ...formData,
                gradeLevel: latestEnrollment ? latestEnrollment.gradeLevel : finalGradeLevel,
                gradeId: officialGrade ? officialGrade.id : null, // NEW: Save ID for robust matching
                schoolClass: latestEnrollment ? latestEnrollment.schoolClass : formData.schoolClass,
                shift: latestEnrollment ? latestEnrollment.shift : formData.shift,
                status: latestEnrollment ? latestEnrollment.status : formData.status,
                enrolledYears: enrolledYears, // Sync for filtering
                segment: selectedLevel, // Explicit segment storage
                segmentId: Object.values(ACADEMIC_SEGMENTS).find(s => s.label === selectedLevel)?.id || '',
                valor_mensalidade: cleanTuition, // Save as dot-decimal string or number
                phoneNumber: formData.telefone_responsavel, // Ensure root project field is updated
                ficha_saude: fichaSaude
            });

            // Clean up legacy flat fields just in case
            Object.keys(finalData).forEach(key => {
                if (key.startsWith('health_')) {
                    delete (finalData as any)[key];
                }
            });

            if (student && student.id) {
                const oldTuition = student.valor_mensalidade;
                await studentService.updateStudent(student.id, finalData);

                // Se o valor da mensalidade mudou, sincroniza as parcelas pendentes do ano atual
                if (oldTuition !== cleanTuition) {
                    try {
                        const year = new Date().getFullYear();
                        const pending = await financialService.getMensalidades({ studentId: student.id, status: 'Pendente' });
                        const thisYearPending = pending.filter(p => p.month.endsWith(`/${year}`));

                        for (const inst of thisYearPending) {
                            await financialService.updateInstallment(inst.id, { value: cleanTuition });
                        }
                    } catch (err) {
                        console.error("Erro ao sincronizar parcelas:", err);
                    }
                }

                alert("Matrícula atualizada com sucesso!");
            } else {
                await studentService.createStudent(finalData);
                alert("Novo aluno cadastrado com sucesso!");
            }

            // CRITICAL: Update formData with the complete ficha_saude structure
            // This ensures prints will show the saved health data
            setFormData((prev: any) => ({
                ...prev,
                ficha_saude: fichaSaude
            }));

            if (onSaveSuccess) {
                onSaveSuccess();
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar dados.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!student?.id) return;

        if (!confirm(`TEM CERTEZA que deseja excluir permanentemente o aluno ${formData.name}?\n\nEsta ação excluirá todos os dados do aluno e NÃO pode ser desfeita.`)) {
            return;
        }

        try {
            setIsLoading(true);
            await studentService.deleteStudent(student.id);
            alert("Aluno excluído com sucesso.");
            onClose(true); // Fechar modal e atualizar lista
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir aluno.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGeneratePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let password = "A" + "a" + "1" + Array(5).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        const generated = password.split('').sort(() => 0.5 - Math.random()).join('');
        setFormData((prev: any) => ({ ...prev, password: generated }));
        setShowPassword(true);
    };

    const handlePrint = () => {
        setPrintBlank(false);
        setTimeout(() => window.print(), 100);
    };

    const handlePrintBlank = () => {
        setPrintBlank(true);
        setTimeout(() => window.print(), 100);
    };

    const tabs = [
        { id: 'personal', label: 'Dados Pessoais', icon: User },
        { id: 'academic', label: 'Acadêmico', icon: GraduationCap },
        { id: 'family', label: 'Resp. Financeiro', icon: Users },
        { id: 'filiation', label: 'Filiação', icon: Users },
        { id: 'address', label: 'Endereço', icon: MapPin },
        { id: 'health', label: 'Saúde', icon: Heart },
        { id: 'documents', label: 'Docs', icon: FileText },
        { id: 'observations', label: 'Obs.', icon: MessagesSquare },
    ] as const;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto overflow-x-hidden">
            <div className="bg-white w-full max-w-5xl sm:rounded-xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{student ? 'Editar Cadastro' : 'Novo Aluno'}</h2>
                        <p className="text-sm text-gray-500">{student ? 'Edite os dados do aluno.' : 'Preencha os dados do aluno para realizar a matrícula.'}</p>
                    </div>
                    <button onClick={() => onClose()} className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex overflow-x-auto border-b border-gray-100 px-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent pb-4 flex-shrink-0">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer",
                                    activeTab === tab.id
                                        ? "border-blue-950 text-blue-950"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                )}
                            >
                                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                {tab.label}
                            </button>
                        )
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {activeTab === 'personal' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Photo Upload Section */}
                            <div className="md:col-span-2 lg:col-span-1 flex flex-col items-center">
                                <label className="text-sm font-medium text-gray-700 mb-2 block w-full text-center md:text-left">Foto 3x4</label>
                                <div className="relative group">
                                    <div className="w-32 h-40 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden flex flex-col items-center justify-center transition-all group-hover:border-blue-950/40 group-hover:bg-blue-950/5">
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
                                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-xl shadow-lg hover:bg-red-600 transition-colors z-10"
                                            title="Remover foto"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                                <div className="mt-3 flex flex-col gap-2 w-full max-w-[128px]">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-2 text-[10px] h-8 bg-blue-950/10 border-blue-950/20 text-blue-950 hover:bg-blue-950/20"
                                        onClick={() => setIsCameraOpen(true)}
                                    >
                                        <Camera className="w-3 h-3" />
                                        Tirar Foto
                                    </Button>

                                </div>
                                <div className="mt-2 text-center md:text-left">
                                    <p className="text-[9px] text-slate-400">Padrão 3x4 (JPEG/PNG)</p>
                                </div>
                            </div>

                            <div className="md:col-span-2 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input name="name" value={formData.name} onChange={handleChange} label="Nome Completo do Aluno" placeholder="Nome completo" className="col-span-2" />

                                <Input name="socialName" value={formData.socialName} onChange={handleChange} label="Nome Social (Opcional)" placeholder="Como o aluno prefere ser chamado" className="col-span-2" />
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
                                <Select
                                    label="Nacionalidade"
                                    value={formData.nacionalidade}
                                    onChange={(e) => handleSelectChange('nacionalidade', e.target.value)}
                                    options={[
                                        { label: 'Brasileira', value: 'Brasileira' },
                                        { label: 'Estrangeira', value: 'Estrangeira' }
                                    ]}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 col-span-2 md:col-span-1">
                                    <div className="sm:col-span-2">
                                        <Input name="naturalidade" value={formData.naturalidade} onChange={handleChange} label="Naturalidade (Cidade)" placeholder="Cidade de nascimento" className="w-full" />
                                    </div>
                                    <div className="sm:col-span-1">
                                        <Input name="uf_naturalidade" value={formData.uf_naturalidade} onChange={handleChange} label="UF" placeholder="RN" maxLength={2} className="w-full" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Civil Documentation Section - Inside Personal Tab */}
                    {activeTab === 'personal' && (
                        <div className="md:col-span-3 border-t border-gray-100 pt-4 mt-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                📜 Documentação Civil
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Select
                                    label="Tipo de Certidão"
                                    value={formData.certidao_tipo || 'Nascimento'}
                                    onChange={(e) => handleSelectChange('certidao_tipo', e.target.value)}
                                    options={[
                                        { label: 'Nascimento', value: 'Nascimento' },
                                        { label: 'Casamento', value: 'Casamento' }
                                    ]}
                                />
                                <Input name="certidao_numero" value={formData.certidao_numero} onChange={handleChange} label="Número do Termo" placeholder="Ou Matrícula" />
                                <Input name="certidao_livro" value={formData.certidao_livro} onChange={handleChange} label="Livro" />
                                <Input name="certidao_folha" value={formData.certidao_folha} onChange={handleChange} label="Folha" />
                                <Input name="certidao_cartorio" value={formData.certidao_cartorio} onChange={handleChange} label="Cartório" className="md:col-span-2" />
                                <Input name="certidao_data_emissao" value={formData.certidao_data_emissao} onChange={handleChange} label="Data de Emissão" type="date" />
                            </div>
                        </div>
                    )}


                    {activeTab === 'academic' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-4">
                            <Select
                                label="Ano Letivo"
                                value={selectedYear}
                                onChange={(e) => handleYearChange(e.target.value)}
                                options={[
                                    { label: '2022', value: '2022' },
                                    { label: '2023', value: '2023' },
                                    { label: '2024', value: '2024' },
                                    { label: '2025', value: '2025' },
                                    { label: '2026', value: '2026' }
                                ]}
                                className="bg-blue-50 border-blue-200 font-bold"
                            />

                            <Select
                                label="Situação do Aluno"
                                value={formData.status || 'CURSANDO'}
                                onChange={(e) => handleSelectChange('status', e.target.value)}
                                options={STUDENT_STATUS_OPTIONS}
                                className="bg-blue-950/5 border-blue-950/10"
                            />

                            <Select
                                label="Unidade Escolar"
                                value={formData.unit}
                                onChange={(e) => handleSelectChange('unit', e.target.value)}
                                disabled={isUnitLocked}
                                options={Object.values(SchoolUnit).map(unit => ({
                                    label: UNIT_LABELS[unit],
                                    value: unit
                                }))}
                            />
                            <Select
                                label="Nível de Ensino"
                                value={selectedLevel}
                                onChange={(e) => handleLevelChange(e.target.value)}
                                options={Object.values(ACADEMIC_SEGMENTS).map(s => ({ label: s.label, value: s.label }))}
                                disabled={loadingAcademic}
                            />
                            <Select
                                label="Série / Ano"
                                value={formData.gradeLevel}
                                onChange={(e) => handleSelectChange('gradeLevel', e.target.value)}
                                options={(() => {
                                    const segment = Object.values(ACADEMIC_SEGMENTS).find(s => s.label === selectedLevel);
                                    if (!segment) return [];

                                    // Prefer dynamic grades with isActive check
                                    if (dynamicGrades && dynamicGrades.length > 0) {
                                        return dynamicGrades
                                            .filter(g => g.segmentId === segment.id && g.isActive)
                                            .map(g => ({ label: g.name, value: g.name }));
                                    }

                                    // Fallback to static if dynamic not loaded (should generally use dynamic)
                                    return Object.values(ACADEMIC_GRADES)
                                        .filter(g => g.segmentId === segment.id)
                                        .map(g => ({ label: g.label, value: g.label }));
                                })()}
                                disabled={!selectedLevel || loadingAcademic}
                            />
                            <Select
                                label="Turno"
                                value={formData.shift}
                                onChange={(e) => handleSelectChange('shift', e.target.value)}
                                options={Object.values(SchoolShift).map(shift => ({
                                    label: SHIFT_LABELS[shift],
                                    value: shift
                                }))}
                            />
                            <Select
                                label="Turma"
                                value={formData.schoolClass}
                                onChange={(e) => handleSelectChange('schoolClass', e.target.value)}
                                options={SCHOOL_CLASSES_OPTIONS}
                            />
                            <Input
                                name="nis"
                                value={formData.nis || ''}
                                onChange={handleChange}
                                label="NIS (Bolsa Família)"
                                placeholder="000.00...-0"
                                className="col-span-1"
                            />

                            <Input
                                name="procedencia_escolar"
                                value={formData.procedencia_escolar || ''}
                                onChange={handleChange}
                                label="Escola de Origem"
                                placeholder="Escola anterior"
                                className="col-span-2 md:col-span-2"
                            />

                            <Input
                                name="data_inicio"
                                type="date"
                                value={formData.data_inicio || ''}
                                onChange={handleChange}
                                label="Início/Admissão"
                                className="col-span-1"
                            />
                            <Input
                                name="data_desligamento"
                                type="date"
                                value={formData.data_desligamento || ''}
                                onChange={handleChange}
                                label="Desligamento"
                                className="col-span-1"
                            />

                            <Input
                                name="code"
                                label="Cód. Global"
                                value={formData.code || ''}
                                onChange={handleChange}
                                placeholder={student ? "Matrícula" : "Gerando..."}
                                className="col-span-1 bg-blue-50/30 border-blue-900/10 font-bold"
                            />
                            <Input
                                name="matricula"
                                label="Matrícula"
                                value={formData.matricula || ''}
                                onChange={handleChange}
                                placeholder="000000"
                                className="col-span-1"
                            />

                            <div className="col-span-2 md:col-span-2 flex flex-col sm:flex-row gap-x-3 items-end">
                                <div className="flex-1 w-full">
                                    <label className="text-[11px] font-medium text-gray-700 mb-1 block">Senha Acesso</label>
                                    <div className="relative">
                                        <Input
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            value={formData.password || ''}
                                            onChange={handleChange}
                                            placeholder="Senha"
                                            className="pr-8 w-full h-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleGeneratePassword}
                                        className="whitespace-nowrap bg-blue-50 text-blue-950 border-blue-950/20 hover:bg-blue-100 w-full sm:w-32 h-10 px-1 font-bold text-[10px]"
                                    >
                                        Gerar Senha
                                    </Button>
                                </div>
                            </div>

                            <div className="col-span-2 md:col-span-2">
                                <label className="text-[11px] font-medium text-gray-700 mb-1 block">Status de Acesso</label>
                                <label className={`flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer h-auto ${formData.isBlocked ? 'border-red-200 bg-red-50' : 'border-blue-100 bg-blue-50 hover:bg-blue-100'}`}>
                                    <div className="flex items-center h-5">
                                        <input
                                            type="checkbox"
                                            name="isBlocked"
                                            checked={formData.isBlocked || false}
                                            onChange={handleChange}
                                            className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-[10px] sm:text-xs font-bold flex items-center gap-1.5 ${formData.isBlocked ? 'text-red-700' : 'text-blue-700'}`}>
                                            {formData.isBlocked ? (
                                                <><ShieldAlert className="w-4 h-4" /> Acesso Bloqueado</>
                                            ) : (
                                                <><ShieldCheck className="w-4 h-4" /> Acesso Liberado</>
                                            )}
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <div className="col-span-2 pt-2">
                                <label className={`flex items-start gap-2 p-3 rounded-xl border transition-colors cursor-pointer ${formData.isScholarship ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                                    <div className="flex items-center h-5 mt-0.5">
                                        <input
                                            type="checkbox"
                                            name="isScholarship"
                                            checked={formData.isScholarship || false}
                                            onChange={handleChange}
                                            className="w-5 h-5 rounded border-slate-300 text-blue-950 focus:ring-blue-900 cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            Aluno Bolsista (100%) 🎓
                                        </span>
                                        <span className="text-[10px] text-slate-600 mt-1 leading-tight">
                                            Se marcado, o aluno terá isenção total (100%) nas mensalidades.
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <div className="col-span-2 md:col-span-4">
                                <Input
                                    name="autorizacao_bolsa"
                                    value={formData.autorizacao_bolsa || ''}
                                    onChange={handleChange}
                                    label="Autorização de Desconto/Bolsa"
                                    placeholder="Nome de quem autorizou"
                                    className="border-slate-200 focus:ring-blue-950 bg-white"
                                />
                            </div>



                            {/* Financial Calculation Section */}
                            <div className={`col-span-2 md:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-gray-100 pt-4 mt-2 transition-opacity ${formData.isScholarship ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                                <Input
                                    label="Valor da Mensalidade (Integral)"
                                    value={baseTuition}
                                    onChange={handleBaseTuitionChange}
                                    onBlur={handleBaseTuitionBlur}
                                    placeholder="0,00"
                                    startIcon={<span className="text-slate-500 font-semibold">R$</span>}
                                    disabled={formData.isScholarship}
                                />
                                <Input
                                    name="bolsa_percentual"
                                    label="Desconto (%)"
                                    value={formData.bolsa_percentual || ''}
                                    onChange={handleDiscountChange}
                                    placeholder="0%"
                                    type="number"
                                    max="100"
                                    disabled={formData.isScholarship}
                                />
                                <Input
                                    label="Valor Final (Com Desconto)"
                                    value={typeof formData.valor_mensalidade === 'number'
                                        ? formData.valor_mensalidade.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                        : formData.valor_mensalidade || ''}
                                    onChange={handleFinalValueChange}
                                    onBlur={handleFinalValueBlur}
                                    placeholder="0,00"
                                    startIcon={<span className="text-slate-500 font-semibold">R$</span>}
                                    disabled={formData.isScholarship}
                                />
                                <Select
                                    label="Método de Pagamento"
                                    value={formData.metodo_pagamento || 'Interno'}
                                    onChange={(e) => handleSelectChange('metodo_pagamento', e.target.value)}
                                    options={PAYMENT_METHOD_OPTIONS}
                                    disabled={formData.isScholarship}
                                />
                            </div>


                            {/* --- TABELA DE ENTURMAÇÕES (HISTÓRICO) --- */}
                            <div className="col-span-full mt-8 border-t border-gray-100 pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                            📅 Enturmações por Ano Letivo
                                        </h3>
                                        <p className="text-xs text-gray-500">Histórico de passagens do aluno pela escola (Matrículas).</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddHistoryRow}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Adicionar Ano
                                    </button>
                                </div>

                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="px-3 py-2 font-bold text-gray-600 text-[11px] uppercase w-14 sm:w-20">Ano</th>
                                                <th className="px-3 py-2 font-bold text-gray-600 text-[11px] uppercase">Unidade</th>
                                                <th className="px-3 py-2 font-bold text-gray-600 text-[11px] uppercase min-w-[200px] sm:min-w-0">Série</th>
                                                <th className="px-3 py-2 font-bold text-gray-600 text-[11px] uppercase w-16">Turma</th>
                                                <th className="px-3 py-2 font-bold text-gray-600 text-[11px] uppercase">Turno</th>
                                                <th className="px-3 py-2 font-bold text-gray-600 text-[11px] uppercase">Status</th>
                                                <th className="px-3 py-2 font-bold text-gray-600 text-[11px] uppercase w-12 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(!formData.enrollmentHistory || formData.enrollmentHistory.length === 0) ? (
                                                <tr>
                                                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400 italic bg-gray-50/30">
                                                        Nenhum histórico de matrícula encontrado. <br />
                                                        <span className="text-[10px]">As matrículas são geradas automaticamente na rematrícula ou adicione acima.</span>
                                                    </td>
                                                </tr>
                                            ) : (
                                                formData.enrollmentHistory.map((row: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-2 py-1.5">
                                                            <input
                                                                type="text"
                                                                value={row.year}
                                                                onChange={(e) => handleUpdateHistoryRow(idx, 'year', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent focus:border-blue-300 focus:outline-none px-1 text-xs"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <select
                                                                value={row.unit}
                                                                onChange={(e) => handleUpdateHistoryRow(idx, 'unit', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent focus:border-blue-300 focus:outline-none px-1 text-xs appearance-none"
                                                            >
                                                                {Object.values(SchoolUnit).map(u => (
                                                                    <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <input
                                                                type="text"
                                                                value={row.gradeLevel}
                                                                onChange={(e) => handleUpdateHistoryRow(idx, 'gradeLevel', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent focus:border-blue-300 focus:outline-none px-1 text-xs"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <input
                                                                type="text"
                                                                value={row.schoolClass}
                                                                onChange={(e) => handleUpdateHistoryRow(idx, 'schoolClass', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent focus:border-blue-300 focus:outline-none px-1 text-xs text-center"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <select
                                                                value={row.shift}
                                                                onChange={(e) => handleUpdateHistoryRow(idx, 'shift', e.target.value)}
                                                                className="w-full bg-transparent border-b border-transparent focus:border-blue-300 focus:outline-none px-1 text-xs appearance-none"
                                                            >
                                                                {Object.values(SchoolShift).map(shift => (
                                                                    <option key={shift} value={shift}>{SHIFT_LABELS[shift]}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <select
                                                                value={row.status}
                                                                onChange={(e) => handleUpdateHistoryRow(idx, 'status', e.target.value)}
                                                                className={clsx(
                                                                    "w-full bg-transparent border-b border-transparent focus:border-blue-300 focus:outline-none px-1 text-[10px] font-bold appearance-none",
                                                                    row.status === 'APROVADO' ? 'text-blue-600' : row.status === 'REPROVADO' ? 'text-red-600' : 'text-slate-500'
                                                                )}
                                                            >
                                                                {STUDENT_STATUS_OPTIONS.map(opt => (
                                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveHistoryRow(idx)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    )}

                    {activeTab === 'family' && (
                        <div className="space-y-6">
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-3">
                                <Users className="w-4 h-4 text-orange-600 mt-1 flex-shrink-0" />
                                <p className="text-sm text-orange-900 leading-relaxed">
                                    <strong>Atenção:</strong> Esta aba é exclusiva para o <strong>Responsável Financeiro e Pedagógico</strong> (quem assina o contrato).
                                    Para dados do Pai e Mãe, use a aba <strong>Filiação</strong>.
                                </p>
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-950" />
                                    Responsável Financeiro/Pedagógico
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input key="resp-name-input" name="nome_responsavel" value={formData.nome_responsavel} onChange={handleChange} label="Nome do Responsável" placeholder="Nome completo do responsável" className="col-span-full md:col-span-2" />
                                    <Input name="cpf_responsavel" value={formData.cpf_responsavel} onChange={handleChange} label="CPF do Responsável" placeholder="000.000.000-00" className="col-span-full md:col-span-1" />
                                    <Input name="rg_responsavel" value={formData.rg_responsavel} onChange={handleChange} label="RG do Responsável" placeholder="Documento de identidade" className="col-span-full md:col-span-1" />
                                    <Input
                                        name="telefone_responsavel"
                                        value={formData.telefone_responsavel}
                                        onChange={handleChange}
                                        label="Telefone (WhatsApp)"
                                        placeholder="5584999999999"
                                        helperText="Apenas números (Ex: 5584...)"
                                        className="col-span-full md:col-span-1"
                                    />
                                    <Input name="email_responsavel" value={formData.email_responsavel} onChange={handleChange} label="E-mail" type="email" placeholder="email@exemplo.com" className="col-span-full md:col-span-1" />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'filiation' && (
                        <div className="space-y-6">
                            {/* Pai */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    👨 Pai
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Nome em linha separada - full width */}
                                    <Input name="nome_pai" value={formData.nome_pai} onChange={handleChange} label="Nome do Pai" className="col-span-full" />

                                    <Input name="pai_profissao" value={formData.pai_profissao} onChange={handleChange} label="Profissão" className="col-span-full md:col-span-2" />
                                    <Select
                                        label="Nacionalidade"
                                        value={formData.pai_nacionalidade}
                                        onChange={(e) => handleSelectChange('pai_nacionalidade', e.target.value)}
                                        options={[
                                            { label: 'Brasileira', value: 'Brasileira' },
                                            { label: 'Estrangeira', value: 'Estrangeira' }
                                        ]}
                                    />
                                    <Input name="pai_naturalidade" value={formData.pai_naturalidade} onChange={handleChange} label="Naturalidade" placeholder="Ex: Natal/RN" />

                                    <Input name="pai_telefone" value={formData.pai_telefone} onChange={handleChange} label="Telefone (Formato: 5584...)" placeholder="5584999999999" helperText="Máx 13 dígitos" className="col-span-full md:col-span-2" />
                                    <Input name="pai_renda_mensal" value={formData.pai_renda_mensal} onChange={handleChange} label="Renda Mensal" placeholder="R$ 0,00" className="col-span-full md:col-span-2" />

                                    <Input name="pai_local_trabalho" value={formData.pai_local_trabalho} onChange={handleChange} label="Endereço de Trabalho" className="col-span-full" placeholder="Empresa e endereço" />
                                </div>
                            </div>

                            {/* Mãe */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    👩 Mãe
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <Input name="nome_mae" value={formData.nome_mae} onChange={handleChange} label="Nome da Mãe" className="col-span-full" />

                                    <Input name="mae_profissao" value={formData.mae_profissao} onChange={handleChange} label="Profissão" className="col-span-full md:col-span-2" />
                                    <Select
                                        label="Nacionalidade"
                                        value={formData.mae_nacionalidade}
                                        onChange={(e) => handleSelectChange('mae_nacionalidade', e.target.value)}
                                        options={[
                                            { label: 'Brasileira', value: 'Brasileira' },
                                            { label: 'Estrangeira', value: 'Estrangeira' }
                                        ]}
                                    />
                                    <Input name="mae_naturalidade" value={formData.mae_naturalidade} onChange={handleChange} label="Naturalidade" placeholder="Ex: Natal/RN" />

                                    <Input name="mae_telefone" value={formData.mae_telefone} onChange={handleChange} label="Telefone (Formato: 5584...)" placeholder="5584999999999" helperText="Máx 13 dígitos" className="col-span-full md:col-span-2" />
                                    <Input name="mae_renda_mensal" value={formData.mae_renda_mensal} onChange={handleChange} label="Renda Mensal" placeholder="R$ 0,00" className="col-span-full md:col-span-2" />

                                    <Input name="mae_local_trabalho" value={formData.mae_local_trabalho} onChange={handleChange} label="Endereço de Trabalho" className="col-span-full" placeholder="Empresa e endereço" />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'address' && (
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <div className="col-span-full md:col-span-2">
                                <div className="flex gap-2">
                                    <Input name="cep" value={formData.cep} onChange={handleChange} label="CEP" placeholder="00000-000" className="flex-1" />
                                    <button
                                        type="button"
                                        onClick={handleCepSearch}
                                        disabled={loadingCep || !formData.cep}
                                        className="h-[40px] mt-[26px] px-4 bg-blue-950 text-white rounded-xl hover:bg-blue-900 transition-colors disabled:opacity-50 font-bold text-xs"
                                    >
                                        {loadingCep ? <span className="animate-spin truncate">...</span> : "Buscar"}
                                    </button>
                                </div>
                            </div>

                            <Input name="endereco_logradouro" value={formData.endereco_logradouro} onChange={handleChange} label="Logradouro" placeholder="Rua, Av..." className="col-span-full md:col-span-6" />

                            <Input name="endereco_numero" value={formData.endereco_numero} onChange={handleChange} label="Número" placeholder="123" className="col-span-full md:col-span-1" />
                            <Input name="endereco_complemento" value={formData.endereco_complemento} onChange={handleChange} label="Complemento" placeholder="Apto, Bloco..." className="col-span-full md:col-span-2" />
                            <Input name="endereco_bairro" value={formData.endereco_bairro} onChange={handleChange} label="Bairro" placeholder="Bairro" className="col-span-full md:col-span-3" />

                            <Input name="endereco_cidade" value={formData.endereco_cidade} onChange={handleChange} label="Cidade" placeholder="Natal" className="col-span-full md:col-span-3" />

                            <Select
                                label="UF"
                                value={formData.endereco_uf}
                                onChange={(e) => handleSelectChange('endereco_uf', e.target.value)}
                                options={[{ label: 'RN', value: 'RN' }, { label: 'PB', value: 'PB' }]}
                                className="col-span-full md:col-span-1"
                            />
                            <Select
                                label="Zona"
                                value={formData.localizacao_tipo}
                                onChange={(e) => handleSelectChange('localizacao_tipo', e.target.value)}
                                options={[{ label: 'Urbana', value: 'Urbana' }, { label: 'Rural', value: 'Rural' }]}
                                className="col-span-full md:col-span-2"
                            />
                        </div>
                    )}

                    {activeTab === 'health' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">

                            {/* 1. 🧠 Inclusão & Neurodiversidade */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Heart className="w-5 h-5 text-slate-600" />
                                    Inclusão & Neurodiversidade
                                </h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {['TEA (Autismo)', 'TDAH', 'Dislexia', 'Discalculia', 'TOD', 'Altas Habilidades', 'Síndrome de Down'].map(cond => (
                                            <Checkbox
                                                key={cond}
                                                label={cond}
                                                checked={formData.ficha_saude?.neurodiversidade?.includes(cond)}
                                                onChange={() => {
                                                    const current = formData.ficha_saude?.neurodiversidade || [];
                                                    const next = current.includes(cond)
                                                        ? current.filter((i: string) => i !== cond)
                                                        : [...current, cond];
                                                    setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, neurodiversidade: next } }));
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <Input
                                        label="Outras Condições / Detalhes"
                                        placeholder="Ex: Acompanhamento terapêutico..."
                                        value={formData.ficha_saude?.neurodiversidade_outra || ''}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, neurodiversidade_outra: e.target.value } }))}
                                    />

                                    <div className="flex gap-4 pt-2">
                                        {/* Upload do Laudo Médico */}
                                        <div className="flex-1 flex flex-col gap-2">
                                            <label className={`p-4 border-2 border-dashed ${formData.ficha_saude?.laudo_url ? 'border-green-300 bg-green-50' : 'border-slate-300 bg-white'} rounded-xl flex flex-col items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer group`}>
                                                <Upload className={`w-6 h-6 ${formData.ficha_saude?.laudo_url ? 'text-green-600' : 'text-slate-400'} group-hover:text-slate-600 mb-2`} />
                                                <span className="text-sm font-semibold text-slate-800">{formData.ficha_saude?.laudo_url ? 'Laudo Anexado ✅' : 'Upload do Laudo Médico'}</span>
                                                <span className="text-xs text-slate-500">PDF ou Imagem (Máx 5MB)</span>
                                                <input
                                                    type="file"
                                                    accept=".pdf,image/*"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            if (file.size > 5 * 1024 * 1024) {
                                                                alert('Arquivo muito grande! Máximo 5MB.');
                                                                return;
                                                            }
                                                            try {
                                                                setIsLoading(true);
                                                                const url = await storageService.uploadFile(file, `students/docs/${formData.code || 'temp'}/${file.name}`);
                                                                setFormData((prev: any) => ({
                                                                    ...prev,
                                                                    ficha_saude: { ...prev.ficha_saude, laudo_url: url }
                                                                }));
                                                                alert('Laudo anexado com sucesso!');
                                                            } catch (error) {
                                                                console.error(error);
                                                                alert('Erro ao fazer upload do arquivo.');
                                                            } finally {
                                                                setIsLoading(false);
                                                            }
                                                        }
                                                    }}

                                                />
                                            </label>
                                            {formData.ficha_saude?.laudo_url && (
                                                <div className="flex items-center justify-center gap-3 mt-1">
                                                    <a
                                                        href={formData.ficha_saude.laudo_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-center text-blue-600 hover:underline flex items-center gap-1"
                                                    >
                                                        <FileText className="w-3 h-3" /> Visualizar
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (confirm('Deseja remover este anexo?')) {
                                                                setFormData((prev: any) => ({
                                                                    ...prev,
                                                                    ficha_saude: { ...prev.ficha_saude, laudo_url: '' }
                                                                }));
                                                            }
                                                        }}
                                                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 hover:underline bg-transparent border-none p-0 cursor-pointer"
                                                        title="Remover anexo"
                                                    >
                                                        <Trash2 className="w-3 h-3" /> Remover
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Upload do PEI */}
                                        <div className="flex-1 flex flex-col gap-2">
                                            <label className={`p-4 border-2 border-dashed ${formData.ficha_saude?.pei_url ? 'border-green-300 bg-green-50' : 'border-slate-300 bg-white'} rounded-xl flex flex-col items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer group`}>
                                                <FileText className={`w-6 h-6 ${formData.ficha_saude?.pei_url ? 'text-green-600' : 'text-slate-400'} group-hover:text-slate-600 mb-2`} />
                                                <span className="text-sm font-semibold text-slate-800">{formData.ficha_saude?.pei_url ? 'PEI Anexado ✅' : 'Anexar PEI (Plano Indiv.)'}</span>
                                                <span className="text-xs text-slate-500">Documento Pedagógico</span>
                                                <input
                                                    type="file"
                                                    accept=".pdf,.doc,.docx"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            if (file.size > 5 * 1024 * 1024) {
                                                                alert('Arquivo muito grande! Máximo 5MB.');
                                                                return;
                                                            }
                                                            try {
                                                                setIsLoading(true);
                                                                const url = await storageService.uploadFile(file, `students/docs/${formData.code || 'temp'}/${file.name}`);
                                                                setFormData((prev: any) => ({
                                                                    ...prev,
                                                                    ficha_saude: { ...prev.ficha_saude, pei_url: url }
                                                                }));
                                                                alert('PEI anexado com sucesso!');
                                                            } catch (error) {
                                                                console.error(error);
                                                                alert('Erro ao fazer upload do arquivo.');
                                                            } finally {
                                                                setIsLoading(false);
                                                            }
                                                        }
                                                    }}
                                                />
                                            </label>
                                            {formData.ficha_saude?.pei_url && (
                                                <div className="flex items-center justify-center gap-3 mt-1">
                                                    <a
                                                        href={formData.ficha_saude.pei_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-center text-blue-600 hover:underline flex items-center gap-1"
                                                    >
                                                        <FileText className="w-3 h-3" /> Visualizar
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (confirm('Deseja remover este anexo?')) {
                                                                setFormData((prev: any) => ({
                                                                    ...prev,
                                                                    ficha_saude: { ...prev.ficha_saude, pei_url: '' }
                                                                }));
                                                            }
                                                        }}
                                                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 hover:underline bg-transparent border-none p-0 cursor-pointer"
                                                        title="Remover anexo"
                                                    >
                                                        <Trash2 className="w-3 h-3" /> Remover
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. 💉 Vacinação & Imunização */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-slate-600" />
                                    Vacinação & Imunização
                                </h3>
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
                                            <Checkbox
                                                label="Carteira de Vacinação em Dia"
                                                checked={formData.ficha_saude?.carteira_vacinacao_em_dia || false}
                                                onChange={() => setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, carteira_vacinacao_em_dia: !prev.ficha_saude?.carteira_vacinacao_em_dia } }))}
                                            />
                                        </div>
                                        <Input
                                            label="Vacinas Pendentes (Se houver)"
                                            placeholder="Ex: Falta a dose de reforço da..."
                                            value={formData.ficha_saude?.vacinas_pendentes || ''}
                                            onChange={(e) => setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, vacinas_pendentes: e.target.value } }))}
                                        />
                                    </div>
                                    <div className="w-full md:w-1/3 flex flex-col gap-2">
                                        <label className={`p-4 border-2 border-dashed ${formData.ficha_saude?.carteira_vacinacao_url ? 'border-green-300 bg-green-50' : 'border-slate-300 bg-white'} rounded-xl flex flex-col items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer text-center`}>
                                            <Camera className={`w-8 h-8 ${formData.ficha_saude?.carteira_vacinacao_url ? 'text-green-600' : 'text-slate-400'} mb-2`} />
                                            <span className="text-sm font-bold text-slate-800">{formData.ficha_saude?.carteira_vacinacao_url ? 'Carteira Anexada ✅' : 'Foto da Carteira'}</span>
                                            <span className="text-xs text-slate-500">Clique para enviar comprovante</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        if (file.size > 5 * 1024 * 1024) {
                                                            alert('Arquivo muito grande! Máximo 5MB.');
                                                            return;
                                                        }
                                                        try {
                                                            setIsLoading(true);
                                                            const url = await storageService.uploadFile(file, `students/docs/${formData.code || 'temp'}/${file.name}`);
                                                            setFormData((prev: any) => ({
                                                                ...prev,
                                                                ficha_saude: { ...prev.ficha_saude, carteira_vacinacao_url: url }
                                                            }));
                                                            alert('Carteira de Vacinação anexada com sucesso!');
                                                        } catch (error) {
                                                            console.error(error);
                                                            alert('Erro ao fazer upload da imagem.');
                                                        } finally {
                                                            setIsLoading(false);
                                                        }
                                                    }
                                                }}
                                            />
                                        </label>
                                        {formData.ficha_saude?.carteira_vacinacao_url && (
                                            <div className="flex items-center justify-center gap-3 mt-1">
                                                <a
                                                    href={formData.ficha_saude.carteira_vacinacao_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-center text-blue-600 hover:underline flex items-center gap-1"
                                                >
                                                    <Camera className="w-3 h-3" /> Visualizar
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (confirm('Deseja remover este anexo?')) {
                                                            setFormData((prev: any) => ({
                                                                ...prev,
                                                                ficha_saude: { ...prev.ficha_saude, carteira_vacinacao_url: '' }
                                                            }));
                                                        }
                                                    }}
                                                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 hover:underline bg-transparent border-none p-0 cursor-pointer"
                                                    title="Remover anexo"
                                                >
                                                    <Trash2 className="w-3 h-3" /> Remover
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 3. 💊 Medicamentos & Segurança */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <ShieldAlert className="w-5 h-5 text-slate-600" />
                                    Segurança & Medicamentos
                                </h3>
                                <div className="space-y-5">
                                    <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3">
                                        <Checkbox
                                            label=""
                                            checked={formData.ficha_saude?.autorizacao_medicacao || false}
                                            onChange={() => setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, autorizacao_medicacao: !prev.ficha_saude?.autorizacao_medicacao } }))}
                                        />
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">Autorização para Termorregulação</p>
                                            <p className="text-xs text-slate-600 mt-1">
                                                Autorizo a escola a ministrar antitérmico simples (Dipirona/Paracetamol) exclusivamente em caso de
                                                <strong> febre comprovada acima de 38ºC</strong>, enquanto aguardo a chegada dos responsáveis.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Alergias Medicamentosas (CRÍTICO ⚠️)"
                                            placeholder="Ex: ALERGIA A DIPIRONA / PENICILINA"
                                            value={formData.ficha_saude?.alergias_medicamentosas || ''}
                                            onChange={(e) => setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, alergias_medicamentosas: e.target.value } }))}
                                        />
                                        <Input
                                            label="Uso Contínuo (Horário escolar)"
                                            placeholder="Ex: Ritalina 10mg às 14h"
                                            value={formData.ficha_saude?.medicamentos_continuos || ''}
                                            onChange={(e) => setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, medicamentos_continuos: e.target.value } }))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 4. 🍎 Nutrição */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    🍎 Restrições Alimentares (Cantina)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Alergias Alimentares"
                                        placeholder="Ex: Amendoim, Camarão, Corante vermelho"
                                        value={formData.ficha_saude?.restricoes_alimentares || ''}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, restricoes_alimentares: e.target.value } }))}
                                    />
                                    <div className="flex flex-wrap gap-2 pt-6">
                                        {['Intolerância a Lactose', 'Doença Celíaca (Glúten)', 'Diabético', 'Vegetariano'].map(item => (
                                            <div key={item}
                                                onClick={() => {
                                                    const current = formData.ficha_saude?.intolerancias || [];
                                                    const next = current.includes(item) ? current.filter((i: string) => i !== item) : [...current, item];
                                                    setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, intolerancias: next } }));
                                                }}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors border ${formData.ficha_saude?.intolerancias?.includes(item) ? 'bg-slate-700 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                                            >
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 5. 🚑 Emergência & Contatos */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    🚑 Plano de Emergência
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Hospital de Preferência"
                                        placeholder="Ex: Hospital Infantil Varela Santiago"
                                        value={formData.ficha_saude?.hospital_preferencia || ''}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, hospital_preferencia: e.target.value } }))}
                                    />
                                    <Input
                                        label="Médico(a) Particular"
                                        placeholder="Nome do Pediatra"
                                        value={formData.ficha_saude?.medico_particular || ''}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, medico_particular: e.target.value } }))}
                                    />
                                    <Input
                                        label="Telefone do Médico"
                                        value={formData.ficha_saude?.medico_telefone || ''}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, medico_telefone: e.target.value } }))}
                                    />
                                    <Input
                                        label="Nome Contato Emergência (Além dos pais)"
                                        value={formData.ficha_saude?.contato_emergencia_nome || ''}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, contato_emergencia_nome: e.target.value } }))}
                                    />
                                    <Input
                                        label="Telefone/WhatsApp Emergência"
                                        value={formData.ficha_saude?.contato_emergencia_fone || ''}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, ficha_saude: { ...prev.ficha_saude, contato_emergencia_fone: e.target.value } }))}
                                    />
                                </div>
                            </div>
                        </div>
                    )}


                    {activeTab === 'documents' && (
                        <div className="space-y-6">
                            <div className="bg-blue-950/5 border border-blue-950/10 rounded-xl p-4 mb-2">
                                <h3 className="text-sm font-semibold text-blue-950 mb-1">Checklist de Documentos ✅</h3>
                                <p className="text-xs text-blue-950/80">
                                    Marque os documentos que já foram entregues fisicamente na secretaria.
                                </p>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                                    {STUDENT_DOCUMENTS_CHECKLIST.map(doc => (
                                        <Checkbox
                                            key={doc}
                                            label={doc}
                                            checked={formData.documentos_entregues?.includes(doc)}
                                            onChange={() => {
                                                setFormData((prev: any) => {
                                                    const current = prev.documentos_entregues || [];
                                                    const next = current.includes(doc)
                                                        ? current.filter((i: string) => i !== doc)
                                                        : [...current, doc];
                                                    return { ...prev, documentos_entregues: next };
                                                });
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <p className="text-xs text-slate-500 italic">
                                    ⚠️ Para documentos digitalizados, utilize a aba "Acadêmico" ou procure o campo específico se disponível. Esta aba foca no controle de entrega física.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'observations' && (
                        <div className="space-y-4">
                            <div className="bg-blue-950/5 border border-blue-950/10 rounded-xl p-4 mb-4">
                                <h3 className="text-sm font-semibold text-blue-950 mb-1">Anotações Gerais</h3>
                                <p className="text-xs text-blue-950/80">
                                    Utilize este espaço para registrar informações importantes que não se enquadram nos outros campos.
                                    Ex: Restrições alimentares, autorizações de saída, histórico de comportamento, etc.
                                </p>
                            </div>
                            <textarea
                                name="observacoes_gerais"
                                value={formData.observacoes_gerais || ''}
                                onChange={(e) => setFormData((prev: any) => ({ ...prev, observacoes_gerais: e.target.value }))}
                                className="w-full h-64 p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-950 focus:border-transparent resize-none text-sm leading-relaxed"
                                placeholder="Digite aqui as observações sobre o aluno..."
                            />
                        </div>
                    )}
                </div>
                {/* Footer */}
                <div className="p-4 sm:p-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-4 sm:gap-2 bg-white flex-shrink-0 z-10">
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        {student && (
                            <Button
                                variant="outline"
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="cursor-pointer flex items-center justify-center gap-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors w-full sm:w-auto whitespace-nowrap px-4 sm:px-3 sm:text-xs"
                                title="Excluir Matrícula Permanentemente"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span className="inline">Excluir Aluno</span>
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => onClose()} className="cursor-pointer w-full sm:w-auto justify-center whitespace-nowrap px-4 sm:px-3 sm:text-xs">
                            Cancelar
                        </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 w-full sm:w-auto items-center justify-end overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
                        {/* Group Print Actions - 2 Col Grid on Mobile */}
                        <div className="grid grid-cols-2 gap-2 w-full sm:contents">
                            <Button
                                variant="outline"
                                onClick={handlePrint}
                                className="cursor-pointer flex-1 sm:flex-none items-center justify-center gap-2 border-blue-950/20 text-blue-950 hover:bg-blue-950/5 whitespace-nowrap px-3 sm:px-3 sm:text-xs"
                                title="Imprimir Ficha"
                            >
                                <Printer className="w-4 h-4" />
                                <span className="sm:hidden">Ficha</span>
                                <span className="hidden sm:inline">Imprimir Ficha</span>
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handlePrintBlank}
                                className="cursor-pointer flex-1 sm:flex-none items-center justify-center gap-2 border-slate-200 text-slate-700 hover:bg-slate-50 whitespace-nowrap px-3 sm:px-3 sm:text-xs"
                                title="Ficha em Branco"
                            >
                                <Printer className="w-4 h-4" />
                                <span className="sm:hidden">Em Branco</span>
                                <span className="hidden sm:inline">Ficha em Branco</span>
                            </Button>
                        </div>

                        {/* Group Financial Actions - 2 Col Grid on Mobile */}
                        <div className="grid grid-cols-2 gap-2 w-full sm:contents">
                            <Button
                                variant="outline"
                                onClick={handleGenerateBoletos}
                                disabled={isGeneratingBoleto || !student?.id || isLoading}
                                className="cursor-pointer flex-1 sm:flex-none items-center justify-center gap-2 border-blue-900/30 text-blue-900 font-bold hover:bg-blue-50 whitespace-nowrap px-3 sm:px-3 sm:text-xs"
                                title="Gerar Boletos"
                            >
                                {isGeneratingBoleto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Barcode className="w-4 h-4" />}
                                <span className="sm:hidden">Boletos</span>
                                <span className="hidden sm:inline">Gerar Boletos</span>
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleGenerateCarne}
                                disabled={isLoading || !student?.id}
                                className="cursor-pointer flex-1 sm:flex-none items-center justify-center gap-2 border-orange-600 text-orange-600 font-bold hover:bg-orange-50 whitespace-nowrap px-3 sm:px-3 sm:text-xs"
                                title="Gerar Carnê"
                            >
                                <FileText className="w-4 h-4" />
                                <span className="sm:hidden">Carnê</span>
                                <span className="hidden sm:inline">Gerar Carnê</span>
                            </Button>
                        </div>

                        <Button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="cursor-pointer w-full sm:w-auto flex items-center justify-center gap-2 whitespace-nowrap px-6 sm:px-5 sm:text-xs font-bold"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {student ? 'Salvar' : 'Cadastrar'}
                        </Button>
                    </div>
                </div>

                {/* Hidden Print Template */}
                <div className="hidden print:block fixed inset-0 z-[100] bg-white">
                    <StudentEnrollmentPrint
                        student={{
                            ...formData,
                            // Ensure we use the saved ficha_saude if it exists in the original student object
                            // Ensure we use the latest ficha_saude from form state for WYSIWYG printing
                            ficha_saude: {
                                ...student?.ficha_saude,
                                ...formData.ficha_saude
                            }
                        }}
                        unitDetail={getUnitById(formData.unit || '')}
                        isBlank={printBlank}
                    />
                </div>
                <PhotoCaptureModal
                    isOpen={isCameraOpen}
                    onClose={() => setIsCameraOpen(false)}
                    onCapture={(base64) => setFormData((prev: any) => ({ ...prev, photoUrl: base64 }))}
                />

                {/* Image Cropper Modal */}
                <ImageCropperModal
                    isOpen={isCropperOpen}
                    imageSrc={rawPhoto}
                    onClose={() => {
                        setIsCropperOpen(false);
                        setRawPhoto(null);
                    }}
                    onCropComplete={handleCropComplete}
                />

                {/* Configuração de Carnê Modal */}
                <Modal
                    isOpen={isCarneConfigOpen}
                    onClose={() => setIsCarneConfigOpen(false)}
                    title="Configurar Geração de Carnê"
                    maxWidth="max-w-md"
                >
                    <div className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Valor Atual da Mensalidade</p>
                                <p className="text-xl font-black text-blue-950">R$ {
                                    typeof formData.valor_mensalidade === 'number'
                                        ? formData.valor_mensalidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                                        : formData.valor_mensalidade || '0,00'
                                }</p>
                            </div>
                            <FileText className="w-8 h-8 text-blue-200" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ano Letivo</label>
                                <Input
                                    type="number"
                                    value={carneConfig.year}
                                    onChange={(e) => setCarneConfig({ ...carneConfig, year: parseInt(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Mês Inicial</label>
                                <Select
                                    value={carneConfig.startMonth}
                                    onChange={(e) => setCarneConfig({ ...carneConfig, startMonth: e.target.value })}
                                    options={MONTHS.map(m => ({ label: m.label, value: m.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Mês Final</label>
                                <Select
                                    value={carneConfig.endMonth}
                                    onChange={(e) => setCarneConfig({ ...carneConfig, endMonth: e.target.value })}
                                    options={MONTHS.map(m => ({ label: m.label, value: m.value }))}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <input
                                type="checkbox"
                                id="withBoletos"
                                checked={carneConfig.withBoletos}
                                onChange={(e) => setCarneConfig({ ...carneConfig, withBoletos: e.target.checked })}
                                className="w-4 h-4 text-blue-950 rounded border-gray-300 focus:ring-blue-900 cursor-pointer"
                            />
                            <label htmlFor="withBoletos" className="text-sm font-medium text-blue-950 cursor-pointer select-none">
                                Gerar Boletos Digitais Automaticamente (Mercado Pago)
                            </label>
                        </div>

                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                            <p className="text-[10px] text-amber-700 leading-tight">
                                <strong>Nota:</strong> Ao confirmar, as parcelas serão criadas/atualizadas no banco de dados e aparecerão no Financeiro do App do Aluno.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setIsCarneConfigOpen(false)}>Cancelar</Button>
                            <Button
                                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                                onClick={handleConfirmGenerateCarne}
                                isLoading={isLoading}
                            >
                                Confirmar e Gerar
                            </Button>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
}
