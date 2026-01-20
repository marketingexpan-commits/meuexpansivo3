import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import type { SchoolUnitDetail } from '../types';
import { SchoolUnit, UNIT_LABELS } from '../types';

export function useSchoolUnits() {
    const [units, setUnits] = useState<SchoolUnitDetail[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadUnits = async () => {
            try {
                const snap = await getDocs(collection(db, 'school_units'));
                const unitsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolUnitDetail));
                setUnits(unitsData);
            } catch (error) {
                console.error("Error loading units hook:", error);
            } finally {
                setLoading(false);
            }
        };
        loadUnits();
    }, []);

    const getUnitById = (id: string) => {
        const found = units.find(u => u.id === id);
        if (found) return found;

        // Resilience: if provided 'unit_bs', try to find 'Boa Sorte' doc
        const legacyLabel = UNIT_LABELS[id as SchoolUnit];
        if (legacyLabel) {
            return units.find(u => u.id === legacyLabel);
        }
        return undefined;
    };

    return { units, loading, getUnitById };
}

export async function fetchUnitDetail(unitId: string): Promise<SchoolUnitDetail | null> {
    try {
        let docRef = doc(db, 'school_units', unitId);
        let docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // Try legacy label mapping
            const legacyLabel = UNIT_LABELS[unitId as SchoolUnit];
            if (legacyLabel) {
                docRef = doc(db, 'school_units', legacyLabel);
                docSnap = await getDoc(docRef);
            }
        }

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as SchoolUnitDetail;
        }
    } catch (error) {
        console.error("Error fetching unit detail:", error);
    }
    return null;
}
