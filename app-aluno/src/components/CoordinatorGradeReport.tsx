import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Student, GradeEntry, AcademicSubject, CurriculumMatrix, SUBJECT_SHORT_LABELS, UNIT_LABELS, SchoolUnit, SchoolShift, SHIFT_LABELS } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { getCurriculumSubjects, SCHOOL_LOGO_URL } from '../constants';
import { Printer, FileSpreadsheet } from 'lucide-react';

const A4_W = 794;
const A4_H = 1123;
const ROWS_PER_PAGE = 44;

interface CoordinatorGradeReportProps {
    students: Student[]; grades: GradeEntry[]; selectedBimester: number;
    selectedGrade: string; selectedClass: string; selectedShift: string;
    unit: string; academicSubjects?: AcademicSubject[]; matrices?: CurriculumMatrix[];
}

export const CoordinatorGradeReport: React.FC<CoordinatorGradeReportProps> = ({
    students, grades, selectedBimester, selectedGrade, selectedClass, selectedShift, unit, academicSubjects, matrices
}) => {
    const bimesterKey = `bimester${selectedBimester}` as keyof GradeEntry['bimesters'];
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const update = () => {
            if (containerRef.current) {
                setScale(Math.min(1, (containerRef.current.clientWidth - 60) / A4_W));
            }
        };
        update();
        const ro = new ResizeObserver(update);
        if (containerRef.current) ro.observe(containerRef.current);
        window.addEventListener('resize', update);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', update);
        };
    }, []);

    const sortedStudents = useMemo(() => [...students].sort((a, b) => a.name.localeCompare(b.name)), [students]);

    const subjectsToShow = useMemo(() => {
        if (students.length === 0) return [];
        
        const matrixSubjects = getCurriculumSubjects(selectedGrade, academicSubjects, matrices, unit, selectedShift);
        const allActiveCount = (academicSubjects || []).filter(s => s.isActive !== false).length;
        
        let subjects: string[] = [];
        
        // 1. Se temos uma matriz definida (e não é o fallback de "todas"), usamos ela como prioridade
        if (matrixSubjects.length > 0 && matrixSubjects.length < allActiveCount) {
            subjects = matrixSubjects;
        } else {
            // 2. Fallback: Mostra apenas disciplinas que possuem notas realmente lançadas
            const subjectSet = new Set<string>();
            grades.forEach(g => {
                const bData = g.bimesters?.[bimesterKey];
                const hasRealNota = bData?.nota !== undefined && bData?.nota !== null;
                if (g.subject?.startsWith('disc_') && SUBJECT_SHORT_LABELS[g.subject] && hasRealNota) {
                    subjectSet.add(g.subject);
                }
            });
            subjects = Array.from(subjectSet);
        }

        // 3. Exclusão pontual solicitada pelo usuário (Sociologia no 9º ano foi erro de lançamento)
        if (selectedGrade.includes('9º Ano')) {
            subjects = subjects.filter(id => id !== 'disc_sociologia');
        }

        return subjects
            .filter(id => id.startsWith('disc_') && SUBJECT_SHORT_LABELS[id])
            .sort((a, b) => Object.keys(SUBJECT_SHORT_LABELS).indexOf(a) - Object.keys(SUBJECT_SHORT_LABELS).indexOf(b));
    }, [selectedGrade, selectedBimester, academicSubjects, matrices, unit, selectedShift, students, grades, bimesterKey]);

    const unitLabel = UNIT_LABELS[unit as SchoolUnit] || unit;
    const shiftLabel = SHIFT_LABELS[selectedShift as SchoolShift] || selectedShift;
    const pages: Student[][] = [];
    for (let i = 0; i < sortedStudents.length; i += ROWS_PER_PAGE) pages.push(sortedStudents.slice(i, i + ROWS_PER_PAGE));

    const handlePrint = () => {
        const unitLabel = UNIT_LABELS[unit as SchoolUnit] || unit;
        const shiftLabel = SHIFT_LABELS[selectedShift as SchoolShift] || selectedShift;
        const pages: Student[][] = [];
        for (let i = 0; i < sortedStudents.length; i += ROWS_PER_PAGE) pages.push(sortedStudents.slice(i, i + ROWS_PER_PAGE));

        const pagesHtml = pages.map((pg, pi) => {
            const rows = pg.map((s, idx) => {
                const sg = grades.filter(g => g.studentId === s.id);
                const cells = subjectsToShow.map((id, si) => {
                    const bData = sg.find(g => g.subject === id)?.bimesters?.[bimesterKey];
                    const notaValue = bData?.media;
                    const hasLaunched = bData?.nota !== undefined && bData?.nota !== null;
                    const val = hasLaunched ? (notaValue !== undefined ? notaValue.toFixed(1) : '0.0') : '-';
                    const red = hasLaunched && notaValue !== undefined && notaValue < 7;
                    return `<td style="color:${red?'#dc2626':'#000'};${si===subjectsToShow.length-1?'border-right:none':''};font-weight:700;font-size:8.5pt">${val}</td>`;
                }).join('');
                return `<tr class="${idx%2===0?'row-even':'row-odd'}"><td class="col-code">${s.code}</td><td class="col-name">${s.name.toUpperCase()}</td>${cells}</tr>`;
            }).join('');
            const footer = `<div class="page-footer"><span>MeuExpansivo</span><span style="text-transform:uppercase">Página ${pi + 1} de ${pages.length}</span></div>`;
            return `<div class="page">
                <div class="page-header">
                    <div style="display:flex;align-items:center;gap:12pt">
                        <img src="${SCHOOL_LOGO_URL}" style="width:44pt;height:44pt;object-fit:contain" />
                        <div class="school-info"><strong>EXPANSIVO REDE DE ENSINO</strong><br><span>Unidade: ${unitLabel}</span></div>
                    </div>
                    <div class="page-meta">
                        <div style="font-size:13pt;font-weight:900;text-transform:uppercase;letter-spacing:0.5pt">Relatório de Notas</div>
                        <div style="font-size:8.5pt;font-weight:700;margin-top:3pt">${selectedGrade} &nbsp;|&nbsp; Turma: <b>${selectedClass}</b> &nbsp;|&nbsp; Turno: <b>${shiftLabel}</b> &nbsp;|&nbsp; <b>${selectedBimester}º Bimestre</b></div>
                    </div>
                </div>
                <table><thead><tr><th class="col-code">Cód.</th><th class="col-name">Aluno(a)</th>${subjectsToShow.map((id, idx) => `<th class="subj-th" style="${idx===subjectsToShow.length-1?'border-right:none':''}"><div class="subj-label">${SUBJECT_SHORT_LABELS[id]}</div></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
                ${footer}
            </div>`;
        }).join('');

        const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Relatório de Notas</title><style>
            @page{size:A4 portrait;margin:0}
            html,body{width:210mm;margin:0;padding:0;font-family:Arial,sans-serif;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact}
            .page{width:210mm;height:297mm;padding:10mm 12mm;overflow:hidden;box-sizing:border-box;margin:0;background:white;display:flex;flex-direction:column;position:relative}
            @media print {
                body { width: 210mm }
                .page { width: 210mm; height: 297mm; margin: 0; padding: 10mm 12mm; page-break-after: always !important; break-after: page !important }
                .page:last-child { page-break-after: avoid !important; break-after: avoid !important }
            }
            .page-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:10pt;margin-bottom:10pt;border-bottom:2.5pt solid #000}
            .school-info strong{font-size:13pt;font-weight:900;text-transform:uppercase}
            .school-info span{font-size:8.5pt;color:#444;text-transform:uppercase;letter-spacing:0.5pt}
            .page-meta{text-align:right;text-transform:uppercase}
            table{width:100%;border-collapse:collapse;table-layout:fixed}
            th,td{padding:4pt 4.5pt;border-right:0.5pt solid #999;border-bottom:0.5pt solid #ccc}
            thead tr{background:#eee;border-bottom:1.5pt solid #000}
            .subj-th{width:24pt;padding:0;text-align:center;background:#f5f5f5}
            .subj-label{height:45pt;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;transform:rotate(180deg);font-weight:900;font-size:9pt;text-transform:uppercase}
            .col-code{width:35pt;text-align:center;font-family:monospace;font-size:8.5pt;font-weight:700}
            .col-name{font-weight:700;font-size:9pt;color:#000;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
            .row-even{background:#fff}.row-odd{background:#f9f9f9}
            .page-footer{margin-top:auto;padding-top:10pt;display:flex;justify-content:space-between;align-items:center;font-size:8.5pt;color:#666;font-weight:700;border-top:1pt solid #000}
        </style></head><body>${pagesHtml}</body></html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.opacity = '0';
        iframe.style.zIndex = '-1';
        iframe.style.pointerEvents = 'none';
        iframe.src = url;
        
        document.body.appendChild(iframe);

        iframe.onload = () => {
            setTimeout(() => {
                const win = iframe.contentWindow;
                if (win) {
                    win.focus();
                    win.print();
                }
                setTimeout(() => {
                    document.body.removeChild(iframe);
                    URL.revokeObjectURL(url);
                }, 3000);
            }, 500);
        };
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
        <div id="coordinator-grade-report" ref={containerRef} className="w-full overflow-x-hidden">
            <div className="flex justify-end mb-4">
                <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2.5 bg-blue-950 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg hover:scale-105 active:scale-95 no-print">
                    <Printer className="w-4 h-4" /> Imprimir Relatório (A4)
                </button>
            </div>

            <div className="flex flex-col items-center gap-6 no-print">
                {pages.map((pageStudents, pageIdx) => (
                    <div key={pageIdx} style={{ width: A4_W * scale, height: A4_H * scale, overflow: 'hidden', boxShadow: '0 4px 32px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', background: 'white', flexShrink: 0 }}>
                        <div style={{ width: A4_W, height: A4_H, transform: `scale(${scale})`, transformOrigin: 'top left', padding: '20px 24px 10px 24px', boxSizing: 'border-box', background: 'white', display: 'flex', flexDirection: 'column' }}>
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
                            <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed', fontSize: 9 }}>
                                <thead>
                                    <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #94a3b8' }}>
                                        <th style={{ width: 40, padding: '4px 2px', textAlign: 'center', fontSize: 7.5, fontWeight: 900, textTransform: 'uppercase', color: '#64748b', borderRight: '1px solid #cbd5e1' }}>Cód.</th>
                                        <th style={{ width: 'auto', padding: '4px 6px', textAlign: 'left', fontSize: 8, fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>Aluno(a)</th>
                                        {subjectsToShow.map((id, si) => (
                                            <th key={id} style={{ width: 30, padding: 0, background: '#f8fafc', borderRight: si < subjectsToShow.length - 1 ? '1px solid #cbd5e1' : 'none' }}>
                                                <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span style={{ display: 'inline-block', transform: 'rotate(-90deg)', whiteSpace: 'nowrap', fontSize: 8.5, fontWeight: 900, textTransform: 'uppercase', color: '#1e293b', letterSpacing: '-0.3px' }}>
                                                        {SUBJECT_SHORT_LABELS[id]}
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
                                            <tr key={student.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '3px 2px', textAlign: 'center', fontSize: 7.5, fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace', borderRight: '1px solid #e2e8f0', width: 40 }}>{student.code}</td>
                                                <td style={{ padding: '3px 6px', fontSize: 8, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderRight: '1px solid #e2e8f0', width: 'auto' }}>{student.name.toUpperCase()}</td>
                                                {subjectsToShow.map((id, si) => {
                                                    const bData = sg.find(g => g.subject === id)?.bimesters?.[bimesterKey];
                                                    const notaValue = bData?.media;
                                                    const hasLaunched = bData?.nota !== undefined && bData?.nota !== null;
                                                    const display = hasLaunched ? (notaValue !== undefined ? notaValue.toFixed(1) : '0.0') : '-';
                                                    return (
                                                        <td key={id} style={{ padding: '3px 2px', textAlign: 'center', fontSize: 8.5, fontWeight: 700, color: (hasLaunched && notaValue !== undefined && notaValue < 7) ? '#dc2626' : '#334155', borderRight: si < subjectsToShow.length - 1 ? '1px solid #e2e8f0' : 'none', width: 30 }}>
                                                            {display}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
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
