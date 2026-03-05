import { db } from '../firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { type Photographer, SchoolUnit } from '../types';

const COLLECTION_NAME = 'photographers';

export const photographerService = {
    // Create
    createPhotographer: async (photographer: Omit<Photographer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...photographer,
                isActive: true, // Default to active
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating photographer:', error);
            throw error;
        }
    },

    // Read (All or by Unit)
    getPhotographers: async (unit?: SchoolUnit | string | null): Promise<Photographer[]> => {
        try {
            let q = collection(db, COLLECTION_NAME);

            // If a specific unit is provided (and it's not admin/all), filter by it
            if (unit && unit !== 'admin_geral') {
                // @ts-ignore - firebase query typing issues
                q = query(q, where('unit', '==', unit));
            }

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Photographer));
        } catch (error) {
            console.error('Error fetching photographers:', error);
            throw error;
        }
    },

    // Update
    updatePhotographer: async (id: string, data: Partial<Photographer>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating photographer:', error);
            throw error;
        }
    },

    // Delete
    deletePhotographer: async (id: string): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error('Error deleting photographer:', error);
            throw error;
        }
    },

    findByCpf: async (cpf: string): Promise<Photographer | null> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('cpf', '==', cpf)
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Photographer;
        } catch (error) {
            console.error('Error finding photographer:', error);
            throw error;
        }
    }
};
