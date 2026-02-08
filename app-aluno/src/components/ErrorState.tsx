import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    title = "Erro ao carregar dados",
    message = "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
    onRetry
}) => {
    return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-xl border border-red-100 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="space-y-1">
                <h3 className="text-lg font-bold text-red-900">{title}</h3>
                <p className="text-red-700 text-sm max-w-xs mx-auto">
                    {message}
                </p>
            </div>
            {onRetry && (
                <Button
                    onClick={onRetry}
                    className="flex items-center gap-2 bg-white border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                >
                    <RefreshCcw className="w-4 h-4" />
                    Tentar Novamente
                </Button>
            )}
        </div>
    );
};
