
import React from 'react';
import { SCHOOL_LOGO_URL, SCHOOL_LOGO_WHITE_URL } from '../constants';

interface SchoolLogoProps {
    variant?: 'login' | 'header' | 'default';
    className?: string;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({ variant = 'default', className = '' }) => {
    const logoUrl = variant === 'login' ? SCHOOL_LOGO_WHITE_URL : SCHOOL_LOGO_URL;
    const defaultClasses = "h-auto max-h-full object-contain";

    return (
        <img
            src={logoUrl}
            alt="Logo Escola"
            className={`${defaultClasses} ${className}`}
        />
    );
};
