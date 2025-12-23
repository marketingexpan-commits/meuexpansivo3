import React from 'react';
import { Student, Mensalidade } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { Button } from './Button';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ReceiptModalProps {
    isOpen: boolean;
    student: Student;
    receiptData: Mensalidade | null;
    whatsappNumber?: string; // New prop for financial contact
    onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, student, receiptData, whatsappNumber, onClose }) => {
    if (!isOpen || !receiptData) return null;

    const UNIT_CNPJ_MAP: Record<string, string> = {
        'Zona Norte': '08.693.673/0001-95',
        'Boa Sorte': '08.693.673/0002-76',
        'Extremoz': '08.693.673/0003-57',
        'Quintas': '08.693.673/0004-38'
    };
    const unitName = student.unit || 'Matriz';
    const cnpj = UNIT_CNPJ_MAP[unitName] || '08.693.673/0001-95';

    const getPaymentMethodLabel = (method?: string) => {
        if (!method) return 'Pix / Cartão';
        const m = method.toLowerCase();

        // Mapeamento correto dos IDs do Mercado Pago
        if (m.includes('pix')) return 'Pix';
        if (m.includes('boleto') || m.includes('bolbradesco') || m.includes('pec')) return 'Boleto Bancário';
        if (m.includes('credit') || m.includes('credito') || m === 'master' || m === 'visa' || m === 'elo' || m === 'hipercard' || m === 'amex') return 'Cartão de Crédito';
        if (m.includes('debit') || m.includes('debito')) return 'Cartão de Débito';
        if (m.includes('account') || m.includes('money')) return 'Saldo Mercado Pago';

        // Tratamento de códigos internos/fallback
        if (m.includes('mercadopago')) return 'Pix / Cartão';

        // Fallback final: Capitalizar primeira letra
        return method.charAt(0).toUpperCase() + method.slice(1);
    };

    const handleShare = async () => {
        const input = document.getElementById('receipt-modal-content');
        if (!input) return;

        // Temporarily hide buttons for capture
        const buttons = input.querySelectorAll('button');
        buttons.forEach(b => b.style.display = 'none');

        try {
            const canvas = await html2canvas(input, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4' // A4 format
            });

            const imgWidth = 210; // A4 width in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

            // Generate filename unique
            const filename = `comprovante_${student.name.replace(/\s+/g, '_')}_${receiptData?.month.replace('/', '-')}.pdf`;

            // Salva o PDF
            pdf.save(filename);

        } catch (error) {
            console.error("Erro ao gerar/compartilhar PDF:", error);
            alert("Erro ao processar o comprovante. Tente usar a opção 'Imprimir'.");
        } finally {
            // Restore buttons
            buttons.forEach(b => b.style.display = '');
        }
    };

    const handleOpenWhatsApp = () => {
        if (!whatsappNumber) return;

        const phone = whatsappNumber.replace(/\D/g, '');

        // Mensagem detalhada com VALOR explícito
        const message = `*COMPROVANTE DE PAGAMENTO*\n\n` +
            `*Beneficiário:* Expansivo - Rede de Ensino (Uni. ${unitName})\n` +
            `*Pagador:* ${student.nome_responsavel || student.name}\n\n` +
            `*Aluno(a):* ${student.name}\n` +
            `*Matrícula:* ${student.code}\n` +
            `*Turma:* ${student.gradeLevel}\n\n` +
            `*Referência:* ${receiptData?.month}\n` +
            `*Valor:* R$ ${receiptData?.value.toFixed(2).replace('.', ',')}\n` +
            `*Status:* ${receiptData?.status === 'Pago' ? 'PAGO [OK]' : receiptData?.status}\n\n` +
            `_Olá, estou enviando o comprovante de pagamento._`;

        const url = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            {/* CSS for Printing */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #receipt-modal-content, #receipt-modal-content * { visibility: visible; }
                    #receipt-modal-content { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: none; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div id="receipt-modal-content" className="bg-white rounded-2xl p-6 sm:p-8 w-[95%] sm:w-full max-w-sm shadow-2xl animate-scale-in relative border border-gray-100">

                {/* Receipt Header */}
                <div className="text-center border-b-2 border-dashed border-gray-200 pb-6 mb-6">
                    <div className="mb-4 flex justify-center">
                        <SchoolLogo variant="print" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">Comprovante</h3>
                    <p className="text-xs text-gray-500 font-mono mt-1">{new Date(receiptData.paymentDate || new Date()).toLocaleString()}</p>
                </div>

                {/* Receipt Details */}
                <div className="space-y-4 text-sm font-mono text-gray-700">

                    {/* Unit & Beneficiary */}
                    <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                        <span className="text-gray-500 text-xs uppercase">Beneficiário</span>
                        <div className="text-right">
                            <span className="font-bold text-gray-900 block">Expansivo - Rede de Ensino</span>
                            <span className="text-xs text-gray-600 uppercase block">Uni. {unitName}</span>
                            <span className="text-[10px] text-gray-400 block font-sans">CNPJ: {cnpj}</span>
                        </div>
                    </div>

                    {/* Payer Info */}
                    <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                        <span className="text-gray-500 text-xs uppercase">Pagador</span>
                        <span className="font-bold text-gray-900 text-right w-40 truncate">{student.nome_responsavel || student.name}</span>
                    </div>

                    {/* Student Detailed Info */}
                    <div className="py-2 bg-gray-50 rounded-lg px-3 space-y-1">
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-xs">Aluno(a):</span>
                            <span className="font-bold text-gray-900 text-right">{student.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-xs">Matrícula:</span>
                            <span className="font-mono text-gray-900">{student.code}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-xs">Turma/Série:</span>
                            <span className="text-gray-900">{student.gradeLevel}</span>
                        </div>
                    </div>

                    {/* Transaction Info */}
                    <div className="space-y-2 pt-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Referência:</span>
                            <span className="font-bold text-gray-900">{receiptData.month}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Método:</span>
                            <span className="font-bold text-gray-900">{getPaymentMethodLabel(receiptData.paymentMethod)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Status:</span>
                            <span className={`font-bold uppercase ${receiptData.status === 'Pago' ? 'text-green-700' : 'text-gray-500'}`}>
                                {receiptData.status === 'Pago' ? 'PAGO ✅' : receiptData.status}
                            </span>
                        </div>
                    </div>

                    {/* Total Value */}
                    <div className="my-4 border-t-2 border-dashed border-gray-300 pt-4">
                        <div className="flex justify-between items-center text-lg">
                            <span className="font-black text-gray-900 uppercase">Valor Total</span>
                            <span className="font-black text-gray-900">R$ {receiptData.value.toFixed(2).replace('.', ',')}</span>
                        </div>
                    </div>
                </div>

                {/* Footer Actions (Hidden on Print) */}
                <div className="mt-8 space-y-3 no-print">

                    {/* WhatsApp Button */}
                    {whatsappNumber && (
                        <div className="space-y-2 mb-4">
                            <Button onClick={handleOpenWhatsApp} className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl shadow-lg flex items-center justify-center gap-2">
                                <span className="text-2xl">📱</span>
                                <span className="font-bold text-lg">Falar com Financeiro</span>
                            </Button>
                            <p className="text-xs text-center text-gray-500 px-4">
                                💡 Dica: Baixe o PDF abaixo e anexe na conversa para agilizar o atendimento.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Button onClick={() => window.print()} variant="outline" className="w-full flex items-center justify-center gap-2">
                            🖨️ Imprimir
                        </Button>
                        <Button onClick={handleShare} variant="outline" className="w-full flex items-center justify-center gap-2">
                            💾 Baixar PDF
                        </Button>
                    </div>

                    <Button onClick={onClose} className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-xl shadow-lg">
                        Fechar Comprovante
                    </Button>
                </div>

                {/* Decorative jagged edge bottom (CSS) */}
                <div className="absolute bottom-0 left-0 w-full h-4 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMCAxMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+PHBhdGggZD0iTTAgMTBMMTAgMEwyMCAxMFoiIGZpbGw9IndoaXRlIi8+PC9zdmc+')] opacity-0"></div>
            </div>
        </div >
    );
};
