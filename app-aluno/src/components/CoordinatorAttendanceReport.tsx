import React, { useMemo, useRef, useEffect, useState } from 'react';
import { UNIT_LABELS, SchoolUnit, SUBJECT_SHORT_LABELS } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { SCHOOL_LOGO_URL } from '../constants';
import { Printer, ClipboardList } from 'lucide-react';

const A4_W = 794;
const A4_H = 1123;
const ROWS_PER_PAGE = 36;

const getAbbreviatedSubjects = (subjectsList?: string[]) => {
    if (!subjectsList || subjectsList.length === 0) return '';
    return subjectsList.join(' - ');
};

interface CoordinatorAttendanceReportProps {
    reportData: Array<{
        teacherId: string;
        teacherName: string;
        assignments: any[];
        performedCount: number;
        expectedCount: number;
        statusColor: 'green' | 'yellow' | 'red';
        activeClassesCount?: number;
        activeSubjectsCount?: number;
        activeSubjectsList?: string[];
    }>;
    month: number;
    year: number;
    unit: string;
    loading: boolean;
    searchTerm: string;
    reportType?: 'monthly' | 'bimester' | 'daily';
    bimester?: number;
    dailyDate?: string;
}

export const CoordinatorAttendanceReport: React.FC<CoordinatorAttendanceReportProps> = ({
    reportData,
    month,
    year,
    unit,
    loading,
    searchTerm,
    reportType = 'monthly',
    bimester = 1,
    dailyDate = ''
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    const filteredData = useMemo(() => {
        return reportData.filter(item =>
            item.teacherName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [reportData, searchTerm]);

    useEffect(() => {
        const update = () => {
            if (wrapperRef.current) {
                const available = wrapperRef.current.offsetWidth;
                if (available > 0) {
                    setScale(Math.min(1, available / A4_W));
                }
            }
        };

        update();
        const timer = setTimeout(update, 100);
        window.addEventListener('resize', update);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', update);
        };
    }, [filteredData]);

    const unitLabel = UNIT_LABELS[unit as SchoolUnit] || unit;
    const monthLabel = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][month - 1];

    const pages = useMemo(() => {
        const pageList: typeof filteredData[] = [];
        for (let i = 0; i < filteredData.length; i += ROWS_PER_PAGE) {
            pageList.push(filteredData.slice(i, i + ROWS_PER_PAGE));
        }
        return pageList;
    }, [filteredData]);

    const handlePrint = () => {
        const pagesHtml = pages.map((pg, pi) => {
            const rows = pg.map((item, idx) => {
                const globalIdx = idx + 1 + pi * ROWS_PER_PAGE;
                const percent = item.expectedCount > 0 ? Math.round((item.performedCount / item.expectedCount) * 100) : 100;
                const color = item.statusColor === 'green' ? '#16a34a' : item.statusColor === 'yellow' ? '#ca8a04' : '#dc2626';
                const label = item.statusColor === 'green' ? 'COMPLETO' : item.statusColor === 'yellow' ? 'PARCIAL' : 'PENDENTE';

                // Sub-line: count unique classes, total subjects count, and list of active subjects abbreviated
                const numTurmas = item.activeClassesCount !== undefined ? item.activeClassesCount : (item.assignments?.length || 0);
                const numDisciplinas = item.activeSubjectsCount !== undefined ? item.activeSubjectsCount : (item.activeSubjectsList?.length || 0);
                const abbreviatedSubjects = getAbbreviatedSubjects(item.activeSubjectsList);
                const subLine = numTurmas > 0
                    ? `${numTurmas} turma${numTurmas !== 1 ? 's' : ''} &middot; ${numDisciplinas} disciplina${numDisciplinas !== 1 ? 's' : ''}${abbreviatedSubjects ? ` &middot; ${abbreviatedSubjects}` : ''}`
                    : '';

                return `<tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
                    <td class="col-pos">${globalIdx}º</td>
                    <td class="col-name">
                        <div style="font-size:10px;font-weight:800;color:#0f172a;">${item.teacherName.toUpperCase()}</div>
                        ${subLine ? `<div style="font-size:8px;font-weight:600;color:#94a3b8;margin-top:2px;">${subLine}</div>` : ''}
                    </td>
                    <td class="col-progress">${item.performedCount} / ${item.expectedCount} CHAMADAS (${percent}%)</td>
                    <td class="col-status" style="color:${color}; font-weight:bold;">${label}</td>
                </tr>`;
            }).join('');

            const footer = `<div class="page-footer"><span>MeuExpansivo</span><span style="text-transform:uppercase">Página ${pi + 1} de ${pages.length}</span></div>`;

            return `<div class="print-page">
                <div class="page-header">
                    <div style="display:flex;align-items:center;gap:12px">
                        <img src="${SCHOOL_LOGO_URL}" style="width:44px;height:44px;object-fit:contain" crossorigin="anonymous" />
                        <div class="school-info"><strong>EXPANSIVO REDE DE ENSINO</strong><span>Unidade: ${unitLabel}</span></div>
                    </div>
                    <div class="page-meta">
                        <div style="font-size:13px;font-weight:900;color:#111;letter-spacing:-0.3px;text-transform:uppercase">Relatório de Chamadas</div>
                        <div style="font-size:8px;font-weight:700;color:#334155;margin-top:3px;text-transform:uppercase">
                            ${reportType === 'daily'
                    ? `Data: <b>${dailyDate.split('-').reverse().join('/')}</b>`
                    : reportType === 'bimester'
                        ? `Bimestre: <b>${bimester}º Bimestre</b> &nbsp;|&nbsp; Ano: <b>${year}</b>`
                        : `Mês: <b>${monthLabel}</b> &nbsp;|&nbsp; Ano: <b>${year}</b>`
                }
                        </div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th class="th-pos">Pos</th>
                            <th class="th-name">Professor</th>
                            <th class="th-progress">Adesão / Progresso</th>
                            <th class="th-status" style="border-right:none;">Status</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                ${footer}
            </div>`;
        }).join('');

        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            const mobileHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Relatório de Chamadas — ${monthLabel}/${year}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { size: A4 portrait; margin: 0; }
        .screen-toolbar { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 16px; background: #1e3a8a; position: sticky; top: 0; z-index: 10; }
        .btn-close { background: white; color: #1e3a8a; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .btn-print { background: #f97316; color: white; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .print-page { width: 210mm; padding: 20px 24px 10px 24px; box-sizing: border-box; page-break-after: always; break-after: page; display: flex; flex-direction: column; background: white; margin: 16px auto; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
        .print-page:last-child { page-break-after: avoid; break-after: avoid; margin-bottom: 32px; }
        .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2.5px solid #111; }
        .school-info strong { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #111; letter-spacing: -0.5px; display: block; }
        .school-info span { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block; margin-top: 2px; }
        .page-meta { text-align: right; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; border: 1px solid #000; }
        thead tr { background: #f1f5f9; border-bottom: 1px solid #000; }
        .th-pos { width: 50px; padding: 7px 2px; text-align: center; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #64748b; border-right: 1px solid #000; }
        .th-name { width: auto; padding: 7px 10px; text-align: left; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-right: 1px solid #000; }
        .th-progress { width: 220px; padding: 7px 6px; text-align: center; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-right: 1px solid #000; }
        .th-status { width: 100px; padding: 7px 6px; text-align: center; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #0f172a; }
        tbody tr { border-bottom: 1px solid #000; }
        .row-even { background: #fff; }
        .row-odd { background: #f8fafc; }
        .col-pos { padding: 6px 2px; text-align: center; font-size: 9px; font-weight: 700; color: #64748b; border-right: 1px solid #000; }
        .col-name { padding: 6px 10px; text-align: left; border-right: 1px solid #000; }
        .col-progress { padding: 6px 6px; text-align: center; font-size: 9px; font-weight: 700; color: #334155; border-right: 1px solid #000; }
        .col-status { padding: 6px 6px; text-align: center; font-size: 9px; font-weight: 700; }
        .page-footer { padding-top: 8px; border-top: 0.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 8px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; margin-top: 8px; }
        @media print {
            body { background: white; }
            .screen-toolbar { display: none !important; }
            .print-page { margin: 0; box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="screen-toolbar">
        <button class="btn-close" onclick="window.close()">✕ Fechar</button>
        <button class="btn-print" onclick="window.print()">🖨 Imprimir</button>
    </div>
    ${pagesHtml}
</body>
</html>`;
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.open();
                printWindow.document.write(mobileHtml);
                printWindow.document.close();
            }
        } else {
            const styleId = 'temp-print-style';
            const containerId = 'temp-print-container';

            document.getElementById(styleId)?.remove();
            document.getElementById(containerId)?.remove();

            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                @media print {
                    body > *:not(#${containerId}) { display: none !important; }
                    body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    #${containerId} { display: block !important; width: 210mm; margin: 0 auto; background: white; font-family: Arial, sans-serif; }
                    @page { size: A4 portrait; margin: 0; }
                    .print-page { width: 210mm; height: auto; margin: 0; padding: 20px 24px 10px 24px; box-sizing: border-box; page-break-after: always !important; break-after: page !important; }
                    .print-page:last-child { page-break-after: avoid !important; break-after: avoid !important; }
                    .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2.5px solid #111; }
                    .school-info strong { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #111; letter-spacing: -0.5px; display: block; }
                    .school-info span { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block; margin-top: 2px; }
                    .page-meta { text-align: right; }
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; border: 1px solid #000; }
                    thead tr { background: #f1f5f9; border-bottom: 1px solid #000; }
                    .th-pos { width: 50px; padding: 7px 2px; text-align: center; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #64748b; border-right: 1px solid #000; }
                    .th-name { width: auto; padding: 7px 10px; text-align: left; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-right: 1px solid #000; }
                    .th-progress { width: 220px; padding: 7px 6px; text-align: center; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-right: 1px solid #000; }
                    .th-status { width: 100px; padding: 7px 6px; text-align: center; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #0f172a; }
                    tbody tr { border-bottom: 1px solid #000; }
                    .row-even { background: #fff; }
                    .row-odd { background: #f8fafc; }
                    .col-pos { padding: 6px 2px; text-align: center; font-size: 9px; font-weight: 700; color: #64748b; border-right: 1px solid #000; }
                    .col-name { padding: 6px 10px; font-size: 10px; font-weight: 700; color: #0f172a; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-right: 1px solid #000; }
                    .col-progress { padding: 6px 6px; text-align: center; font-size: 9px; font-weight: 700; color: #334155; border-right: 1px solid #000; }
                    .col-status { padding: 6px 6px; text-align: center; font-size: 9px; font-weight: 700; }
                    .page-footer { margin-top: auto; padding-top: 8px; border-top: 0.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 8px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; }
                }
                @media screen {
                    #${containerId} { display: none !important; }
                }
            `;

            const container = document.createElement('div');
            container.id = containerId;
            container.innerHTML = pagesHtml;

            document.head.appendChild(style);
            document.body.appendChild(container);
            container.offsetHeight;
            window.print();
            setTimeout(() => {
                document.head.removeChild(style);
                document.body.removeChild(container);
            }, 1000);
        }
    };

    if (filteredData.length === 0) {
        return (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 border-dashed mx-auto shadow-sm max-w-xl">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4">
                    <ClipboardList className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Nenhum professor encontrado</h3>
                <p className="text-gray-500 mt-1">Verifique os filtros ou altere sua busca.</p>
            </div>
        );
    }

    return (
        <div ref={wrapperRef} id="coordinator-attendance-report" className="w-full max-w-full overflow-hidden pb-10">
            {/* Print button */}
            <div className="flex justify-center sm:justify-end mb-6 w-full px-2 no-print">
                <button
                    onClick={handlePrint}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-blue-950 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg hover:scale-105 active:scale-95"
                >
                    <Printer className="w-4 h-4" /> Imprimir Relatório (A4)
                </button>
            </div>

            {/* Pages */}
            <div className="flex flex-col items-center gap-8 w-full">
                {pages.map((pageData, pageIdx) => (
                    <div
                        key={pageIdx}
                        style={{
                            width: Math.round(A4_W * scale),
                            height: Math.round(A4_H * scale),
                            overflow: 'hidden',
                            position: 'relative',
                            flexShrink: 0,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            background: 'white',
                        }}
                    >
                        <div
                            style={{
                                width: A4_W,
                                height: A4_H,
                                transform: `scale(${scale})`,
                                transformOrigin: 'top left',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                padding: '20px 24px 10px 24px',
                                boxSizing: 'border-box',
                                background: 'white',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: '2.5px solid #111' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 44, height: 44 }}><SchoolLogo variant="header" /></div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 900, color: '#111', textTransform: 'uppercase', letterSpacing: '-0.5px' }}>EXPANSIVO REDE DE ENSINO</div>
                                        <div style={{ fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>Unidade: {unitLabel}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 13, fontWeight: 900, color: '#111', textTransform: 'uppercase', letterSpacing: '-0.3px' }}>Relatório de Chamadas</div>
                                    <div style={{ fontSize: 8, fontWeight: 700, color: '#334155', marginTop: 3, textTransform: 'uppercase' }}>
                                        {reportType === 'daily' ? (
                                            <>Data: <b>{dailyDate.split('-').reverse().join('/')}</b></>
                                        ) : reportType === 'bimester' ? (
                                            <>Bimestre: <b>{bimester}º Bimestre</b> &nbsp;|&nbsp; Ano: <b>{year}</b></>
                                        ) : (
                                            <>Mês: <b>{monthLabel}</b> &nbsp;|&nbsp; Ano: <b>{year}</b></>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 9, border: '1px solid #000' }}>
                                <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #000' }}>
                                    <tr>
                                        <th style={{ width: 50, padding: '6px 2px', textAlign: 'center', fontSize: 8, fontWeight: 900, textTransform: 'uppercase', color: '#64748b', borderRight: '1px solid #000' }}>Pos</th>
                                        <th style={{ width: 'auto', padding: '6px 10px', textAlign: 'left', fontSize: 8, fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', borderRight: '1px solid #000' }}>Professor</th>
                                        <th style={{ width: 220, padding: '6px 6px', textAlign: 'center', fontSize: 8, fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', borderRight: '1px solid #000' }}>Adesão / Progresso</th>
                                        <th style={{ width: 100, padding: '6px 6px', textAlign: 'center', fontSize: 8, fontWeight: 900, textTransform: 'uppercase', color: '#0f172a' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageData.map((item, idx) => {
                                        const globalIdx = idx + 1 + pageIdx * ROWS_PER_PAGE;
                                        const percent = item.expectedCount > 0 ? Math.round((item.performedCount / item.expectedCount) * 100) : 100;
                                        const statusText = item.statusColor === 'green' ? 'COMPLETO' : item.statusColor === 'yellow' ? 'PARCIAL' : 'PENDENTE';
                                        const statusTextColor = item.statusColor === 'green' ? '#16a34a' : item.statusColor === 'yellow' ? '#ca8a04' : '#dc2626';
                                        const isEven = idx % 2 === 0;

                                        // Sub-line: unique classes, total subjects count, and active subjects list abbreviated
                                        const numTurmas = item.activeClassesCount !== undefined ? item.activeClassesCount : (item.assignments?.length || 0);
                                        const numDisciplinas = item.activeSubjectsCount !== undefined ? item.activeSubjectsCount : (item.activeSubjectsList?.length || 0);
                                        const abbreviatedSubjects = getAbbreviatedSubjects(item.activeSubjectsList);

                                        return (
                                            <tr
                                                key={item.teacherId}
                                                style={{
                                                    background: isEven ? '#ffffff' : '#f8fafc',
                                                    borderBottom: '1px solid #000',
                                                }}
                                            >
                                                <td style={{ padding: '6px 2px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#64748b', borderRight: '1px solid #000' }}>
                                                    {globalIdx}º
                                                </td>
                                                <td style={{ padding: '6px 10px', borderRight: '1px solid #000' }}>
                                                    <div style={{ fontSize: 10, fontWeight: 800, color: '#0f172a' }}>
                                                        {item.teacherName.toUpperCase()}
                                                    </div>
                                                    {numTurmas > 0 && (
                                                        <div style={{ fontSize: 8, fontWeight: 600, color: '#94a3b8', marginTop: 2 }}>
                                                            {numTurmas} turma{numTurmas !== 1 ? 's' : ''} · {numDisciplinas} disciplina{numDisciplinas !== 1 ? 's' : ''}{abbreviatedSubjects ? ` · ${abbreviatedSubjects}` : ''}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '6px 6px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#334155', borderRight: '1px solid #000' }}>
                                                    {item.performedCount} / {item.expectedCount} CHAMADAS ({percent}%)
                                                </td>
                                                <td style={{ padding: '6px 6px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: statusTextColor }}>
                                                    {statusText}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Page Footer */}
                            <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '0.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 7.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>
                                <span>MeuExpansivo</span>
                                <span style={{ textTransform: 'uppercase' }}>Página {pageIdx + 1} de {pages.length}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
