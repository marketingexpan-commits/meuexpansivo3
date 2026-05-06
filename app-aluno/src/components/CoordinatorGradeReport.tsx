import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Student, GradeEntry, AcademicSubject, CurriculumMatrix, SUBJECT_SHORT_LABELS, UNIT_LABELS, SchoolUnit, SchoolShift, SHIFT_LABELS } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { getCurriculumSubjects, SCHOOL_LOGO_URL } from '../constants';
import { getSubjectShortLabel } from '../utils/subjectUtils';
import { Printer, FileSpreadsheet } from 'lucide-react';

const A4_W = 794;
const A4_H = 1123;
const ROWS_PER_PAGE = 46;

interface CoordinatorGradeReportProps {
    students: Student[]; grades: GradeEntry[]; selectedBimester: number;
    selectedGrade: string; selectedClass: string; selectedShift: string;
    unit: string; academicSubjects?: AcademicSubject[]; matrices?: CurriculumMatrix[];
}

export const CoordinatorGradeReport: React.FC<CoordinatorGradeReportProps> = ({
    students, grades, selectedBimester, selectedGrade, selectedClass, selectedShift, unit, academicSubjects, matrices
}) => {
    const bimesterKey = `bimester${selectedBimester}` as keyof GradeEntry['bimesters'];
    // wrapperRef is on the outer container whose width is constrained by the layout (w-full + overflow-hidden on parent).
    // Crucially, it does NOT contain the 794px A4 div yet when the first measurement runs.
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const update = () => {
            if (wrapperRef.current) {
                // offsetWidth gives the element's rendered width, capped by its own CSS constraints (w-full / max-w-full).
                // Because we set overflow-hidden on the parent and w-full here, this will never exceed the viewport.
                const available = wrapperRef.current.offsetWidth;
                if (available > 0) {
                    setScale(Math.min(1, available / A4_W));
                }
            }
        };

        // Run immediately and after a short paint delay to be safe
        update();
        const timer = setTimeout(update, 100);
        window.addEventListener('resize', update);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', update);
        };
    }, [students]); // Re-run when report data changes

    const sortedStudents = useMemo(() => [...students].sort((a, b) => a.name.localeCompare(b.name)), [students]);

    const subjectsToShow = useMemo(() => {
        if (students.length === 0) return [];

        const subjectSet = new Set<string>();
        grades.forEach(g => {
            const bData = g.bimesters?.[bimesterKey];
            const hasRealNota = bData?.nota !== undefined && bData?.nota !== null;
            if (g.subject && g.subject !== 'general_early_childhood' && g.subject !== 'general_activity' && hasRealNota) {
                subjectSet.add(g.subject);
            }
        });
        
        let subjects = Array.from(subjectSet);

        if (selectedGrade.includes('9º Ano')) {
            subjects = subjects.filter(id => id !== 'disc_sociologia');
        }

        return subjects
            .sort((a, b) => {
                const sA = academicSubjects?.find(s => s.id === a);
                const sB = academicSubjects?.find(s => s.id === b);
                if (sA?.order !== undefined && sB?.order !== undefined) {
                    return sA.order - sB.order;
                }
                const indexA = Object.keys(SUBJECT_SHORT_LABELS).indexOf(a);
                const indexB = Object.keys(SUBJECT_SHORT_LABELS).indexOf(b);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return a.localeCompare(b);
            });
    }, [selectedGrade, selectedBimester, academicSubjects, matrices, unit, selectedShift, students, grades, bimesterKey]);

    const unitLabel = UNIT_LABELS[unit as SchoolUnit] || unit;
    const shiftLabel = SHIFT_LABELS[selectedShift as SchoolShift] || selectedShift;
    const pages: Student[][] = [];
    for (let i = 0; i < sortedStudents.length; i += ROWS_PER_PAGE) pages.push(sortedStudents.slice(i, i + ROWS_PER_PAGE));

    const handlePrint = () => {
        const pagesHtml = pages.map((pg, pi) => {
            const rows = pg.map((s, idx) => {
                const sg = grades.filter(g => g.studentId === s.id);
                const cells = subjectsToShow.map((id, si) => {
                    const bData = sg.find(g => g.subject === id)?.bimesters?.[bimesterKey];
                    const notaValue = bData?.media;
                    const hasLaunched = bData?.nota !== undefined && bData?.nota !== null;
                    const val = hasLaunched ? (notaValue !== undefined ? notaValue.toFixed(1) : '0.0') : '-';
                    const red = hasLaunched && notaValue !== undefined && notaValue < 7;
                    return `<td class="td-subj ${red ? 'red' : ''}" style="${si === subjectsToShow.length - 1 ? 'border-right:none' : ''}">${val}</td>`;
                }).join('');
                return `<tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}"><td class="col-code">${s.code}</td><td class="col-name">${s.name.toUpperCase()}</td>${cells}</tr>`;
            }).join('');
            const footer = `<div class="page-footer"><span>MeuExpansivo</span><span style="text-transform:uppercase">Página ${pi + 1} de ${pages.length}</span></div>`;
            return `<div class="print-page">
                <div class="page-header">
                    <div style="display:flex;align-items:center;gap:12px">
                        <img src="${SCHOOL_LOGO_URL}" style="width:44px;height:44px;object-fit:contain" crossorigin="anonymous" />
                        <div class="school-info"><strong>EXPANSIVO REDE DE ENSINO</strong><span>Unidade: ${unitLabel}</span></div>
                    </div>
                    <div class="page-meta">
                        <div style="font-size:13px;font-weight:900;color:#111;letter-spacing:-0.3px;text-transform:uppercase">Relatório de Notas</div>
                        <div style="font-size:8px;font-weight:700;color:#334155;margin-top:3px;text-transform:uppercase"><b>${selectedGrade}</b> &nbsp;|&nbsp; <span style="color:#94a3b8">Turma:</span> <b>${selectedClass}</b> &nbsp;|&nbsp; <span style="color:#94a3b8">Turno:</span> <b>${shiftLabel}</b> &nbsp;|&nbsp; <b>${selectedBimester}º Bimestre</b></div>
                    </div>
                </div>
                <table><thead><tr><th class="th-code">Cód.</th><th class="th-name">Aluno(a)</th>${subjectsToShow.map((id, idx) => `<th class="subj-th" style="${idx === subjectsToShow.length - 1 ? 'border-right:none' : ''}"><div class="subj-label"><span>${getSubjectShortLabel(id, academicSubjects)}</span></div></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
                ${footer}
            </div>`;
        }).join('');

        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            // --- MOBILE: Open a fresh self-contained window ---
            // This avoids iOS/Android capturing app UI elements in the print dialog
            // and ensures A4 dimensions render correctly on mobile browsers.
            const mobileHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Relatório de Notas — ${selectedGrade} ${selectedClass} ${selectedBimester}º Bim</title>
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
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; border: 1px solid #000; }
        thead tr { background: #f1f5f9; border-bottom: 1px solid #000; }
        .th-code { width: 40px; padding: 4px 2px; text-align: center; font-size: 7.5px; font-weight: 900; text-transform: uppercase; color: #64748b; border-right: 1px solid #000; }
        .th-name { width: auto; padding: 4px 6px; text-align: left; font-size: 8px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-right: 1px solid #000; }
        .subj-th { width: 30px; padding: 0; background: #f8fafc; border-right: 1px solid #000; }
        .subj-label { height: 48px; display: flex; align-items: center; justify-content: center; }
        .subj-label span { display: inline-block; transform: rotate(-90deg); white-space: nowrap; font-size: 8.5px; font-weight: 900; text-transform: uppercase; color: #1e293b; letter-spacing: -0.3px; }
        tbody tr { border-bottom: 1px solid #000; }
        .row-even { background: #fff; }
        .row-odd { background: #f8fafc; }
        .col-code { padding: 3px 2px; text-align: center; font-size: 7.5px; font-weight: 700; color: #94a3b8; font-family: monospace; border-right: 1px solid #000; }
        .col-name { padding: 3px 6px; font-size: 8px; font-weight: 700; color: #0f172a; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-right: 1px solid #000; }
        .td-subj { padding: 3px 2px; text-align: center; font-size: 8.5px; font-weight: 700; color: #334155; border-right: 1px solid #000; }
        .td-subj.red { color: #dc2626; }
        .page-footer { padding-top: 8px; border-top: 0.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; margin-top: 8px; }
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
            // --- DESKTOP: Original behavior (works perfectly on desktop) ---
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
                    .school-info span { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block; margin-top: 2px; }
                    .page-meta { text-align: right; }
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; border: 1px solid #000; }
                    thead tr { background: #f1f5f9; border-bottom: 1px solid #000; }
                    .th-code { width: 40px; padding: 4px 2px; text-align: center; font-size: 7.5px; font-weight: 900; text-transform: uppercase; color: #64748b; border-right: 1px solid #000; }
                    .th-name { width: auto; padding: 4px 6px; text-align: left; font-size: 8px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-right: 1px solid #000; }
                    .subj-th { width: 30px; padding: 0; background: #f8fafc; border-right: 1px solid #000; }
                    .subj-label { height: 48px; display: flex; align-items: center; justify-content: center; }
                    .subj-label span { display: inline-block; transform: rotate(-90deg); white-space: nowrap; font-size: 8.5px; font-weight: 900; text-transform: uppercase; color: #1e293b; letter-spacing: -0.3px; }
                    tbody tr { border-bottom: 1px solid #000; }
                    .row-even { background: #fff; }
                    .row-odd { background: #f8fafc; }
                    .col-code { padding: 3px 2px; text-align: center; font-size: 7.5px; font-weight: 700; color: #94a3b8; font-family: monospace; border-right: 1px solid #000; }
                    .col-name { padding: 3px 6px; font-size: 8px; font-weight: 700; color: #0f172a; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-right: 1px solid #000; }
                    .td-subj { padding: 3px 2px; text-align: center; font-size: 8.5px; font-weight: 700; color: #334155; border-right: 1px solid #000; }
                    .td-subj.red { color: #dc2626; }
                    .page-footer { margin-top: auto; padding-top: 8px; border-top: 0.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; }
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

    if (students.length === 0) {
        return (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 border-dashed mx-auto shadow-sm max-w-xl">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4"><FileSpreadsheet className="w-8 h-8" /></div>
                <h3 className="text-lg font-medium text-gray-900">Nenhum aluno encontrado</h3>
                <p className="text-gray-500 mt-1">Selecione os filtros acima para gerar o relatório.</p>
            </div>
        );
    }

    return (
        // This outer wrapper is constrained by the layout (w-full + overflow-hidden).
        // Its offsetWidth reliably reflects the available screen space, never inflated by inner A4 content.
        <div ref={wrapperRef} id="coordinator-grade-report" className="w-full max-w-full overflow-hidden pb-10">
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
                {pages.map((pageStudents, pageIdx) => (
                    // Outer shell: clips to scaled dimensions
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
                        {/* Inner shell: full A4 size, scaled via CSS transform */}
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
                                        <div style={{ fontSize: 8, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>Unidade: {UNIT_LABELS[unit as SchoolUnit] || unit}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 13, fontWeight: 900, color: '#111', textTransform: 'uppercase', letterSpacing: '-0.3px' }}>Relatório de Notas</div>
                                    <div style={{ fontSize: 8, fontWeight: 700, color: '#334155', marginTop: 3 }}>
                                        <b>{selectedGrade}</b> &nbsp;|&nbsp; <span style={{ color: '#94a3b8' }}>Turma:</span> <b>{selectedClass}</b> &nbsp;|&nbsp; <span style={{ color: '#94a3b8' }}>Turno:</span> <b>{SHIFT_LABELS[selectedShift as SchoolShift] || selectedShift}</b> &nbsp;|&nbsp; <b>{selectedBimester}º Bimestre</b>
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', fontSize: 9, border: '1px solid #000' }}>
                                <thead>
                                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #000' }}>
                                        <th style={{ width: 40, padding: '4px 2px', textAlign: 'center', fontSize: 7.5, fontWeight: 900, textTransform: 'uppercase', color: '#64748b', borderRight: '1px solid #000' }}>Cód.</th>
                                        <th style={{ width: 'auto', padding: '4px 6px', textAlign: 'left', fontSize: 8, fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', borderRight: '1px solid #000' }}>Aluno(a)</th>
                                        {subjectsToShow.map((id, si) => (
                                            <th key={id} style={{ width: 30, padding: 0, background: '#f8fafc', borderRight: si < subjectsToShow.length - 1 ? '1px solid #000' : 'none' }}>
                                                <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span style={{ display: 'inline-block', transform: 'rotate(-90deg)', whiteSpace: 'nowrap', fontSize: 8.5, fontWeight: 900, textTransform: 'uppercase', color: '#1e293b', letterSpacing: '-0.3px' }}>
                                                        {getSubjectShortLabel(id, academicSubjects)}
                                                    </span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageStudents.map((student, idx) => {
                                        const sg = grades.filter(g => g.studentId === student.id);
                                        return (
                                            <tr key={student.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #000' }}>
                                                <td style={{ padding: '3px 2px', textAlign: 'center', fontSize: 7.5, fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace', borderRight: '1px solid #000', width: 40 }}>{student.code}</td>
                                                <td style={{ padding: '3px 6px', fontSize: 8, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderRight: '1px solid #000', width: 'auto' }}>{student.name.toUpperCase()}</td>
                                                {subjectsToShow.map((id, si) => {
                                                    const bData = sg.find(g => g.subject === id)?.bimesters?.[bimesterKey];
                                                    const notaValue = bData?.media;
                                                    const hasLaunched = bData?.nota !== undefined && bData?.nota !== null;
                                                    const display = hasLaunched ? (notaValue !== undefined ? notaValue.toFixed(1) : '0.0') : '-';
                                                    return (
                                                        <td key={id} style={{ padding: '3px 2px', textAlign: 'center', fontSize: 8.5, fontWeight: 700, color: (hasLaunched && notaValue !== undefined && notaValue < 7) ? '#dc2626' : '#334155', borderRight: si < subjectsToShow.length - 1 ? '1px solid #000' : 'none', width: 30 }}>
                                                            {display}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Footer */}
                            <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '0.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 7.5, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
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
