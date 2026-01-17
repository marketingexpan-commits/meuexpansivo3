import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Users, AlertCircle, TrendingUp, Loader2 } from 'lucide-react';
import { statsService } from '../services/statsService';

export function Dashboard() {
    const [stats, setStats] = useState({
        totalStudents: 0,
        newStudents: 0,
        delinquencyRate: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    const loadStats = async () => {
        try {
            setIsLoading(true);
            const userUnit = localStorage.getItem('userUnit');
            let unitFilter: string | null = null;

            const unitMapping: Record<string, string> = {
                'unit_zn': 'Zona Norte',
                'unit_ext': 'Extremoz',
                'unit_qui': 'Quintas',
                'unit_bs': 'Boa Sorte'
            };

            if (userUnit && userUnit !== 'admin_geral') {
                unitFilter = unitMapping[userUnit];
            }

            const data = await statsService.getDashboardStats(unitFilter);
            setStats(data);
        } catch (error) {
            console.error("Erro ao carregar estatísticas:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    if (isLoading) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-950" />
                    <p className="text-slate-500 font-medium">Carregando indicadores...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Total de Alunos</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.totalStudents}</h3>
                            <p className="text-xs text-blue-950 mt-1 flex items-center font-medium">
                                <TrendingUp className="w-3 h-3 mr-1" /> Ativos no sistema
                            </p>
                        </div>
                        <div className="p-3 bg-blue-950/10 text-blue-950 rounded-xl border border-blue-950/20">
                            <Users className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Inadimplência</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.delinquencyRate}%</h3>
                            <p className={stats.delinquencyRate > 5 ? "text-xs text-orange-600 mt-1 flex items-center font-medium" : "text-xs text-blue-950 mt-1 flex items-center font-medium"}>
                                <AlertCircle className="w-3 h-3 mr-1" /> {stats.delinquencyRate > 5 ? 'Atenção ao financeiro' : 'Dentro do esperado'}
                            </p>
                        </div>
                        <div className={`p-3 rounded-xl border ${stats.delinquencyRate > 5 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-950 border-blue-100'}`}>
                            <AlertCircle className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Novas Matrículas</p>
                            <h3 className="text-2xl font-bold text-slate-800">{stats.newStudents}</h3>
                            <p className="text-xs text-slate-500 mt-1 italic">
                                Últimos 30 dias
                            </p>
                        </div>
                        <div className="p-3 bg-blue-950/10 text-blue-950 rounded-xl border border-blue-950/20">
                            <Users className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="h-96 border-slate-200">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="text-sm font-semibold text-slate-700">Fluxo de Matrículas Anual</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center h-full pb-12">
                        <div className="text-center">
                            <TrendingUp className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            <p className="text-slate-400 text-sm italic">Gráfico em processamento...</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="h-96 border-slate-200">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="text-sm font-semibold text-slate-700">Avisos e Lembretes</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100">
                            {[
                                { title: 'Verificação de Turmas', date: 'Hoje', desc: 'Concluir a enturmação dos novos alunos do 1º Ano.', color: 'bg-blue-950' },
                                { title: 'Lembrete Financeiro', date: 'Amanhã', desc: 'Disparo automático de SMS para vencimentos do dia 05.', color: 'bg-orange-600' },
                                { title: 'Censo Escolar', date: '15 Jan', desc: 'Data limite para atualização de CPFs dos responsáveis.', color: 'bg-blue-950' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-start p-4 hover:bg-slate-50 transition-colors">
                                    <div className={`w-2 h-2 mt-2 rounded-xl ${item.color} mr-4 shrink-0`}></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <h4 className="text-sm font-semibold text-slate-800 truncate">{item.title}</h4>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded-xl ml-2">{item.date}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
