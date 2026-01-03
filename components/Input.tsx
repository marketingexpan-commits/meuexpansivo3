import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    className?: string;
    id?: string;
}

export function Input({ label, error, helperText, className = '', id, ...props }: InputProps) {
    const inputId = id || React.useId();

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={`
                    flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200
                    ${error ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-600 focus:border-transparent"}
                    ${className}
                `}
                {...props}
            />
            {error && <span className="text-xs text-red-500">{error}</span>}
            {helperText && !error && <span className="text-[10px] text-gray-400">{helperText}</span>}
        </div>
    );
}
