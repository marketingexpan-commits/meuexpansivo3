import React, { useMemo, useRef, useEffect, useState } from 'react';
import { UNIT_LABELS, SchoolUnit, SchoolShift, SHIFT_LABELS, AcademicGrade } from '../types';
import { SCHOOL_LOGO_URL } from '../constants';
import { Printer, Calendar as CalendarIcon, Users, CheckCircle, AlertTriangle } from 'lucide-react';

const A4_W = 794;
const A4_H = 1123;
const ROWS_PER_PAGE = 43;

export interface DailyAbsentStudent {
    studentId: string;
    code: string;
    name: string;
    gradeLevel: string;
    schoolClass: string;
    shift: string;
    orderIndex?: number;
    absences: Array<{
        discipline: string;
        disciplineLabel: string;
        count: number;
        isExcused?: boolean;
        reason?: string;
    }>;
    totalAbsences: number;
    hasExcused: boolean;
}

interface CoordinatorDailyAbsenceReportProps {
    date: string;
    unit: string;
    shiftFilter?: string;
    absentStudents: DailyAbsentStudent[];
    academicGrades?: AcademicGrade[];
}

const REPORT_CSS = `
    .daily-page { width: 794px; height: 1123px; padding: 22px 26px 14px 26px; box-sizing: border-box; background: white; display: flex; flex-direction: column; font-family: Arial, sans-serif; }
    .daily-page .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2.5px solid #111; }
    .daily-page .school-info strong { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #111; letter-spacing: -0.5px; display: block; }
    .daily-page .school-info span { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block; margin-top: 2px; }
    .daily-page .page-meta { text-align: right; }
    .daily-page .report-summary-bar { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; margin-bottom: 8px; font-size: 8.5px; font-weight: 700; color: #334155; }
    .daily-page .report-summary-bar strong { color: #0f172a; font-weight: 900; }
    .daily-page table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.5px; border: 1px solid #000; }
    .daily-page thead tr { background: #f1f5f9; border-bottom: 1px solid #000; }
    .daily-page .th-code { width: 38px; padding: 5px 2px; text-align: center; font-size: 7.5px; font-weight: 900; text-transform: uppercase; color: #64748b; border-right: 1px solid #000; }
    .daily-page .th-name { width: 190px; padding: 5px 6px; text-align: left; font-size: 8px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-right: 1px solid #000; }
    .daily-page .th-grade { width: 110px; padding: 5px 4px; text-align: left; font-size: 8px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-right: 1px solid #000; }
    .daily-page .th-shift { width: 55px; padding: 5px 2px; text-align: center; font-size: 7.5px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-right: 1px solid #000; }
    .daily-page .th-subjects { width: auto; padding: 5px 6px; text-align: left; font-size: 8px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-right: 1px solid #000; }
    .daily-page .th-total { width: 42px; padding: 5px 2px; text-align: center; font-size: 7.5px; font-weight: 900; text-transform: uppercase; color: #0f172a; background: #e2e8f0; border-right: 1px solid #000; }
    .daily-page .th-status { width: 62px; padding: 5px 2px; text-align: center; font-size: 7.5px; font-weight: 900; text-transform: uppercase; color: #0f172a; }
    .daily-page tbody tr { border-bottom: 1px solid #000; }
    .daily-page .row-even { background: #fff; }
    .daily-page .row-odd { background: #f8fafc; }
    .daily-page .col-code { padding: 4px 2px; text-align: center; font-size: 7.5px; font-weight: 700; color: #94a3b8; font-family: monospace; border-right: 1px solid #000; }
    .daily-page .col-name { padding: 4px 6px; font-size: 8px; font-weight: 800; color: #0f172a; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-right: 1px solid #000; }
    .daily-page .col-grade { padding: 4px 4px; font-size: 8px; font-weight: 700; color: #1e293b; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-right: 1px solid #000; }
    .daily-page .col-shift { padding: 4px 2px; font-size: 7.5px; font-weight: 700; color: #475569; text-align: center; border-right: 1px solid #000; }
    .daily-page .col-subjects { padding: 4px 6px; font-size: 8px; font-weight: 600; color: #1e293b; text-align: left; border-right: 1px solid #000; }
    .daily-page .col-total { padding: 4px 2px; font-size: 8.5px; font-weight: 900; color: #b45309; background: #fef3c7; text-align: center; border-right: 1px solid #000; }
    .daily-page .col-status { padding: 4px 2px; font-size: 7.5px; font-weight: 800; text-align: center; }
    .daily-page .badge-excused { color: #15803d; }
    .daily-page .badge-regular { color: #b45309; }
    .daily-page .page-footer { margin-top: auto; padding-top: 8px; border-top: 0.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; }
`;

export const CoordinatorDailyAbsenceReport: React.FC<CoordinatorDailyAbsenceReportProps> = ({
    date,
    unit,
    shiftFilter,
    absentStudents,
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const update = () => {
            if (wrapperRef.current) {
                const available = wrapperRef.current.offsetWidth;
                if (available > 0) setScale(Math.min(1, available / A4_W));
            }
        };
        update();
        const timer = setTimeout(update, 100);
        window.addEventListener('resize', update);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', update);
        };
    }, [absentStudents]);

    const unitLabel = UNIT_LABELS[unit as SchoolUnit] || unit;
    const shiftLabel = shiftFilter && shiftFilter !== 'all' ? (SHIFT_LABELS[shiftFilter as SchoolShift] || shiftFilter) : 'Todos os Turnos';

    const formattedDate = useMemo(() => {
        if (!date) return { numeric: '', full: '' };
        const [y, m, d] = date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const weekDays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const dayStr = String(d).padStart(2, '0');
        const monthStr = String(m).padStart(2, '0');
        return {
            numeric: `${dayStr}/${monthStr}/${y}`,
            full: `${weekDays[dateObj.getDay()]}, ${d} de ${months[m - 1]} de ${y}`
        };
    }, [date]);

    // Resumo do dia
    const totalAbsentCount = absentStudents.length;
    const totalAbsencesCount = useMemo(() => absentStudents.reduce((acc, curr) => acc + curr.totalAbsences, 0), [absentStudents]);

    // Paginação
    const pages: DailyAbsentStudent[][] = [];
    for (let i = 0; i < absentStudents.length; i += ROWS_PER_PAGE) {
        pages.push(absentStudents.slice(i, i + ROWS_PER_PAGE));
    }

    const buildPageHtml = (pageStudents: DailyAbsentStudent[], pageIdx: number) => {
        const rowsHtml = pageStudents.map((s, idx) => {
            const subjectsText = s.absences.map(a => `${a.disciplineLabel} (${a.count})`).join(', ');
            const statusLabel = s.hasExcused ? 'Abonada' : 'Falta';
            const statusClass = s.hasExcused ? 'badge-excused' : 'badge-regular';

            return `<tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
                <td class="col-code">${s.code || '-'}</td>
                <td class="col-name" title="${s.name}">${s.name.toUpperCase()}</td>
                <td class="col-grade">${s.gradeLevel} - Turma ${s.schoolClass}</td>
                <td class="col-shift">${s.shift || '-'}</td>
                <td class="col-subjects" title="${subjectsText}">${subjectsText}</td>
                <td class="col-total">${s.totalAbsences}</td>
                <td class="col-status ${statusClass}">${statusLabel}</td>
            </tr>`;
        }).join('');

        return `<div class="daily-page">
            <div class="page-header">
                <div style="display:flex;align-items:center;gap:12px">
                    <img src="${SCHOOL_LOGO_URL}" style="width:44px;height:44px;object-fit:contain" crossorigin="anonymous" />
                    <div class="school-info">
                        <strong>EXPANSIVO REDE DE ENSINO</strong>
                        <span>Unidade: ${unitLabel} &nbsp;|&nbsp; Turno: ${shiftLabel}</span>
                    </div>
                </div>
                <div class="page-meta">
                    <div style="font-size:13px;font-weight:900;color:#111;letter-spacing:-0.3px;text-transform:uppercase">Relatório Diário de Faltas</div>
                    <div style="font-size:8.5px;font-weight:700;color:#334155;margin-top:3px;text-transform:uppercase">
                        <b>${formattedDate.numeric}</b> &nbsp;|&nbsp; <span style="color:#64748b">${formattedDate.full}</span>
                    </div>
                </div>
            </div>

            <div class="report-summary-bar">
                <span>Alunos faltantes no dia: <strong>${totalAbsentCount}</strong></span>
                <span>Total de faltas registradas: <strong>${totalAbsencesCount}</strong></span>
                <span>Organizado em ordem crescente por Série</span>
            </div>

            <table>
                <thead>
                    <tr>
                        <th class="th-code">Cód.</th>
                        <th class="th-name">Aluno(a)</th>
                        <th class="th-grade">Série / Turma</th>
                        <th class="th-shift">Turno</th>
                        <th class="th-subjects">Disciplinas com Falta (Qtd)</th>
                        <th class="th-total">Faltas</th>
                        <th class="th-status">Situação</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="page-footer">
                <span>MeuExpansivo — Relatório Diário de Frequência</span>
                <span style="text-transform:uppercase">Página ${pageIdx + 1} de ${pages.length}</span>
            </div>
        </div>`;
    };

    const handlePrint = () => {
        const pagesHtml = pages.map((pg, pi) => buildPageHtml(pg, pi)).join('');
        const isMobile = window.innerWidth < 768;
        const printCss = `
            ${REPORT_CSS}
            @page { size: A4 portrait; margin: 0; }
            .daily-page { height: auto; min-height: 1123px; page-break-after: always; break-after: page; }
            .daily-page:last-child { page-break-after: avoid; break-after: avoid; }
        `;

        if (isMobile) {
            const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Relatório Diário de Faltas — ${formattedDate.numeric}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .screen-toolbar { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 16px; background: #1e3a8a; position: sticky; top: 0; z-index: 10; }
                    .btn-close { background: white; color: #1e3a8a; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
                    .btn-print { background: #f97316; color: white; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
                    ${printCss}
                    .daily-page { margin: 16px auto; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
                    @media print { body { background: white; } .screen-toolbar { display: none !important; } .daily-page { margin: 0; box-shadow: none; } }
                </style></head><body>
                <div class="screen-toolbar"><button class="btn-close" onclick="window.close()">✕ Fechar</button><button class="btn-print" onclick="window.print()">🖨 Imprimir</button></div>
                ${pagesHtml}</body></html>`;
            const w = window.open('', '_blank');
            if (w) { w.document.open(); w.document.write(html); w.document.close(); }
            return;
        }

        const styleId = 'temp-daily-print-style';
        const containerId = 'temp-daily-print-container';
        document.getElementById(styleId)?.remove();
        document.getElementById(containerId)?.remove();

        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            @media print {
                body > *:not(#${containerId}) { display: none !important; }
                body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                #${containerId} { display: block !important; width: 210mm; margin: 0 auto; background: white; }
                ${printCss}
            }
            @media screen { #${containerId} { display: none !important; } }
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
    };

    if (absentStudents.length === 0) {
        return (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 border-dashed mx-auto shadow-sm max-w-xl">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mb-4">
                    <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Nenhuma falta registrada no dia</h3>
                <p className="text-gray-500 mt-1 text-sm">
                    Não foram encontradas ausências registradas para a data {formattedDate.numeric || date} na unidade selecionada.
                </p>
            </div>
        );
    }

    return (
        <div ref={wrapperRef} id="coordinator-daily-absence-report" className="w-full max-w-full overflow-hidden pb-10">
            <style>{REPORT_CSS}</style>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 w-full px-2 gap-3 no-print">
                <div className="flex items-center gap-3">
                    <span className="px-3.5 py-1.5 rounded-full bg-orange-100 text-orange-900 font-extrabold text-xs">
                        {totalAbsentCount} aluno(s) faltante(s)
                    </span>
                    <span className="px-3.5 py-1.5 rounded-full bg-gray-100 text-gray-700 font-bold text-xs">
                        {totalAbsencesCount} falta(s) no total
                    </span>
                </div>
                <button
                    onClick={handlePrint}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-blue-950 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg hover:scale-105 active:scale-95"
                >
                    <Printer className="w-4 h-4" /> Imprimir Relatório Diário (A4)
                </button>
            </div>

            <div className="flex flex-col items-center gap-8 w-full">
                {pages.map((pageStudents, pageIdx) => (
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
                            style={{ transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}
                            dangerouslySetInnerHTML={{ __html: buildPageHtml(pageStudents, pageIdx) }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
