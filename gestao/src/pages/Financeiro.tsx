
import { useState, useEffect } from 'react';
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
    Receipt,
    Loader2,
    Calendar,
    Plus,
    Trash2,
    MessageCircle,
    ChevronRight,
    Wallet,
    ArrowUpCircle,
    Banknote,
    PieChart as PieChartIcon,
    BarChart as BarChartIcon,
    Barcode,
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
import type { Student, Expense, Mensalidade } from '../types';

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
}

export function Financeiro() {
    const [activeTab, setActiveTab] = useState<'recebimentos' | 'pagamentos' | 'fluxo'>('recebimentos');
    const [isLoading, setIsLoading] = useState(true);
    const [mensalidades, setMensalidades] = useState<EnrichedMensalidade[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [students, setStudents] = useState<Student[]>([]);

    // Filtros
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth().toString());
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

            if (activeTab === 'pagamentos' || activeTab === 'fluxo') {
                promises.push(financialService.getExpenses({
                    unit: unitFilter,
                    status: filterStatus !== 'Todos' ? filterStatus : undefined
                }));
            } else {
                promises.push(Promise.resolve([]));
            }

            const results = await Promise.all(promises) as any[];
            const studentsData = results[0];
            const mensalidadesData = results[1] as any[];
            const expensesData = results[2] as any[];

            setStudents(studentsData);

            // Mapear Alunos
            const studentsMap = new Map<string, Student>();
            studentsData.forEach((s: Student) => studentsMap.set(s.id, s));

            // 2. Processar Mensalidades
            if (mensalidadesData) {
                const enrichedData: EnrichedMensalidade[] = mensalidadesData.map((m: any) => ({
                    ...m,
                    studentName: studentsMap.get(m.studentId)?.name || 'Aluno Não Encontrado',
                    studentCode: studentsMap.get(m.studentId)?.code || '-',
                    studentGrade: studentsMap.get(m.studentId)?.gradeLevel || '-',
                    studentClass: studentsMap.get(m.studentId)?.schoolClass || '-',
                    studentShift: studentsMap.get(m.studentId)?.shift || '-',
                    studentUnit: studentsMap.get(m.studentId)?.unit || '-',
                    studentResponsibleName: studentsMap.get(m.studentId)?.nome_responsavel || '-',
                    studentCPF: studentsMap.get(m.studentId)?.cpf_responsavel || studentsMap.get(m.studentId)?.cpf_aluno || '-',
                    studentPhone: studentsMap.get(m.studentId)?.telefone_responsavel || studentsMap.get(m.studentId)?.phoneNumber || ''
                }));

                if (selectedStudentId) {
                    enrichedData.sort((a: EnrichedMensalidade, b: EnrichedMensalidade) => b.month.localeCompare(a.month));
                } else {
                    enrichedData.sort((a: EnrichedMensalidade, b: EnrichedMensalidade) => a.studentName.localeCompare(b.studentName));
                }

                setMensalidades(enrichedData);
                setSummary({
                    total: enrichedData.length,
                    paid: enrichedData.filter((m: EnrichedMensalidade) => m.status === 'Pago').length,
                    pending: enrichedData.filter((m: EnrichedMensalidade) => m.status !== 'Pago').length,
                    paidValue: enrichedData.filter((m: EnrichedMensalidade) => m.status === 'Pago').reduce((acc: number, curr: EnrichedMensalidade) => acc + (curr.value || 0), 0),
                    totalValue: enrichedData.reduce((acc: number, curr: EnrichedMensalidade) => acc + (curr.value || 0), 0)
                });
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
        setFilterMonth(new Date().getMonth().toString());
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
                    email: student.email || 'email@padrao.com', // Fallback se não tiver email
                    firstName: student.name.split(' ')[0],
                    lastName: student.name.split(' ').slice(1).join(' '),
                    cpf: student.cpf || student.responsibleCpf || '00000000000', // Fallback
                    address: {
                        zipCode: student.zipCode || '59000000',
                        streetName: student.address || 'Endereço não informado',
                        streetNumber: 'S/N',
                        neighborhood: student.neighborhood || 'Bairro',
                        city: student.city || 'Natal',
                        state: 'RN'
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

            await financialService.markAsPaid(foundInstallment.id, {
                method: 'Baixa Manual (Código)',
                paidValue: dischargeDetails.valueTotal,
                interest: dischargeDetails.valueInterest,
                penalty: dischargeDetails.valuePenalty,
                paymentDate: new Date(fullPaymentDateIso).toISOString()
            });

            alert(`Baixa efetuada com sucesso!\nValor Recebido: R$ ${dischargeDetails.valueTotal.toFixed(2)}`);

            // Gerar recibo automaticamente
            generateReceipt({
                ...foundInstallment,
                status: 'Pago',
                paymentDate: new Date(fullPaymentDateIso).toISOString(),
                value: dischargeDetails.valueTotal
            });
            setIsDischargeModalOpen(false);
            setFoundInstallment(null);
            setDischargeCode('');
            loadData();
        } catch (error) {
            alert("Erro ao dar baixa.");
            console.error(error);
        }
    };

    const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

    return (
        <div className="space-y-6">
            {/* Header e Ações Globais */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                        {activeTab === 'recebimentos' ? 'Gestão de Receitas' : activeTab === 'pagamentos' ? 'Contas a Pagar' : 'Fluxo de Caixa'}
                    </h2>
                    <p className="text-slate-500 text-sm font-medium">
                        {activeTab === 'recebimentos' ? 'Controle de mensalidades e recebíveis' : activeTab === 'pagamentos' ? 'Gestão de despesas e custos da unidade' : 'Visão consolidada da saúde financeira'}
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">

                    {activeTab === 'recebimentos' && (
                        <Button
                            onClick={() => setIsInstallmentModalOpen(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex-1 sm:flex-none"
                        >
                            <Banknote className="w-4 h-4 mr-2" />
                            Gerador de Carnês
                        </Button>
                    )}
                    {activeTab === 'recebimentos' && (
                        <Button
                            onClick={() => setIsDischargeModalOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex-1 sm:flex-none"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Baixa Manual
                        </Button>
                    )}
                    {activeTab === 'pagamentos' && (
                        <Button
                            onClick={() => setIsExpenseModalOpen(true)}
                            className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex-1 sm:flex-none"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Nova Despesa
                        </Button>
                    )}
                    <Button
                        onClick={handleExportFinancials}
                        variant="secondary"
                        title="Exportar dados para Excel/CSV"
                        className="w-full sm:w-auto"
                    >
                        <Download className="w-4 h-4 text-slate-600" />
                    </Button>

                    {selectedStudentId && activeTab === 'recebimentos' && (
                        <Button
                            onClick={handleGenerateBoletos}
                            isLoading={isGenerating}
                            className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm flex-1 sm:flex-none"
                            title="Gera boletos no Mercado Pago para parcelas pendentes"
                        >
                            <Barcode className="w-4 h-4 mr-2" />
                            Gerar Boletos
                        </Button>
                    )}
                </div>
            </div>

            {/* Menu de Abas Estilo "Pills" Moderno */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('recebimentos')}
                    className={`cursor-pointer px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'recebimentos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Receitas
                </button>
                <button
                    onClick={() => setActiveTab('pagamentos')}
                    className={`cursor-pointer px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'pagamentos' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Pagamentos
                </button>
                <button
                    onClick={() => setActiveTab('fluxo')}
                    className={`cursor-pointer px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'fluxo' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Fluxo de Caixa
                </button>
            </div>

            {
                activeTab === 'recebimentos' && (
                    <>
                        {/* Grid de Resumo - Receitas */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card
                                className={`bg-white border-slate-200/60 shadow-sm overflow-hidden group cursor-pointer transition-all ${filterStatus === 'Pago' ? 'ring-2 ring-indigo-500' : ''}`}
                                onClick={() => setFilterStatus('Pago')}
                            >
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                        <Banknote className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Arrecadado</p>
                                        <h3 className="text-xl font-bold text-slate-800">R$ {summary.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card
                                className={`bg-white border-slate-200/60 shadow-sm overflow-hidden group cursor-pointer transition-all ${filterStatus === 'Pago' ? 'ring-2 ring-emerald-500' : ''}`}
                                onClick={() => setFilterStatus('Pago')}
                            >
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pagos</p>
                                        <h3 className="text-xl font-bold text-slate-800">{summary.paid}</h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card
                                className={`bg-white border-slate-200/60 shadow-sm overflow-hidden group cursor-pointer transition-all ${filterStatus === 'Pendente' ? 'ring-2 ring-amber-500' : ''}`}
                                onClick={() => setFilterStatus('Pendente')}
                            >
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
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
                                    <div className="p-3 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-slate-800 group-hover:text-white transition-all duration-300">
                                        <Receipt className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Inadimplência</p>
                                        <h3 className="text-xl font-bold text-slate-800">
                                            {summary.total > 0 ? ((summary.pending / summary.total) * 100).toFixed(1) : '0.0'}%
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
                                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider flex items-center gap-1"
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
                                                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
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
                                            <th className="px-6 py-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
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
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-tighter border ${m.status === 'Pago'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                                                            : m.status === 'Atrasado' || m.status === 'Vencido'
                                                                ? 'bg-rose-50 text-rose-700 border-rose-200/50'
                                                                : 'bg-slate-100 text-slate-600 border-slate-200/50'
                                                            }`}>
                                                            {m.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                                                onClick={() => generateReceipt(m)}
                                                                title="Gerar Recibo"
                                                            >
                                                                <Receipt className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-indigo-600 hover:bg-indigo-50"
                                                                onClick={() => sendWhatsAppMessage(m)}
                                                                title="Cobrança via WhatsApp"
                                                            >
                                                                <MessageCircle className="w-4 h-4" />
                                                            </Button>
                                                            {m.status !== 'Pago' && (
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    title="Baixa Manual (Calculada)"
                                                                    className="h-8 w-8 hover:bg-emerald-50 text-emerald-600"
                                                                    onClick={() => handleMarkAsPaid(m.id)}
                                                                >
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                title="Excluir"
                                                                className="h-8 w-8 text-slate-300 hover:text-rose-500 hover:bg-rose-50"
                                                                onClick={() => handleDeleteFee(m.id)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
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
                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-rose-500">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                                        <ArrowUpCircle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total a Pagar</p>
                                        <h3 className="text-xl font-bold text-slate-800">R$ {expenseSummary.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-emerald-500">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total Pago</p>
                                        <h3 className="text-xl font-bold text-slate-800">R$ {expenseSummary.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-amber-500">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pendentes</p>
                                        <h3 className="text-xl font-bold text-slate-800">R$ {(expenseSummary.totalValue - expenseSummary.paidValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-indigo-500">
                                <CardContent className="p-5 flex items-center gap-4">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
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
                                            <th className="px-6 py-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
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
                                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] uppercase font-bold tracking-tight">
                                                            {e.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500">{new Date(e.dueDate).toLocaleDateString('pt-BR')}</td>
                                                    <td className="px-6 py-4 font-extrabold text-slate-900">
                                                        R$ {e.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-tighter border ${e.status === 'Pago'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200/50'
                                                            }`}>
                                                            {e.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {e.status !== 'Pago' && (
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    title="Marcar como pago"
                                                                    className="h-8 w-8 hover:bg-emerald-50 text-emerald-600"
                                                                    onClick={async () => {
                                                                        if (confirm("Deseja marcar esta despesa como PAGA?")) {
                                                                            await financialService.updateExpense(e.id!, { status: 'Pago', paymentDate: new Date().toISOString() });
                                                                            loadData();
                                                                        }
                                                                    }}
                                                                >
                                                                    <CheckCircle2 className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                title="Excluir"
                                                                className="h-8 w-8 text-slate-300 hover:text-rose-500 hover:bg-rose-50"
                                                                onClick={async () => {
                                                                    if (confirm("Tem certeza que deseja excluir esta despesa?")) {
                                                                        await financialService.deleteExpense(e.id!);
                                                                        loadData();
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
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
                activeTab === 'fluxo' && (
                    <div className="space-y-6">
                        {/* Resumo Consolidado */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden p-6 border-t-4 border-t-indigo-500">
                                <div className="flex flex-col items-center text-center">
                                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4">
                                        <Banknote className="w-8 h-8" />
                                    </div>
                                    <h4 className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">Total Recebido</h4>
                                    <p className="text-3xl font-black text-slate-800">R$ {summary.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden p-6 border-t-4 border-t-rose-500">
                                <div className="flex flex-col items-center text-center">
                                    <div className="p-4 bg-rose-50 text-rose-600 rounded-full mb-4">
                                        <ArrowUpCircle className="w-8 h-8" />
                                    </div>
                                    <h4 className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">Total Pago</h4>
                                    <p className="text-3xl font-black text-slate-800">R$ {expenseSummary.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </Card>

                            <Card className={`bg-white border-slate-200 shadow-sm overflow-hidden p-6 border-t-4 ${summary.paidValue - expenseSummary.paidValue >= 0 ? 'border-t-emerald-500' : 'border-t-rose-500'}`}>
                                <div className="flex flex-col items-center text-center">
                                    <div className={`p-4 rounded-full mb-4 ${summary.paidValue - expenseSummary.paidValue >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>
                                    <h4 className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">Saldo em Caixa</h4>
                                    <p className={`text-3xl font-black ${summary.paidValue - expenseSummary.paidValue >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        R$ {(summary.paidValue - expenseSummary.paidValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </Card>
                        </div>

                        {/* Projeção de Futuro */}
                        <Card className="bg-slate-900 text-white border-none shadow-xl p-8 overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Receipt className="w-32 h-32" />
                            </div>
                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div>
                                    <h4 className="text-indigo-400 font-bold text-xs uppercase tracking-widest mb-2">Projeção do Mês (Dessa Unidade)</h4>
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
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                    Detalhamento de Receitas
                                </h5>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                        <span className="text-sm text-slate-500">Mensalidades Recebidas</span>
                                        <span className="font-bold text-slate-700">R$ {summary.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                        <span className="text-sm text-slate-500">Mensalidades em Aberto</span>
                                        <span className="font-bold text-amber-600">R$ {(summary.totalValue - summary.paidValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-white border border-slate-200 rounded-xl">
                                <h5 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                                    Detalhamento de Despesas
                                </h5>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                        <span className="text-sm text-slate-500">Despesas Pagas</span>
                                        <span className="font-bold text-slate-700">R$ {expenseSummary.paidValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                        <span className="text-sm text-slate-500">Despesas Pendentes</span>
                                        <span className="font-bold text-rose-600">R$ {(expenseSummary.totalValue - expenseSummary.paidValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dashboard Visual */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                            <Card className="bg-white border-slate-200 shadow-sm p-6">
                                <h5 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <BarChartIcon className="w-4 h-4 text-indigo-500" />
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
                                            <Bar dataKey="receita" name="Receita" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} />
                                            <Bar dataKey="despesa" name="Despesa" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={32} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm p-6">
                                <h5 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <PieChartIcon className="w-4 h-4 text-emerald-500" />
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
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                            onClick={async () => {
                                if (!newExpense.description || !newExpense.value) return alert("Preencha todos os campos.");

                                const userUnit = localStorage.getItem('userUnit');
                                const unitMapping: Record<string, string> = {
                                    'unit_zn': 'Zona Norte',
                                    'unit_ext': 'Extremoz',
                                    'unit_qui': 'Quintas',
                                    'unit_bs': 'Boa Sorte'
                                };
                                const unit = (userUnit && unitMapping[userUnit]) ? unitMapping[userUnit] : 'Geral';

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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-blue-50 p-4 rounded-lg">
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
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {isSearchingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                                Buscar
                            </Button>
                        </div>
                    </div>

                    {foundInstallment && (
                        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 animate-in fade-in zoom-in duration-300">
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
                                <div className="bg-rose-50 p-2 rounded border border-rose-100">
                                    <label className="text-xs font-bold text-rose-600 uppercase">Juros/Multa</label>
                                    <div className="font-bold text-rose-700">
                                        R$ {(dischargeDetails.valuePenalty + dischargeDetails.valueInterest).toFixed(2)}
                                    </div>
                                    <div className="text-[10px] text-rose-400 leading-tight">
                                        (M: {dischargeDetails.valuePenalty.toFixed(2)} + J: {dischargeDetails.valueInterest.toFixed(2)})
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-200 pt-4 mt-4">
                                <div>
                                    <div className="text-sm text-slate-500">Valor Final a Pagar</div>
                                    <div className="text-3xl font-black text-emerald-600">
                                        R$ {dischargeDetails.valueTotal.toFixed(2)}
                                    </div>
                                </div>
                                <Button
                                    onClick={handleConfirmDischarge}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12 text-lg"
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
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
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
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
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
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                value={installmentParams.endMonth}
                                onChange={(e) => setInstallmentParams({ ...installmentParams, endMonth: e.target.value })}
                            >
                                {months.map((m, i) => (
                                    <option key={i} value={i + 1}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <input
                            type="checkbox"
                            id="withBoletos"
                            checked={installmentParams.withBoletos}
                            onChange={(e) => setInstallmentParams({ ...installmentParams, withBoletos: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                        <label htmlFor="withBoletos" className="text-sm font-medium text-indigo-900 cursor-pointer select-none">
                            Gerar Boletos Digitais Automaticamente (Mercado Pago)
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                        <Button variant="ghost" onClick={() => setIsInstallmentModalOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleGenerateInstallments}
                            isLoading={isGenerating}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            Gerar Parcelas
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
