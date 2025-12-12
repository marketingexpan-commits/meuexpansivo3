// src/components/SchoolLogo.tsx

import React from 'react';
import { SCHOOL_LOGO_URL, SCHOOL_LOGO_WHITE_URL } from '../constants';

interface SchoolLogoProps {
    variant: 'header' | 'small' | 'login' | 'print';
    className?: string;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({ variant, className = '' }) => {
    // Definindo tamanhos baseados na variante
    let sizeClass = '';
    let logoSrc = SCHOOL_LOGO_URL;

    switch (variant) {
        case 'header':
            sizeClass = 'h-10 w-auto'; // Ajuste para caber no header sem distorcer
            break;
        case 'small':
            sizeClass = 'h-6 w-auto';
            break;
        case 'login':
            sizeClass = 'h-24 w-auto'; // Maior para a tela de login
            logoSrc = SCHOOL_LOGO_URL; // Usa a logo laranja (original) na tela de login
            break;
        case 'print':
            sizeClass = 'h-24 w-auto mb-4'; // Maior para a impressão
            logoSrc = SCHOOL_LOGO_URL; // Usa a logo original na impressão (fundo branco)
            break;
    }

    return (
        <div className={`flex justify-center items-center ${className}`}>
            <img
                src={logoSrc}
                alt="Logo da Escola"
                className={`${sizeClass} object-contain`}
                onError={(e) => {
                    // Fallback visual caso a imagem não carregue
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold">🏫</div>';
                }}
            />
        </div>
    );
};