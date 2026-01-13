
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { GradeEntry, AttendanceRecord, AcademicSubject, AcademicSettings } from '../types';
import { calculateGeneralFrequency } from '../utils/frequency';

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
    async getAttendance(studentId: string, unit?: string) {
        try {
            const currentYear = new Date().getFullYear().toString();
            let q;

            if (unit) {
                // Optimized Query: Filter by Unit + Date (Requires Composite Index)
                q = query(
                    collection(db, ATTENDANCE_COLLECTION),
                    where('unit', '==', unit),
                    where('date', '>=', `${currentYear}-01-01`),
                    where('date', '<=', `${currentYear}-12-31`)
                );
            } else {
                q = query(
                    collection(db, ATTENDANCE_COLLECTION),
                    where('date', '>=', `${currentYear}-01-01`),
                    where('date', '<=', `${currentYear}-12-31`)
                );
            }

            const snap = await getDocs(q);
            const allRecords = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];
            return allRecords.filter(record => record.studentStatus && record.studentStatus[studentId]);
        } catch (error) {
            console.error("Erro ao buscar frequência:", error);
            throw error;
        }
    },

    // Calcular frequência percentual baseada nas faltas (Regra Logs-First Sincronizada)
    calculateFrequencyFromGrades(grades: GradeEntry[], gradeLevel: string = "Fundamental I", attendanceRecords: AttendanceRecord[] = [], academicSubjects?: AcademicSubject[], settings?: AcademicSettings | null) {
        if (!grades || grades.length === 0) return 100;

        // Delegamos para a função unificada que é usada no App do Aluno
        const studentId = grades[0].studentId;
        const freqString = calculateGeneralFrequency(grades, attendanceRecords, studentId, gradeLevel, academicSubjects, settings);

        // Converte "95.5%" para 95.5
        return parseFloat(freqString.replace('%', '')) || 100;
    }
};
