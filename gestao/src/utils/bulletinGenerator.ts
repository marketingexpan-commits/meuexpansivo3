import { CURRICULUM_MATRIX } from './academicDefaults';
import { getBimesterFromDate, getCurrentSchoolYear, getDynamicBimester, calculateSchoolDays } from './academicUtils';
import type { Student, GradeEntry, AttendanceRecord, AcademicSubject, SchoolUnitDetail, AcademicSettings, CalendarEvent } from '../types';
import { AttendanceStatus } from '../types';
import { calculateGeneralFrequency as calculateUnifiedFrequency } from './frequency';

// Helper to calculate frequency per subject/bimester
const calculateSubjectFrequency = (
    subject: string,
    student: Student,
    attendanceRecords: AttendanceRecord[],
    bimester: number,
    currentYear: number,
    academicSubjects?: AcademicSubject[],
    settings?: AcademicSettings | null,
    calendarEvents?: CalendarEvent[]
): string => {
    // Count absences strictly from logs
    const absences = attendanceRecords.reduce((acc, record) => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        const b = settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date);
        if (rYear === currentYear &&
            record.discipline.trim().toLowerCase() === subject.trim().toLowerCase() &&
            b === bimester &&
            record.studentStatus &&
            record.studentStatus[student.id] === AttendanceStatus.ABSENT) {
            const individualCount = record.studentAbsenceCount?.[student.id];
            return acc + (individualCount !== undefined ? individualCount : (record.lessonCount || 1));
        }
        return acc;
    }, 0);

    // RULE: If 0 absences, return '-' for both absence count and frequency
    if (absences === 0) return '-';

    // 1. Try Dynamic Lookup
    if (academicSubjects && academicSubjects.length > 0) {
        const dynamicSubject = academicSubjects.find(s => s.name === subject);
        if (dynamicSubject && dynamicSubject.weeklyHours) {
            const gradeKey = Object.keys(dynamicSubject.weeklyHours).find(key => student.gradeLevel.includes(key));
            if (gradeKey) {
                const weeklyClasses = dynamicSubject.weeklyHours[gradeKey];
                if (weeklyClasses > 0) {
                    const expectedClasses = weeklyClasses * 10;
                    const frequency = ((expectedClasses - absences) / expectedClasses) * 100;
                    return Math.max(0, Math.min(100, frequency)).toFixed(1) + '%';
                }
            }
        }
    }

    // 2. Fallback to Legacy Matrix
    // Determine level for Matrix (Fixed 10 weeks basis)
    let levelKey = 'Fundamental I';
    if (student.gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (student.gradeLevel.includes('Ensino Médio') || student.gradeLevel.includes('Ens. Médio') || student.gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

    const weeklyClasses = (CURRICULUM_MATRIX[levelKey] || {})[subject] || 0;
    if (weeklyClasses === 0) return '-';

    const expectedClasses = (() => {
        if (settings && calendarEvents) {
            const bim = settings.bimesters.find(b => b.number === bimester);
            if (bim) {
                const days = calculateSchoolDays(bim.startDate, bim.endDate, calendarEvents);
                return (weeklyClasses / 5) * days;
            }
        }
        return weeklyClasses * 10;
    })();

    const frequency = ((expectedClasses - absences) / expectedClasses) * 100;
    return Math.max(0, Math.min(100, frequency)).toFixed(1) + '%';
};

const generateBulletinHtml = (
    student: Student,
    currentGrades: GradeEntry[],
    attendanceRecords: AttendanceRecord[],
    unitDetail: SchoolUnitDetail,
    pageBreak: boolean = false,
    academicSubjects?: AcademicSubject[],
    settings?: AcademicSettings | null,
    calendarEvents?: CalendarEvent[]
) => {
    const unitInfo = unitDetail;
    const currentDate = new Date().toLocaleDateString('pt-BR');
    const currentYear = getCurrentSchoolYear();
    const today = new Date().toLocaleDateString('en-CA');
    const calendarBim = settings ? getDynamicBimester(today, settings) : getBimesterFromDate(today);

    // Dynamic detection of elapsed bimesters
    const maxDataBim = (attendanceRecords || []).reduce((max, record) => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        if (rYear !== currentYear) return max;
        if (!record.studentStatus || !record.studentStatus[student.id]) return max;
        const b = settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date);
        return b > max ? b : max;
    }, 1);
    const elapsedBimesters = Math.max(calendarBim, maxDataBim);

    // Helper to format grade
    const fG = (n: number | null | undefined) => {
        if (n === null || n === undefined || n === -1) return '-';
        return n.toFixed(1);
    };

    const calculateGeneralFrequency = () => {
        return calculateUnifiedFrequency(
            currentGrades,
            attendanceRecords,
            student.id,
            student.gradeLevel,
            academicSubjects,
            settings,
            calendarEvents
        );
    };

    const renderCurrentGradesRows = () => {
        if (!currentGrades || currentGrades.length === 0) {
            return `<tr><td colspan="25" style="text-align: center; font-style: italic; color: #666; padding: 20px;">Nenhuma nota lançada no sistema para o ano vigente.</td></tr>`;
        }

        return currentGrades.map(g => {
            let levelKey = 'Fundamental I';
            if (student.gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
            else if (student.gradeLevel.includes('Ensino Médio') || student.gradeLevel.includes('Ens. Médio') || student.gradeLevel.includes('Médio') || student.gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

            const currentYear = getCurrentSchoolYear();

            const getBimesterAbsences = (bim: number) => {
                const bAbsences = attendanceRecords.reduce((acc, record) => {
                    const rYear = parseInt(record.date.split('-')[0], 10);
                    if (rYear === currentYear &&
                        record.discipline.trim().toLowerCase() === g.subject.trim().toLowerCase() &&
                        (settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date)) === bim &&
                        record.studentStatus &&
                        record.studentStatus[g.studentId] === AttendanceStatus.ABSENT) {
                        const individualCount = record.studentAbsenceCount?.[g.studentId];
                        return acc + (individualCount !== undefined ? individualCount : (record.lessonCount || 1));
                    }
                    return acc;
                }, 0);

                return bAbsences;
            };

            const absencesB1 = getBimesterAbsences(1);
            const absencesB2 = getBimesterAbsences(2);
            const absencesB3 = getBimesterAbsences(3);
            const absencesB4 = getBimesterAbsences(4);

            let weeklyClasses = 0;
            let foundDynamic = false;

            if (academicSubjects && academicSubjects.length > 0) {
                const dynamicSubject = academicSubjects.find(s => s.name === g.subject);
                if (dynamicSubject && dynamicSubject.weeklyHours) {
                    const gradeKey = Object.keys(dynamicSubject.weeklyHours).find(key => student.gradeLevel.includes(key));
                    if (gradeKey) {
                        weeklyClasses = dynamicSubject.weeklyHours[gradeKey];
                        foundDynamic = true;
                    }
                }
            }

            if (!foundDynamic) {
                weeklyClasses = (CURRICULUM_MATRIX[levelKey] || {})[g.subject] || 0;
            }

            const totalExpectedSubject = weeklyClasses * 10 * elapsedBimesters;
            const totalAbsencesSubject = ([
                absencesB1, absencesB2, absencesB3, absencesB4
            ].slice(0, elapsedBimesters) as (number | null)[]).reduce((sum: number, abs: number | null) => sum + (abs || 0), 0);

            const totalFrequency = (totalExpectedSubject > 0)
                ? (((totalExpectedSubject - totalAbsencesSubject) / totalExpectedSubject) * 100).toFixed(1) + '%'
                : '-';

            const totalCH = weeklyClasses > 0 ? (weeklyClasses * 40) : '-';

            const bfreq1 = calculateSubjectFrequency(g.subject, student, attendanceRecords, 1, currentYear, academicSubjects, settings);
            const bfreq2 = calculateSubjectFrequency(g.subject, student, attendanceRecords, 2, currentYear, academicSubjects, settings);
            const bfreq3 = calculateSubjectFrequency(g.subject, student, attendanceRecords, 3, currentYear, academicSubjects, settings);
            const bfreq4 = calculateSubjectFrequency(g.subject, student, attendanceRecords, 4, currentYear, academicSubjects, settings);

            return `
            <tr>
                <td class="subject-col">
                    <strong>${g.subject}</strong>
                </td>
                <td>${totalCH}${totalCH !== '-' ? 'h' : ''}</td>
                
                <!-- 1B -->
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester1.nota)}</td>
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester1.recuperacao)}</td>
                <td style="background: #fdfdfd; width: 25px;">${fG(g.bimesters.bimester1.media)}</td>
                <td style="color: #666; width: 25px;">${absencesB1}</td>
                <td style="font-size: 9px; font-weight: bold; width: 35px;">${bfreq1}</td>
                
                <!-- 2B -->
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester2.nota)}</td>
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester2.recuperacao)}</td>
                <td style="background: #fdfdfd; width: 25px;">${fG(g.bimesters.bimester2.media)}</td>
                <td style="color: #666; width: 25px;">${absencesB2}</td>
                <td style="font-size: 9px; font-weight: bold; width: 35px;">${bfreq2}</td>

                <!-- 3B -->
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester3.nota)}</td>
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester3.recuperacao)}</td>
                <td style="background: #fdfdfd; width: 25px;">${fG(g.bimesters.bimester3.media)}</td>
                <td style="color: #666; width: 25px;">${absencesB3}</td>
                <td style="font-size: 9px; font-weight: bold; width: 35px;">${bfreq3}</td>

                <!-- 4B -->
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester4.nota)}</td>
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester4.recuperacao)}</td>
                <td style="background: #fdfdfd; width: 25px;">${fG(g.bimesters.bimester4.media)}</td>
                <td style="color: #666; width: 25px;">${absencesB4}</td>
                <td style="font-size: 9px; font-weight: bold; width: 35px;">${bfreq4}</td>

                <td style="background: #f0f4f8; font-weight: bold;">${totalFrequency}</td>
                <td style="background: #fdfdfd; font-weight: bold; font-size: 9px; color: #1e3a8a;">${fG(g.mediaAnual)}</td>
                <td style="background: #fdfdfd; font-weight: bold; font-size: 9px; color: #b91c1c;">${fG(g.recuperacaoFinal)}</td>
                <td style="font-weight: bold; background: #f5f5f5; color: #1e3a8a;">${fG(g.mediaFinal)}</td>
                <td style="font-weight: bold; font-size: 9px;">${(g.mediaFinal === 0 || g.mediaFinal === null) && g.situacaoFinal === 'Recuperação' ? 'Cursando' : (g.situacaoFinal || 'Cursando')}</td>
            </tr>
            `;
        }).join('');
    };

    return `
            <div class="page" style="${pageBreak ? 'page-break-after: always;' : ''}">
                <div class="header" style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a426f; padding-bottom: 10px; margin-bottom: 15px;">
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <img src="${unitDetail.logoUrl || 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png'}" alt="Logo" class="logo" style="max-height: 60px; filter: grayscale(100%);">
                        <div class="school-info" style="text-align: left;">
                            <h2 style="margin:0; font-size: 16px; font-weight: 900; color: #1a426f; letter-spacing: -0.5px;">EXPANSIVO REDE DE ENSINO</h2>
                            ${unitInfo.professionalTitle ? `<p style="margin:0; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase;">${unitInfo.professionalTitle}</p>` : ''}
                            <p style="margin:2px 0; font-weight: bold; text-transform: uppercase; color: #1e293b; font-size: 11px;">UNIDADE: ${unitInfo.fullName.replace('Expansivo - ', '').toUpperCase()}</p>
                            <p style="margin:2px 0; font-size: 9px; color: #334155; line-height: 1.2;">
                                ${unitInfo.address}${unitInfo.district ? ` - ${unitInfo.district}` : ''}, ${unitInfo.city || ''} - ${unitInfo.uf || ''}${unitInfo.cep ? ` - CEP: ${unitInfo.cep}` : ''}<br>
                                CNPJ: ${unitInfo.cnpj} | Tel: ${unitInfo.phone}${unitInfo.whatsapp ? ` | WhatsApp: ${unitInfo.whatsapp}` : ''}${unitInfo.email ? ` | E-mail: ${unitInfo.email}` : ''}
                            </p>
                            ${unitInfo.authorization ? `<p style="margin:2px 0; font-size: 8px; font-style: italic; color: #64748b;">${unitInfo.authorization}</p>` : ''}
                        </div>
                    </div>
                    <div style="text-align: right; color: #1a426f;">
                        <h2 style="margin: 0; font-size: 16px; font-weight: 900; text-transform: uppercase;">Boletim Escolar ${currentYear}.1</h2>
                        <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: bold;">Emissão: ${currentDate}</p>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Dados de Identificação</div>
                    <div class="info-grid">
                        <div class="info-item"><span class="label">Aluno:</span> ${student.name}</div>
                        <div class="info-item"><span class="label">Matrícula:</span> ${student.code}</div>
                        <div class="info-item"><span class="label">Série / Turma:</span> ${student.gradeLevel} - ${student.schoolClass}</div>
                        <div class="info-item"><span class="label">Turno:</span> ${student.shift}</div>
                        <div class="info-item"><span class="label">Data de Nascimento:</span> ${student.data_nascimento ? new Date(student.data_nascimento).toLocaleDateString('pt-BR') : '-'}</div>
                        <div class="info-item"><span class="label">Responsável:</span> ${student.nome_responsavel || student.nome_mae || student.nome_pai || '-'}</div>
                    </div>
                </div>

                <div class="section" style="page-break-inside: auto;">
                    <div class="section-title">Componentes Curriculares e Rendimento (Ano Letivo: ${new Date().getFullYear()})</div>
                    <table class="grades-table">
                        <thead>
                            <tr>
                                <th rowspan="2" class="subject-col">Disciplina</th>
                                <th rowspan="2" style="width: 25px;">CH</th>
                                <th colspan="5">1º Bimestre</th>
                                <th colspan="5">2º Bimestre</th>
                                <th colspan="5">3º Bimestre</th>
                                <th colspan="5">4º Bimestre</th>
                                <th rowspan="2" style="width: 35px; background: #eef2f6;">Freq. Final</th>
                                <th rowspan="2" style="width: 25px;" title="Média Anual">MA</th>
                                <th rowspan="2" style="width: 25px;" title="Prova Final">PF</th>
                                <th rowspan="2" style="width: 35px;" title="Média Final">MF</th>
                                <th rowspan="2" style="width: 60px;">Resultado</th>
                            </tr>
                            <tr>
                                <th title="Nota" style="width: 25px;">N</th><th title="Recuperação" style="width: 25px;">R</th><th title="Média" style="width: 25px;">M</th><th title="Faltas" style="width: 25px;">F</th><th title="Frequência" style="width: 35px;">%</th>
                                <th title="Nota" style="width: 25px;">N</th><th title="Recuperação" style="width: 25px;">R</th><th title="Média" style="width: 25px;">M</th><th title="Faltas" style="width: 25px;">F</th><th title="Frequência" style="width: 35px;">%</th>
                                <th title="Nota" style="width: 25px;">N</th><th title="Recuperação" style="width: 25px;">R</th><th title="Média" style="width: 25px;">M</th><th title="Faltas" style="width: 25px;">F</th><th title="Frequência" style="width: 35px;">%</th>
                                <th title="Nota" style="width: 25px;">N</th><th title="Recuperação" style="width: 25px;">R</th><th title="Média" style="width: 25px;">M</th><th title="Faltas" style="width: 25px;">F</th><th title="Frequência" style="width: 35px;">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderCurrentGradesRows()}
                            <tr style="background: #f8f9fa; font-weight: bold;">
                                <td colspan="26" style="text-align: right; padding-right: 15px;">FREQUÊNCIA GERAL NO ANO LETIVO:</td>
                                <td colspan="1" style="text-align: center; font-size: 11px; color: #1a426f;">${calculateGeneralFrequency()}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p style="font-size: 8px; margin-top: 5px; font-style: italic;">
                        Legenda: CH: Carga Horária Anual | N: Nota Bim. | R: Recup. Bim. | M: Média Bim. | F: Faltas | %: Frequência Mensal | MA: Média Anual | PF: Prova Final | MF: Média Final.<br />
                        * O boletim reflete o desempenho parcial até o momento da emissão.
                    </p>
                </div>

                <div class="section">
                    <div class="section-title">Observações</div>
                    <p style="white-space: pre-wrap; font-size: 10px;">${student.observacoes_gerais || 'Nada consta.'}</p>
                </div>

                <div class="footer">
                    <p>Natal / RN, ${currentDate}</p>
                    <div class="signatures">
                        <div class="sig-line">
                            ${unitDetail.directorName || 'Direção'}
                            <div style="font-size: 8px; font-weight: normal;">Direção</div>
                        </div>
                        <div class="sig-line">
                            ${unitDetail.secretaryName || 'Secretaria'}
                            <div style="font-size: 8px; font-weight: normal;">Secretária Escolar</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
};

const getBulletinStyle = () => `
    @page { size: A4 landscape; margin: 10mm; }
    
    body {
        background-color: #525659;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-height: 100vh;
        font-family: 'Times New Roman', Times, serif;
        color: #000;
    }

    .page {
        background-color: white;
        width: 297mm;
        min-height: 210mm;
        padding: 15mm;
        margin: 20px auto;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        box-sizing: border-box;
        position: relative;
    }

    /* Typography adjustments */
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 20px; }
    .logo { max-height: 70px; }
    .school-info { text-align: left; }
    .title { font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 10px 0; text-align: center; }
    
    .section { margin-bottom: 20px; }
    .section-title { font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 8px; text-transform: uppercase; font-size: 11px; background-color: #eee; padding: 4px; }
    
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 11px; }
    .info-item { margin-bottom: 2px; }
    .label { font-weight: bold; margin-right: 5px; }

    /* Table adjustments for Landscape */
    .grades-table { border-collapse: collapse; width: 100%; margin-top: 5px; font-size: 10px; }
    .grades-table th, .grades-table td { border: 1px solid #000; padding: 3px 1px; text-align: center; }
    .grades-table th { background-color: #f2f2f2; font-weight: bold; font-size: 9px; }
    .subject-col { text-align: left!important; padding-left: 5px!important; width: 140px; }

    .footer { margin-top: 40px; text-align: center; font-size: 11px; }
    .signatures { display: flex; justify-content: space-around; margin-top: 60px; }
    .sig-line { border-top: 1px solid #000; width: 40%; padding-top: 5px; font-weight: bold; text-transform: uppercase; font-size: 10px; }

    @media print {
        body { background: none; display: block; }
        .page { width: 100%; margin: 0; box-shadow: none; padding: 0; min-height: auto; page-break-after: always; }
        .page:last-child { page-break-after: auto; }
        .no-print { display: none; }
    }
`;

export const generateSchoolBulletin = (
    student: Student,
    currentGrades: GradeEntry[] = [],
    attendanceRecords: AttendanceRecord[] = [],
    unitDetail: SchoolUnitDetail,
    academicSubjects?: AcademicSubject[],
    settings?: AcademicSettings | null,
    calendarEvents?: CalendarEvent[]
) => {
    generateBatchSchoolBulletin([{ student, grades: currentGrades, attendance: attendanceRecords }], unitDetail, academicSubjects, settings, calendarEvents);
};

export const generateBatchSchoolBulletin = (
    data: { student: Student, grades: GradeEntry[], attendance: AttendanceRecord[] }[],
    unitDetail: SchoolUnitDetail,
    academicSubjects?: AcademicSubject[],
    settings?: AcademicSettings | null,
    calendarEvents?: CalendarEvent[]
) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up bloqueado! Por favor permita pop-ups para gerar o documento.");
        return;
    }

    const pagesHtml = data.map((item, index) =>
        generateBulletinHtml(item.student, item.grades, item.attendance, unitDetail, index < data.length - 1, academicSubjects, settings, calendarEvents)
    ).join('');

    const content = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Boletim Escolar</title>
            <style>
                ${getBulletinStyle()}
            </style>
        </head>
        <body>
            ${pagesHtml}
            <script>
                window.onload = function() { setTimeout(() => { window.print(); }, 1000); }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
};
