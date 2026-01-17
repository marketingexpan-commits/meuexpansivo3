import { useState } from 'react';
import { Button } from './Button';
import { studentService } from '../services/studentService';
import { Loader2, CheckCircle, AlertTriangle, Play, X } from 'lucide-react';

export const GradeStandardizationTool = () => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [stats, setStats] = useState({ total: 0, scanned: 0, updated: 0, errors: 0 });
    const [isOpen, setIsOpen] = useState(false);

    const inferNewGrade = (currentGrade: string): string | null => {
        if (!currentGrade) return null;
        let clean = currentGrade.trim();
        let suffix = '';

        // Detect Level based on keywords
        if (clean.includes('Série') || clean.includes('Ens. Médio') || clean.includes('Ensino Médio')) {
            suffix = ' - Ensino Médio';
            // Clean valid suffix parts to avoid recurrence
            clean = clean.replace(' - Ens. Médio', '').replace(' - Ensino Médio', '').replace(' - Médio', '');
        }
        else if (['6º', '7º', '8º', '9º'].some(g => clean.includes(g)) || clean.includes('Fund. II') || clean.includes('Fundamental II')) {
            suffix = ' - Fundamental II';
            clean = clean.replace(' - Fund. II', '').replace(' - Fundamental II', '');
        }
        else if (['1º', '2º', '3º', '4º', '5º'].some(g => clean.includes(g)) || clean.includes('Fund. I') || clean.includes('Fundamental I')) {
            suffix = ' - Fundamental I';
            clean = clean.replace(' - Fund. I', '').replace(' - Fundamental I', '');
        }
        else if (clean.includes('Nível') || clean.includes('Berçário') || clean.includes('Maternal') || clean.includes('Infantil')) {
            suffix = ' - Edu. Infantil';
            clean = clean.replace(' - Edu. Infantil', '').replace(' - Infantil', '');
        }

        if (!suffix) return null; // Could not infer

        const newGrade = `${clean.trim()}${suffix}`;
        return newGrade !== currentGrade ? newGrade : null;
    };

    const runMigration = async () => {
        if (!confirm("ATENÇÃO: Isso irá alterar o nome da série de TODOS os alunos para o padrão oficial (Ex: '3ª Série - Ensino Médio'). Deseja continuar?")) return;

        setLoading(true);
        setLogs([]);
        setStats({ total: 0, scanned: 0, updated: 0, errors: 0 });

        try {
            const allStudents = await studentService.getStudents();
            setStats(prev => ({ ...prev, total: allStudents.length }));

            const updates: Promise<void>[] = [];
            const newLogs: string[] = [];

            for (const student of allStudents) {
                setStats(prev => ({ ...prev, scanned: prev.scanned + 1 }));

                const newGrade = inferNewGrade(student.gradeLevel);

                if (newGrade) {
                    updates.push(
                        studentService.updateStudent(student.id, { gradeLevel: newGrade })
                            .then(() => {
                                setStats(prev => ({ ...prev, updated: prev.updated + 1 }));
                            })
                            .catch(err => {
                                console.error(err);
                                setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
                            })
                    );
                    newLogs.push(`[${student.name}] "${student.gradeLevel}" -> "${newGrade}"`);
                }
            }

            setLogs(newLogs);
            await Promise.all(updates);
            alert(`Migração concluída! ${updates.length} alunos atualizados.`);

        } catch (error) {
            console.error(error);
            alert("Erro fatal durante a migração. Verifique o console.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Higienização de Séries (Migration)
                        </h3>
                        <p className="text-sm text-slate-600 mt-1">
                            Padroniza os nomes das séries no banco de dados (Ex: "Ens. Médio" &rarr; "Ensino Médio").
                        </p>
                    </div>
                    <Button onClick={() => setIsOpen(true)} className="bg-slate-200 text-slate-700 hover:bg-slate-300">
                        Abrir Ferramenta
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-8 p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                    Padronização de Séries
                </h3>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                    <X className="w-5 h-5 text-slate-500" />
                </button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-xl text-center">
                    <span className="block text-2xl font-bold text-slate-800">{stats.total}</span>
                    <span className="text-xs text-slate-500 uppercase font-bold">Total Alunos</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl text-center">
                    <span className="block text-2xl font-bold text-blue-800">{stats.scanned}</span>
                    <span className="text-xs text-blue-600 uppercase font-bold">Analisados</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl text-center">
                    <span className="block text-2xl font-bold text-blue-800">{stats.updated}</span>
                    <span className="text-xs text-blue-600 uppercase font-bold">Corrigidos</span>
                </div>
                <div className="bg-red-50 p-4 rounded-xl text-center">
                    <span className="block text-2xl font-bold text-red-800">{stats.errors}</span>
                    <span className="text-xs text-red-600 uppercase font-bold">Erros</span>
                </div>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 h-64 overflow-y-auto mb-6 font-mono text-xs text-blue-400">
                {logs.length === 0 ? (
                    <span className="text-slate-500">Aguardando início...</span>
                ) : (
                    logs.map((log, i) => <div key={i}>{log}</div>)
                )}
            </div>

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
                    Fechar
                </Button>
                <Button onClick={runMigration} disabled={loading} className="bg-blue-900 hover:bg-blue-800">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {loading ? 'Processando...' : 'Iniciar Correção em Lote'}
                </Button>
            </div>
        </div>
    );
};
