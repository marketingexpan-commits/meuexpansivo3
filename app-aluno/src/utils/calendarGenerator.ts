
import { CalendarEvent, AcademicSettings } from '../types';
import { UNIT_DETAILS } from '../utils/academicDefaults';

export const generateSchoolCalendar = (
    events: CalendarEvent[],
    settings: AcademicSettings | null,
    unitName: string
) => {
    const rawUnitKey = unitName === 'all' ? 'unit_zn' : unitName; // Fallback for header if 'all'
    const unitInfo = UNIT_DETAILS[rawUnitKey] || UNIT_DETAILS['unit_zn'];
    const logoUrl = 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';
    const currentYear = settings?.year || new Date().getFullYear();

    const formattedDate = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    const getEventBadgeColor = (type: string) => {
        switch (type) {
            case 'holiday_national':
            case 'holiday_state':
            case 'holiday_municipal':
            case 'holiday': // Fallback legacy
                return '#ef4444';
            case 'exam': return '#f59e0b';
            case 'meeting': return '#3b82f6';
            case 'vacation':
            case 'recess':
                return '#10b981';
            default: return '#64748b';
        }
    };

    const getEventLabel = (type: string) => {
        switch (type) {
            case 'holiday_national': return 'Feriado Nacional';
            case 'holiday_state': return 'Feriado Estadual';
            case 'holiday_municipal': return 'Feriado Municipal';
            case 'holiday': return 'Feriado';
            case 'exam': return 'Avaliação';
            case 'meeting': return 'Reunião';
            case 'vacation': return 'Férias';
            case 'recess': return 'Recesso';
            default: return 'Evento';
        }
    };

    const sortedEvents = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate));

    const calculateSchoolDays = (start: string, end: string, events: CalendarEvent[]) => {
        let count = 0;
        const curDate = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T00:00:00');

        // Map holidays for faster lookup (check ranges)
        const holidayDates = new Set<string>();
        events.forEach(e => {
            const isHoliday = e.type === 'vacation' || e.type === 'recess' || e.type.startsWith('holiday');
            if (isHoliday) {
                const s = new Date(e.startDate + 'T00:00:00');
                // Use startDate if endDate missing, else iterate range
                const f = e.endDate ? new Date(e.endDate + 'T00:00:00') : new Date(e.startDate + 'T00:00:00');

                for (let d = new Date(s); d <= f; d.setDate(d.getDate() + 1)) {
                    holidayDates.add(d.toISOString().split('T')[0]);
                }
            }
        });

        while (curDate <= endDate) {
            const dayOfWeek = curDate.getDay();
            const dateStr = curDate.toISOString().split('T')[0];
            // 0 = Sunday, 6 = Saturday
            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
                count++;
            }
            curDate.setDate(curDate.getDate() + 1);
        }
        return count;
    };

    let totalSchoolDays = 0;
    const bimesterCards = settings?.bimesters.map(bim => {
        const days = calculateSchoolDays(bim.startDate, bim.endDate, events);
        totalSchoolDays += days;

        return `
            <div class="bimester-card">
                <div class="bimester-label">${bim.label}</div>
                <div class="bimester-dates">
                    <strong>${new Date(bim.startDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</strong> a 
                    <strong>${new Date(bim.endDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</strong>
                </div>
                <div style="margin-top: 4px; font-size: 10px; font-weight: 700; color: #1e3a8a; background: #dbeafe; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                    ${days} Dias Letivos
                </div>
            </div>
        `;
    }).join('');

    const html = `
        <html>
        <head>
            <title>Calendário Escolar ${currentYear} - ${unitName}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                @page { size: A4 portrait; margin: 1cm; }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Inter', sans-serif;
                    color: #1e293b;
                    line-height: 1.5;
                    background: #f8fafc;
                    padding: 20px;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    padding: 40px;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                    min-height: 297mm;
                }
                .header {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .logo-container img { height: 60px; width: auto; }
                .school-text h1 {
                    font-size: 20px;
                    font-weight: 800;
                    color: #1e3a8a;
                    text-transform: uppercase;
                }
                .school-text p { font-size: 11px; color: #64748b; font-weight: 500; }
                
                .title-section { text-align: center; margin-bottom: 30px; }
                .title-section h2 {
                    font-size: 24px;
                    font-weight: 900;
                    color: #0f172a;
                    text-transform: uppercase;
                    letter-spacing: -0.025em;
                }
                .title-section p { color: #64748b; font-size: 14px; font-weight: 600; }

                .section-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-top: 30px;
                    margin-bottom: 15px;
                    border-left: 4px solid #1e3a8a;
                    padding-left: 10px;
                }

                .section-title {
                    font-size: 14px;
                    font-weight: 800;
                    color: #1e3a8a;
                    text-transform: uppercase;
                    margin: 0;
                }
                
                .total-badge {
                    color: #64748b;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th {
                    background: #f1f5f9;
                    color: #475569;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    text-align: left;
                    padding: 10px;
                    border: 1px solid #e2e8f0;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                td {
                    padding: 10px;
                    font-size: 12px;
                    border: 1px solid #e2e8f0;
                    color: #334155;
                }
                .date-cell { font-family: monospace; font-weight: 700; width: 120px; }
                .type-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    color: white;
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                .bimester-grid {
                    display: flex !important;
                    flex-direction: row !important;
                    gap: 10px !important;
                    margin-bottom: 20px !important;
                    width: 100% !important;
                }
                .bimester-card {
                    flex: 1 !important;
                    padding: 10px !important;
                    border: 1px solid #e2e8f0 !important;
                    border-radius: 8px !important;
                    background: #f8fafc !important;
                    text-align: center !important;
                    min-width: 0 !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .bimester-label { font-weight: 800; color: #1e3a8a; font-size: 11px; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
                .bimester-dates { font-size: 10px; color: #475569; line-height: 1.4; margin-bottom: 4px; }

                .footer {
                    margin-top: 50px;
                    text-align: center;
                    font-size: 10px;
                    color: #94a3b8;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 20px;
                }

                @media print {
                    body { 
                        background: white; 
                        padding: 0; 
                        -webkit-print-color-adjust: exact !important;   /* Chrome, Safari, Edge */
                        print-color-adjust: exact !important;           /* Firefox */
                    }
                    .container { box-shadow: none; width: 100%; padding: 0; }
                    .type-badge, .bimester-card, th, .total-badge, .bimester-card div[style*="background"] {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo-container">
                        <img src="${logoUrl}" alt="Logo">
                    </div>
                    <div class="school-text">
                        <h1>EXPANSIVO REDE DE ENSINO</h1>
                        ${unitInfo.professionalTitle ? `<p style="margin:0; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase;">${unitInfo.professionalTitle}</p>` : ''}
                        <p style="color: #1e3a8a; font-weight: 700; text-transform: uppercase;">Unidade: ${unitInfo.name.replace('Expansivo - ', '')}</p>
                        <p>${unitInfo.address}, ${unitInfo.district} - ${unitInfo.city}/${unitInfo.uf}</p>
                        <p>CNPJ: ${unitInfo.cnpj} | Telefone: ${unitInfo.phone}</p>
                        ${unitInfo.authorization ? `<p style="margin:0; font-size: 8px; font-style: italic; color: #64748b;">${unitInfo.authorization}</p>` : ''}
                    </div>
                </div>

                <div class="title-section">
                    <h2>CALENDÁRIO ESCOLAR ${currentYear}</h2>
                    <p>${unitName === 'all' ? 'Cronograma Geral da Rede' : `Unidade ${unitName}`}</p>
                </div>

                <div class="section-header">
                    <h3 class="section-title">Períodos Letivos (Bimestres)</h3>
                    <div class="total-badge">Total Anual: ${totalSchoolDays} Dias Letivos</div>
                </div>
                
                <div class="bimester-grid">
                    ${bimesterCards || '<div style="flex: 1; text-align: center; padding: 20px; color: #94a3b8;">Datas não configuradas</div>'}
                </div>

                <div class="section-header">
                     <h3 class="section-title">Eventos e Datas Importantes</h3>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Tipo</th>
                            <th>Descrição / Título</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedEvents.map(event => `
                            <tr>
                                <td class="date-cell">
                                    ${new Date(event.startDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    ${event.endDate ? ` - ${new Date(event.endDate + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                                </td>
                                <td style="width: 100px;">
                                    <span class="type-badge" style="background: ${getEventBadgeColor(event.type)}">
                                        ${getEventLabel(event.type)}
                                    </span>
                                </td>
                                <td>
                                    <strong>${event.title}</strong>
                                    ${event.description ? `<br><span style="font-size: 10px; color: #64748b;">${event.description}</span>` : ''}
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #94a3b8;">Nenhum evento cadastrado para este período.</td></tr>'}
                    </tbody>
                </table>

                <div class="footer">
                    Documento gerado em ${formattedDate} para fins informativos. <br>
                    EXPANSIVO REDE DE ENSINO - Educando com Excelência.
                </div>
            </div>
            <script>
                window.onload = () => { window.print(); };
            </script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
    }
};
