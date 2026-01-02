import React from 'react';
import { X, Menu } from 'lucide-react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export function Sidebar({ isOpen, onClose, children }: SidebarProps) {
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
                    w-64 bg-white border-r border-slate-200
                    transform transition-transform duration-300 ease-in-out
                    z-50 lg:z-0
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    overflow-y-auto
                `}
            >
                {/* Mobile Close Button */}
                <div className="lg:hidden flex justify-end p-4 border-b border-slate-200">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-600" />
                    </button>
                </div>

                {/* Sidebar Content */}
                <nav className="p-4 space-y-2">
                    {children}
                </nav>
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
