import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { label: string; value: string }[];
    className?: string;
    id?: string;
}

export function Select({ label, error, className = '', id, options, ...props }: SelectProps) {
    const inputId = id || React.useId();

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    id={inputId}
                    className={`
                        flex h-10 w-full appearance-none rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200
                        ${error ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-600 focus:border-transparent"}
                        ${className}
                    `}
                    {...props}
                >
                    <option value="" disabled selected>Selecione uma opção...</option>
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                </div>
            </div>
            {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
    );
}
