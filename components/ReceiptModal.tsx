import React from 'react';
import { Student, Mensalidade } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { Button } from './Button';
import html2canvas from 'html2canvas'; // Kept for possible legacy fallbacks if needed, but primary logic changes
import { jsPDF } from 'jspdf';
import { SCHOOL_LOGO_URL } from '../constants'; // Import logo URL

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
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth(); // 210mm

            // --- 1. Load Logo ---
            // Load the logo asynchronously to ensure it's ready for the PDF
            const logoUrl = SCHOOL_LOGO_URL;
            const logoImg = new Image();
            logoImg.crossOrigin = "Anonymous";
            logoImg.src = logoUrl;

            await new Promise((resolve) => {
                logoImg.onload = resolve;
                logoImg.onerror = () => {
                    console.warn("Logo failed to load for PDF");
                    resolve(null);
                };
            });

            // --- 2. Build Receipt Content ---

            // Logo (Centered)
            const logoWidth = 35;
            const logoHeight = (logoImg.height * logoWidth) / logoImg.width;
            const logoX = (pageWidth - logoWidth) / 2;
            doc.addImage(logoImg, 'PNG', logoX, 15, logoWidth, logoHeight);

            // Title
            let y = 15 + logoHeight + 10;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.setTextColor(33, 41, 52); // Dark
            doc.text("COMPROVANTE", pageWidth / 2, y, { align: "center" });

            // Date
            y += 7;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(107, 114, 128); // Gray
            doc.text(new Date(receiptData.paymentDate || new Date()).toLocaleString(), pageWidth / 2, y, { align: "center" });

            // Divider
            y += 8;
            doc.setDrawColor(229, 231, 235); // Gray-200
            doc.line(20, y, pageWidth - 20, y);

            // Details Section
            y += 15;
            const leftX = 20;
            const rightX = pageWidth - 20;

            // Beneficiary
            doc.setFontSize(9);
            doc.setTextColor(107, 114, 128);
            doc.text("BENEFICIÁRIO", leftX, y);

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            doc.text("Expansivo - Rede de Ensino", rightX, y, { align: "right" });

            y += 5;
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(`UNI. ${unitName.toUpperCase()}`, rightX, y, { align: "right" });

            y += 5;
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175); // Gray-400
            doc.text(`CNPJ: ${cnpj}`, rightX, y, { align: "right" });

            y += 15; // Spacer

            // Payer
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(107, 114, 128);
            doc.text("PAGADOR", leftX, y);

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            doc.text((student.nome_responsavel || student.name).toUpperCase(), rightX, y, { align: "right" });

            y += 15;

            // Student Info Box (Rounded Rect)
            const boxTop = y;
            const boxHeight = 28;
            doc.setFillColor(249, 250, 251); // Gray-50
            doc.setDrawColor(243, 244, 246); // Gray-100
            doc.roundedRect(leftX, boxTop, pageWidth - 40, boxHeight, 3, 3, 'FD');

            let boxY = boxTop + 8;
            const labelX = leftX + 5;
            const valueX = rightX - 5;

            // Name
            doc.setFontSize(10);
            doc.setTextColor(107, 114, 128);
            doc.setFont("helvetica", "normal");
            doc.text("Aluno(a):", labelX, boxY);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text(student.name.toUpperCase(), valueX, boxY, { align: "right" });

            boxY += 7;
            // Matricula
            doc.setFont("helvetica", "normal");
            doc.setTextColor(107, 114, 128);
            doc.text("Matrícula:", labelX, boxY);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text(student.code, valueX, boxY, { align: "right" });

            boxY += 7;
            // Turma
            doc.setFont("helvetica", "normal");
            doc.setTextColor(107, 114, 128);
            doc.text("Turma/Série:", labelX, boxY);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text(student.gradeLevel, valueX, boxY, { align: "right" });

            y = boxTop + boxHeight + 15;

            // Reference
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(107, 114, 128);
            doc.text("Referência:", leftX, y);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text(receiptData.month, rightX, y, { align: "right" });

            y += 8;
            // Method
            doc.setFont("helvetica", "normal");
            doc.setTextColor(107, 114, 128);
            doc.text("Método:", leftX, y);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 0, 0);
            doc.text(getPaymentMethodLabel(receiptData.paymentMethod), rightX, y, { align: "right" });

            y += 8;
            // Status
            doc.setFont("helvetica", "normal");
            doc.setTextColor(107, 114, 128);
            doc.text("Status:", leftX, y);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(22, 163, 74); // Green-600
            doc.text("PAGO [OK]", rightX, y, { align: "right" });

            y += 12;
            // Dashed Divider
            doc.setDrawColor(209, 213, 219); // Gray-300
            doc.setLineDashPattern([1, 1], 0);
            doc.line(leftX, y, rightX, y);
            doc.setLineDashPattern([], 0);

            y += 12;
            // Total
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            doc.text("VALOR TOTAL", leftX, y);

            doc.setFontSize(18);
            doc.text(`R$ ${receiptData.value.toFixed(2).replace('.', ',')}`, rightX, y, { align: "right" });

            // Generate filename unique
            const filename = `comprovante_${student.name.replace(/\s+/g, '_')}_${receiptData?.month.replace('/', '-')}.pdf`;

            doc.save(filename);

        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            alert("Erro ao processar o PDF.");
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
                    #receipt-modal-content { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100%; 
                        max-height: none; /* Ensure full height on print */
                        overflow: visible; 
                        box-shadow: none; 
                        border: none; 
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div id="receipt-modal-content" className="bg-white rounded-2xl p-6 sm:p-8 w-[95%] sm:w-full max-w-sm shadow-2xl animate-scale-in relative border border-gray-100 max-h-[90vh] overflow-y-auto">

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
                        <div className="text-right">
                            <span className="font-bold text-gray-900 block uppercase">{student.nome_responsavel || student.name}</span>
                        </div>
                    </div>

                    {/* Student Info Box */}
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                            <span className="text-gray-500">Aluno(a):</span>
                            <span className="font-bold text-gray-900 uppercase text-right">{student.name}</span>

                            <span className="text-gray-500">Matrícula:</span>
                            <span className="font-bold text-gray-900 text-right">{student.code}</span>

                            <span className="text-gray-500">Turma/Série:</span>
                            <span className="font-bold text-gray-900 text-right">{student.gradeLevel}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center py-1">
                        <span className="text-gray-500">Referência:</span>
                        <span className="font-bold text-gray-900">{receiptData.month}</span>
                    </div>

                    <div className="flex justify-between items-center py-1">
                        <span className="text-gray-500">Método:</span>
                        <span className="font-bold text-gray-900">{getPaymentMethodLabel(receiptData.paymentMethod)}</span>
                    </div>

                    <div className="flex justify-between items-center py-1">
                        <span className="text-gray-500">Status:</span>
                        <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded uppercase text-xs border border-green-100">
                            PAGO ✅
                        </span>
                    </div>

                </div>

                {/* Total Line */}
                <div className="border-t-2 border-dashed border-gray-200 mt-6 pt-6 mb-6">
                    <div className="flex justify-between items-end">
                        <span className="text-lg font-black text-gray-900 uppercase">Valor Total</span>
                        <span className="text-2xl font-black text-gray-900">R$ {receiptData.value.toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>

                {/* Footer Actions (Hidden on Print) */}
                <div className="mt-8 space-y-3 no-print">

                    {/* WhatsApp Button */}
                    {whatsappNumber && (
                        <div className="space-y-2 mb-4">
                            <Button onClick={handleOpenWhatsApp} className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors">
                                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                </svg>
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
