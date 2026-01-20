import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
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
    },

    // --- NOVO: MÉTODOS PARA CLEANUP TOOL ---

    // Buscar todas as notas de todos os alunos
    async getAllGrades() {
        try {
            const snap = await getDocs(collection(db, GRADES_COLLECTION));
            return snap.docs.map(d => ({ id: d.id, ...d.data() })) as GradeEntry[];
        } catch (error) {
            console.error("Erro ao buscar todas as notas:", error);
            throw error;
        }
    },

    // Buscar todos os registros de frequência
    async getAllAttendance() {
        try {
            const snap = await getDocs(collection(db, ATTENDANCE_COLLECTION));
            return snap.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];
        } catch (error) {
            console.error("Erro ao buscar todos os registros de presença:", error);
            throw error;
        }
    },

    // Atualizar uma nota específica
    async updateGrade(gradeId: string, gradeData: Partial<GradeEntry>) {
        try {
            const docRef = doc(db, GRADES_COLLECTION, gradeId);
            await setDoc(docRef, {
                ...gradeData,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error("Erro ao atualizar nota:", error);
            throw error;
        }
    },

    // Deletar uma nota específica
    async deleteGrade(gradeId: string) {
        try {
            const { deleteDoc } = await import('firebase/firestore');
            const docRef = doc(db, GRADES_COLLECTION, gradeId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Erro ao deletar nota:", error);
            throw error;
        }
    },

    // Deletar notas em lote (Firestore Batch - Limite 500 por transação)
    async deleteGradesBatch(gradeIds: string[]) {
        try {
            const { writeBatch } = await import('firebase/firestore');
            const batchSize = 500;

            for (let i = 0; i < gradeIds.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = gradeIds.slice(i, i + batchSize);

                chunk.forEach(id => {
                    batch.delete(doc(db, GRADES_COLLECTION, id));
                });

                await batch.commit();
            }
        } catch (error) {
            console.error("Erro ao deletar notas em lote:", error);
            throw error;
        }
    },

    // Buscar todas as grades horárias
    async getAllSchedules() {
        try {
            const snap = await getDocs(collection(db, 'class_schedules'));
            return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        } catch (error) {
            console.error("Erro ao buscar grades horárias:", error);
            throw error;
        }
    },

    // Deletar grades horárias em lote
    async deleteSchedulesBatch(scheduleIds: string[]) {
        try {
            const { writeBatch } = await import('firebase/firestore');
            const batchSize = 500;

            for (let i = 0; i < scheduleIds.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = scheduleIds.slice(i, i + batchSize);

                chunk.forEach(id => {
                    batch.delete(doc(db, 'class_schedules', id));
                });

                await batch.commit();
            }
        } catch (error) {
            console.error("Erro ao deletar grades em lote:", error);
            throw error;
        }
    },

    // Buscar todos os eventos do calendário
    async getCalendarEvents() {
        try {
            const snap = await getDocs(collection(db, 'calendar_events'));
            return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        } catch (error) {
            console.error("Erro ao buscar eventos do calendário:", error);
            throw error;
        }
    },

    // Método genérico para atualização de documentos (usado em ferramentas de manutenção)
    async updateGeneric(collectionName: string, docId: string, data: any) {
        try {
            const docRef = doc(db, collectionName, docId);
            await setDoc(docRef, {
                ...data,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error(`Erro ao atualizar documento em ${collectionName}:`, error);
            throw error;
        }
    }
};
