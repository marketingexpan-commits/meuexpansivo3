import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Student, GradeEntry, AcademicSubject, CurriculumMatrix, AttendanceRecord, AttendanceStatus, SUBJECT_SHORT_LABELS, UNIT_LABELS, SchoolUnit, SchoolShift, SHIFT_LABELS } from '../types';
import { SCHOOL_LOGO_URL } from '../constants';
import { getSubjectShortLabel } from '../utils/subjectUtils';
import { calculateGeneralFrequency } from '../utils/frequency';
import { getDynamicBimester } from '../utils/academicUtils';
import { Printer, FileSpreadsheet } from 'lucide-react';

const A4_W = 794;
const A4_H = 1123;
const ROWS_PER_PAGE = 40;
const MIN_FREQUENCY = 75;

interface CoordinatorAbsenceReportProps {
    students: Student[];
    grades: GradeEntry[];
    attendanceRecords: AttendanceRecord[];
    selectedBimester: number;
    selectedGrade: string;
    selectedClass: string;
    selectedShift: string;
    unit: string;
    academicSubjects?: AcademicSubject[];
    matrices?: CurriculumMatrix[];
    academicSettings?: any;
    calendarEvents?: any[];
    classSchedules?: any[];
    year: number;
}

interface StudentAbsenceRow {
    student: Student;
    perSubject: Record<string, number>;
    bimesterTotal: number;
    yearTotal: number;
    frequencyLabel: string;
    isLow: boolean;
}

const REPORT_CSS = `
    .abs-page { width: 794px; height: 1123px; padding: 20px 24px 10px 24px; box-sizing: border-box; background: white; display: flex; flex-direction: column; font-family: Arial, sans-serif; }
    .abs-page .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2.5px solid #111; }
    .abs-page .school-info strong { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #111; letter-spacing: -0.5px; display: block; }
    .abs-page .school-info span { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; display: block; margin-top: 2px; }
    .abs-page .page-meta { text-align: right; }
    .abs-page table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; border: 1px solid #000; }
    .abs-page thead tr { background: #f1f5f9; border-bottom: 1px solid #000; }
    .abs-page .th-code { width: 40px; padding: 4px 2px; text-align: center; font-size: 7.5px; font-weight: 900; text-transform: uppercase; color: #64748b; border-right: 1px solid #000; }
    .abs-page .th-name { width: auto; padding: 4px 6px; text-align: left; font-size: 8px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-right: 1px solid #000; }
    .abs-page .subj-th { width: 28px; padding: 0; background: #f8fafc; border-right: 1px solid #000; }
    .abs-page .subj-label { height: 48px; display: flex; align-items: center; justify-content: center; }
    .abs-page .subj-label span { display: inline-block; transform: rotate(-90deg); white-space: nowrap; font-size: 8.5px; font-weight: 900; text-transform: uppercase; color: #1e293b; letter-spacing: -0.3px; }
    .abs-page .sum-th { width: 38px; padding: 2px; background: #e2e8f0; border-right: 1px solid #000; text-align: center; font-size: 7px; font-weight: 900; text-transform: uppercase; color: #0f172a; line-height: 1.15; }
    .abs-page tbody tr { border-bottom: 1px solid #000; }
    .abs-page .row-even { background: #fff; }
    .abs-page .row-odd { background: #f8fafc; }
    .abs-page .col-code { padding: 3px 2px; text-align: center; font-size: 7.5px; font-weight: 700; color: #94a3b8; font-family: monospace; border-right: 1px solid #000; }
    .abs-page .col-name { padding: 3px 6px; font-size: 8px; font-weight: 700; color: #0f172a; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-right: 1px solid #000; }
    .abs-page .td-subj { padding: 3px 2px; text-align: center; font-size: 8.5px; font-weight: 700; color: #334155; border-right: 1px solid #000; }
    .abs-page .td-zero { color: #cbd5e1; font-weight: 400; }
    .abs-page .td-sum { padding: 3px 2px; text-align: center; font-size: 8.5px; font-weight: 900; color: #0f172a; background: #f1f5f9; border-right: 1px solid #000; }
    .abs-page .td-sum:last-child { border-right: none; }
    .abs-page .td-low { color: #c2410c; background: #ffedd5; }
    .abs-page .page-footer { margin-top: auto; padding-top: 8px; border-top: 0.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; }
    .abs-page .legend { font-size: 7.5px; font-weight: 700; color: #64748b; margin-top: 6px; }
`;

export const CoordinatorAbsenceReport: React.FC<CoordinatorAbsenceReportProps> = ({
    students, grades, attendanceRecords, selectedBimester, selectedGrade, selectedClass, selectedShift,
    unit, academicSubjects, matrices, academicSettings, calendarEvents = [], classSchedules = [], year
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
    }, [students]);

    const isEarlyChildhood = ['Berçário', 'Nível I', 'Nível II', 'Nível III', 'Nível IV', 'Nível V'].includes(selectedGrade);
    const unitLabel = UNIT_LABELS[unit as SchoolUnit] || unit;
    const shiftLabel = SHIFT_LABELS[selectedShift as SchoolShift] || selectedShift;

    const sortedStudents = useMemo(() => [...students].sort((a, b) => a.name.localeCompare(b.name)), [students]);

    // Disciplinas exibidas: as que aparecem nas notas ou nos registros de frequência da turma
    const subjectsToShow = useMemo(() => {
        if (students.length === 0) return [] as string[];
        const studentIds = new Set(students.map(s => s.id));
        const subjectSet = new Set<string>();
        grades.forEach(g => {
            if (g.subject && g.subject !== 'general_early_childhood' && g.subject !== 'general_activity') subjectSet.add(g.subject);
        });
        attendanceRecords.forEach(att => {
            if (!att.discipline || !att.studentStatus) return;
            if (Object.keys(att.studentStatus).some(id => studentIds.has(id))) subjectSet.add(att.discipline);
        });

        let subjects = Array.from(subjectSet);
        if (selectedGrade.includes('9º Ano')) subjects = subjects.filter(id => id !== 'disc_sociologia');

        return subjects.sort((a, b) => {
            const sA = academicSubjects?.find(s => s.id === a);
            const sB = academicSubjects?.find(s => s.id === b);
            if (sA?.order !== undefined && sB?.order !== undefined) return sA.order - sB.order;
            const indexA = Object.keys(SUBJECT_SHORT_LABELS).indexOf(a);
            const indexB = Object.keys(SUBJECT_SHORT_LABELS).indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [students, grades, attendanceRecords, selectedGrade, academicSubjects]);

    // Contagem de faltas: segue exatamente a contagem real lançada (mesmo critério do Registro de Frequência do Aluno)
    const rows: StudentAbsenceRow[] = useMemo(() => {
        const yearPrefix = String(year);
        return sortedStudents.map(student => {
            const studentAttendance = attendanceRecords.filter(att =>
                att.studentStatus &&
                att.studentStatus[student.id] === AttendanceStatus.ABSENT &&
                typeof att.date === 'string' && att.date.startsWith(yearPrefix)
            );

            const perSubject: Record<string, number> = {};
            const perSubjectYear: Record<string, number> = {};

            studentAttendance.forEach(att => {
                const bNum = getDynamicBimester(att.date, academicSettings);
                const individualCount = att.studentAbsenceCount?.[student.id];
                const count = individualCount !== undefined ? individualCount : (att.lessonCount || 1);

                perSubjectYear[att.discipline] = (perSubjectYear[att.discipline] || 0) + count;
                if (bNum === selectedBimester) {
                    perSubject[att.discipline] = (perSubject[att.discipline] || 0) + count;
                }
            });

            // Totais exatos de faltas reais do bimestre e do ano letivo
            const bimesterTotal = subjectsToShow.reduce((sum, id) => sum + (perSubject[id] || 0), 0);
            const yearTotal = subjectsToShow.reduce((sum, id) => sum + (perSubjectYear[id] || 0), 0);

            const allStudentRecords = attendanceRecords.filter(att => att.studentStatus && att.studentStatus[student.id]);
            const frequencyLabel = calculateGeneralFrequency(
                [], allStudentRecords, student.id, student.gradeLevel || '', academicSubjects, academicSettings,
                calendarEvents, student.unit, classSchedules, student.schoolClass, student.shift, matrices
            );
            const freqNumber = parseFloat(frequencyLabel);
            const isLow = !isNaN(freqNumber) && freqNumber < MIN_FREQUENCY;

            return { student, perSubject, bimesterTotal, yearTotal, frequencyLabel, isLow };
        });
    }, [sortedStudents, subjectsToShow, attendanceRecords, selectedBimester, academicSettings, calendarEvents, classSchedules, academicSubjects, matrices, year]);

    const pages: StudentAbsenceRow[][] = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) pages.push(rows.slice(i, i + ROWS_PER_PAGE));

    const fmt = (n: number) => String(Math.round(n));

    const buildPageHtml = (pageRows: StudentAbsenceRow[], pageIdx: number) => {
        const body = pageRows.map((r, idx) => {
            const cells = subjectsToShow.map(id => {
                const v = Math.round(r.perSubject[id] || 0);
                return `<td class="td-subj ${v === 0 ? 'td-zero' : ''}">${v === 0 ? '-' : v}</td>`;
            }).join('');
            return `<tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
                <td class="col-code">${r.student.code ?? ''}</td>
                <td class="col-name">${r.student.name.toUpperCase()}</td>
                ${cells}
                <td class="td-sum">${fmt(r.bimesterTotal)}</td>
                <td class="td-sum">${fmt(r.yearTotal)}</td>
                <td class="td-sum ${r.isLow ? 'td-low' : ''}">${r.frequencyLabel === '-' ? '-' : r.frequencyLabel.replace('.00', '').replace(/(\.\d)0%/, '$1%')}</td>
            </tr>`;
        }).join('');

        const heads = subjectsToShow.map(id =>
            `<th class="subj-th"><div class="subj-label"><span>${getSubjectShortLabel(id, academicSubjects)}</span></div></th>`
        ).join('');

        return `<div class="abs-page">
            <div class="page-header">
                <div style="display:flex;align-items:center;gap:12px">
                    <img src="${SCHOOL_LOGO_URL}" style="width:44px;height:44px;object-fit:contain" crossorigin="anonymous" />
                    <div class="school-info"><strong>EXPANSIVO REDE DE ENSINO</strong><span>Unidade: ${unitLabel}</span></div>
                </div>
                <div class="page-meta">
                    <div style="font-size:13px;font-weight:900;color:#111;letter-spacing:-0.3px;text-transform:uppercase">Relatório de Faltas</div>
                    <div style="font-size:8px;font-weight:700;color:#334155;margin-top:3px;text-transform:uppercase"><b>${selectedGrade}</b> &nbsp;|&nbsp; <span style="color:#94a3b8">Turma:</span> <b>${selectedClass}</b> &nbsp;|&nbsp; <span style="color:#94a3b8">Turno:</span> <b>${shiftLabel}</b> &nbsp;|&nbsp; <b>${selectedBimester}º Bimestre</b></div>
                </div>
            </div>
            <table>
                <thead><tr>
                    <th class="th-code">Cód.</th><th class="th-name">Aluno(a)</th>${heads}
                    <th class="sum-th">Faltas<br/>${selectedBimester}º Bim</th><th class="sum-th">Faltas<br/>Ano</th><th class="sum-th" style="border-right:none">Freq.<br/>Anual</th>
                </tr></thead>
                <tbody>${body}</tbody>
            </table>
            <div class="legend">Faltas por disciplina referentes ao ${selectedBimester}º bimestre. Frequência anual em laranja quando abaixo de ${MIN_FREQUENCY}% (faltas abonadas não são descontadas).</div>
            <div class="page-footer"><span>MeuExpansivo</span><span style="text-transform:uppercase">Página ${pageIdx + 1} de ${pages.length}</span></div>
        </div>`;
    };

    const handlePrint = () => {
        const pagesHtml = pages.map((pg, pi) => buildPageHtml(pg, pi)).join('');
        const isMobile = window.innerWidth < 768;
        const printCss = `
            ${REPORT_CSS}
            @page { size: A4 portrait; margin: 0; }
            .abs-page { height: auto; min-height: 1123px; page-break-after: always; break-after: page; }
            .abs-page:last-child { page-break-after: avoid; break-after: avoid; }
        `;

        if (isMobile) {
            const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Relatório de Faltas — ${selectedGrade} ${selectedClass} ${selectedBimester}º Bim</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .screen-toolbar { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 16px; background: #1e3a8a; position: sticky; top: 0; z-index: 10; }
                    .btn-close { background: white; color: #1e3a8a; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
                    .btn-print { background: #f97316; color: white; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
                    ${printCss}
                    .abs-page { margin: 16px auto; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
                    @media print { body { background: white; } .screen-toolbar { display: none !important; } .abs-page { margin: 0; box-shadow: none; } }
                </style></head><body>
                <div class="screen-toolbar"><button class="btn-close" onclick="window.close()">✕ Fechar</button><button class="btn-print" onclick="window.print()">🖨 Imprimir</button></div>
                ${pagesHtml}</body></html>`;
            const w = window.open('', '_blank');
            if (w) { w.document.open(); w.document.write(html); w.document.close(); }
            return;
        }

        const styleId = 'temp-abs-print-style';
        const containerId = 'temp-abs-print-container';
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

    if (isEarlyChildhood) {
        return (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 border-dashed mx-auto shadow-sm max-w-xl">
                <h3 className="text-lg font-medium text-gray-900">Relatório indisponível para Educação Infantil</h3>
                <p className="text-gray-500 mt-1">O relatório de faltas por disciplina se aplica às séries com disciplinas e bimestres.</p>
            </div>
        );
    }

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
        <div ref={wrapperRef} id="coordinator-absence-report" className="w-full max-w-full overflow-hidden pb-10">
            <style>{REPORT_CSS}</style>
            <div className="flex justify-center sm:justify-end mb-6 w-full px-2 no-print">
                <button
                    onClick={handlePrint}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-blue-950 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg hover:scale-105 active:scale-95"
                >
                    <Printer className="w-4 h-4" /> Imprimir Relatório (A4)
                </button>
            </div>

            <div className="flex flex-col items-center gap-8 w-full">
                {pages.map((pageRows, pageIdx) => (
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
                            dangerouslySetInnerHTML={{ __html: buildPageHtml(pageRows, pageIdx) }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
