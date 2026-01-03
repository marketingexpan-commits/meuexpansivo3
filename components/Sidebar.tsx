import React, { useState } from 'react';
import { X, Menu, ChevronRight, LogOut, School } from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    userName?: string;
    onLogout?: () => void;
}

export function Sidebar({ isOpen, onClose, children, userName = "Admin", onLogout }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false);

    const handleLogout = () => {
        if (onLogout) {
            onLogout();
        } else {
            window.location.href = '/';
        }
    };

    const initials = userName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:sticky top-0 left-0 h-screen
                    bg-white border-r border-slate-200
                    flex flex-col
                    transform transition-all duration-300 ease-in-out
                    z-50 lg:z-0
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    ${collapsed ? 'w-20' : 'w-64'}
                `}
            >
                {/* Header */}
                <div className="h-16 flex items-center px-4 border-b border-slate-100 bg-white">
                    <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${collapsed ? "justify-center w-full" : ""}`}>
                        {collapsed ? (
                            <div className="p-1.5 bg-blue-600 rounded-md shrink-0">
                                <School className="w-5 h-5 text-white" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 w-full px-2">
                                <div className="h-9 w-auto shrink-0">
                                    <SchoolLogo className="!h-full w-auto drop-shadow-sm" />
                                </div>
                                <div className="flex flex-col justify-center overflow-hidden">
                                    <span className="text-[7px] text-blue-950 font-bold uppercase tracking-widest leading-none mb-0 truncate">Aplicativo</span>
                                    <h1 className="text-lg font-bold text-blue-950 tracking-tight leading-none truncate">Meu Expansivo</h1>
                                    <span className="text-[7px] text-blue-950/60 font-semibold uppercase tracking-wider leading-none mt-1.5 truncate">Painel Administrativo</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Mobile Close Button */}
                    <div className="lg:hidden ml-auto">
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-600" />
                        </button>
                    </div>
                </div>

                {/* Sidebar Content */}
                <nav className={`flex-1 overflow-y-auto py-6 px-3 space-y-0.5 custom-scrollbar ${collapsed ? "items-center" : ""}`}>
                    {/* Inject collapsed prop into children if they are SidebarCategory or SidebarItem */}
                    {React.Children.map(children, child => {
                        if (React.isValidElement(child)) {
                            // @ts-ignore - passing collapsed prop to children
                            return React.cloneElement(child, { collapsed });
                        }
                        return child;
                    })}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="hidden lg:flex items-center justify-center w-full p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors mb-4"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    <div className="flex items-center p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-200 shrink-0">
                            {initials}
                        </div>
                        {!collapsed && (
                            <div className="ml-3 overflow-hidden">
                                <p className="text-sm font-medium text-slate-700 truncate">{userName}</p>
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
            </aside>
        </>
    );
}

interface SidebarToggleProps {
    onClick: () => void;
}

export function SidebarToggle({ onClick }: SidebarToggleProps) {
    return (
        <button
            onClick={onClick}
            className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
        >
            <Menu className="w-6 h-6 text-slate-600" />
        </button>
    );
}
