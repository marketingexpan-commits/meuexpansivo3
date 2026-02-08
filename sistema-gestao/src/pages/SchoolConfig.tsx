import { useState, useEffect } from 'react';
import { Smartphone, Save, AlertCircle, CheckCircle, Plus } from 'lucide-react';
import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { MuralDigital } from './MuralDigital'; // Assuming a named export or default fallback

interface UnitContact {
    name: string;
    address: string;
    whatsapp: string;
}

interface SchoolConfigData {
    appName: string;
    appSubtitle: string;
    logoUrl: string;
    instagramUrl: string;
    primaryColor: string; // Cor Principal (Azul)
    accentColor: string; // Cor de Destaque (Laranja)
    maintenanceMode: boolean;
    units: UnitContact[];
    contactMessage: string;
    developerMessage: string;
    copyrightText: string;
    developerName: string;
    developerUrl: string;

    // Admin System Config
    adminLogoUrl: string;
    adminPrimaryColor: string;
    adminSystemTitle: string;
    adminSystemSubtitle: string;
    adminSystemLabel: string;
    adminFooterText: string;
    adminCopyright: string;
}

const DEFAULT_CONFIG: SchoolConfigData = {
    appName: 'Meu Expansivo',
    appSubtitle: 'APLICATIVO',
    logoUrl: 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png',
    instagramUrl: 'https://www.instagram.com/redeexpansivo',
    primaryColor: '#172554', // blue-950
    accentColor: '#ea580c', // orange-600
    maintenanceMode: false,
    units: [
        {
            name: 'Expansivo Boa Sorte',
            address: 'Av. Boa Sorte, 265 - Nossa Senhora da Apresentação, Natal - RN',
            whatsapp: '5584988277188'
        },
        {
            name: 'Expansivo Extremoz',
            address: 'Rua do Futebol, 32 - Estivas, Extremoz - RN',
            whatsapp: '5584981863522'
        },
        {
            name: 'Expansivo Zona Norte',
            address: 'Rua Desportista José Augusto de Freitas, 50 - Pajuçara, Natal - RN',
            whatsapp: '5584998362024'
        },
        {
            name: 'Expansivo Quintas',
            address: 'Rua Coemaçu, 1045 - Quintas, Natal - RN',
            whatsapp: '5584999540167'
        }
    ],
    contactMessage: 'Olá, gostaria de informações sobre a escola.',
    developerMessage: 'Olá, preciso de suporte no App do Aluno.',
    copyrightText: '© 2026 Expansivo Rede de Ensino. Todos os direitos reservados.',
    developerName: 'HC Apps | 84988739180',
    developerUrl: 'https://wa.me/5584988739180',

    // Admin Defaults
    adminLogoUrl: 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png',
    adminPrimaryColor: '#172554', // blue-950
    adminSystemTitle: 'Meu Expansivo',
    adminSystemLabel: 'SISTEMA',
    adminSystemSubtitle: 'Gestão Escolar',
    adminFooterText: 'Sistema Meu Expansivo - Gestão Escolar v1.0',
    adminCopyright: '© 2026 Expansivo Rede de Ensino. Todos os direitos reservados.'
};

export const SchoolConfig = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<SchoolConfigData>(DEFAULT_CONFIG);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'admin' | 'mural'>('general');

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const docRef = doc(db, 'school_config', 'global');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as SchoolConfigData;
                // Force default units if none are saved or array is empty
                const units = (data.units && data.units.length > 0) ? data.units : DEFAULT_CONFIG.units;

                // Force default images if empty
                const logoUrl = data.logoUrl || DEFAULT_CONFIG.logoUrl;
                const adminLogoUrl = data.adminLogoUrl || DEFAULT_CONFIG.adminLogoUrl;

                setConfig({ ...DEFAULT_CONFIG, ...data, units, logoUrl, adminLogoUrl });
            }
        } catch (error) {
            console.error("Erro ao carregar configurações:", error);
            setMessage({ type: 'error', text: 'Erro ao carregar configurações.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Iniciando salvamento...");
        try {
            setSaving(true);
            setMessage(null);

            const docRef = doc(db, 'school_config', 'global');
            console.log("Definindo documento...", config);
            await setDoc(docRef, config);
            console.log("Documento salvo!");

            setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
            alert("Sucesso! Configurações salvas."); // Debug fallback
        } catch (error) {
            console.error("Erro ao salvar:", error);
            setMessage({ type: 'error', text: 'Erro ao salvar configurações: ' + error });
            alert("Erro ao salvar: " + error); // Debug fallback
        } finally {
            setSaving(false);
            console.log("Finalizado.");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-900 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto animate-fade-in-up">
            <div className="mb-8 border-b border-slate-200 pb-4 flex items-center gap-4">
                <div className="p-3 bg-blue-950/5 rounded-xl text-blue-950">
                    <Smartphone className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Configurações do App Escolar</h1>
                    <p className="text-slate-500">Personalize a aparência e comportamento do aplicativo do aluno.</p>
                </div>
            </div>

            {/* Tabs de Navegação */}
            <div className="flex items-center gap-2 mb-8 bg-slate-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'general'
                        ? 'bg-white text-blue-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    App do Aluno
                </button>
                <button
                    onClick={() => setActiveTab('admin')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'admin'
                        ? 'bg-white text-blue-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Sistema Gestão
                </button>
                <button
                    onClick={() => setActiveTab('mural')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'mural'
                        ? 'bg-white text-blue-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Mural Digital
                </button>
            </div>

            {activeTab === 'general' && (
                <>
                    {message && (
                        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            {message.text}
                        </div>
                    )}
                    <form onSubmit={handleSave} className="space-y-6">
                        {/* Identidade Visual */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                                Identidade Visual
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do App (Título)</label>
                                    <input
                                        type="text"
                                        value={config.appName}
                                        onChange={e => setConfig({ ...config, appName: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                        placeholder="Ex: Meu Expansivo"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Subtítulo (Acima do Nome)</label>
                                    <input
                                        type="text"
                                        value={config.appSubtitle}
                                        onChange={e => setConfig({ ...config, appSubtitle: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all uppercase"
                                        placeholder="Ex: APLICATIVO"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">URL da Logo (Imagem)</label>
                                    <div className="flex gap-4 items-start">
                                        <div className="w-20 h-20 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                            {config.logoUrl ? (
                                                <img src={config.logoUrl} alt="Logo App" className="w-full h-full object-contain p-2" />
                                            ) : (
                                                <Smartphone className="w-8 h-8 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={config.logoUrl}
                                                onChange={e => setConfig({ ...config, logoUrl: e.target.value })}
                                                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                                placeholder="https://..."
                                            />
                                            <p className="text-xs text-slate-500 mt-2">Recomendado: Imagem PNG com fundo transparente do App.</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Cor Principal (Mural / Títulos)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={config.primaryColor}
                                            onChange={e => setConfig({ ...config, primaryColor: e.target.value })}
                                            className="h-10 w-20 rounded cursor-pointer border-0"
                                        />
                                        <input
                                            type="text"
                                            value={config.primaryColor}
                                            onChange={e => setConfig({ ...config, primaryColor: e.target.value })}
                                            className="flex-1 p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all uppercase font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Cor de Destaque (Botão Acessar)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={config.accentColor}
                                            onChange={e => setConfig({ ...config, accentColor: e.target.value })}
                                            className="h-10 w-20 rounded cursor-pointer border-0"
                                        />
                                        <input
                                            type="text"
                                            value={config.accentColor}
                                            onChange={e => setConfig({ ...config, accentColor: e.target.value })}
                                            className="flex-1 p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all uppercase font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contato e Links */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                                Links e Contato
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Instagram (URL)</label>
                                    <input
                                        type="text"
                                        value={config.instagramUrl}
                                        onChange={e => setConfig({ ...config, instagramUrl: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                        placeholder="https://instagram.com/..."
                                    />
                                </div>

                            </div>
                        </div>

                        {/* Contatos das Unidades */}
                        {/* Contatos das Unidades */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Contatos das Unidades</h2>
                                <button
                                    type="button"
                                    onClick={() => setConfig({ ...config, units: [...(config.units || []), { name: '', address: '', whatsapp: '' }] })}
                                    className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors flex items-center"
                                >
                                    <Plus className="w-4 h-4 mr-1.5" /> Adicionar Unidade
                                </button>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Mensagem Automática (Fale Conosco)
                                </label>
                                <input
                                    type="text"
                                    value={config.contactMessage}
                                    onChange={(e) => setConfig({ ...config, contactMessage: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-600"
                                    placeholder="Ex: Olá, gostaria de informações sobre a escola."
                                />
                                <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    <span className="font-semibold text-slate-700">Prévia da mensagem: </span>
                                    "{config.contactMessage || 'Olá, gostaria de informações.'}"
                                </div>
                            </div>

                            {(!config.units || config.units.length === 0) ? (
                                <p className="text-slate-500 text-sm italic text-center py-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                    Nenhuma unidade cadastrada. Adicione para exibir no 'Fale Conosco'.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {config.units.map((unit, index) => (
                                        <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative group">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newUnits = config.units.filter((_, i) => i !== index);
                                                    setConfig({ ...config, units: newUnits });
                                                }}
                                                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1"
                                                title="Remover Unidade"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-1">
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nome da Unidade</label>
                                                    <input
                                                        type="text"
                                                        value={unit.name}
                                                        onChange={e => {
                                                            const newUnits = [...config.units];
                                                            newUnits[index] = { ...unit, name: e.target.value };
                                                            setConfig({ ...config, units: newUnits });
                                                        }}
                                                        className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none text-sm font-semibold"
                                                        placeholder="Ex: Expansivo Zona Norte"
                                                    />
                                                </div>
                                                <div className="md:col-span-1">
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">WhatsApp (apenas números)</label>
                                                    <input
                                                        type="text"
                                                        value={unit.whatsapp}
                                                        onChange={e => {
                                                            const newUnits = [...config.units];
                                                            newUnits[index] = { ...unit, whatsapp: e.target.value };
                                                            setConfig({ ...config, units: newUnits });
                                                        }}
                                                        className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none text-sm"
                                                        placeholder="Ex: 5584999999999"
                                                    />
                                                </div>
                                                <div className="md:col-span-3">
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Endereço</label>
                                                    <input
                                                        type="text"
                                                        value={unit.address}
                                                        onChange={e => {
                                                            const newUnits = [...config.units];
                                                            newUnits[index] = { ...unit, address: e.target.value };
                                                            setConfig({ ...config, units: newUnits });
                                                        }}
                                                        className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none text-sm"
                                                        placeholder="Ex: Av. Boa Sorte, 265..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Rodapé e Créditos */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                                Rodapé e Créditos
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Texto de Copyright</label>
                                    <input
                                        type="text"
                                        value={config.copyrightText}
                                        onChange={e => setConfig({ ...config, copyrightText: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                        placeholder="© 2026 Sua Escola..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Desenvolvedor</label>
                                    <input
                                        type="text"
                                        value={config.developerName}
                                        onChange={e => setConfig({ ...config, developerName: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                        placeholder="HC Apps"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Link do Desenvolvedor</label>
                                    <input
                                        type="text"
                                        value={config.developerUrl}
                                        onChange={e => setConfig({ ...config, developerUrl: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Mensagem do Desenvolvedor</label>
                                    <input
                                        type="text"
                                        value={config.developerMessage}
                                        onChange={e => setConfig({ ...config, developerMessage: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                        placeholder="Ex: Olá, preciso de suporte no App."
                                    />
                                    <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        <span className="font-semibold text-slate-700">Prévia da mensagem: </span>
                                        "{config.developerMessage || 'Olá, preciso de suporte.'}"
                                    </div>
                                </div>
                            </div>
                        </div >

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                                Avançado
                            </h2>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={config.maintenanceMode}
                                    onChange={e => setConfig({ ...config, maintenanceMode: e.target.checked })}
                                    className="w-5 h-5 text-blue-950 rounded border-slate-300 focus:ring-blue-950 transition-all cursor-pointer"
                                />
                                <div>
                                    <span className="block font-bold text-slate-800 group-hover:text-blue-950 transition-colors">Modo Manutenção</span>
                                    <span className="text-xs text-slate-500">Se ativado, o app exibirá uma tela de aviso e bloqueará o acesso.</span>
                                </div>
                            </label>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 bg-blue-950 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-900 transition-all shadow-lg shadow-blue-950/20 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        Salvar Configurações
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </>
            )}

            {activeTab === 'admin' && (
                <>
                    {message && (
                        <div className={`p-4 rounded-xl mb-6 flex items-center ${message.type === 'success' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                            {message.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
                            {message.text}
                        </div>
                    )}
                    <form onSubmit={handleSave} className="space-y-6">
                        {/* Identidade Visual do Sistema */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                                Identidade Visual do Sistema
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Logo do Sistema (URL)</label>
                                    <div className="flex gap-4 items-start">
                                        <div className="w-20 h-20 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                            {config.adminLogoUrl ? (
                                                <img src={config.adminLogoUrl} alt="Logo Admin" className="w-full h-full object-contain p-2" />
                                            ) : (
                                                <Smartphone className="w-8 h-8 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={config.adminLogoUrl}
                                                onChange={e => setConfig({ ...config, adminLogoUrl: e.target.value })}
                                                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                                placeholder="https://..."
                                            />
                                            <p className="text-xs text-slate-500 mt-2">Recomendado: Imagem PNG com fundo transparente.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Pré-Título</label>
                                        <input
                                            type="text"
                                            value={config.adminSystemLabel}
                                            onChange={e => setConfig({ ...config, adminSystemLabel: e.target.value })}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all uppercase"
                                            placeholder="Ex: SISTEMA"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Título do Sistema</label>
                                        <input
                                            type="text"
                                            value={config.adminSystemTitle}
                                            onChange={e => setConfig({ ...config, adminSystemTitle: e.target.value })}
                                            className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                            placeholder="Ex: Meu Expansivo"
                                        />
                                    </div>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Subtítulo</label>
                                    <input
                                        type="text"
                                        value={config.adminSystemSubtitle}
                                        onChange={e => setConfig({ ...config, adminSystemSubtitle: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                        placeholder="Ex: Gestão Escolar"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Cores e Estilo */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                                Cores e Estilo
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Cor Principal (Admin)</label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            value={config.adminPrimaryColor}
                                            onChange={e => setConfig({ ...config, adminPrimaryColor: e.target.value })}
                                            className="w-12 h-12 rounded-xl cursor-pointer border-0 p-0 shadow-sm"
                                        />
                                        <input
                                            type="text"
                                            value={config.adminPrimaryColor}
                                            onChange={e => setConfig({ ...config, adminPrimaryColor: e.target.value })}
                                            className="flex-1 p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none uppercase"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rodapé do Sistema */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                                Roda­pé e Créditos
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Texto de Rodapé (Versão)</label>
                                    <input
                                        type="text"
                                        value={config.adminFooterText}
                                        onChange={e => setConfig({ ...config, adminFooterText: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                        placeholder="Ex: Sistema de Gestão Escolar v1.0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Texto de Copyright</label>
                                    <input
                                        type="text"
                                        value={config.adminCopyright}
                                        onChange={e => setConfig({ ...config, adminCopyright: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                        placeholder="© 2026..."
                                    />
                                </div>
                            </div>

                            <h3 className="text-sm font-bold text-slate-600 mb-3 border-t border-slate-100 pt-4">Desenvolvedor</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Nome do Desenvolvedor</label>
                                    <input
                                        type="text"
                                        value={config.developerName}
                                        onChange={e => setConfig({ ...config, developerName: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                        placeholder="HC Apps"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Link do Desenvolvedor</label>
                                    <input
                                        type="text"
                                        value={config.developerUrl}
                                        onChange={e => setConfig({ ...config, developerUrl: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Mensagem do Desenvolvedor</label>
                                    <input
                                        type="text"
                                        value={config.developerMessage}
                                        onChange={e => setConfig({ ...config, developerMessage: e.target.value })}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                        placeholder="Ex: Olá, preciso de suporte no App."
                                    />
                                    <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        <span className="font-semibold text-slate-700">Prévia da mensagem: </span>
                                        "{config.developerMessage || 'Olá, preciso de suporte.'}"
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </>
            )}

            {
                activeTab === 'mural' && (
                    <div className="animate-fade-in">
                        <MuralDigital />
                    </div>
                )
            }
        </div >
    );
};
