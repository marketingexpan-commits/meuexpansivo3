
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { GradeEntry, AttendanceRecord } from '../types';
import { CURRICULUM_MATRIX } from '../constants';

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
    calculateFrequencyFromGrades(grades: GradeEntry[], gradeLevel: string = "Fundamental I") {
        if (grades.length === 0) return 100;

        let totalExpectedClasses = 0;
        let totalAbsences = 0;

        // 1. Determine Level Key for Matrix access
        let levelKey = '';
        if (gradeLevel.includes('Fundamental I')) levelKey = 'Fundamental I';
        else if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
        else if (gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ens. Médio';

        // 2. Iterate through all subjects and bimesters
        grades.forEach(gradeEntry => {
            const subject = gradeEntry.subject;
            const weeklyClasses = (CURRICULUM_MATRIX[levelKey] || {})[subject] || 0;

            // For each bimester, add 10 weeks of classes
            Object.values(gradeEntry.bimesters).forEach(b => {
                if (weeklyClasses > 0) {
                    totalExpectedClasses += (weeklyClasses * 10);
                    totalAbsences += (b.faltas || 0);
                }
            });
        });

        if (totalExpectedClasses === 0) return 100;

        const frequencia = ((totalExpectedClasses - totalAbsences) / totalExpectedClasses) * 100;
        return Math.max(0, Math.min(100, parseFloat(frequencia.toFixed(1))));
    }
};
