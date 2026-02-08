import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, doc, setDoc, query, where, deleteDoc } from 'firebase/firestore';
import { type UnitContact, ContactRole } from '../types';

const CONTACTS_COLLECTION = 'unitContacts';

export const coordinatorService = {
    // Listar coordenadores (com filtro opcional de unidade)
    async getCoordinators(unitFilter?: string | null) {
        try {
            const contactsRef = collection(db, CONTACTS_COLLECTION);
            let q;

            if (unitFilter && unitFilter !== 'admin_geral') {
                q = query(
                    contactsRef,
                    where('role', '==', ContactRole.COORDINATOR),
                    where('unit', '==', unitFilter)
                );
            } else {
                q = query(contactsRef, where('role', '==', ContactRole.COORDINATOR));
            }

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as UnitContact[];
        } catch (error) {
            console.error("Erro ao buscar coordenadores:", error);
            throw error;
        }
    },

    // Criar novo coordenador
    async createCoordinator(coordinatorData: Partial<UnitContact>) {
        try {
            const docRef = await addDoc(collection(db, CONTACTS_COLLECTION), {
                ...coordinatorData,
                role: ContactRole.COORDINATOR,
                createdAt: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            console.error("Erro ao criar coordenador:", error);
            throw error;
        }
    },

    // Atualizar coordenador existente
    async updateCoordinator(id: string, coordinatorData: Partial<UnitContact>) {
        try {
            const docRef = doc(db, CONTACTS_COLLECTION, id);
            await setDoc(docRef, {
                ...coordinatorData,
                role: ContactRole.COORDINATOR,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error("Erro ao atualizar coordenador:", error);
            throw error;
        }
    },

    // Deletar coordenador
    async deleteCoordinator(id: string) {
        try {
            const docRef = doc(db, CONTACTS_COLLECTION, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Erro ao deletar coordenador:", error);
            throw error;
        }
    }
};
