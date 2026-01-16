
import React from 'react';
import { useSchoolConfig } from '../hooks/useSchoolConfig';
import { SCHOOL_LOGO_URL, SCHOOL_LOGO_WHITE_URL } from '../constants'; // Keep fallback

interface SchoolLogoProps {
    variant?: 'login' | 'header' | 'default';
    className?: string;
    applyBrandColor?: boolean;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({ variant = 'default', className = '', applyBrandColor = false }) => {
    const { config, loading } = useSchoolConfig();

    // Fallback logic inside component to prevent flash of empty if possible, 
    // but hook already defaults to a safety URL. 
    // We prioritize Config > Constant.

    let logoUrl = variant === 'login' ? SCHOOL_LOGO_WHITE_URL : SCHOOL_LOGO_URL;

    // If config loaded and has logo, use it. 
    // Note: For 'login' variant (white bg usually), user might want a specific white logo.
    // The current SchoolConfig only has one 'logoUrl'. 
    // Assumption: The uploaded logo is general purpose. 
    // If variant is 'login' and we have a custom logo, we use it (assuming it works on dark bg or user uploaded appropriate one).

    if (!loading && config.logoUrl) {
        logoUrl = config.logoUrl;
    }

    const defaultClasses = "h-auto max-h-full object-contain";
    const brandFilter = 'brightness(0) saturate(100%) invert(10%) sepia(31%) saturate(5441%) hue-rotate(212deg) brightness(97%) contrast(99%)';

    return (
        <img
            src={logoUrl}
            alt={config.appName || "Logo Escola"}
            className={`${defaultClasses} ${className}`}
            style={applyBrandColor ? { filter: brandFilter } : undefined}
        />
    );
};
