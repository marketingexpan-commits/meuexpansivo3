import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    School,
    Users,
    FileText,
    BarChart3,
    FileCheck,
    Wallet,
    LogOut,
    Menu,
    ChevronRight,
    Database,
    Briefcase,
    Layers,
    UserCog
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DeclarationSearchModal } from '../components/DeclarationSearchModal';

interface SidebarItemProps {
    icon: React.ElementType;
    label: string;
    path?: string;
    collapsed?: boolean;
}

function SidebarItem({ icon: Icon, label, path, collapsed }: SidebarItemProps) {
    const location = useLocation();
    const navigate = useNavigate();

    // Check if item is active based on path
    const isActive = path ? location.pathname === path : false;

    return (
        <button
            onClick={() => path && navigate(path)}
            className={twMerge(
                clsx(
                    "flex items-center w-full p-3 rounded-lg transition-all duration-200 group relative cursor-pointer",
                    isActive
                        ? "bg-blue-700/10 text-blue-700 font-medium"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    collapsed && "justify-center"
                )
            )}
        >
            <Icon className={clsx("w-5 h-5", isActive ? "text-blue-700" : "text-slate-500 group-hover:text-slate-700")} />

            {!collapsed && <span className="ml-3 text-sm truncate">{label}</span>}
            {!collapsed && <ChevronRight className={clsx("ml-auto w-4 h-4 text-slate-300 transition-opacity", isActive ? "opacity-100 text-blue-300" : "opacity-0 group-hover:opacity-100")} />}

            {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                    {label}
                </div>
            )}
        </button>
    );
}

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const [showDeclarationModal, setShowDeclarationModal] = useState(false);
    const [isMatriculasOpen, setIsMatriculasOpen] = useState(true);
    const [isArquivosOpen, setIsArquivosOpen] = useState(true);
    const [isFinanceiroOpen, setIsFinanceiroOpen] = useState(true);

    const handleLogout = () => {
        // Clear auth data
        localStorage.removeItem('userUnit');
        localStorage.removeItem('userUnitLabel');

        // Redirect to login
        window.location.href = '/';
    };

    return (
        <aside
            className={clsx(
                "h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300 z-50",
                collapsed ? "w-20" : "w-64"
            )}
        >
            {/* Header */}
            <div className="h-16 flex items-center px-4 border-b border-slate-100 bg-white">
                <div className={clsx("flex items-center gap-3 overflow-hidden transition-all duration-300", collapsed ? "justify-center w-full" : "")}>
                    {collapsed ? (
                        <img
                            src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
                            alt="Logo"
                            className="h-8 w-auto object-contain"
                            style={{ filter: 'brightness(0) saturate(100%) invert(9%) sepia(62%) saturate(4383%) hue-rotate(227deg) brightness(60%) contrast(100%)' }}
                        />
                    ) : (
                        <>
                            <img
                                src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
                                alt="Meu Expansivo"
                                className="h-9 object-contain"
                                style={{ filter: 'brightness(0) saturate(100%) invert(9%) sepia(62%) saturate(4383%) hue-rotate(227deg) brightness(60%) contrast(100%)' }}
                            />
                            <div className="flex flex-col justify-center">
                                <span className="text-[7px] text-blue-950 font-bold uppercase tracking-widest leading-none mb-0">Sistema</span>
                                <h1 className="text-lg font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                                <span className="text-[7px] text-blue-950/60 font-semibold uppercase tracking-wider leading-none mt-1.5">Gestão Escolar</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-0.5 custom-scrollbar">
                <div className={clsx("text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-3", collapsed && "text-center")}>
                    {!collapsed ? "Principal" : "..."}
                </div>

                <SidebarItem icon={School} label="Escola" path="/dashboard" collapsed={collapsed} />

                <div className="space-y-0.5">
                    <div className="relative group">
                        <SidebarItem
                            icon={Users}
                            label="Matrículas"
                            // path="/matriculas" // Removed path to allow toggle behavior
                            collapsed={collapsed}
                        />
                        {!collapsed && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMatriculasOpen(!isMatriculasOpen);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded text-slate-400"
                            >
                                <ChevronRight className={clsx("w-3.5 h-3.5 transition-transform", isMatriculasOpen && "rotate-90")} />
                            </button>
                        )}
                    </div>

                    {isMatriculasOpen && !collapsed && (
                        <div className="ml-4 pl-4 border-l border-slate-100 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                            <SidebarItem
                                icon={FileText}
                                label="Gestão de Matrículas"
                                path="/matriculas"
                                collapsed={collapsed}
                            />
                            <SidebarItem
                                icon={Users}
                                label="Nova Matrícula"
                                path="/matriculas?action=new"
                                collapsed={collapsed}
                            />
                        </div>
                    )}
                </div>

                <div className="space-y-0.5">
                    <div className="relative group">
                        <SidebarItem icon={FileText} label="Arquivos" collapsed={collapsed} />
                        {!collapsed && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsArquivosOpen(!isArquivosOpen);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded text-slate-400"
                            >
                                <ChevronRight className={clsx("w-3.5 h-3.5 transition-transform", isArquivosOpen && "rotate-90")} />
                            </button>
                        )}
                    </div>

                    {isArquivosOpen && !collapsed && (
                        <div className="ml-4 pl-4 border-l border-slate-100 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                            <button
                                onClick={() => setShowDeclarationModal(true)}
                                className="flex items-center w-full p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all text-xs font-medium cursor-pointer"
                            >
                                <FileCheck className="w-4 h-4 mr-2 text-slate-400" />
                                Declaração
                            </button>
                        </div>
                    )}
                </div>
                <SidebarItem icon={BarChart3} label="Relatórios" collapsed={collapsed} />

                <div className="my-6 border-t border-slate-100 mx-2"></div>

                <div className={clsx("text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-3", collapsed && "text-center")}>
                    {!collapsed ? "Gestão" : "..."}
                </div>

                <div className="space-y-0.5">
                    <div className="relative group">
                        <SidebarItem
                            icon={Wallet}
                            label="Financeiro"
                            path="/financeiro/receitas"
                            collapsed={collapsed}
                        />
                        {!collapsed && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsFinanceiroOpen(!isFinanceiroOpen);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded text-slate-400 cursor-pointer"
                            >
                                <ChevronRight className={clsx("w-3.5 h-3.5 transition-transform", isFinanceiroOpen && "rotate-90")} />
                            </button>
                        )}
                    </div>

                    {isFinanceiroOpen && !collapsed && (
                        <div className="ml-4 pl-4 border-l border-slate-100 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                            <SidebarItem icon={FileText} label="Receitas" path="/financeiro/receitas" collapsed={collapsed} />
                            <SidebarItem icon={FileCheck} label="Pagamentos" path="/financeiro/pagamentos" collapsed={collapsed} />
                            <SidebarItem icon={BarChart3} label="Fluxo de Caixa" path="/financeiro/fluxo" collapsed={collapsed} />
                            <SidebarItem icon={UserCog} label="Responsável Financeiro" path="/financeiro/config" collapsed={collapsed} />
                        </div>
                    )}
                </div>

                <SidebarItem icon={Database} label="Tabelas" collapsed={collapsed} />
                <SidebarItem icon={Briefcase} label="Utilitários" collapsed={collapsed} />
                <SidebarItem icon={Layers} label="Extras" collapsed={collapsed} />
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center justify-center w-full p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors mb-4"
                >
                    <Menu className="w-5 h-5" />
                </button>

                <div className="flex items-center p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-200">
                        H
                    </div>
                    {!collapsed && (
                        <div className="ml-3 overflow-hidden">
                            <p className="text-sm font-medium text-slate-700 truncate">Hemenson</p>
                            <button
                                onClick={handleLogout}
                                className="text-xs text-red-500 flex items-center hover:text-red-600 hover:underline mt-0.5 transition-colors cursor-pointer"
                            >
                                <LogOut className="w-3 h-3 mr-1" /> Sair
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showDeclarationModal && (
                <DeclarationSearchModal onClose={() => setShowDeclarationModal(false)} />
            )}
        </aside>
    );
}
