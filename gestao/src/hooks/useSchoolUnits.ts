import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import type { SchoolUnitDetail } from '../types';

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

    const getUnitById = (id: string) => units.find(u => u.id === id);

    return { units, loading, getUnitById };
}

export async function fetchUnitDetail(unitId: string): Promise<SchoolUnitDetail | null> {
    try {
        const docRef = doc(db, 'school_units', unitId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as SchoolUnitDetail;
        }
    } catch (error) {
        console.error("Error fetching unit detail:", error);
    }
    return null;
}
