import React, { useState, useEffect } from 'react';

export const BackToTopButton: React.FC = () => {
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 200) {
                setShowScrollTop(true);
            } else {
                setShowScrollTop(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!showScrollTop) return null;

    return (
        <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 bg-blue-600 text-white p-3 rounded-full shadow-2xl hover:bg-blue-700 transition-all z-[9999] w-12 h-12 flex items-center justify-center opacity-90 hover:opacity-100 animate-bounce-subtle border-2 border-white"
            title="Voltar ao topo"
            aria-label="Voltar ao topo"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
        </button>
    );
};
