// src/components/Button.tsx

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className, ...props }) => {
    const baseStyle = "px-4 py-2 rounded-lg transition-all duration-150 transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2";
    
    const primaryStyle = "font-bold bg-gradient-to-r from-blue-950 to-slate-900 text-white hover:from-blue-900 hover:to-slate-800 shadow-md hover:shadow-xl focus:ring-blue-500";
    const secondaryStyle = "font-semibold bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400";
    const dangerStyle = "font-semibold bg-red-600 text-white hover:bg-red-700 focus:ring-red-500";
    
    let variantStyle = primaryStyle;
    if (variant === 'secondary') {
        variantStyle = secondaryStyle;
    } else if (variant === 'danger') {
        variantStyle = dangerStyle;
    }
    
    return (
        <button
            className={`${baseStyle} ${variantStyle} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};