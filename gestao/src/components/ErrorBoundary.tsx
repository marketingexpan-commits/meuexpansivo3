import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 max-w-2xl mx-auto mt-10 bg-red-50 border border-red-200 rounded-xl">
                    <h1 className="text-2xl font-bold text-red-800 mb-4">Ocorreu um erro no sistema</h1>
                    <p className="text-red-600 mb-4">Por favor, envie o erro abaixo para o suporte:</p>
                    <pre className="bg-white p-4 rounded border border-red-100 overflow-auto text-sm text-red-900 font-mono">
                        {this.state.error?.toString()}
                        <br />
                        {this.state.error?.stack}
                    </pre>
                </div>
            );
        }

        return this.props.children;
    }
}
