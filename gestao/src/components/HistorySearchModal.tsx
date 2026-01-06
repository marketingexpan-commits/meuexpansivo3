
import { useState } from 'react';
import { X, Search, Loader2, AlertCircle, Clock } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { studentService } from '../services/studentService';
import { pedagogicalService } from '../services/pedagogicalService';
import { generateSchoolHistory } from '../utils/historyGenerator';
import type { Student, AcademicHistoryRecord, AttendanceRecord } from '../types';
import { HistoryEditor } from './HistoryEditor';

interface HistorySearchModalProps {
    onClose: () => void;
}

type ModalStep = 'SEARCH' | 'EDITOR';

export function HistorySearchModal({ onClose }: HistorySearchModalProps) {
    const [step, setStep] = useState<ModalStep>('SEARCH');
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [foundStudentInfo, setFoundStudentInfo] = useState<Student | null>(null);
    const [currentGrades, setCurrentGrades] = useState<any[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

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

            // 2. Fetch basic data for history (Grades, Attendance, etc.)
            const [grades, attendance] = await Promise.all([
                pedagogicalService.getGrades(student.id),
                pedagogicalService.getAttendance(student.id)
            ]);

            setCurrentGrades(grades);
            setAttendanceRecords(attendance);

            setFoundStudentInfo(student);
            setStep('EDITOR');

        } catch (err) {
            console.error(err);
            setError('Ocorreu um erro ao buscar os dados do aluno.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = (enteredRecords: AcademicHistoryRecord[]) => {
        if (!foundStudentInfo) return;
        try {
            generateSchoolHistory(foundStudentInfo, enteredRecords, currentGrades, attendanceRecords);
        } catch (e) {
            console.error("Error generating history:", e);
            alert("Erro ao gerar o PDF. Verifique se o bloqueador de pop-ups está ativo.");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={`bg-white w-full ${step === 'EDITOR' ? 'max-w-4xl h-[85vh]' : 'max-w-md'} rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 animate-in zoom-in-95`}>

                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-sm`}>
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">
                                Emitir Histórico
                            </h2>
                            <p className="text-sm text-slate-500">
                                {step === 'SEARCH' ? 'Histórico Escolar Oficial' : `${foundStudentInfo?.name}`}
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
                                className="w-full py-7 font-bold text-base bg-amber-600 hover:bg-amber-700 shadow-xl shadow-amber-200 rounded-2xl transition-all"
                            >
                                {isLoading ? (
                                    <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Buscando...</>
                                ) : (
                                    <><Search className="w-5 h-5 mr-3" /> Iniciar Composição</>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Content - Step 2: Editor */}
                {step === 'EDITOR' && foundStudentInfo && (
                    <div className="w-full h-full flex flex-col min-h-0 bg-slate-50">
                        <HistoryEditor
                            student={foundStudentInfo}
                            onSave={handleGenerate}
                            onCancel={() => setStep('SEARCH')}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
