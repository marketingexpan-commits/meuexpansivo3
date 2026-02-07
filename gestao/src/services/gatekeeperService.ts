import { db } from '../firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { type Gatekeeper, SchoolUnit } from '../types';

const COLLECTION_NAME = 'gatekeepers';

export const gatekeeperService = {
    // Create
    createGatekeeper: async (gatekeeper: Omit<Gatekeeper, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...gatekeeper,
                isActive: true, // Default to active
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating gatekeeper:', error);
            throw error;
        }
    },

    // Read (All or by Unit)
    getGatekeepers: async (unit?: SchoolUnit | string | null): Promise<Gatekeeper[]> => {
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
            } as Gatekeeper));
        } catch (error) {
            console.error('Error fetching gatekeepers:', error);
            throw error;
        }
    },

    // Update
    updateGatekeeper: async (id: string, data: Partial<Gatekeeper>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating gatekeeper:', error);
            throw error;
        }
    },

    // Delete
    deleteGatekeeper: async (id: string): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error('Error deleting gatekeeper:', error);
            throw error;
        }
    },

    // Auth (Get by Name & Unit) - Helper for verifying duplicates or login
    findByUnitAndName: async (unit: string, name: string): Promise<Gatekeeper | null> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('unit', '==', unit),
                where('name', '==', name) // This is case sensitive, might need client side refinement
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Gatekeeper;
        } catch (error) {
            console.error('Error finding gatekeeper:', error);
            throw error;
        }
    }
};
