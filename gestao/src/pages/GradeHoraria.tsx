import { useState, useEffect } from 'react';
import { ScheduleManagement } from '../components/ScheduleManagement';
import { SchoolUnit } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Clock, Layout } from 'lucide-react';

export default function GradeHoraria() {
    const [unit, setUnit] = useState<SchoolUnit | null>(null);
    const [isAdminGeral, setIsAdminGeral] = useState(false);

    useEffect(() => {
        // Read unit from localStorage as set by Sidebar/Auth in Gestão
        const userUnit = localStorage.getItem('userUnit');
        setIsAdminGeral(userUnit === 'admin_geral');

        // Mapping unit codes to SchoolUnit enum if necessary
        const unitMapping: Record<string, SchoolUnit> = {
            'unit_zn': SchoolUnit.UNIT_ZN, // Zona Norte
            'unit_ext': SchoolUnit.UNIT_EXT, // Extremoz
            'unit_qui': SchoolUnit.UNIT_QUI, // Quintas
            'unit_bs': SchoolUnit.UNIT_BS  // Boa Sorte
        };

        if (userUnit && unitMapping[userUnit]) {
            setUnit(unitMapping[userUnit]);
        } else if (userUnit === 'admin_geral') {
            // If admin_geral, we can default to Boa Sorte and allow selection
            setUnit(SchoolUnit.UNIT_BS);
        }
    }, []);

    if (!unit) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] opacity-50">
                <Layout className="w-12 h-12 text-slate-300 mb-2" />
                <p className="text-slate-500 font-medium">Carregando contexto da unidade...</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-blue-950 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-blue-950 text-white rounded-xl shadow-lg shadow-blue-950/20">
                            <Clock className="w-8 h-8" />
                        </div>
                        Grade Horária
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Gerenciamento de horários e disciplinas para {isAdminGeral ? 'Administração Geral' : (localStorage.getItem('userUnitLabel') || 'Unidade')}.
                    </p>
                </div>


                {isAdminGeral && (
                    <div className="flex flex-col min-w-[200px] animate-in slide-in-from-right-4 duration-500">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Selecione a Unidade</label>
                        <select
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-950/20 outline-none"
                            value={unit || ''}
                            onChange={(e) => setUnit(e.target.value as SchoolUnit)}
                        >
                            {Object.values(SchoolUnit).map((u) => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <Card className="border-slate-200 shadow-xl shadow-slate-200/50 rounded-xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                    <CardTitle className="text-slate-700 flex items-center gap-2">
                        Configuração de Horários por Turma
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="p-6">
                        <ScheduleManagement unit={unit} />
                    </div>
                </CardContent>
            </Card>
        </div >
    );
}
