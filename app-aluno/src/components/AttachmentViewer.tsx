import React, { useState } from 'react';
import { Download, X, Maximize2 } from 'lucide-react';

export const AttachmentViewer: React.FC<{ url: string, name?: string | null, asIcon?: boolean }> = ({ url, name, asIcon }) => {
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    
    // Check if it's an image.
    const nameToCheck = name || url;
    const isImage = /\.(jpeg|jpg|png|webp|gif)(\?.*)?$/i.test(nameToCheck.split('?')[0]) || 
                    nameToCheck.toLowerCase().includes('%2fimage') ||
                    nameToCheck.toLowerCase().includes('image_');

    if (!isImage) {
        if (asIcon) return null; // In icon mode, don't show the PDF button, let parent handle fallback
        return (
            <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 transition-colors border border-blue-100/50 h-full max-w-[120px] text-center shrink-0"
            >
                <Download className="w-4 h-4 shrink-0" />
                <span className="truncate">Anexo PDF</span>
            </a>
        );
    }

    return (
        <>
            <div 
                onClick={() => setIsLightboxOpen(true)}
                className={`relative overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all group border border-gray-200 bg-gray-100 shrink-0 ${asIcon ? 'w-12 h-[60px] sm:w-14 sm:h-[70px] rounded-lg' : 'w-20 h-20 sm:w-24 sm:h-24 rounded-xl'}`}
            >
                <img 
                    src={url} 
                    alt={name || 'Anexo do Comunicado'} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Maximize2 className={`${asIcon ? 'w-4 h-4' : 'w-6 h-6'} text-white opacity-0 group-hover:opacity-100 drop-shadow-lg transition-opacity transform scale-90 group-hover:scale-100`} />
                </div>
            </div>

            {isLightboxOpen && (
                <div 
                    className="fixed inset-0 z-[100000] bg-black/95 flex flex-col items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200 backdrop-blur-sm" 
                    onClick={() => setIsLightboxOpen(false)}
                >
                    <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex gap-3 z-10">
                        <a 
                            href={url} 
                            download 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-3 text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md"
                            onClick={e => e.stopPropagation()}
                            title="Fazer Download Original"
                        >
                            <Download className="w-5 h-5 sm:w-6 sm:h-6" />
                        </a>
                        <button 
                            className="p-3 text-white bg-white/10 hover:bg-red-500 rounded-full transition-colors backdrop-blur-md"
                            onClick={() => setIsLightboxOpen(false)}
                            title="Fechar"
                        >
                            <X className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                    </div>
                    
                    <img 
                        src={url} 
                        alt={name || 'Anexo em Tela Cheia'} 
                        className="max-w-full max-h-[90vh] object-contain select-none animate-in zoom-in-95 duration-300 rounded-lg shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />
                    
                    {name && (
                        <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                            <span className="bg-black/60 text-white/90 px-4 py-2 rounded-full text-xs sm:text-sm font-medium backdrop-blur-md">
                                {name}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
