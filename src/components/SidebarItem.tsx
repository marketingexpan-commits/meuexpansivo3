import React from 'react';

interface SidebarItemProps {
    label: string;
    isActive?: boolean;
    onClick: () => void;
    badge?: number;
}

export function SidebarItem({ label, isActive = false, onClick, badge }: SidebarItemProps) {
    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors
                ${isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }
            `}
        >
            <span>{label}</span>
            {badge !== undefined && badge > 0 && (
                <span className="ml-auto bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {badge}
                </span>
            )}
        </button>
    );
}
