import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarCategoryProps {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

export function SidebarCategory({ icon, title, children, defaultOpen = false }: SidebarCategoryProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="space-y-1">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span>{title}</span>
                </div>
                {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
            </button>

            {isOpen && (
                <div className="ml-4 space-y-1 border-l-2 border-slate-100 pl-2">
                    {children}
                </div>
            )}
        </div>
    );
}
