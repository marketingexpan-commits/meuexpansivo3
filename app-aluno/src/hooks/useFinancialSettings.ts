
import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { UNITS_CONTACT_INFO } from '../constants';

export interface UnitContactSettings {
    responsibleName: string;
    whatsapp: string;
    email: string;
    whatsappMessage: string;
    address?: string;
    cnpj?: string;
}

const DEFAULT_MESSAGE = "Olá, estou enviando o comprovante de pagamento.";

export function useFinancialSettings(unitName: string) {
    const [settings, setSettings] = useState<UnitContactSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!unitName) {
            setLoading(false);
            return;
        }

        const docRef = doc(db, 'settings', 'financial_contacts');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const unitData = data[unitName];

                // Fallback to constants if no overrides
                const constantInfo = UNITS_CONTACT_INFO.find(u => u.name === unitName);

                if (unitData) {
                    setSettings({
                        responsibleName: unitData.responsibleName || '',
                        whatsapp: unitData.whatsapp || (constantInfo?.whatsapp || ''),
                        email: unitData.email || '',
                        whatsappMessage: unitData.whatsappMessage || DEFAULT_MESSAGE,
                        // Preserve address from constants as it's not editable yet
                        address: constantInfo?.address,
                    });
                } else if (constantInfo) {
                    setSettings({
                        responsibleName: 'Financeiro',
                        whatsapp: constantInfo.whatsapp,
                        email: '',
                        whatsappMessage: DEFAULT_MESSAGE,
                        address: constantInfo.address
                    });
                }
            } else {
                // Fallback if doc doesn't exist
                const constantInfo = UNITS_CONTACT_INFO.find(u => u.name === unitName);
                if (constantInfo) {
                    setSettings({
                        responsibleName: 'Financeiro',
                        whatsapp: constantInfo.whatsapp,
                        email: '',
                        whatsappMessage: DEFAULT_MESSAGE,
                        address: constantInfo.address
                    });
                }
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching financial settings:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [unitName]);

    return { settings, loading };
}
