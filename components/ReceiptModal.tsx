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

    // --- Financial Breakdown Logic (Derived for Paid) ---
    const calculateFinancialsForPaid = (m: Mensalidade) => {
        const baseVal = m.value;
        if (!m.paymentDate || student.isScholarship) {
            return { fine: 0, interest: 0, originalValue: baseVal, total: baseVal };
        }
        const strictDueDate = new Date(new Date(m.dueDate).setDate(10));
        strictDueDate.setHours(23, 59, 59, 999);
        const paymentDate = new Date(m.paymentDate);
        if (paymentDate > strictDueDate) {
            const diffTime = Math.abs(paymentDate.getTime() - strictDueDate.getTime());
            const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const fine = baseVal * 0.02; // 2%
            const interest = baseVal * (0.00033 * daysLate); // 0.033% per day
            return { fine, interest, originalValue: baseVal, total: baseVal + fine + interest };
        }
        return { fine: 0, interest: 0, originalValue: baseVal, total: baseVal };
    };

    const fin = calculateFinancialsForPaid(receiptData);

    const UNIT_CNPJ_MAP: Record<string, string> = {
        'Zona Norte': '08.693.673/0001-95',
        'Boa Sorte': '08.693.673/0002-76',
        'Extremoz': '08.693.673/0003-57',
        'Quintas': '08.693.673/0004-38'
    };
    const unitName = student.unit || 'Matriz';
    const cnpj = UNIT_CNPJ_MAP[unitName] || '08.693.673/0001-95';
    const unitInfo = UNITS_CONTACT_INFO.find(u => u.name === unitName) || UNITS_CONTACT_INFO[0];

    const maskCpfDisplay = (cpf: string | undefined): string => {
        if (!cpf) return 'NÃO INFORMADO';
        const clean = cpf.replace(/\D/g, '');
        if (clean.length !== 11) return cpf;
        return `***.${clean.substring(3, 6)}.***-${clean.substring(9)}`;
    };

    const getPaymentMethodLabel = (method?: string) => {
        if (!method) return 'Não Informado';
        const m = method.toLowerCase();

        // Mapeamento correto dos IDs do Mercado Pago
        if (m.includes('pix')) return 'Pix';
        if (m.includes('boleto') || m.includes('bolbradesco') || m.includes('ticket') || m.includes('pec')) return 'Boleto Bancário';
        if (m.includes('credit') || m.includes('credito') || m === 'master' || m === 'visa' || m === 'elo' || m === 'hipercard' || m === 'amex') return 'Cartão de Crédito';
        if (m.includes('debit') || m.includes('debito')) return 'Cartão de Débito';
        if (m.includes('account') || m.includes('money')) return 'Saldo Mercado Pago';

        // Tratamento de códigos internos/fallback
        if (m.includes('mercadopago')) return 'Mercado Pago (Online)';

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
            const baseUrl = window.location.origin;
            const qrData = `${baseUrl}/validar-recibo/${receiptData.id}`;
            const qrCodeUrl = await QRCode.toDataURL(qrData, { margin: 0, color: { dark: '#000000', light: '#ffffff' } });

            const logoImg = new Image();
            logoImg.crossOrigin = "Anonymous";
            logoImg.src = logoUrl;

            await new Promise((resolve) => {
                logoImg.onload = resolve;
                logoImg.onerror = () => { console.warn("Logo failed"); resolve(null); };
            });

            // --- 2. Watermark Processing --- 
            const canvas = document.createElement('canvas');
            canvas.width = logoImg.width;
            canvas.height = logoImg.height;
            const ctx = canvas.getContext('2d');
            let watermarkImg = logoImg;
            if (ctx) {
                ctx.drawImage(logoImg, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    data[i] = avg;
                    data[i + 1] = avg;
                    data[i + 2] = avg;
                }
                ctx.putImageData(imageData, 0, 0);
                const grayscaleLogo = new Image();
                grayscaleLogo.src = canvas.toDataURL('image/png');
                await new Promise(r => grayscaleLogo.onload = r);
                watermarkImg = grayscaleLogo;
            }


            // --- 3. Page & Card Setup (High-Fidelity) ---
            const cardW = 116; // 145 * 0.8
            const cardH = 176; // 220 * 0.8
            const startX = (pageWidth - cardW) / 2;
            const startY = (pageHeight - cardH) / 2;

            // --- 3.1 Premium Soft Shadow (Multi-layered low opacity) ---
            doc.saveGraphicsState();
            doc.setFillColor(0, 0, 0);
            const shadowLayers = [
                { offset: 0.5, op: 0.02, r: 5 },
                { offset: 1.0, op: 0.015, r: 5.5 },
                { offset: 1.5, op: 0.01, r: 6 },
                { offset: 2.0, op: 0.005, r: 6.5 }
            ];
            shadowLayers.forEach(s => {
                doc.setGState(new (doc as any).GState({ opacity: s.op }));
                doc.roundedRect(startX + s.offset, startY + s.offset, cardW, cardH, s.r, s.r, 'F');
            });
            doc.restoreGraphicsState();

            // --- 3.2 Card Body ---
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.1);
            doc.roundedRect(startX, startY, cardW, cardH, 5, 5, 'FD');

            // --- 3.3 Internal Padding Config ---
            const p = 8;
            const cX = startX + p;
            const cEnd = startX + cardW - p;
            const cW = cardW - (p * 2);

            // -------------------------------------------------------------------------
            // PHASE 1: LAYOUT & BACKGROUNDS (Drawn before Watermark)
            // -------------------------------------------------------------------------

            // Header Heights
            const logoWidth = 24;
            const logoHeight = (logoImg.height * logoWidth) / logoImg.width;

            // Y Anchors Calculation
            const headerY = startY + 12.8;
            const gridStartY = headerY + Math.max(logoHeight, 11.2) + 6.4;
            const gridH = 31.2;

            const paymentDetailsTitleY = gridStartY + gridH + 8;
            const tableY = paymentDetailsTitleY + 3.2;
            const tableH = 17.6;

            const obsY = tableY + tableH + 8; // Approx
            // Status block later

            // --- Draw Student Info Box Background (White + Blue Strip) ---
            // Drawn here so Watermark sits ON TOP
            doc.setFillColor(3, 7, 53); // Blue-950 for rounding
            doc.roundedRect(cX, gridStartY, cW, gridH, 3, 3, 'F');
            doc.setFillColor(3, 7, 53);
            doc.roundedRect(cX, gridStartY, cW, gridH, 3, 3, 'F');
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(cX + 0.8, gridStartY, cW - 0.8, gridH, 3, 3, 'F');

            // --- Draw Payment Table Background (Gray Header + White Body + Blue Strip) ---
            // Drawn here so Watermark sits ON TOP
            // Header Fill
            doc.setFillColor(243, 244, 246);
            doc.saveGraphicsState();
            doc.roundedRect(cX, tableY, cW, 8, 3, 3, 'F');
            doc.rect(cX, tableY + 4, cW, 4, 'F');
            doc.restoreGraphicsState();

            // Blue Strip Background logic
            doc.setFillColor(3, 7, 53);
            doc.roundedRect(cX, tableY, cW, tableH, 3, 3, 'F');

            // Masks
            // Header Mask
            doc.setFillColor(243, 244, 246);
            doc.roundedRect(cX + 0.8, tableY, cW - 0.8, 8, 3, 3, 'F');
            doc.rect(cX + 0.8, tableY + 4, cW - 0.8, 4, 'F');

            // Body Mask (White)
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(cX + 0.8, tableY + 8, cW - 0.8, tableH - 8, 3, 3, 'F');
            doc.rect(cX + 0.8, tableY + 8, cW - 0.8, 4, 'F');

            // -------------------------------------------------------------------------
            // PHASE 2: WATERMARK (Drawn ON TOP of Backgrounds)
            // -------------------------------------------------------------------------
            // --- 3.4 Watermark (Subtle & Centered in Card) ---
            doc.saveGraphicsState();
            doc.setGState(new (doc as any).GState({ opacity: 0.04 }));
            const watermarkSize = 97; // 121 * 0.8
            const wmX = startX + (cardW - watermarkSize) / 2;
            const wmY = startY + (cardH - (logoImg.height * watermarkSize) / logoImg.width) / 2 + 5;
            doc.addImage(watermarkImg, 'PNG', wmX, wmY, watermarkSize, (logoImg.height * watermarkSize) / logoImg.width);
            doc.restoreGraphicsState();

            // -------------------------------------------------------------------------
            // PHASE 3: CONTENT & TEXT (Drawn ON TOP of Watermark)
            // -------------------------------------------------------------------------

            // --- 4. Header Content ---
            let y = headerY;
            doc.addImage(logoImg, 'PNG', cX, y, logoWidth, logoHeight);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(14.4);
            doc.setTextColor(3, 7, 18);
            doc.text("Comprovante", cEnd, y + 4, { align: "right" });

            doc.setFontSize(6);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(110, 110, 110);
            const dateStr = new Date(receiptData.paymentDate || new Date()).toLocaleString();
            doc.text(`${dateStr}`, cEnd, y + 7.2, { align: "right" });
            doc.text(`#${receiptId}`, cEnd, y + 10.4, { align: "right" });

            // Jump to Student Info Grid
            y = gridStartY;

            // --- 5. Information Grid Content ---
            // Note: Backgrounds ALREADY drawn in Phase 1. Just text & lines now.

            const renderGridRow = (l1: string, v1: string, l2: string, v2: string, rowY: number, isLast: boolean) => {
                // Labels (Gray, Small)
                doc.setFontSize(5.2); doc.setTextColor(120, 120, 120); doc.setFont("helvetica", "bold");
                doc.text(l1.toUpperCase(), cX + 4, rowY + 3.2);
                doc.text(l2.toUpperCase(), cEnd - 3.2, rowY + 3.2, { align: "right" });

                // Values (Navy, Bold)
                doc.setFontSize(7.6); doc.setTextColor(3, 7, 18); doc.setFont("helvetica", "bold");
                doc.text(v1.toUpperCase(), cX + 4, rowY + 7.2);
                doc.text(v2.toUpperCase(), cEnd - 3.2, rowY + 7.2, { align: "right" });

                // Bottom horizontal line (Except last row)
                if (!isLast) {
                    doc.setDrawColor(229, 231, 235);
                    doc.setLineWidth(0.1);
                    doc.line(cX + 0.8, rowY + 10.4, cEnd, rowY + 10.4);
                }
                return rowY + 10.4;
            };

            let currentGridY = y;
            currentGridY = renderGridRow("ALUNO(A)", student.name, "MATRÍCULA", student.code, currentGridY, false);
            currentGridY = renderGridRow("SÉRIE/ANO", student.gradeLevel, "TURMA/TURNO", `${student.schoolClass} - ${student.shift}`, currentGridY, false);
            currentGridY = renderGridRow("RESPONSÁVEL FINANCEIRO", (student.nome_responsavel || student.name), "CPF DO RESPONSÁVEL", maskCpfDisplay(student.cpf_responsavel), currentGridY, true);

            // Draw Stroke LAST (Top Layer Stroke)
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.1);
            doc.roundedRect(cX, y, cW, gridH, 3, 3, 'D');

            y = currentGridY + 8;

            // --- 6. DETALHAMENTO DO PAGAMENTO ---
            doc.setFontSize(6.8); doc.setFont("helvetica", "bold"); doc.setTextColor(55, 65, 81);
            doc.text("DETALHAMENTO DO PAGAMENTO", startX + cardW / 2, y, { align: "center" });
            y = tableY; // Force sync to pre-calculated Table Y

            // Table Content (Backgrounds already drawn)

            // Header Text
            doc.setFontSize(6); doc.setTextColor(107, 114, 128); doc.setFont("helvetica", "bold");
            doc.text("DESCRIÇÃO", cX + 4, y + 5.2);
            doc.text("VALOR ORIG.", cX + (cW * 0.55), y + 5.2, { align: "right" });
            doc.text("JUROS/MULTA (+)", cX + (cW * 0.75), y + 5.2, { align: "right" });
            doc.text("VALOR FINAL", cEnd - 4, y + 5.2, { align: "right" });

            // Outer stroke (Last)
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.2);
            doc.roundedRect(cX, y, cW, tableH, 3, 3, 'D');

            // Table Body Content Row
            y += 8;
            doc.setTextColor(31, 41, 55); doc.setFontSize(7.2); doc.setFont("helvetica", "bold");
            doc.text("Mensalidade Escolar", cX + 4, y + 3.6);
            doc.setFontSize(5.6); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
            doc.text(receiptData.month, cX + 4, y + 6.4);

            // Late Fees Breakdown (Mini-text if applicable)
            if (fin.fine > 0 || fin.interest > 0) {
                doc.setFontSize(4.4); doc.setTextColor(185, 28, 28);
                doc.text(`+ Multa: R$ ${fin.fine.toFixed(2).replace('.', ',')}`, cX + (cW * 0.75), y + 8.4, { align: "right" });
                doc.text(`+ Juros: R$ ${fin.interest.toFixed(2).replace('.', ',')}`, cX + (cW * 0.75), y + 10.0, { align: "right" });
            }

            doc.setTextColor(107, 114, 128); doc.setFontSize(6.8);
            doc.text(`R$ ${fin.originalValue.toFixed(2).replace('.', ',')}`, cX + (cW * 0.55), y + 4.8, { align: "right" });

            const adjTotal = fin.fine + fin.interest;
            doc.text(`R$ ${adjTotal.toFixed(2).replace('.', ',')}`, cX + (cW * 0.75), y + 4.8, { align: "right" });

            doc.setTextColor(3, 7, 18); doc.setFontSize(8.4); doc.setFont("helvetica", "bold");
            doc.text(`R$ ${fin.total.toFixed(2).replace('.', ',')}`, cEnd - 4, y + 4.8, { align: "right" });

            y += 16;

            // --- 7. Observations Section ---
            doc.setFontSize(6.4); doc.setFont("helvetica", "bold"); doc.setTextColor(107, 114, 128);
            doc.text("OBSERVAÇÕES:", cX, y);
            y += 2.8;
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.1);
            doc.line(cX, y, cEnd, y);
            y += 4.8;
            doc.line(cX, y, cEnd, y);

            y += 5.6;

            // --- 8. Status Block (Premium Dotted) ---
            doc.setDrawColor(180, 180, 180);
            doc.setLineDashPattern([1, 1], 0);
            doc.roundedRect(cX, y, cW, 16, 3, 3, 'D');
            doc.setLineDashPattern([], 0);

            // Ref & Method
            doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
            doc.text("Referência:", cX + 4, y + 6.4);
            doc.text("Método:", cX + 4, y + 11.2);

            doc.setFont("helvetica", "bold"); doc.setTextColor(31, 41, 55); doc.setFontSize(6.8);
            doc.text(`Mensalidade - ${receiptData.month}`, cX + 17.6, y + 6.4);
            doc.text(getPaymentMethodLabel(receiptData.paymentMethod), cX + 17.6, y + 11.2);

            // Vertical separator
            const separatorX = startX + cardW * 0.53;
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.line(separatorX, y + 3.2, separatorX, y + 12.8);

            // PAGO Badge
            const badgeW = 13.6;
            const badgeH = 5.6;
            const badgeX = separatorX + 2.4;
            const badgeY = y + 5.2;
            doc.setFillColor(232, 250, 237);
            doc.setDrawColor(34, 197, 94);
            doc.setLineWidth(0.2);
            doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, 'FD');

            doc.setFontSize(6.4); doc.setTextColor(22, 101, 52); doc.setFont("helvetica", "bold");
            doc.text("PAGO", badgeX + 1.6, badgeY + 4);

            // Checkmark
            doc.setLineWidth(0.5);
            doc.setDrawColor(22, 101, 52);
            doc.line(badgeX + 8.8, badgeY + 3.2, badgeX + 10.0, badgeY + 4.4);
            doc.line(badgeX + 10.0, badgeY + 4.4, badgeX + 12.4, badgeY + 2.0);

            // Valor Pago Block
            doc.setFontSize(6); doc.setTextColor(107, 114, 128); doc.setFont("helvetica", "bold");
            doc.text("VALOR PAGO", cEnd - 4, y + 5.6, { align: "right" });
            doc.setFontSize(17.6); doc.setTextColor(3, 7, 18);
            doc.text(`R$ ${fin.total.toFixed(2).replace('.', ',')}`, cEnd - 4, y + 12.8, { align: "right" });

            y += 24;

            // --- 9. Footer Architecture ---
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.16);
            doc.line(cX, y, cEnd, y);

            doc.setFontSize(6.4); doc.setFont("helvetica", "bold"); doc.setTextColor(3, 7, 18);
            doc.text("EXPANSIVO - REDE DE ENSINO", cX, y + 4.8);
            doc.setFontSize(5.6); doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
            doc.text(unitInfo.address, cX, y + 8);
            doc.text(`Financeiro: +55 (84) 98873-9180`, cX, y + 11.2);
            doc.text(`CNPJ: ${cnpj}`, cX, y + 14.4);

            const qrSize = 17.6;
            doc.addImage(qrCodeUrl, 'PNG', cEnd - qrSize, y + 3.2, qrSize, qrSize);
            doc.setFontSize(4.8); doc.setTextColor(150, 150, 150);
            doc.text("Validação de Autenticidade", cEnd - (qrSize / 2), y + qrSize + 4.8, { align: "center" });

            // Result: Bottom padding will now be approximately equal to top padding (~16mm)
            // Header starts at startY + 16. Footer ends around startY + 16 + internalHeight.
            // With cardH = 220, this creates the visual symmetry and "breath" requested.

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
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
            <div id="receipt-modal-content" className="bg-white rounded-2xl p-6 sm:p-8 w-[95%] sm:w-full max-w-xl shadow-2xl animate-scale-in relative border border-gray-100 max-h-[90vh] overflow-y-auto overflow-x-hidden">

                {/* Watermark Logo */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.05]">
                    <img src={SCHOOL_LOGO_URL} alt="" className="w-[85%] grayscale" />
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
                    <div className="relative z-10 bg-transparent border border-gray-100 border-l-4 border-l-blue-950 rounded-xl p-6 shadow-sm mb-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Aluno(a)</p>
                                <p className="font-bold text-gray-950 uppercase truncate text-sm">{student.name}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Matrícula</p>
                                <p className="font-bold text-gray-950 text-sm">{student.code}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Série/Ano</p>
                                <p className="font-bold text-gray-950 text-sm truncate">{student.gradeLevel}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Turma/Turno</p>
                                <p className="font-bold text-gray-950 text-sm">{student.schoolClass} - {student.shift}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Responsável Financeiro</p>
                                <p className="font-bold text-gray-900 uppercase truncate text-sm">
                                    {student.nome_responsavel || student.name}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">CPF do Responsável</p>
                                <p className="font-bold text-gray-900 text-sm">
                                    {maskCpfDisplay(student.cpf_responsavel)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Title Detalhamento */}
                    <h3 className="text-center font-bold text-gray-800 text-sm mb-4 uppercase tracking-wider">Detalhamento do Pagamento</h3>

                    {/* Table */}
                    <div className="mb-6">
                        <div className="bg-gray-100/80 border-b border-gray-200 px-4 py-2 rounded-t-lg flex text-[10px] font-bold text-gray-500 uppercase tracking-wider backdrop-blur-sm">
                            <div className="flex-grow">Descrição</div>
                            <div className="w-20 text-right hidden sm:block">Valor Orig.</div>
                            <div className="w-24 text-right hidden sm:block">Juros/Multa (+)</div>
                            <div className="w-28 text-right">Valor Final</div>
                        </div>
                        <div className="border border-t-0 border-gray-200 border-l-4 border-l-blue-950 rounded-b-lg px-4 py-3 flex text-sm text-gray-700 items-center">
                            <div className="flex-grow pr-2">
                                <span className="block font-bold text-gray-800 text-xs sm:text-sm">Mensalidade Escolar</span>
                                <span className="text-[10px] sm:text-xs text-gray-500">{receiptData.month}</span>
                            </div>
                            <div className="w-20 text-right hidden sm:block text-gray-400 text-xs">R$ {fin.originalValue.toFixed(2).replace('.', ',')}</div>
                            <div className="w-24 text-right hidden sm:block text-gray-400 text-xs">
                                <span className="block">R$ {(fin.fine + fin.interest).toFixed(2).replace('.', ',')}</span>
                                {(fin.fine > 0 || fin.interest > 0) && (
                                    <div className="mt-1 space-y-0.5">
                                        <p className="text-[9px] text-red-600">+ Multa: R$ {fin.fine.toFixed(2).replace('.', ',')}</p>
                                        <p className="text-[9px] text-red-600">+ Juros: R$ {fin.interest.toFixed(2).replace('.', ',')}</p>
                                    </div>
                                )}
                            </div>
                            <div className="w-28 text-right font-black text-gray-900 text-sm">R$ {fin.total.toFixed(2).replace('.', ',')}</div>
                        </div>
                    </div>

                    {/* Observations */}
                    <div className="mb-8">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Observações:</p>
                        <div className="border-b-2 border-dotted border-gray-200 w-full mb-2"></div>
                    </div>

                    {/* Status Block */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 bg-transparent p-4 rounded-xl border border-dashed border-gray-200">
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
                            <div className="bg-green-50 text-green-700 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1 border border-green-200 h-7">
                                PAGO
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
                            </div>

                            <div className="text-right">
                                <span className="text-[10px] font-bold text-gray-500 uppercase block leading-none mb-1">Valor Pago</span>
                                <span className="text-2xl font-black text-gray-900 leading-none block">R$ {fin.total.toFixed(2).replace('.', ',')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-200 pt-6 flex flex-col sm:flex-row justify-between items-center sm:items-end gap-6 text-center sm:text-left">
                        <div className="text-[10px] text-gray-500 space-y-1">
                            <strong className="block text-gray-800 uppercase text-xs mb-1">EXPANSIVO - REDE DE ENSINO</strong>
                            <p>{unitInfo.address}</p>
                            <p className="font-medium text-gray-600">Financeiro: +55 (84) 98873-9180</p>
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

                {/* Footer Actions */}
                <div className="mt-8 space-y-3 border-t border-gray-100 pt-6 no-print">
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

                    <div className="flex flex-row gap-3">
                        <Button onClick={handleShare} variant="outline" className="flex-1 flex items-center justify-center gap-2 border-2 border-primary/20 hover:border-primary/50 py-3 rounded-xl transition-all">
                            💾 Baixar Comprovante (PDF)
                        </Button>

                        <Button onClick={onClose} className="flex-1 bg-gray-900 hover:bg-black text-white py-3 rounded-xl shadow-lg">
                            Fechar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
