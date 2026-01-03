import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SidebarItemProps {
    label: string;
    isActive?: boolean;
    onClick: () => void;
    badge?: number;
    collapsed?: boolean;
    icon?: React.ReactNode;
}

export function SidebarItem({ label, isActive = false, onClick, badge, collapsed = false, icon }: SidebarItemProps) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center w-full p-2.5 rounded-lg transition-all duration-200 group relative cursor-pointer
                ${isActive
                    ? "bg-blue-700/10 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }
                ${collapsed ? "justify-center" : ""}
            `}
        >
            {icon && (
                <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${isActive ? "text-blue-700" : "text-slate-500 group-hover:text-slate-700"}`}>
                    {icon}
                </div>
            )}

            {!collapsed && <span className={`text-sm truncate ${icon ? "ml-3" : "ml-0"}`}>{label}</span>}

            {!collapsed && badge !== undefined && badge > 0 && (
                <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {badge}
                </span>
            )}

            {!collapsed && !badge && (
                <ChevronRight className={`ml-auto w-4 h-4 text-slate-300 transition-opacity ${isActive ? "opacity-100 text-blue-300" : "opacity-0 group-hover:opacity-100"}`} />
            )}

            {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                    {label}
                </div>
            )}
        </button>
    );
}
