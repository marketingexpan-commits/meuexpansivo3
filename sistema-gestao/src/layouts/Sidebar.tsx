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
    UserCog,
    History,
    Calendar,
    Settings,
    FileBarChart,
    Building2,
    UserCheck,
    Smartphone,
    Globe,
    MessageSquareReply
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SchoolUnit } from '../types';
import { DeclarationSearchModal } from '../components/DeclarationSearchModal';
import { HistorySearchModal } from '../components/HistorySearchModal';
import { BulletinSearchModal } from '../components/BulletinSearchModal';
import { CalendarManagement } from '../components/CalendarManagement';
import { getCurrentSchoolYear } from '../utils/academicUtils';

// --- TYPES ---
interface SidebarItemProps {
    icon: React.ElementType;
    label: string;
    path?: string;
    collapsed?: boolean;
}

interface SidebarProps {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    mobileMenuOpen: boolean;
    setMobileMenuOpen: (open: boolean) => void;
}

// --- SUB-COMPONENTS ---

function SidebarItem({ icon: Icon, label, path, collapsed }: SidebarItemProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const isActive = path ? location.pathname === path : false;

    return (
        <button
            onClick={() => path && navigate(path)}
            className={twMerge(
                clsx(
                    "flex items-center w-full p-3 rounded-xl transition-all duration-200 group relative cursor-pointer",
                    isActive
                        ? "bg-blue-950/10 text-blue-950 font-medium"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    collapsed && "justify-center"
                )
            )}
        >
            <Icon className={clsx("w-5 h-5", isActive ? "text-blue-950" : "text-slate-500 group-hover:text-slate-700")} />

            {!collapsed && <span className="ml-3 text-sm truncate">{label}</span>}
            {!collapsed && <ChevronRight className={clsx("ml-auto w-4 h-4 text-slate-300 transition-opacity", isActive ? "opacity-100 text-blue-950" : "opacity-0 group-hover:opacity-100")} />}

            {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                    {label}
                </div>
            )}
        </button>
    );
}

// --- SHARED FOOTER ---
function SidebarFooter({ collapsed, handleLogout, setCollapsed }: { collapsed: boolean, handleLogout: () => void, setCollapsed?: (v: boolean) => void }) {
    return (
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 mt-auto shrink-0">
            {/* Only show collapse toggle in desktop footer if passed */}
            {setCollapsed && (
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center justify-center w-full p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors mb-4 hidden md:flex"
                >
                    <Menu className="w-5 h-5" />
                </button>
            )}

            <div className="flex items-center p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-200 shrink-0">
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
    );
}

// --- SHARED SIDEBAR CONTENT ---
interface SidebarContentProps {
    collapsed: boolean;
    isMobile: boolean;
    isMatriculasOpen: boolean; setIsMatriculasOpen: (v: boolean) => void;
    isArquivosOpen: boolean; setIsArquivosOpen: (v: boolean) => void;
    isFinanceiroOpen: boolean; setIsFinanceiroOpen: (v: boolean) => void;
    isConfigOpen: boolean; setIsConfigOpen: (v: boolean) => void;
    isAdmin: boolean;
    setShowCalendarModal: (v: boolean) => void;
    handleYearChange: (y: string) => void;
    academicYear: string;
    setShowDeclarationModal: (v: boolean) => void;
    setShowHistoryModal: (v: boolean) => void;
    setShowBulletinModal: (v: boolean) => void;
}

function SidebarContent({
    collapsed,
    isMatriculasOpen, setIsMatriculasOpen,
    isArquivosOpen, setIsArquivosOpen,
    isFinanceiroOpen, setIsFinanceiroOpen,
    isConfigOpen, setIsConfigOpen,
    isAdmin,
    setShowCalendarModal,
    handleYearChange,
    academicYear,
    setShowDeclarationModal,
    setShowHistoryModal,
    setShowBulletinModal,
}: SidebarContentProps) {

    const toggle = (setter: (v: boolean) => void, value: boolean) => setter(!value);

    return (
        <nav className="flex-1 space-y-0.5">
            <div className={clsx("text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-3", collapsed && "text-center")}>
                {!collapsed ? "Principal" : "..."}
            </div>

            <SidebarItem icon={School} label="Escola" path="/dashboard" collapsed={collapsed} />
            <SidebarItem icon={Calendar} label="Grade Horária" path="/grade-horaria" collapsed={collapsed} />

            <button
                onClick={() => setShowCalendarModal(true)}
                className={twMerge(
                    clsx(
                        "flex items-center w-full p-3 rounded-xl transition-all duration-200 group relative cursor-pointer text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                        collapsed && "justify-center"
                    )
                )}
            >
                <Calendar className={clsx("w-5 h-5 text-slate-500 group-hover:text-slate-700")} />
                {!collapsed && <span className="ml-3 text-sm truncate">Gerenciar Calendário</span>}
                {collapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                        Gerenciar Calendário
                    </div>
                )}
            </button>


            <div className="space-y-0.5">
                <div className="relative group">
                    <SidebarItem
                        icon={Users}
                        label="Gestão de Alunos"
                        collapsed={collapsed}
                    />
                    {!collapsed && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggle(setIsMatriculasOpen, isMatriculasOpen);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-xl text-slate-400"
                        >
                            <ChevronRight className={clsx("w-3.5 h-3.5 transition-transform", isMatriculasOpen && "rotate-90")} />
                        </button>
                    )}
                </div>

                {isMatriculasOpen && !collapsed && (
                    <div className="ml-4 pl-4 border-l border-slate-100 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                        <SidebarItem icon={FileText} label="Alunos Cadastrados" path="/matriculas" collapsed={collapsed} />
                        <SidebarItem icon={MessageSquareReply} label="Msg. Alunos" path="/diretoria/mensagens" collapsed={collapsed} />
                        <SidebarItem icon={UserCheck} label="Cadastro de Aluno" path="/matriculas?action=new" collapsed={collapsed} />
                        <SidebarItem icon={Users} label="Rematrícula & Promoção" path="/rematricula" collapsed={collapsed} />
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
                                toggle(setIsArquivosOpen, isArquivosOpen);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded text-slate-400"
                        >
                            <ChevronRight className={clsx("w-3.5 h-3.5 transition-transform", isArquivosOpen && "rotate-90")} />
                        </button>
                    )}
                </div>

                {isArquivosOpen && !collapsed && (
                    <div className="ml-4 pl-4 border-l border-slate-100 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center w-full p-2 rounded-xl text-slate-500 bg-slate-50 border border-slate-100 mb-2">
                            <Globe className="w-4 h-4 mr-2 text-blue-950" />
                            <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block leading-none mb-1">Ano Letivo</label>
                                <select
                                    value={academicYear}
                                    onChange={(e) => handleYearChange(e.target.value)}
                                    className="w-full bg-transparent text-sm font-bold text-blue-950 focus:outline-none cursor-pointer"
                                >
                                    <option value="HISTORICAL">Anos anteriores</option>
                                    <option value="2024">Ano Letivo 2024</option>
                                    <option value="2025">Ano Letivo 2025</option>
                                    <option value="2026">Ano Letivo 2026</option>
                                    <option value="2027">Ano Letivo 2027</option>
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowDeclarationModal(true)}
                            className="flex items-center w-full p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all text-xs font-medium cursor-pointer"
                        >
                            <FileCheck className="w-4 h-4 mr-2 text-slate-400" />
                            Declaração
                        </button>
                        <button
                            onClick={() => setShowHistoryModal(true)}
                            className="flex items-center w-full p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all text-xs font-medium cursor-pointer"
                        >
                            <History className="w-4 h-4 mr-2 text-slate-400" />
                            Histórico
                        </button>
                        <button
                            onClick={() => setShowBulletinModal(true)}
                            className="flex items-center w-full p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all text-xs font-medium cursor-pointer"
                        >
                            <FileBarChart className="w-4 h-4 mr-2 text-slate-400" />
                            Boletim
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
                    <SidebarItem icon={Wallet} label="Financeiro" path="/financeiro/receitas" collapsed={collapsed} />
                    {!collapsed && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggle(setIsFinanceiroOpen, isFinanceiroOpen);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-xl text-slate-400 cursor-pointer"
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
                        <SidebarItem icon={Layers} label="Eventos & Extras" path="/financeiro/eventos" collapsed={collapsed} />
                        <SidebarItem icon={UserCog} label="Responsável Financeiro" path="/financeiro/config" collapsed={collapsed} />
                    </div>
                )}
            </div>

            <SidebarItem icon={Database} label="Tabelas" collapsed={collapsed} />
            <SidebarItem icon={Briefcase} label="Utilitários" collapsed={collapsed} />
            <SidebarItem icon={Layers} label="Extras" collapsed={collapsed} />

            <div className="my-6 border-t border-slate-100 mx-2"></div>

            <div className={clsx("text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-3", collapsed && "text-center")}>
                {!collapsed ? "Sistema" : "..."}
            </div>

            <div className="space-y-0.5">
                <div className="relative group">
                    <SidebarItem icon={Settings} label="Configurações" collapsed={collapsed} />
                    {!collapsed && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggle(setIsConfigOpen, isConfigOpen);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded text-slate-400 cursor-pointer"
                        >
                            <ChevronRight className={clsx("w-3.5 h-3.5 transition-transform", isConfigOpen && "rotate-90")} />
                        </button>
                    )}
                </div>

                {isConfigOpen && !collapsed && (
                    <div className="ml-4 pl-4 border-l border-slate-100 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                        <SidebarItem icon={Database} label="Disciplinas" path="/config/disciplinas" collapsed={collapsed} />
                        <SidebarItem icon={Layers} label="Séries e Segmentos" path="/config/series" collapsed={collapsed} />
                        <SidebarItem icon={UserCheck} label="Coordenadores" path="/config/coordenadores" collapsed={collapsed} />
                        <SidebarItem icon={Users} label="Professores" path="/config/professores" collapsed={collapsed} />
                        <SidebarItem icon={Building2} label="Unidades" path="/config/unidades" collapsed={collapsed} />
                        <SidebarItem icon={UserCheck} label="Porteiros" path="/config/porteiros" collapsed={collapsed} />

                        {isAdmin && (
                            <>
                                <SidebarItem icon={UserCheck} label="Admin/Unidades" path="/config/admin-unidades" collapsed={collapsed} />
                                <SidebarItem icon={Smartphone} label="Config. App" path="/config/escola" collapsed={collapsed} />
                            </>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}

// --- MAIN COMPONENT ---
export function Sidebar({ collapsed, setCollapsed, mobileMenuOpen, setMobileMenuOpen }: SidebarProps) {
    const [showDeclarationModal, setShowDeclarationModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showBulletinModal, setShowBulletinModal] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [isMatriculasOpen, setIsMatriculasOpen] = useState(true);
    const [isArquivosOpen, setIsArquivosOpen] = useState(true);
    const [isFinanceiroOpen, setIsFinanceiroOpen] = useState(true);
    const [isConfigOpen, setIsConfigOpen] = useState(true);
    const [academicYear, setAcademicYear] = useState(getCurrentSchoolYear().toString());

    const handleYearChange = (year: string) => {
        setAcademicYear(year);
        localStorage.setItem('academicYear', year);
        window.location.reload();
    };

    const userUnit = localStorage.getItem('userUnit');
    const isAdmin = userUnit === 'admin_geral';

    const handleLogout = () => {
        localStorage.removeItem('userUnit');
        localStorage.removeItem('userUnitLabel');
        window.location.href = '/';
    };

    // Shared props for content
    const contentProps = {
        isMatriculasOpen, setIsMatriculasOpen,
        isArquivosOpen, setIsArquivosOpen,
        isFinanceiroOpen, setIsFinanceiroOpen,
        isConfigOpen, setIsConfigOpen,
        isAdmin,
        setShowCalendarModal,
        handleYearChange,
        academicYear,
        setShowDeclarationModal,
        setShowHistoryModal,
        setShowBulletinModal
    };

    return (
        <>
            {/* --- MOBILE DRAWER (Fixed Overlay) --- */}
            <div className={clsx(
                "fixed inset-0 z-50 md:hidden transition-opacity duration-300",
                mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}>
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/50"
                    onClick={() => setMobileMenuOpen(false)}
                />

                {/* Drawer Content */}
                <aside className={clsx(
                    "absolute top-0 left-0 bottom-0 w-80 bg-white shadow-xl flex flex-col transition-transform duration-300",
                    mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                )}>
                    {/* Mobile Header */}
                    <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 bg-white shrink-0">
                        <div className="flex items-center gap-3">
                            <img
                                src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
                                alt="Meu Expansivo"
                                className="h-8 object-contain"
                                style={{ filter: 'brightness(0) saturate(100%) invert(10%) sepia(31%) saturate(5441%) hue-rotate(212deg) brightness(97%) contrast(99%)' }}
                            />
                            <div className="flex flex-col justify-center">
                                <span className="text-[10px] text-blue-950 font-bold uppercase tracking-widest leading-none mb-0">Sistema</span>
                                <h1 className="text-lg font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                            </div>
                        </div>
                        <button
                            onClick={() => setMobileMenuOpen(false)}
                            className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"
                        >
                            <ChevronRight className="w-5 h-5 rotate-180" />
                        </button>
                    </div>

                    {/* Mobile Navigation Content */}
                    <div className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
                        <SidebarContent
                            collapsed={false} // Always expanded on mobile
                            isMobile={true}
                            {...contentProps}
                        />
                    </div>

                    {/* Mobile Footer */}
                    <SidebarFooter
                        collapsed={false}
                        handleLogout={handleLogout}
                    />
                </aside>
            </div>


            {/* --- DESKTOP SIDEBAR (Relative / Sticky) --- */}
            <aside
                className={clsx(
                    "hidden md:flex flex-col h-screen bg-white border-r border-slate-200 transition-all duration-300 z-30 sticky top-0",
                    collapsed ? "w-20" : "w-64"
                )}
            >
                {/* Desktop Header */}
                <div className="h-16 flex items-center px-4 border-b border-slate-100 bg-white shrink-0">
                    <div className={clsx("flex items-center gap-3 overflow-hidden transition-all duration-300", collapsed ? "justify-center w-full" : "")}>
                        {collapsed ? (
                            <img
                                src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
                                alt="Logo"
                                className="h-8 w-auto object-contain"
                                style={{ filter: 'brightness(0) saturate(100%) invert(10%) sepia(31%) saturate(5441%) hue-rotate(212deg) brightness(97%) contrast(99%)' }}
                            />
                        ) : (
                            <>
                                <img
                                    src="https://i.postimg.cc/Hs4CPVBM/Vagas-flyer-02.png"
                                    alt="Meu Expansivo"
                                    className="h-9 object-contain"
                                    style={{ filter: 'brightness(0) saturate(100%) invert(10%) sepia(31%) saturate(5441%) hue-rotate(212deg) brightness(97%) contrast(99%)' }}
                                />
                                <div className="flex flex-col justify-center">
                                    <span className="text-[10px] text-blue-950 font-bold uppercase tracking-widest leading-none mb-0">Sistema</span>
                                    <h1 className="text-lg font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                                    <span className="text-[10px] text-blue-950/60 font-semibold uppercase tracking-wider leading-none mt-1.5">Gestão Escolar</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Desktop Navigation Content */}
                <div className="flex-1 overflow-y-auto py-6 px-3 space-y-0.5 custom-scrollbar">
                    <SidebarContent
                        collapsed={collapsed}
                        isMobile={false}
                        {...contentProps}
                    />
                </div>

                {/* Desktop Footer */}
                <SidebarFooter
                    collapsed={collapsed}
                    handleLogout={handleLogout}
                    setCollapsed={setCollapsed}
                />
            </aside>

            {/* Modals */}
            {showDeclarationModal && (<DeclarationSearchModal onClose={() => setShowDeclarationModal(false)} />)}
            {showHistoryModal && (<HistorySearchModal onClose={() => setShowHistoryModal(false)} />)}
            {showBulletinModal && (<BulletinSearchModal onClose={() => setShowBulletinModal(false)} />)}
            {showCalendarModal && (() => {
                const mappedUnit = userUnit || 'admin_geral';
                return (
                    <CalendarManagement
                        isOpen={showCalendarModal}
                        onClose={() => setShowCalendarModal(false)}
                        unit={mappedUnit as SchoolUnit | 'admin_geral'}
                        isAdmin={isAdmin}
                    />
                );
            })()}
        </>
    );
}
