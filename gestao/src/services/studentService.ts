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
            const studentsRef = collection(db, STUDENTS_COLLECTION);

            if (unitFilter && unitFilter !== 'admin_geral') {
                q = query(studentsRef, where('unit', '==', unitFilter));
            } else {
                q = studentsRef;
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

    // Deletar aluno
    async deleteStudent(id: string) {
        try {
            const docRef = doc(db, STUDENTS_COLLECTION, id);
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Erro ao deletar aluno:", error);
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
    },

    // --- NOVO: GERADOR DE MATRÍCULA CENTRALIZADO ---

    // Busca o próximo código disponível na rede (Maior + 1)
    async getNextStudentCode() {
        try {
            const allStudents = await this.getStudents();
            let maxCode = 0;

            const testCodes = ['88888', '54321', '12345', '11111', '77777', '00000', '33333', '66666'];

            allStudents.forEach(student => {
                const studentCode = student.code?.toString().trim();
                // Ignorar códigos de teste na busca do maior real
                if (studentCode && !testCodes.includes(studentCode)) {
                    const codeNum = parseInt(studentCode, 10);
                    if (!isNaN(codeNum)) {
                        if (codeNum > maxCode) maxCode = codeNum;
                    }
                }
            });

            return (maxCode + 1).toString();
        } catch (error) {
            console.error("Erro ao calcular próximo código:", error);
            return '';
        }
    },

    // Valida se um código já existe no banco
    async isCodeUnique(code: string, excludeStudentId?: string) {
        try {
            const q = query(collection(db, STUDENTS_COLLECTION), where('code', '==', code));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) return true;

            // Se houver registros, verificar se não é o próprio aluno sendo editado
            if (excludeStudentId) {
                return querySnapshot.docs.every(doc => doc.id === excludeStudentId);
            }

            return false;
        } catch (error) {
            console.error("Erro ao validar unicidade do código:", error);
            return false; // Por segurança, assume que não é único se houver erro
        }
    }
};
