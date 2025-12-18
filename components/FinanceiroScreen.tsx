import React, { useState } from 'react';
import { Student, Mensalidade } from '../types';
import { Button } from './Button';

interface FinanceiroScreenProps {
    student: Student;
    mensalidades: Mensalidade[];
}

export const FinanceiroScreen: React.FC<FinanceiroScreenProps> = ({ student, mensalidades }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Lógica de Filtro
    const studentMensalidades = mensalidades.filter(m => m.studentId === student.id);
    const isIsaac = student.metodo_pagamento === 'Isaac';
    const isInterno = student.metodo_pagamento === 'Interno' || studentMensalidades.length > 0;

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
        // Se já estiver no formato DD/MM/AAAA, retorna direto
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;

        try {
            // Tenta converter de YYYY-MM-DD para DD/MM/AAAA
            const date = new Date(dateStr + 'T00:00:00');
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('pt-BR');
        } catch (e) {
            return dateStr;
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
                        onClick={() => window.open('https://portal.isaac.com.br', '_blank')}
                        className="w-full sm:w-auto px-8"
                    >
                        Ir para o Portal Isaac
                    </Button>
                </div>
            </div>
        );
    }

    if (isInterno) {
        return (
            <div className="animate-fade-in-up space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-3xl">💰</span> Financeiro Interno
                    </h3>
                    <Button onClick={() => setIsModalOpen(true)} variant="primary" className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Pagar com Pix, Cartão ou Boleto
                    </Button>
                </div>

                <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Mês</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Valor</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Vencimento</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {studentMensalidades.length > 0 ? (
                                    studentMensalidades.sort((a, b) => b.dueDate.localeCompare(a.dueDate)).map((m) => (
                                        <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-800">{m.month}</td>
                                            <td className="px-6 py-4 text-gray-700">R$ {m.value.toFixed(2).replace('.', ',')}</td>
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
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3">
                    <span className="text-xl">ℹ️</span>
                    <p className="text-xs text-blue-800 leading-relaxed font-medium">
                        Para outras solicitações financeiras, declarações ou negociações, por favor entre em contato diretamente com a secretaria de sua unidade.
                    </p>
                </div>

                {/* Modal "Em Breve" */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-scale-in text-center space-y-6">
                            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-3xl">🚀</div>
                            <div className="space-y-2">
                                <h4 className="text-xl font-bold text-gray-900">Pagamento Digital em Breve!</h4>
                                <p className="text-sm text-gray-600">
                                    Em breve, você poderá realizar seus pagamentos via <strong>Pix, Cartão de Crédito ou Boleto Bancário</strong> diretamente pelo aplicativo.
                                    <br /><br />
                                    Por enquanto, realize o pagamento na secretaria.
                                </p>
                            </div>
                            <Button onClick={() => setIsModalOpen(false)} className="w-full">Entendi</Button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="py-12 text-center text-gray-500 italic bg-white rounded-2xl border border-dashed border-gray-300">
            Informações financeiras indisponíveis para este perfil.
        </div>
    );
};
