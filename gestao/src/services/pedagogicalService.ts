
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
            const allRecords = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];
            return allRecords.filter(record => record.studentStatus && record.studentStatus[studentId]);
        } catch (error) {
            console.error("Erro ao buscar frequência:", error);
            throw error;
        }
    },

    // Calcular frequência percentual baseada nas faltas (Regra Logs-First)
    calculateFrequencyFromGrades(grades: GradeEntry[], gradeLevel: string = "Fundamental I", attendanceRecords: AttendanceRecord[] = []) {
        if (grades.length === 0) return 100;

        let totalExpectedClasses = 0;
        let totalAbsences = 0;
        const currentYear = new Date().getFullYear();

        let levelKey = 'Fundamental I';
        if (gradeLevel.includes('Fundamental II')) levelKey = 'Fundamental II';
        else if (gradeLevel.includes('Ens. Médio') || gradeLevel.includes('Série')) levelKey = 'Ens. Médio';

        grades.forEach(gradeEntry => {
            const subject = gradeEntry.subject;
            const weeklyClasses = (CURRICULUM_MATRIX[levelKey] || {})[subject] || 0;

            if (weeklyClasses > 0) {

                [1, 2, 3, 4].forEach(bim => {
                    // RULE: Strict Log-Based counting for Pedagogical Service
                    const bAbsences = attendanceRecords.filter(r => {
                        const rYear = parseInt(r.date.split('-')[0], 10);
                        const rMonth = parseInt(r.date.split('-')[1], 10);
                        const bimFromMonth = rMonth <= 4 ? 1 : rMonth <= 7 ? 2 : rMonth <= 9 ? 3 : 4;
                        return rYear === currentYear &&
                            r.discipline === subject &&
                            bimFromMonth === bim &&
                            r.studentStatus &&
                            r.studentStatus[gradeEntry.studentId] === 'Faltou';
                    }).length;

                    // RULE: Only contribute if there are assinaladas absences
                    if (bAbsences > 0) {
                        totalExpectedClasses += (weeklyClasses * 10);
                        totalAbsences += bAbsences;
                    }
                });
            }
        });

        if (totalExpectedClasses === 0) return 100;

        const frequencia = ((totalExpectedClasses - totalAbsences) / totalExpectedClasses) * 100;
        return Math.max(0, Math.min(100, parseFloat(frequencia.toFixed(1))));
    }
};
