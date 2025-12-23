import React, { useState, useEffect, useMemo } from 'react'; // Refresh
import { Student, Mensalidade, EventoFinanceiro, UnitContact, ContactRole } from '../types';
import { Button } from './Button';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
// NOTE: Replace with your actual Firebase Functions URL or configure Vite proxy
const MP_REFERENCE_URL = 'https://us-central1-meu-expansivo-app.cloudfunctions.net/createMercadoPagoPreference';

// Initialize outside component to avoid re-runs
initMercadoPago('APP_USR-e0a54aff-c482-451f-882c-e41a50bcde7d', { locale: 'pt-BR' });

interface FinanceiroScreenProps {
    student: Student;
    mensalidades: Mensalidade[];
    eventos: EventoFinanceiro[];
    unitContacts?: UnitContact[];
}

type PaymentMethod = 'pix' | 'debito' | 'credito' | 'boleto';

export const FinanceiroScreen: React.FC<FinanceiroScreenProps> = ({ student, mensalidades, eventos = [], unitContacts = [] }) => {
    // Lógica de Filtro
    // Lógica de Filtro
    const studentMensalidades = useMemo(() => mensalidades.filter(m => m.studentId === student.id), [mensalidades, student.id]);
    const studentEventos = useMemo(() => eventos.filter(e => e.studentId === student.id), [eventos, student.id]);
    const isIsaac = student.metodo_pagamento === 'Isaac';

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'mensalidades' | 'eventos'>('mensalidades');
    const [historyMode, setHistoryMode] = useState(false); // Toggle between Pending and History view

    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('pix');
    const [selectedInstallments, setSelectedInstallments] = useState<number>(1);
    const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
    const [eventQuantities, setEventQuantities] = useState<Record<string, number>>({});
    const [cpfInput, setCpfInput] = useState('');
    const [nameInput, setNameInput] = useState('');
    const [phoneInput, setPhoneInput] = useState('');
    const [emailInput, setEmailInput] = useState('');
    const [isCpfModalOpen, setIsCpfModalOpen] = useState(false);
    const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
    const [preferenceId, setPreferenceId] = useState<string | null>(null);
    const [isBrickReady, setIsBrickReady] = useState(false);
    const [paymentResult, setPaymentResult] = useState<any>(null); // Store payment result
    const [receiptData, setReceiptData] = useState<Mensalidade | null>(null); // State for internal Receipt Modal

    useEffect(() => {
        if (preferenceId && isModalOpen) {
            setIsBrickReady(false);
            const timer = setTimeout(() => {
                setIsBrickReady(true);
            }, 500); // 500ms delay to ensure modal animation finishes
            return () => clearTimeout(timer);
        } else {
            setIsBrickReady(false);
        }
    }, [preferenceId, isModalOpen]);

    // Inicializar quantidades para eventos
    useEffect(() => {
        const initialQuants: Record<string, number> = {};
        eventos.forEach(e => {
            initialQuants[e.id] = 1;
        });
        setEventQuantities(initialQuants);
    }, [eventos]);



    // Reset installments and selection when tab changes
    useEffect(() => {
        setSelectedInstallments(1);
        if (activeTab === 'mensalidades') {
            setSelectedEventIds([]);
            // Ensure we are in pending mode when switching back, or keep user preference? Let's keep preference.
        }
    }, [activeTab, selectedMethod]);

    const toggleEventSelection = (id: string) => {
        setSelectedEventIds(prev =>
            prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]
        );
    };

    const updateQuantity = (id: string, delta: number) => {
        setEventQuantities(prev => ({
            ...prev,
            [id]: Math.max(1, (prev[id] || 1) + delta)
        }));
    };

    const totalSelectedValue = studentEventos
        .filter(e => selectedEventIds.includes(e.id))
        .reduce((acc, e) => acc + (e.value * (eventQuantities[e.id] || 1)), 0);



    const getStatusStyle = (status: Mensalidade['status']) => {
        switch (status) {
            case 'Pago': return 'bg-green-100 text-green-800 border-green-200';
            case 'Pendente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'Atrasado': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
        try {
            const date = new Date(dateStr + 'T00:00:00');
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('pt-BR');
        } catch (e) {
            return dateStr;
        }
    };

    const calculateValue = (val: number, type: 'mensalidade' | 'evento') => {
        let finalVal = val;
        if (selectedMethod === 'debito') {
            finalVal = val * 1.03; // + 3%
        } else if (selectedMethod === 'credito') {
            if (type === 'mensalidade') {
                finalVal = val * 1.06; // + 6% (à vista)
            } else {
                // Eventos: parcelamento disponível (valor base + juros operadora simulação básica)
                finalVal = val; // Juros são da operadora, exibimos valor base ou simulado
            }
        }
        return finalVal;
    };

    const getFeeNotice = () => {
        if (selectedMethod === 'boleto') {
            return 'A emissão do boleto está sujeita a taxas de processamento e atualização automática de juros/mora após o vencimento, conforme definido pela financeira.';
        }
        if (activeTab === 'mensalidades') {
            if (selectedMethod === 'credito') return 'Pagamento no crédito (à vista) possui acréscimo de 6% referente a taxas operacionais.';
            if (selectedMethod === 'debito') return 'Pagamento no débito possui acréscimo de 3% referente a taxas operacionais.';
        } else {
            if (selectedMethod === 'credito') return 'Parcelamento disponível em até 12x com juros padrão da operadora do cartão.';
            if (selectedMethod === 'debito') return 'Pagamento no débito possui acréscimo de 3% referente a taxas operacionais.';
        }
        return null;
    };

    const handlePaymentClick = () => {
        if (activeTab === 'eventos' && selectedEventIds.length === 0) {
            alert('Por favor, selecione ao menos um evento para prosseguir');
            return;
        }
        if (activeTab === 'mensalidades' && selectedMensalidades.length === 0) {
            alert('Por favor, selecione ao menos uma mensalidade para prosseguir');
            return;
        }
        if (selectedMethod === 'pix') {
            // Security: Always start empty to force verification/entry
            setCpfInput('');
            setNameInput('');
            setPhoneInput('');
            setEmailInput('');
            setIsCpfModalOpen(true);
        } else {
            setIsModalOpen(true);
        }
    };

    if (isIsaac) {
        return (
            <div className="animate-fade-in-up">
                <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center space-y-6">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                        <span className="text-4xl">🤝</span>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-blue-950">Seu financeiro é gerido pelo parceiro Isaac</h3>
                        <p className="text-gray-600 max-w-sm mx-auto">
                            Por favor, utilize o portal ou app do Isaac para pagamentos, consultas de boletos e histórico financeiro.
                        </p>
                    </div>
                    <Button
                        onClick={() => window.open('https://meu.olaisaac.io/auth', '_blank')}
                        className="w-full sm:w-auto px-8"
                    >
                        Ir para o Portal Isaac
                    </Button>
                </div>
            </div>
        );
    }

    const [selectedMensalidades, setSelectedMensalidades] = useState<string[]>([]);

    // Initialize selectedMensalidades with all pending/overdue on load or when data changes
    // Initialize selectedMensalidades with all pending/overdue on load or when data changes
    // Initialize selectedMensalidades
    useEffect(() => {
        // Default: Auto-select earliest pending for convenience/UX (Fixes R$ 0,00 display)
        const pending = studentMensalidades
            .filter(m => m.status !== 'Pago')
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        if (pending.length > 0) {
            setSelectedMensalidades([pending[0].id]);
        } else {
            setSelectedMensalidades([]);
        }
    }, [studentMensalidades]);

    const toggleMensalidadeSelection = (id: string) => {
        setSelectedMensalidades(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const totalMensalidadesValue = studentMensalidades
        .filter(m => selectedMensalidades.includes(m.id))
        .reduce((acc, m) => acc + m.value, 0);



    const [pixData, setPixData] = useState<{ url: string, pixText: string, qrCodeImage?: string, publicUrl?: string } | null>(null);
    const [isLoadingPix, setIsLoadingPix] = useState(false);

    // Check for payment confirmation
    useEffect(() => {
        if (!isModalOpen || !pixData) return;

        // Check if selected items are now paid
        if (activeTab === 'mensalidades') {
            const allSelectedPaid = selectedMensalidades.every(id => {
                const m = studentMensalidades.find(sm => sm.id === id);
                return m && m.status === 'Pago';
            });
            if (allSelectedPaid && selectedMensalidades.length > 0) {
                setIsPaymentConfirmed(true);
            }
        }
    }, [studentMensalidades, selectedMensalidades, isModalOpen, pixData, activeTab]);

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setPixData(null);
        setPreferenceId(null); // Cleanup MP Preference
        setIsPaymentConfirmed(false);
        // Reset Inputs
        setCpfInput('');
        setNameInput('');
        setPhoneInput('');
        setEmailInput('');
        setIsCpfModalOpen(false);
    };

    // Initialize Mercado Pago with a placeholder or env var


    const handleCreatePayment = async (cpfOverride?: string, nameOverride?: string, phoneOverride?: string, emailOverride?: string) => {
        setIsLoadingPix(true);
        try {
            const amount = calculateValue(activeTab === 'mensalidades' ? totalMensalidadesValue : totalSelectedValue, activeTab === 'mensalidades' ? 'mensalidade' : 'evento');

            if (amount <= 0) {
                alert("Valor inválido para pagamento.");
                setIsLoadingPix(false);
                return;
            }

            // 1. Capture Data
            const rawCpf = cpfOverride || cpfInput || student.cpf_responsavel;
            const rawName = nameOverride || nameInput || student.nome_responsavel || student.name;
            const rawEmail = emailOverride || emailInput || student.email_responsavel;

            const description = `${student.name} | ${activeTab === 'mensalidades' ? 'Mensalidades' : 'Eventos/Extras'}`;

            // Call Backend Function
            const response = await fetch(MP_REFERENCE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: description,
                    quantity: 1,
                    price: Number(amount.toFixed(2)),
                    studentId: student.id,
                    mensalidadeIds: activeTab === 'mensalidades' ? selectedMensalidades : [],
                    eventIds: activeTab === 'eventos' ? selectedEventIds : [],
                    payer: {
                        email: rawEmail,
                        first_name: rawName ? rawName.split(' ')[0] : 'Responsável',
                        last_name: rawName ? rawName.split(' ').slice(1).join(' ') : '',
                        identification: { type: 'CPF', number: rawCpf }
                    }
                })
            });

            const data = await response.json();

            console.log("Resposta do Backend (Preference):", data);

            if (data.id) {
                console.log("Preference ID válido recebido:", data.id);
                setPreferenceId(data.id);
                setIsModalOpen(true);
                setIsCpfModalOpen(false);
            } else {
                console.error("Erro: Preference ID não retornado.", data);
                alert("Erro ao gerar pagamento: " + (data.error || "Resposta inválida do servidor"));
            }

        } catch (error: any) {
            console.error("Erro ao gerar pagamento MP:", error);
            alert(`Erro: ${error.message || "Falha na conexão com Mercado Pago"}. Verifique o console.`);
        } finally {
            setIsLoadingPix(false);
        }
    };

    return (
        <div className="animate-fade-in-up space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <span className="text-3xl">💰</span> Financeiro Interno
                </h3>
            </div>

            {/* CARD DE DADOS DO PAGADOR/RESPONSÁVEL */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Responsável Financeiro</h4>
                    <p className="font-bold text-lg text-blue-950">{student.nome_responsavel || student.name}</p>
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                        <span>CPF: {student.cpf_responsavel || 'Não cadastrado'}</span>
                    </p>
                </div>
                <div className="flex flex-col gap-1 md:items-end md:text-right">
                    <div className="bg-blue-50 px-3 py-1 rounded-full w-fit">
                        <span className="text-xs font-bold text-blue-800">Mensalidade Base: R$ {student.valor_mensalidade ? student.valor_mensalidade.toFixed(2).replace('.', ',') : '???'}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                        Contato: {student.telefone_responsavel || 'Não informado'} <br />
                        Email: {student.email_responsavel || 'Não informado'}
                    </p>
                </div>
            </div>

            {/* Abas */}
            <div className="flex p-1 bg-gray-100 rounded-xl max-w-md">
                <button
                    onClick={() => setActiveTab('mensalidades')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'mensalidades' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Mensalidades
                </button>
                <button
                    onClick={() => setActiveTab('eventos')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'eventos' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Eventos & Extras
                </button>
            </div>

            {/* Seletor de Método de Pagamento */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setSelectedMethod('pix')}
                        className={`px-4 py-2 rounded-full border-2 text-sm font-bold transition-all ${selectedMethod === 'pix' ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                        Pix (0%)
                    </button>
                    <button
                        onClick={() => setSelectedMethod('debito')}
                        className={`px-4 py-2 rounded-full border-2 text-sm font-bold transition-all ${selectedMethod === 'debito' ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                        Cartão Débito (+3%)
                    </button>
                    <button
                        onClick={() => setSelectedMethod('credito')}
                        className={`px-4 py-2 rounded-full border-2 text-sm font-bold transition-all ${selectedMethod === 'credito' ? 'border-purple-500 bg-purple-50 text-purple-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                        Cartão Crédito {activeTab === 'mensalidades' ? '(+6%)' : '(Até 12x)'}
                    </button>
                    <button
                        onClick={() => setSelectedMethod('boleto')}
                        className={`px-4 py-2 rounded-full border-2 text-sm font-bold transition-all ${selectedMethod === 'boleto' ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                        Boleto Bancário
                    </button>
                </div>

                {getFeeNotice() && (
                    <div className="space-y-4">
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2">
                            <span className="text-amber-600 font-bold">⚠️</span>
                            <p className="text-xs text-amber-800 font-medium italic">{getFeeNotice()}</p>
                        </div>

                        {activeTab === 'eventos' && selectedMethod === 'credito' && (
                            <div className="flex flex-col gap-2 animate-fade-in">
                                <label className="text-sm font-bold text-blue-900 ml-1">Número de Parcelas:</label>
                                <select
                                    value={selectedInstallments}
                                    onChange={(e) => setSelectedInstallments(Number(e.target.value))}
                                    className="w-full sm:w-80 p-3 bg-white border-2 border-blue-200 rounded-xl text-blue-900 font-bold focus:border-blue-500 focus:outline-none transition-colors"
                                >
                                    {[...Array(12)].map((_, i) => {
                                        const count = i + 1;
                                        const totalValueBase = totalSelectedValue;

                                        let instValue: number;
                                        let totalFinal: number;

                                        if (count === 1) {
                                            instValue = totalValueBase;
                                            totalFinal = totalValueBase;
                                        } else {
                                            const monthlyRate = 0.0299; // 2.99% p.m.
                                            // Fórmula PMT: P * (i * (1+i)^n) / ((1+i)^n - 1)
                                            instValue = totalValueBase * (monthlyRate * Math.pow(1 + monthlyRate, count)) / (Math.pow(1 + monthlyRate, count) - 1);
                                            totalFinal = instValue * count;
                                        }

                                        return (
                                            <option key={count} value={count}>
                                                {count}x de R$ {instValue.toFixed(2).replace('.', ',')} | Total: R$ {totalFinal.toFixed(2).replace('.', ',')}
                                            </option>
                                        );
                                    })}
                                </select>
                                <p className="text-[10px] text-gray-400 ml-1 italic font-medium">
                                    Simulação aproximada. O valor final pode variar conforme as taxas da bandeira do seu cartão.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 w-10"></th>
                                {activeTab === 'eventos' && (
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Quantidade</th>
                                )}
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{activeTab === 'mensalidades' ? 'Mês' : 'Descrição'}</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Valor Atualizado</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Vencimento</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {activeTab === 'mensalidades' ? (
                                <>
                                    {/* MENSALIDADES TAB HEADER / TOGGLE */}
                                    <tr>
                                        <td colSpan={5} className="p-4 bg-gray-50">
                                            <div className="flex gap-2 justify-center sm:justify-start">
                                                <button
                                                    onClick={() => setHistoryMode(false)}
                                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!historyMode ? 'bg-blue-950 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                                                >
                                                    A Pagar
                                                </button>
                                                <button
                                                    onClick={() => setHistoryMode(true)}
                                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${historyMode ? 'bg-blue-950 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                                                >
                                                    Histórico 2026
                                                </button>
                                            </div>
                                            {/* INFO LOCK MESSAGE */}
                                            {!historyMode && (
                                                <div className="mt-3 text-xs text-orange-700 bg-orange-50 border border-orange-100 p-2 rounded flex items-center gap-2">
                                                    <span>🔒</span>
                                                    <span>Pagamento Cronológico: Você deve quitar a mensalidade mais antiga antes de avançar para as próximas.</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>

                                    {/* CONTENT */}
                                    {historyMode ? (
                                        // VIEW: HISTÓRICO (GRID)
                                        <tr>
                                            <td colSpan={5} className="p-6">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    {studentMensalidades
                                                        .sort((a, b) => {
                                                            // Sort by Month Index for Calendar View
                                                            const monthsOrder: { [key: string]: number } = { 'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4, 'Maio': 5, 'Junho': 6, 'Julho': 7, 'Agosto': 8, 'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12 };
                                                            const [ma, ya] = a.month.split('/');
                                                            const [mb, yb] = b.month.split('/');
                                                            return monthsOrder[ma] - monthsOrder[mb];
                                                        })
                                                        .map(m => (
                                                            <div key={m.id} className={`relative p-4 rounded-xl border-2 flex flex-col gap-2 ${m.status === 'Pago' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 grayscale opacity-70'}`}>
                                                                <div className="flex justify-between items-start">
                                                                    <span className="font-bold text-gray-800">{m.month}</span>
                                                                    {m.status === 'Pago' && <span className="text-xl">✅</span>}
                                                                </div>
                                                                <div className="mt-auto">
                                                                    <p className="text-sm text-gray-600">Valor: <span className="font-bold">R$ {m.value.toFixed(2)}</span></p>
                                                                    <p className="text-xs text-gray-500">Venc: {formatDate(m.dueDate)}</p>
                                                                    {m.paymentDate && <p className="text-xs text-green-700 font-bold mt-1">Pago em: {formatDate(m.paymentDate)}</p>}
                                                                    {m.paymentDate && <p className="text-xs text-green-700 font-bold mt-1">Pago em: {formatDate(m.paymentDate)}</p>}

                                                                    {/* INTERNAL RECEIPT BUTTON */}
                                                                    <button
                                                                        onClick={() => setReceiptData(m)}
                                                                        className="block mt-1 text-xs text-blue-600 underline hover:text-blue-800"
                                                                    >
                                                                        Ver Comprovante
                                                                    </button>
                                                                </div>
                                                                {/* Recibo ou Status */}
                                                                <div className="mt-2 pt-2 border-t border-gray-100">
                                                                    {m.status === 'Pago' ? (
                                                                        <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Pago</span>
                                                                    ) : (
                                                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{m.status}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        // VIEW: A PAGAR (TABLE WITH LOCK)
                                        (() => {
                                            // Logic to find oldest pending
                                            // Sort by Date Ascending
                                            const sortedPending = [...studentMensalidades]
                                                .filter(m => m.status !== 'Pago')
                                                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

                                            const oldestPendingId = sortedPending.length > 0 ? sortedPending[0].id : null;

                                            // Render only Pending/Late items in this list, sorted by DueDate
                                            const displayList = sortedPending;

                                            return displayList.length > 0 ? (
                                                displayList.map((m) => {
                                                    const isLocked = m.id !== oldestPendingId;
                                                    return (
                                                        <tr key={m.id} className={`transition-colors ${isLocked ? 'bg-gray-50 opacity-60' : 'hover:bg-blue-50/30'}`}>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    {isLocked ? (
                                                                        <div className="w-5 h-5 flex items-center justify-center text-gray-400" title="Quite os meses anteriores primeiro">
                                                                            🔒
                                                                        </div>
                                                                    ) : (
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedMensalidades.includes(m.id)}
                                                                            onChange={() => toggleMensalidadeSelection(m.id)}
                                                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 font-bold text-gray-800">{m.month}</td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs text-gray-400 line-through">R$ {m.value.toFixed(2).replace('.', ',')}</span>
                                                                    <span className="font-bold text-blue-900">R$ {calculateValue(m.value, 'mensalidade').toFixed(2).replace('.', ',')}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-600">{formatDate(m.dueDate)}</td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusStyle(m.status)}`}>
                                                                    {m.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                                                        <span className="text-4xl block mb-2">🎉</span>
                                                        Parabéns! Você está em dia com todas as mensalidades.
                                                        <button onClick={() => setHistoryMode(true)} className="block mx-auto mt-2 text-blue-600 underline text-sm">Ver Histórico</button>
                                                    </td>
                                                </tr>
                                            );
                                        })()
                                    )}
                                </>
                            ) : (
                                studentEventos.length > 0 ? (
                                    studentEventos.sort((a, b) => b.dueDate.localeCompare(a.dueDate)).map((e) => {
                                        const isUniform = e.description.toLowerCase().includes('fardamento') || e.description.toLowerCase().includes('uniforme');
                                        const quantity = eventQuantities[e.id] || 1;

                                        return (
                                            <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEventIds.includes(e.id)}
                                                        onChange={() => toggleEventSelection(e.id)}
                                                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isUniform ? (
                                                        <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1 w-fit">
                                                            <button
                                                                onClick={() => updateQuantity(e.id, -1)}
                                                                className="w-8 h-8 flex items-center justify-center font-bold text-blue-900 bg-white border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                                                            >
                                                                -
                                                            </button>
                                                            <span className="w-4 text-center font-bold text-blue-950">{quantity}</span>
                                                            <button
                                                                onClick={() => updateQuantity(e.id, 1)}
                                                                className="w-8 h-8 flex items-center justify-center font-bold text-blue-900 bg-white border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs ml-2 font-medium">1 (Fixo)</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-800">{e.description}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-gray-400 line-through">R$ {(e.value * quantity).toFixed(2).replace('.', ',')}</span>
                                                        <span className="font-bold text-blue-900">R$ {calculateValue(e.value * quantity, 'evento').toFixed(2).replace('.', ',')}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">{formatDate(e.dueDate)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusStyle(e.status)}`}>
                                                        {e.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                                            Nenhum evento ou extra encontrado.
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-end">
                <Button onClick={handlePaymentClick} disabled={isLoadingPix} className={`flex items-center gap-2 ${isLoadingPix ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {isLoadingPix ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Gerando Pix...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Pagar R$ {calculateValue(activeTab === 'mensalidades' ? totalMensalidadesValue : totalSelectedValue, activeTab === 'mensalidades' ? 'mensalidade' : 'evento').toFixed(2).replace('.', ',')} com {
                                selectedMethod === 'pix' ? 'Pix' :
                                    selectedMethod === 'debito' ? 'Cartão Débito' :
                                        selectedMethod === 'credito' ? 'Cartão Crédito' :
                                            'Boleto Bancário'
                            }
                        </>
                    )}
                </Button>
            </div>

            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3">
                <span className="text-xl">ℹ️</span>
                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                    Para outras solicitações financeiras, declarações ou negociações, por favor entre em contato diretamente com a secretaria de sua unidade.
                </p>
            </div>

            {/* Modals and other components that are part of the return statement */}
            {/* Update the Modal to show Payment Brick */}

            {/* Modal de Pagamento & PIX / BRICK */}
            {(isModalOpen || preferenceId) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-scale-in text-center space-y-6 max-h-[90vh] overflow-y-auto">

                        {preferenceId ? (
                            <div className="w-full">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-xl font-bold text-gray-900">Finalizar Pagamento</h4>
                                    <button onClick={handleCloseModal} className="text-gray-500 hover:text-red-500 font-bold">FECHAR X</button>
                                </div>

                                {!isBrickReady && (
                                    <div className="h-64 flex items-center justify-center flex-col gap-4 text-blue-600">
                                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        <p>Carregando pagamento seguro...</p>
                                    </div>
                                )}

                                {isBrickReady && !paymentResult && (
                                    <div id="paymentBrick_container" className="w-full min-h-[500px] relative z-50 bg-white rounded-lg p-2" key={preferenceId}>
                                        <p className="text-xs text-blue-600 mb-2 font-semibold">Ambiente Seguro Mercado Pago</p>
                                        <Payment
                                            initialization={{
                                                preferenceId: preferenceId,
                                                amount: calculateValue(activeTab === 'mensalidades' ? totalMensalidadesValue : totalSelectedValue, activeTab === 'mensalidades' ? 'mensalidade' : 'evento'),
                                                payer: {
                                                    firstName: student.nome_responsavel?.split(' ')[0] || 'Responsável',
                                                    lastName: student.nome_responsavel?.split(' ').slice(1).join(' ') || '',
                                                    email: student.email_responsavel || 'email@exemplo.com',
                                                    address: {
                                                        zipCode: student.cep?.replace(/\D/g, '') || '',
                                                        streetNumber: student.endereco_numero || '',
                                                        neighborhood: student.endereco_bairro || '',
                                                        city: student.endereco_cidade || '',
                                                        federalUnit: student.endereco_uf || '',
                                                        streetName: student.endereco_logradouro || ''
                                                    }
                                                }
                                            }}
                                            customization={{
                                                paymentMethods: {
                                                    maxInstallments: selectedMethod === 'credito' ? 12 : 1,
                                                    ticket: selectedMethod === 'boleto' ? 'all' : undefined,
                                                    bankTransfer: selectedMethod === 'pix' ? 'all' : undefined,
                                                    creditCard: selectedMethod === 'credito' ? 'all' : undefined,
                                                    debitCard: selectedMethod === 'debito' ? 'all' : undefined,
                                                },
                                                visual: {
                                                    style: {
                                                        theme: 'default',
                                                    }
                                                }
                                            }}
                                            onSubmit={async (param) => {
                                                console.log("Brick onSubmit:", param);
                                                try {
                                                    const response = await fetch('https://us-central1-meu-expansivo-app.cloudfunctions.net/processMercadoPagoPayment', {
                                                        method: 'POST',
                                                        headers: {
                                                            'Content-Type': 'application/json'
                                                        },
                                                        body: JSON.stringify({
                                                            ...param.formData,
                                                            external_reference: activeTab === 'mensalidades' ? selectedMensalidades.join(',') : `student_${student.id}`,
                                                            metadata: {
                                                                student_id: student.id,
                                                                mensalidade_ids: activeTab === 'mensalidades' ? selectedMensalidades.join(',') : '',
                                                            }
                                                        })
                                                    });
                                                    const result = await response.json();
                                                    console.log("Payment Result:", result);
                                                    setPaymentResult(result);
                                                } catch (e) {
                                                    console.error("Payment Error:", e);
                                                    alert("Erro ao processar pagamento. Tente novamente.");
                                                }
                                            }}
                                            onReady={() => {
                                                console.log('Brick onReady: Componente carregado!');
                                            }}
                                            onError={(error) => {
                                                console.error('Brick onError DO CATCH:', error);
                                                // Silent error to avoid scaring the user, as Brick handles field validation UI
                                            }}
                                        />
                                    </div>
                                )}

                                {paymentResult && (
                                    <div className="bg-white p-6 rounded-lg text-center space-y-4 animate-fade-in">
                                        {paymentResult.status === 'approved' && (
                                            <>
                                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl">✅</div>
                                                <h3 className="text-xl font-bold text-green-700">Pagamento Aprovado!</h3>
                                                <p className="text-gray-600">Seu pagamento foi confirmado com sucesso.</p>
                                                <Button onClick={handleCloseModal} className="w-full">Fechar</Button>
                                            </>
                                        )}
                                        {paymentResult.status === 'pending' && paymentResult.point_of_interaction?.transaction_data?.qr_code && (
                                            <>
                                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-3xl">💠</div>
                                                <h3 className="text-xl font-bold text-blue-900">Pagamento via Pix</h3>
                                                <p className="text-sm text-gray-600">Escaneie o QR Code ou copie a chave abaixo:</p>

                                                {paymentResult.point_of_interaction.transaction_data.qr_code_base64 && (
                                                    <img
                                                        src={`data:image/png;base64,${paymentResult.point_of_interaction.transaction_data.qr_code_base64}`}
                                                        alt="Pix QR Code"
                                                        className="w-48 h-48 mx-auto"
                                                    />
                                                )}

                                                <div className="bg-gray-100 p-3 rounded-lg flex items-center gap-2">
                                                    <input
                                                        readOnly
                                                        value={paymentResult.point_of_interaction.transaction_data.qr_code}
                                                        className="w-full bg-transparent text-xs text-gray-600 outline-none font-mono"
                                                    />
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(paymentResult.point_of_interaction.transaction_data.qr_code)}
                                                        className="text-blue-600 hover:text-blue-800 font-bold text-xs whitespace-nowrap"
                                                    >
                                                        COPIAR
                                                    </button>
                                                </div>
                                                <Button onClick={handleCloseModal} variant="secondary" className="w-full">Fechar e Aguardar</Button>

                                                {/* BUTTON: VERIFY MANUALLY (PIX) */}
                                                <div className="mt-4 pt-4 border-t border-gray-100">
                                                    <p className="text-xs text-gray-500 mb-2">O status ainda não mudou?</p>
                                                    <button
                                                        onClick={async () => {
                                                            if (!paymentResult?.id) return;
                                                            const btn = document.getElementById('btn-verify-status-pix');
                                                            if (btn) btn.innerText = "Verificando...";
                                                            try {
                                                                const response = await fetch('https://us-central1-meu-expansivo-app.cloudfunctions.net/verifyPaymentStatus', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ paymentId: paymentResult.id })
                                                                });
                                                                const data = await response.json();
                                                                if (data.status === 'approved') {
                                                                    setPaymentResult((prev: any) => ({ ...prev, status: 'approved' }));
                                                                } else {
                                                                    alert(`Status do Pagamento: ${data.status}. Aguarde mais alguns instantes.`);
                                                                }
                                                            } catch (e) {
                                                                alert("Erro ao verificar. Tente recarregar a página.");
                                                            } finally {
                                                                if (btn) btn.innerText = "🔄 Já paguei? Verificar agora";
                                                            }
                                                        }}
                                                        id="btn-verify-status-pix"
                                                        className="text-xs font-bold text-gray-400 hover:text-blue-600 underline"
                                                    >
                                                        🔄 Já paguei? Verificar agora
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                        {/* BOLETO UI: Check for pending/in_process status AND boleto payment method or external resource URL */}
                                        {(paymentResult.status === 'pending' || paymentResult.status === 'in_process') && paymentResult.payment_method_id === 'bolbradesco' && (
                                            <>
                                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-3xl">📄</div>
                                                <h3 className="text-xl font-bold text-blue-900">Boleto Gerado!</h3>
                                                <p className="text-sm text-gray-600">Baixe o PDF ou copie o código de barras abaixo para pagar.</p>

                                                {paymentResult.transaction_details?.external_resource_url && (
                                                    <Button
                                                        onClick={() => window.open(paymentResult.transaction_details.external_resource_url, '_blank')}
                                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md"
                                                    >
                                                        ⬇️ BAIXAR BOLETO PDF
                                                    </Button>
                                                )}

                                                {paymentResult.barcode?.content && (
                                                    <div className="bg-gray-100 p-3 rounded-lg flex items-center gap-2 mt-4">
                                                        <input
                                                            readOnly
                                                            value={paymentResult.barcode.content}
                                                            className="w-full bg-transparent text-xs text-gray-600 outline-none font-mono"
                                                        />
                                                        <button
                                                            onClick={() => navigator.clipboard.writeText(paymentResult.barcode.content)}
                                                            className="text-blue-600 hover:text-blue-800 font-bold text-xs whitespace-nowrap"
                                                        >
                                                            COPIAR
                                                        </button>
                                                    </div>
                                                )}

                                                <Button onClick={handleCloseModal} variant="secondary" className="w-full mt-2">Fechar e Aguardar</Button>

                                                {/* BUTTON: VERIFY MANUALLY (BOLETO) */}
                                                <div className="mt-4 pt-4 border-t border-gray-100">
                                                    <p className="text-xs text-gray-500 mb-2">O status ainda não mudou?</p>
                                                    <button
                                                        onClick={async () => {
                                                            if (!paymentResult?.id) return;
                                                            const btn = document.getElementById('btn-verify-status-boleto');
                                                            if (btn) btn.innerText = "Verificando...";
                                                            try {
                                                                const response = await fetch('https://us-central1-meu-expansivo-app.cloudfunctions.net/verifyPaymentStatus', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ paymentId: paymentResult.id })
                                                                });
                                                                const data = await response.json();
                                                                if (data.status === 'approved') {
                                                                    alert("Pagamento Confirmado! O sistema foi atualizado.");
                                                                    setPaymentResult(null); // Close modal
                                                                } else {
                                                                    alert(`Status do Pagamento: ${data.status}. Aguarde mais alguns instantes.`);
                                                                }
                                                            } catch (e) {
                                                                alert("Erro ao verificar. Tente recarregar a página.");
                                                            } finally {
                                                                if (btn) btn.innerText = "🔄 Já paguei? Verificar agora";
                                                            }
                                                        }}
                                                        id="btn-verify-status-boleto"
                                                        className="text-xs font-bold text-gray-400 hover:text-blue-600 underline"
                                                    >
                                                        🔄 Já paguei? Verificar agora
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                        {paymentResult.status === 'rejected' && (
                                            <>
                                                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-3xl">❌</div>
                                                <h3 className="text-xl font-bold text-red-700">Pagamento Recusado</h3>
                                                <p className="text-gray-600">{paymentResult.status_detail || 'Ocorreu um erro com seu pagamento.'}</p>
                                                <Button onClick={() => setPaymentResult(null)} variant="outline" className="w-full">Tentar Novamente</Button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Existing "Novo Sistema de Pagamentos" Summary
                            <>
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-3xl">🚀</div>
                                <div className="space-y-4">
                                    <h4 className="text-xl font-bold text-gray-900">Novo Sistema de Pagamentos</h4>

                                    {/* ... existing summary content ... */}

                                    <div className="text-sm text-gray-600 text-left space-y-3 bg-gray-50 p-4 rounded-xl">
                                        {/* ... Re-insert existing summary details ... */}
                                        <div className="border-b pb-2 mb-2">
                                            <p className="text-xs font-bold text-gray-500 uppercase">Pagador</p>
                                            <p className="font-bold text-gray-800">{student.nome_responsavel || student.name}</p>
                                            <p className="text-xs text-gray-500">CPF: {student.cpf_responsavel || '---'}</p>
                                        </div>
                                        <p className="text-lg font-bold text-blue-950 flex justify-between items-center">
                                            <span>Total:</span>
                                            <span>R$ {calculateValue(activeTab === 'mensalidades' ? totalMensalidadesValue : totalSelectedValue, activeTab === 'mensalidades' ? 'mensalidade' : 'evento').toFixed(2).replace('.', ',')}</span>
                                        </p>
                                    </div>

                                </div>
                                <Button onClick={() => setIsCpfModalOpen(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transform transition hover:scale-105">
                                    Confirmar e Pagar
                                </Button>
                                <Button onClick={handleCloseModal} variant="secondary" className="w-full">Cancelar</Button>
                            </>
                        )}
                    </div>
                </div>
            )}



            {/* MODAL DE INPUT DE CPF (NOVO) */}
            {
                isCpfModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in">
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Dados do Pagador</h3>
                            <p className="text-sm text-gray-500 mb-4">Confirme as informações para registro do Pix.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPF do Responsável (Apenas números)</label>
                                    <input
                                        type="text"
                                        value={cpfInput}
                                        onChange={(e) => setCpfInput(e.target.value.replace(/\D/g, '').substring(0, 11))}
                                        className="w-full p-3 border-2 border-blue-100 rounded-xl font-mono text-center text-xl tracking-widest focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                                        placeholder="000.000.000-00"
                                        autoFocus
                                    />
                                </div>

                                <div className="text-xs text-center text-gray-400">
                                    <p>Pagador: <span className="font-bold text-gray-600">{student.nome_responsavel || student.name}</span></p>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button onClick={() => setIsCpfModalOpen(false)} variant="secondary" className="w-1/2">
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            if (cpfInput.length < 11) {
                                                alert("CPF incompleto.");
                                                return;
                                            }

                                            // Autofill other data from student record
                                            const payerName = student.nome_responsavel || student.name;
                                            const payerPhone = student.telefone ? student.telefone.replace(/\D/g, '') : '84999999999'; // Fallback phone
                                            const payerEmail = student.email || 'financeiro@meuexpansivo.com.br'; // Fallback email (required by MP)

                                            setIsCpfModalOpen(false);
                                            handleCreatePayment(cpfInput, payerName, payerPhone, payerEmail);
                                        }}
                                        className="w-1/2 bg-blue-600 hover:bg-blue-700 font-bold py-3"
                                        disabled={cpfInput.length < 11}
                                    >
                                        Ir para Pagamento
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                receiptData && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in relative border border-gray-100">

                            {/* Receipt Header */}
                            <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
                                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 text-xl">
                                    🧾
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide">Comprovante</h3>
                                <p className="text-xs text-gray-500">{new Date(receiptData.paymentDate || new Date()).toLocaleString()}</p>
                            </div>

                            {/* Receipt Details */}
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Pagador:</span>
                                    <span className="font-bold text-gray-800 text-right w-32 truncate">{student.nome_responsavel || student.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Beneficiário:</span>
                                    <span className="font-bold text-gray-800">Meu Expansivo</span>
                                </div>
                                <div className="my-2 border-t border-dashed border-gray-200" />
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Referência:</span>
                                    <span className="font-bold text-gray-800">{receiptData.month}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Método:</span>
                                    <span className="font-bold text-gray-800">{receiptData.paymentMethod || 'Pix / Cartão'}</span>
                                </div>
                                <div className="my-2 border-t border-dashed border-gray-200" />
                                <div className="flex justify-between text-base">
                                    <span className="font-bold text-gray-800">Valor Total:</span>
                                    <span className="font-bold text-green-700">R$ {receiptData.value.toFixed(2).replace('.', ',')}</span>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="mt-6 space-y-2">
                                <Button onClick={() => window.print()} variant="outline" className="w-full border-dashed">
                                    🖨️ Imprimir / Salvar PDF
                                </Button>
                                <Button onClick={() => setReceiptData(null)} className="w-full bg-gray-800 hover:bg-gray-900 text-white">
                                    Fechar
                                </Button>
                            </div>

                            {/* Decorative jagged edge (CSS trick or SVG) - Optional, simplified for now */}
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20 rounded-t-2xl"></div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
