import { useState, useEffect } from 'react';
import { ScheduleManagement } from '../components/ScheduleManagement';
import { SchoolUnit } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Clock, Layout } from 'lucide-react';

export default function GradeHoraria() {
    const [unit, setUnit] = useState<SchoolUnit | null>(null);

    useEffect(() => {
        // Read unit from localStorage as set by Sidebar/Auth in Gestão
        // In Gestão system, userUnit is often stored in localStorage
        const userUnit = localStorage.getItem('userUnit');

        // Mapping unit codes to SchoolUnit enum if necessary
        const unitMapping: Record<string, SchoolUnit> = {
            'unit_zn': SchoolUnit.UNIT_3, // Zona Norte
            'unit_ext': SchoolUnit.UNIT_2, // Extremoz
            'unit_qui': SchoolUnit.UNIT_4, // Quintas
            'unit_bs': SchoolUnit.UNIT_1  // Boa Sorte
        };

        if (userUnit && unitMapping[userUnit]) {
            setUnit(unitMapping[userUnit]);
        } else if (userUnit === 'admin_geral') {
            // If admin_geral, we can default to Unit 1 or allow selection later
            // For simplicity in the page, we'll use Unit 1 as baseline if not specified
            setUnit(SchoolUnit.UNIT_1);
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
                        <div className="p-2 bg-blue-950 text-white rounded-2xl shadow-lg shadow-blue-950/20">
                            <Clock className="w-8 h-8" />
                        </div>
                        Grade Horária
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Gerenciamento de horários e disciplinas para {localStorage.getItem('userUnitLabel') || 'Unidade'}.
                    </p>
                </div>
            </div>

            <Card className="border-slate-200 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
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
        </div>
    );
}
