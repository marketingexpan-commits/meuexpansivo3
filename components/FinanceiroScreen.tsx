import React, { useState } from 'react';
import { Student, Mensalidade, EventoFinanceiro } from '../types';
import { Button } from './Button';

interface FinanceiroScreenProps {
    student: Student;
    mensalidades: Mensalidade[];
    eventos: EventoFinanceiro[];
}

type PaymentMethod = 'pix' | 'debito' | 'credito' | 'boleto';

export const FinanceiroScreen: React.FC<FinanceiroScreenProps> = ({ student, mensalidades, eventos = [] }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'mensalidades' | 'eventos'>('mensalidades');
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('pix');

    // Lógica de Filtro
    const studentMensalidades = mensalidades.filter(m => m.studentId === student.id);
    const studentEventos = eventos.filter(e => e.studentId === student.id);
    const isIsaac = student.metodo_pagamento === 'Isaac';

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

    return (
        <div className="animate-fade-in-up space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <span className="text-3xl">💰</span> Financeiro Interno
                </h3>
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
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2">
                        <span className="text-amber-600 font-bold">⚠️</span>
                        <p className="text-xs text-amber-800 font-medium italic">{getFeeNotice()}</p>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
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
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                                            Nenhuma mensalidade encontrada.
                                        </td>
                                    </tr>
                                )
                            ) : (
                                studentEventos.length > 0 ? (
                                    studentEventos.sort((a, b) => b.dueDate.localeCompare(a.dueDate)).map((e) => (
                                        <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-800">{e.description}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-400 line-through">R$ {e.value.toFixed(2).replace('.', ',')}</span>
                                                    <span className="font-bold text-blue-900">R$ {calculateValue(e.value, 'evento').toFixed(2).replace('.', ',')}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{formatDate(e.dueDate)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusStyle(e.status)}`}>
                                                    {e.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
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
                <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Pagar com Pix, Cartão ou Boleto
                </Button>
            </div>

            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3">
                <span className="text-xl">ℹ️</span>
                <p className="text-xs text-blue-800 leading-relaxed font-medium">
                    Para outras solicitações financeiras, declarações ou negociações, por favor entre em contato diretamente com a secretaria de sua unidade.
                </p>
            </div>

            {/* Modal "Em Breve" Refinado */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-scale-in text-center space-y-6">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-3xl">🚀</div>
                        <div className="space-y-4">
                            <h4 className="text-xl font-bold text-gray-900">Novo Sistema de Pagamentos</h4>
                            <div className="text-sm text-gray-600 text-left space-y-3 bg-gray-50 p-4 rounded-xl">
                                <p><strong>Em breve você poderá pagar diretamente pelo app:</strong></p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>Mensalidades no Crédito (à vista + 6%)</li>
                                    <li>Débito (+ 3%) ou Boleto (com encargos)</li>
                                    <li>Eventos parcelados em até 12x no Crédito</li>
                                    <li>Pix permanece sem taxas extras</li>
                                </ul>
                                <p className="text-blue-900 font-bold border-t pt-2">Por enquanto, realize o pagamento na secretaria.</p>
                            </div>
                        </div>
                        <Button onClick={() => setIsModalOpen(false)} className="w-full">Entendi</Button>
                    </div>
                </div>
            )}
        </div>
    );
};
