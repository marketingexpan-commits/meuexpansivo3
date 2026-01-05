

import { useState } from 'react';
import { X, Search, FileText, Loader2, AlertCircle, School, GraduationCap, Percent, ArrowLeftRight, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { studentService } from '../services/studentService';
import { pedagogicalService } from '../services/pedagogicalService';
import { financialService } from '../services/financialService';
import { generateSchoolDeclaration, type DeclarationType } from '../utils/schoolDeclarationGenerator';
import type { Student } from '../types';

interface DeclarationSearchModalProps {
    onClose: () => void;
}

type ModalStep = 'SEARCH' | 'SELECTION';

export function DeclarationSearchModal({ onClose }: DeclarationSearchModalProps) {
    const [step, setStep] = useState<ModalStep>('SEARCH');
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [foundStudent, setFoundStudent] = useState<Student | null>(null);
    const [studentFrequency, setStudentFrequency] = useState<number>(100);
    const [hasPendingDebts, setHasPendingDebts] = useState<boolean>(false);

    const handleSearch = async () => {
        if (!code.trim()) {
            setError('Digite o código de matrícula');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // 1. Search students
            const allStudents = await studentService.getStudents();
            const student = allStudents.find(s => s.code?.trim() === code.trim());

            if (!student) {
                setError('Nenhum aluno encontrado com este código.');
                return;
            }

            // 2. Fetch Pedagogical Data (Frequency)
            const grades = await pedagogicalService.getGrades(student.id);
            const freq = pedagogicalService.calculateFrequencyFromGrades(grades, student.gradeLevel);
            setStudentFrequency(freq);

            // 3. Fetch Financial Data (Debts)
            const installments = await financialService.getMensalidades({ studentId: student.id });
            const hasDebts = installments.some(i => i.status === 'Pendente' || i.status === 'Atrasado');
            setHasPendingDebts(hasDebts);

            setFoundStudent(student);
            setStep('SELECTION');

        } catch (err) {
            console.error(err);
            setError('Ocorreu um erro ao buscar os dados do aluno.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = (type: DeclarationType) => {
        if (!foundStudent) return;

        generateSchoolDeclaration(type, {
            student: foundStudent,
            frequency: studentFrequency,
            hasDebts: hasPendingDebts
        });

        // Maybe close on success, or keep open?
        // User said: "ao confirmar o código abra as opções", usually they might want to print more than one.
    };

    const declarationOptions = [
        {
            id: 'MATRICULA_FREQUENCIA' as DeclarationType,
            title: 'Matrícula e Frequência',
            description: 'Atesta matrícula e frequência regular.',
            icon: <School className="w-5 h-5" />,
            color: 'bg-blue-50 text-blue-600 border-blue-100'
        },
        {
            id: 'BOLSA_FAMILIA' as DeclarationType,
            title: 'Bolsa Família',
            description: `Modelo específico (Freq: ${studentFrequency.toFixed(1)}%).`,
            icon: <Percent className="w-5 h-5" />,
            color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            disabled: studentFrequency < 75
        },
        {
            id: 'TRANSFERENCIA' as DeclarationType,
            title: 'Transferência',
            description: 'Documento provisório de aptidão.',
            icon: <ArrowLeftRight className="w-5 h-5" />,
            color: 'bg-purple-50 text-purple-600 border-purple-100'
        },
        {
            id: 'CONCLUSAO' as DeclarationType,
            title: 'Conclusão de Curso',
            description: 'Atestado de conclusão (Ef/EM).',
            icon: <GraduationCap className="w-5 h-5" />,
            color: 'bg-amber-50 text-amber-600 border-amber-100'
        },
        {
            id: 'QUITACAO' as DeclarationType,
            title: 'Quitação de Débitos',
            description: hasPendingDebts ? 'Bloqueado por pendências' : 'Atesta regularidade financeira.',
            icon: <CheckCircle2 className="w-5 h-5" />,
            color: hasPendingDebts ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-teal-50 text-teal-600 border-teal-100',
            disabled: hasPendingDebts
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={`bg-white w-full ${step === 'SELECTION' ? 'max-w-2xl' : 'max-w-md'} rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 animate-in zoom-in-95`}>

                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${step === 'SELECTION' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'} rounded-2xl flex items-center justify-center shadow-sm`}>
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">
                                {step === 'SEARCH' ? 'Emitir Declaração' : 'Escolha o Tipo de Documento'}
                            </h2>
                            <p className="text-sm text-slate-500">
                                {step === 'SEARCH' ? 'Insira o código de matrícula do aluno' : `${foundStudent?.name} - ${foundStudent?.gradeLevel}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Content - Step 1: Search */}
                {step === 'SEARCH' && (
                    <div className="p-8 space-y-6">
                        <div className="space-y-4">
                            <Input
                                label="Código de Matrícula"
                                placeholder="Digite o código (ex: 12345)"
                                value={code}
                                onChange={(e) => {
                                    setCode(e.target.value);
                                    if (error) setError(null);
                                }}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                autoFocus
                                className="text-lg py-6"
                            />

                            {error && (
                                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm animate-in slide-in-from-top-1">
                                    <AlertCircle className="w-5 h-5" />
                                    <span className="font-medium">{error}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={handleSearch}
                                disabled={isLoading}
                                className="w-full py-7 font-bold text-base bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 rounded-2xl transition-all"
                            >
                                {isLoading ? (
                                    <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Verificando dados...</>
                                ) : (
                                    <><Search className="w-5 h-5 mr-3" /> Confirmar Aluno</>
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                disabled={isLoading}
                                className="w-full text-slate-400 hover:text-slate-600 font-semibold"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                )}

                {/* Content - Step 2: Selection */}
                {step === 'SELECTION' && (
                    <div className="p-6 overflow-y-auto max-h-[70vh]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {declarationOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => handlePrint(opt.id)}
                                    disabled={opt.disabled}
                                    className={`
                                        flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all
                                        ${opt.disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-100' : 'hover:scale-[1.02] hover:shadow-md cursor-pointer'}
                                        ${opt.color}
                                    `}
                                >
                                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                        {opt.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-800 text-sm">{opt.title}</h3>
                                        <p className="text-[11px] text-slate-500 font-medium truncate">{opt.description}</p>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 ${opt.disabled ? 'hidden' : 'block opacity-40'}`} />
                                </button>
                            ))}
                        </div>

                        <div className="mt-8 flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="text-xs text-slate-400">
                                <p>Todos os documentos são gerados em papel timbrado oficial.</p>
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => setStep('SEARCH')}
                                className="text-blue-600 hover:bg-blue-50 font-bold text-xs"
                            >
                                Trocar Aluno
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'SEARCH' && (
                    <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Sistema de Gestão Escolar - Expansivo
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

