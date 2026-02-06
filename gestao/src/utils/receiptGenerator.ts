import type { SchoolUnitDetail } from '../types';

export function generateReceipt(m: any, unitDetail: SchoolUnitDetail) {
    const unitInfo = unitDetail;

    // Fallback determinístico para registros antigos sem receiptId
    const getDeterministicPortion = (id: string) => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString().substring(0, 5).padStart(5, '0');
    };

    const receiptId = m.receiptId || `REC-${new Date().getFullYear()}-${getDeterministicPortion(m.id || 'fallback')}`;
    const paymentDate = m.paymentDate ? new Date(m.paymentDate).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
    const logoUrl = unitDetail.logoUrl || 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptContent = (copyLabel: string) => `
        <div class="receipt-instance">
            <div class="watermark-container">
                <img src="https://i.postimg.cc/hjLxrMdc/brasao-da-republica-do-brasil-seeklogo.png" alt="Brasão">
            </div>
            <div class="header">
                <div class="school-branding">
                    <div class="logo-container">
                        <img src="${logoUrl}" alt="Logo">
                    </div>
                    <div class="school-text">
                        <h1>EXPANSIVO REDE DE ENSINO</h1>
                        ${(unitInfo as any).professionalTitle ? `<p style="margin:0; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase;">${(unitInfo as any).professionalTitle}</p>` : ''}
                        <p style="font-weight: 700; color: #0f172a; margin-bottom: 2px; text-transform: uppercase;">UNIDADE: ${unitInfo.fullName.replace('Expansivo - ', '')}</p>
                        <p style="font-size: 10px; line-height: 1.2;">
                            ${unitInfo.address}${unitInfo.district ? ` - ${unitInfo.district}` : ''}${unitInfo.city ? `, ${unitInfo.city}` : ''}${unitInfo.uf ? ` - ${unitInfo.uf}` : ''}${unitInfo.cep ? ` - CEP: ${unitInfo.cep}` : ''}
                        </p>
                        <p style="font-size: 10px; line-height: 1.2;">
                            CNPJ: ${unitInfo.cnpj} | Tel: ${unitInfo.phone}${unitInfo.whatsapp ? ` | WhatsApp: ${unitInfo.whatsapp}` : ''}${unitInfo.email ? ` | E-mail: ${unitInfo.email}` : ''}
                        </p>
                        ${unitInfo.authorization ? `<p style="margin:0; font-size: 8px; font-style: italic; color: #64748b;">${unitInfo.authorization}</p>` : ''}
                    </div>
                </div>
                <div class="document-type">
                    <div class="copy-indicator">${copyLabel}</div>
                    <h2>RECIBO</h2>
                    <div class="doc-meta">
                        Referência: ${m.month}<br>
                        Emissão: ${paymentDate}<br>
                        ${m.documentNumber ? `Cód. Baixa: ${m.documentNumber}<br>` : ''}
                        ID: ${receiptId}
                    </div>
                </div>
            </div>

            <div class="section-title">Dados do Aluno e Responsável</div>
            <div class="student-info">
                <div class="info-item full-width">
                    <div class="label">Nome do Aluno(a)</div>
                    <div class="value">${m.studentName.toUpperCase()}</div>
                </div>
                <div class="info-item">
                    <div class="label">Código do Aluno</div>
                    <div class="value">${m.studentCode}</div>
                </div>
                <div class="info-item">
                    <div class="label">Série / Ano</div>
                    <div class="value">${m.studentGrade}</div>
                </div>
                <div class="info-item">
                    <div class="label">CPF do Responsável</div>
                    <div class="value">${m.studentCPF || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="label">Turma / Turno</div>
                    <div class="value">${m.studentClass} - ${m.studentShift || '-'}</div>
                </div>

            </div>

            <div class="section-title">Detalhamento dos Valores</div>
            <table class="payment-details">
                <thead>
                    <tr>
                        <th style="width: 75%">Item / Descrição</th>
                        <th style="text-align: right">Valor Líquido</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="description-cell">
                            Mensalidade Escolar - Ano Letivo 2026
                            <small>Serviços educacionais prestados referente ao mês de ${m.month.split('/')[0]}</small>
                        </td>
                        <td class="value-cell">R$ ${m.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                </tbody>
            </table>

            <div class="summary">
                <div class="status-badge">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    </svg>
                    PAGAMENTO CONFIRMADO
                </div>
                <div class="total-box">
                    <div class="label">Total Recebido</div>
                    <div class="amount">R$ ${m.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>

            <div class="declaration">
                Declaramos que recebemos de <strong>${m.studentResponsibleName.toUpperCase()}</strong>, a importância de <strong>R$ ${m.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>, referente à mensalidade do mês de <strong>${m.month}</strong>. Este documento serve como comprovante definitivo de quitação de pagamento para fins de arquivo e controle.
            </div>

            <div class="footer">
                <div class="signature-area">
                    <div class="signature-line">Assinatura / Carimbo</div>
                </div>
            </div>
        </div>
    `;

    const html = `
        <html>
        <head>
            <title>Recibo Dual - ${m.studentName}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                
                @page {
                    size: A4 portrait;
                    margin: 0;
                }

                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Inter', sans-serif; 
                    background: #f1f5f9; 
                    color: #1e293b;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                
                .a4-container {
                    width: 210mm;
                    height: 297mm;
                    background: white;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    padding: 2mm 10mm;
                    box-shadow: 0 0 20px rgba(0,0,0,0.1);
                }

                .receipt-instance {
                    flex: 1;
                    padding: 5mm 10mm;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                }

                .watermark-container {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    opacity: 0.07;
                    width: 280px;
                    height: 280px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    z-index: 0;
                }
                
                .watermark-container img {
                    width: 100%;
                    height: auto;
                    filter: grayscale(100%);
                }

                .cut-line {
                    height: 0;
                    border-top: 2px dashed #cbd5e1;
                    position: relative;
                    width: calc(100% + 20mm);
                    margin-left: -10mm;
                    margin-top: 4mm;
                    margin-bottom: 4mm;
                }

                .cut-line::after {
                    content: '✂';
                    position: absolute;
                    top: -12px;
                    left: 20px;
                    background: white;
                    padding: 0 5px;
                    color: #94a3b8;
                    font-size: 16px;
                }

                .copy-indicator {
                    font-size: 8px;
                    font-weight: 800;
                    color: white;
                    background: #0f172a;
                    padding: 2px 8px;
                    border-radius: 4px;
                    text-transform: uppercase;
                    display: inline-block;
                    margin-bottom: 4px;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 6px;
                    margin-bottom: 8px;
                }

                .school-branding {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .logo-container {
                    width: 50px;
                    height: 50px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .logo-container img {
                    width: 100%;
                    height: auto;
                    object-fit: contain;
                }

                .school-text h1 {
                    font-size: 16px;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 1px;
                }

                .school-text p {
                    font-size: 11px;
                    color: #64748b;
                    font-weight: 400;
                }

                .document-type {
                    text-align: right;
                }

                .document-type h2 {
                    font-size: 20px;
                    font-weight: 900;
                    color: #0f172a;
                    text-transform: uppercase;
                    line-height: 1;
                }

                .doc-meta {
                    font-size: 9px;
                    color: #64748b;
                    font-weight: 600;
                    text-align: right;
                    margin-top: 4px;
                }

                .section-title {
                    font-size: 8px;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    margin-bottom: 6px;
                    border-left: 3px solid #0f172a;
                    padding-left: 6px;
                }

                .student-info {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                    margin-bottom: 8px;
                    background: #f8fafc;
                    padding: 8px;
                    border-radius: 6px;
                }

                .info-item .label {
                    font-size: 8px;
                    font-weight: 700;
                    color: #94a3b8;
                    text-transform: uppercase;
                }

                .info-item .value {
                    font-size: 11px;
                    font-weight: 700;
                    color: #0f172a;
                }

                .full-width { grid-column: span 2; }

                .payment-details { 
                    width: 100%; border-collapse: collapse; margin-bottom: 10px; 
                }
                .payment-details th { 
                    text-align: left; font-size: 9px; font-weight: 800; color: #64748b; padding: 6px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; 
                }
                .payment-details td { 
                    padding: 10px 6px; border-bottom: 1px solid #f1f5f9; 
                }

                .description-cell { font-size: 12px; font-weight: 600; color: #0f172a; }
                .description-cell small { display: block; font-size: 10px; color: #64748b; font-weight: 400; }
                .value-cell { text-align: right; font-size: 12px; font-weight: 700; color: #0f172a; }

                 .summary {
                    display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f8fafc; border-radius: 6px;
                }

                .status-badge {
                    font-size: 10px; font-weight: 800; color: #166534; background: #dcfce7; padding: 4px 10px; border-radius: 4px; display: flex; align-items: center; gap: 5px;
                }

                .total-box .label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; text-align: right; }
                .total-box .amount { font-size: 24px; font-weight: 900; color: #0f172a; line-height: 1; text-align: right; }

                .declaration {
                    font-size: 9px;
                    color: #475569;
                    text-align: justify;
                    line-height: 1.3;
                    margin-top: 8px;
                    padding: 8px;
                    background: #f1f5f9;
                    border-radius: 4px;
                    border-left: 3px solid #cbd5e1;
                }

                .footer {
                    margin-top: 10px; 
                    display: flex; 
                    justify-content: center; 
                    border-top: 1px solid #e2e8f0; 
                    padding-top: 10px;
                }

                .unit-info { font-size: 9px; color: #64748b; line-height: 1.3; }
                .unit-info strong { color: #0f172a; display: block; }

                .signature-area { text-align: center; width: 300px; display: block; }
                .signature-line { width: 100%; border-top: 1px solid #0f172a; padding-top: 5px; font-size: 9px; font-weight: 700; color: #0f172a; text-transform: uppercase; margin-top: 20px; }

                @media print {
                    body { background: white; padding: 0; }
                    .a4-container { width: 100%; height: 100%; margin: 0; padding: 10mm; box-shadow: none; }
                    .copy-indicator { background: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
                    .status-badge { background: #dcfce7 !important; color: #166534 !important; -webkit-print-color-adjust: exact; }
                    .student-info, .summary { background: #f8fafc !important; -webkit-print-color-adjust: exact; }
                }

            </style>
        </head>
        <body onload="window.print();">
            <div class="a4-container">
                ${receiptContent('VIA DA ESCOLA')}
                
                <div class="cut-line"></div>
                
                ${receiptContent('VIA DO RESPONSÁVEL')}
            </div>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
}
