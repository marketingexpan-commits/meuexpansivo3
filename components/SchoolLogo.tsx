
import React from 'react';
import { SCHOOL_LOGO_URL, SCHOOL_LOGO_WHITE_URL } from '../constants';

interface SchoolLogoProps {
    variant?: 'login' | 'header' | 'default';
    className?: string;
    applyBrandColor?: boolean;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({ variant = 'default', className = '', applyBrandColor = false }) => {
    const logoUrl = variant === 'login' ? SCHOOL_LOGO_WHITE_URL : SCHOOL_LOGO_URL;
    const defaultClasses = "h-auto max-h-full object-contain";

    // Exactly matches blue-950 (#172554)
    const brandFilter = 'brightness(0) saturate(100%) invert(10%) sepia(31%) saturate(5441%) hue-rotate(212deg) brightness(97%) contrast(99%)';

    return (
        <img
            src={logoUrl}
            alt="Logo Escola"
            className={`${defaultClasses} ${className}`}
            style={applyBrandColor ? { filter: brandFilter } : undefined}
        />
    );
};
