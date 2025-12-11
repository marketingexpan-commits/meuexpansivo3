// src/components/Button.tsx

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className, ...props }) => {
    const baseStyle = "px-4 py-2 rounded-md font-semibold transition duration-150";
    const primaryStyle = "bg-blue-600 text-white hover:bg-blue-700";
    const secondaryStyle = "bg-gray-200 text-gray-800 hover:bg-gray-300";
    const dangerStyle = "bg-red-600 text-white hover:bg-red-700";
    
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