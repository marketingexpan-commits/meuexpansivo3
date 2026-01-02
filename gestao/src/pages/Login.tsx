import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { LockKeyhole } from 'lucide-react';

const SCHOOL_LOGO_URL = 'https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png';

export function Login() {
    const [loading, setLoading] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState('');

    // Unidades Mockadas (Pode vir de constants depois)
    const units = [
        { label: 'Unidade Zona Norte', value: 'unit_zn' },
        { label: 'Unidade Extremoz', value: 'unit_ext' },
        { label: 'Unidade Quintas', value: 'unit_qui' },
        { label: 'Unidade Boa Sorte', value: 'unit_bs' },
        { label: 'Administração Geral', value: 'admin_geral' },
    ];

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
                    />
                    <div className="flex flex-col">
                        <h1 className="text-3xl font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mt-1">GESTÃO ESCOLAR</p>
                    </div>
                </div>

                <Card className="border-slate-200 shadow-xl shadow-slate-200/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium text-center text-slate-700">Login no Sistema</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-4">
                                <Select
                                    label="Unidade Escolar"
                                    options={units}
                                    required
                                    value={selectedUnit}
                                    onChange={(e) => setSelectedUnit(e.target.value)}
                                />
                                <Input
                                    label="Usuário"
                                    placeholder={getPlaceholder()}
                                />
                                <Input
                                    label="Senha"
                                    type="password"
                                    placeholder="••••••••"
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
                                    className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                    Esqueceu a senha? Contate o suporte.
                                </a>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="mt-8 text-center text-xs text-slate-400">
                    &copy; 2026 Expansivo Rede de Ensino. Todos os direitos reservados.
                    <br />Sistema Meu Expansivo - Gestão Escolar v1.0
                </div>
            </div>
        </div>
    );
}
