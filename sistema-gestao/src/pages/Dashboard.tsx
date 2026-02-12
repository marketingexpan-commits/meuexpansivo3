import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { statsService } from '../services/statsService';
import { useSchoolUnits } from '../hooks/useSchoolUnits';
import { Select } from '../components/Select';
import { teacherService } from '../services/teacherService';
import { adminService } from '../services/adminService';
import { studentService } from '../services/studentService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Users,
    AlertCircle,
    TrendingUp,
    Loader2,
    Building2,
    Eye,
    LogIn,
    Activity,
    Clock,
    X,
    FileText,
    Search,
    Shield,
    GraduationCap,
    User
} from 'lucide-react';

export function Dashboard() {
    const [stats, setStats] = useState({
        totalStudents: 0,
        newStudents: 0,
        delinquencyRate: 0
    });
    const [loginStats, setLoginStats] = useState({
        totalLogins: 0,
        loginPageViews: 0,
        loginPageViewsToday: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const { units } = useSchoolUnits();
    const [userUnitType, setUserUnitType] = useState<string | null>(null);
    const [adminSelectedUnitCode, setAdminSelectedUnitCode] = useState(localStorage.getItem('adminSelectedUnitCode') || '');

    // Log Modal States
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [accessLogs, setAccessLogs] = useState<any[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [logFilter, setLogFilter] = useState<'today' | 'week' | 'month'>('today');
    const [logUnitFilter, setLogUnitFilter] = useState('all');
    const [logProfileFilter, setLogProfileFilter] = useState<'all' | 'admin' | 'teacher' | 'student'>('all');

    // Name Resolution Data
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [allTeachers, setAllTeachers] = useState<any[]>([]);
    const [allAdmins, setAllAdmins] = useState<any[]>([]);

    const loadStats = async () => {
        try {
            setIsLoading(true);
            const userUnit = localStorage.getItem('userUnit');
            setUserUnitType(userUnit); // Save for UI check

            // Determine effective unit filter
            let unitFilter: string | null = null;

            // If Admin Geral AND has an emulated unit selected, use that
            if (userUnit === 'admin_geral' && localStorage.getItem('adminSelectedUnitCode')) {
                unitFilter = localStorage.getItem('adminSelectedUnitCode');
            }
            // If NOT Admin Geral, force their specific unit
            else if (userUnit && userUnit !== 'admin_geral') {
                unitFilter = userUnit;
            }

            const data = await statsService.getDashboardStats(unitFilter);
            setStats(data);

            // Fetch login stats if Admin Geral
            if (userUnit === 'admin_geral') {
                const loginData = await statsService.getLoginStats();
                setLoginStats(loginData);

                // Fetch data for name resolution in logs
                const [studs, techs, adms] = await Promise.all([
                    studentService.getStudents(null, true),
                    teacherService.getTeachers(null),
                    adminService.getAdmins()
                ]);
                setAllStudents(studs);
                setAllTeachers(techs);
                setAllAdmins(adms);
            }
        } catch (error) {
            console.error("Erro ao carregar estatísticas:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLogs = async (filter: 'today' | 'week' | 'month') => {
        setIsLoadingLogs(true);
        try {
            const logs = await statsService.getAccessLogs(filter);
            setAccessLogs(logs);
        } catch (error) {
            console.error("Erro ao fechar logs:", error);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    const handleOpenLogModal = () => {
        setIsLogModalOpen(true);
        fetchLogs(logFilter);
    };

    const handleFilterChange = (newFilter: 'today' | 'week' | 'month') => {
        setLogFilter(newFilter);
        fetchLogs(newFilter);
    };

    const getLogUserInfo = (userId: string) => {
        const s = allStudents.find(x => x.id === userId);
        if (s) return { name: s.name, role: 'Aluno', type: 'student', unit: s.unit };

        const t = allTeachers.find(x => x.id === userId);
        if (t) return { name: t.name, role: 'Professor', type: 'teacher', unit: t.unit };

        const a = allAdmins.find(x => x.id === userId);
        if (a) return { name: a.name, role: 'Administrador', type: 'admin', unit: a.unit };

        return { name: userId, role: 'Desconhecido', type: 'unknown', unit: 'N/A' };
    };

    const filteredAccessLogs = accessLogs.filter(log => {
        const info = getLogUserInfo(log.user_id);
        const matchesUnit = logUnitFilter === 'all' || info.unit === logUnitFilter;
        const matchesProfile = logProfileFilter === 'all' || info.type === logProfileFilter;
        return matchesUnit && matchesProfile;
    });

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        const tableData = filteredAccessLogs.map(log => {
            const info = getLogUserInfo(log.user_id);
            return [
                new Date(log.date).toLocaleString('pt-BR'),
                info.name,
                info.role,
                info.unit,
                log.ip || '0.0.0.0'
            ];
        });

        autoTable(doc, {
            head: [['Data/Hora', 'Nome', 'Perfil', 'Unidade', 'IP']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [0, 31, 63] }
        });

        doc.save(`Relatorio_Acessos_${logFilter}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // Reload stats when emulated unit changes (triggered by UI)
    const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newVal = e.target.value;
        const label = e.target.selectedOptions[0].text;

        setAdminSelectedUnitCode(newVal);

        if (newVal) {
            localStorage.setItem('adminSelectedUnitCode', newVal);
            // If selecting "Visão Geral", value is empty, so we don't set Name
            if (newVal) localStorage.setItem('adminSelectedUnitName', label);
        } else {
            localStorage.removeItem('adminSelectedUnitCode');
            localStorage.removeItem('adminSelectedUnitName');
        }

        // Notify Layout
        window.dispatchEvent(new Event('adminUnitChange'));

        // Timeout to allow localStorage to settle/propagate if needed (though sync here)
        setTimeout(loadStats, 50);
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
            {/* Unit Selector for Admin Geral */}
            {userUnitType === 'admin_geral' && (
                <div className="mb-6 flex items-center justify-end">
                    <div className="w-full md:w-64">
                        <Select
                            label=""
                            name="unit"
                            value={adminSelectedUnitCode}
                            onChange={handleUnitChange}
                            options={[
                                { value: '', label: 'Visão Geral (Todas as Unidades)' },
                                ...units.map(u => ({ value: u.id, label: u.fullName }))
                            ]}
                            startIcon={<Building2 className="w-4 h-4 text-blue-950" />}
                        />
                    </div>
                </div>
            )}

            {/* Login Stats for Admin Geral */}
            {userUnitType === 'admin_geral' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm scale-in overflow-hidden">

                        {/* Visitas Hoje - Informativo */}
                        <div className="flex-1 flex items-center gap-3 p-2">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <Eye className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Visitas Hoje</p>
                                <p className="text-lg font-bold text-slate-700 leading-none">{loginStats.loginPageViewsToday}</p>
                            </div>
                        </div>

                        <div className="h-8 w-px bg-slate-100 mx-2"></div>

                        {/* Total Visitas - Informativo */}
                        <div className="flex-1 flex items-center gap-3 p-2">
                            <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
                                <Activity className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Total Visitas</p>
                                <p className="text-lg font-bold text-slate-700 leading-none">{loginStats.loginPageViews}</p>
                            </div>
                        </div>

                        <div className="h-8 w-px bg-slate-100 mx-2"></div>

                        {/* Acessos Hoje - Botão */}
                        <div
                            onClick={handleOpenLogModal}
                            className="flex-1 flex items-center gap-3 cursor-pointer hover:bg-orange-50/50 p-2 rounded-lg transition-all border border-transparent hover:border-orange-100 group"
                        >
                            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                <LogIn className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Acessos Hoje</p>
                                <p className="text-lg font-bold text-blue-950 leading-none">{loginStats.totalLogins}</p>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Modal de Logs */}
            {isLogModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                        {/* Header Modal */}
                        <div className="flex justify-between items-center p-4 bg-white border-b border-slate-200">
                            <div className="flex items-center gap-4">
                                <div className="bg-slate-100 p-2 rounded-xl border border-slate-200 shadow-sm">
                                    <Clock className="w-6 h-6 text-slate-700" />
                                </div>
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Registro de Auditoria</h2>
                                    <p className="hidden md:block text-sm text-slate-500">Monitoramento de acessos e segurança em tempo real</p>
                                </div>
                            </div>
                            <button onClick={() => setIsLogModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-all p-2 rounded-full hover:bg-slate-100 group">
                                <X className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>

                        {/* Filtros */}
                        <div className="p-4 bg-white border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
                            <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                                {(['today', 'week', 'month'] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => handleFilterChange(f)}
                                        className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${logFilter === f ? 'bg-blue-950 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        {f === 'today' ? 'Hoje' : f === 'week' ? '7 Dias' : 'Mês'}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col md:flex-row gap-3 items-center w-full md:w-auto">
                                <div className="flex gap-2 w-full md:w-auto">
                                    <select
                                        value={logUnitFilter}
                                        onChange={(e) => setLogUnitFilter(e.target.value)}
                                        className="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-950/20 transition-all cursor-pointer"
                                    >
                                        <option value="all">Todas as Unidades</option>
                                        {units.map(u => (
                                            <option key={u.id} value={u.id}>{u.fullName}</option>
                                        ))}
                                    </select>

                                    <select
                                        value={logProfileFilter}
                                        onChange={(e) => setLogProfileFilter(e.target.value as any)}
                                        className="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-950/20 transition-all cursor-pointer"
                                    >
                                        <option value="all">Filtro de Perfil</option>
                                        <option value="student">Alunos</option>
                                        <option value="teacher">Professores</option>
                                        <option value="admin">Administração</option>
                                    </select>
                                </div>

                                <button
                                    onClick={handleDownloadPDF}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-950 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black shadow-lg shadow-blue-950/20 active:scale-95 transition-all w-full md:w-auto justify-center"
                                >
                                    <FileText className="w-4 h-4" />
                                    Relatório PDF
                                </button>
                            </div>
                        </div>

                        {/* Estatísticas Rápidas */}
                        <div className="bg-white px-6 py-4 border-b border-slate-100 flex flex-wrap gap-6 text-[10px] font-black uppercase tracking-widest items-center">
                            <span className="text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">Total de Acessos: {filteredAccessLogs.length}</span>
                        </div>

                        {/* Tabela de Logs */}
                        <div className="flex-1 overflow-y-auto p-0 bg-white min-h-[400px]">
                            {isLoadingLogs ? (
                                <div className="flex flex-col items-center justify-center h-full py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-950" />
                                    <p className="text-sm text-slate-500 mt-2 font-medium">Carregando auditoria...</p>
                                </div>
                            ) : filteredAccessLogs.length > 0 ? (
                                <table className="w-full min-w-[650px] text-sm text-left border-collapse">
                                    <thead className="bg-slate-50/80 backdrop-blur-sm text-slate-400 font-black uppercase text-[9px] tracking-[0.15em] sticky top-0 shadow-sm z-10 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4">Data e Hora</th>
                                            <th className="px-6 py-4">Usuário Identificado</th>
                                            <th className="px-6 py-4">Endereço IP</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 bg-white">
                                        {filteredAccessLogs.map((log) => {
                                            const info = getLogUserInfo(log.user_id);
                                            const Icon = info.type === 'admin' ? Shield : info.type === 'teacher' ? GraduationCap : User;
                                            const iconBgClass = info.type === 'admin' ? 'bg-slate-100 text-slate-700 border-slate-200' : info.type === 'teacher' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-50 text-slate-500 border-slate-100';

                                            return (
                                                <tr key={log.id} className="transition-all group hover:bg-slate-50">
                                                    <td className="px-6 py-5 font-mono text-slate-400 text-[10px] tabular-nums">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-slate-400 transition-colors" />
                                                            {new Date(log.date).toLocaleString('pt-BR')}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-2.5 rounded-xl border-2 ${iconBgClass} transition-all duration-300 group-hover:scale-105 shadow-sm`}>
                                                                <Icon className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-800 text-sm group-hover:text-slate-950 transition-colors uppercase">{info.name}</div>
                                                                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{info.role} <span className="mx-1 opacity-30">•</span> Unidade: {info.unit}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="font-mono text-[10px] py-1.5 px-3 bg-slate-50 text-slate-500 rounded-lg border border-slate-100 group-hover:bg-white group-hover:border-slate-200 transition-all tabular-nums">
                                                            {log.ip || '0.0.0.0'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mb-6">
                                        <Search className="w-10 h-10 text-slate-200" />
                                    </div>
                                    <p className="font-bold text-slate-800">Nenhum registro encontrado</p>
                                    <p className="text-xs mt-1">Tente ajustar os filtros de período ou unidade.</p>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Auditoria em Tempo Real • {filteredAccessLogs.length} Registros</p>
                            <button onClick={() => setIsLogModalOpen(false)} className="text-slate-600 hover:text-black font-black text-xs uppercase tracking-widest transition-colors">Fechar Janela</button>
                        </div>
                    </div>
                </div>
            )}

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
