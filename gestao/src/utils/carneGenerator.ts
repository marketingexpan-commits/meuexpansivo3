import type { Student } from '../types';
import { generatePixPayload } from './pixUtils';

interface Installment {
    month: string;
    value: number;
    dueDate: string;
    status: string;
    studentName: string;
    studentCode: string;
    studentGrade: string;
    barcode?: string;
    qrCodeBase64?: string;
    documentNumber?: string;
}

export const generateCarne = (student: Student, installments: Installment[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const PIX_KEY = 'expansivo.unidadeboasorte@gmail.com';

    const sortedInstallments = installments.sort((a, b) => {
        const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const monthA = a.month.split('/')[0];
        const monthB = b.month.split('/')[0];
        return months.indexOf(monthA) - months.indexOf(monthB);
    });

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Carnê de Pagamento - ${student.name}</title>
            <style>
                /* --- RESET E GABARITO --- */
                * { box-sizing: border-box; margin: 0; padding: 0; }
                
                body { 
                    font-family: Arial, sans-serif; 
                    background-color: #525659; 
                    display: block; 
                    padding: 20px 0;
                }
                
                .page { 
                    width: 210mm;
                    height: 297mm;
                    background: #fff;
                    margin: 0 auto 20px auto;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    overflow: hidden;
                    page-break-after: always;
                }

                /* --- ESTRUTURA DOS 4 BOLETOS --- */
                .ticket { 
                    width: 100%;
                    height: 25%; /* 4 por folha */
                    display: flex;
                    flex-direction: row;
                    border-bottom: 1px dashed #000;
                    padding: 4mm 5mm 8mm 5mm; /* Topo reduzido para caber conteúdo, mantendo área de corte abaixo */
                    position: relative;
                }

                .school-copy { 
                    width: 22%; 
                    border-right: 1px dashed #000; 
                    padding-right: 10px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }

                .payer-copy { 
                    width: 78%; 
                    padding-left: 15px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }

                /* --- CONTEÚDO --- */
                .header { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #000; padding-bottom: 5px; }
                .logo-img { width: 35px; height: 35px; object-fit: contain; }
                .row { display: flex; gap: 10px; margin-top: 5px; } /* Margin reduzida */
                .field { flex: 1; display: flex; flex-direction: column; }
                .label { font-size: 7px; color: #666; font-weight: bold; text-transform: uppercase; }
                .value { font-size: 10px; font-weight: bold; border-bottom: 1px solid #eee; padding: 2px 0; }
                
                .qr-section { display: flex; gap: 10px; align-items: center; margin-top: 5px; } /* Margin reduzida */
                .qr-box { border: 1px solid #000; padding: 2px; text-align: center; width: 70px; } /* Box menor */
                .baixa-box { border: 2px solid #000; padding: 2px; text-align: center; flex: 1; }

                .watermark { 
                    position: absolute; top: 50%; left: 55%; transform: translate(-50%, -50%);
                    width: 40%; opacity: 0.07; z-index: 0; pointer-events: none;
                    filter: grayscale(100%);
                }       

                .barcode-section { margin-top: 3px; text-align: center; }
                .barcode-strip { 
                    height: 24px; 
                    background: repeating-linear-gradient(90deg, #000 0px, #000 1px, #fff 1px, #fff 3px); 
                    width: 90%; 
                    margin: 0 auto; 
                    opacity: 0.8;
                    -webkit-print-color-adjust: exact; 
                    print-color-adjust: exact; 
                }
                .barcode-text { font-family: 'Courier New', monospace; font-size: 8px; margin-top: 1px; letter-spacing: 2px; }

                @media print {
                    body { background: none; padding: 0; }
                    .page { margin: 0; box-shadow: none; }
                    .ticket { border-bottom: 1px dashed #000; }
                }
            </style>
        </head>
        <body>
            ${chunkArray(sortedInstallments, 4).map(pageInstallments => `
                <div class="page">
                    ${pageInstallments.map(inst => {
        let qrUrl = inst.qrCodeBase64
            ? `data:image/png;base64,${inst.qrCodeBase64}`
            : `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(generatePixPayload({
                key: PIX_KEY,
                name: 'EXPANSIVO',
                city: 'Natal',
                amount: inst.value,
                txid: inst.documentNumber || '***'
            }))}`;

        return `
                        <div class="ticket">
                            <img src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png" class="watermark">
                            
                            <div class="school-copy">
                                <div style="text-align:center; font-weight:bold; border-bottom:1px solid #000;">CONTROLE</div>
                                <div class="field"><span class="label">Vencimento</span><span class="value">${formatDate(inst.dueDate)}</span></div>
                                <div class="field"><span class="label">Valor</span><span class="value">R$ ${inst.value.toFixed(2)}</span></div>
                                <div class="field"><span class="label">Mês Ref.</span><span class="value">${inst.month}</span></div>
                                <div class="field"><span class="label">Matrícula</span><span class="value">${student.code}</span></div>
                                <div style="margin-top:10px; border-top:1px solid #000; font-size:7px; text-align:center;"><br>Visto Escola</div>
                            </div>

                            <div class="payer-copy">
                                <div class="header">
                                    <img src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png" class="logo-img">
                                    <div style="flex:1">
                                        <div style="font-weight:bold; font-size:12px;">MEU EXPANSIVO</div>
                                        <div style="font-size:8px;">Recibo de Mensalidade - Unidade: ${student.unit || 'Natal'}</div>
                                    </div>
                                    <div style="text-align:right">
                                        <div style="font-size:14px; font-weight:bold;">R$ ${inst.value.toFixed(2)}</div>
                                        <div style="font-size:9px;">Vencimento: ${formatDate(inst.dueDate)}</div>
                                    </div>
                                </div>

                                <div class="row">
                                    <div class="field" style="flex:2"><span class="label">Pagador / Aluno</span><span class="value">${student.name}</span></div>
                                    <div class="field"><span class="label">Matrícula</span><span class="value">${student.code}</span></div>
                                </div>

                                <div class="row">
                                    <div class="field"><span class="label">Série/Turma</span><span class="value">${student.gradeLevel}</span></div>
                                    <div class="field"><span class="label">Parcela/Mês</span><span class="value">${inst.month.toUpperCase()}</span></div>
                                    <div class="field"><span class="label">Data Doc.</span><span class="value">${new Date().toLocaleDateString('pt-BR')}</span></div>
                                </div>

                                <div class="qr-section">
                                    <div class="field" style="flex:1.5"><span class="label">Instruções</span><div style="font-size:7px;">Multa de 2% após o vencimento.<br>Juros de 1% ao mês.<br>Pagamento preferencial via PIX.</div></div>
                                    <div class="qr-box">
                                        <span class="label" style="display:block; font-size:6px;">PAGUE PIX</span>
                                        <img src="${qrUrl}" style="width:45px; height:45px;">
                                    </div>
                                    <div class="baixa-box">
                                        <span class="label">CÓDIGO BAIXA</span>
                                        <div style="font-size:14px; font-weight:bold; margin-top:5px;">${inst.documentNumber || '---'}</div>
                                    </div>
                                </div>
                                
                                <div class="barcode-section">
                                    <div class="barcode-strip"></div>
                                    <div class="barcode-text">${inst.barcode || ''}</div>
                                </div>
                            </div>
                        </div>`;
    }).join('')}
                </div>
            `).join('')}
            <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

const chunkArray = (arr: any[], size: number) => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};