import * as React from 'react';
import { SchoolLogo } from './SchoolLogo';

interface ErrorBoundaryProps {
    children?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Global Error Boundary to prevent application crashes from surfacing as blank screens.
 * Explicitly declares properties to bypass potential type resolution issues.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    // Explicitly declare state and props to ensure TypeScript recognizes them
    public state: ErrorBoundaryState = {
        hasError: false,
        error: null
    };

    // Explicitly declare props as readonly to match React semantics but ensure existence
    public readonly props: ErrorBoundaryProps;

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.props = props;
    }

    public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
                    <div className="w-24 h-24 mb-6">
                        <SchoolLogo />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Ops! Algo deu errado.</h1>
                    <p className="text-gray-600 mb-8 max-w-md">
                        Desculpe o transtorno. A aplicação encontrou um erro inesperado e precisou ser interrompida.
                    </p>
                    <button
                        onClick={() => {
                            localStorage.removeItem('app_session');
                            window.location.reload();
                        }}
                        className="px-6 py-2 bg-blue-900 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors"
                    >
                        Recarregar Aplicativo
                    </button>
                    {process.env.NODE_ENV === 'development' && (
                        <div className="mt-8 p-4 bg-red-50 border border-red-100 rounded-lg text-left overflow-auto max-w-2xl w-full">
                            <p className="text-red-800 font-mono text-sm break-all">
                                {this.state.error?.toString()}
                            </p>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
