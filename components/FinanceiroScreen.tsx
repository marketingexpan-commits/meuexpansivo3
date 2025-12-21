import React, { useState, useEffect, useMemo } from 'react';
import { Student, Mensalidade, EventoFinanceiro, UnitContact, ContactRole } from '../types';
import { Button } from './Button';

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

    // Inicializar quantidades para eventos
    useEffect(() => {
        const initialQuants: Record<string, number> = {};
        eventos.forEach(e => {
            initialQuants[e.id] = 1;
        });
        setEventQuantities(initialQuants);
    }, [eventos]);



    // Reset installments and selection when tab or method changes
    useEffect(() => {
        setSelectedInstallments(1);
        if (activeTab === 'mensalidades') {
            setSelectedEventIds([]);
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
        // Default: No items selected
        setSelectedMensalidades([]);
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
        setIsPaymentConfirmed(false);
        // Reset Inputs
        setCpfInput('');
        setNameInput('');
        setPhoneInput('');
        setEmailInput('');
        setIsCpfModalOpen(false);
    };

    const handleCreatePixCharge = async (cpfOverride?: string, nameOverride?: string, phoneOverride?: string, emailOverride?: string) => {
        setIsLoadingPix(true);
        console.log("FinanceiroScreen: handleCreatePixCharge chamado.", { cpfOverride, nameOverride, phoneOverride, emailOverride, cpfInputState: cpfInput });

        try {
            const amount = calculateValue(activeTab === 'mensalidades' ? totalMensalidadesValue : totalSelectedValue, activeTab === 'mensalidades' ? 'mensalidade' : 'evento');

            // NOTE: In a real production environment, this call should be made from a backend server
            const token = (import.meta as any).env.VITE_ABACATE_PAY_TOKEN;
            if (!token) {
                alert("Erro de configuração: Token VITE_ABACATE_PAY_TOKEN não encontrado no arquivo .env");
                return;
            }

            // 1. Capture Data (Arg -> State -> Student Record)
            // Prioritize typed input: Args > State > Fallback
            // Note: User requested strict use of TYPED data from Modal for Name/CPF.
            const rawCpf = cpfOverride || cpfInput || student.cpf_responsavel;
            const rawName = nameOverride || nameInput || student.nome_responsavel || student.name;
            const rawPhone = phoneOverride || phoneInput || student.telefone_responsavel;
            const rawEmail = emailOverride || emailInput || student.email_responsavel;

            // 2. Limpeza de Caracteres (Obrigatório: Apenas números)
            if (!rawCpf || !rawName || !rawPhone || !rawEmail) {
                alert("Dados incompletos. Nome, CPF, Telefone e Email são obrigatórios para o Pix.");
                setIsLoadingPix(false);
                return;
            }
            const cleanCpf = rawCpf.toString().replace(/\D/g, '');
            const cleanPhone = rawPhone.toString().replace(/\D/g, '');
            const cleanEmail = rawEmail.trim();

            // Validação de comprimento (11 dígitos para CPF)
            if (cleanCpf.length !== 11) {
                alert(`CPF inválido (${cleanCpf}). O CPF deve conter exatamente 11 números.`);
                setIsLoadingPix(false);
                return;
            }
            if (cleanPhone.length < 10) {
                alert(`Telefone inválido (${cleanPhone}). Inclua o DDD.`);
                setIsLoadingPix(false);
                return;
            }

            console.log("FinanceiroScreen: Payload Preparado", {
                amount: Math.round(amount * 100),
                descriptionSize: 50, // Truncado na API
                customer: {
                    name: rawName,
                    taxId: cleanCpf, // Mapeado para field taxId conforme solicitado
                    cellphone: cleanPhone,
                    email: cleanEmail
                }
            });

            const activeItems = activeTab === 'mensalidades'
                ? studentMensalidades.filter(m => selectedMensalidades.includes(m.id)).map(m => m.month).join(', ')
                : studentEventos.filter(e => selectedEventIds.includes(e.id)).map(e => e.description).join(', ');

            // Detailed Description Format: "Name (Code) | Grade - Class - Shift | Unit | Months/Items"
            const description = `${student.name} (${student.id}) | ${student.gradeLevel} - ${student.schoolClass} - ${student.shift} | ${student.unit} | ${activeItems.substring(0, 30)}`;

            const response = await fetch('/api/abacate/pixQrCode/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: Math.round(amount * 100),
                    description: description,
                    customer: {
                        name: rawName,
                        taxId: cleanCpf,
                        cellphone: cleanPhone,
                        email: cleanEmail
                    },
                    products: [
                        {
                            externalId: `mensalidades_${student.id}`,
                            name: "Mensalidades Escolares",
                            quantity: 1,
                            value: Math.round(amount * 100)
                        }
                    ]
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error("Abacate Pay API Error:", data.error);
                throw new Error(data.error.message || JSON.stringify(data.error));
            }

            // 3. Handle Response (brCode & brCodeBase64)
            const pixInfo = data.data || data;

            if (!pixInfo.brCode) {
                throw new Error("BR Code não retornado pela API.");
            }

            setPixData({
                url: pixInfo.checkoutUrl || pixInfo.billingUrl || pixInfo.url, // Correctly capture the payment URL
                pixText: pixInfo.brCode,
                qrCodeImage: pixInfo.brCodeBase64,
                publicUrl: pixInfo.publicUrl || pixInfo.url
            });
            setIsModalOpen(true); // Ensure modal is open to show QR

        } catch (error: any) {
            console.error("Erro ao gerar Pix (Catch):", error);
            const msg = error?.message || "Erro desconhecido";
            alert(`Erro ao conectar com Abacate Pay: ${msg}. Verifique o console para detalhes.`);
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
                                studentMensalidades.length > 0 ? (
                                    studentMensalidades.sort((a, b) => b.dueDate.localeCompare(a.dueDate)).map((m) => (
                                        <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                {m.status !== 'Pago' && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedMensalidades.includes(m.id)}
                                                        onChange={() => toggleMensalidadeSelection(m.id)}
                                                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                )}
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
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                                            Nenhuma mensalidade encontrada.
                                        </td>
                                    </tr>
                                )
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

            {/* Modal de Pagamento & PIX */}
            {(isModalOpen || pixData) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-scale-in text-center space-y-6">

                        {pixData ? (
                            <>
                                <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto text-3xl">💠</div>
                                {pixData.qrCodeImage && !isPaymentConfirmed ? (
                                    <div className="flex justify-center my-4">
                                        <img src={pixData.qrCodeImage} alt="QR Code Pix" className="w-48 h-48" />
                                    </div>
                                ) : null}

                                {isPaymentConfirmed ? (
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-3xl mb-4">✅</div>
                                ) : null}

                                <h4 className="text-xl font-bold text-gray-900">{isPaymentConfirmed ? 'Pagamento Confirmado!' : 'Pagamento via Pix'}</h4>
                                <p className="text-sm text-gray-600">
                                    {isPaymentConfirmed
                                        ? 'O pagamento foi identificado com sucesso.'
                                        : 'Utilize o link abaixo para concluir o pagamento.'}
                                </p>

                                {!isPaymentConfirmed && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Código Pix (Copia e Cola)</p>
                                        <div className="break-all text-gray-800 text-xs font-mono bg-white p-2 rounded border border-gray-100 overflow-y-auto max-h-20">
                                            {pixData.pixText}
                                        </div>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(pixData.pixText).then(() => alert("Código copiado!"))}
                                            className="mt-2 text-blue-600 text-xs font-bold underline cursor-pointer hover:text-blue-800"
                                        >
                                            Copiar Código
                                        </button>
                                    </div>
                                )}

                                {!isPaymentConfirmed && (
                                    <Button
                                        onClick={() => {
                                            if (pixData.url) {
                                                window.open(pixData.url, '_blank');
                                            } else {
                                                alert("Link de pagamento não disponível.");
                                            }
                                        }}
                                        className="w-full bg-teal-600 hover:bg-teal-700"
                                    >
                                        Abrir Pagamento
                                    </Button>
                                )}
                                <Button onClick={handleCloseModal} variant="secondary" className="w-full">
                                    Fechar
                                </Button>

                                {/* WhatsApp Button - Conditional Display */}
                                {isPaymentConfirmed && (() => {
                                    const finContact = unitContacts.find(c => c.unit === student.unit && c.role === ContactRole.FINANCIAL);
                                    if (finContact) {
                                        const cleanPhone = finContact.phoneNumber.replace(/\D/g, '');
                                        const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

                                        const message = encodeURIComponent(
                                            `Olá! Segue comprovante.\n\n` +
                                            `*Aluno:* ${student.name}\n` +
                                            `*Série:* ${student.gradeLevel} - ${student.schoolClass}\n` +
                                            `*Unidade:* ${student.unit}\n` +
                                            `*Valor:* R$ ${calculateValue(activeTab === 'mensalidades' ? totalMensalidadesValue : totalSelectedValue, activeTab === 'mensalidades' ? 'mensalidade' : 'evento').toFixed(2).replace('.', ',')}\n\n` +
                                            `*Código Pix:* ${pixData.pixText.substring(0, 20)}...\n\n` +
                                            `*Link do Recibo:* ${pixData.publicUrl || pixData.url || 'N/A'}`
                                        );
                                        return (
                                            <Button onClick={() => window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank')} className="w-full bg-green-500 hover:bg-green-600 flex items-center justify-center gap-2">
                                                <span>📱</span> Enviar Comprovante p/ Financeiro
                                            </Button>
                                        );
                                    }
                                    return null;
                                })()}

                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-3xl">🚀</div>
                                <div className="space-y-4">
                                    <h4 className="text-xl font-bold text-gray-900">Novo Sistema de Pagamentos</h4>
                                    <div className="text-sm text-gray-600 text-left space-y-3 bg-gray-50 p-4 rounded-xl">
                                        <div className="border-b pb-2 mb-2">
                                            <p className="text-xs font-bold text-gray-500 uppercase">Pagador</p>
                                            <p className="font-bold text-gray-800">{student.nome_responsavel || student.name}</p>
                                            <p className="text-xs text-gray-500">CPF: {student.cpf_responsavel || '---'}</p>
                                        </div>
                                        <p><strong>Resumo do Pagamento ({
                                            selectedMethod === 'pix' ? 'Pix' :
                                                selectedMethod === 'debito' ? 'Débito' :
                                                    selectedMethod === 'credito' ? 'Crédito' :
                                                        'Boleto'
                                        }):</strong></p>
                                        <ul className="list-disc list-inside space-y-1 text-xs border-b pb-2 mb-2">
                                            {activeTab === 'mensalidades' ? (
                                                studentMensalidades.filter(m => selectedMensalidades.includes(m.id)).map(m => (
                                                    <li key={m.id}>{m.month}: R$ {calculateValue(m.value, 'mensalidade').toFixed(2).replace('.', ',')}</li>
                                                ))
                                            ) : (
                                                studentEventos.filter(e => selectedEventIds.includes(e.id)).map(e => (
                                                    <li key={e.id}>
                                                        {eventQuantities[e.id] > 1 ? `${eventQuantities[e.id]}x ` : ''}
                                                        {e.description}: R$ {calculateValue(e.value * (eventQuantities[e.id] || 1), 'evento').toFixed(2).replace('.', ',')}
                                                    </li>
                                                ))
                                            )}
                                        </ul>
                                        <p className="text-lg font-bold text-blue-950 flex justify-between items-center">
                                            <span>Total:</span>
                                            <span>R$ {calculateValue(activeTab === 'mensalidades' ? totalMensalidadesValue : totalSelectedValue, activeTab === 'mensalidades' ? 'mensalidade' : 'evento').toFixed(2).replace('.', ',')}</span>
                                        </p>
                                        <p className="text-blue-900 font-bold border-t pt-2 mt-2">Por enquanto, realize o pagamento na secretaria.</p>
                                    </div>
                                </div>
                                <Button onClick={() => setIsModalOpen(false)} className="w-full">Entendi</Button>
                            </>
                        )}
                    </div>
                </div>
            )
            }


            {/* MODAL DE INPUT DE CPF (NOVO) */}
            {
                isCpfModalOpen && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in">
                            <h3 className="text-lg font-bold text-gray-800 mb-2">Dados do Pagador</h3>
                            <p className="text-sm text-gray-500 mb-4">Confirme as informações para registro do Pix.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={nameInput}
                                        onChange={(e) => setNameInput(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Nome do Responsável"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPF (Apenas números)</label>
                                    <input
                                        type="text"
                                        value={cpfInput}
                                        onChange={(e) => setCpfInput(e.target.value.replace(/\D/g, '').substring(0, 11))}
                                        className="w-full p-2 border border-gray-300 rounded-lg font-mono text-center tracking-widest focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="000.000.000-00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone (c/ DDD)</label>
                                    <input
                                        type="tel"
                                        value={phoneInput}
                                        onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                                        className="w-full p-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="84999999999"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">E-mail</label>
                                    <input
                                        type="email"
                                        value={emailInput}
                                        onChange={(e) => setEmailInput(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="email@exemplo.com"
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button onClick={() => setIsCpfModalOpen(false)} variant="secondary" className="w-1/2">
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            if (!nameInput || nameInput.trim().length < 3) {
                                                alert("Nome inválido ou curto demais.");
                                                return;
                                            }
                                            if (cpfInput.length < 11) {
                                                alert("CPF incompleto.");
                                                return;
                                            }
                                            if (!phoneInput || phoneInput.length < 10) {
                                                alert("Telefone inválido.");
                                                return;
                                            }
                                            if (!emailInput || !emailInput.includes('@')) {
                                                alert("Email inválido.");
                                                return;
                                            }
                                            setIsCpfModalOpen(false);
                                            handleCreatePixCharge(cpfInput, nameInput, phoneInput, emailInput);
                                        }}
                                        className="w-1/2 bg-blue-600 hover:bg-blue-700"
                                        disabled={cpfInput.length < 11}
                                    >
                                        Gerar Pix
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
