
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { GradeEntry, AttendanceRecord } from '../types';

const GRADES_COLLECTION = 'grades';
const ATTENDANCE_COLLECTION = 'attendance';

export const pedagogicalService = {
    // Buscar notas de um aluno
    async getGrades(studentId: string) {
        try {
            const q = query(collection(db, GRADES_COLLECTION), where('studentId', '==', studentId));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() })) as GradeEntry[];
        } catch (error) {
            console.error("Erro ao buscar notas:", error);
            throw error;
        }
    },

    // Buscar registros de frequência de um aluno
    async getAttendance(studentId: string) {
        try {
            const q = collection(db, ATTENDANCE_COLLECTION);
            const snap = await getDocs(q);

            // O Firestore não permite filtrar por chaves de mapa facilmente, 
            // então buscamos e filtramos na memória se for necessário, 
            // ou se houver studentStatus.studentId == status.
            // No entanto, AttendanceRecord armazena studentStatus como um mapa { studentId: status }.
            // Então filtramos no JS.
            const allRecords = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];
            return allRecords.filter(record => record.studentStatus && record.studentStatus[studentId]);
        } catch (error) {
            console.error("Erro ao buscar frequência:", error);
            throw error;
        }
    },

    // Calcular frequência percentual baseada nas faltas das notas
    calculateFrequencyFromGrades(grades: GradeEntry[]) {
        if (grades.length === 0) return 100;

        let totalFaltas = 0;
        grades.forEach(grade => {
            Object.values(grade.bimesters).forEach(b => {
                if (b && typeof b.faltas === 'number') {
                    totalFaltas += b.faltas;
                }
            });
        });

        // Estimativa: um aluno tem aprox 200 dias letivos no ano. 
        // Cada disciplina tem um número de aulas. 
        // Se quisermos 75% de frequência global, precisamos de um critério.
        // O usuário mencionou: "Utilize o campo 'F' da tabela pedagógica para calcular se o aluno cumpre o mínimo de 75%".
        // Normalmente, a frequência é (Total aulas - Faltas) / Total aulas.
        // Sem o total de aulas por disciplina, usaremos uma base padrão ou apenas informaremos o status.
        // Vamos assumir uma base de 800 horas/aula ano ou similar. 
        // Mas para simplificar e seguir o que foi pedido, se faltas for baixo, está ok.

        // Se o usuário quer uma porcentagem, precisamos de uma estimativa de total de aulas.
        // Vamos considerar 200 aulas por disciplina (50 por bimestre).
        const totalAulasEstimado = grades.length * 200;
        const frequencia = ((totalAulasEstimado - totalFaltas) / totalAulasEstimado) * 100;

        return Math.max(0, Math.min(100, frequencia));
    }
};
