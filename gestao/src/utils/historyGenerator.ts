import { CURRICULUM_MATRIX } from './academicDefaults';
import { getBimesterFromDate, getCurrentSchoolYear, getDynamicBimester, calculateSchoolDays, calculateEffectiveTaughtClasses, isClassScheduled } from './academicUtils';
import type { Student, AcademicHistoryRecord, GradeEntry, AttendanceRecord, AcademicSubject, SchoolUnitDetail, AcademicSettings, CalendarEvent } from '../types';
import { AttendanceStatus } from '../types';
import { calculateGeneralFrequency as calculateUnifiedFrequency, calculateAttendancePercentage, calculateAnnualAttendancePercentage } from './frequency';

// Helper to calculate frequency per subject/bimester
const calculateSubjectFrequency = (
    student: Student,
    gradeEntry: GradeEntry,
    subject: string,
    bimesterIndex: number, // 1 to 4,
    attendanceRecords: AttendanceRecord[] = [],
    academicSubjects?: AcademicSubject[],
    settings?: AcademicSettings | null,
    calendarEvents?: CalendarEvent[],
    classSchedules?: any[],
    schoolClass?: string
) => {
    const currentYear = getCurrentSchoolYear();

    const absences = attendanceRecords.reduce((acc, record) => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        if (rYear === currentYear &&
            record.discipline.trim().toLowerCase() === subject.trim().toLowerCase() &&
            (settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date)) === bimesterIndex &&
            record.studentStatus &&
            record.studentStatus[gradeEntry.studentId] === AttendanceStatus.ABSENT) {

            if (classSchedules && classSchedules.length > 0 && student.unit) {
                if (!isClassScheduled(record.date, subject, classSchedules, calendarEvents || [], student.unit, student.gradeLevel, schoolClass)) return acc;
            }

            const individualCount = record.studentAbsenceCount?.[gradeEntry.studentId];
            return acc + (individualCount !== undefined ? individualCount : (record.lessonCount || 1));
        }
        return acc;
    }, 0);

    const result = calculateAttendancePercentage(
        subject,
        absences,
        student.gradeLevel,
        bimesterIndex,
        academicSubjects,
        settings,
        calendarEvents,
        student.unit,
        classSchedules,
        schoolClass
    );

    if (!result) return '-';
    // Format: "100%" or "95.5%"
    const str = result.percent + '%';
    // If we want to show estimation warning, we could, but PDF usually simple.
    // For now stick to simple string. 
    return str;
};

export const generateSchoolHistory = (
    student: Student,
    historyRecords: AcademicHistoryRecord[] = [],
    currentGrades: GradeEntry[] = [],
    attendanceRecords: AttendanceRecord[] = [],
    unitDetail: SchoolUnitDetail,
    academicSubjects?: AcademicSubject[],
    settings?: AcademicSettings | null,
    calendarEvents?: CalendarEvent[],
    classSchedules?: any[]
) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up bloqueado! Por favor permita pop-ups para gerar o documento.");
        return;
    }

    const unitInfo = unitDetail;
    const currentDate = new Date().toLocaleDateString('pt-BR');
    const today = new Date().toLocaleDateString('en-CA');
    const calendarBim = settings ? getDynamicBimester(today, settings) : getBimesterFromDate(today);
    const currentYear = getCurrentSchoolYear();

    const maxDataBim = (attendanceRecords || []).reduce((max, record) => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        if (rYear !== currentYear) return max;
        if (!record.studentStatus || !record.studentStatus[student.id]) return max;
        const b = settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date);
        return b > max ? b : max;
    }, 1);
    const elapsedBimesters = Math.max(calendarBim, maxDataBim);

    const fG = (n: number | null | undefined) => {
        if (n === null || n === undefined) return '-';
        if (n < 0) return '-';
        return n.toFixed(1);
    };

    const renderHistoryContent = () => {
        if (!historyRecords || historyRecords.length === 0) return '';
        const hasDetailedRecords = historyRecords.some(r => r.subjects && r.subjects.length > 0);

        if (!hasDetailedRecords) {
            return `
            <div class="section">
                <div class="section-title">Histórico Acadêmico Pregresso</div>
                <table class="grades-table" style="margin-top: 10px;">
                    <thead>
                        <tr>
                            <th style="width: 60px;">Ano</th>
                            <th style="text-align: left; padding-left: 10px;">Série/Ano</th>
                            <th style="text-align: left; padding-left: 10px;">Estabelecimento de Ensino</th>
                            <th>Município/UF</th>
                            <th>Resultado</th>
                            <th>CH</th>
                            <th>Média</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${historyRecords.map(record => `
                            <tr>
                                <td>${record.year}</td>
                                <td style="text-align: left; padding-left: 10px;">${record.gradeLevel}</td>
                                <td style="text-align: left; padding-left: 10px;">${record.schoolName}</td>
                                <td>${record.cityState}</td>
                                <td>${record.status}</td>
                                <td>${record.totalHours || '-'}</td>
                                <td>${record.average || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            `;
        }

        return historyRecords.map(record => `
            <div class="section" style="page-break-inside: avoid;">
                <div class="section-title">
                    ${record.gradeLevel} (${record.year}) - ${record.schoolName}
                    <span style="float: right; font-weight: normal; font-size: 11px; text-transform: none;">
                         ${record.cityState} | Situação: <strong>${record.status}</strong> 
                         ${record.totalHours ? `| CH Total: ${record.totalHours}` : ''}
                    </span>
                </div>
                ${record.subjects && record.subjects.length > 0 ? `
                    <table class="grades-table" style="margin-top: 5px;">
                        <thead>
                            <tr>
                                <th rowspan="2" class="subject-col">Componente Curricular</th>
                                <th rowspan="2" style="width: 35px;">CH</th>
                                <th colspan="3">1º Bimestre</th>
                                <th colspan="3">2º Bimestre</th>
                                <th colspan="3">3º Bimestre</th>
                                <th colspan="3">4º Bimestre</th>
                                <th rowspan="2" style="width: 45px;">Média</th>
                                <th rowspan="2" style="width: 70px;">Resultado</th>
                            </tr>
                            <tr>
                                <th style="width: 25px;">M</th><th style="width: 25px;">F</th><th style="width: 35px;">%</th>
                                <th style="width: 25px;">M</th><th style="width: 25px;">F</th><th style="width: 35px;">%</th>
                                <th style="width: 25px;">M</th><th style="width: 25px;">F</th><th style="width: 35px;">%</th>
                                <th style="width: 25px;">M</th><th style="width: 25px;">F</th><th style="width: 35px;">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${record.subjects.map(sub => `
                                <tr>
                                    <td class="subject-col"><strong>${sub.name}</strong></td>
                                    <td>${sub.ch || '-'}</td>
                                    <td style="background: #fdfdfd; width: 25px;">${sub.b1 || '-'}</td><td style="width: 25px;">-</td><td style="width: 35px;">-</td>
                                    <td style="background: #fdfdfd; width: 25px;">${sub.b2 || '-'}</td><td style="width: 25px;">-</td><td style="width: 35px;">-</td>
                                    <td style="background: #fdfdfd; width: 25px;">${sub.b3 || '-'}</td><td style="width: 25px;">-</td><td style="width: 35px;">-</td>
                                    <td style="background: #fdfdfd; width: 25px;">${sub.b4 || '-'}</td><td style="width: 25px;">-</td><td style="width: 35px;">-</td>
                                    <td style="font-weight: bold; background: #f5f5f5;">${sub.grade || '-'}</td>
                                    <td style="font-size: 9px;">${sub.status || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : `
                    <p style="font-size: 11px; font-style: italic; margin-top: 5px; border: 1px solid #000; padding: 10px; background: #f9f9f9;">
                        • Histórico simplificado. Média Global do Ano: <strong>${record.average || '-'}</strong>.
                    </p>
                `}
            </div>
        `).join('');
    };

    const renderCurrentGradesRows = () => {
        if (!currentGrades || currentGrades.length === 0) {
            return `<tr><td colspan="15" style="text-align: center; font-style: italic; color: #666; padding: 20px;">Nenhuma nota lançada no sistema para o ano vigente.</td></tr>`;
        }

        return currentGrades.map(g => {
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
                let levelKey = 'Fundamental I';
                if (student.gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
                else if (student.gradeLevel.includes('Ensino Médio') || student.gradeLevel.includes('Ens. Médio') || student.gradeLevel.includes('Série')) levelKey = 'Ensino Médio';
                weeklyClasses = (CURRICULUM_MATRIX[levelKey] || {})[g.subject] || 0;
            }

            const currentYear = getCurrentSchoolYear();

            // Annual calculations
            const totalAbsences = attendanceRecords.reduce((acc, record) => {
                const rYear = parseInt(record.date.split('-')[0], 10);
                const rBim = settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date);
                if (rYear === currentYear &&
                    record.discipline.trim().toLowerCase() === g.subject.trim().toLowerCase() &&
                    rBim <= elapsedBimesters &&
                    record.studentStatus &&
                    record.studentStatus[g.studentId] === AttendanceStatus.ABSENT) {

                    if (classSchedules && classSchedules.length > 0 && student.unit) {
                        if (!isClassScheduled(record.date, g.subject, classSchedules, calendarEvents || [], student.unit, student.gradeLevel, student.schoolClass)) return acc;
                    }

                    const individualCount = record.studentAbsenceCount?.[g.studentId];
                    return acc + (individualCount !== undefined ? individualCount : (record.lessonCount || 1));
                }
                return acc;
            }, 0);

            const startOfYear = `${currentYear}-01-01`;
            let ministradaWorkload = 0;

            if (classSchedules && classSchedules.length > 0 && student.unit) {
                const effResult = calculateEffectiveTaughtClasses(startOfYear, today, student.unit, g.subject, classSchedules, calendarEvents || [], student.gradeLevel, student.schoolClass);
                ministradaWorkload = effResult.taught;
            } else {
                const totalDaysElapsed = calculateSchoolDays(startOfYear, today, calendarEvents || [], student.unit);
                ministradaWorkload = Math.round((weeklyClasses / 5) * totalDaysElapsed);
            }

            const totalCH = weeklyClasses > 0 ? (weeklyClasses * 40) : 0;

            const annualResult = calculateAnnualAttendancePercentage(
                g.subject,
                totalAbsences,
                student.gradeLevel,
                elapsedBimesters,
                academicSubjects,
                settings,
                calendarEvents,
                student.unit,
                classSchedules,
                student.schoolClass
            );
            const totalFrequency = annualResult ? (annualResult.percent + '%') : '100%';

            const renderBimesterCols = (bim: number, bData: any) => {
                const bAbs = attendanceRecords.reduce((acc, record) => {
                    const rYear = parseInt(record.date.split('-')[0], 10);
                    if (rYear === currentYear &&
                        record.discipline.trim().toLowerCase() === g.subject.trim().toLowerCase() &&
                        (settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date)) === bim &&
                        record.studentStatus &&
                        record.studentStatus[g.studentId] === AttendanceStatus.ABSENT) {

                        if (classSchedules && classSchedules.length > 0 && student.unit) {
                            if (!isClassScheduled(record.date, g.subject, classSchedules, calendarEvents || [], student.unit, student.gradeLevel, student.schoolClass)) return acc;
                        }

                        const individualCount = record.studentAbsenceCount?.[g.studentId];
                        return acc + (individualCount !== undefined ? individualCount : (record.lessonCount || 1));
                    }
                    return acc;
                }, 0);

                const freq = calculateSubjectFrequency(student, g, g.subject, bim, attendanceRecords, academicSubjects, settings, calendarEvents, classSchedules, student.schoolClass);
                const isStarted = bim <= elapsedBimesters;

                let bMin = 0;
                const bimSettings = settings?.bimesters.find(b => b.number === bim);
                if (isStarted && bimSettings) {
                    const bStart = bimSettings.startDate;
                    const bEnd = bimSettings.endDate;
                    const effectiveEnd = today < bEnd ? today : bEnd;
                    const bDays = calculateSchoolDays(bStart, effectiveEnd, calendarEvents || []);
                    bMin = Math.round((weeklyClasses / 5) * bDays);
                } else if (isStarted) {
                    bMin = Math.round((weeklyClasses / 5) * 50);
                    const currB = getDynamicBimester(today, settings);
                    if (bim === currB) bMin = Math.round(bMin * 0.5);
                }

                return `
                    <td style="color: #666; font-size: 8px;">${fG(bData.nota)}</td>
                    <td style="color: #666; font-size: 8px;">${fG(bData.recuperacao)}</td>
                    <td style="font-weight: bold; font-size: 8px;">${fG(bData.media)}</td>
                    <td style="color: #444; font-size: 8px;">${bAbs}</td>
                    <td style="color: #444; font-size: 8px;">${bAbs + 'h'}</td>
                    <td style="font-size: 8px; font-weight: bold;">${isStarted ? freq : '-'}</td>
                    <td style="color: #666; font-size: 8px; background: #fafafa;">${bMin > 0 ? bMin + 'h' : '-'}</td>
                `;
            };

            return `
            <tr>
                <td class="subject-col"><strong>${g.subject}</strong></td>
                <td style="width: 25px;">${totalCH > 0 ? totalCH + 'h' : '-'}</td>
                <td style="color: #444; font-weight: bold;">${ministradaWorkload > 0 ? ministradaWorkload + 'h' : '-'}</td>
                ${renderBimesterCols(1, g.bimesters.bimester1)}
                ${renderBimesterCols(2, g.bimesters.bimester2)}
                ${renderBimesterCols(3, g.bimesters.bimester3)}
                ${renderBimesterCols(4, g.bimesters.bimester4)}
                <td style="font-weight: bold; background: #f9f9f9;">${fG(g.mediaAnual)}</td>
                <td style="color: #844; font-weight: bold;">${fG(g.recuperacaoFinal)}</td>
                <td style="font-weight: 900; background: #f0f4f8;">${fG(g.mediaFinal)}</td>
                <td style="color: #444; font-weight: bold;">${totalAbsences}</td>
                <td style="color: #444; font-weight: bold;">${totalAbsences + 'h'}</td>
                <td style="background: #eef2f6; font-weight: bold;">${totalFrequency}</td>
                <td style="font-size: 8px;"><strong>${(g.mediaFinal === 0 || g.mediaFinal === null) && g.situacaoFinal === 'Recuperação' ? 'Cursando' : (g.situacaoFinal || 'Cursando')}</strong></td>
            </tr>
            `;
        }).join('');
    };

    const calculateGeneralFrequencyInternal = () => {
        return calculateUnifiedFrequency(
            currentGrades,
            attendanceRecords,
            student.id,
            student.gradeLevel,
            academicSubjects,
            settings
        );
    };

    const content = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Histórico Escolar - ${student.name}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        body { 
            background-color: #525659; margin: 0; padding: 0; 
            display: flex; justify-content: center; min-height: 100vh;
            font-family: 'Times New Roman', Times, serif; color: #000; 
        }
        .page {
            background-color: white; width: 210mm; min-height: 297mm;
            padding: 15mm; margin: 20px auto; box-shadow: 0 0 10px rgba(0,0,0,0.5);
            box-sizing: border-box; position: relative;
        }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 20px; }
        .logo { max-height: 70px; }
        .school-info { text-align: left; }
        .title { font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 10px 0; text-align: center; }
        .section { margin-bottom: 20px; }
        .section-title { font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 8px; text-transform: uppercase; font-size: 12px; background-color: #f2f2f2; padding: 4px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
        .info-item { margin-bottom: 2px; }
        .label { font-weight: bold; margin-right: 5px; }
        .grades-table { border-collapse: collapse; width: 100%; margin-top: 5px; table-layout: fixed; }
        .grades-table th, .grades-table td { border: 1px solid #000; padding: 2px 1px; text-align: center; font-size: 8.5px; overflow: hidden; white-space: nowrap; }
        .grades-table th { background-color: #f2f2f2; font-weight: bold; font-size: 7.5px; }
        .subject-col { text-align: left !important; padding-left: 3px !important; width: 110px; font-size: 9px; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; }
        .signatures { display: flex; justify-content: space-around; margin-top: 60px; }
        .sig-line { border-top: 1px solid #000; width: 40%; padding-top: 5px; font-weight: bold; text-transform: uppercase; font-size: 10px; }
        @media print {
            body { background: none; display: block; }
            .page { width: 100%; margin: 0; box-shadow: none; padding: 0; min-height: auto; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
             <img src="${unitDetail.logoUrl || 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png'}" alt="Logo" class="logo" style="filter: grayscale(100%);">
             <div class="school-info">
                <h2 style="margin:0; font-size: 16px; font-weight: 900; color: #1a426f;">EXPANSIVO REDE DE ENSINO</h2>
                ${(unitInfo as any).professionalTitle ? `<p style="margin:0; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase;">${(unitInfo as any).professionalTitle}</p>` : ''}
                <p style="margin:2px 0; font-weight: bold; text-transform: uppercase; color: #1e293b; font-size: 11px;">UNIDADE: ${unitInfo.fullName.replace('Expansivo - ', '').toUpperCase()}</p>
                <p style="margin:2px 0; font-size: 10px; color: #334155;">${unitInfo.address}${unitInfo.district ? ` - ${unitInfo.district}` : ''}${unitInfo.city ? `, ${unitInfo.city}` : ''}${unitInfo.uf ? ` - ${unitInfo.uf}` : ''}${unitInfo.cep ? ` - CEP: ${unitInfo.cep}` : ''}</p>
                <p style="margin:2px 0; font-size: 10px; color: #334155;">CNPJ: ${unitInfo.cnpj} | Tel: ${unitInfo.phone}${unitInfo.whatsapp ? ` | WhatsApp: ${unitInfo.whatsapp}` : ''}${unitInfo.email ? ` | E-mail: ${unitInfo.email}` : ''}</p>
                ${unitInfo.authorization ? `<p style="margin:2px 0; font-size: 9px; font-style: italic; color: #64748b;">${unitInfo.authorization}</p>` : ''}
             </div>
        </div>

        <div class="title">Histórico Escolar Oficial</div>

        <div class="section">
            <div class="section-title">Dados de Identificação do Aluno</div>
            <div class="info-grid">
                <div class="info-item"><span class="label">Nome Completo:</span> ${student.name}</div>
                <div class="info-item"><span class="label">Matrícula:</span> ${student.code}</div>
                <div class="info-item"><span class="label">Data de Nascimento:</span> ${student.data_nascimento ? new Date(student.data_nascimento).toLocaleDateString('pt-BR') : '-'}</div>
                <div class="info-item"><span class="label">Naturalidade:</span> ${student.naturalidade || '-'}</div>
                <div class="info-item"><span class="label">RG:</span> ${student.identidade_rg || '-'}</div>
                <div class="info-item"><span class="label">CPF:</span> ${student.cpf_aluno || '-'}</div>
                <div class="info-item"><span class="label">Nome da Mãe:</span> ${student.nome_mae || '-'}</div>
                <div class="info-item"><span class="label">Nome do Pai:</span> ${student.nome_pai || '-'}</div>
            </div>
        </div>

        ${renderHistoryContent()}

        <div class="section" style="page-break-inside: auto;">
            <div class="section-title">Componentes Curriculares e Rendimento (Ano Letivo: ${new Date().getFullYear()})</div>
            <table class="grades-table">
                <thead>
                    <tr>
                        <th rowspan="2" class="subject-col">Disciplina</th>
                        <th rowspan="2" style="width: 25px;">CH Prev.</th>
                        <th rowspan="2" style="width: 25px;">CH Min.</th>
                        <th colspan="7">1º Bimestre</th>
                        <th colspan="7">2º Bimestre</th>
                        <th colspan="7">3º Bimestre</th>
                        <th colspan="7">4º Bimestre</th>
                        <th rowspan="2" style="width: 22px;">M.An.</th>
                        <th rowspan="2" style="width: 22px;">P.Fi.</th>
                        <th rowspan="2" style="width: 22px;">M.Fi.</th>
                        <th rowspan="2" style="width: 15px;">F</th>
                        <th rowspan="2" style="width: 20px;">F(h)</th>
                        <th rowspan="2" style="width: 30px; background: #eef2f6;">Fr (%)</th>
                        <th rowspan="2" style="width: 45px;">Resultado</th>
                    </tr>
                    <tr>
                        <th title="Nota">N</th><th title="Recuperação">R</th><th title="Média">M</th><th title="Faltas">F</th><th title="Faltas(h)">h</th><th title="Frequência">%</th><th title="CH Min">Mi</th>
                        <th title="Nota">N</th><th title="Recuperação">R</th><th title="Média">M</th><th title="Faltas">F</th><th title="Faltas(h)">h</th><th title="Frequência">%</th><th title="CH Min">Mi</th>
                        <th title="Nota">N</th><th title="Recuperação">R</th><th title="Média">M</th><th title="Faltas">F</th><th title="Faltas(h)">h</th><th title="Frequência">%</th><th title="CH Min">Mi</th>
                        <th title="Nota">N</th><th title="Recuperação">R</th><th title="Média">M</th><th title="Faltas">F</th><th title="Faltas(h)">h</th><th title="Frequência">%</th><th title="CH Min">Mi</th>
                    </tr>
                </thead>
                <tbody>
                    ${renderCurrentGradesRows()}
                    <tr style="background: #f8f9fa; font-weight: bold;">
                        <td colspan="36" style="text-align: right; padding-right: 15px;">FREQUÊNCIA GERAL NO ANO LETIVO:</td>
                        <td style="text-align: center; font-size: 11px; color: #1a426f;">${calculateGeneralFrequencyInternal()}</td>
                        <td style="background: #f8f9fa;"></td>
                    </tr>
                </tbody>
            </table>
            <p style="font-size: 8px; margin-top: 5px; font-style: italic;">
                Legenda: CH: Carga Horária Anual | N: Nota Bim. | R: Recup.Bim. | M: Média Bim. | F: Faltas | %: Frequência Mensal Estimada.<br />
                * O rendimento do ano letivo em curso é parcial e está sujeito a alterações até o fechamento do sistema.
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

    <script>
        window.onload = function () { setTimeout(() => { window.print(); }, 500); }
    </script>
</body>
</html>
`;

    printWindow.document.write(content);
    printWindow.document.close();
};
