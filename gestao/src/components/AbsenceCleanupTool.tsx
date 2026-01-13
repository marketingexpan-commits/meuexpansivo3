import { useState } from 'react';
import { Button } from './Button';
import { pedagogicalService } from '../services/pedagogicalService';
import { studentService } from '../services/studentService';
import { Loader2, CheckCircle, ShieldCheck, Search, Filter, X } from 'lucide-react';
import { getCurrentSchoolYear, getDynamicBimester } from '../utils/academicUtils';
import { getAcademicSettings } from '../services/academicSettings';
import type { GradeEntry, AttendanceRecord, Student } from '../types';
import { AttendanceStatus } from '../types';

interface Discrepancy {
    studentId: string;
    studentName: string;
    subject: string;
    bimester: number;
    gradeValue: number; // Current value in GradeEntry.faltas
    actualValue: number; // Calculated from attendanceRecords
}

export const AbsenceCleanupTool = () => {
    const [loading, setLoading] = useState(false);
    const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
    const [stats, setStats] = useState({ scanned: 0, orphans: 0, fixed: 0 });
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'idle' | 'scanning' | 'preview'>('idle');

    const scanForDiscrepancies = async () => {
        setLoading(true);
        setViewMode('scanning');
        setDiscrepancies([]);
        setStats({ scanned: 0, orphans: 0, fixed: 0 });

        try {
            const [allStudents, allGrades, allAttendance, settings] = await Promise.all([
                studentService.getStudents(),
                pedagogicalService.getAllGrades(),
                pedagogicalService.getAllAttendance(),
                getAcademicSettings()
            ]);

            const currentYear = getCurrentSchoolYear();
            const foundDiscrepancies: Discrepancy[] = [];

            allGrades.forEach((grade: GradeEntry) => {
                const student = allStudents.find((s: Student) => s.id === grade.studentId);
                const studentName = student ? student.name : 'Desconhecido';

                // Check each bimester
                [1, 2, 3, 4].forEach(bNum => {
                    const bKey = `bimester${bNum}` as keyof GradeEntry['bimesters'];
                    const bData = grade.bimesters[bKey];
                    if (!bData) return;

                    const currentFaltas = bData.faltas;

                    // Calculate ground truth from attendance logs
                    const groundTruthAbsences = allAttendance.filter((record: AttendanceRecord) =>
                        record.discipline === grade.subject &&
                        record.studentStatus &&
                        record.studentStatus[grade.studentId] === AttendanceStatus.ABSENT &&
                        Number(record.date.split('-')[0]) === currentYear &&
                        getDynamicBimester(record.date, settings) === bNum
                    ).length;

                    if (currentFaltas !== groundTruthAbsences) {
                        foundDiscrepancies.push({
                            studentId: grade.studentId,
                            studentName,
                            subject: grade.subject,
                            bimester: bNum,
                            gradeValue: currentFaltas,
                            actualValue: groundTruthAbsences
                        });
                    }
                });
            });

            setDiscrepancies(foundDiscrepancies);
            setStats(s => ({ ...s, scanned: allGrades.length, orphans: foundDiscrepancies.length }));
            setViewMode('preview');

        } catch (error) {
            console.error("Erro no scan:", error);
            alert("Erro ao analisar dados.");
        } finally {
            setLoading(false);
        }
    };

    const fixDiscrepancies = async () => {
        if (!confirm(`Deseja aplicar a correção para ${discrepancies.length} registros? Isso sincronizará o 'faltas' do boletim com os logs reais de chamada.`)) return;

        setLoading(true);
        try {
            let fixedCount = 0;

            // Re-fetch all grades to ensure we have full objects for updates
            const allGrades = await pedagogicalService.getAllGrades();
            const updates: Promise<void>[] = [];

            // Group discrepancies by studentId and subject
            const grouped = discrepancies.reduce((acc, d) => {
                const key = `${d.studentId}_${d.subject}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(d);
                return acc;
            }, {} as Record<string, Discrepancy[]>);

            for (const key in grouped) {
                const studentDiscrepancies = grouped[key];
                const first = studentDiscrepancies[0];
                const gradeEntry = allGrades.find(g => g.studentId === first.studentId && g.subject === first.subject);

                if (gradeEntry) {
                    const newBimesters = { ...gradeEntry.bimesters };
                    studentDiscrepancies.forEach(d => {
                        const bKey = `bimester${d.bimester}` as keyof GradeEntry['bimesters'];
                        newBimesters[bKey] = { ...newBimesters[bKey], faltas: d.actualValue };
                    });

                    updates.push(pedagogicalService.updateGrade(gradeEntry.id, {
                        bimesters: newBimesters,
                        lastUpdated: new Date().toISOString()
                    }));
                    fixedCount++;
                }
            }

            await Promise.all(updates);
            setStats(s => ({ ...s, fixed: fixedCount }));
            alert("Correção concluída com sucesso!");
            setDiscrepancies([]);
            setViewMode('idle');
            setIsOpen(false);
        } catch (error) {
            console.error("Erro na correção:", error);
            alert("Erro ao aplicar correções.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl transition-all hover:shadow-md">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-blue-800 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5" />
                            Sincronizador de Faltas (Ghost Absences Fix)
                        </h3>
                        <p className="text-sm text-blue-600 mt-1">
                            Compara as faltas registradas no boletim com os logs reais de presença e corrige discrepâncias.
                        </p>
                    </div>
                    <Button onClick={() => setIsOpen(true)} className="bg-blue-900 hover:bg-blue-800 text-white shadow-sm">
                        Abrir Ferramenta
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-8 p-6 bg-white border border-slate-200 rounded-xl shadow-xl animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <Search className="w-6 h-6 text-blue-600" />
                    Limpeza de Faltas Fantasmas
                </h3>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                </button>
            </div>

            {viewMode === 'idle' && (
                <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <p className="text-slate-600 mb-4 px-4">Clique no botão abaixo para escanear todo o banco de dados em busca de faltas no boletim que não possuem registro de chamada correspondente (Faltas Fantasmas).</p>
                    <Button onClick={scanForDiscrepancies} disabled={loading} className="bg-blue-900 px-8 py-3">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                        Escanear Banco de Dados
                    </Button>
                </div>
            )}

            {(viewMode === 'scanning' || viewMode === 'preview') && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-slate-50 p-4 rounded-lg text-center border border-slate-100">
                            <span className="block text-2xl font-bold text-slate-800">{stats.scanned}</span>
                            <span className="text-xs text-slate-500 uppercase font-bold">Registros Analisados</span>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-lg text-center border border-amber-100">
                            <span className="block text-2xl font-bold text-amber-700">{discrepancies.length}</span>
                            <span className="text-xs text-amber-600 uppercase font-bold">Inconsistências</span>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg text-center border border-green-100">
                            <span className="block text-2xl font-bold text-green-800">{stats.fixed}</span>
                            <span className="text-xs text-green-600 uppercase font-bold">Corrigidos</span>
                        </div>
                    </div>

                    {viewMode === 'preview' && discrepancies.length > 0 && (
                        <div className="mb-6 animate-fade-in-up">
                            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2 px-1">
                                <Filter className="w-4 h-4 text-slate-500" />
                                Preview de Ajustes Necessários
                            </h4>
                            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
                                <div className="max-h-96 overflow-y-auto">
                                    <table className="w-full text-left text-xs md:text-sm">
                                        <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3 font-bold border-b transition-colors whitespace-nowrap">Aluno</th>
                                                <th className="p-3 font-bold border-b transition-colors whitespace-nowrap">Disciplina</th>
                                                <th className="p-3 font-bold border-b transition-colors text-center">Bim.</th>
                                                <th className="p-3 font-bold border-b transition-colors text-center">Boletim</th>
                                                <th className="p-3 font-bold border-b transition-colors text-center">Real (Logs)</th>
                                                <th className="p-3 font-bold border-b transition-colors text-center">Ajuste</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {discrepancies.map((d, i) => (
                                                <tr key={i} className="hover:bg-amber-50/50 group transition-colors">
                                                    <td className="p-3 font-medium text-slate-900 group-hover:text-blue-900">{d.studentName}</td>
                                                    <td className="p-3 text-slate-600">{d.subject}</td>
                                                    <td className="p-3 text-center text-slate-500">{d.bimester}º</td>
                                                    <td className="p-3 text-center font-bold text-red-600">{d.gradeValue}</td>
                                                    <td className="p-3 text-center font-bold text-blue-600">{d.actualValue}</td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.actualValue < d.gradeValue ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {d.actualValue - d.gradeValue > 0 ? `+${d.actualValue - d.gradeValue}` : d.actualValue - d.gradeValue}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <p className="mt-3 text-xs text-slate-400 italic font-medium px-1">
                                * O valor 'Real (Logs)' é calculado somando presenças faltosas na coleção 'attendance'.
                            </p>
                        </div>
                    )}

                    {viewMode === 'preview' && discrepancies.length === 0 && (
                        <div className="text-center py-12 bg-green-50 rounded-lg border border-green-200 mb-6 animate-fade-in">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <p className="text-green-800 text-lg font-bold">Banco de Dados Sincronizado!</p>
                            <p className="text-green-600">Não foram encontradas faltas órfãs ou discrepâncias.</p>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-end gap-3 border-t border-slate-100 pt-6">
                        <Button variant="outline" onClick={() => setViewMode('idle')} disabled={loading} className="order-2 sm:order-1">
                            Voltar
                        </Button>
                        <Button
                            onClick={fixDiscrepancies}
                            disabled={loading || discrepancies.length === 0}
                            className="bg-green-600 hover:bg-green-700 text-white order-1 sm:order-2 px-6"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                            {loading ? 'Processando...' : `Confirmar Sincronização (${discrepancies.length})`}
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
};
