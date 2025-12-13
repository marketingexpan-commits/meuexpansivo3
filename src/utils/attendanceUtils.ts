import { AttendanceRecord, AttendanceStatus } from '../../types';

export interface AttendanceBreakdown {
    [bimester: number]: number;
}

/**
 * Agrupa as faltas do aluno por bimestre com base na data da falta.
 * @param attendanceRecords Lista completa de registros de frequência.
 * @param studentId ID do aluno para filtrar as faltas.
 * @param subject (Opcional) Disciplina para filtrar. Se omitido, considera todas (cuidado ao misturar disciplinas).
 * @param year (Opcional) Ano para filtrar. Se omitido, usa o ano atual.
 * @returns Objeto com o total de faltas por bimestre (ex: { 1: 2, 2: 0, 3: 1, 4: 0 }).
 */
export const getAttendanceBreakdown = (
    attendanceRecords: AttendanceRecord[],
    studentId: string,
    subject?: string,
    year: number = new Date().getFullYear()
): AttendanceBreakdown => {
    const breakdown: AttendanceBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0 };

    attendanceRecords.forEach(record => {
        // Filtro por Disciplina (se fornecido)
        if (subject && record.discipline !== subject) return;

        // Verifica se o aluno faltou nesse registro
        if (record.studentStatus && record.studentStatus[studentId] === AttendanceStatus.ABSENT) {
            const [recordYear, recordMonth] = record.date.split('-').map(Number); // YYYY-MM-DD

            if (recordYear === year) {
                // Cálculo do Bimestre (Jan-Mar=1, Abr-Jun=2, Jul-Set=3, Out-Dez=4)
                // recordMonth é 1-12
                // (Month - 1) / 3 => 0, 1, 2, 3
                // + 1 => 1, 2, 3, 4
                const bimester = Math.floor((recordMonth - 1) / 3) + 1;

                if (bimester >= 1 && bimester <= 4) {
                    breakdown[bimester]++;
                }
            }
        }
    });

    return breakdown;
};
