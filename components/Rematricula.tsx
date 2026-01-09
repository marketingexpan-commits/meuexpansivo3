import React, { useState, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { Student, GradeEntry, SchoolUnit, SchoolClass, SchoolShift } from '../types';
import { SCHOOL_GRADES_LIST, SCHOOL_UNITS_LIST, SCHOOL_CLASSES_LIST, SCHOOL_SHIFTS_LIST } from '../src/constants';
import { Button } from './Button';

interface RematriculaProps {
    students: Student[];
    grades: GradeEntry[];
    onRefresh: () => Promise<void>;
    currentAdminUnit?: SchoolUnit; // Nova prop opcional
}

export const Rematricula: React.FC<RematriculaProps> = ({ students, grades, onRefresh, currentAdminUnit }) => {
    // Se houver currentAdminUnit, usamos ela como estado inicial e imutável
    const [selectedUnit, setSelectedUnit] = useState<SchoolUnit | ''>(currentAdminUnit || '');
    const [selectedGrade, setSelectedGrade] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<SchoolClass | ''>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);

    // Estado para armazenar as seleções de série destino (2026) editadas pelo usuário
    const [destinationGrades, setDestinationGrades] = useState<Record<string, string>>({});

    const SUBJECTS = [
        'Artes', 'Biologia', 'Ciências', 'Educação Física', 'Empreendedorismo',
        'Ensino Religioso', 'Espanhol', 'Filosofia', 'Física', 'Geografia',
        'História', 'Inglês', 'Literatura', 'Matemática', 'Musicalização',
        'Português', 'Projeto de Vida', 'Química', 'Redação', 'Sociologia'
    ];

    const getNextGrade = (currentGrade: string) => {
        const index = SCHOOL_GRADES_LIST.indexOf(currentGrade);
        if (index === -1 || index === SCHOOL_GRADES_LIST.length - 1) return currentGrade;
        return SCHOOL_GRADES_LIST[index + 1];
    };

    const getBimesterStatus = (student: Student) => {
        const isInfantil = student.gradeLevel.includes('Nível') || student.gradeLevel.includes('Infantil');
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

            if (selectedGrade && s.gradeLevel !== selectedGrade) return false;
            if (selectedClass && s.schoolClass !== selectedClass) return false;
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return s.name.toLowerCase().includes(searchLower) || s.code.toLowerCase().includes(searchLower);
            }
            return true;
        });
    }, [students, selectedUnit, selectedGrade, selectedClass, searchTerm, currentAdminUnit]);

    const handleGradeChange = (studentId: string, newGrade: string) => {
        setDestinationGrades(prev => ({ ...prev, [studentId]: newGrade }));
    };

    const handleConfirmRematricula = async () => {
        if (!window.confirm(`Deseja confirmar a rematrícula de ${filteredStudents.length} alunos para o ano letivo de 2026?`)) return;

        setIsExecuting(true);
        try {
            const batch = db.batch();
            const now = new Date().toISOString();

            for (const student of filteredStudents) {
                const status = getBimesterStatus(student);
                const destGrade = destinationGrades[student.id] || (status.approved ? getNextGrade(student.gradeLevel) : student.gradeLevel);

                // 1. Atualizar registro do Aluno
                const studentRef = db.collection('students').doc(student.id);
                batch.update(studentRef, {
                    historico_escolar_2025: student.gradeLevel,
                    gradeLevel: destGrade,
                    lastUpdated: now
                });

                // 2. Se for Fundamental/Médio, criar novas pautas de notas para 2026
                const isInfantil = destGrade.includes('Nível') || destGrade.includes('Infantil');
                if (!isInfantil) {
                    for (const subject of SUBJECTS) {
                        const gradeId = `${student.id}_${subject.replace(/\s+/g, '_')}_2026`;
                        const gradeRef = db.collection('grades').doc(gradeId);
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
                            situacaoFinal: 'Recuperação',
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
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
                            {currentAdminUnit}
                        </div>
                    ) : (
                        <select
                            value={selectedUnit}
                            onChange={e => setSelectedUnit(e.target.value as SchoolUnit)}
                            className="w-full p-2 rounded-lg border border-blue-200 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Todas as Unidades</option>
                            {SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}
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
                        {SCHOOL_GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
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
                                    const suggestion = status.approved ? getNextGrade(student.gradeLevel) : student.gradeLevel;
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
                                                    className={`w-full p-2 rounded border text-sm font-bold ${currentSelection === student.gradeLevel ? 'border-red-200 bg-red-50 text-red-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}
                                                >
                                                    {SCHOOL_GRADES_LIST.map(g => (
                                                        <option key={g} value={g}>{g}</option>
                                                    ))}
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
