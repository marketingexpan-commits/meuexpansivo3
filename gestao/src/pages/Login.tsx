import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { LockKeyhole, Eye, EyeOff, Loader2 } from 'lucide-react';
import { collection, getDocs, orderBy, query, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { SchoolUnitDetail } from '../types';

// Default Fallbacks
const DEFAULT_ADMIN_LOGO = 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';
const DEFAULT_PRIMARY_COLOR = '#172554'; // blue-950

export function Login() {
    const [loading, setLoading] = useState(false);
    const [loadingUnits, setLoadingUnits] = useState(true);
    const [units, setUnits] = useState<{ label: string, value: string }[]>([]);
    const [selectedUnit, setSelectedUnit] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Config State
    const [config, setConfig] = useState({
        logoUrl: DEFAULT_ADMIN_LOGO,
        title: 'Meu Expansivo',
        label: 'SISTEMA',
        subtitle: 'Gestão Escolar',
        primaryColor: DEFAULT_PRIMARY_COLOR,
        footerText: 'Sistema Meu Expansivo - Gestão Escolar v1.0',
        copyright: '© 2026 Expansivo Rede de Ensino. Todos os direitos reservados.',
        developerName: 'HC Apps | 84988739180',
        developerUrl: 'https://wa.me/5584988739180',
        developerMessage: 'Olá, preciso de suporte no Sistema de Gestão.'
    });

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const docRef = doc(db, 'school_config', 'default');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setConfig(prev => ({
                        ...prev,
                        logoUrl: data.adminLogoUrl || prev.logoUrl,
                        title: data.adminSystemTitle || prev.title,
                        label: data.adminSystemLabel || prev.label,
                        subtitle: data.adminSystemSubtitle || prev.subtitle,
                        primaryColor: data.adminPrimaryColor || prev.primaryColor,
                        footerText: data.adminFooterText || prev.footerText,
                        copyright: data.adminCopyright || prev.copyright,
                        developerName: data.developerName || prev.developerName,
                        developerUrl: data.developerUrl || prev.developerUrl,
                        developerMessage: data.developerMessage || prev.developerMessage
                    }));
                }
            } catch (error) {
                console.error("Error fetching admin config:", error);
            }
        };

        const fetchUnits = async () => {
            try {
                const q = query(collection(db, 'school_units'), orderBy('fullName'));
                const snap = await getDocs(q);
                const fetchedUnits = snap.docs.map(doc => {
                    const data = doc.data() as SchoolUnitDetail;
                    const legacyMapping: Record<string, string> = {
                        'Zona Norte': 'unit_zn',
                        'Extremoz': 'unit_ext',
                        'Quintas': 'unit_qui',
                        'Boa Sorte': 'unit_bs'
                    };
                    return {
                        label: `Unidade ${data.fullName.replace('Expansivo - ', '')}`,
                        value: legacyMapping[data.fullName.replace('Expansivo - ', '')] || data.id
                    };
                });

                setUnits([
                    ...fetchedUnits,
                    { label: 'Administração Geral', value: 'admin_geral' }
                ]);
            } catch (error) {
                console.error("Error fetching units:", error);
                setUnits([
                    { label: 'Unidade Zona Norte', value: 'unit_zn' },
                    { label: 'Unidade Extremoz', value: 'unit_ext' },
                    { label: 'Unidade Quintas', value: 'unit_qui' },
                    { label: 'Unidade Boa Sorte', value: 'unit_bs' },
                    { label: 'Administração Geral', value: 'admin_geral' },
                ]);
            } finally {
                setLoadingUnits(false);
            }
        };

        fetchConfig();
        fetchUnits();
    }, []);

    const getPlaceholder = () => {
        switch (selectedUnit) {
            case 'unit_zn': return 'ex: secretaria.zn';
            case 'unit_ext': return 'ex: secretaria.ext';
            case 'unit_qui': return 'ex: secretaria.qui';
            case 'unit_bs': return 'ex: secretaria.bs';
            case 'admin_geral': return 'ex: admin.geral';
            default: return 'ex: secretaria.zn';
        }
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUnit) {
            alert("Por favor, selecione uma unidade escolar.");
            return;
        }

        setLoading(true);
        localStorage.setItem('userUnit', selectedUnit);
        localStorage.setItem('userUnitLabel', units.find(u => u.value === selectedUnit)?.label || '');

        setTimeout(() => {
            setLoading(false);
            window.location.href = '/dashboard';
        }, 1500);
    };

    return (
        <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="flex items-center justify-center mb-5 gap-3">
                    {/* Logo Configurada */}
                    <img
                        src={config.logoUrl}
                        alt="Logo Sistema"
                        className="h-14 object-contain"
                        // Mantendo o filtro se for a logo padrão, senão remove ou deixa opcional. 
                        // Como a logo do admin pode ser colorida, vou remover o filtro forçado 
                        // a menos que seja a URL padrão que precisa dele.
                        style={config.logoUrl === DEFAULT_ADMIN_LOGO ? { filter: 'brightness(0) saturate(100%) invert(10%) sepia(31%) saturate(5441%) hue-rotate(212deg) brightness(97%) contrast(99%)' } : {}}
                    />
                    <div className="flex flex-col justify-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest leading-none mb-0.5" style={{ color: config.primaryColor }}>{config.label}</span>
                        <h1 className="text-2xl font-bold tracking-tight leading-none" style={{ color: config.primaryColor }}>{config.title}</h1>
                        <span className="text-[11px] font-semibold uppercase tracking-widest leading-none mt-2" style={{ color: `${config.primaryColor}99` }}>{config.subtitle}</span>
                    </div>
                </div>

                <Card className="border-slate-200 shadow-xl shadow-slate-200/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium text-center text-slate-700">Login no Sistema</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-4">
                                {loadingUnits ? (
                                    <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Carregando unidades...
                                    </div>
                                ) : (
                                    <Select
                                        label="Unidade Escolar"
                                        options={units}
                                        required
                                        value={selectedUnit}
                                        onChange={(e) => setSelectedUnit(e.target.value)}
                                    />
                                )}
                                <Input
                                    label="Usuário"
                                    placeholder={getPlaceholder()}
                                />
                                <Input
                                    label="Senha"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    endIcon={
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="focus:outline-none hover:opacity-80 transition-opacity"
                                            style={{ color: config.primaryColor }}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="w-5 h-5" />
                                            ) : (
                                                <Eye className="w-5 h-5" />
                                            )}
                                        </button>
                                    }
                                />
                            </div>

                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    className="w-full text-white transition-opacity hover:opacity-90"
                                    size="lg"
                                    isLoading={loading}
                                    style={{ backgroundColor: config.primaryColor }}
                                >
                                    <LockKeyhole className="w-4 h-4 mr-2" />
                                    Entrar
                                </Button>
                            </div>

                            <div className="text-center">
                                <a
                                    href={`https://wa.me/5584988739180?text=${encodeURIComponent('Olá, esqueci minha senha no sistema de Gestão.')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-slate-400 hover:underline transition-all"
                                    style={{ color: config.primaryColor }} // Usando a cor primária para o link também? Ou manter slate-400? Vou deixar slate-400 com hover na cor primária.
                                >
                                    <span className="text-slate-400 hover:text-inherit">Esqueceu a senha? Contate o suporte.</span>
                                </a>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="mt-2 text-center border-t border-slate-200/50 pt-4">
                    <p className="text-xs text-slate-500 font-medium mb-1">{config.footerText}</p>
                    <p className="text-[10px] text-slate-400">{config.copyright}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                        <span>Desenvolvido por: </span>
                        <a
                            href={`${config.developerUrl}?text=${encodeURIComponent(config.developerMessage)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline transition-colors font-semibold"
                            style={{ color: config.primaryColor }}
                        >
                            {config.developerName}
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
