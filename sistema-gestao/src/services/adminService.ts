import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

const ADMINS_COLLECTION = 'admins';

export const adminService = {
    async getAdmins() {
        try {
            const adminRef = collection(db, ADMINS_COLLECTION);
            const snapshot = await getDocs(adminRef);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Erro ao buscar admins:", error);
            return [];
        }
    }
};
