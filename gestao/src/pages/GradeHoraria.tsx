import { useState, useEffect } from 'react';
import { ScheduleManagement } from '../components/ScheduleManagement';
import { SchoolUnit, UNIT_LABELS } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Clock, Layout } from 'lucide-react';

export default function GradeHoraria() {
    const [unit, setUnit] = useState<SchoolUnit | null>(null);
    const [isAdminGeral, setIsAdminGeral] = useState(false);

    useEffect(() => {
        const handleUnitChange = () => {
            const adminSelected = localStorage.getItem('adminSelectedUnitCode');
            if (adminSelected && Object.values(SchoolUnit).includes(adminSelected as SchoolUnit)) {
                setUnit(adminSelected as SchoolUnit);
            } else if (localStorage.getItem('userUnit') === 'admin_geral') {
                // If admin selects "Todas" or nothing, default to Boa Sorte or keep current
                // For now, let's reset to Boa Sorte to ensure a valid view
                setUnit(SchoolUnit.UNIT_BS);
            }
        };

        // Initial check
        const userUnit = localStorage.getItem('userUnit');
        setIsAdminGeral(userUnit === 'admin_geral');

        if (userUnit && Object.values(SchoolUnit).includes(userUnit as SchoolUnit)) {
            setUnit(userUnit as SchoolUnit);
        } else if (userUnit === 'admin_geral') {
            const adminSelected = localStorage.getItem('adminSelectedUnitCode');
            if (adminSelected && Object.values(SchoolUnit).includes(adminSelected as SchoolUnit)) {
                setUnit(adminSelected as SchoolUnit);
            } else {
                setUnit(SchoolUnit.UNIT_BS);
            }
        }

        window.addEventListener('adminUnitChange', handleUnitChange);
        return () => window.removeEventListener('adminUnitChange', handleUnitChange);
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
                        Gerenciamento de horários e disciplinas para {isAdminGeral ? (UNIT_LABELS[unit as SchoolUnit] || 'Administração Geral') : (UNIT_LABELS[unit as SchoolUnit] || 'Unidade')}.
                    </p>
                </div>
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
