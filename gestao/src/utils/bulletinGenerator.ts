// Utility for generating School Bulletin PDF (Current Year Only)
import { CURRICULUM_MATRIX, UNIT_DETAILS } from '../constants';
import { getBimesterFromDate, getCurrentSchoolYear } from './academicUtils';
import type { Student, GradeEntry, AttendanceRecord } from '../types';
import { AttendanceStatus } from '../types';

// Helper to calculate frequency per subject/bimester
const calculateSubjectFrequency = (
    student: Student,
    gradeEntry: GradeEntry,
    subject: string,
    bimesterIndex: number, // 1 to 4
    attendanceRecords: AttendanceRecord[] = []
) => {
    // bKey and data
    const bKey = `bimester${bimesterIndex}` as keyof GradeEntry['bimesters'];
    const bData = gradeEntry.bimesters[bKey];

    // Se não houver dados do bimestre, consideramos que ainda não existe
    if (!bData) {
        return '-';
    }

    // Determine level for Matrix
    let levelKey = 'Fundamental I';
    if (student.gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
    else if (student.gradeLevel.includes('Ens. Médio') || student.gradeLevel.includes('Série')) levelKey = 'Ens. Médio';

    const weeklyClasses = (CURRICULUM_MATRIX[levelKey] || {})[subject] || 0;
    if (weeklyClasses === 0) return '-';

    const expectedClasses = weeklyClasses * 10;
    const currentYear = getCurrentSchoolYear();

    // NOVO: Verificar se existe PELO MENOS UM registro de chamada para esta matéria neste bimestre (FILTRANDO ANO)
    const hasRecords = attendanceRecords.some(record => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        return rYear === currentYear &&
            record.discipline === subject &&
            record.unit === student.unit &&
            record.gradeLevel === student.gradeLevel &&
            record.schoolClass === student.schoolClass &&
            getBimesterFromDate(record.date) === bimesterIndex;
    });

    if (!hasRecords) return '-';

    // NOVO: Pegar faltas reais dos logs de chamada (FILTRANDO ANO)
    const absences = attendanceRecords.filter(record => {
        const rYear = parseInt(record.date.split('-')[0], 10);
        return rYear === currentYear &&
            record.discipline === subject &&
            record.unit === student.unit &&
            record.gradeLevel === student.gradeLevel &&
            record.schoolClass === student.schoolClass &&
            getBimesterFromDate(record.date) === bimesterIndex &&
            record.studentStatus &&
            record.studentStatus[gradeEntry.studentId] === AttendanceStatus.ABSENT;
    }).length;

    const frequency = ((expectedClasses - absences) / expectedClasses) * 100;
    if (absences === 0) return '-';
    return Math.max(0, Math.min(100, frequency)).toFixed(1) + '%';
};

const generateBulletinHtml = (
    student: Student,
    currentGrades: GradeEntry[],
    attendanceRecords: AttendanceRecord[],
    pageBreak: boolean = false
) => {
    const unitInfo = UNIT_DETAILS[student.unit] || UNIT_DETAILS['Zona Norte'];
    const currentDate = new Date().toLocaleDateString('pt-BR');

    // Helper to format grade
    const fG = (n: number | null | undefined) => {
        if (n === null || n === undefined) return '-';
        if (n < 0) return '-'; // Handle -1 or placeholders
        return n.toFixed(1);
    };

    const calculateGeneralFrequency = () => {
        if (!currentGrades || currentGrades.length === 0) return '-';

        let totalExpected = 0;
        let totalAbsences = 0;
        const currentYear = getCurrentSchoolYear();

        currentGrades.forEach(g => {
            let levelKey = 'Fundamental I';
            if (student.gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
            else if (student.gradeLevel.includes('Médio') || student.gradeLevel.includes('Série')) levelKey = 'Ens. Médio';

            const weeklyClasses = (CURRICULUM_MATRIX[levelKey] || {})[g.subject] || 0;
            if (weeklyClasses > 0) {
                // Contar bimestres ativos para esta matéria
                let activeBimesters = 0;
                [1, 2, 3, 4].forEach(bim => {
                    const hasRecords = attendanceRecords.some(record => {
                        const recordYear = parseInt(record.date.split('-')[0], 10);
                        return recordYear === currentYear && record.discipline === g.subject && getBimesterFromDate(record.date) === bim;
                    });
                    if (hasRecords) activeBimesters++;
                });

                totalExpected += (weeklyClasses * 10 * activeBimesters);

                // Sum real absences for this subject
                totalAbsences += attendanceRecords.filter(record => {
                    const recordYear = parseInt(record.date.split('-')[0], 10);
                    return recordYear === currentYear &&
                        record.discipline === g.subject &&
                        record.studentStatus &&
                        record.studentStatus[g.studentId] === AttendanceStatus.ABSENT;
                }).length;
            }
        });

        if (totalExpected === 0) return '-';
        if (totalAbsences === 0) return '-';

        const freq = ((totalExpected - totalAbsences) / totalExpected) * 100;
        return freq.toFixed(1) + '%';
    };

    const renderCurrentGradesRows = () => {
        if (!currentGrades || currentGrades.length === 0) {
            return `<tr><td colspan="25" style="text-align: center; font-style: italic; color: #666; padding: 20px;">Nenhuma nota lançada no sistema para o ano vigente.</td></tr>`;
        }

        return currentGrades.map(g => {
            let levelKey = 'Fundamental I';
            if (student.gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
            else if (student.gradeLevel.includes('Médio') || student.gradeLevel.includes('Série')) levelKey = 'Ens. Médio';

            const currentYear = getCurrentSchoolYear();

            const hasAnyRecords = (bim: number) => {
                return attendanceRecords.some(record => {
                    const rYear = parseInt(record.date.split('-')[0], 10);
                    return rYear === currentYear &&
                        record.discipline === g.subject &&
                        record.unit === student.unit &&
                        record.gradeLevel === student.gradeLevel &&
                        record.schoolClass === student.schoolClass &&
                        getBimesterFromDate(record.date) === bim;
                });
            };

            const getRealAbsences = (bim: number) => {
                return attendanceRecords.filter(record => {
                    const rYear = parseInt(record.date.split('-')[0], 10);
                    return rYear === currentYear &&
                        record.discipline === g.subject &&
                        record.unit === student.unit &&
                        record.gradeLevel === student.gradeLevel &&
                        record.schoolClass === student.schoolClass &&
                        getBimesterFromDate(record.date) === bim &&
                        record.studentStatus &&
                        record.studentStatus[g.studentId] === AttendanceStatus.ABSENT;
                }).length;
            };

            const absencesB1 = getRealAbsences(1);
            const absencesB2 = getRealAbsences(2);
            const absencesB3 = getRealAbsences(3);
            const absencesB4 = getRealAbsences(4);

            const weeklyClasses = (CURRICULUM_MATRIX[levelKey] || {})[g.subject] || 0;

            let activeBimesters = 0;
            [1, 2, 3, 4].forEach(b => { if (hasAnyRecords(b)) activeBimesters++; });

            const annualExpectedClasses = weeklyClasses * 40;
            const allAbsences = absencesB1 + absencesB2 + absencesB3 + absencesB4;

            const totalFrequency = (annualExpectedClasses > 0 && allAbsences > 0)
                ? (((annualExpectedClasses - allAbsences) / annualExpectedClasses) * 100).toFixed(1) + '%'
                : '-';

            const totalCH = weeklyClasses > 0 ? (weeklyClasses * 40) : '-';

            return `
            <tr>
                <td class="subject-col">
                    <strong>${g.subject}</strong>
                </td>
                <td>${totalCH}${totalCH !== '-' ? 'h' : ''}</td>
                
                <!-- 1B -->
                <td style="color: #666; font-size: 9px;">${fG(g.bimesters.bimester1.nota)}</td>
                <td style="color: #666; font-size: 9px;">${fG(g.bimesters.bimester1.recuperacao)}</td>
                <td style="background: #fdfdfd;">${fG(g.bimesters.bimester1.media)}</td>
                <td style="color: #666;">${hasAnyRecords(1) && absencesB1 > 0 ? absencesB1 : '-'}</td>
                <td style="font-size: 9px; font-weight: bold;">${calculateSubjectFrequency(student, g, g.subject, 1, attendanceRecords)}</td>
                
                <!-- 2B -->
                <td style="color: #666; font-size: 9px;">${fG(g.bimesters.bimester2.nota)}</td>
                <td style="color: #666; font-size: 9px;">${fG(g.bimesters.bimester2.recuperacao)}</td>
                <td style="background: #fdfdfd;">${fG(g.bimesters.bimester2.media)}</td>
                <td style="color: #666;">${hasAnyRecords(2) && absencesB2 > 0 ? absencesB2 : '-'}</td>
                <td style="font-size: 9px; font-weight: bold;">${calculateSubjectFrequency(student, g, g.subject, 2, attendanceRecords)}</td>

                <!-- 3B -->
                <td style="color: #666; font-size: 9px;">${fG(g.bimesters.bimester3.nota)}</td>
                <td style="color: #666; font-size: 9px;">${fG(g.bimesters.bimester3.recuperacao)}</td>
                <td style="background: #fdfdfd;">${fG(g.bimesters.bimester3.media)}</td>
                <td style="color: #666;">${hasAnyRecords(3) && absencesB3 > 0 ? absencesB3 : '-'}</td>
                <td style="font-size: 9px; font-weight: bold;">${calculateSubjectFrequency(student, g, g.subject, 3, attendanceRecords)}</td>

                <!-- 4B -->
                <td style="color: #666; font-size: 9px;">${fG(g.bimesters.bimester4.nota)}</td>
                <td style="color: #666; font-size: 9px;">${fG(g.bimesters.bimester4.recuperacao)}</td>
                <td style="background: #fdfdfd;">${fG(g.bimesters.bimester4.media)}</td>
                <td style="color: #666;">${hasAnyRecords(4) && absencesB4 > 0 ? absencesB4 : '-'}</td>
                <td style="font-size: 9px; font-weight: bold;">${calculateSubjectFrequency(student, g, g.subject, 4, attendanceRecords)}</td>

                <td style="background: #f0f4f8; font-weight: bold;">${totalFrequency}</td>
                <td style="font-weight: bold; background: #f5f5f5;">${fG(g.mediaFinal)}</td>
                <td style="font-weight: bold; font-size: 9px;">${(g.mediaFinal === 0 || g.mediaFinal === null) && g.situacaoFinal === 'Recuperação' ? 'Cursando' : (g.situacaoFinal || 'Cursando')}</td>
            </tr>
            `;
        }).join('');
    };

    return `
            <div class="page" style="${pageBreak ? 'page-break-after: always;' : ''}">
                <div class="header">
                     <img src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png" alt="Logo" class="logo" style="filter: grayscale(100%);">
                     <div class="school-info">
                        <h2 style="margin:0; font-size: 16px; font-weight: 900;">EXPANSIVO REDE DE ENSINO</h2>
                        <p style="margin:2px 0; font-weight: bold;">Unidade ${student.unit}</p>
                        <p style="margin:2px 0; font-size: 10px;">${unitInfo.address}</p>
                        <p style="margin:2px 0; font-size: 10px;">CNPJ: ${unitInfo.cnpj} | Telefone: ${unitInfo.phone}</p>
                     </div>
                </div>

                <div class="title">Boletim Escolar</div>

                <div class="section">
                    <div class="section-title">Dados de Identificação</div>
                    <div class="info-grid">
                        <div class="info-item"><span class="label">Aluno:</span> ${student.name}</div>
                        <div class="info-item"><span class="label">Matrícula:</span> ${student.code}</div>
                        <div class="info-item"><span class="label">Série/Turma:</span> ${student.gradeLevel} - ${student.schoolClass}</div>
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
                                <th rowspan="2" style="width: 35px;">Média Final</th>
                                <th rowspan="2" style="width: 60px;">Resultado</th>
                            </tr>
                            <tr>
                                <th title="Nota" style="width: 20px;">N</th><th title="Recuperação" style="width: 20px;">R</th><th title="Média">M</th><th title="Faltas">F</th><th title="Frequência">%</th>
                                <th title="Nota" style="width: 20px;">N</th><th title="Recuperação" style="width: 20px;">R</th><th title="Média">M</th><th title="Faltas">F</th><th title="Frequência">%</th>
                                <th title="Nota" style="width: 20px;">N</th><th title="Recuperação" style="width: 20px;">R</th><th title="Média">M</th><th title="Faltas">F</th><th title="Frequência">%</th>
                                <th title="Nota" style="width: 20px;">N</th><th title="Recuperação" style="width: 20px;">R</th><th title="Média">M</th><th title="Faltas">F</th><th title="Frequência">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderCurrentGradesRows()}
                            <tr style="background: #f8f9fa; font-weight: bold;">
                                <td colspan="22" style="text-align: right; padding-right: 15px;">FREQUÊNCIA GERAL NO ANO LETIVO:</td>
                                <td colspan="3" style="text-align: center; font-size: 11px; color: #1a426f;">${calculateGeneralFrequency()}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p style="font-size: 8px; margin-top: 5px; font-style: italic;">
                        Legenda: CH: Carga Horária Anual | N: Nota Bim. | R: Recup. Bim. | M: Média Bim. | F: Faltas | %: Frequência Mensal Estimada.<br/>
                        * O boletim reflete o desempenho parcial até o momento da emissão.
                    </p>
                </div>

                <div class="section">
                    <div class="section-title">Observações</div>
                    <p style="white-space: pre-wrap; font-size: 10px;">${student.observacoes_gerais || 'Nada consta.'}</p>
                </div>

                <div class="footer">
                    <p>Natal/RN, ${currentDate}</p>
                    <div class="signatures">
                        <div class="sig-line">Direção</div>
                        <div class="sig-line">Coordenação Pedagógica</div>
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
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
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
    .subject-col { text-align: left !important; padding-left: 5px !important; width: 140px; }

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
    attendanceRecords: AttendanceRecord[] = []
) => {
    generateBatchSchoolBulletin([{ student, grades: currentGrades, attendance: attendanceRecords }]);
};

export const generateBatchSchoolBulletin = (
    data: { student: Student, grades: GradeEntry[], attendance: AttendanceRecord[] }[]
) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up bloqueado! Por favor permita pop-ups para gerar o documento.");
        return;
    }

    const pagesHtml = data.map((item, index) =>
        generateBulletinHtml(item.student, item.grades, item.attendance, index < data.length - 1)
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
