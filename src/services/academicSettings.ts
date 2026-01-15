import { db } from '../../firebaseConfig';
import { AcademicSettings, BimesterConfig } from '../types';

const SETTINGS_COLLECTION = 'academic_settings';

export const DEFAULT_BIMESTERS: BimesterConfig[] = [
    { number: 1, label: '1º Bimestre', startDate: '2026-01-19', endDate: '2026-04-17' },
    { number: 2, label: '2º Bimestre', startDate: '2026-04-20', endDate: '2026-06-25' },
    { number: 3, label: '3º Bimestre', startDate: '2026-07-06', endDate: '2026-09-18' },
    { number: 4, label: '4º Bimestre', startDate: '2026-09-21', endDate: '2026-12-18' }
];

export const getAcademicSettings = async (year: number = 2026, unit: string = 'all'): Promise<AcademicSettings> => {
    try {
        // Try to get specific unit settings
        const snapshot = await db.collection(SETTINGS_COLLECTION)
            .where('year', '==', year)
            .where('unit', '==', unit)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() } as AcademicSettings;
        }

        // If not found and unit is not 'all', try to clone 'all' settings for this unit
        if (unit !== 'all') {
            const allSnapshot = await db.collection(SETTINGS_COLLECTION)
                .where('year', '==', year)
                .where('unit', '==', 'all')
                .limit(1)
                .get();

            if (!allSnapshot.empty) {
                const baseData = allSnapshot.docs[0].data();
                // Clone base data to this unit
                const newDocRef = db.collection(SETTINGS_COLLECTION).doc();
                const newData = {
                    ...baseData,
                    unit: unit,
                    updatedAt: new Date().toISOString()
                };
                await newDocRef.set(newData);
                return { id: newDocRef.id, ...newData } as AcademicSettings;
            }
        }

        // Final fallback: initialize if it's 'all' or if nothing else exists
        if (unit === 'all') {
            const docRef = db.collection(SETTINGS_COLLECTION).doc();
            const newData: Omit<AcademicSettings, 'id'> = {
                year,
                unit: 'all',
                bimesters: DEFAULT_BIMESTERS,
                currentBimester: 1,
                updatedAt: new Date().toISOString()
            };
            await docRef.set(newData);
            return { id: docRef.id, ...newData } as AcademicSettings;
        }

        // If still nothing (extreme case), return local defaults
        return {
            id: 'temp',
            year,
            unit,
            bimesters: DEFAULT_BIMESTERS,
            currentBimester: 1,
            updatedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error("Error fetching academic settings:", error);
        throw error;
    }
};

export const subscribeToAcademicSettings = (year: number, callback: (settings: AcademicSettings) => void, unit: string = 'all') => {
    return db.collection(SETTINGS_COLLECTION)
        .where('year', '==', year)
        .where('unit', '==', unit)
        .onSnapshot(async (snapshot) => {
            if (snapshot.empty) {
                // If direct sub is empty, try to get/initialize and caller will get update via subsequent snapshot if initialized
                const initial = await getAcademicSettings(year, unit);
                callback(initial);
            } else {
                const doc = snapshot.docs[0];
                callback({ id: doc.id, ...doc.data() } as AcademicSettings);
            }
        }, (error) => {
            console.error("Error in academicSettings subscription:", error);
            // Fallback to local defaults if subscription fails to prevent infinite loading
            callback({
                id: 'temp-fallback',
                year,
                unit,
                bimesters: DEFAULT_BIMESTERS,
                currentBimester: 1,
                updatedAt: new Date().toISOString()
            });
        });
};
