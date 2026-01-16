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
    contactMessage: string;
    developerMessage: string;
}

const DEFAULT_CONFIG: SchoolConfig = {
    appName: 'Meu Expansivo',
    appSubtitle: 'APLICATIVO',
    logoUrl: 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png',
    instagramUrl: 'https://www.instagram.com/redeexpansivo',
    primaryColor: '#172554', // blue-950
    accentColor: '#ea580c', // orange-600
    maintenanceMode: false,
    units: [],
    copyrightText: '© 2026 Expansivo Rede de Ensino. Todos os direitos reservados.',
    developerName: 'HC Apps | 84988739180',
    developerUrl: 'https://wa.me/5584988739180',
    contactMessage: 'Olá, gostaria de informações sobre a escola.',
    developerMessage: 'Olá, preciso de suporte no App do Aluno.'
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
