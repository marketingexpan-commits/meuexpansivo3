
import { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { SchoolUnit, ContactRole } from '../types';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Save, Smartphone, Mail, User, MessageCircle, UserCog } from 'lucide-react';

interface UnitContactSettings {
    responsibleName: string;
    whatsapp: string;
    email: string;
    defaultMessage: string;
    docId: string | null;
}

const DEFAULT_MESSAGE = "Olá, estou enviando o comprovante de pagamento.";

export function FinanceiroConfig() {
    const [selectedUnit, setSelectedUnit] = useState<SchoolUnit>(SchoolUnit.UNIT_3); // Default fallback
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [userRole, setUserRole] = useState<string>(''); // 'admin_geral' or unit code

    const [settings, setSettings] = useState<UnitContactSettings>({
        responsibleName: '',
        whatsapp: '',
        email: '',
        defaultMessage: DEFAULT_MESSAGE,
        docId: null
    });

    // Check Permissions on Mount
    useEffect(() => {
        const storedUnit = localStorage.getItem('userUnit');
        setUserRole(storedUnit || '');

        if (storedUnit && storedUnit !== 'admin_geral') {
            // Map login unit code to SchoolUnit enum
            let unitToSelect: SchoolUnit | undefined;
            switch (storedUnit) {
                case 'unit_zn': unitToSelect = SchoolUnit.UNIT_3; break; // Zona Norte
                case 'unit_bs': unitToSelect = SchoolUnit.UNIT_1; break; // Boa Sorte
                case 'unit_ext': unitToSelect = SchoolUnit.UNIT_2; break; // Extremoz
                case 'unit_qui': unitToSelect = SchoolUnit.UNIT_4; break; // Quintas
            }
            if (unitToSelect) setSelectedUnit(unitToSelect);
        }
    }, []); // Run once on mount

    // Load data from Firestore (unitContacts collection)
    const loadData = async () => {
        setIsLoading(true);
        try {
            const contactsRef = collection(db, 'unitContacts');
            const q = query(
                contactsRef,
                where('unit', '==', selectedUnit),
                where('role', '==', ContactRole.FINANCIAL)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docData = querySnapshot.docs[0].data();
                setSettings({
                    responsibleName: docData.name || '',
                    whatsapp: docData.phoneNumber || '',
                    email: docData.email || '',
                    defaultMessage: docData.defaultMessage || DEFAULT_MESSAGE,
                    docId: querySnapshot.docs[0].id // Store docId for updates
                });
            } else {
                // Default if not found
                setSettings({
                    responsibleName: '',
                    whatsapp: '',
                    email: '',
                    defaultMessage: DEFAULT_MESSAGE,
                    docId: null
                });
            }
        } catch (error) {
            console.error("Error loading settings:", error);
            // Fallback
            setSettings({
                responsibleName: '',
                whatsapp: '',
                email: '',
                defaultMessage: DEFAULT_MESSAGE,
                docId: null
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedUnit]);

    const handleSave = async () => {
        if (!settings.responsibleName || !settings.whatsapp) {
            alert("Nome e WhatsApp são obrigatórios!");
            return;
        }

        setIsSaving(true);
        try {
            const contactData = {
                unit: selectedUnit,
                role: ContactRole.FINANCIAL,
                name: settings.responsibleName,
                phoneNumber: settings.whatsapp,
                email: settings.email,
                defaultMessage: settings.defaultMessage,
                lastUpdated: serverTimestamp()
            };

            if (settings.docId) {
                // Update existing
                const docRef = doc(db, 'unitContacts', settings.docId);
                await updateDoc(docRef, contactData);
            } else {
                // Create new
                const contactsRef = collection(db, 'unitContacts');
                await addDoc(contactsRef, contactData);
            }

            alert("Configurações salvas com sucesso!");
            loadData(); // Refresh to get ensuring docId is set if it was a new doc (loadData handles fetching again)
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Erro ao salvar configurações.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        // Limit to 13 digits (55 + 2 digit area + 9 digit number)
        if (val.length > 13) val = val.substring(0, 13);
        setSettings(prev => ({ ...prev, whatsapp: val }));
    };

    // ...

    <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5" /> WhatsApp (Com DDD)
        </label>
        <Input
            value={settings.whatsapp}
            onChange={handlePhoneChange}
            placeholder="Ex: 5584999999999"
            className="font-medium"
            maxLength={13}
        />
    </div>





    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-950 text-white rounded-xl shadow-lg">
                    <UserCog className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Responsável Financeiro</h1>
                    <p className="text-slate-500 font-medium">
                        {userRole === 'admin_geral'
                            ? "Gerencie contatos e mensagens automáticas de todas as unidades."
                            : "Mantenha os canais de atendimento da sua unidade sempre atualizados."
                        }
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    {/* Unit Selector - Only for General Admin */}
                    {userRole === 'admin_geral' && (
                        <Card className="border-slate-200 shadow-sm">
                            <CardContent className="p-6">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">
                                    Selecione a Unidade
                                </label>
                                <div className="space-y-2">
                                    {Object.values(SchoolUnit).map((unit) => (
                                        <button
                                            key={unit}
                                            onClick={() => setSelectedUnit(unit)}
                                            className={`w-full text-left px-4 py-3 rounded-xl transition-all font-bold text-sm flex items-center justify-between ${selectedUnit === unit
                                                ? 'bg-blue-950/10 text-blue-950 ring-2 ring-blue-950/20'
                                                : 'text-slate-500 hover:bg-slate-50'
                                                }`}
                                        >
                                            <span>{unit}</span>
                                            {selectedUnit === unit && <div className="w-2 h-2 rounded-full bg-blue-950"></div>}
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="bg-blue-950/5 border border-blue-950/10 p-4 rounded-xl">
                        <h4 className="font-bold text-blue-950 flex items-center gap-2 text-sm mb-2">
                            <Smartphone className="w-4 h-4" />
                            Sincronização
                        </h4>
                        <p className="text-xs text-blue-950/80 leading-relaxed">
                            As alterações feitas aqui são atualizadas automaticamente no
                            <strong className="text-blue-950"> App do Aluno</strong>.
                            Verifique os dados com atenção antes de salvar.
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <Card className="border-slate-200 shadow-md relative overflow-hidden">
                        {isLoading && (
                            <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center backdrop-blur-sm">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-950"></div>
                            </div>
                        )}
                        <CardContent className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-2 h-8 bg-blue-950 rounded-full block"></span>
                                    Dados de Contato
                                </h3>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                            <User className="w-3.5 h-3.5" /> Nome do Responsável
                                        </label>
                                        <Input
                                            value={settings.responsibleName}
                                            onChange={(e) => setSettings({ ...settings, responsibleName: e.target.value })}
                                            placeholder="Ex: Financeiro Central"
                                            className="font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                            <Smartphone className="w-3.5 h-3.5" /> WhatsApp (Com DDD)
                                        </label>
                                        <Input
                                            value={settings.whatsapp}
                                            onChange={handlePhoneChange}
                                            placeholder="Ex: 5584999999999"
                                            className="font-medium"
                                            maxLength={13}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <Mail className="w-3.5 h-3.5" /> E-mail de Contato
                                    </label>
                                    <Input
                                        value={settings.email}
                                        onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                                        placeholder="Ex: contato.unidade@escola.com.br"
                                        className="font-medium"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <MessageCircle className="w-3.5 h-3.5" /> Mensagem Padrão (WhatsApp)
                                    </label>
                                    <textarea
                                        value={settings.defaultMessage}
                                        onChange={(e) => setSettings({ ...settings, defaultMessage: e.target.value })}
                                        placeholder="Digite a mensagem padrão que aparecerá ao clicar no botão do WhatsApp"
                                        className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20 outline-none transition-all text-sm min-h-[100px] resize-y font-medium text-slate-700 bg-slate-50 focus:bg-white"
                                    />
                                    <p className="text-[10px] text-slate-400 text-right">
                                        Mensagem pré-preenchida no WhatsApp do aluno.
                                    </p>
                                </div>

                                <div className="pt-6 border-t border-slate-100 flex justify-end">
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="bg-blue-950 hover:bg-black text-white px-8 py-3 rounded-xl shadow-lg shadow-blue-900/20 flex items-center gap-2 font-bold transition-all hover:scale-105 active:scale-95"
                                    >
                                        {isSaving ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Salvando...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" />
                                                Salvar Configurações
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
