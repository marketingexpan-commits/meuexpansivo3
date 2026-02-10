
import type { CalendarEvent, AcademicSettings } from '../types';
import { UNIT_DETAILS } from './academicDefaults';

export const generateSchoolCalendar = (
    events: CalendarEvent[],
    settings: AcademicSettings | null,
    unitId: string
) => {
    const unitInfo = UNIT_DETAILS[unitId] || UNIT_DETAILS['unit_zn'];
    const logoUrl = 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';
    const currentYear = settings?.year || new Date().getFullYear();

    const formattedDate = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    // Standard Category Colors
    const CATEGORIES = {
        letivo: { label: 'Letivo', color: '#22c55e' },
        reposicao: { label: 'Reposição', color: '#a855f7' },
        feriado: { label: 'Feriado', color: '#ef4444' },
        ferias: { label: 'Férias', color: '#06b6d4' },
        recesso: { label: 'Recesso', color: '#92400e' }, // Alterado para Marrom para contraste total com Red/Orange/Pink
        prova: { label: 'Prova', color: '#f97316' },
        evento: { label: 'Evento/Geral', color: '#1e40af' },
        reuniao: { label: 'Reunião', color: '#6b7280' }
    };

    const getDayDots = (dateStr: string): string[] => {
        const dayEvents = events.filter(e => {
            const start = e.startDate;
            const end = e.endDate || e.startDate;
            return dateStr >= start && dateStr <= end;
        });

        const dots: string[] = [];
        const addedTypes = new Set<string>();

        if (dayEvents.some(e => e.type.startsWith('holiday'))) { dots.push(CATEGORIES.feriado.color); addedTypes.add('feriado'); }
        if (dayEvents.some(e => e.type === 'recess')) { dots.push(CATEGORIES.recesso.color); addedTypes.add('recesso'); }
        if (dayEvents.some(e => e.type === 'exam')) { dots.push(CATEGORIES.prova.color); addedTypes.add('prova'); }
        if (dayEvents.some(e => e.type === 'vacation')) { dots.push(CATEGORIES.ferias.color); addedTypes.add('ferias'); }
        if (dayEvents.some(e => e.type === 'substitution')) { dots.push(CATEGORIES.reposicao.color); addedTypes.add('reposicao'); }
        if (dayEvents.some(e => e.type === 'meeting')) { dots.push(CATEGORIES.reuniao.color); addedTypes.add('reuniao'); }
        if (dayEvents.some(e => e.type === 'event')) { dots.push(CATEGORIES.evento.color); addedTypes.add('evento'); }
        if (dayEvents.some(e => e.type === 'school_day')) {
            const dayNum = new Date(dateStr + 'T12:00:00').getDay();
            if (dayNum !== 0 && dayNum !== 6) {
                if (!addedTypes.has('feriado') && !addedTypes.has('recesso') && !addedTypes.has('ferias')) {
                    if (!addedTypes.has('letivo')) dots.push(CATEGORIES.letivo.color);
                }
            }
        }
        return dots;
    };

    const calculateSchoolDays = (start: string, end: string, events: CalendarEvent[]) => {
        let count = 0;
        const curDate = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T00:00:00');
        const holidayDates = new Set<string>();
        events.forEach(e => {
            const isHoliday = e.type === 'vacation' || e.type === 'recess' || e.type.startsWith('holiday');
            if (isHoliday) {
                const s = new Date(e.startDate + 'T00:00:00');
                const f = e.endDate ? new Date(e.endDate + 'T00:00:00') : new Date(e.startDate + 'T00:00:00');
                for (let d = new Date(s); d <= f; d.setDate(d.getDate() + 1)) {
                    holidayDates.add(d.toISOString().split('T')[0]);
                }
            }
        });
        while (curDate <= endDate) {
            const dayOfWeek = curDate.getDay();
            const dateStr = curDate.toISOString().split('T')[0];
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
                <div class="bimester-badge">${days} Dias Letivos</div>
            </div>
        `;
    }).join('');

    const monthlyDays: { month: string, days: number }[] = [];
    if (settings?.bimesters && settings.bimesters.length > 0) {
        const firstBim = settings.bimesters[0];
        const lastBim = settings.bimesters[settings.bimesters.length - 1];
        for (let m = 0; m < 12; m++) {
            const firstDay = new Date(currentYear, m, 1).toISOString().split('T')[0];
            const lastDay = new Date(currentYear, m + 1, 0).toISOString().split('T')[0];
            const academicStart = firstBim.startDate;
            const academicEnd = lastBim.endDate;
            const effectiveStart = academicStart > firstDay ? academicStart : firstDay;
            const effectiveEnd = academicEnd < lastDay ? academicEnd : lastDay;
            let days = 0;
            if (effectiveStart <= effectiveEnd) days = calculateSchoolDays(effectiveStart, effectiveEnd, events);
            monthlyDays.push({ month: new Date(currentYear, m, 1).toLocaleDateString('pt-BR', { month: 'long' }), days });
        }
    }

    const orderedMonthlyDays: typeof monthlyDays = [];
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
            const index = col * 3 + row;
            if (monthlyDays[index]) orderedMonthlyDays.push(monthlyDays[index]);
        }
    }

    const monthlySummaryHtml = orderedMonthlyDays.map(m => `
        <div class="month-item">
            <span class="month-name">${m.month}:</span>
            <span class="month-count">${String(m.days).padStart(2, '0')} dias</span>
        </div>
    `).join('');

    const generateMonthHtml = (monthIndex: number) => {
        const MONTH_LABELS = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
        const firstDay = new Date(currentYear, monthIndex, 1);
        const lastDay = new Date(currentYear, monthIndex + 1, 0);
        let firstDayOfWeek = firstDay.getDay();
        const padding = firstDayOfWeek;
        const daysHtml: string[] = [];
        for (let i = 0; i < padding; i++) daysHtml.push('<div class="day-cell empty"></div>');
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dots = getDayDots(dateStr);
            const isBimStart = settings?.bimesters.some(b => b.startDate === dateStr);
            daysHtml.push(`
                <div class="day-cell ${isBimStart ? 'bim-start' : ''}">
                    <span class="day-number">${d}</span>
                    <div class="dots-container">
                        ${dots.map(color => `<span class="dot" style="background-color: ${color}"></span>`).join('')}
                    </div>
                </div>
            `);
        }
        return `
            <div class="month-card">
                <div class="month-header">${MONTH_LABELS[monthIndex]}</div>
                <div class="weekdays-grid">
                    <span>DOM</span><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SAB</span>
                </div>
                <div class="days-container">${daysHtml.join('')}</div>
            </div>
        `;
    };

    const importantEvents = events
        .filter(e => e.type !== 'school_day')
        .sort((a, b) => a.startDate.localeCompare(b.startDate));

    // Reorder for column-major display in a 2-column grid
    const half = Math.ceil(importantEvents.length / 2);
    const sortedByColumn: (typeof importantEvents[0])[] = [];
    for (let i = 0; i < half; i++) {
        sortedByColumn.push(importantEvents[i]);
        if (i + half < importantEvents.length) {
            sortedByColumn.push(importantEvents[i + half]);
        }
    }

    const eventsListHtml = sortedByColumn.map(e => {
        const dateStr = new Date(e.startDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return `<div class="event-desc">
            <span class="event-date">${dateStr}</span>
            <span class="event-title">${e.title.toUpperCase()}</span>
        </div>`;
    }).join('');

    const html = `
        <html>
        <head>
            <title>Calendário Escolar ${currentYear}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                @page { size: A4 landscape; margin: 4mm; }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Inter', sans-serif;
                    background: #f8fafc;
                    color: #1e293b;
                    padding: 5px;
                    line-height: 1.1;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .container { display: flex; flex-direction: column; gap: 6px; width: 100%; }
                
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 12px 20px;
                    margin-bottom: 12px;
                }
                .logo-info { display: flex; align-items: center; gap: 15px; }
                .logo-info img { height: 32px; width: auto; }
                .header h1 { font-size: 16px; font-weight: 800; color: #1e3a8a; }
                .unit-badge { font-size: 9px; color: #64748b; font-weight: 700; text-align: right; line-height: 1.2; }

                .top-content {
                    display: grid;
                    grid-template-columns: 0.9fr 1.1fr;
                    gap: 8px;
                }
                .tables-column { display: flex; flex-direction: column; gap: 8px; }
                .events-column {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 4px 6px;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    column-gap: 10px;
                    row-gap: 0px;
                    align-content: start;
                }

                .section-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-left: 3px solid #1e3a8a;
                    padding-left: 6px;
                    margin-bottom: 2px;
                }
                .section-header h3 { font-size: 9px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; }
                .total-badge { font-size: 8px; font-weight: 700; color: #64748b; }

                .bimester-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
                .bimester-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    padding: 4px;
                    text-align: center;
                }
                .bimester-label { font-size: 9px; font-weight: 800; color: #1e3a8a; border-bottom: 1px solid #f1f5f9; padding-bottom: 1px; }
                .bimester-dates { font-size: 8.5px; color: #475569; margin-top: 2px; }
                .bimester-badge { margin-top: 2px; font-size: 8.5px; font-weight: 700; color: #1e3a8a; background: #dbeafe; padding: 1px 4px; border-radius: 3px; display: inline-block; }

                .monthly-summary {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    column-gap: 25px;
                    row-gap: 4px;
                    background: white;
                    padding: 6px 15px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                }
                .month-item { display: flex; justify-content: space-between; font-size: 8.5px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 1px; }
                .month-name { font-weight: 700; color: #475569; text-transform: capitalize; }
                .month-count { font-weight: 800; color: #1e3a8a; }

                .event-desc { display: flex; justify-content: space-between; font-size: 6.8px; border-bottom: 1px dashed #cbd5e1; padding: 0.5px 0; }
                .event-date { font-weight: 800; color: #1e3a8a; min-width: 22px; }
                .event-title { text-align: right; color: #475569; }

                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 6px;
                    margin-top: 10px;
                }
                .month-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px; }
                .month-header { font-size: 9px; font-weight: 800; color: #1e3a8a; margin-bottom: 2px; }
                .weekdays-grid {
                    display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 6px; font-weight: 700; color: #94a3b8;
                    border-bottom: 1px solid #f1f5f9; padding-bottom: 2px; margin-bottom: 2px;
                }
                .days-container { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }
                .day-cell { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 7.5px; font-weight: 500; border-radius: 4px; border: 1px solid #cbd5e1; }
                .day-empty { border: none !important; }
                .day-cell.bim-start { background: #eff6ff; border: 1px solid #3b82f6; font-weight: 800; }
                .dots-container { display: flex; gap: 1.5px; margin-top: 1.5px; height: 4px; }
                .dot { width: 4px; height: 4px; border-radius: 50%; }

                .legend-section {
                    background: white; padding: 4px; border-radius: 6px; display: flex; justify-content: center; gap: 8px; border: 1px solid #e2e8f0;
                    margin-top: 10px;
                }
                .legend-item { display: flex; align-items: center; gap: 3px; font-size: 7.5px; font-weight: 600; color: #475569; }
                .legend-dot { width: 7px; height: 7px; border-radius: 50%; }

                .footer { text-align: center; font-size: 6.5px; color: #94a3b8; margin-top: 5px; }

                @media print {
                    body { background: transparent; padding: 0; }
                    .header, .month-card, .bimester-card, .monthly-summary, .legend-section, .events-column { box-shadow: none; border-color: #cbd5e1; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo-info">
                        <img src="${logoUrl}" alt="Logo">
                        <h1>CALENDÁRIO ESCOLAR ${currentYear}</h1>
                    </div>
                    <div class="unit-badge">
                        UNIDADE: ${unitInfo.name.toUpperCase().replace('EXPANSIVO - ', '')} <br>
                        ${unitId === 'all' ? 'REDE DE ENSINO' : unitInfo.city + ' / ' + unitInfo.uf}
                    </div>
                </div>

                <div class="top-content">
                    <div class="tables-column">
                        <div class="section-header">
                            <h3>Períodos Letivos (Bimestres)</h3>
                            <div class="total-badge">Total: ${totalSchoolDays} Dias Letivos</div>
                        </div>
                        <div class="bimester-grid">${bimesterCards}</div>

                        <div class="section-header" style="border-left-color: #64748b; margin-top: 2px;">
                            <h3 style="color: #64748b;">Resumo Mensal de Dias Letivos</h3>
                        </div>
                        <div class="monthly-summary">${monthlySummaryHtml}</div>
                    </div>

                    <div class="events-column">
                        <div style="grid-column: span 2; font-size: 9px; font-weight: 800; color: #1e3a8a; border-bottom: 1px solid #1e3a8a; margin-bottom: 3px; text-transform: uppercase;">Acontecimentos e Feriados</div>
                        ${eventsListHtml}
                    </div>
                </div>

                <div class="calendar-grid">
                    ${Array.from({ length: 12 }, (_, i) => generateMonthHtml(i)).join('')}
                </div>

                <div class="legend-section">
                    ${Object.entries(CATEGORIES).map(([_, cat]) => `
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: ${cat.color}"></span>
                            ${cat.label}
                        </div>
                    `).join('')}
                </div>

                <div class="footer">
                    Documento gerado em ${formattedDate} para fins informativos. EXPANSIVO REDE DE ENSINO.
                </div>
            </div>
            <script>window.onload = () => window.print();</script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
    }
};
