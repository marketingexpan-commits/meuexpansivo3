import type { Student, SchoolUnitDetail } from '../types';


interface Installment {
    month: string;
    value: number;
    dueDate: string;
    status: string;
    studentName: string;
    studentCode: string;
    studentGrade: string;
    barcode?: string;
    digitableLine?: string;
    qrCodeBase64?: string;
    documentNumber?: string;
}

export const generateCarne = (student: Student, installments: Installment[], unitDetail: SchoolUnitDetail) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;


    const unitInfo = unitDetail;

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
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
            <style>
                /* --- RESET E GABARITO --- */
                * { box-sizing: border-box; margin: 0; padding: 0; }
                
                body { 
                    font-family: 'Inter', Arial, sans-serif; 
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
                    padding: 4mm 5mm 8mm 15mm; 
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
                .row { display: flex; gap: 10px; margin-top: 5px; }
                .field { flex: 1; display: flex; flex-direction: column; }
                .label { font-size: 7px; color: #666; font-weight: bold; text-transform: uppercase; }
                .value { font-size: 10px; font-weight: bold; border-bottom: 1px solid #e0e0e0; padding: 2px 0; }
                
                .watermark { 
                    position: absolute; top: 50%; left: 55%; transform: translate(-50%, -50%);
                    width: 40%; opacity: 0.07; z-index: 0; pointer-events: none;
                    filter: grayscale(100%);
                }       

                .barcode-section { margin-top: 5px; text-align: center; border-top: 1px solid #000; padding-top: 5px; }
                .barcode-text { font-family: 'Courier New', monospace; font-size: 10px; font-weight: bold; margin-top: 2px; letter-spacing: 1px; }

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

        let displayCode = inst.digitableLine || inst.barcode || '---';
        if (displayCode.length === 47 && !displayCode.includes('.')) {
            displayCode = `${displayCode.substring(0, 5)}.${displayCode.substring(5, 10)} ${displayCode.substring(10, 15)}.${displayCode.substring(15, 21)} ${displayCode.substring(21, 26)}.${displayCode.substring(26, 32)} ${displayCode.substring(32, 33)} ${displayCode.substring(33)}`;
        }

        // Código numérico limpo para o desenho das barras (precisa ser EXATAMENTE 44 dígitos)
        const cleanBarcode = (inst.barcode || '237933812860083013528560000633077890000001000').replace(/\\D/g, '').substring(0, 44);

        return `
                        <div class="ticket">
                            <img src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png" class="watermark">
                            
                            <div class="school-copy">
                                <div style="display: flex; flex-direction: row; align-items: center; justify-content: flex-start; gap: 8px; border-bottom: 1px solid #e0e0e0; padding-bottom: 5px;">
                                    <img src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png" style="height: 30px; width: auto; object-fit: contain;">
                                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                                        <div style="font-weight:900; font-size: 10px; text-transform:uppercase; line-height: 1; letter-spacing: -0.5px;">EXPANSIVO</div>
                                        <div style="font-weight:700; font-size: 6px; text-transform:uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">REDE DE ENSINO</div>
                                        <div style="font-size: 7px; color: #444; text-transform: uppercase;">UNIDADE: ${unitDetail.fullName.replace('Expansivo - ', '')}</div>
                                    </div>
                                </div>
                                <div class="field" style="margin-top: 5px;"><span class="label">Vencimento</span><span class="value">${formatDate(inst.dueDate)}</span></div>
                                <div class="field"><span class="label">Valor</span><span class="value">R$ ${inst.value.toFixed(2)}</span></div>
                                <div class="field"><span class="label">Mês Ref.</span><span class="value">${inst.month}</span></div>
                                <div class="field"><span class="label">Código</span><span class="value">${student.code}</span></div>
                                <div class="field"><span class="label">Cód. Baixa</span><span class="value">${inst.documentNumber || '---'}</span></div>
                                <div style="margin-top:auto; border-top:1px solid #000; font-size:7px; text-align:center;"><br>Visto Escola</div>
                            </div>

                            <div class="payer-copy">
                                <div class="header">
                                    <div class="logo-container" style="display: flex; align-items: center; justify-content: center; width: 50px;">
                                         <img src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png" class="logo-img" style="width: 100%; height: auto; object-fit: contain;">
                                    </div>
                                    <div style="flex:1; margin-left: 8px; display: flex; flex-direction: column; justify-content: center;">
                                        <div style="font-weight:800; font-size:11px; text-transform:uppercase; line-height: 1.1;">Expansivo Rede de Ensino</div>
                                        <div style="font-weight:700; font-size:8px; margin-bottom:1px; text-transform: uppercase;">Unidade: ${unitDetail.fullName.replace('Expansivo - ', '')}</div>
                                        <div style="font-size:6px; color:#444; line-height: 1.1;">
                                            ${unitInfo.address}${unitInfo.district ? ` - ${unitInfo.district}` : ''}${unitInfo.city ? `, ${unitInfo.city}` : ''}${unitInfo.uf ? ` - ${unitInfo.uf}` : ''}${unitInfo.cep ? ` - CEP: ${unitInfo.cep}` : ''}
                                        </div>
                                        <div style="font-size:6.5px; color:#444; line-height: 1.1; font-weight: 500;">CNPJ: ${unitInfo.cnpj} | Tel: ${unitInfo.phone}${unitInfo.whatsapp ? ` | WhatsApp: ${unitInfo.whatsapp}` : ''}</div>
                                    </div>
                                    <div style="text-align:right; display: flex; flex-direction: column; justify-content: center;">
                                        <div style="font-size:14px; font-weight:900; color: #000;">R$ ${inst.value.toFixed(2)}</div>
                                        <div style="font-size:9px; font-weight: 600;">Vencimento: ${formatDate(inst.dueDate)}</div>
                                    </div>
                                </div>

                                <div class="row">
                                    <div class="field" style="flex:2.5"><span class="label">Aluno (a)</span><span class="value">${student.name}</span></div>
                                    <div class="field"><span class="label">Código</span><span class="value">${student.code}</span></div>
                                </div>

                                <div class="row" style="margin-top: 2px;">
                                    <div class="field" style="flex:1.5"><span class="label">Série/Turma/Turno</span><span class="value">${student.gradeLevel} - ${student.schoolClass} / ${student.shift}</span></div>
                                    <div class="field"><span class="label">Mensal./Mês</span><span class="value">${inst.month.toUpperCase()}</span></div>
                                    <div class="field"><span class="label">Data Doc.</span><span class="value">${new Date().toLocaleDateString('pt-BR')}</span></div>
                                </div>

                                <div class="row" style="margin-top: 6px;">
                                    <div class="field" style="flex:1.5"><span class="label">Instruções</span><div style="font-size:7px; font-weight: 500;">Multa de 2% após o vencimento.<br>Juros de 1% ao mês.<br>Pagamento preferencial via PIX.</div></div>
                                    <div class="field">
                                        <span class="label">CÓDIGO BAIXA</span>
                                        <div style="font-size:13px; font-weight:800; margin-top:2px; color: #000;">${inst.documentNumber || '---'}</div>
                                    </div>
                                    <div class="field" style="flex: 1.2; border-left: 1px solid #eee; padding-left: 10px; min-height: 55px; display: flex; flex-direction: column; justify-content: flex-end;">
                                        <div style="margin-bottom: 12px;">
                                            <div style="border-bottom: 1px solid #000; width: 100%; height: 12px;"></div>
                                            <span class="label" style="font-size: 5.5px; display: block; text-align: center; margin-top: 1px;">Assinatura / Recebido por</span>
                                        </div>
                                        <div>
                                            <div style="display: flex; align-items: flex-end; gap: 2px; justify-content: center;">
                                                <div style="border-bottom: 1px solid #000; width: 22px; height: 12px;"></div>
                                                <span style="font-size: 8px;">/</span>
                                                <div style="border-bottom: 1px solid #000; width: 22px; height: 12px;"></div>
                                                <span style="font-size: 8px;">/</span>
                                                <div style="border-bottom: 1px solid #000; width: 35px; height: 12px;"></div>
                                            </div>
                                            <span class="label" style="font-size: 5.5px; display: block; text-align: center; margin-top: 1px;">Data Recebimento</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="barcode-section">
                                    <div class="barcode-text" style="font-size: 9px; margin-bottom: 4px; border-bottom: 1px solid #000;">${displayCode}</div>
                                    <img src="https://bwipjs-api.metafloor.com/?bcid=interleaved2of5&text=${encodeURIComponent(cleanBarcode)}&scale=2&height=10&incltext=false" style="width: 96%; height: 35px; object-fit: fill;">
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