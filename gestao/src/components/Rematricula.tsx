import { useState, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { writeBatch, doc as firebaseDoc } from 'firebase/firestore';
import { useAcademicData } from '../hooks/useAcademicData';
import type { Student, GradeEntry, SchoolClass, EnrollmentRecord } from '../types';
import { SchoolUnit, UNIT_LABELS } from '../types';
import { SCHOOL_UNITS_LIST, SCHOOL_CLASSES_LIST } from '../utils/academicDefaults';

interface RematriculaProps {
    students: Student[];
    grades: GradeEntry[];
    onRefresh: () => Promise<void>;
    currentAdminUnit?: SchoolUnit; // Nova prop opcional
}

export const Rematricula: React.FC<RematriculaProps> = ({ students, grades, onRefresh, currentAdminUnit }) => {
    const { grades: academicGrades, subjects: academicSubjects, loading: loadingAcademic } = useAcademicData();

    // Se houver currentAdminUnit, usamos ela como estado inicial e imutável
    const [selectedUnit, setSelectedUnit] = useState<SchoolUnit | ''>(currentAdminUnit || '');
    const [selectedGrade, setSelectedGrade] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<SchoolClass | ''>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);

    // Estado para armazenar as seleções de série destino (2026) editadas pelo usuário
    const [destinationGrades, setDestinationGrades] = useState<Record<string, string>>({});

    const SUBJECTS = useMemo(() => {
        if (academicSubjects.length > 0) return academicSubjects.map(s => s.name);
        return [
            'Artes', 'Biologia', 'Ciências', 'Educação Física', 'Empreendedorismo',
            'Ensino Religioso', 'Espanhol', 'Filosofia', 'Física', 'Geografia',
            'História', 'Inglês', 'Literatura', 'Matemática', 'Musicalização',
            'Português', 'Projeto de Vida', 'Química', 'Redação', 'Sociologia'
        ];
    }, [academicSubjects]);

    const cleanGradeName = (name: string) => name ? name.split(' - ')[0].trim() : '';

    const getNextGrade = (currentGrade: string) => {
        const cleanedCurrent = cleanGradeName(currentGrade);
        const gradeNames = academicGrades.length > 0 ? academicGrades.map(g => g.name) : [];
        const index = gradeNames.findIndex(name => name === cleanedCurrent);

        // Se não encontrar ou for a última, mantém a atual (limpa)
        if (index === -1 || index === gradeNames.length - 1) return cleanedCurrent;

        // Retorna o próximo label da lista original
        return gradeNames[index + 1];
    };

    const getBimesterStatus = (student: Student) => {
        const gradeLevel = cleanGradeName(student.gradeLevel);
        const isInfantil = gradeLevel.includes('Nível') || gradeLevel.includes('Infantil') || gradeLevel.includes('Berçário');
        if (isInfantil) return { color: 'text-blue-600', label: 'Infantil - Promoção por Idade', approved: true };

        const studentGrades = grades.filter(g => g.studentId === student.id && g.year === 2025);
        if (studentGrades.length === 0) return { color: 'text-gray-400', label: 'Sem notas lançadas', approved: false };

        const allApproved = studentGrades.every(g => g.situacaoFinal === 'Aprovado');
        if (allApproved) return { color: 'text-blue-600', label: 'Aprovado', approved: true };

        const hasReprovado = studentGrades.some(g => g.situacaoFinal === 'Reprovado');
        if (hasReprovado) return { color: 'text-red-600', label: 'Reprovado', approved: false };

        return { color: 'text-orange-600', label: 'Em Recuperação', approved: false };
    };

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            // Se currentAdminUnit existir, força o filtro por ela (redundância de segurança)
            if (currentAdminUnit && s.unit !== currentAdminUnit) return false;
            if (selectedUnit && s.unit !== selectedUnit) return false;

            if (selectedGrade && cleanGradeName(s.gradeLevel) !== selectedGrade) return false;
            if (selectedClass && s.schoolClass !== selectedClass) return false;
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const studentName = s.name || '';
                const studentCode = s.code || '';
                return studentName.toLowerCase().includes(searchLower) || studentCode.toLowerCase().includes(searchLower);
            }
            return true;
        });
    }, [students, selectedUnit, selectedGrade, selectedClass, searchTerm, currentAdminUnit]);

    const handleGradeChange = (studentId: string, newGrade: string) => {
        setDestinationGrades(prev => ({ ...prev, [studentId]: newGrade }));
    };

    const handleResetSelections = () => {
        if (window.confirm('Deseja limpar todas as alterações manuais e voltar ao estado original?')) {
            setDestinationGrades({});
        }
    };

    const handleApplyAllSuggestions = () => {
        if (!window.confirm(`Deseja aplicar a sugestão automática de promoção para todos os ${filteredStudents.length} alunos visíveis?`)) return;

        const newSelections: Record<string, string> = { ...destinationGrades };
        filteredStudents.forEach(student => {
            const status = getBimesterStatus(student);
            const cleanedCurrent = cleanGradeName(student.gradeLevel);
            const suggestion = status.approved ? getNextGrade(student.gradeLevel) : cleanedCurrent;
            newSelections[student.id] = suggestion;
        });
        setDestinationGrades(newSelections);
    };

    const handleConfirmRematricula = async () => {
        if (!window.confirm(`Deseja confirmar a rematrícula de ${filteredStudents.length} alunos para o ano letivo de 2026?`)) return;

        setIsExecuting(true);
        try {
            const batch = writeBatch(db);
            const now = new Date().toISOString();

            for (const student of filteredStudents) {
                const status = getBimesterStatus(student);
                const currentGrade = student.gradeLevel || 'Sem Série';
                const destGrade = destinationGrades[student.id] || (status.approved ? getNextGrade(currentGrade) : currentGrade);

                // 1. Prepare Enrollment History
                const currentHistory: EnrollmentRecord[] = student.enrollmentHistory || [];

                // Update 2025 entry if exists, or create it from current data
                let updatedHistory = [...currentHistory];
                const entry2025Idx = updatedHistory.findIndex(h => h.year === '2025');
                const entry2025: EnrollmentRecord = {
                    year: '2025',
                    gradeLevel: student.gradeLevel || 'Sem Série',
                    schoolClass: student.schoolClass || 'A',
                    shift: student.shift || 'Matutino',
                    unit: student.unit || 'ZONA NORTE',
                    status: status.label
                };

                if (entry2025Idx >= 0) updatedHistory[entry2025Idx] = entry2025;
                else updatedHistory.push(entry2025);

                // Add 2026 entry
                const entry2026: EnrollmentRecord = {
                    year: '2026',
                    gradeLevel: destGrade,
                    schoolClass: student.schoolClass, // Assuming same class for now
                    shift: student.shift,
                    unit: student.unit,
                    status: 'CURSANDO'
                };

                // Add or replace 2026 entry
                const entry2026Idx = updatedHistory.findIndex(h => h.year === '2026');
                if (entry2026Idx >= 0) updatedHistory[entry2026Idx] = entry2026;
                else updatedHistory.push(entry2026);

                // Update enrolledYears
                const enrolledYears = Array.from(new Set([...(student.enrolledYears || []), '2025', '2026']));

                // 2. Atualizar registro do Aluno
                const studentRef = firebaseDoc(db, 'students', student.id);
                batch.update(studentRef, {
                    historico_escolar_2025: student.gradeLevel,
                    gradeLevel: destGrade, // Maintain top-level grade for compatibility
                    enrollmentHistory: updatedHistory,
                    enrolledYears: enrolledYears,
                    lastUpdated: now
                });

                // 3. Se for Fundamental/Médio, criar novas pautas de notas para 2026
                const isInfantil = destGrade.includes('Nível') || destGrade.includes('Infantil');
                if (!isInfantil) {
                    for (const subject of SUBJECTS) {
                        const gradeId = `${student.id}_${subject.replace(/\s+/g, '_')}_2026`;
                        const gradeRef = firebaseDoc(db, 'grades', gradeId);
                        batch.set(gradeRef, {
                            id: gradeId,
                            studentId: student.id,
                            subject: subject,
                            year: 2026,
                            bimesters: {
                                bimester1: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                                bimester2: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                                bimester3: { nota: null, recuperacao: null, media: 0, faltas: 0 },
                                bimester4: { nota: null, recuperacao: null, media: 0, faltas: 0 }
                            },
                            mediaAnual: 0,
                            mediaFinal: 0,
                            situacaoFinal: 'Cursando', // Changed from Recuperação
                            lastUpdated: now
                        });
                    }
                }
            }

            await batch.commit();
            alert('Rematrícula e Virada de Ano 2026 concluídas com sucesso!');
            onRefresh();
        } catch (error) {
            console.error(error);
            alert('Erro ao processar rematrícula.');
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-blue-950">Rematrícula & Promoção 2026</h2>
                    <p className="text-gray-500">Gestão de virada de ano e enturmação para o próximo ciclo escolar.</p>
                </div>
                <button
                    onClick={handleConfirmRematricula}
                    disabled={isExecuting || filteredStudents.length === 0}
                    className="bg-blue-950 hover:bg-black w-full md:w-auto text-white p-3 rounded-lg font-bold shadow-md"
                >
                    {isExecuting ? 'Processando...' : `Confirmar Rematrícula 2026 (${filteredStudents.length})`}
                </button>
            </div>

            {/* FILTROS */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-blue-900 uppercase mb-1">Pesquisar Aluno</label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Nome ou matrícula..."
                            className="w-full p-2 rounded-lg border border-blue-200 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-blue-900 uppercase mb-1">Unidade</label>
                        {currentAdminUnit ? (
                            <div className="w-full p-2 rounded-lg border border-blue-200 bg-blue-100 text-blue-900 font-semibold text-sm">
                                {UNIT_LABELS[currentAdminUnit as SchoolUnit] || currentAdminUnit}
                            </div>
                        ) : (
                            <select
                                value={selectedUnit}
                                onChange={e => setSelectedUnit(e.target.value as SchoolUnit)}
                                className="w-full p-2 rounded-lg border border-blue-200 text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Todas as Unidades</option>
                                {SCHOOL_UNITS_LIST.map((u: string) => (
                                    <option key={u} value={u}>
                                        {UNIT_LABELS[u as SchoolUnit] || u}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-blue-900 uppercase mb-1">Série Atual (2025)</label>
                        <select
                            value={selectedGrade}
                            onChange={e => setSelectedGrade(e.target.value)}
                            className="w-full p-2 rounded-lg border border-blue-200 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todas as Séries</option>
                            {loadingAcademic ? (
                                <option>Carregando...</option>
                            ) : (
                                academicGrades.map(g => <option key={g.id} value={g.name}>{g.name}</option>)
                            )}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-blue-900 uppercase mb-1">Turma</label>
                        <select
                            value={selectedClass}
                            onChange={e => setSelectedClass(e.target.value as SchoolClass)}
                            className="w-full p-2 rounded-lg border border-blue-200 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todas as Turmas</option>
                            {SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-blue-200">
                    <button
                        onClick={handleApplyAllSuggestions}
                        className="text-[10px] font-bold uppercase px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        🪄 Aplicar Sugestões ao Lote
                    </button>
                    <button
                        onClick={handleResetSelections}
                        className="text-[10px] font-bold uppercase px-3 py-1.5 bg-white text-blue-900 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-sm"
                    >
                        ↩️ Resetar Seleções
                    </button>
                </div>
            </div>



            {/* LISTAGEM */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Aluno</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Série Atual (2025)</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Status Acadêmico</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Série Destino (2026)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Nenhum aluno encontrado com os filtros selecionados.</td>
                                </tr>
                            ) : (
                                filteredStudents.map(student => {
                                    const status = getBimesterStatus(student);
                                    const cleanedCurrent = cleanGradeName(student.gradeLevel);
                                    const suggestion = status.approved ? getNextGrade(student.gradeLevel) : cleanedCurrent;
                                    const currentSelection = destinationGrades[student.id] || suggestion;

                                    return (
                                        <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="font-bold text-gray-900">{student.name}</div>
                                                <div className="text-xs text-gray-400 font-mono">#{student.code}</div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-600">{student.gradeLevel}</td>
                                            <td className="px-4 py-4">
                                                <span className={`text-[10px] font-extrabold uppercase px-2 py-1 rounded-full bg-opacity-10 border ${status.color.replace('text', 'border')} ${status.color.replace('text', 'bg')} ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <select
                                                    value={currentSelection}
                                                    onChange={e => handleGradeChange(student.id, e.target.value)}
                                                    className={`w-full p-2 rounded border text-sm font-bold ${currentSelection === cleanedCurrent ? 'border-red-200 bg-red-50 text-red-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}
                                                >
                                                    {loadingAcademic ? (
                                                        <option>Carregando...</option>
                                                    ) : (
                                                        academicGrades.map(g => (
                                                            <option key={g.id} value={g.name}>{g.name}</option>
                                                        ))
                                                    )}
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 flex gap-3">
                <span className="text-xl">⚠️</span>
                <p className="text-sm text-orange-800">
                    <strong>Atenção:</strong> A confirmação da rematrícula é irreversível em massa.
                    O sistema arquivará a série de 2025 no histórico do aluno e criará novas pautas de notas vazias para o ano letivo de 2026.
                </p>
            </div>
        </div >
    );
};
