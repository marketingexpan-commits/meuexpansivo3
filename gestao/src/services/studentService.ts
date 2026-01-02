import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import type { Student } from '../types';

const STUDENTS_COLLECTION = 'students';

export const studentService = {
    // Criar novo aluno
    async createStudent(studentData: Partial<Student>) {
        try {
            // Usaremos o addDoc por enquanto para gerar ID automático, 
            // mas idealmente usaríamos o número de matrícula como ID se fosse garantido único.
            const docRef = await addDoc(collection(db, STUDENTS_COLLECTION), {
                ...studentData,
                createdAt: new Date().toISOString(),
                isBlocked: false // Default
            });
            return docRef.id;
        } catch (error) {
            console.error("Erro ao criar aluno:", error);
            throw error;
        }
    },

    // Listar todos os alunos (com filtro opcional de unidade)
    async getStudents(unitFilter?: string | null) {
        try {
            let q;
            if (unitFilter) {
                // Se passar filtro, busca apenas daquela unidade
                q = query(collection(db, STUDENTS_COLLECTION), where('unit', '==', unitFilter));
            } else {
                // Se não, busca tudo
                q = collection(db, STUDENTS_COLLECTION);
            }

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Student[];
        } catch (error) {
            console.error("Erro ao buscar alunos:", error);
            throw error;
        }
    },

    // Atualizar aluno existente
    async updateStudent(id: string, studentData: Partial<Student>) {
        try {
            const docRef = doc(db, STUDENTS_COLLECTION, id);
            await setDoc(docRef, {
                ...studentData,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error("Erro ao atualizar aluno:", error);
            throw error;
        }
    },

    // Batch update to fix numeric classes
    async batchUpdateClassesNumericalToLetter() {
        try {
            const allStudents = await this.getStudents();
            let updatedCount = 0;
            const updates = [];

            for (const student of allStudents) {
                let newClass = '';
                // Logic based on identified issues: 3 -> A, 4 -> B
                const currentClass = student.schoolClass as unknown as string;
                if (currentClass === '3' || currentClass === '03') newClass = 'A';
                else if (currentClass === '4' || currentClass === '04') newClass = 'B';

                if (newClass) {
                    updates.push(this.updateStudent(student.id, { schoolClass: newClass as any }));
                    updatedCount++;
                }
            }

            await Promise.all(updates);
            return updatedCount;
        } catch (error) {
            console.error("Erro na correção em lote:", error);
            throw error;
        }
    },

    // Fix missing classes (empty or whitespace) -> Default to 'A' (temporarily for bulk fix request)
    // Smart Fix: Infer class from Attendance Records
    async batchFixMissingClassesDefaultA() {
        try {
            const allStudents = await this.getStudents();
            const missingClassStudents = allStudents.filter(s => !s.schoolClass || s.schoolClass.trim() === '');

            if (missingClassStudents.length === 0) return 0;

            let updatedCount = 0;
            const updates = [];

            // Simply assign 'A' to all missing classes
            for (const student of missingClassStudents) {
                updates.push(this.updateStudent(student.id, { schoolClass: 'A' as any }));
                updatedCount++;
            }

            if (updates.length > 0) {
                await Promise.all(updates);
            }
            return updatedCount;
        } catch (error) {
            console.error("Erro na correção de turmas vazias:", error);
            throw error;
        }
    }
};
