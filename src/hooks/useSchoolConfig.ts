import { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';

export interface UnitContact {
    name: string;
    address: string;
    whatsapp: string;
}

export interface SchoolConfig {
    appName: string;
    appSubtitle: string;
    logoUrl: string;
    instagramUrl: string;
    primaryColor: string;
    accentColor: string;
    maintenanceMode: boolean;
    units: UnitContact[];
    copyrightText: string;
    developerName: string;
    developerUrl: string;
}

const DEFAULT_CONFIG: SchoolConfig = {
    appName: 'Meu Expansivo',
    appSubtitle: 'APLICATIVO',
    logoUrl: 'https://firebasestorage.googleapis.com/v0/b/meu-expansivo-app.appspot.com/o/admin%2Flogo_expansivo.png?alt=media&token=e9d5e3c7-1b0a-4b0a-9b0a-9b0a9b0a9b0a', // Fallback safety
    instagramUrl: 'https://www.instagram.com/redeexpansivo',
    primaryColor: '#172554', // blue-950
    accentColor: '#ea580c', // orange-600
    maintenanceMode: false,
    units: [],
    copyrightText: '© 2026 Expansivo Rede de Ensino. Todos os direitos reservados.',
    developerName: 'HC Apps | 84988739180',
    developerUrl: 'https://wa.me/5584988739180'
};

export const useSchoolConfig = () => {
    const [config, setConfig] = useState<SchoolConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const docRef = doc(db, 'school_config', 'global');

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as SchoolConfig;
                // Merge with default to ensure no undefined fields
                setConfig({ ...DEFAULT_CONFIG, ...data });
            }
            setLoading(false);
        }, (error) => {
            console.error("Erro ao carregar configurações da escola:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { config, loading };
};
