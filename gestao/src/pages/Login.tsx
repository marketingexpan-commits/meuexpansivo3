import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { LockKeyhole, Eye, EyeOff, Loader2 } from 'lucide-react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { SchoolUnitDetail } from '../types';

const SCHOOL_LOGO_URL = 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';

export function Login() {
    const [loading, setLoading] = useState(false);
    const [loadingUnits, setLoadingUnits] = useState(true);
    const [units, setUnits] = useState<{ label: string, value: string }[]>([]);
    const [selectedUnit, setSelectedUnit] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    React.useEffect(() => {
        const fetchUnits = async () => {
            try {
                const q = query(collection(db, 'school_units'), orderBy('fullName'));
                const snap = await getDocs(q);
                const fetchedUnits = snap.docs.map(doc => {
                    const data = doc.data() as SchoolUnitDetail;
                    // Mapeamento inverso para manter compatibilidade com chaves legado se necessário
                    // Ou apenas usar o ID/Nome do Firestore
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
                // Fallback legado em caso de erro
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
        // Simulating login logic - store unit context
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
                    {/* Logo Colorida ao lado do título */}
                    <img
                        src={SCHOOL_LOGO_URL}
                        alt="Logo Colégio Expansivo"
                        className="h-14 object-contain"
                        style={{ filter: 'brightness(0) saturate(100%) invert(10%) sepia(31%) saturate(5441%) hue-rotate(212deg) brightness(97%) contrast(99%)' }}
                    />
                    <div className="flex flex-col justify-center">
                        <span className="text-[10px] text-blue-950 font-bold uppercase tracking-widest leading-none mb-0.5">Sistema</span>
                        <h1 className="text-2xl font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                        <span className="text-[11px] text-blue-950/60 font-semibold uppercase tracking-widest leading-none mt-2">Gestão Escolar</span>
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
                                            className="focus:outline-none hover:text-blue-950 transition-colors"
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
                                    className="w-full"
                                    size="lg"
                                    isLoading={loading}
                                    variant="primary"
                                >
                                    <LockKeyhole className="w-4 h-4 mr-2" />
                                    Entrar
                                </Button>
                            </div>

                            <div className="text-center">
                                <a
                                    href="https://wa.me/5584988739180?text=Olá,%20esqueci%20minha%20senha%20no%20sistema%20Meu%20Expansivo."
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-slate-400 hover:text-blue-950 transition-colors"
                                >
                                    Esqueceu a senha? Contate o suporte.
                                </a>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="mt-2 text-center border-t border-slate-200/50 pt-4">
                    <p className="text-xs text-slate-500 font-medium mb-1">Sistema Meu Expansivo - Gestão Escolar v1.0</p>
                    <p className="text-[10px] text-slate-400">© 2026 Expansivo Rede de Ensino. Todos os direitos reservados.</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                        <span>Desenvolvido por: </span>
                        <a
                            href="https://wa.me/5584988739180"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-950 hover:underline transition-colors font-semibold"
                        >
                            HC Apps | 84988739180
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
