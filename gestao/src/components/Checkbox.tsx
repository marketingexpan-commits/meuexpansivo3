import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

export function Checkbox({ label, className, ...props }: CheckboxProps) {
    return (
        <label className={twMerge("flex items-center gap-2 cursor-pointer group", className)}>
            <div className="relative flex items-center justify-center">
                <input
                    type="checkbox"
                    className="peer sr-only"
                    {...props}
                />
                <div className="w-5 h-5 border-2 border-slate-300 rounded-xl transition-all peer-checked:border-blue-950 peer-checked:bg-blue-950 group-hover:border-blue-950/50">
                    <svg
                        className="w-3.5 h-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="4"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            </div>
            <span className="text-sm font-medium text-slate-700 select-none group-hover:text-slate-900 transition-colors">
                {label}
            </span>
        </label>
    );
}
