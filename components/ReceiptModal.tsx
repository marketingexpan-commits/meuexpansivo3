import React, { useState, useEffect, useMemo } from 'react';
import { Student, Mensalidade } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { Button } from './Button';
import html2canvas from 'html2canvas'; // Kept for possible legacy fallbacks if needed, but primary logic changes
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { SCHOOL_LOGO_URL, UNITS_CONTACT_INFO } from '../constants'; // Import constants

interface ReceiptModalProps {
    isOpen: boolean;
    student: Student;
    receiptData: Mensalidade | null;
    whatsappNumber?: string; // New prop for financial contact
    isAdminView?: boolean; // New prop to hide actions
    onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, student, receiptData, whatsappNumber, isAdminView, onClose }) => {

    // --- Hooks (Must be before early return) ---
    const receiptId = useMemo(() => {
        if (!receiptData) return '';
        // Generate a random ID consistent for this session/render
        return `REC-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    }, [receiptData]);

    const [qrCodeData, setQrCodeData] = useState<string>('');

    useEffect(() => {
        if (receiptData?.id) {
            // Use window.location.origin to support local, production, and staging automatically
            const baseUrl = window.location.origin;
            const validationUrl = `${baseUrl}/validar-recibo/${receiptData.id}`;

            QRCode.toDataURL(validationUrl, { margin: 1, color: { dark: '#000000', light: '#ffffff' } })
                .then(url => setQrCodeData(url))
                .catch(err => console.error(err));
        }
    }, [receiptData]);

    if (!isOpen || !receiptData) return null;

    const UNIT_CNPJ_MAP: Record<string, string> = {
        'Zona Norte': '08.693.673/0001-95',
        'Boa Sorte': '08.693.673/0002-76',
        'Extremoz': '08.693.673/0003-57',
        'Quintas': '08.693.673/0004-38'
    };
    const unitName = student.unit || 'Matriz';
    const cnpj = UNIT_CNPJ_MAP[unitName] || '08.693.673/0001-95';
    const unitInfo = UNITS_CONTACT_INFO.find(u => u.name === unitName) || UNITS_CONTACT_INFO[0];

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
            const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

            // --- 1. Load Assets ---
            const logoUrl = SCHOOL_LOGO_URL;
            // Use component-level receiptId to ensure match
            // const receiptId = ... (Removed, using closure)
            const baseUrl = window.location.origin;
            const qrData = `${baseUrl}/validar-recibo/${receiptData.id}`; // Validation URL matching App.tsx logic
            const qrCodeUrl = await QRCode.toDataURL(qrData, { margin: 0, color: { dark: '#000000', light: '#ffffff' } });

            const logoImg = new Image();
            logoImg.crossOrigin = "Anonymous";
            logoImg.src = logoUrl;

            await new Promise((resolve) => {
                logoImg.onload = resolve;
                logoImg.onerror = () => { console.warn("Logo failed"); resolve(null); };
            });

            // --- 2. Background Watermark (NAVY BLUE) ---
            // Create a canvas to recolor the logo
            const canvas = document.createElement('canvas'); // Create native canvas
            canvas.width = logoImg.width;
            canvas.height = logoImg.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Draw logo
                ctx.drawImage(logoImg, 0, 0);

                // Composite Navy Blue (#000035 - Deep Blue)
                ctx.globalCompositeOperation = 'source-in';
                ctx.fillStyle = '#000035';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Reset to default
                ctx.globalCompositeOperation = 'source-over';

                // Get blue logo data
                const blueLogoData = canvas.toDataURL('image/png');

                // Draw watermark
                doc.saveGraphicsState();
                doc.setGState(new (doc as any).GState({ opacity: 0.08 })); // Slightly more visible for the blue
                const watermarkSize = 120;
                doc.addImage(blueLogoData, 'PNG', (pageWidth - watermarkSize) / 2, (pageHeight - watermarkSize) / 2, watermarkSize, (logoImg.height * watermarkSize) / logoImg.width);
                doc.restoreGraphicsState();
            } else {
                // Fallback to original if canvas fails
                doc.saveGraphicsState();
                doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
                const watermarkSize = 120;
                doc.addImage(logoImg, 'PNG', (pageWidth - watermarkSize) / 2, (pageHeight - watermarkSize) / 2, watermarkSize, (logoImg.height * watermarkSize) / logoImg.width);
                doc.restoreGraphicsState();
            }

            // --- 3. Header ---
            let y = 15;
            const logoWidth = 35;
            const logoHeight = (logoImg.height * logoWidth) / logoImg.width;

            // Logo Left
            doc.addImage(logoImg, 'PNG', 15, y, logoWidth, logoHeight);

            // Receipt Info Right
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(33, 41, 52);
            doc.text("COMPROVANTE DE PAGAMENTO", pageWidth - 15, y + 8, { align: "right" });

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(107, 114, 128); // Gray
            const dateStr = new Date(receiptData.paymentDate || new Date()).toLocaleString();
            doc.text(`${dateStr}  •  #${receiptId}`, pageWidth - 15, y + 14, { align: "right" });

            y += Math.max(logoHeight, 14) + 15;

            // --- 4. Student Info Box ---
            // Centered to avoid gaps
            y += 5;
            const boxHeight = 26;
            doc.setFillColor(249, 250, 251); // Gray-50
            doc.setDrawColor(229, 231, 235); // Gray-200
            doc.roundedRect(15, y, pageWidth - 30, boxHeight, 2, 2, 'FD');

            let boxY = y + 7;
            const col1 = 20;
            const col2 = 90;
            const col3 = 150;

            // Row 1
            doc.setFontSize(8);
            doc.setTextColor(107, 114, 128);
            doc.text("ALUNO(A)", col1, boxY);
            doc.text("MATRÍCULA", col2, boxY);
            doc.text("TURMA", col3, boxY);

            // Row 2 (Values)
            boxY += 5;
            doc.setFontSize(10);
            doc.setTextColor(17, 24, 39); // Gray-900
            doc.setFont("helvetica", "bold");
            doc.text(student.name.toUpperCase(), col1, boxY);
            doc.text(student.code, col2, boxY);
            doc.text(student.gradeLevel, col3, boxY);

            y += boxHeight + 15;

            // --- 5. Payment Details Title ---
            y += 5;
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(33, 41, 52);
            doc.text("Detalhamento do Pagamento", pageWidth / 2, y, { align: "center" });
            y += 8;

            // --- 6. Table ---
            const margins = 15;
            const tableWidth = pageWidth - (margins * 2);
            const colWidths = [90, 30, 30, 30]; // Desc, Orig, Desc, Final
            const colX = [margins, margins + 90, margins + 120, margins + 150];

            // Header
            const headerHeight = 10; // Increased padding
            doc.setFillColor(243, 244, 246); // Gray-100
            doc.rect(margins, y, tableWidth, headerHeight, 'F');
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(75, 85, 99); // Gray-600

            const headerY = y + 6.5; // Centered vertically in 10mm height
            doc.text("DESCRIÇÃO", colX[0] + 3, headerY);
            doc.text("VALOR ORIGINAL", colX[1] + 28, headerY, { align: "right" });
            doc.text("DESC./MULTA", colX[2] + 28, headerY, { align: "right" });
            doc.text("VALOR FINAL", colX[3] + 28, headerY, { align: "right" });

            y += headerHeight;

            // Row (Single Item)
            const rowHeight = 12; // Increased padding
            doc.setFont("helvetica", "normal");
            doc.setTextColor(55, 65, 81); // Gray-700
            const rowY = y + 7.5;

            const refText = `Mensalidade Escolar - ${receiptData.month}`;
            doc.text(refText, colX[0] + 3, rowY);
            doc.text(`R$ ${receiptData.value.toFixed(2).replace('.', ',')}`, colX[1] + 28, rowY, { align: "right" });
            doc.text("R$ 0,00", colX[2] + 28, rowY, { align: "right" });
            doc.setFont("helvetica", "bold");
            doc.text(`R$ ${receiptData.value.toFixed(2).replace('.', ',')}`, colX[3] + 28, rowY, { align: "right" });

            y += rowHeight;

            // Bottom Border
            doc.setDrawColor(229, 231, 235);
            doc.line(margins, y, pageWidth - margins, y);

            y += 10;

            // --- 7. Observations (New Field) ---
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(107, 114, 128);
            doc.text("Observações:", margins, y);

            y += 5;
            // Dotted line for observation
            doc.setDrawColor(209, 213, 219);
            doc.setLineDashPattern([0.5, 1], 0);
            const obsY = y;
            doc.line(margins, obsY, pageWidth - margins, obsY);
            doc.setLineDashPattern([], 0);

            // Optional text if any (currently empty as requested "linha pontilhada ou espaço")
            // doc.text("Pagamento realizado via App.", margins, y - 1); 

            y += 15;

            // --- 8. Reference & Method & TOTAL ---
            // Flex layout logic: Left side = Ref/Method, Right side = Total Badge + Value

            const infoY = y;

            // Left Side
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(107, 114, 128);
            doc.text("Referência:", margins, infoY);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(55, 65, 81);
            doc.text(`Mensalidade Escolar - ${receiptData.month}`, margins + 20, infoY);

            const methodY = infoY + 6;
            doc.setFont("helvetica", "normal");
            doc.setTextColor(107, 114, 128);
            doc.text("Método:", margins, methodY);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(55, 65, 81);
            doc.text(getPaymentMethodLabel(receiptData.paymentMethod), margins + 20, methodY);

            // Right Side - Status Badge AND Total Value Block (Combined)
            // Align "VALOR PAGO" text baseline with "PAGO" badge center visually

            const totalY = infoY + 2; // Slight adjustment to align with left side top

            // "VALOR PAGO" Label
            doc.setFontSize(14);
            doc.setTextColor(17, 24, 39);
            // Calculate width to position elements
            const totalValueText = `R$ ${receiptData.value.toFixed(2).replace('.', ',')}`;
            const totalLabelText = "VALOR PAGO";

            // We want [ Badge ] [ Label ] [ Value ] or [ Label ] [ Badge ] [ Value ]?
            // Request: "Mova o botão verde 'PAGO' para o lado direito, alinhado ao 'VALOR PAGO R$ 1,00'. Eles devem formar um bloco único"
            // Let's do: [PAGO Badge]    VALOR PAGO   R$ 100,00

            doc.setFontSize(22); // Value Size
            const bigValueWidth = doc.getTextWidth(totalValueText);

            doc.setFontSize(14); // Label Size
            const labelW = doc.getTextWidth("VALOR PAGO");

            // Aligning to Right Margin
            const valueStartX = pageWidth - margins - bigValueWidth;
            const labelStartX = valueStartX - labelW - 5; // 5mm spacing
            const badgeWidth = 26;
            const badgeStartX = labelStartX - badgeWidth - 5; // 5mm spacing

            // Center Y for all
            const centerY = totalY;

            // Badge
            const badgeHeight = 7;
            doc.setDrawColor(34, 197, 94);
            doc.setFillColor(220, 252, 231);
            doc.roundedRect(badgeStartX, centerY - 5, badgeWidth, badgeHeight, 1.5, 1.5, 'FD');

            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(21, 128, 61);
            doc.text("PAGO", badgeStartX + 3, centerY - 0.2);

            // Checkmark
            const checkX = badgeStartX + 17;
            const checkY = centerY - 2;
            doc.setDrawColor(21, 128, 61);
            doc.setLineWidth(0.5);
            doc.line(checkX, checkY + 1.5, checkX + 1.5, checkY + 3);
            doc.line(checkX + 1.5, checkY + 3, checkX + 4.5, checkY - 1);

            // Label
            doc.setFontSize(14);
            doc.setTextColor(17, 24, 39);
            doc.text("VALOR PAGO", labelStartX, centerY);

            // Value
            doc.setFontSize(22);
            doc.text(totalValueText, pageWidth - margins, centerY, { align: "right" });

            // --- 9. Footer ---
            const footerY = pageHeight - 40; // Lifted up (was 30)
            const qrSize = 25;

            // Divider
            doc.setDrawColor(229, 231, 235);
            doc.line(margins, footerY - 5, pageWidth - margins, footerY - 5);

            // Unit Info (Left)
            const unitInfo = UNITS_CONTACT_INFO.find(u => u.name === unitName) || UNITS_CONTACT_INFO[0];
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(55, 65, 81);
            doc.text("EXPANSIVO - REDE DE ENSINO", margins, footerY + 5);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(107, 114, 128);
            doc.text(unitInfo.address, margins, footerY + 10);
            doc.text(`Financeiro: ${(whatsappNumber || unitInfo.whatsapp).replace(/\D/g, '').replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4')}`, margins, footerY + 15);
            doc.text(`CNPJ: ${cnpj}`, margins, footerY + 20);

            // QR Code (Right)
            doc.addImage(qrCodeUrl, 'PNG', pageWidth - margins - qrSize, footerY + 2, qrSize, qrSize);
            doc.setFontSize(6);
            doc.text("Validação de Autenticidade", pageWidth - margins - (qrSize / 2), footerY + qrSize + 4, { align: "center" });

            // Save
            const filename = `comprovante_${student.name.replace(/\s+/g, '_')}_${receiptData?.month.replace('/', '-')}.pdf`;
            doc.save(filename);

        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            alert("Erro ao processar o PDF.");
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                    /* Oculta tudo na página, mantendo fluxo */
                    body {
                        visibility: hidden !important;
                        background: white !important;
                    }

                    /* Torna visível apenas o conteúdo do modal e seus filhos */
                    #receipt-modal-content, #receipt-modal-content * {
                        visibility: visible !important;
                    }

                    /* Posiciona o modal no topo da página de impressão */
                    #receipt-modal-content {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        margin: 0 !important;
                        padding: 20px !important;
                        width: 100% !important;
                        height: auto !important;
                        z-index: 9999 !important;
                        background: white !important;
                        box-shadow: none !important;
                        border: none !important;
                    }

                    /* Esconde botões e elementos não imprimíveis */
                    .no-print, button { display: none !important; }
                    
                    /* Imprime apenas o conteúdo essencial */
                    @page {
                        size: auto; /* auto is the initial value */
                        margin: 0mm; /* this affects the margin in the printer settings */
                    }
                }
            `}</style>

            <div id="receipt-modal-content" className="bg-white rounded-2xl p-6 sm:p-8 w-[95%] sm:w-full max-w-xl shadow-2xl animate-scale-in relative border border-gray-100 max-h-[90vh] overflow-y-auto overflow-x-hidden">

                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.05]">
                    <img src={SCHOOL_LOGO_URL} alt="" className="w-3/4 grayscale" />
                </div>

                {/* Content Container */}
                <div className="relative z-10 font-sans text-gray-800">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start mb-6 text-center sm:text-left gap-4">
                        <SchoolLogo variant="print" className="w-32" />
                        <div className="sm:text-right">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Comprovante</h2>
                            <p className="text-xs text-gray-500 font-mono mt-1">
                                {new Date(receiptData.paymentDate || new Date()).toLocaleString()}
                                <br />#{receiptId}
                            </p>
                        </div>
                    </div>

                    {/* Student Info Box */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-900"></div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Aluno(a)</p>
                                <p className="font-bold text-gray-900 uppercase truncate text-sm">{student.name}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5 sm:text-center">Matrícula</p>
                                <p className="font-bold text-gray-900 text-sm sm:text-center">{student.code}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5 sm:text-right">Turma</p>
                                <p className="font-bold text-gray-900 text-sm sm:text-right">{student.gradeLevel}</p>
                            </div>
                        </div>
                    </div>

                    {/* Title Detalhamento */}
                    <h3 className="text-center font-bold text-gray-800 text-sm mb-4 uppercase tracking-wider">Detalhamento do Pagamento</h3>

                    {/* Table */}
                    <div className="mb-6">
                        <div className="bg-gray-100 px-4 py-2 rounded-t-lg flex text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            <div className="flex-grow">Descrição</div>
                            <div className="w-24 text-right hidden sm:block">Valor Orig.</div>
                            <div className="w-20 text-right hidden sm:block">Desc/Multa</div>
                            <div className="w-28 text-right">Valor Final</div>
                        </div>
                        <div className="border border-t-0 border-gray-200 rounded-b-lg px-4 py-3 flex text-sm text-gray-700 items-center">
                            <div className="flex-grow pr-2">
                                <span className="block font-bold text-gray-800 text-xs sm:text-sm">Mensalidade Escolar</span>
                                <span className="text-[10px] sm:text-xs text-gray-500">{receiptData.month}</span>
                            </div>
                            <div className="w-24 text-right hidden sm:block text-gray-400 text-xs">R$ {receiptData.value.toFixed(2).replace('.', ',')}</div>
                            <div className="w-20 text-right hidden sm:block text-gray-400 text-xs">R$ 0,00</div>
                            <div className="w-28 text-right font-black text-gray-900 text-sm">R$ {receiptData.value.toFixed(2).replace('.', ',')}</div>
                        </div>
                    </div>

                    {/* Observations */}
                    <div className="mb-8">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Observações:</p>
                        <div className="border-b-2 border-dotted border-gray-200 w-full mb-2"></div>
                    </div>

                    {/* Footer Info Row - Payment Details & Total */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8 bg-gray-50/50 p-4 rounded-xl border border-dashed border-gray-200">
                        <div className="space-y-2 text-xs w-full sm:w-auto">
                            <div className="flex justify-between sm:justify-start gap-4 border-b sm:border-0 border-gray-100 pb-2 sm:pb-0">
                                <span className="text-gray-500">Referência:</span>
                                <span className="font-bold text-gray-800">Mensalidade - {receiptData.month}</span>
                            </div>
                            <div className="flex justify-between sm:justify-start gap-4">
                                <span className="text-gray-500">Método:</span>
                                <span className="font-bold text-gray-800">{getPaymentMethodLabel(receiptData.paymentMethod)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pl-0 sm:pl-8 border-l-0 sm:border-l-2 border-gray-200">
                            {/* Badge PAGO */}
                            <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1 border border-green-200">
                                PAGO
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            </div>

                            <div className="text-right">
                                <span className="text-[10px] font-bold text-gray-500 uppercase block leading-none mb-1">Valor Pago</span>
                                <span className="text-2xl font-black text-gray-900 leading-none block">R$ {receiptData.value.toFixed(2).replace('.', ',')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Bottom - Unit Info & QR */}
                    <div className="border-t border-gray-200 pt-6 flex flex-col sm:flex-row justify-between items-center sm:items-end gap-6 text-center sm:text-left">
                        <div className="text-[10px] text-gray-500 space-y-1">
                            <strong className="block text-gray-800 uppercase text-xs mb-1">EXPANSIVO - REDE DE ENSINO</strong>
                            <p>{unitInfo.address}</p>
                            <p className="font-medium text-gray-600">Financeiro: {(whatsappNumber || unitInfo.whatsapp || '').replace(/\D/g, '').replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4')}</p>
                            <p>CNPJ: {cnpj}</p>
                        </div>

                        {qrCodeData && (
                            <div className="flex flex-col items-center gap-1 opacity-80">
                                <img src={qrCodeData} alt="QR Code" className="w-16 h-16 mix-blend-multiply" />
                                <span className="text-[8px] text-gray-400 uppercase font-bold tracking-widest">Autenticidade</span>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer Actions (Hidden on Print) */}
                <div className="mt-8 space-y-3 no-print border-t border-gray-100 pt-6">

                    {/* WhatsApp Button - Hidden for Admins */}
                    {whatsappNumber && !isAdminView && (
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
