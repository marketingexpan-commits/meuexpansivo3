import React from 'react';
import { twMerge } from 'tailwind-merge';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
}

export function Input({ label, error, helperText, className, id, ...props }: InputProps) {
    const inputId = id || React.useId();

    return (
        <div className={twMerge("flex flex-col gap-1.5", className)}>
            {label && (
                <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <div className="relative">
                {props.startIcon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none z-10">
                        {props.startIcon}
                    </div>
                )}
                <input
                    id={inputId}
                    className={twMerge(
                        "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-950 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
                        error && "border-red-500 focus:ring-red-500",
                        props.startIcon ? "pl-9" : "",
                        props.endIcon ? "pr-10" : ""
                    )}
                    {...props}
                />
                {props.endIcon && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                        {props.endIcon}
                    </div>
                )}
            </div>
            {error && <span className="text-xs text-red-500">{error}</span>}
            {helperText && !error && <span className="text-[10px] text-gray-400">{helperText}</span>}
        </div>
    );
}
