import { db } from '../firebaseConfig';
import {
    collection,
    doc,
    getDocs,
    setDoc,
    query,
    where,
    limit,
    onSnapshot,
    writeBatch
} from 'firebase/firestore';
import type { AcademicSettings, BimesterConfig } from '../types';

const SETTINGS_COLLECTION = 'academic_settings';

export const DEFAULT_BIMESTERS: BimesterConfig[] = [
    { number: 1, label: '1º Bimestre', startDate: '2026-01-19', endDate: '2026-04-17' },
    { number: 2, label: '2º Bimestre', startDate: '2026-04-20', endDate: '2026-07-03' },
    { number: 3, label: '3º Bimestre', startDate: '2026-07-20', endDate: '2026-09-25' },
    { number: 4, label: '4º Bimestre', startDate: '2026-09-28', endDate: '2026-12-15' },
];

export const getAcademicSettings = async (year: number = 2026, unit: string = 'all'): Promise<AcademicSettings> => {
    const q = query(
        collection(db, SETTINGS_COLLECTION),
        where('year', '==', year),
        where('unit', '==', unit),
        limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        // If specific unit not found, attempt to clone 'all'
        if (unit !== 'all') {
            const defaultSettings = await getAcademicSettings(year, 'all');
            const newSettings: AcademicSettings = {
                ...defaultSettings,
                id: doc(collection(db, SETTINGS_COLLECTION)).id,
                unit,
                updatedAt: new Date().toISOString()
            };
            await setDoc(doc(db, SETTINGS_COLLECTION, newSettings.id), newSettings);
            return newSettings;
        }

        // Initialize with hardcoded defaults if 'all' is missing
        const newSettings: AcademicSettings = {
            id: doc(collection(db, SETTINGS_COLLECTION)).id,
            year,
            unit: 'all',
            currentBimester: 1,
            bimesters: DEFAULT_BIMESTERS,
            updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, SETTINGS_COLLECTION, newSettings.id), newSettings);
        return newSettings;
    }

    return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as AcademicSettings;
};

export const updateAcademicSettings = async (id: string, data: Partial<AcademicSettings>, unit?: string, year?: number) => {
    const docRef = doc(db, SETTINGS_COLLECTION, id);
    const updateData = { ...data, updatedAt: new Date().toISOString() };
    await setDoc(docRef, updateData, { merge: true });

    // If updating 'all' unit, propagate to all specific units for the same year
    if (unit === 'all' && year) {
        const q = query(
            collection(db, SETTINGS_COLLECTION),
            where('year', '==', year),
            where('unit', '!=', 'all')
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => {
                batch.set(doc(db, SETTINGS_COLLECTION, d.id), updateData, { merge: true });
            });
            await batch.commit();
        }
    }
};

export const subscribeToAcademicSettings = (year: number, unit: string, callback: (settings: AcademicSettings) => void) => {
    const q = query(
        collection(db, SETTINGS_COLLECTION),
        where('year', '==', year),
        where('unit', '==', unit),
        limit(1)
    );

    return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            callback({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AcademicSettings);
        } else {
            // Trigger initialization
            getAcademicSettings(year, unit).then(callback);
        }
    });
};

export const syncBimesterFromEvent = async (eventTitle: string, date: string, unit: string, year: number) => {
    let update: { index: number; field: 'startDate' | 'endDate' } | null = null;
    const normalizedTitle = eventTitle.trim().toLowerCase();

    if (normalizedTitle === 'início do ano letivo') {
        update = { index: 0, field: 'startDate' };
    } else if (normalizedTitle === 'encerramento do ano letivo') {
        update = { index: 3, field: 'endDate' };
    }

    if (!update) return;

    try {
        const settings = await getAcademicSettings(year, unit);
        if (!settings || !settings.bimesters) return;

        const newBimesters = [...settings.bimesters];
        if (newBimesters[update.index]) {
            newBimesters[update.index] = {
                ...newBimesters[update.index],
                [update.field]: date
            };
            await updateAcademicSettings(settings.id, { bimesters: newBimesters }, unit, year);
        }
    } catch (error) {
        console.error("Error syncing bimester from event:", error);
    }
};
