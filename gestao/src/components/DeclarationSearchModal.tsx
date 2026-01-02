
import { useState } from 'react';
import { X, Search, FileText, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { studentService } from '../services/studentService';
import { generateSchoolDeclaration } from '../utils/schoolDeclarationGenerator';

interface DeclarationSearchModalProps {
    onClose: () => void;
}

export function DeclarationSearchModal({ onClose }: DeclarationSearchModalProps) {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearchAndGenerate = async () => {
        if (!code.trim()) {
            setError('Digite o código de matrícula');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Search students
            const allStudents = await studentService.getStudents();
            const student = allStudents.find(s => s.code?.trim() === code.trim());

            if (!student) {
                setError('Nenhum aluno encontrado com este código.');
                return;
            }

            // Success: generate
            generateSchoolDeclaration(student);
            onClose();

        } catch (err) {
            console.error(err);
            setError('Ocorreu um erro ao buscar o aluno.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Emitir Declaração</h2>
                            <p className="text-xs text-slate-500">Insira o código de matrícula do aluno</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <Input
                            label="Código de Matrícula"
                            placeholder="Ex: 12345"
                            value={code}
                            onChange={(e) => {
                                setCode(e.target.value);
                                if (error) setError(null);
                            }}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearchAndGenerate()}
                            autoFocus
                        />

                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs animate-in slide-in-from-top-1">
                                <AlertCircle className="w-4 h-4" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={handleSearchAndGenerate}
                            disabled={isLoading}
                            className="w-full py-6 font-bold text-sm bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
                        >
                            {isLoading ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Buscando...</>
                            ) : (
                                <><Search className="w-4 h-4 mr-2" /> Localizar e Gerar PDF</>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={isLoading}
                            className="w-full text-slate-500 hover:text-slate-700 font-medium"
                        >
                            Cancelar
                        </Button>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 font-medium">
                        A declaração será gerada em formato A4 para impressão.
                    </p>
                </div>
            </div>
        </div>
    );
}
