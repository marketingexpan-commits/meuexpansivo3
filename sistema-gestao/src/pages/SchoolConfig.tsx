import { useState, useEffect } from 'react';
import { Smartphone, Save, AlertCircle, CheckCircle, Plus } from 'lucide-react';
import { db, storage } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MuralDigital } from './MuralDigital';
import { LegalTermsManager } from '../components/LegalTermsManager';
import { Upload, Loader2 } from 'lucide-react';

// Função auxiliar para recortar bordas transparentes e fundos brancos (TRIM) de logotipos
const trimCanvas = (img: HTMLImageElement): HTMLImageElement | HTMLCanvasElement => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return img;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let top = canvas.height, left = canvas.width, bottom = 0, right = 0;
        let hasVisiblePixel = false;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const idx = (y * canvas.width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const alpha = data[idx + 3];

                // Removemos transparências falsas e também o "fundo branco" que algumas logos possuem
                const isWhite = r > 240 && g > 240 && b > 240;
                
                if (alpha > 10 && !isWhite) {
                    hasVisiblePixel = true;
                    if (x < left) left = x;
                    if (x > right) right = x;
                    if (y < top) top = y;
                    if (y > bottom) bottom = y;
                }
            }
        }

        if (!hasVisiblePixel || right < left || bottom < top) return img;

        const trimmedCanvas = document.createElement('canvas');
        const trimmedCtx = trimmedCanvas.getContext('2d');
        const trimmedWidth = right - left + 1;
        const trimmedHeight = bottom - top + 1;

        trimmedCanvas.width = trimmedWidth;
        trimmedCanvas.height = trimmedHeight;
        trimmedCtx?.drawImage(canvas, left, top, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);

        return trimmedCanvas;
    } catch (e) {
        // Se houver erro de Cross-Origin (CORS) ou manipulação, devolva a imagem segura
        console.warn('Trim canvas falhou (CORS/Tainted). Retornando imagem original.', e);
        return img;
    }
};

interface UnitContact {
    name: string;
    address: string;
    whatsapp: string;
}

interface SchoolConfigData {
    appName: string;
    appSubtitle: string;
    logoUrl: string;
    logoSize?: number;
    coverMode?: 'default' | 'image';
    coverImageUrl?: string;
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
    secretClickArea?: 'left' | 'right' | 'total';
    appShortName?: string;
    appIconUrl?: string;
    appFaviconUrl?: string;
    appIconRotation?: number;
    appIconSize?: number;
    appPwaIconSize?: number;
    appIconBgColor?: string;
}

const DEFAULT_CONFIG: SchoolConfigData = {
    appName: '',
    appSubtitle: 'APLICATIVO',
    logoUrl: 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png',
    logoSize: 80,
    coverMode: 'default',
    coverImageUrl: '',
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
    adminLogoUrl: '',
    adminPrimaryColor: '#172554', // blue-950
    adminSystemTitle: 'Sistema Escolar',
    adminSystemLabel: 'SISTEMA',
    adminSystemSubtitle: 'Gestão Escolar',
    adminFooterText: 'Sistema Escolar v1.0',
    adminCopyright: '© 2026 Todos os direitos reservados.',
    secretClickArea: 'right',
    appShortName: '',
    appIconUrl: '',
    appFaviconUrl: '',
    appIconRotation: 0,
    appIconSize: 110,
    appPwaIconSize: 85,
    appIconBgColor: '#FFFFFF'
};

export const SchoolConfig = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<SchoolConfigData>(DEFAULT_CONFIG);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
    const [iconCanvasRef, setIconCanvasRef] = useState<HTMLCanvasElement | null>(null);
    const [originalIconImg, setOriginalIconImg] = useState<HTMLImageElement | null>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'admin' | 'mural' | 'terms'>('general');

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

    // Efeito para carregar o ícone atual na memória (para permitir redimensionamento de ícones já salvos)
    useEffect(() => {
        if (config.appIconUrl && !originalIconImg && config.appIconUrl.startsWith('http')) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = config.appIconUrl;
            img.onload = () => setOriginalIconImg(img);
        }
    }, [config.appIconUrl]);

    const [uploadingIcon, setUploadingIcon] = useState(false);

    // Função para processar a imagem no Canvas com o tamanho atual do slider
    const processIcon = (img: HTMLImageElement, pwaSize: number, pwaBgColor?: string) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const size = 512;
        canvas.width = size;
        canvas.height = size;

        if (ctx) {
            // Recortar bordas vazias da imagem antes de desenhar
            const trimmedImg = trimCanvas(img);
            const iw = trimmedImg.width;
            const ih = trimmedImg.height;

            // Aplicar Cor de Fundo selecionada (ou Branco como fallback)
            ctx.fillStyle = pwaBgColor || '#FFFFFF';
            ctx.fillRect(0, 0, size, size);

            // Cálculo de enquadramento baseado no slider de porcentagem (0-100%)
            const margin = (100 - pwaSize) / 100;
            const innerSize = size * (1 - margin);

            const scale = Math.min(innerSize / iw, innerSize / ih);
            const w = iw * scale;
            const h = ih * scale;
            const x = (size - w) / 2;
            const y = (size - h) / 2;

            ctx.drawImage(trimmedImg, x, y, w, h);

            try {
                // Preview Instantâneo (DataURL)
                const previewUrl = canvas.toDataURL('image/png');
                setIconPreviewUrl(previewUrl);
                setIconCanvasRef(canvas);
            } catch (e) {
                console.warn("Navegador bloqueou preview do canvas em tempo real devido a CORS. O ícone ainda será salvo ao clicar em 'Salvar'.", e);
            }
        }
    };

    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingIcon(true);
        try {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = objectUrl;
            });

            setOriginalIconImg(img);
            processIcon(img, config.appPwaIconSize || 85);

        } catch (error) {
            console.error("Erro ao carregar ícone:", error);
            alert("Erro ao carregar imagem.");
        } finally {
            setUploadingIcon(false);
            if (e.target) e.target.value = '';
        }
    };

    // Efeito para atualizar o Ícone EM TEMPO REAL quando o slider ou a COR mudarem
    useEffect(() => {
        if (originalIconImg) {
            processIcon(originalIconImg, config.appPwaIconSize || 85, config.appIconBgColor || '#FFFFFF');
        }
    }, [config.appPwaIconSize, config.appIconBgColor, originalIconImg]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            setMessage(null);

            let finalConfig = { ...config };

            // Se o usuário ajustou o ícone (tem um novo canvas em memória), enviamos para o Storage AGORA no clique do Salvar Geral
            if (iconCanvasRef) {
                const blob = await new Promise<Blob | null>(resolve => iconCanvasRef.toBlob(resolve, 'image/png'));
                if (blob) {
                    const storagePath = `mural/app_icons/icon_${Date.now()}.png`;
                    const storageRef = ref(storage, storagePath);
                    const snapshot = await uploadBytes(storageRef, blob);
                    const downloadUrl = await getDownloadURL(snapshot.ref);
                    finalConfig.appIconUrl = downloadUrl;
                }
            }

            const docRef = doc(db, 'school_config', 'global');
            await setDoc(docRef, finalConfig);

            setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
            alert("Sucesso! Configurações salvas.");

            // Limpar estados temporários para não re-enviar no próximo save
            setIconCanvasRef(null);
            setOriginalIconImg(null);

        } catch (error) {
            console.error("Erro ao salvar:", error);
            setMessage({ type: 'error', text: 'Erro ao salvar: ' + error });
        } finally {
            setSaving(false);
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
                <button
                    onClick={() => setActiveTab('terms')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'terms'
                        ? 'bg-white text-blue-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Termos de Aceite
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

                                <div className="md:col-span-2 mt-2 pt-4 border-t border-slate-100">
                                    <label className="block text-sm font-semibold text-slate-700 mb-3">Modo de Exibição da Capa do App</label>
                                    <div className="flex gap-4 mb-4">
                                        <label className={`flex-1 flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${config.coverMode !== 'image' ? 'border-blue-950 bg-blue-50/50 text-blue-950 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                            <input
                                                type="radio"
                                                name="coverMode"
                                                checked={config.coverMode !== 'image'}
                                                onChange={() => setConfig({ ...config, coverMode: 'default' })}
                                                className="w-4 h-4 text-blue-950 focus:ring-blue-950 cursor-pointer"
                                            />
                                            <span className="font-semibold text-sm">Logo + Texto (Padrão)</span>
                                        </label>
                                        <label className={`flex-1 flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${config.coverMode === 'image' ? 'border-blue-950 bg-blue-50/50 text-blue-950 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                            <input
                                                type="radio"
                                                name="coverMode"
                                                checked={config.coverMode === 'image'}
                                                onChange={() => setConfig({ ...config, coverMode: 'image' })}
                                                className="w-4 h-4 text-blue-950 focus:ring-blue-950 cursor-pointer"
                                            />
                                            <span className="font-semibold text-sm">Anexo de Imagem (PNG Direto)</span>
                                        </label>
                                    </div>

                                    {config.coverMode !== 'image' ? (
                                        <div className="flex gap-4 items-start bg-slate-50 p-4 rounded-xl border border-slate-100 animate-fade-in">
                                            <div className="w-20 h-20 bg-white rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                                {config.logoUrl ? (
                                                    <img src={config.logoUrl} alt="Logo App" className="w-full h-full object-contain p-2" />
                                                ) : (
                                                    <Smartphone className="w-8 h-8 text-slate-300" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">URL da Logo (Minimizada ao lado do Título)</label>
                                                <input
                                                    type="text"
                                                    value={config.logoUrl}
                                                    onChange={e => setConfig({ ...config, logoUrl: e.target.value })}
                                                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all"
                                                    placeholder="https://..."
                                                />
                                                <p className="text-xs text-slate-500 mt-2">Recomendado: Imagem PNG com fundo transparente do App.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-4 items-start bg-blue-50/50 p-4 rounded-xl border border-blue-100 animate-fade-in">
                                            <div className="w-20 h-20 bg-white rounded-xl border border-blue-200 flex items-center justify-center overflow-hidden shrink-0">
                                                {config.coverImageUrl ? (
                                                    <img src={config.coverImageUrl} alt="Imagem da Capa" className="w-full h-full object-contain p-2" />
                                                ) : (
                                                    <Smartphone className="w-8 h-8 text-blue-300" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-blue-900 mb-1">URL da Imagem de Capa (PNG Direto)</label>
                                                <input
                                                    type="text"
                                                    value={config.coverImageUrl || ''}
                                                    onChange={e => setConfig({ ...config, coverImageUrl: e.target.value })}
                                                    className="w-full p-2.5 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none transition-all placeholder-blue-300"
                                                    placeholder="https://..."
                                                />
                                                <p className="text-xs text-blue-600 mt-2">Esta imagem substituirá completamente a logo e o texto na capa do aplicativo.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* SLIDER E PREVIEW DE TAMANHO */}
                                    <div className="mt-6 border-t border-slate-100 pt-6">
                                        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                                            {/* Regulador */}
                                            <div className="flex-1 w-full bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-800">Tamanho do Logotipo</label>
                                                        <p className="text-xs text-slate-500 mt-1">Ajuste a altura da imagem na tela inicial.</p>
                                                    </div>
                                                    <span className="text-sm font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded-lg border border-blue-200">{config.logoSize || 80}px</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="40"
                                                    max="240"
                                                    step="5"
                                                    value={config.logoSize || 80}
                                                    onChange={e => setConfig({ ...config, logoSize: parseInt(e.target.value) })}
                                                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 transition-all hover:accent-blue-700"
                                                />
                                                <div className="flex justify-between text-xs text-slate-400 mt-3 font-semibold px-1">
                                                    <span>Min (40px)</span>
                                                    <span>Original (80px)</span>
                                                    <span>Max (240px)</span>
                                                </div>

                                                {/* ÁREA DO CLIQUE SECRETO */}
                                                <div className="mt-8 pt-6 border-t border-slate-200">
                                                    <label className="block text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                        Local do Clique Mágico (Segredo)
                                                    </label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {[
                                                            { id: 'left', label: 'Esquerda' },
                                                            { id: 'right', label: 'Direita' },
                                                            { id: 'total', label: 'Toda a Logo' }
                                                        ].map((item) => (
                                                            <button
                                                                key={item.id}
                                                                type="button"
                                                                onClick={() => setConfig({ ...config, secretClickArea: item.id as any })}
                                                                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border ${(config.secretClickArea || 'right') === item.id
                                                                        ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                                                                        : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                                                                    }`}
                                                            >
                                                                {item.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] text-blue-600/70 mt-3 italic">
                                                        * Define onde o usuário deve clicar 5x para abrir os menus de coordenação.
                                                    </p>
                                                </div>

                                                {/* CONFIGURAÇÃO PWA (ÍCONE E NOME) */}
                                                <div className="mt-8 pt-6 border-t border-slate-200">
                                                    <label className="block text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                                        Personalização da Tela de Início (PWA)
                                                    </label>

                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome abaixo do Ícone</label>
                                                            <input
                                                                type="text"
                                                                value={config.appShortName || ''}
                                                                onChange={e => setConfig({ ...config, appShortName: e.target.value })}
                                                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none"
                                                                placeholder="Ex: App Aluno"
                                                            />
                                                            <p className="text-[9px] text-slate-400 mt-1">O nome que aparece na tela do celular (máx. 12 carac.).</p>
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Ícone do Aplicativo (PNG)</label>

                                                            <div className="flex items-center gap-3">
                                                                <div className="relative group">
                                                                    <input
                                                                        type="file"
                                                                        id="app-icon-upload"
                                                                        className="hidden"
                                                                        accept="image/png, image/jpeg"
                                                                        onChange={handleIconUpload}
                                                                        disabled={uploadingIcon}
                                                                    />
                                                                    <label
                                                                        htmlFor="app-icon-upload"
                                                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-sm ${uploadingIcon
                                                                                ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                                                                                : 'bg-white text-blue-900 border-blue-100 hover:bg-blue-50 active:scale-95'
                                                                            }`}
                                                                    >
                                                                        {uploadingIcon ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <Upload className="w-4 h-4" />
                                                                        )}
                                                                        {uploadingIcon ? 'Processando...' : 'Selecionar PNG'}
                                                                    </label>
                                                                </div>

                                                                {config.appIconUrl && (
                                                                    <div className="flex items-center gap-3 animate-fade-in">
                                                                        <div className="text-[9px] text-green-600 font-bold flex items-center gap-1 bg-green-50 px-2 py-1 rounded-lg border border-green-100 h-fit">
                                                                            <CheckCircle className="w-3 h-3" /> Ícone Pronto
                                                                        </div>

                                                                        {/* Preview do Ícone PWA (GIGANTE para melhor conferência) */}
                                                                        <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                                                                            <div className="w-20 h-20 bg-white rounded-[1.3rem] shadow-lg border border-slate-200 overflow-hidden flex items-center justify-center p-0 transition-all hover:scale-105 active:scale-95">
                                                                                <img
                                                                                    src={iconPreviewUrl || config.appIconUrl}
                                                                                    alt="App Icon"
                                                                                    className="w-full h-full object-contain transition-transform"
                                                                                />
                                                                            </div>
                                                                            <span className="text-[10px] font-bold text-slate-600 truncate max-w-[80px] text-center leading-tight tracking-tight uppercase">{config.appShortName || 'App do Aluno'}</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-col gap-4 mt-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                                                        Cor de Fundo do Ícone
                                                                    </span>
                                                                    <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                                                                        <input
                                                                            type="color"
                                                                            value={config.appIconBgColor || '#FFFFFF'}
                                                                            onChange={e => setConfig({ ...config, appIconBgColor: e.target.value })}
                                                                            className="w-5 h-5 rounded-md border-none cursor-pointer bg-transparent"
                                                                        />
                                                                        <span className="text-[9px] font-mono font-bold text-slate-600 uppercase tabular-nums">
                                                                            {config.appIconBgColor || '#FFFFFF'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <div className="flex justify-between items-center mb-1">
                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                                            Tamanho da Logo no Ícone
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded leading-none">
                                                                            {config.appPwaIconSize || 85}%
                                                                        </span>
                                                                    </div>
                                                                    <input
                                                                        type="range"
                                                                        min="50"
                                                                        max="100"
                                                                        value={config.appPwaIconSize ?? 85}
                                                                        onChange={e => setConfig({ ...config, appPwaIconSize: parseInt(e.target.value) })}
                                                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <p className="text-[9px] text-slate-400 mt-2 italic">
                                                                * Envie qualquer logotipo. O sistema cuidará do enquadramento automático profissional.
                                                            </p>
                                                        </div>

                                                        {/* Simulador de Aba de Navegador (PREVIEW REAL) */}
                                                        <div className="mb-6 p-4 bg-slate-100/50 rounded-xl border border-slate-200">
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest text-center">
                                                                Simulador de Aba do Navegador
                                                            </label>

                                                            <div className="w-full h-8 bg-[#dee1e6] rounded-t-lg flex items-end px-2 gap-1 overflow-hidden">
                                                                {/* Tab Ativa */}
                                                                <div className="bg-white h-7 px-3 rounded-t-lg min-w-[140px] flex items-center gap-2 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] relative">
                                                                    <div className="w-4 h-4 flex items-center justify-center overflow-hidden shrink-0">
                                                                        <img
                                                                            src={config.appFaviconUrl || iconPreviewUrl || config.appIconUrl || 'https://i.postimg.cc/8PzXrtS3/favicon-placeholder.png'}
                                                                            alt="Tab Icon"
                                                                            className="transition-all"
                                                                            style={{
                                                                                transform: `rotate(${config.appIconRotation || 0}deg) scale(${(config.appIconSize || 110) / 110})`,
                                                                                width: '100%',
                                                                                height: '100%',
                                                                                objectFit: 'contain'
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-[10px] text-slate-700 truncate font-medium">
                                                                        {config.appShortName || config.appName || 'App do Aluno'}
                                                                    </span>
                                                                    <div className="ml-auto w-3 h-3 hover:bg-slate-100 rounded-full flex items-center justify-center text-[8px] text-slate-400">✕</div>
                                                                </div>
                                                                {/* Tab Inativa */}
                                                                <div className="h-6 px-3 rounded-t-md min-w-[100px] flex items-center gap-2 opacity-40">
                                                                    <div className="w-3 h-3 bg-slate-400 rounded-sm"></div>
                                                                    <div className="w-12 h-1.5 bg-slate-400 rounded-full"></div>
                                                                </div>
                                                            </div>
                                                            <div className="w-full h-1 bg-white shadow-sm"></div>
                                                        </div>

                                                        {/* Campo Independente para Favicon (Aba do Navegador) */}
                                                        <div className="pt-4 border-t border-slate-100">
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                                                Favicon da Aba do Navegador (URL - Transparente)
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={config.appFaviconUrl || ''}
                                                                onChange={e => setConfig({ ...config, appFaviconUrl: e.target.value })}
                                                                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-950/20 focus:border-blue-950 outline-none"
                                                                placeholder="https://i.postimg.cc/..."
                                                            />
                                                            <p className="text-[9px] text-slate-400 mt-2 italic">
                                                                * Use uma URL de logotipo com fundo transparente (ex: Postimg). Este ícone aparecerá apenas na aba do Chrome/Safari.
                                                            </p>
                                                        </div>

                                                        {/* Campo de Rotação do Favicon */}
                                                        {/* Campo de Rotação do Favicon */}
                                                        <div className="pt-4 border-t border-slate-100">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                                                    Rotação do Favicon
                                                                </label>
                                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded leading-none">
                                                                    {config.appIconRotation || 0}°
                                                                </span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="360"
                                                                value={config.appIconRotation ?? 0}
                                                                onChange={e => setConfig({ ...config, appIconRotation: parseInt(e.target.value) })}
                                                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                            />
                                                            <p className="text-[9px] text-slate-400 mt-1 italic">
                                                                * Ajuste para inclinar a logo na aba do navegador. (Padrão: 0°)
                                                            </p>
                                                        </div>

                                                        {/* Campo de Tamanho do Favicon */}
                                                        <div className="pt-4 border-t border-slate-100">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                                                    Tamanho do Favicon
                                                                </label>
                                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded leading-none">
                                                                    {config.appIconSize || 110}px
                                                                </span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="50"
                                                                max="128"
                                                                value={config.appIconSize ?? 110}
                                                                onChange={e => setConfig({ ...config, appIconSize: parseInt(e.target.value) })}
                                                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                            />
                                                            <p className="text-[9px] text-slate-400 mt-1 italic">
                                                                * Aumente para preencher melhor o espaço da aba do navegador. (Padrão: 110px)
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Preview Mockup */}
                                            <div className="w-full md:w-56 shrink-0 flex flex-col items-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Preview Real
                                                </span>


                                                <div className="w-full aspect-[9/16] max-w-[180px] bg-slate-50 border-4 border-slate-800 rounded-[2rem] shadow-xl overflow-hidden relative flex flex-col">
                                                    <div className="h-4 w-full bg-slate-800/5 mb-3"></div>

                                                    {/* Header Fake */}
                                                    <div className={`px-3 flex items-center gap-2 mb-4 transition-all relative ${config.coverMode === 'image' ? 'justify-center' : ''}`}>
                                                        {config.coverMode === 'image' && config.coverImageUrl ? (
                                                            <div className="relative flex justify-center transition-all duration-300" style={{ height: `${(config.logoSize || 80) * 0.3}px`, maxHeight: '80px' }}>
                                                                <img src={config.coverImageUrl} className="h-full w-auto object-contain" alt="Capa" />

                                                                {/* Indicador de Click Area no Preview */}
                                                                <div className={`absolute top-0 h-full bg-red-500/20 border border-red-500/40 rounded-sm pointer-events-none transition-all ${(config.secretClickArea || 'right') === 'left' ? 'left-0 w-[45%]' :
                                                                        (config.secretClickArea || 'right') === 'right' ? 'right-0 w-[45%]' :
                                                                            'inset-0 w-full'
                                                                    }`}></div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 relative">
                                                                <div className="relative flex justify-center shrink-0 transition-all duration-300" style={{ height: `${(config.logoSize || 80) * 0.3}px` }}>
                                                                    {config.logoUrl ? <img src={config.logoUrl} className="h-full w-auto object-contain" alt="Logo" /> : <div className="h-full aspect-square bg-slate-200 rounded"></div>}

                                                                    {/* Indicador de Click Area no Preview */}
                                                                    <div className={`absolute top-0 h-full bg-red-500/20 border border-red-500/40 rounded-sm pointer-events-none transition-all ${(config.secretClickArea || 'right') === 'left' ? 'left-0 w-[45%]' :
                                                                            (config.secretClickArea || 'right') === 'right' ? 'right-0 w-[45%]' :
                                                                                'inset-0 w-full'
                                                                        }`}></div>
                                                                </div>
                                                                <div className="flex flex-col justify-center overflow-hidden shrink-0">
                                                                    <div className="h-[3px] w-8 rounded mb-0.5 opacity-80" style={{ backgroundColor: config.accentColor }}></div>
                                                                    <div className="h-[4px] w-14 rounded opacity-90" style={{ backgroundColor: config.primaryColor }}></div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Form Fake */}
                                                    <div className="mx-3 flex-1 bg-white rounded-t-xl shadow-sm border border-slate-100 flex flex-col p-2 gap-2">
                                                        <div className="h-4 w-full bg-slate-100 rounded"></div>
                                                        <div className="h-6 w-full bg-slate-50 rounded border border-slate-100 mt-1"></div>
                                                        <div className="h-6 w-full bg-slate-50 rounded border border-slate-100"></div>
                                                        <div className="h-8 w-full rounded mt-auto opacity-90" style={{ backgroundColor: config.accentColor }}></div>
                                                    </div>
                                                </div>
                                            </div>
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

            {
                activeTab === 'terms' && (
                    <div className="animate-fade-in">
                        <LegalTermsManager />
                    </div>
                )
            }
        </div >
    );
};
