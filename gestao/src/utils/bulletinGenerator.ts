import { CURRICULUM_MATRIX } from './academicDefaults';
import { getBimesterFromDate, getCurrentSchoolYear, getDynamicBimester, getSubjectDurationForDay, doesEventApplyToStudent } from './academicUtils';
import type { Student, GradeEntry, AttendanceRecord, AcademicSubject, SchoolUnitDetail, AcademicSettings, CalendarEvent } from '../types';
import { AttendanceStatus } from '../types';
import { calculateGeneralFrequency as calculateUnifiedFrequency, calculateTaughtClasses, calculateAttendancePercentage } from './frequency';

// Helper to calculate frequency per subject/bimester
const calculateSubjectFrequency = (
    subject: string,
    student: Student,
    attendanceRecords: AttendanceRecord[],
    bimester: number,
    currentYear: number,
    academicSubjects?: AcademicSubject[],
    settings?: AcademicSettings | null,
    calendarEvents?: CalendarEvent[],
    classSchedules?: any[]
): { percent: string, absences: number } => {
    // 1. Calculate absences weighted by duration if schedules exist
    const absencesHours = attendanceRecords.reduce((acc, record) => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        const b = settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date);

        if (rYear === currentYear &&
            record.discipline === subject &&
            b === bimester &&
            record.studentStatus &&
            record.studentStatus[student.id] === AttendanceStatus.ABSENT) {

            const individualCount = record.studentAbsenceCount?.[student.id];
            const weight = individualCount !== undefined ? individualCount : (record.lessonCount || 1);

            if (classSchedules && classSchedules.length > 0) {
                return acc + getSubjectDurationForDay(record.date, subject, classSchedules, weight, student.gradeLevel, student.schoolClass, calendarEvents, student.unit);
            }
            return acc + weight;
        }
        return acc;
    }, 0);

    // 2. Count raw absence sessions for the "F" column (always integer)
    const absencesCount = attendanceRecords.reduce((acc, record) => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        const b = settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date);
        if (rYear === currentYear &&
            record.discipline === subject &&
            b === bimester &&
            record.studentStatus &&
            record.studentStatus[student.id] === AttendanceStatus.ABSENT) {
            const individualCount = record.studentAbsenceCount?.[student.id];
            return acc + (individualCount !== undefined ? individualCount : (record.lessonCount || 1));
        }
        return acc;
    }, 0);

    if (absencesCount === 0) return { percent: '-', absences: 0 };



    const result = calculateAttendancePercentage(
        subject,
        absencesHours,
        student.gradeLevel,
        bimester,
        academicSubjects,
        settings,
        calendarEvents,
        student.unit,
        classSchedules,
        student.schoolClass
    );

    return {
        percent: result ? `${Math.round(result.percent)}%` : '-',
        absences: Math.round(absencesCount)
    };
};

const generateBulletinHtml = (
    student: Student,
    currentGrades: GradeEntry[],
    attendanceRecords: AttendanceRecord[],
    unitDetail: SchoolUnitDetail,
    pageBreak: boolean = false,
    academicSubjects?: AcademicSubject[],
    settings?: AcademicSettings | null,
    calendarEvents?: CalendarEvent[],
    classSchedules?: any[]
) => {
    const unitInfo = unitDetail;
    const currentDate = new Date().toLocaleDateString('pt-BR');
    const currentYear = getCurrentSchoolYear();
    const today = new Date().toLocaleDateString('en-CA');


    // Helper to format grade
    const fG = (n: number | null | undefined) => {
        if (n === null || n === undefined || n === -1) return '-';
        return n.toFixed(1).replace('.', ',');
    };

    const calculateGeneralFrequencyResult = () => {
        return calculateUnifiedFrequency(
            currentGrades,
            attendanceRecords,
            student.id,
            student.gradeLevel,
            academicSubjects,
            settings,
            calendarEvents,
            student.unit,
            classSchedules,
            student.schoolClass,
            student.shift
        );
    };

    const renderCurrentGradesRows = () => {
        if (!currentGrades || currentGrades.length === 0) {
            return `<tr><td colspan="30" style="text-align: center; font-style: italic; color: #666; padding: 20px;">Nenhuma nota lançada no sistema para o ano vigente.</td></tr>`;
        }

        return currentGrades.map(g => {
            let levelKey = '';
            if (student.gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
            else if (student.gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
            else if (student.gradeLevel.includes('Ensino Médio') || student.gradeLevel.includes('Ens. Médio') || student.gradeLevel.includes('Médio') || student.gradeLevel.includes('Série')) levelKey = 'Ensino Médio';

            const getBimesterAbsences = (bim: number) => {
                return attendanceRecords.reduce((acc, record) => {
                    const rYear = parseInt(record.date.split('-')[0], 10);
                    if (rYear === currentYear &&
                        record.discipline === g.subject &&
                        (settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date)) === bim &&
                        record.studentStatus &&
                        record.studentStatus[g.studentId] === AttendanceStatus.ABSENT) {

                        const individualCount = record.studentAbsenceCount?.[g.studentId];
                        const weight = individualCount !== undefined ? individualCount : (record.lessonCount || 1);

                        if (classSchedules && classSchedules.length > 0) {
                            return acc + getSubjectDurationForDay(record.date, g.subject, classSchedules, weight, student.gradeLevel, student.schoolClass, calendarEvents, student.unit);
                        }
                        return acc + weight;
                    }
                    return acc;
                }, 0);
            };

            const getBimesterAbsenceCount = (bim: number) => {
                return attendanceRecords.reduce((acc, record) => {
                    const rYear = parseInt(record.date.split('-')[0], 10);
                    if (rYear === currentYear &&
                        record.discipline === g.subject &&
                        (settings ? getDynamicBimester(record.date, settings) : getBimesterFromDate(record.date)) === bim &&
                        record.studentStatus &&
                        record.studentStatus[g.studentId] === AttendanceStatus.ABSENT) {
                        const individualCount = record.studentAbsenceCount?.[g.studentId];
                        return acc + (individualCount !== undefined ? individualCount : (record.lessonCount || 1));
                    }
                    return acc;
                }, 0);
            };

            const getBimesterTaught = (bim: number) => {
                const bimConfig = settings?.bimesters?.find(b => b.number === bim);
                if (!bimConfig) return 0;

                const { taught } = calculateTaughtClasses(
                    g.subject,
                    student.gradeLevel,
                    bimConfig.startDate,
                    (today < bimConfig.endDate ? today : bimConfig.endDate),
                    student.unit,
                    academicSubjects,
                    classSchedules,
                    calendarEvents,
                    student.schoolClass
                );
                return taught;
            };

            const absencesB1 = getBimesterAbsenceCount(1);
            const absencesB2 = getBimesterAbsenceCount(2);
            const absencesB3 = getBimesterAbsenceCount(3);
            const absencesB4 = getBimesterAbsenceCount(4);

            const weightB1 = getBimesterAbsences(1);
            const weightB2 = getBimesterAbsences(2);
            const weightB3 = getBimesterAbsences(3);
            const weightB4 = getBimesterAbsences(4);

            const minB1 = getBimesterTaught(1);
            const minB2 = getBimesterTaught(2);
            const minB3 = getBimesterTaught(3);
            const minB4 = getBimesterTaught(4);

            // Helper to format workload with comma and 1 decimal
            const fW = (h: number | string) => {
                if (typeof h === 'string') return h;
                if (h === 0) return '-';
                const rounded = Math.round(h * 10) / 10;
                return `${rounded.toString().replace('.', ',')}h`;
            };

            const totalAbsenceHours = weightB1 + weightB2 + weightB3 + weightB4;
            const totalTaughtHours = minB1 + minB2 + minB3 + minB4;

            const totalFrequency = totalTaughtHours > 0
                ? `${Math.round(((totalTaughtHours - totalAbsenceHours) / totalTaughtHours) * 100)}%`
                : '-';

            const bfreq1 = calculateSubjectFrequency(g.subject, student, attendanceRecords, 1, currentYear, academicSubjects, settings, calendarEvents, classSchedules);
            const bfreq2 = calculateSubjectFrequency(g.subject, student, attendanceRecords, 2, currentYear, academicSubjects, settings, calendarEvents, classSchedules);
            const bfreq3 = calculateSubjectFrequency(g.subject, student, attendanceRecords, 3, currentYear, academicSubjects, settings, calendarEvents, classSchedules);
            const bfreq4 = calculateSubjectFrequency(g.subject, student, attendanceRecords, 4, currentYear, academicSubjects, settings, calendarEvents, classSchedules);

            // C.H. Prevista Anual
            let weeklyClasses = 0;
            if (academicSubjects && academicSubjects.length > 0) {
                const dynamicSubject = academicSubjects.find(s => s.name === g.subject);
                if (dynamicSubject && dynamicSubject.weeklyHours) {
                    const gradeKey = Object.keys(dynamicSubject.weeklyHours).find(key => student.gradeLevel.includes(key));
                    if (gradeKey) weeklyClasses = dynamicSubject.weeklyHours[gradeKey];
                }
            } else if (levelKey) {
                weeklyClasses = (CURRICULUM_MATRIX[levelKey as keyof typeof CURRICULUM_MATRIX] || {})[g.subject] || 0;
            }
            const totalCH = weeklyClasses > 0 ? (weeklyClasses * 40) : '-';

            return `
            <tr>
                <td class="subject-col">
                    <strong>${g.subject}</strong>
                </td>
                <td style="font-size: 8px;">${totalCH}${totalCH !== '-' ? 'h' : ''}</td>
                <td style="font-size: 8px; background: #fafafa;">${fW(totalTaughtHours)}</td>
                
                <!-- 1B -->
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester1.nota)}</td>
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester1.recuperacao)}</td>
                <td style="background: #fdfdfd; width: 25px;">${fG(g.bimesters.bimester1.media)}</td>
                <td style="color: #666; width: 25px;">${absencesB1}</td>
                <td style="font-size: 9px; font-weight: bold; width: 35px;">${bfreq1.percent}</td>
                <td style="font-size: 8px; color: #94a3b8; width: 25px;">${fW(minB1)}</td>
                
                <!-- 2B -->
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester2.nota)}</td>
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester2.recuperacao)}</td>
                <td style="background: #fdfdfd; width: 25px;">${fG(g.bimesters.bimester2.media)}</td>
                <td style="color: #666; width: 25px;">${absencesB2}</td>
                <td style="font-size: 9px; font-weight: bold; width: 35px;">${bfreq2.percent}</td>
                <td style="font-size: 8px; color: #94a3b8; width: 25px;">${fW(minB2)}</td>

                <!-- 3B -->
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester3.nota)}</td>
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester3.recuperacao)}</td>
                <td style="background: #fdfdfd; width: 25px;">${fG(g.bimesters.bimester3.media)}</td>
                <td style="color: #666; width: 25px;">${absencesB3}</td>
                <td style="font-size: 9px; font-weight: bold; width: 35px;">${bfreq3.percent}</td>
                <td style="font-size: 8px; color: #94a3b8; width: 25px;">${fW(minB3)}</td>

                <!-- 4B -->
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester4.nota)}</td>
                <td style="color: #666; font-size: 9px; width: 25px;">${fG(g.bimesters.bimester4.recuperacao)}</td>
                <td style="background: #fdfdfd; width: 25px;">${fG(g.bimesters.bimester4.media)}</td>
                <td style="color: #666; width: 25px;">${absencesB4}</td>
                <td style="font-size: 9px; font-weight: bold; width: 35px;">${bfreq4.percent}</td>
                <td style="font-size: 8px; color: #94a3b8; width: 25px;">${fW(minB4)}</td>

                <td style="background: #f0f4f8; font-weight: bold; font-size: 9px;">${totalFrequency}</td>
                <td style="background: #fdfdfd; font-weight: bold; font-size: 9px; color: #1e3a8a;">${fG(g.mediaAnual)}</td>
                <td style="background: #fdfdfd; font-weight: bold; font-size: 9px; color: #b91c1c;">${fG(g.recuperacaoFinal)}</td>
                <td style="font-weight: bold; background: #f5f5f5; color: #1e3a8a;">${fG(g.mediaFinal)}</td>
                <td style="font-weight: bold; font-size: 9px;">${(g.mediaFinal === 0 || g.mediaFinal === null) && g.situacaoFinal === 'Recuperação' ? 'Cursando' : (g.situacaoFinal || 'Cursando')}</td>
            </tr>
            `;
        }).join('');
    };

    const renderRepositionDetails = () => {
        const repositions = (calendarEvents || []).filter(e =>
            (e.type === 'school_day' || e.type === 'substitution') &&
            e.substituteDayLabel &&
            doesEventApplyToStudent(e, student.unit, student.gradeLevel, student.schoolClass)
        );

        if (repositions.length === 0) return '';

        return `
            <div style="margin-top: 15px; padding: 8px; border: 1px dashed #purple; background: #faf5ff; border-radius: 8px;">
                <div style="font-weight: 800; color: #6b21a8; font-size: 9px; text-transform: uppercase; margin-bottom: 4px;">Informações de Reposição de Aulas:</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; font-size: 8.5px;">
                    ${repositions.map(r => {
            const date = new Date(r.startDate + 'T00:00:00').toLocaleDateString('pt-BR');
            return `<div style="color: #7e22ce;">• ${r.title} (${date}): Grade de ${r.substituteDayLabel}</div>`;
        }).join('')}
                </div>
            </div>
        `;
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
                            <th rowspan="2" style="width: 30px; background: #fdfdfd;" title="Carga Horária Ministrada Anual">CH Min</th>
                            <th colspan="6">1º Bimestre</th>
                            <th colspan="6">2º Bimestre</th>
                            <th colspan="6">3º Bimestre</th>
                            <th colspan="6">4º Bimestre</th>
                            <th rowspan="2" style="width: 35px; background: #eef2f6;">Freq. Final</th>
                            <th rowspan="2" style="width: 25px;" title="Média Anual">MA</th>
                            <th rowspan="2" style="width: 25px;" title="Prova Final">PF</th>
                            <th rowspan="2" style="width: 35px;" title="Média Final">MF</th>
                            <th rowspan="2" style="width: 60px;">Resultado</th>
                        </tr>
                        <tr>
                            <th title="Nota" style="width: 20px;">N</th><th title="Recuperação" style="width: 20px;">R</th><th title="Média" style="width: 20px;">M</th><th title="Faltas" style="width: 15px;">F</th><th title="Frequência" style="width: 25px;">%</th><th title="CH Ministrada" style="width: 20px;">Min.</th>
                            <th title="Nota" style="width: 20px;">N</th><th title="Recuperação" style="width: 20px;">R</th><th title="Média" style="width: 20px;">M</th><th title="Faltas" style="width: 15px;">F</th><th title="Frequência" style="width: 25px;">%</th><th title="CH Ministrada" style="width: 20px;">Min.</th>
                            <th title="Nota" style="width: 20px;">N</th><th title="Recuperação" style="width: 20px;">R</th><th title="Média" style="width: 20px;">M</th><th title="Faltas" style="width: 15px;">F</th><th title="Frequência" style="width: 25px;">%</th><th title="CH Ministrada" style="width: 20px;">Min.</th>
                            <th title="Nota" style="width: 20px;">N</th><th title="Recuperação" style="width: 20px;">R</th><th title="Média" style="width: 20px;">M</th><th title="Faltas" style="width: 15px;">F</th><th title="Frequência" style="width: 25px;">%</th><th title="CH Ministrada" style="width: 20px;">Min.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderCurrentGradesRows()}
                        <tr style="background: #f8f9fa; font-weight: bold;">
                            <td colspan="26" style="text-align: right; padding-right: 15px;">FREQUÊNCIA GERAL NO ANO LETIVO:</td>
                            <td colspan="4" style="text-align: center; font-size: 11px; color: #1a426f;">${calculateGeneralFrequencyResult()}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="footer-notes">
                <div class="notes-title">Legenda e Observações:</div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                    <div><strong>N:</strong> Nota do Bimestre</div>
                    <div><strong>R:</strong> Recuperação Bimestral</div>
                    <div><strong>M:</strong> Média do Bimestre</div>
                    <div><strong>F:</strong> Faltas Acumuladas</div>
                    <div><strong>%:</strong> Frequência Relativa</div>
                    <div><strong>MA:</strong> Média Anual</div>
                    <div><strong>PF:</strong> Prova Final</div>
                    <div><strong>MF:</strong> Média Final</div>
                    <div><strong>CH:</strong> Carga Horária Prevista</div>
                    <div><strong>CH Min:</strong> Carga Horária Ministrada</div>
                </div>
                
                <div style="margin-top: 10px; padding: 5px; background: #eff6ff; border: 1px solid #dbeafe; border-radius: 4px; color: #1e3a8a; font-size: 8px; line-height: 1.3;">
                    <strong>Sobre a frequência:</strong><br>
                    • A frequência é calculada somente com base nas aulas que já aconteceram até o momento.<br>
                    • Disciplinas entram no cálculo conforme começam a ter aulas registradas na grade horária.<br>
                    • O aluno é considerado presente automaticamente, exceto nos dias em que o professor registra falta.
                </div>
                
                ${renderRepositionDetails()}
                ${student.observacoes_gerais ? `<p style="margin-top: 10px; white-space: pre-wrap;"><strong>Observações:</strong> ${student.observacoes_gerais}</p>` : ''}
            </div>
            </div>

            <div class="signature-section" style="display: flex; justify-content: space-around; margin-top: 40px;">
                <div class="signature-box" style="text-align: center; width: 220px;">
                    <div class="signature-line" style="border-top: 1px solid #000; margin-bottom: 5px;"></div>
                    Secretaria Escolar
                </div>
                <div class="signature-box" style="text-align: center; width: 220px;">
                    <div class="signature-line" style="border-top: 1px solid #000; margin-bottom: 5px;"></div>
                    Direção Pedagógica
                </div>
            </div>
        </div>
    `;
};

const getBulletinStyle = () => `
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: 'Inter', sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f1f5f9; }
    .page { background: white; width: 277mm; padding: 10mm; margin: 10px auto; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 4px; }
    .section { margin-bottom: 12px; }
    .section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; border-left: 4px solid #1a426f; padding-left: 8px; margin-bottom: 6px; background: #f8fafc; padding-block: 4px; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 10px; }
    .label { font-weight: 700; color: #64748b; }
    .grades-table { width: 100%; border-collapse: collapse; font-size: 8.5px; table-layout: fixed; }
    .grades-table th, .grades-table td { border: 1px solid #e2e8f0; padding: 3px 1px; text-align: center; overflow: hidden; }
    .grades-table th { background: #f1f5f9; color: #475569; font-weight: 800; font-size: 7.5px; text-transform: uppercase; }
    .subject-col { text-align: left !important; padding-left: 5px !important; width: 140px; font-weight: 700; white-space: nowrap; text-overflow: ellipsis; }
    .footer-notes { margin-top: 12px; font-size: 8.5px; color: #64748b; }
    .notes-title { font-weight: 800; color: #475569; margin-bottom: 3px; text-transform: uppercase; font-size: 9px; }
    @media print {
        body { background: none; }
        .page { margin: 0; box-shadow: none; width: 100%; }
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
    calendarEvents?: CalendarEvent[],
    classSchedules?: any[]
) => {
    generateBatchSchoolBulletin([{ student, grades: currentGrades, attendance: attendanceRecords }], unitDetail, academicSubjects, settings, calendarEvents, classSchedules);
};

export const generateBatchSchoolBulletin = (
    data: { student: Student, grades: GradeEntry[], attendance: AttendanceRecord[] }[],
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

    const pagesHtml = data.map((item, index) =>
        generateBulletinHtml(item.student, item.grades, item.attendance, unitDetail, index < data.length - 1, academicSubjects, settings, calendarEvents, classSchedules)
    ).join('');

    const content = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Boletim Escolar</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
            <style>${getBulletinStyle()}</style>
        </head>
        <body>
            ${pagesHtml}
            <script>
                window.onload = function() {
                    setTimeout(() => { window.print(); }, 1000);
                }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
};
