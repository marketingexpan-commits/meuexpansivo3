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
import { SchoolUnit } from '../types';
import type { AcademicSettings, BimesterConfig } from '../types';

const SETTINGS_COLLECTION = 'academic_settings';

export const DEFAULT_BIMESTERS: BimesterConfig[] = [
    { number: 1, label: '1º Bimestre', startDate: '2026-01-19', endDate: '2026-04-17' },
    { number: 2, label: '2º Bimestre', startDate: '2026-04-20', endDate: '2026-07-03' },
    { number: 3, label: '3º Bimestre', startDate: '2026-07-20', endDate: '2026-09-25' },
    { number: 4, label: '4º Bimestre', startDate: '2026-09-28', endDate: '2026-12-15' },
];

export const getAcademicSettings = async (year: number = 2026, unit: SchoolUnit | 'all' = 'all'): Promise<AcademicSettings> => {
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

export const updateAcademicSettings = async (id: string, data: Partial<AcademicSettings>, unit?: SchoolUnit | 'all', year?: number) => {
    if (!id) return;

    const docRef = doc(db, SETTINGS_COLLECTION, id);
    const updateData = { ...data, updatedAt: new Date().toISOString() };
    await setDoc(docRef, updateData, { merge: true });

    // If updating 'all' unit, propagate to all specific units for the same year
    if (unit === 'all' && year) {
        try {
            const q = query(
                collection(db, SETTINGS_COLLECTION),
                where('year', '==', Number(year))
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const batch = writeBatch(db);
                snapshot.docs.forEach(d => {
                    const docData = d.data();
                    // Propagate to all documents that are NOT the 'all' unit
                    if (docData.unit && docData.unit !== 'all') {
                        batch.set(doc(db, SETTINGS_COLLECTION, d.id), updateData, { merge: true });
                    }
                });
                await batch.commit();
            }
        } catch (error) {
            console.error("Error during academic settings propagation:", error);
        }
    }
};

export const subscribeToAcademicSettings = (year: number, unit: SchoolUnit | 'all', callback: (settings: AcademicSettings) => void) => {
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

export const syncBimesterFromEvent = async (eventTitle: string, startDate: string, unit: SchoolUnit | 'all', year: number, endDate?: string) => {
    let updateStart = false;
    let updateEnd = false;
    const normalizedTitle = eventTitle.trim().toLowerCase();

    if (normalizedTitle.includes('início do ano letivo')) {
        updateStart = true;
    } else if (normalizedTitle.includes('encerramento do ano letivo') || normalizedTitle.includes('término do ano letivo') || normalizedTitle.includes('fim do ano letivo')) {
        updateEnd = true;
    } else if (normalizedTitle.includes('ano letivo')) {
        // Catch "Ano Letivo 2026", "Ano Letivo - Central", etc.
        updateStart = true;
        if (endDate) updateEnd = true;
    }

    // Check for specific bimester events (e.g., "1º Bimestre", "Bimestre 2")
    const bimesterMatch = normalizedTitle.match(/(\d)[º°]?\s*bimestre/);
    let bimesterIdx = -1;
    if (bimesterMatch) {
        const bNum = parseInt(bimesterMatch[1]);
        if (bNum >= 1 && bNum <= 4) bimesterIdx = bNum - 1;
    }

    if (!updateStart && !updateEnd && bimesterIdx === -1) return;

    try {
        const settings = await getAcademicSettings(year, unit);
        if (!settings || !settings.bimesters) return;

        const newBimesters = [...settings.bimesters];
        let changed = false;

        // Handle Year Start/End
        if (updateStart && newBimesters[0]) {
            if (newBimesters[0].startDate !== startDate) {
                newBimesters[0] = { ...newBimesters[0], startDate };
                changed = true;
            }
        }
        if (updateEnd && endDate && newBimesters[3]) {
            if (newBimesters[3].endDate !== endDate) {
                newBimesters[3] = { ...newBimesters[3], endDate };
                changed = true;
            }
        }

        // Handle Specific Bimester Start/End
        if (bimesterIdx !== -1 && newBimesters[bimesterIdx]) {
            if (newBimesters[bimesterIdx].startDate !== startDate) {
                newBimesters[bimesterIdx] = { ...newBimesters[bimesterIdx], startDate };
                changed = true;
            }
            if (endDate && newBimesters[bimesterIdx].endDate !== endDate) {
                newBimesters[bimesterIdx] = { ...newBimesters[bimesterIdx], endDate };
                changed = true;
            }
        }

        if (changed) {
            await updateAcademicSettings(settings.id, { bimesters: newBimesters }, unit, year);
        }
    } catch (error) {
        console.error("Error syncing bimester from event:", error);
    }
};
