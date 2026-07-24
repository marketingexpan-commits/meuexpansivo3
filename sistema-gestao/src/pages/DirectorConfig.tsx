import { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { SchoolUnit, ContactRole, UNIT_LABELS } from '../types';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Save, Smartphone, Mail, User, Phone, Building2, Loader2 } from 'lucide-react';

interface DirectorSettings {
    name: string;
    whatsapp: string;
    email: string;
    docId: string | null;
}

const initialDirectorsState: Record<SchoolUnit, DirectorSettings> = {
    [SchoolUnit.UNIT_BS]: { name: '', whatsapp: '', email: '', docId: null },
    [SchoolUnit.UNIT_EXT]: { name: '', whatsapp: '', email: '', docId: null },
    [SchoolUnit.UNIT_ZN]: { name: '', whatsapp: '', email: '', docId: null },
    [SchoolUnit.UNIT_QUI]: { name: '', whatsapp: '', email: '', docId: null }
};

export function DirectorConfig() {
    const [directors, setDirectors] = useState<Record<SchoolUnit, DirectorSettings>>(initialDirectorsState);
    const [isLoading, setIsLoading] = useState(true);
    const [savingUnit, setSavingUnit] = useState<SchoolUnit | null>(null);

    useEffect(() => {
        loadDirectors();
    }, []);

    const loadDirectors = async () => {
        setIsLoading(true);
        try {
            const contactsRef = collection(db, 'unitContacts');
            const q = query(
                contactsRef,
                where('role', '==', ContactRole.DIRECTOR)
            );
            const querySnapshot = await getDocs(q);

            const loaded = { ...initialDirectorsState };
            querySnapshot.forEach(docSnap => {
                const data = docSnap.data();
                const unit = data.unit as SchoolUnit;
                if (loaded[unit]) {
                    loaded[unit] = {
                        name: data.name || '',
                        whatsapp: data.phoneNumber || '',
                        email: data.email || '',
                        docId: docSnap.id
                    };
                }
            });
            setDirectors(loaded);
        } catch (error) {
            console.error("Erro ao carregar diretores:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePhoneChange = (unit: SchoolUnit, value: string) => {
        let val = value.replace(/\D/g, '');
        // Limit to 13 digits (55 + 2 digit area + 9 digit number)
        if (val.length > 13) val = val.substring(0, 13);
        setDirectors(prev => ({
            ...prev,
            [unit]: {
                ...prev[unit],
                whatsapp: val
            }
        }));
    };

    const handleSave = async (unit: SchoolUnit) => {
        const data = directors[unit];
        if (!data.name || !data.whatsapp) {
            alert("Nome e WhatsApp são obrigatórios!");
            return;
        }

        // WhatsApp minimum length check (e.g. 5584999999999 is 13 digits, but allow some flexibility like 10 or 11 digits if they forget country code)
        if (data.whatsapp.length < 10) {
            alert("Número de WhatsApp inválido. Digite o número completo com DDD (ex: 5584999999999).");
            return;
        }

        setSavingUnit(unit);
        try {
            const contactData = {
                unit,
                role: ContactRole.DIRECTOR,
                name: data.name,
                phoneNumber: data.whatsapp,
                email: data.email || '',
                lastUpdated: serverTimestamp()
            };

            if (data.docId) {
                // Update
                const docRef = doc(db, 'unitContacts', data.docId);
                await updateDoc(docRef, contactData);
            } else {
                // Create
                const contactsRef = collection(db, 'unitContacts');
                const newDoc = await addDoc(contactsRef, contactData);
                // Update state with new doc ID
                setDirectors(prev => ({
                    ...prev,
                    [unit]: {
                        ...prev[unit],
                        docId: newDoc.id
                    }
                }));
            }
            alert(`Configurações da Diretoria da unidade ${UNIT_LABELS[unit]} salvas com sucesso!`);
        } catch (error) {
            console.error("Erro ao salvar diretor:", error);
            alert("Erro ao salvar configurações.");
        } finally {
            setSavingUnit(null);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-950 text-white rounded-xl shadow-lg">
                        <Phone className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">WhatsApp da Diretoria</h1>
                        <p className="text-slate-500 font-medium">
                            Gerencie os números de contato dos diretores para receber mensagens do "Fale com a Escola" do App do Aluno.
                        </p>
                    </div>
                </div>
            </div>

            {/* Sync Alert Banner */}
            <div className="bg-blue-950/5 border border-blue-950/10 p-4 rounded-xl flex gap-3 items-start max-w-3xl">
                <Smartphone className="w-5 h-5 text-blue-950 shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-bold text-blue-950 text-sm mb-1">
                        Sincronização em Tempo Real
                    </h4>
                    <p className="text-xs text-blue-950/80 leading-relaxed">
                        Os números salvos abaixo são sincronizados instantaneamente com o portal do aluno.
                        O formato obrigatório deve incluir o DDI (55 para Brasil) e DDD, por exemplo: <strong className="text-blue-950">5584988277188</strong>.
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 text-blue-900 animate-spin" />
                    <p className="text-slate-500 font-semibold">Carregando contatos da diretoria...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {Object.values(SchoolUnit).map((unit) => {
                        const data = directors[unit];
                        const isSaving = savingUnit === unit;

                        return (
                            <Card key={unit} className="border-slate-200 shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden">
                                <CardContent className="p-6 space-y-6">
                                    {/* Card Title */}
                                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                        <div className="p-2 bg-blue-950/10 rounded-lg text-blue-950">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-lg text-slate-800 leading-tight">
                                                Expansivo {UNIT_LABELS[unit]}
                                            </h3>
                                            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                {unit}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Card Form */}
                                    <div className="space-y-4">
                                        {/* Name Field */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                                <User className="w-3.5 h-3.5" /> Nome do Diretor(a)
                                            </label>
                                            <Input
                                                value={data.name}
                                                onChange={(e) => setDirectors(prev => ({
                                                    ...prev,
                                                    [unit]: { ...prev[unit], name: e.target.value }
                                                }))}
                                                placeholder="Ex.: Kátia Campos"
                                                className="font-medium"
                                            />
                                        </div>

                                        {/* WhatsApp Field */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                                <Smartphone className="w-3.5 h-3.5" /> WhatsApp (Com DDD e DDI)
                                            </label>
                                            <Input
                                                value={data.whatsapp}
                                                onChange={(e) => handlePhoneChange(unit, e.target.value)}
                                                placeholder="Ex: 5584988277188"
                                                className="font-medium"
                                                maxLength={13}
                                            />
                                        </div>

                                        {/* Email Field */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                                <Mail className="w-3.5 h-3.5" /> E-mail (Opcional)
                                            </label>
                                            <Input
                                                value={data.email}
                                                onChange={(e) => setDirectors(prev => ({
                                                    ...prev,
                                                    [unit]: { ...prev[unit], email: e.target.value }
                                                }))}
                                                placeholder="Ex: diretor@expansivo.com.br"
                                                className="font-medium"
                                            />
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <div className="flex justify-end pt-2 border-t border-slate-100">
                                        <Button
                                            onClick={() => handleSave(unit)}
                                            disabled={isSaving}
                                            className="bg-blue-950 hover:bg-blue-900 text-white font-bold flex items-center gap-2 py-2.5 px-4 rounded-xl shadow-md cursor-pointer transition-all duration-200"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Salvando...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4" />
                                                    Salvar Configuração
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
