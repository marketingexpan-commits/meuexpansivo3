
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { Modal } from '../components/Modal';
import {
    Search,
    CheckCircle2,
    Clock,
    Download,
    ScrollText,
    Loader2,
    Calendar,
    Plus,
    Trash2,
    MessageCircle,
    ChevronRight,
    Wallet,
    ArrowUpCircle,
    Landmark,
    PieChart as PieChartIcon,
    BarChart as BarChartIcon,
    Barcode,
    Layers,
    Users,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { financialService } from '../services/financialService';
import { studentService } from '../services/studentService';
import { generateReceipt } from '../utils/receiptGenerator';
import { useSchoolUnits } from '../hooks/useSchoolUnits';
import type { Student, Expense, Mensalidade, EventoFinanceiro } from '../types';

interface EnrichedMensalidade {
    id: string;
    studentId: string;
    month: string;
    value: number;
    status: string;
    studentName: string;
    studentCode: string;
    studentGrade: string;
    studentClass: string;
    studentShift: string;
    studentUnit: string;
    studentResponsibleName: string;
    studentCPF: string;
    studentPhone: string;
    paymentDate?: string;
    dueDate: string;
    // Campos estendidos para baixa
    documentNumber?: string;
    paidValue?: number;
    interestValue?: number;
    penaltyValue?: number;
    barcode?: string;
    ticketUrl?: string;
    receiptId?: string;
}

interface EnrichedEvento extends EventoFinanceiro {
    studentName: string;
    studentCode: string;
    studentGrade: string;
    studentClass: string;
    studentShift: string;
    studentUnit: string;
}

export function Financeiro() {
    const location = useLocation();

    const [activeTab, setActiveTab] = useState<'recebimentos' | 'pagamentos' | 'fluxo' | 'eventos'>('recebimentos');

    // Sincronizar URL com a aba ativa
    useEffect(() => {
        if (location.pathname.includes('/receitas')) {
            setActiveTab('recebimentos');
        } else if (location.pathname.includes('/pagamentos')) {
            setActiveTab('pagamentos');
        } else if (location.pathname.includes('/fluxo')) {
            setActiveTab('fluxo');
        } else if (location.pathname.includes('/eventos')) {
            setActiveTab('eventos');
        }
    }, [location.pathname]);
    const [isLoading, setIsLoading] = useState(true);
    const [mensalidades, setMensalidades] = useState<EnrichedMensalidade[]>([]);
    const [eventos, setEventos] = useState<EnrichedEvento[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const { getUnitById } = useSchoolUnits();

    // Filtros
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [filterMonth, setFilterMonth] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    // Modais
    const [isGenerating, setIsGenerating] = useState(false);


    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [newExpense, setNewExpense] = useState<Partial<Expense>>({
        description: '',
        category: 'Outros',
        value: 0,
        dueDate: new Date().toISOString().split('T')[0],
        status: 'Pendente'
    });

    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [newEvent, setNewEvent] = useState({
        description: '',
        value: 0,
        dueDate: new Date().toISOString().split('T')[0],
        type: 'Evento' as 'Evento' | 'Extra'
    });

    const [eventTarget, setEventTarget] = useState({
        unit: 'all',
        segment: 'all',
        grade: 'all',
        schoolClass: 'all',
        studentId: 'all'
    });

    // Auto-select unit based on user login
    useEffect(() => {
        const userUnit = localStorage.getItem('userUnit');
        const unitMapping: Record<string, string> = {
            'unit_zn': 'Zona Norte',
            'unit_ext': 'Extremoz',
            'unit_qui': 'Quintas',
            'unit_bs': 'Boa Sorte'
        };

        if (userUnit && userUnit !== 'admin_geral' && unitMapping[userUnit]) {
            setEventTarget(prev => ({ ...prev, unit: unitMapping[userUnit] }));
        }
    }, [isEventModalOpen]);

    const [isCreatingEvent, setIsCreatingEvent] = useState(false);

    // Mapeamento de Séries por Segmento
    const segmentGrades: Record<string, string[]> = {
        'Educação Infantil': ['Berçário', 'Nível I', 'Nível II', 'Nível III', 'Nível IV', 'Nível V'],
        'Fundamental I': ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'],
        'Fundamental II': ['6º Ano', '7º Ano', '8º Ano', '9º Ano'],
        'Ensino Médio': ['1ª Série', '2ª Série', '3ª Série']
    };

    // Helpers de Ordenação
    const getGradeWeight = (grade: string) => {
        const normalized = grade.toLowerCase();
        // Check order strictly to avoid substring overlaps (e.g., 'i' is inside 'ii', 'iii', 'iv')
        if (normalized.includes('berçário')) return 0;
        if (normalized.includes('nível v')) return 5;
        if (normalized.includes('nível iv')) return 4;
        if (normalized.includes('nível iii')) return 3;
        if (normalized.includes('nível ii')) return 2;
        if (normalized.includes('nível i')) return 1;

        if (normalized.includes('1º ano')) return 11;
        if (normalized.includes('2º ano')) return 12;
        if (normalized.includes('3º ano')) return 13;
        if (normalized.includes('4º ano')) return 14;
        if (normalized.includes('5º ano')) return 15;
        if (normalized.includes('6º ano')) return 16;
        if (normalized.includes('7º ano')) return 17;
        if (normalized.includes('8º ano')) return 18;
        if (normalized.includes('9º ano')) return 19;

        if (normalized.includes('1ª série')) return 21;
        if (normalized.includes('2ª série')) return 22;
        if (normalized.includes('3ª série')) return 23;

        return 99;
    };

    const getSegmentWeight = (segment: string) => {
        const normalized = segment.toLowerCase();
        if (normalized.includes('infantil')) return 1;
        if (normalized.includes('fundamental i') && !normalized.includes('ii')) return 2;
        if (normalized.includes('fundamental ii')) return 3;
        if (normalized.includes('médio')) return 4;
        return 99;
    };

    const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
    const [installmentParams, setInstallmentParams] = useState({
        studentId: '',
        year: new Date().getFullYear().toString(),
        startMonth: '1',
        endMonth: '12',
        value: '',
        withBoletos: false
    });

    const [summary, setSummary] = useState({
        total: 0,
        paid: 0,
        pending: 0,
        overdue: 0,
        paidValue: 0,
        totalValue: 0
    });

    const [expenseSummary, setExpenseSummary] = useState({
        total: 0,
        paid: 0,
        pending: 0,
        totalValue: 0,
        paidValue: 0
    });

    // Estado do Modal de Baixa Manual
    const [isDischargeModalOpen, setIsDischargeModalOpen] = useState(false);
    const [dischargeCode, setDischargeCode] = useState('');
    const [foundInstallment, setFoundInstallment] = useState<any>(null);
    const [dischargeDetails, setDischargeDetails] = useState({
        paymentDate: new Date().toISOString().split('T')[0],
        valueOriginal: 0,
        valuePenalty: 0,
        valueInterest: 0,
        valueTotal: 0
    });
    const [isSearchingCode, setIsSearchingCode] = useState(false);


    const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const loadData = async () => {
        setIsLoading(true);
        try {
            const userUnit = localStorage.getItem('userUnit');
            let unitFilter: string | null = null;

            const unitMapping: Record<string, string> = {
                'unit_zn': 'Zona Norte',
                'unit_ext': 'Extremoz',
                'unit_qui': 'Quintas',
                'unit_bs': 'Boa Sorte'
            };

            if (userUnit && userUnit !== 'admin_geral') {
                unitFilter = unitMapping[userUnit];
            }

            // 1. Carregar Dados baseados na aba ativa
            const promises: Promise<any>[] = [
                studentService.getStudents(unitFilter)
            ];

            // Mensalidades
            if (activeTab === 'recebimentos' || activeTab === 'fluxo') {
                promises.push(financialService.getMensalidades({
                    unit: unitFilter,
                    status: filterStatus !== 'Todos' ? filterStatus : undefined,
                    month: selectedStudentId ? undefined : (filterMonth !== '' ? `${months[parseInt(filterMonth)]}/${new Date().getFullYear()}` : undefined),
                    studentId: selectedStudentId || undefined
                }));
            } else {
                promises.push(Promise.resolve([]));
            }

            // Despesas
            if (activeTab === 'pagamentos' || activeTab === 'fluxo') {
                promises.push(financialService.getExpenses({
                    unit: unitFilter,
                    status: filterStatus !== 'Todos' ? filterStatus : undefined
                }));
            } else {
                promises.push(Promise.resolve([]));
            }

            // Eventos
            if (activeTab === 'eventos' || activeTab === 'fluxo') {
                promises.push(financialService.getEventos({
                    unit: unitFilter,
                    status: filterStatus !== 'Todos' ? filterStatus : undefined,
                    studentId: selectedStudentId || undefined
                }));
            } else {
                promises.push(Promise.resolve([]));
            }

            const results = await Promise.all(promises) as any[];
            const studentsData = results[0];
            const mensalidadesData = results[1] as any[] || [];
            const expensesData = results[2] as any[] || [];
            const eventosData = results[3] as any[] || [];

            setStudents(studentsData);

            // Mapear Alunos
            const studentsMap = new Map<string, Student>();
            studentsData.forEach((s: Student) => studentsMap.set(s.id, s));

            // 2. Processar Mensalidades
            if (mensalidadesData) {
                const enrichedData: EnrichedMensalidade[] = mensalidadesData.map((m: any) => ({
                    ...m,
                    studentName: studentsMap.get(m.studentId)?.name || 'Aluno Removido',
                    studentCode: studentsMap.get(m.studentId)?.code || '-',
                    studentGrade: studentsMap.get(m.studentId)?.gradeLevel || '-',
                    studentClass: studentsMap.get(m.studentId)?.schoolClass || '-',
                    studentShift: studentsMap.get(m.studentId)?.shift || '-',
                    studentUnit: studentsMap.get(m.studentId)?.unit || '-',
                    studentResponsibleName: studentsMap.get(m.studentId)?.nome_responsavel || '-',
                    studentCPF: studentsMap.get(m.studentId)?.cpf_responsavel || studentsMap.get(m.studentId)?.cpf_aluno || '-',
                    studentPhone: studentsMap.get(m.studentId)?.telefone_responsavel || studentsMap.get(m.studentId)?.phoneNumber || '',
                    receiptId: m.receiptId
                }));

                // Mapeador auxiliar para ordenação cronológica
                const getSortValue = (monthStr: string) => {
                    const [m, y] = monthStr.split('/');
                    const monthIdx = months.indexOf(m);
                    const year = parseInt(y) || 0;
                    return (year * 12) + monthIdx;
                };

                enrichedData.sort((a: EnrichedMensalidade, b: EnrichedMensalidade) => {
                    // Se estivermos vendo um aluno específico, a prioridade é a data
                    if (selectedStudentId) {
                        return getSortValue(a.month) - getSortValue(b.month);
                    }
                    // Se estivermos na visão geral, prioridade é Nome -> Ano -> Mês
                    const nameSort = a.studentName.localeCompare(b.studentName);
                    if (nameSort !== 0) return nameSort;
                    return getSortValue(a.month) - getSortValue(b.month);
                });

                setMensalidades(enrichedData);
                // Calcular vencidos (status != Pago E dueDate < hoje)
                const today = new Date().toISOString().split('T')[0];
                const overdueCount = enrichedData.filter((m: EnrichedMensalidade) =>
                    m.status !== 'Pago' && m.dueDate < today
                ).length;

                setSummary({
                    total: enrichedData.length,
                    paid: enrichedData.filter((m: EnrichedMensalidade) => m.status === 'Pago').length,
                    pending: enrichedData.filter((m: EnrichedMensalidade) => m.status !== 'Pago').length,
                    overdue: overdueCount,
                    paidValue: enrichedData.filter((m: EnrichedMensalidade) => m.status === 'Pago').reduce((acc: number, curr: EnrichedMensalidade) => acc + (curr.value || 0), 0),
                    totalValue: enrichedData.reduce((acc: number, curr: EnrichedMensalidade) => acc + (curr.value || 0), 0)
                });
            }

            // 3. Processar Eventos
            if (eventosData) {
                const enrichedEventos: EnrichedEvento[] = eventosData.map((e: any) => ({
                    ...e,
                    studentName: studentsMap.get(e.studentId)?.name || 'Aluno Removido',
                    studentCode: studentsMap.get(e.studentId)?.code || '-',
                    studentGrade: studentsMap.get(e.studentId)?.gradeLevel || '-',
                    studentClass: studentsMap.get(e.studentId)?.schoolClass || '-',
                    studentShift: studentsMap.get(e.studentId)?.shift || '-',
                    studentUnit: studentsMap.get(e.studentId)?.unit || '-',
                }));

                enrichedEventos.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
                setEventos(enrichedEventos);
            }

            // 3. Processar Despesas
            if (expensesData) {
                setExpenses(expensesData);
                setExpenseSummary({
                    total: expensesData.length,
                    paid: expensesData.filter((e: Expense) => e.status === 'Pago').length,
                    pending: expensesData.filter((e: Expense) => e.status !== 'Pago').length,
                    totalValue: expensesData.reduce((acc: number, curr: Expense) => acc + (curr.value || 0), 0),
                    paidValue: expensesData.filter((e: Expense) => e.status === 'Pago').reduce((acc: number, curr: Expense) => acc + (curr.value || 0), 0)
                });
            }

        } catch (error) {
            console.error("Erro ao carregar dados financeiros:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const resetFilters = () => {
        setFilterStatus('Todos');
        setFilterMonth('');
        setSearchTerm('');
        setSelectedStudentId(null);
    };

    useEffect(() => {
        loadData();
    }, [filterStatus, filterMonth, selectedStudentId, activeTab]);

    const handleMarkAsPaid = async (id: string) => {
        const item = mensalidades.find(m => m.id === id);
        if (!item) return;

        // Converter Mensalidade para EnrichedMensalidade (ou tratar tipos compatíveis)
        // Aqui assumimos que os campos básicos batem, mas enriquecemos com dados faltantes se necessário
        // Na listagem já temos dados de estudante achatados na query? Sim.

        // Vamos popular o foundInstallment e abrir o modal
        const enrichedItem = item as any; // Cast rápido pois a tabela já tem os dados necessários

        setFoundInstallment(enrichedItem);
        setDischargeCode(item.documentNumber || '');
        setIsDischargeModalOpen(true);
        setIsSearchingCode(false);

        // Disparar calculo inicial com data de hoje
        const today = new Date().toISOString().split('T')[0];
        setDischargeDetails({
            paymentDate: today,
            valueOriginal: item.value,
            valueInterest: 0,
            valuePenalty: 0,
            valueTotal: item.value
        });

        recalculateValues(enrichedItem, today);
    };

    const handleDeleteFee = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta mensalidade?")) return;
        try {
            await financialService.deleteFee(id);
            alert("Mensalidade removida com sucesso.");
            loadData();
        } catch (error) {
            alert("Erro ao remover mensalidade.");
        }
    };

    const handleExportFinancials = () => {
        let csvContent = "data:text/csv;charset=utf-8,";

        if (activeTab === 'recebimentos') {
            csvContent += "Código,Aluno,Série,Mês,Valor,Status\n";
            filteredMensalidades.forEach(m => {
                csvContent += `${m.studentCode},${m.studentName},${m.studentGrade},${m.month},${m.value},${m.status}\n`;
            });
        } else if (activeTab === 'pagamentos') {
            csvContent += "Descrição,Categoria,Vencimento,Valor,Status\n";
            expenses.forEach(e => {
                csvContent += `${e.description},${e.category},${e.dueDate},${e.value},${e.status}\n`;
            });
        } else {
            return alert("Escolha uma aba de dados para exportar.");
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `financeiro_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };





    const handleGenerateInstallments = async () => {
        if (!installmentParams.studentId && !confirm("Nenhum aluno selecionado. Isso vai gerar parcelas para TODOS os alunos da lista atual. Deseja continuar?")) {
            return;
        }

        try {
            setIsGenerating(true);

            // Se tiver aluno selecionado, gera só pra ele
            const targetStudents = installmentParams.studentId
                ? [students.find(s => s.id === installmentParams.studentId)!]
                : students; // Usa a lista filtrada/carregada atual

            let totalGenerated = 0;

            for (const student of targetStudents) {
                if (!student) continue;

                const count = await financialService.generateInstallments(
                    student.id,
                    parseInt(installmentParams.startMonth),
                    parseInt(installmentParams.endMonth),
                    parseInt(installmentParams.year),
                    installmentParams.value ? parseFloat(installmentParams.value) : undefined,
                    installmentParams.withBoletos
                );
                totalGenerated += count;
            }

            alert(`${totalGenerated} parcelas geradas com sucesso para ${targetStudents.length} aluno(s)!`);
            setIsInstallmentModalOpen(false);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Erro ao gerar parcelamento.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateBoletos = async () => {
        if (!selectedStudentId) return alert("Selecione um aluno na busca individual para gerar boletos.");

        const student = students.find(s => s.id === selectedStudentId);
        if (!student) return alert("Aluno não encontrado.");

        const pendingInstallments = mensalidades.filter(m => m.studentId === selectedStudentId && m.status !== 'Pago' && !m.barcode);

        if (pendingInstallments.length === 0) return alert("Este aluno não possui mensalidades pendentes sem boleto.");

        if (!confirm(`Deseja gerar boletos para ${pendingInstallments.length} mensalidades pendentes de ${student.name}?`)) return;

        try {
            setIsGenerating(true);
            let generatedCount = 0;

            for (const inst of pendingInstallments) {
                // Payer Data
                const payer = {
                    email: student.email_responsavel || 'email@padrao.com',
                    firstName: (student.nome_responsavel || student.name).split(' ')[0],
                    lastName: (student.nome_responsavel || student.name).split(' ').slice(1).join(' ') || 'Responsável',
                    cpf: student.cpf_responsavel || student.cpf_aluno || '00000000000',
                    address: {
                        zipCode: (student.cep || '').replace(/\D/g, '') || '59000000',
                        streetName: student.endereco_logradouro || 'Endereço não informado',
                        streetNumber: student.endereco_numero || 'S/N',
                        neighborhood: student.endereco_bairro || 'Bairro',
                        city: student.endereco_cidade || 'Natal',
                        state: student.endereco_uf || 'RN'
                    }
                };

                const boletoData = await financialService.generateBoleto({
                    studentId: student.id,
                    amount: inst.value,
                    dueDate: new Date(inst.dueDate).toISOString(),
                    description: `Mensalidade ${inst.month} - ${student.name}`,
                    payer: payer
                });

                // Atualizar parcela com dados do boleto
                await financialService.updateInstallment(inst.id, {
                    barcode: boletoData.barcode,
                    digitableLine: boletoData.digitableLine,
                    mpPaymentId: boletoData.id,
                    ticketUrl: boletoData.ticketUrl,
                    qrCode: boletoData.qrCode,
                    qrCodeBase64: boletoData.qrCodeBase64
                });

                generatedCount++;
            }

            alert(`${generatedCount} boletos gerados com sucesso!`);
            loadData(); // Recarregar para mostrar os códigos
        } catch (error) {
            console.error("Erro ao gerar boletos:", error);
            alert("Erro ao gerar boletos. Verifique o console.");
        } finally {
            setIsGenerating(false);
        }
    };

    const sendWhatsAppMessage = (m: EnrichedMensalidade) => {
        if (!m.studentPhone) return alert("Responsável sem telefone cadastrado.");

        const message = `Olá! 👋 Gostariamos de lembrar que a mensalidade de *${m.month}* referente ao aluno(a) *${m.studentName}* no valor de *R$ ${m.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}* está pendente em nosso sistema Meu Expansivo. Caso o pagamento já tenha sido efetuado, por favor desconsidere esta mensagem. Obrigado!`;

        const cleanPhone = m.studentPhone.replace(/\D/g, "");
        const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

        window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, "_blank");
    };

    const filteredMensalidades = mensalidades.filter(m =>
        m.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.studentCode.includes(searchTerm)
    );

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.includes(searchTerm)
    ).slice(0, 5);

    const eligibleForBoletos = selectedStudentId
        ? mensalidades.filter(m => m.studentId === selectedStudentId && m.status !== 'Pago' && !m.barcode).length
        : 0;

    // Dados para Gráficos
    const chartData = months.map((m, i) => {
        const monthYear = `${m}/${new Date().getFullYear()}`;
        const revenue = mensalidades
            .filter(item => item.month === monthYear && item.status === 'Pago')
            .reduce((acc: number, curr: { value?: number }) => acc + (curr.value || 0), 0);

        const expense = expenses
            .filter(item => {
                const date = new Date(item.dueDate);
                return date.getMonth() === i && item.status === 'Pago';
            })
            .reduce((acc: number, curr: Expense) => acc + (curr.value || 0), 0);

        return {
            name: m.substring(0, 3),
            receita: revenue,
            despesa: expense
        };
    }).filter(item => item.receita > 0 || item.despesa > 0);

    const categoryData = expenses
        .filter(e => e.status === 'Pago')
        .reduce((acc: { name: string; value: number }[], curr) => {
            const existing = acc.find(item => item.name === curr.category);
            if (existing) {
                existing.value += curr.value;
            } else {
                acc.push({ name: curr.category, value: curr.value });
            }
            return acc;
        }, []);



    const handleSearchByCode = async () => {
        if (!dischargeCode) return;
        setIsSearchingCode(true);
        try {
            const result = await financialService.findInstallmentByDocumentNumber(dischargeCode);
            if (result) {
                let sName = 'Aluno não encontrado';
                const s = students.find(st => st.id === result.studentId);
                if (s) sName = s.name;
                else {
                    const fetchedStudents = await studentService.getStudents(null);
                    const found = fetchedStudents.find((fs: Student) => fs.id === result.studentId);
                    if (found) sName = found.name;
                }

                const enriched = {
                    ...result,
                    studentName: sName,
                    studentCode: '-', studentGrade: '-', studentClass: '-', studentShift: '-', studentUnit: '-', studentResponsibleName: '-', studentCPF: '-', studentPhone: '-'
                } as EnrichedMensalidade;

                setFoundInstallment(enriched);
                recalculateValues(enriched, dischargeDetails.paymentDate);
            } else {
                alert("Nenhum documento encontrado com este código.");
                setFoundInstallment(null);
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao buscar documento.");
        } finally {
            setIsSearchingCode(false);
        }
    };

    const handleLaunchEvent = async () => {
        if (!newEvent.description || newEvent.value <= 0) {
            return alert("Por favor, preencha a descrição e um valor válido.");
        }

        try {
            setIsCreatingEvent(true);

            // Filtrar alunos destinatários baseados no targeting
            let targetStudentIds: string[] = [];

            if (eventTarget.studentId !== 'all') {
                targetStudentIds = [eventTarget.studentId];
            } else {
                targetStudentIds = students
                    .filter(s =>
                        (eventTarget.unit === 'all' || s.unit === eventTarget.unit) &&
                        (eventTarget.segment === 'all' || s.segment === eventTarget.segment) &&
                        (eventTarget.grade === 'all' || s.gradeLevel === eventTarget.grade) &&
                        (eventTarget.schoolClass === 'all' || s.schoolClass === eventTarget.schoolClass)
                    )
                    .map(s => s.id);
            }

            if (targetStudentIds.length === 0) {
                return alert("Nenhum aluno encontrado com os filtros selecionados.");
            }

            if (!confirm(`Deseja lançar este ${newEvent.type} para ${targetStudentIds.length} aluno(s)?`)) {
                return;
            }

            const createdCount = await financialService.createMassEvents({
                studentIds: targetStudentIds,
                description: newEvent.description,
                value: newEvent.value,
                dueDate: newEvent.dueDate,
                type: newEvent.type
            });

            alert(`${createdCount} lançamentos realizados com sucesso!`);
            setIsEventModalOpen(false);

            // Reset modal state
            setNewEvent({
                description: '',
                value: 0,
                dueDate: new Date().toISOString().split('T')[0],
                type: 'Evento'
            });
            setEventTarget({
                unit: 'all',
                segment: 'all',
                grade: 'all',
                schoolClass: 'all',
                studentId: 'all'
            });

            loadData();
        } catch (error) {
            console.error("Erro ao lançar eventos:", error);
            alert("Ocorreu um erro ao realizar os lançamentos.");
        } finally {
            setIsCreatingEvent(false);
        }
    };

    const recalculateValues = (inst: EnrichedMensalidade | Mensalidade, payDate: string) => {
        const originalVal = inst.value;
        const dueDate = new Date(inst.dueDate);
        const paymentDate = new Date(payDate);

        dueDate.setHours(0, 0, 0, 0);
        paymentDate.setHours(0, 0, 0, 0);

        let penalty = 0;
        let interest = 0;

        if (paymentDate > dueDate && inst.status !== 'Pago') {
            const diffTime = Math.abs(paymentDate.getTime() - dueDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            penalty = originalVal * 0.02;

            const dailyInterest = (originalVal * 0.01) / 30;
            interest = dailyInterest * diffDays;
        }

        setDischargeDetails({
            paymentDate: payDate,
            valueOriginal: originalVal,
            valuePenalty: penalty,
            valueInterest: interest,
            valueTotal: originalVal + penalty + interest
        });
    };

    const handleConfirmDischarge = async () => {
        if (!foundInstallment) return;
        try {
            // Combinar a data escolhida com a hora atual para o registro ficar preciso
            const now = new Date();
            const timeString = now.toTimeString().split(' ')[0]; // HH:MM:SS
            const fullPaymentDateIso = `${dischargeDetails.paymentDate}T${timeString}`;

            const receiptId = await financialService.markAsPaid(foundInstallment.id, {
                method: 'Baixa Manual (Código)',
                paidValue: dischargeDetails.valueTotal,
                interest: dischargeDetails.valueInterest,
                penalty: dischargeDetails.valuePenalty,
                paymentDate: new Date(fullPaymentDateIso).toISOString(),
                documentNumber: foundInstallment.documentNumber // Passar o documento atual se existir
            });

            alert(`Baixa efetuada com sucesso!\nValor Recebido: R$ ${dischargeDetails.valueTotal.toFixed(2)}`);

            // Gerar recibo automaticamente usando o ID fixo retornado do banco
            if (foundInstallment && foundInstallment.studentUnit) {
                const unitDetail = getUnitById(foundInstallment.studentUnit);
                if (unitDetail) {
                    generateReceipt({
                        ...foundInstallment,
                        status: 'Pago',
                        paymentDate: new Date(fullPaymentDateIso).toISOString(),
                        value: dischargeDetails.valueTotal,
                        receiptId: receiptId
                    }, unitDetail);
                }
            }
            setIsDischargeModalOpen(false);
            setFoundInstallment(null);
            setDischargeCode('');
            loadData();
        } catch (error) {
            alert("Erro ao dar baixa.");
            console.error(error);
        }
    };

    const COLORS = ['#1e1b4b', '#ea580c', '#334155', '#475569', '#64748b', '#94a3b8'];

    return (
        <div className="space-y-6">
            {/* Header e Ações Globais */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                        {activeTab === 'recebimentos' ? 'Gestão de Receitas' : activeTab === 'pagamentos' ? 'Contas a Pagar' : activeTab === 'eventos' ? 'Eventos & Extras' : 'Fluxo de Caixa'}
                    </h2>
                    <p className="text-slate-500 text-sm font-medium">
                        {activeTab === 'recebimentos' ? 'Controle de mensalidades e recebíveis' : activeTab === 'pagamentos' ? 'Gestão de despesas e custos da unidade' : activeTab === 'eventos' ? 'Gestão de eventos escolares e extras' : 'Visão consolidada da saúde financeira'}
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">

                    {activeTab === 'recebimentos' && (
                        <Button
                            onClick={() => setIsInstallmentModalOpen(true)}
                            className="flex-1 sm:flex-none"
                        >
                            <Landmark className="w-5 h-5 mr-2" />
                            Gerador de Carnês
                        </Button>
                    )}
                    {activeTab === 'recebimentos' && (
                        <Button
                            onClick={() => setIsDischargeModalOpen(true)}
                            className="flex-1 sm:flex-none"
                        >
                            <CheckCircle2 className="w-5 h-5 mr-2" />
                            Baixa Manual
                        </Button>
                    )}
                    {activeTab === 'pagamentos' && (
                        <Button
                            onClick={() => setIsExpenseModalOpen(true)}
                            className="flex-1 sm:flex-none"
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            Nova Despesa
                        </Button>
                    )}
                    {activeTab === 'eventos' && (
                        <Button
                            onClick={() => setIsEventModalOpen(true)}
                            className="flex-1 sm:flex-none"
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            Novo Evento
                        </Button>
                    )}
                    <Button
                        onClick={handleExportFinancials}
                        variant="secondary"
                        title="Exportar dados para Excel/CSV"
                        className="w-full sm:w-auto h-11 bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <Download className="w-5 h-5" />
                    </Button>

                    {selectedStudentId && activeTab === 'recebimentos' && (
                        <Button
                            onClick={handleGenerateBoletos}
                            isLoading={isGenerating}
                            disabled={eligibleForBoletos === 0}
                            className={`h-11 px-6 font-bold flex-1 sm:flex-none transition-all ${eligibleForBoletos > 0
                                ? 'animate-pulse ring-4 ring-blue-100 flex-1 sm:flex-none'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none ring-0 flex-1 sm:flex-none'}`}
                            title={eligibleForBoletos > 0 ? "Gera boletos no Mercado Pago para parcelas pendentes" : "Não há parcelas pendentes sem boleto para este aluno"}
                        >
                            <Barcode className="w-5 h-5 mr-2" />
                            Gerar Boletos
                        </Button>
                    )}
                </div>
            </div>



            {
                activeTab === 'recebimentos' && (
                    <>
                        {/* Grid de Resumo - Receitas */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card
                                className={`bg-white border-slate-200/60 shadow-sm overflow-hidden group cursor-pointer transition-all ${filterStatus === 'Pago' ? 'ring-2 ring-blue-950' : ''}`}
                                onClick={() => setFilterStatus('Pago')}
                            >
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-950 group-hover:bg-blue-950 group-hover:text-white transition-all duration-300">
                                        <Wallet className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Arrecadado</p>
                                        <h3 className="text-xl font-bold text-slate-800">R$ {summary.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card
                                className={`bg-white border-slate-200/60 shadow-sm overflow-hidden group cursor-pointer transition-all ${filterStatus === 'Pago' ? 'ring-2 ring-blue-950' : ''}`}
                                onClick={() => setFilterStatus('Pago')}
                            >
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-950 group-hover:bg-blue-950 group-hover:text-white transition-all duration-300">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pagos</p>
                                        <h3 className="text-xl font-bold text-slate-800">{summary.paid}</h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card
                                className={`bg-white border-slate-200/60 shadow-sm overflow-hidden group cursor-pointer transition-all ${filterStatus === 'Pendente' ? 'ring-2 ring-orange-600' : ''}`}
                                onClick={() => setFilterStatus('Pendente')}
                            >
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-orange-100/30 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all duration-300">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pendentes</p>
                                        <h3 className="text-xl font-bold text-slate-800">{summary.pending}</h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card
                                className="bg-white border-slate-200/60 shadow-sm overflow-hidden group cursor-pointer"
                                onClick={() => setFilterStatus('Todos')}
                            >
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-950 group-hover:bg-blue-950 group-hover:text-white transition-all duration-300">
                                        <ScrollText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Inadimplência</p>
                                        <h3 className="text-xl font-bold text-slate-800">
                                            {(summary.paid + summary.overdue) > 0
                                                ? ((summary.overdue / (summary.paid + summary.overdue)) * 100).toFixed(1)
                                                : '0.0'}%
                                        </h3>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Filtros e Busca de Aluno */}
                        <Card className="border-slate-200 shadow-sm overflow-visible">
                            <CardContent className="p-4">
                                <div className="flex flex-col lg:flex-row gap-4 items-end">
                                    <div className="flex-1 w-full relative">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                                                Buscar Aluno (Ficha Individual)
                                            </label>
                                            {selectedStudentId && (
                                                <button
                                                    onClick={resetFilters}
                                                    className="text-[10px] font-bold text-blue-950 hover:text-black uppercase tracking-wider flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    Limpar / Ver Tudo
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <Input
                                                placeholder="Nome ou matrícula..."
                                                className="pl-10 h-11"
                                                value={searchTerm}
                                                onChange={(e) => {
                                                    setSearchTerm(e.target.value);
                                                    if (e.target.value === '') setSelectedStudentId(null);
                                                }}
                                            />
                                        </div>

                                        {/* Autocomplete de Alunos */}
                                        {searchTerm.length >= 2 && !selectedStudentId && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 shadow-xl rounded-xl z-50 overflow-hidden divide-y divide-slate-50 animate-in slide-in-from-top-2 duration-200">
                                                {filteredStudents.length > 0 ? filteredStudents.map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => {
                                                            setSelectedStudentId(s.id);
                                                            setSearchTerm(s.name);
                                                        }}
                                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                                    >
                                                        <div className="w-8 h-8 bg-blue-950/10 text-blue-950 rounded-full flex items-center justify-center text-xs font-bold">
                                                            {s.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-800 leading-none">{s.name}</p>
                                                            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{s.gradeLevel} • {s.code}</p>
                                                        </div>
                                                        <ChevronRight className="ml-auto w-4 h-4 text-slate-300" />
                                                    </button>
                                                )) : (
                                                    <div className="p-4 text-center text-sm text-slate-400 italic">Nenhum aluno encontrado</div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 w-full lg:w-auto">
                                        <div className={selectedStudentId ? "opacity-40 grayscale" : ""}>
                                            <Select
                                                label="Mês Referência"
                                                value={filterMonth}
                                                onChange={(e) => !selectedStudentId && setFilterMonth(e.target.value)}
                                                options={[
                                                    { label: 'Todos os meses', value: '' },
                                                    ...months.map((m, i) => ({ label: m, value: i.toString() }))
                                                ]}
                                                disabled={!!selectedStudentId}
                                            />
                                        </div>

                                        <Select
                                            label="Status"
                                            value={filterStatus}
                                            onChange={(e) => setFilterStatus(e.target.value)}
                                            options={[
                                                { label: 'Todos', value: 'Todos' },
                                                { label: 'Pago', value: 'Pago' },
                                                { label: 'Pendente', value: 'Pendente' },
                                                { label: 'Atrasado', value: 'Atrasado' }
                                            ]}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tabela de Mensalidades */}
                        <Card className="border-slate-200 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4">Matrícula</th>
                                            <th className="px-6 py-4">Aluno</th>
                                            <th className="px-6 py-4">Referência</th>
                                            <th className="px-6 py-4">Valor</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 text-[9px] font-extrabold text-slate-400 uppercase tracking-tighter">
                                                    <span className="w-9 text-center">Recibo</span>
                                                    <span className="w-9 text-center">Zap</span>
                                                    <span className="w-9 text-center">Baixa</span>
                                                    <span className="w-9 text-center">Excluir</span>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-950" />
                                                    Buscando registros financeiros...
                                                </td>
                                            </tr>
                                        ) : filteredMensalidades.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                                                    Nenhum registro encontrado para os filtros selecionados.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredMensalidades.map((m) => (
                                                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group text-slate-700 border-b border-slate-50 last:border-0">
                                                    <td className="px-6 py-4 font-mono text-[10px] text-slate-400 font-medium">{m.studentCode}</td>
                                                    <td className="px-6 py-4">
                                                        <div>
                                                            <p className="font-bold text-slate-700 leading-tight">{m.studentName}</p>
                                                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{m.studentGrade}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2 text-slate-600 font-medium">
                                                                <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                                                <span>{m.month}</span>
                                                            </div>
                                                            {m.documentNumber && (
                                                                <div className="text-[10px] text-slate-400 font-mono bg-slate-50 px-1 py-0.5 rounded w-fit" title="Código de Baixa">
                                                                    Cód: {m.documentNumber}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 font-extrabold text-slate-900">
                                                        R$ {m.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-0.5 rounded-xl text-[10px] font-bold uppercase tracking-tighter border ${m.status === 'Pago'
                                                            ? 'bg-blue-50 text-blue-950 border-blue-200/50'
                                                            : m.status === 'Atrasado' || m.status === 'Vencido'
                                                                ? 'bg-orange-100/30 text-orange-600 border-orange-200/50'
                                                                : 'bg-slate-100 text-slate-600 border-slate-200/50'
                                                            }`}>
                                                            {m.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="grid grid-cols-4 gap-2 w-fit ml-auto">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className={`h-9 w-9 rounded-xl transition-all ${m.status === 'Pago' ? 'text-blue-950 hover:bg-blue-50 bg-blue-50/30' : 'text-slate-300 bg-slate-50/50 cursor-not-allowed'}`}
                                                                onClick={() => {
                                                                    if (m.status === 'Pago') {
                                                                        const unitDetail = getUnitById(m.studentUnit);
                                                                        if (!unitDetail) return alert("Dados da unidade não encontrados.");
                                                                        generateReceipt(m, unitDetail);
                                                                    }
                                                                }}
                                                                disabled={m.status !== 'Pago'}
                                                                title={m.status === 'Pago' ? "Gerar Recibo" : "Disponível apenas após o pagamento"}
                                                            >
                                                                <ScrollText className="w-5 h-5" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-9 w-9 rounded-xl text-blue-950 hover:bg-blue-50 bg-blue-50/30 transition-all"
                                                                onClick={() => sendWhatsAppMessage(m)}
                                                                title="Cobrança via WhatsApp"
                                                            >
                                                                <MessageCircle className="w-5 h-5" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                title={m.status !== 'Pago' ? "Baixa Manual (Calculada)" : "Já Pago"}
                                                                className={`h-9 w-9 rounded-xl transition-all ${m.status !== 'Pago' ? 'hover:bg-blue-50 text-blue-950 bg-blue-50/30' : 'text-slate-300 bg-slate-50/50 cursor-not-allowed'}`}
                                                                onClick={() => m.status !== 'Pago' && handleMarkAsPaid(m.id)}
                                                                disabled={m.status === 'Pago'}
                                                            >
                                                                <CheckCircle2 className="w-5 h-5" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                title="Excluir"
                                                                className="h-9 w-9 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 bg-slate-50/30 transition-all"
                                                                onClick={() => handleDeleteFee(m.id)}
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </>
                )
            }
            {
                activeTab === 'pagamentos' && (
                    <>
                        {/* Grid de Resumo - Despesas */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-blue-950">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-950 rounded-xl">
                                        <ArrowUpCircle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total a Pagar</p>
                                        <h3 className="text-xl font-bold text-slate-800">R$ {expenseSummary.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-blue-950">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-950 rounded-xl">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Pago</p>
                                        <h3 className="text-xl font-bold text-slate-800">R$ {expenseSummary.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-orange-600">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-orange-100/30 text-orange-600 rounded-xl">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pendentes</p>
                                        <h3 className="text-xl font-bold text-slate-800">R$ {(expenseSummary.totalValue - expenseSummary.paidValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-blue-950">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-950 rounded-xl">
                                        <Wallet className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Qtd. Despesas</p>
                                        <h3 className="text-xl font-bold text-slate-800">{expenseSummary.total}</h3>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Tabela de Despesas */}
                        <Card className="border-slate-200 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4">Descrição</th>
                                            <th className="px-6 py-4">Categoria</th>
                                            <th className="px-6 py-4">Vencimento</th>
                                            <th className="px-6 py-4">Valor</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 text-[9px] font-extrabold text-slate-400 uppercase tracking-tighter">
                                                    <span className="w-9 text-center">Baixa</span>
                                                    <span className="w-9 text-center">Excluir</span>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-950" />
                                                    Buscando registros financeiros...
                                                </td>
                                            </tr>
                                        ) : expenses.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                                                    Nenhuma despesa encontrada.
                                                </td>
                                            </tr>
                                        ) : (
                                            expenses.map((e) => (
                                                <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group text-slate-700">
                                                    <td className="px-6 py-4 font-bold">{e.description}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-xl text-[10px] uppercase font-bold tracking-tight">
                                                            {e.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500">{new Date(e.dueDate).toLocaleDateString('pt-BR')}</td>
                                                    <td className="px-6 py-4 font-extrabold text-slate-900">
                                                        R$ {e.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-0.5 rounded-xl text-[10px] font-bold uppercase tracking-tighter border ${e.status === 'Pago'
                                                            ? 'bg-blue-50 text-blue-950 border-blue-200/50'
                                                            : 'bg-orange-50 text-orange-600 border-orange-200/50'
                                                            }`}>
                                                            {e.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="grid grid-cols-2 gap-2 w-fit ml-auto">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                title={e.status !== 'Pago' ? "Marcar como pago" : "Já Pago"}
                                                                className={`h-9 w-9 rounded-xl transition-all ${e.status !== 'Pago' ? 'hover:bg-blue-50 text-blue-950 bg-blue-50/30' : 'text-slate-300 bg-slate-50/50 cursor-not-allowed'}`}
                                                                onClick={async () => {
                                                                    if (e.status !== 'Pago' && confirm("Deseja marcar esta despesa como PAGA?")) {
                                                                        await financialService.updateExpense(e.id!, { status: 'Pago', paymentDate: new Date().toISOString() });
                                                                        loadData();
                                                                    }
                                                                }}
                                                                disabled={e.status === 'Pago'}
                                                            >
                                                                <CheckCircle2 className="w-5 h-5" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                title="Excluir"
                                                                className="h-9 w-9 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 bg-slate-50/30 transition-all"
                                                                onClick={async () => {
                                                                    if (confirm("Tem certeza que deseja excluir esta despesa?")) {
                                                                        await financialService.deleteExpense(e.id!);
                                                                        loadData();
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </>
                )
            }

            {
                activeTab === 'eventos' && (
                    <>
                        {/* Grid de Resumo - Eventos */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-blue-950">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-950 rounded-xl">
                                        <Layers className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Lançado</p>
                                        <h3 className="text-xl font-bold text-slate-800">
                                            R$ {eventos.reduce((acc, curr) => acc + (curr.value || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-blue-950">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-950 rounded-xl">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pagos</p>
                                        <h3 className="text-xl font-bold text-slate-800">
                                            {eventos.filter(e => e.status === 'Pago').length}
                                        </h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-orange-600">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-orange-100/30 text-orange-600 rounded-xl">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pendentes</p>
                                        <h3 className="text-xl font-bold text-slate-800">
                                            {eventos.filter(e => e.status !== 'Pago').length}
                                        </h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-blue-950">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-950 rounded-xl">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Alunos Atendidos</p>
                                        <h3 className="text-xl font-bold text-slate-800">
                                            {new Set(eventos.map(e => e.studentId)).size}
                                        </h3>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Tabela de Eventos */}
                        <Card className="border-slate-200 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4">Descrição</th>
                                            <th className="px-6 py-4">Aluno</th>
                                            <th className="px-6 py-4">Tipo</th>
                                            <th className="px-6 py-4">Vencimento</th>
                                            <th className="px-6 py-4">Valor</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-950" />
                                                    Carregando eventos...
                                                </td>
                                            </tr>
                                        ) : eventos.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                                                    Nenhum evento ou extra lançado.
                                                </td>
                                            </tr>
                                        ) : (
                                            eventos.map((e) => (
                                                <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group text-slate-700">
                                                    <td className="px-6 py-4 font-bold">{e.description}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-slate-800">{e.studentName}</span>
                                                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">{e.studentGrade} • {e.studentUnit}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-xl text-[10px] uppercase font-bold tracking-tight ${e.type === 'Evento' ? 'bg-blue-50 text-blue-950' : 'bg-slate-100 text-slate-600'}`}>
                                                            {e.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500">{new Date(e.dueDate).toLocaleDateString('pt-BR')}</td>
                                                    <td className="px-6 py-4 font-extrabold text-slate-900">
                                                        R$ {e.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-0.5 rounded-xl text-[10px] font-bold uppercase tracking-tighter border ${e.status === 'Pago'
                                                            ? 'bg-blue-50 text-blue-950 border-blue-200/50'
                                                            : 'bg-orange-50 text-orange-600 border-orange-200/50'
                                                            }`}>
                                                            {e.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            title="Excluir"
                                                            className="h-9 w-9 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 bg-slate-50/30 transition-all"
                                                            onClick={async () => {
                                                                if (confirm("Tem certeza que deseja excluir este lançamento?")) {
                                                                    await financialService.deleteEvento(e.id!);
                                                                    loadData();
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </>
                )
            }

            {
                activeTab === 'fluxo' && (
                    <div className="space-y-6">
                        {/* Resumo Consolidado */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden p-6 border-t-4 border-t-blue-950">
                                <div className="flex flex-col items-center text-center">
                                    <div className="p-4 bg-blue-50 text-blue-950 rounded-full mb-4">
                                        <Wallet className="w-8 h-8" />
                                    </div>
                                    <h4 className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">Total Recebido</h4>
                                    <p className="text-3xl font-black text-slate-800">R$ {summary.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden p-6 border-t-4 border-t-orange-600">
                                <div className="flex flex-col items-center text-center">
                                    <div className="p-4 bg-orange-50 text-orange-600 rounded-full mb-4">
                                        <ArrowUpCircle className="w-8 h-8" />
                                    </div>
                                    <h4 className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">Total Pago</h4>
                                    <p className="text-3xl font-black text-slate-800">R$ {expenseSummary.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </Card>

                            <Card className={`bg-white border-slate-200 shadow-sm overflow-hidden p-6 border-t-4 ${summary.paidValue - expenseSummary.paidValue >= 0 ? 'border-t-blue-950' : 'border-t-orange-600'}`}>
                                <div className="flex flex-col items-center text-center">
                                    <div className={`p-4 rounded-full mb-4 ${summary.paidValue - expenseSummary.paidValue >= 0 ? 'bg-blue-50 text-blue-950' : 'bg-orange-50 text-orange-600'}`}>
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>
                                    <h4 className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">Saldo em Caixa</h4>
                                    <p className={`text-3xl font-black ${summary.paidValue - expenseSummary.paidValue >= 0 ? 'text-blue-950' : 'text-orange-600'}`}>
                                        R$ {(summary.paidValue - expenseSummary.paidValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </Card>
                        </div>

                        {/* Projeção de Futuro */}
                        <Card className="bg-slate-900 text-white border-none shadow-xl p-8 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <ScrollText className="w-32 h-32" />
                            </div>
                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div>
                                    <h4 className="text-blue-400 font-bold text-xs uppercase tracking-widest mb-2">Projeção do Mês (Dessa Unidade)</h4>
                                    <p className="text-sm text-slate-400 max-w-md">Saldo estimado considerando todos os recebíveis agendados e todas as despesas lançadas como pendentes.</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-4xl font-black text-white">
                                        R$ {(summary.totalValue - expenseSummary.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-slate-400 font-bold mt-1 tracking-wider uppercase">Saldo Líquido Previsto</p>
                                </div>
                            </div>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-6 bg-white border border-slate-200 rounded-xl">
                                <h5 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-950 rounded-full"></div>
                                    Detalhamento de Receitas
                                </h5>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                        <span className="text-sm text-slate-500">Mensalidades Recebidas</span>
                                        <span className="font-bold text-slate-700">R$ {summary.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                        <span className="text-sm text-slate-500">Mensalidades em Aberto</span>
                                        <span className="font-bold text-orange-600">R$ {(summary.totalValue - summary.paidValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-white border border-slate-200 rounded-xl">
                                <h5 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                                    Detalhamento de Despesas
                                </h5>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                        <span className="text-sm text-slate-500">Despesas Pagas</span>
                                        <span className="font-bold text-slate-700">R$ {expenseSummary.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                        <span className="text-sm text-slate-500">Despesas Pendentes</span>
                                        <span className="font-bold text-orange-600">R$ {(expenseSummary.totalValue - expenseSummary.paidValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dashboard Visual */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                            <Card className="bg-white border-slate-200 shadow-sm p-6">
                                <h5 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <BarChartIcon className="w-4 h-4 text-blue-950" />
                                    Comparativo Mensal (R$)
                                </h5>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 11, fontWeight: 500, fill: '#94a3b8' }}
                                                tickFormatter={(val) => `R$ ${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                                formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                                            />
                                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }} />
                                            <Bar dataKey="receita" name="Receita" fill="#020617" radius={[4, 4, 0, 0]} barSize={32} />
                                            <Bar dataKey="despesa" name="Despesa" fill="#ea580c" radius={[4, 4, 0, 0]} barSize={32} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm p-6">
                                <h5 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <PieChartIcon className="w-4 h-4 text-blue-950" />
                                    Despesas por Categoria
                                </h5>
                                <div className="h-[300px] w-full flex items-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={categoryData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {categoryData.map((_entry: { name: string; value: number }, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                                formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                            />
                                            <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>
                    </div>
                )
            }

            {/* Modal de Nova Despesa */}
            <Modal
                isOpen={isExpenseModalOpen}
                onClose={() => setIsExpenseModalOpen(false)}
                title="Cadastrar Nova Despesa"
            >
                <div className="space-y-4">
                    <Input
                        label="Descrição / Fornecedor"
                        placeholder="Ex: Aluguel, Compra de papelaria..."
                        value={newExpense.description}
                        onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Categoria"
                            value={newExpense.category}
                            onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                            options={[
                                { label: 'Salários', value: 'Salários' },
                                { label: 'Infraestrutura', value: 'Infraestrutura' },
                                { label: 'Materiais', value: 'Materiais' },
                                { label: 'Impostos', value: 'Impostos' },
                                { label: 'Outros', value: 'Outros' }
                            ]}
                        />
                        <Input
                            label="Valor (R$)"
                            type="number"
                            value={newExpense.value?.toString()}
                            onChange={(e) => setNewExpense({ ...newExpense, value: parseFloat(e.target.value) })}
                        />
                    </div>
                    <Input
                        label="Data de Vencimento"
                        type="date"
                        value={newExpense.dueDate}
                        onChange={(e) => setNewExpense({ ...newExpense, dueDate: e.target.value })}
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setIsExpenseModalOpen(false)}>Cancelar</Button>
                        <Button
                            className="bg-blue-950 hover:bg-black text-white"
                            onClick={async () => {
                                if (!newExpense.description || !newExpense.value) return alert("Preencha todos os campos.");

                                const userUnit = localStorage.getItem('userUnit');
                                // We don't need the hardcoded mapping here anymore if we can just use the userUnit or the unit name
                                // But expenses need a unit name. If user is admin_geral, they might choose a unit or it might be 'Geral'.

                                let unit = 'Geral';
                                if (userUnit && userUnit !== 'admin_geral') {

                                    // I need to be careful with IDs vs enums.
                                    // In Unidades.tsx, IDs are names.

                                    const unitMapping: Record<string, string> = {
                                        'unit_zn': 'Zona Norte',
                                        'unit_ext': 'Extremoz',
                                        'unit_qui': 'Quintas',
                                        'unit_bs': 'Boa Sorte'
                                    };
                                    unit = unitMapping[userUnit] || 'Geral';
                                }

                                await financialService.addExpense({
                                    ...newExpense as Expense,
                                    unit
                                });
                                setIsExpenseModalOpen(false);
                                loadData();
                            }}
                        >
                            Salvar Despesa
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Modal de Baixa Manual */}
            <Modal
                isOpen={isDischargeModalOpen}
                onClose={() => {
                    setIsDischargeModalOpen(false);
                    setFoundInstallment(null);
                    setDischargeCode('');
                }}
                title="Baixa de Documentos"
                maxWidth="max-w-3xl"
            >
                <div className="space-y-6">
                    {/* Área de Busca */}
                    <div className="grid grid-cols-1 md:col-span-4 gap-4 items-end bg-blue-950/5 p-4 rounded-xl">
                        <div className="md:col-span-1">
                            <Input
                                label="Código de Baixa"
                                value={dischargeCode}
                                onChange={(e) => setDischargeCode(e.target.value)}
                                placeholder="Ex: 123456"
                                maxLength={6}
                                className="text-center font-mono text-lg font-bold tracking-widest"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <Input
                                type="date"
                                label="Data de Pagamento"
                                value={dischargeDetails.paymentDate}
                                onChange={(e) => {
                                    setDischargeDetails(prev => ({ ...prev, paymentDate: e.target.value }));
                                    if (foundInstallment) recalculateValues(foundInstallment, e.target.value);
                                }}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <Button
                                onClick={handleSearchByCode}
                                disabled={isSearchingCode || dischargeCode.length < 4}
                                className="w-full bg-blue-950 hover:bg-black text-white"
                            >
                                {isSearchingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                                Buscar
                            </Button>
                        </div>
                    </div>

                    {foundInstallment && (
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 animate-in fade-in zoom-in duration-300">
                            <div className="mb-4">
                                <label className="text-xs font-bold text-slate-400 uppercase">Aluno / Pagador</label>
                                <div className="text-lg font-bold text-slate-800">{foundInstallment.studentName}</div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Vencimento</label>
                                    <div className="font-semibold text-slate-700">{foundInstallment.dueDate ? foundInstallment.dueDate.split('-').reverse().join('/') : '-'}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Referência</label>
                                    <div className="font-semibold text-slate-700">{foundInstallment.month}</div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Valor Original</label>
                                    <div className="font-semibold text-slate-700">R$ {dischargeDetails.valueOriginal.toFixed(2)}</div>
                                </div>
                                <div className="bg-orange-100/30 p-2 rounded-xl border border-orange-200">
                                    <label className="text-xs font-bold text-orange-600 uppercase">Juros/Multa</label>
                                    <div className="font-bold text-orange-700">
                                        R$ {(dischargeDetails.valuePenalty + dischargeDetails.valueInterest).toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-orange-400 leading-tight">
                                        (M: {dischargeDetails.valuePenalty.toFixed(2)} + J: {dischargeDetails.valueInterest.toFixed(2)})
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-200 pt-4 mt-4">
                                <div>
                                    <div className="text-sm text-slate-500">Valor Final a Pagar</div>
                                    <div className="text-3xl font-black text-blue-950">
                                        R$ {dischargeDetails.valueTotal.toFixed(2)}
                                    </div>
                                </div>
                                <Button
                                    onClick={handleConfirmDischarge}
                                    className="bg-blue-950 hover:bg-black text-white px-8 h-12 text-lg"
                                >
                                    <CheckCircle2 className="w-6 h-6 mr-2" />
                                    CONFIRMAR BAIXA
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>



            {/* Modal de Gerador de Carnês / Parcelamento */}
            <Modal
                isOpen={isInstallmentModalOpen}
                onClose={() => setIsInstallmentModalOpen(false)}
                title="Gerador de Carnês e Parcelamentos"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">
                        Gere mensalidades para o ano todo de uma só vez. Ideal para emissão de carnês.
                    </p>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Aluno (Opcional)</label>
                        <select
                            className="w-full p-2 border border-slate-200 rounded-xl text-sm"
                            value={installmentParams.studentId}
                            onChange={(e) => setInstallmentParams({ ...installmentParams, studentId: e.target.value })}
                        >
                            <option value="">Todos os Alunos (Desta Unidade)</option>
                            {students.map(s => (
                                <option key={s.id} value={s.id}>{s.name} - {s.code}</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-400">Deixe em branco para gerar para todos.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Ano Letivo"
                            value={installmentParams.year}
                            onChange={(e) => setInstallmentParams({ ...installmentParams, year: e.target.value })}
                        />
                        <Input
                            label="Valor Mensal (R$)"
                            placeholder="Padrão do Aluno"
                            value={installmentParams.value}
                            onChange={(e) => setInstallmentParams({ ...installmentParams, value: e.target.value })}
                            helperText="Se vazio, usa o valor do cadastro."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Mês Inicial</label>
                            <select
                                className="w-full p-2 border border-slate-200 rounded-xl text-sm"
                                value={installmentParams.startMonth}
                                onChange={(e) => setInstallmentParams({ ...installmentParams, startMonth: e.target.value })}
                            >
                                {months.map((m, i) => (
                                    <option key={i} value={i + 1}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700">Mês Final</label>
                            <select
                                className="w-full p-2 border border-slate-200 rounded-xl text-sm"
                                value={installmentParams.endMonth}
                                onChange={(e) => setInstallmentParams({ ...installmentParams, endMonth: e.target.value })}
                            >
                                {months.map((m, i) => (
                                    <option key={i} value={i + 1}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <input
                            type="checkbox"
                            id="withBoletos"
                            checked={installmentParams.withBoletos}
                            onChange={(e) => setInstallmentParams({ ...installmentParams, withBoletos: e.target.checked })}
                            className="w-4 h-4 text-blue-950 rounded border-gray-300 focus:ring-blue-900"
                        />
                        <label htmlFor="withBoletos" className="text-sm font-medium text-blue-950 cursor-pointer select-none">
                            Gerar Boletos Digitais Automaticamente (Mercado Pago)
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                        <Button variant="ghost" onClick={() => setIsInstallmentModalOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleGenerateInstallments}
                            isLoading={isGenerating}
                            className="bg-blue-950 hover:bg-black text-white"
                        >
                            Gerar Parcelas
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Modal de Lançamento de Eventos */}
            <Modal
                isOpen={isEventModalOpen}
                onClose={() => setIsEventModalOpen(false)}
                title="Lançar Novo Evento ou Extra"
                maxWidth="max-w-2xl"
            >
                <div className="space-y-4 max-h-[80vh] overflow-y-auto p-1">
                    <div className="space-y-4">
                        <Input
                            label="Data de Vencimento"
                            type="date"
                            value={newEvent.dueDate}
                            onChange={(e) => setNewEvent({ ...newEvent, dueDate: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <Input
                                label="Descrição do Evento"
                                placeholder="Ex: Festa Junina 2024..."
                                value={newEvent.description}
                                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                            />
                        </div>
                        <Input
                            label="Valor (R$)"
                            type="number"
                            placeholder="0,00"
                            value={newEvent.value.toString()}
                            onChange={(e) => setNewEvent({ ...newEvent, value: parseFloat(e.target.value) || 0 })}
                        />
                    </div>

                    <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50 space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-full bg-blue-950 text-white flex items-center justify-center">
                                <Search className="w-3 h-3" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-blue-950">Destinatários</h4>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Select
                                label="Unidade"
                                value={eventTarget.unit}
                                onChange={(e) => setEventTarget({ ...eventTarget, unit: e.target.value, segment: 'all', grade: 'all', schoolClass: 'all', studentId: 'all' })}
                                disabled={localStorage.getItem('userUnit') !== 'admin_geral' && !!localStorage.getItem('userUnit')}
                                options={[
                                    { label: 'Todas', value: 'all' },
                                    { label: 'Zona Norte', value: 'Zona Norte' },
                                    { label: 'Extremoz', value: 'Extremoz' },
                                    { label: 'Quintas', value: 'Quintas' },
                                    { label: 'Boa Sorte', value: 'Boa Sorte' }
                                ]}
                            />
                            <Select
                                label="Segmento"
                                value={eventTarget.segment}
                                onChange={(e) => setEventTarget({ ...eventTarget, segment: e.target.value, grade: 'all', schoolClass: 'all', studentId: 'all' })}
                                options={[
                                    { label: 'Todos', value: 'all' },
                                    ...Array.from(new Set([
                                        'Educação Infantil',
                                        'Fundamental I',
                                        'Fundamental II',
                                        'Ensino Médio',
                                        ...students.map(s => s.segment)
                                    ]))
                                        .filter((s): s is string => !!s)
                                        .sort((a, b) => getSegmentWeight(a) - getSegmentWeight(b))
                                        .map(s => ({ label: s, value: s }))
                                ]}
                            />
                            <Select
                                label="Série"
                                value={eventTarget.grade}
                                onChange={(e) => setEventTarget({ ...eventTarget, grade: e.target.value, schoolClass: 'all', studentId: 'all' })}
                                options={[
                                    { label: 'Todas', value: 'all' },
                                    ...Array.from(new Set([
                                        ...(eventTarget.segment !== 'all' && segmentGrades[eventTarget.segment] ? segmentGrades[eventTarget.segment] : []),
                                        ...students.filter(s => eventTarget.segment === 'all' || s.segment === eventTarget.segment).map(s => s.gradeLevel)
                                    ]))
                                        .filter((s): s is string => !!s)
                                        .sort((a, b) => getGradeWeight(a) - getGradeWeight(b))
                                        .map(s => ({ label: s, value: s }))
                                ]}
                            />
                            <Select
                                label="Turma"
                                value={eventTarget.schoolClass}
                                onChange={(e) => setEventTarget({ ...eventTarget, schoolClass: e.target.value, studentId: 'all' })}
                                options={[
                                    { label: 'Todas', value: 'all' },
                                    ...Array.from(new Set([
                                        'A', 'B', 'C', 'D', 'E',
                                        ...students.filter(s => (eventTarget.grade === 'all' || s.gradeLevel === eventTarget.grade) && (eventTarget.unit === 'all' || s.unit === eventTarget.unit)).map(s => s.schoolClass)
                                    ]))
                                        .filter((s) => !!s)
                                        .sort()
                                        .map(s => ({ label: s, value: s }))
                                ]}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Aluno Específico</label>
                            <select
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-900/10 focus:border-blue-950 transition-all outline-none appearance-none"
                                value={eventTarget.studentId}
                                onChange={(e) => setEventTarget({ ...eventTarget, studentId: e.target.value })}
                            >
                                <option value="all">Todos do grupo acima</option>
                                {students
                                    .filter(s =>
                                        (eventTarget.unit === 'all' || s.unit === eventTarget.unit) &&
                                        (eventTarget.segment === 'all' || s.segment === eventTarget.segment) &&
                                        (eventTarget.grade === 'all' || s.gradeLevel === eventTarget.grade) &&
                                        (eventTarget.schoolClass === 'all' || s.schoolClass === eventTarget.schoolClass)
                                    )
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                    ))
                                }
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <Button variant="ghost" onClick={() => setIsEventModalOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleLaunchEvent}
                            isLoading={isCreatingEvent}
                            disabled={!newEvent.description || newEvent.value <= 0}
                            className="bg-blue-950 hover:bg-black text-white px-6"
                        >
                            Confirmar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
