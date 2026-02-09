import React from 'react';
import {
    CheckCircle,
    ShieldAlert,
    Bell,
    UserCheck,
    X,
    AlertCircle
} from 'lucide-react';

interface DialogProps {
    isOpen: boolean;
    type: 'alert' | 'confirm';
    title: string;
    message: string;
    image?: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'success' | 'danger' | 'warning' | 'info';
}

export const Dialog: React.FC<DialogProps> = ({
    isOpen,
    type,
    title,
    message,
    image,
    onConfirm,
    onCancel,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        if (image) return null;

        // Use variant if provided
        if (variant === 'success') return <CheckCircle className="w-12 h-12 text-blue-600" />;
        if (variant === 'danger') return <ShieldAlert className="w-12 h-12 text-red-600" />;
        if (variant === 'warning') return <AlertCircle className="w-12 h-12 text-orange-600" />;
        if (variant === 'info') return <Bell className="w-12 h-12 text-blue-600" />;

        // Fallback to title-based logic
        const lowerTitle = title.toLowerCase();
        const isSuccess = lowerTitle.includes('sucesso') || lowerTitle.includes('enviado') || lowerTitle.includes('salvo');
        const isError = lowerTitle.includes('erro') || lowerTitle.includes('falha');

        if (type === 'confirm') return <UserCheck className="w-12 h-12 text-blue-600" />;
        if (isSuccess) return <CheckCircle className="w-12 h-12 text-blue-600" />;
        if (isError) return <ShieldAlert className="w-12 h-12 text-red-600" />;
        return <Bell className="w-12 h-12 text-orange-600" />;
    };

    const getIconBg = () => {
        if (variant === 'success') return 'bg-blue-50';
        if (variant === 'danger') return 'bg-red-50';
        if (variant === 'warning') return 'bg-orange-50';
        if (variant === 'info') return 'bg-blue-50';

        const lowerTitle = title.toLowerCase();
        const isSuccess = lowerTitle.includes('sucesso') || lowerTitle.includes('enviado') || lowerTitle.includes('salvo');
        const isError = lowerTitle.includes('erro') || lowerTitle.includes('falha');

        if (type === 'confirm' || isSuccess) return 'bg-blue-50';
        if (isError) return 'bg-red-50';
        return 'bg-orange-50';
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-md animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl p-6 sm:p-8 w-[95%] sm:w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 relative border border-gray-100 text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`w-24 h-32 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden border-4 border-white shadow-lg ${getIconBg()}`}>
                    {image ? (
                        <img
                            src={image}
                            alt="Visualização"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as any).style.display = 'none';
                                (e.target as any).parentElement.innerHTML = '<svg class="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>';
                            }}
                        />
                    ) : getIcon()}
                </div>

                <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">
                    {title}
                </h3>

                <div className="text-gray-600 text-sm mb-8 leading-relaxed whitespace-pre-wrap">
                    {message}
                </div>

                <div className="flex gap-3">
                    {type === 'confirm' ? (
                        <>
                            <button
                                onClick={onCancel}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={onConfirm}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                            >
                                {confirmText}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onConfirm}
                            className="w-full px-4 py-3 rounded-xl font-bold text-white bg-gray-900 hover:bg-black shadow-lg transition-all"
                        >
                            {confirmText === 'Confirmar' ? 'OK' : confirmText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
