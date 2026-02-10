import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';

export function MainLayout() {
    const unitLabel = localStorage.getItem('userUnitLabel') || 'Administração Geral';
    const [adminSelectedUnit, setAdminSelectedUnit] = useState<string | null>(localStorage.getItem('adminSelectedUnitName'));
    const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);

    useEffect(() => {
        const handleUnitChange = () => {
            setAdminSelectedUnit(localStorage.getItem('adminSelectedUnitName'));
        };

        window.addEventListener('adminUnitChange', handleUnitChange);
        return () => window.removeEventListener('adminUnitChange', handleUnitChange);
    }, []);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setCollapsed(true);
            } else {
                setCollapsed(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
            <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
                <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg md:hidden"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        <div className="flex items-center gap-2">
                            <div className="bg-blue-950/10 text-blue-950 px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider border border-blue-950/20 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] md:max-w-none">
                                {unitLabel}
                            </div>
                            {adminSelectedUnit && localStorage.getItem('userUnit') === 'admin_geral' && (
                                <div className="hidden md:flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                    <span className="text-slate-300">|</span>
                                    <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider border border-orange-200 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                                        {adminSelectedUnit}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="text-xs md:text-sm text-slate-500 font-medium">
                        {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                </header>
                <div className="p-4 md:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
