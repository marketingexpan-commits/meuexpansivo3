import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, doc, setDoc, query, where, deleteDoc } from 'firebase/firestore';
import type { Teacher } from '../types';

const TEACHERS_COLLECTION = 'teachers';

export const teacherService = {
    // Listar professores (com filtro opcional de unidade)
    async getTeachers(unitFilter?: string | null) {
        try {
            let q;
            if (unitFilter && unitFilter !== 'admin_geral') {
                q = query(collection(db, TEACHERS_COLLECTION), where('unit', '==', unitFilter));
            } else {
                q = collection(db, TEACHERS_COLLECTION);
            }

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Teacher[];
        } catch (error) {
            console.error("Erro ao buscar professores:", error);
            throw error;
        }
    },

    // Criar novo professor
    async createTeacher(teacherData: Partial<Teacher>) {
        try {
            const docRef = await addDoc(collection(db, TEACHERS_COLLECTION), {
                ...teacherData,
                isBlocked: teacherData.isBlocked ?? false,
                createdAt: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            console.error("Erro ao criar professor:", error);
            throw error;
        }
    },

    // Atualizar professor existente
    async updateTeacher(id: string, teacherData: Partial<Teacher>) {
        try {
            const docRef = doc(db, TEACHERS_COLLECTION, id);
            await setDoc(docRef, {
                ...teacherData,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error("Erro ao atualizar professor:", error);
            throw error;
        }
    },

    // Deletar professor
    async deleteTeacher(id: string) {
        try {
            const docRef = doc(db, TEACHERS_COLLECTION, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Erro ao deletar professor:", error);
            throw error;
        }
    }
};
