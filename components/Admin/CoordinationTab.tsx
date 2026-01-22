import React, { useMemo } from 'react';
import { useAcademicData } from '../../hooks/useAcademicData';
import {
    SchoolUnit,
    GradeEntry,
    Student,
    SchoolClass,
    UnitContact,
    UNIT_LABELS
} from '../../types';
import {
    Check,
    GraduationCap,
    RefreshCw
} from 'lucide-react';
import {
    SCHOOL_UNITS_LIST,
    SCHOOL_CLASSES_LIST
} from '../../constants';
import { sanitizePhone } from '../../utils/formattingUtils';
import { Button } from '../Button'; // Assuming Button is in components/Button or similar

interface CoordinationTabProps {
    isGeneralAdmin: boolean;
    coordinationFilterUnit: SchoolUnit;
    setCoordinationFilterUnit: (u: SchoolUnit) => void;
    coordinationFilterGrade: string;
    setCoordinationFilterGrade: (g: string) => void;
    coordinationFilterClass: string;
    setCoordinationFilterClass: (c: string) => void;
    coordinationFilterSubject: string;
    setCoordinationFilterSubject: (s: string) => void;
    fetchPendingGrades: () => Promise<void>;
    isLoadingCoordination: boolean;
    pendingGradesStudents: Student[];
    pendingGradesMap: Record<string, GradeEntry[]>;
    handleApproveGrade: (grade: GradeEntry) => Promise<void>;
    coordinatorSession?: UnitContact | null;
}

export const CoordinationTab: React.FC<CoordinationTabProps> = ({
    isGeneralAdmin,
    coordinationFilterUnit,
    setCoordinationFilterUnit,
    coordinationFilterGrade,
    setCoordinationFilterGrade,
    coordinationFilterClass,
    setCoordinationFilterClass,
    coordinationFilterSubject,
    setCoordinationFilterSubject,
    fetchPendingGrades,
    isLoadingCoordination,
    pendingGradesStudents,
    pendingGradesMap,
    handleApproveGrade,
    coordinatorSession
}) => {
    const { grades: academicGrades, loading: loadingAcademic } = useAcademicData();

    const formatGrade = (val: number | null | undefined) => (val !== null && val !== undefined) ? val.toFixed(1) : '-';

    // Filter students based on coordinator segment
    const filteredStudents = useMemo(() => {
        if (isGeneralAdmin) return pendingGradesStudents;
        if (!coordinatorSession || !coordinatorSession.segment || coordinatorSession.segment === 'geral' as any) return pendingGradesStudents;

        const segment = coordinatorSession.segment;
        return pendingGradesStudents.filter(student => {
            const grade = student.gradeLevel.toLowerCase();

            if (segment === 'infantil_fund1') {
                // Infantil: Nível I-V, Maternal etc. | Fund1: 1º ao 5º ano
                const isInfantil = grade.includes('nível') || grade.includes('nivel') || grade.includes('infantil') || grade.includes('maternal') || grade.includes('berçário');
                const isFund1 = ['1º ano', '2º ano', '3º ano', '4º ano', '5º ano'].some(g => grade.includes(g));
                return isInfantil || isFund1;
            }

            if (segment === 'fund2_medio') {
                // Fund2: 6º ao 9º ano | Médio: 1ª a 3ª série
                const isFund2 = ['6º ano', '7º ano', '8º ano', '9º ano'].some(g => grade.includes(g));
                const isMedio = grade.includes('série') || grade.includes('serie') || grade.includes('médio');
                return isFund2 || isMedio;
            }

            return true;
        });
    }, [pendingGradesStudents, coordinatorSession, isGeneralAdmin]);

    return (
        <div className="animate-fade-in-up md:px-6 px-4">
            <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <div className="bg-blue-950/10 text-blue-950 p-2 rounded-lg">
                            <GraduationCap className="w-5 h-5" />
                        </div>
                        Coordenação Pedagógica
                    </h2>
                    <button
                        onClick={fetchPendingGrades}
                        disabled={isLoadingCoordination}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-950 hover:bg-black text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50 shadow-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoadingCoordination ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>

                {/* FILTROS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Unidade</label>
                        <select
                            value={coordinationFilterUnit}
                            onChange={e => setCoordinationFilterUnit(e.target.value as SchoolUnit)}
                            className={`w-full p-2 border rounded-lg text-sm ${!isGeneralAdmin ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                            disabled={!isGeneralAdmin}
                        >
                            {SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{UNIT_LABELS[u as SchoolUnit] || u}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Série</label>
                        <select
                            value={coordinationFilterGrade}
                            onChange={e => setCoordinationFilterGrade(e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm"
                        >
                            <option value="">Todas</option>
                            {loadingAcademic ? (
                                <option>Carregando...</option>
                            ) : (
                                academicGrades.map(g => <option key={g.id} value={g.name}>{g.name}</option>)
                            )}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Turma</label>
                        <select
                            value={coordinationFilterClass}
                            onChange={e => setCoordinationFilterClass(e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm"
                        >
                            <option value="">Todas</option>
                            {SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Disciplina</label>
                        <input
                            type="text"
                            value={coordinationFilterSubject}
                            onChange={e => setCoordinationFilterSubject(e.target.value)}
                            placeholder="Filtrar disciplina..."
                            className="w-full p-2 border rounded-lg text-sm"
                        />
                    </div>
                </div>
            </div>

            {isLoadingCoordination ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-950"></div></div>
            ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500 font-medium">Nenhuma nota pendente de aprovação com os filtros atuais. 🎉</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredStudents.map(student => (
                        <div key={student.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-gray-800">{student.name}</h3>
                                    <p className="text-xs text-gray-500">{student.gradeLevel} - {student.schoolClass} ({student.shift})</p>
                                </div>
                                <div className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full">
                                    {pendingGradesMap[student.id]?.length} Pendência(s)
                                </div>
                            </div>
                            <div className="p-0">
                                <div className="overflow-x-auto pb-2">
                                    <table className="w-full text-[11px] md:text-xs text-left border-collapse border border-gray-200">
                                        <thead className="bg-gray-50 text-gray-500 border-b border-gray-300">
                                            <tr>
                                                <th rowSpan={2} className="px-2 py-2 font-bold uppercase border-r border-gray-300 w-32 sticky left-0 bg-gray-50 z-10 shadow-sm">Disciplina</th>
                                                {[1, 2, 3, 4].map(num => (
                                                    <th key={num} colSpan={4} className="px-1 py-1 text-center font-bold uppercase border-r border-gray-300">
                                                        {num}º Bim
                                                    </th>
                                                ))}
                                                <th rowSpan={2} className="px-1 py-2 text-center font-bold uppercase border-r border-gray-300 w-12 leading-tight">Média<br />Anual</th>
                                                <th rowSpan={2} className="px-1 py-2 text-center font-bold text-red-700 uppercase border-r border-gray-300 bg-red-50 w-12 leading-tight">Rec.<br />Final</th>
                                                <th rowSpan={2} className="px-1 py-2 text-center font-bold text-blue-950 uppercase border-r border-gray-300 bg-blue-950/10 w-12 leading-tight">Média<br />Final</th>
                                                <th rowSpan={2} className="px-2 py-2 text-center font-bold uppercase w-20">Situação</th>
                                                <th rowSpan={2} className="px-2 py-2 text-center font-bold uppercase w-20 bg-gray-100">Ação</th>
                                            </tr>
                                            <tr className="bg-gray-100 text-[10px]">
                                                {[1, 2, 3, 4].map(num => (
                                                    <React.Fragment key={num}>
                                                        <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold" title="Nota">N</th>
                                                        <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold" title="Recuperação">R</th>
                                                        <th className="px-1 py-1 text-center border-r border-gray-300 font-bold bg-gray-200" title="Média">M</th>
                                                        <th className="px-1 py-1 text-center border-r border-gray-300 font-semibold" title="Faltas">F</th>
                                                    </React.Fragment>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingGradesMap[student.id]?.map(grade => {
                                                const isRecFinalPending = grade.recuperacaoFinalApproved === false;

                                                return (
                                                    <tr key={grade.id} className="hover:bg-blue-50 transition-colors border-b last:border-0 border-gray-200">
                                                        <td className="px-2 py-2 font-bold text-gray-700 border-r border-gray-300 sticky left-0 bg-white z-10 shadow-sm">
                                                            {grade.subject}
                                                        </td>

                                                        {['bimester1', 'bimester2', 'bimester3', 'bimester4'].map((key) => {
                                                            const bData = grade.bimesters[key as keyof typeof grade.bimesters];
                                                            const isNotaPending = bData.isNotaApproved === false || (bData.isApproved === false && bData.nota !== null && bData.recuperacao === null);
                                                            const isRecPending = bData.isRecuperacaoApproved === false || (bData.isApproved === false && bData.recuperacao !== null);

                                                            const cellClass = (pending: boolean) =>
                                                                `px-1 py-2 text-center border-r border-gray-300 relative ${pending ? 'bg-yellow-100 font-bold text-yellow-900 ring-1 ring-inset ring-yellow-300' : ''}`;

                                                            return (
                                                                <React.Fragment key={key}>
                                                                    <td className={cellClass(isNotaPending)}>
                                                                        {formatGrade(bData.nota)}
                                                                        {isNotaPending && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-orange-600 rounded-full animate-pulse" title="Nota Alterada"></span>}
                                                                    </td>
                                                                    <td className={cellClass(isRecPending)}>
                                                                        {formatGrade(bData.recuperacao)}
                                                                        {isRecPending && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-orange-600 rounded-full animate-pulse" title="Recuperação Alterada"></span>}
                                                                    </td>
                                                                    <td className="px-1 py-2 text-center font-bold bg-gray-50 border-r border-gray-300">
                                                                        {formatGrade(bData.media)}
                                                                    </td>
                                                                    <td className="px-1 py-2 text-center text-gray-500 border-r border-gray-300">
                                                                        {bData.faltas ?? '-'}
                                                                    </td>
                                                                </React.Fragment>
                                                            );
                                                        })}

                                                        {/* Final Columns */}
                                                        <td className="px-1 py-2 text-center font-bold text-gray-700 bg-gray-50 border-r border-gray-300">
                                                            {formatGrade(grade.mediaAnual)}
                                                        </td>

                                                        <td className={`px-1 py-2 text-center font-bold text-red-600 border-r border-gray-300 ${isRecFinalPending ? 'bg-yellow-100 ring-inset ring-2 ring-yellow-300' : ''}`}>
                                                            {formatGrade(grade.recuperacaoFinal)}
                                                            {isRecFinalPending && <span className="block text-[8px] bg-yellow-200 text-yellow-900 rounded px-1 mt-0.5 font-bold uppercase">Alterado</span>}
                                                        </td>

                                                        <td className="px-1 py-2 text-center font-extrabold text-blue-950 bg-blue-950/10 border-r border-gray-300">
                                                            {formatGrade(grade.mediaFinal)}
                                                        </td>

                                                        <td className="px-2 py-2 text-center align-middle border-r border-gray-300">
                                                            <span className={`inline-block w-full py-0.5 rounded text-[9px] uppercase font-bold border ${grade.situacaoFinal === 'Aprovado' ? 'bg-blue-950/10 text-blue-950 border-blue-950/20' :
                                                                grade.situacaoFinal === 'Recuperação' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                                                    'bg-red-50 text-red-700 border-red-200'
                                                                }`}>
                                                                {grade.situacaoFinal}
                                                            </span>
                                                        </td>

                                                        <td className="px-2 py-2 text-center bg-gray-50">
                                                            <button
                                                                onClick={() => handleApproveGrade(grade)}
                                                                className="bg-blue-950 hover:bg-blue-900 text-white p-2 rounded-lg shadow-sm hover:scale-105 transition-all w-full flex items-center justify-center gap-2"
                                                                title="Aprovar alterações desta disciplina"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Aprovar</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
