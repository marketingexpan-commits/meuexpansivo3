import React, { useState } from 'react';
import { X } from 'lucide-react';

export const TextExpander: React.FC<{ text: string, title?: string, limit?: number, isHtml?: boolean }> = ({ text, title, limit = 60, isHtml = false }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    if (!text) return null;

    // Se for HTML, removemos tags para calcular se precisa de expansão
    const plainText = isHtml ? text.replace(/<[^>]*>?/gm, '') : text;
    const requiresExpansion = plainText.length > limit;

    return (
        <div className="mt-0.5">
            <div className={`text-[12px] sm:text-sm text-gray-400 line-clamp-1 leading-snug text-left ${isHtml ? 'prose prose-sm max-w-none' : ''}`}>
                {isHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: text.replace(/<p><\/p>/g, '') }} />
                ) : (
                    text
                )}
            </div>
            {requiresExpansion && (
                <button 
                    onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation(); 
                        setIsModalOpen(true); 
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest mt-1 inline-flex items-center gap-1 transition-colors bg-blue-50/50 px-2 py-0.5 rounded"
                >
                    Ampliar
                </button>
            )}

            {isModalOpen && (
                <div 
                    className="fixed inset-0 z-[100001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div 
                        className="bg-white w-[95%] sm:w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-auto max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div className="flex-1 min-w-0 pr-4">
                                <h4 className="text-base font-black text-gray-900 uppercase tracking-tight truncate">
                                    {title || 'Comunicado'}
                                </h4>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Leitura Completa</p>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600 shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
                            {isHtml ? (
                                <div 
                                    className="text-sm sm:text-base text-gray-600 leading-relaxed break-words prose max-w-none"
                                    dangerouslySetInnerHTML={{ __html: text }}
                                />
                            ) : (
                                <p className="text-sm sm:text-base text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
                                    {text}
                                </p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="px-8 py-2.5 bg-orange-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-600 transition-all active:scale-95 shadow-lg shadow-orange-900/20"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
