import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarCategoryProps {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    collapsed?: boolean;
}

export function SidebarCategory({ icon, title, children, defaultOpen = false, collapsed = false }: SidebarCategoryProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    if (collapsed) {
        return (
            <div className="flex flex-col items-center py-2 space-y-1">
                <div className="p-2 text-slate-400">
                    {icon}
                </div>
                {/* In collapsed mode, we don't show children usually or we show them as a floating menu. 
                    For now, following the simple approach of hiding them to avoid complexity. */}
            </div>
        );
    }

    return (
        <div className="space-y-0.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 mt-4 px-3">
                {title}
            </div>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors group`}
            >
                <div className="flex items-center gap-2">
                    <div className="text-slate-500 group-hover:text-slate-700">
                        {icon}
                    </div>
                    <span className="truncate">{title}</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
            </button>

            {isOpen && (
                <div className="ml-4 pl-4 border-l border-slate-100 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}
