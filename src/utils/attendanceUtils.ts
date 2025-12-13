import { AttendanceRecord, AttendanceStatus } from '../../types';

// Helper for month names (to avoid circular dependency or external constant import issues if minimal)
const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export interface DetailedBimesterData {
    count: number;
    details: {
        [monthName: string]: number[]; // List of days
    };
}

export interface AttendanceBreakdown {
    [bimester: number]: DetailedBimesterData;
}

/**
 * Agrupa as faltas do aluno por bimestre com base na data da falta.
 * @param attendanceRecords Lista completa de registros de frequência.
 * @param studentId ID do aluno para filtrar as faltas.
 * @param subject (Opcional) Disciplina para filtrar. Se omitido, considera todas (cuidado ao misturar disciplinas).
 * @param year (Opcional) Ano para filtrar. Se omitido, usa o ano atual.
 * @returns Objeto com o total e detalhes de faltas por bimestre.
 */
export const getAttendanceBreakdown = (
    attendanceRecords: AttendanceRecord[],
    studentId: string,
    subject?: string,
    year: number = new Date().getFullYear()
): AttendanceBreakdown => {
    // Initialize structure
    const breakdown: AttendanceBreakdown = {
        1: { count: 0, details: {} },
        2: { count: 0, details: {} },
        3: { count: 0, details: {} },
        4: { count: 0, details: {} }
    };

    attendanceRecords.forEach(record => {
        // Filtro por Disciplina (se fornecido)
        if (subject && record.discipline !== subject) return;

        // Verifica se o aluno faltou nesse registro
        if (record.studentStatus && record.studentStatus[studentId] === AttendanceStatus.ABSENT) {
            const [recordYear, recordMonth, recordDay] = record.date.split('-').map(Number); // YYYY-MM-DD

            if (recordYear === year) {
                // Cálculo do Bimestre (Jan-Mar=1, Abr-Jun=2, Jul-Set=3, Out-Dez=4)
                const bimester = Math.floor((recordMonth - 1) / 3) + 1;

                if (bimester >= 1 && bimester <= 4) {
                    breakdown[bimester].count++;

                    const monthName = MONTH_NAMES[recordMonth - 1];
                    if (!breakdown[bimester].details[monthName]) {
                        breakdown[bimester].details[monthName] = [];
                    }
                    breakdown[bimester].details[monthName].push(recordDay);
                }
            }
        }
    });

    // Sort days numerically for better UX
    Object.values(breakdown).forEach(b => {
        Object.values(b.details).forEach(days => days.sort((a, b) => a - b));
    });

    return breakdown;
};
