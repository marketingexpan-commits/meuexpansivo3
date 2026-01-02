import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { StudentForm } from '../components/StudentForm';
import { Plus, Search, Filter, Loader2, Printer } from 'lucide-react';
import { studentService } from '../services/studentService';
import type { Student } from '../types';
import { EDUCATION_LEVELS, GRADES_BY_LEVEL, SCHOOL_SHIFTS, SCHOOL_CLASSES_OPTIONS } from '../types';

import { financialService } from '../services/financialService';
import { generateCarne } from '../utils/carneGenerator';
import { generateStudentList } from '../utils/studentListGenerator';
import { FileText, Pencil } from 'lucide-react';

export function Matriculas() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);

    const [searchTerm, setSearchTerm] = useState('');

    // Estados dos filtros
    const [filterGrade, setFilterGrade] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterShift, setFilterShift] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const hasActiveFilters = filterGrade || filterClass || filterShift || filterStatus || searchTerm;

    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isLoading, setIsLoading] = useState(true);


    const loadStudents = async () => {
        try {
            setIsLoading(true);

            // Determinar filtro de unidade baseado no login
            const userUnit = localStorage.getItem('userUnit');
            let unitFilter: string | null = null;

            // Mapeamento: Login ID -> Database Name
            const unitMapping: Record<string, string> = {
                'unit_zn': 'Zona Norte',
                'unit_ext': 'Extremoz',
                'unit_qui': 'Quintas',
                'unit_bs': 'Boa Sorte'
            };

            // Se for admin, vê tudo (null). Se for unidade, filtra pelo nome exato.
            if (userUnit && userUnit !== 'admin_geral') {
                unitFilter = unitMapping[userUnit];
            }

            const data = await studentService.getStudents(unitFilter);
            setStudents(data);
        } catch (error) {
            console.error("Erro ao carregar alunos:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadStudents();
    }, []);

    // Filter students based on search term AND advanced filters
    const filteredStudents = students.filter(student => {
        const searchLower = searchTerm.toLowerCase();

        const matchesSearch = (
            student.name.toLowerCase().includes(searchLower) ||
            (student.code && student.code.toLowerCase().includes(searchLower)) ||
            (student.cpf_aluno && student.cpf_aluno.includes(searchLower))
        );

        const matchesGrade = !filterGrade || (() => {
            // Case 1: Filter is a broad Level (e.g. "Ensino Médio") - check if student grade allows any of the level's grades
            if (GRADES_BY_LEVEL[filterGrade]) {
                return GRADES_BY_LEVEL[filterGrade].some(g => student.gradeLevel && student.gradeLevel.includes(g));
            }
            // Case 2: Filter is a specific Grade (e.g. "1ª Série") - check if student grade string contains the filter
            return student.gradeLevel && student.gradeLevel.includes(filterGrade);
        })();
        const matchesClass = !filterClass || student.schoolClass === filterClass;
        const matchesShift = !filterShift || student.shift === filterShift;
        const matchesStatus = !filterStatus || (filterStatus === 'active' ? !student.isBlocked : student.isBlocked);

        return matchesSearch && matchesGrade && matchesClass && matchesShift && matchesStatus;
    });

    const clearFilters = () => {
        setFilterGrade('');
        setFilterClass('');
        setFilterShift('');
        setFilterStatus('');
        setSearchTerm('');
    };

    const handleFormClose = (shouldRefresh?: boolean) => {
        setIsFormOpen(false);
        setSelectedStudent(null);
        if (shouldRefresh) {
            loadStudents();
        }
    };

    const handleEdit = (student: Student) => {
        setSelectedStudent(student);
        setIsFormOpen(true);
    };

    const handlePrintCarne = async (student: Student) => {
        const year = new Date().getFullYear(); // Ou permitir escolher, por padrão ano atual
        const confirmPrint = confirm(`Deseja imprimir o carnê de ${year} para ${student.name}?`);
        if (!confirmPrint) return;

        try {
            // Busca parcelas do ano
            const installments = await financialService.getInstallmentsForPrint(student.id, year) as any[];

            if (installments.length === 0) {
                alert("Nenhuma parcela pendente encontrada para este aluno neste ano.");
                return;
            }

            // Gerar PDF/Janela
            generateCarne(student, installments);

        } catch (error) {
            console.error(error);
            alert("Erro ao buscar dados para o carnê.");
        }
    };




    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestão de Matrículas</h1>
                        {students.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-blue-100 shadow-sm">
                                    {students.length} Alunos
                                </span>
                                {hasActiveFilters && filteredStudents.length !== students.length && (
                                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-left-2 transition-all">
                                        {filteredStudents.length} Filtrados
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <p className="text-slate-500 text-sm">Gerencie alunos, enturmações e vagas escolares.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => setIsFormOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Matrícula
                    </Button>
                </div>
            </div>

            {isFormOpen && <StudentForm onClose={handleFormClose} student={selectedStudent} />}

            {/* Filters & Search */}
            <div className="space-y-4">
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-4 flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                className="pl-9 bg-slate-50 border-slate-200"
                                placeholder="Buscar por nome do aluno, matrícula ou CPF..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm bg-slate-50">
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                            <Select
                                label="Nível/Série"
                                value={filterGrade}
                                onChange={(e) => setFilterGrade(e.target.value)}
                                options={[
                                    ...EDUCATION_LEVELS, // Allow filtering by Level broadly? Or just Grades? 
                                    // The original had mixed level and grades.
                                    // Let's offer all grades flattened + levels if needed. 
                                    // Actually, user wants "levels, grades... according to app".
                                    // Usually filters are specific.
                                    // Let's flattening all grades:
                                    ...Object.values(GRADES_BY_LEVEL).flat().map(g => ({ label: g, value: g }))
                                ]}
                            />
                            <Select
                                label="Turma"
                                value={filterClass}
                                onChange={(e) => setFilterClass(e.target.value)}
                                options={SCHOOL_CLASSES_OPTIONS}
                            />
                            <Select
                                label="Turno"
                                value={filterShift}
                                onChange={(e) => setFilterShift(e.target.value)}
                                options={SCHOOL_SHIFTS}
                            />
                            <Select
                                label="Situação"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                options={[
                                    { label: 'Ativo', value: 'active' },
                                    { label: 'Bloqueado', value: 'blocked' },
                                ]}
                            />
                            <Button variant="ghost" onClick={clearFilters} className="w-full text-slate-500 hover:text-red-500 hover:bg-red-50">
                                Limpar Filtros
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Results Summary */}
            {hasActiveFilters && filteredStudents.length > 0 && (() => {
                const missingEnturmacao = filteredStudents.filter(s => !s.schoolClass || !s.shift).length;
                return (
                    <div className="flex flex-col sm:flex-row items-center gap-3 justify-center bg-white border border-slate-200 py-3 px-6 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 text-slate-700 font-semibold whitespace-nowrap">
                            <span className="text-indigo-600 flex items-center justify-center bg-indigo-50 w-6 h-6 rounded-full text-xs">
                                <Search className="w-3.5 h-3.5" />
                            </span>
                            <span>Resultado da Pesquisa:</span>
                            <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded-lg font-bold text-xs tabular-nums">
                                {filteredStudents.length} {filteredStudents.length === 1 ? 'aluno' : 'alunos'}
                            </span>
                        </div>

                        <div className="hidden sm:block text-slate-300">|</div>

                        <div className="flex items-center gap-3 text-sm">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span className="text-slate-500 font-medium">Enturmados:</span>
                                <span className="text-slate-900 font-bold tabular-nums">{filteredStudents.length - missingEnturmacao}</span>
                            </div>
                            {missingEnturmacao > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 rounded-lg border border-amber-100">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                    <span className="text-amber-700 font-medium">Sem Turma/Turno:</span>
                                    <span className="text-amber-900 font-bold tabular-nums">{missingEnturmacao}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Students List Grouped by Class */}
            {!hasActiveFilters ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-xl">
                    <Filter className="w-12 h-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700">Selecione filtros para visualizar</h3>
                    <p className="text-slate-500 max-w-md text-center">Use a barra de pesquisa ou os filtros acima para encontrar turmas e alunos específicos.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(
                        filteredStudents.reduce((acc, student) => {
                            // Normalizar String da Série
                            const normalizedGrade = student.gradeLevel
                                ? student.gradeLevel.trim().toUpperCase()
                                    .replace(/\s+/g, ' ')
                                    .replace('NÍVEL 5', 'NÍVEL V')
                                    .replace('NIVEL 5', 'NÍVEL V')
                                    .replace('NIVEL V', 'NÍVEL V')
                                : 'Série não informada';

                            const key = (student.schoolClass && student.shift)
                                ? `${normalizedGrade} - Turma ${student.schoolClass} / ${student.shift}`
                                : `${normalizedGrade} - Pendente de Enturmação`;

                            if (!acc[key]) acc[key] = [];
                            acc[key].push(student);
                            return acc;
                        }, {} as Record<string, Student[]>)
                    )
                        .sort(([keyA], [keyB]) => {
                            // Custom sort logic to respect academic levels
                            const getLevelIndex = (str: string) => {
                                // Key ex: "1ª Série - Ens. Médio - Turma A / Matutino"
                                // Key ex: "Nível V - Edu. Infantil - Turma A / Matutino"
                                // Key ex: "6º Ano - Fundamental II - Turma A / Matutino"

                                if (str.includes('Edu. Infantil') || str.includes('Nível')) return 0;
                                if (str.includes('Fundamental I') || (str.includes('Ano') && ['1º', '2º', '3º', '4º', '5º'].some(g => str.startsWith(g)))) return 1;
                                if (str.includes('Fundamental II') || (str.includes('Ano') && ['6º', '7º', '8º', '9º'].some(g => str.startsWith(g)))) return 2;
                                if (str.includes('Ens. Médio') || str.includes('Série')) return 3;
                                return 4; // Outros
                            };

                            const levelA = getLevelIndex(keyA);
                            const levelB = getLevelIndex(keyB);

                            if (levelA !== levelB) return levelA - levelB;
                            return keyA.localeCompare(keyB, undefined, { numeric: true });
                        })
                        .map(([groupName, studentsInGroup]) => (
                            <Card key={groupName} className="border-slate-200 shadow-sm overflow-hidden">
                                <CardHeader className={`${groupName.includes('Pendente') ? 'bg-amber-50/50' : 'bg-slate-50/80'} border-b border-slate-100 py-3 px-4 flex flex-row items-center justify-between`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-8 rounded-full ${groupName.includes('Pendente') ? 'bg-amber-400' :
                                            groupName.includes('ENS. MÉDIO') ? 'bg-indigo-500' :
                                                groupName.includes('FUNDAMENTAL II') ? 'bg-blue-500' :
                                                    groupName.includes('FUNDAMENTAL I') ? 'bg-sky-500' :
                                                        groupName.includes('INFANTIL') || groupName.includes('NÍVEL') ? 'bg-rose-400' : 'bg-slate-400'
                                            }`}></div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                                                {groupName}
                                                {groupName.includes('Pendente') && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">Atenção</span>}
                                            </h3>
                                            <p className="text-xs text-slate-500 font-medium">{studentsInGroup.length} aluno(s)</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-slate-400 uppercase font-bold mr-1 hidden sm:inline">Imprimir Relação de Alunos:</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                            onClick={() => generateStudentList(studentsInGroup, groupName, 'simple')}
                                            title="Lista Simples (A4 Retrato)"
                                        >
                                            <FileText className="w-3 h-3 mr-1" />
                                            Simples
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                            onClick={() => generateStudentList(studentsInGroup, groupName, 'complete')}
                                            title="Lista Completa (A4 Paisagem)"
                                        >
                                            <Printer className="w-3 h-3 mr-1" />
                                            Completa
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="relative overflow-x-auto">
                                        <table className="w-full text-sm text-left text-slate-500">
                                            <thead className="text-xs text-slate-700 uppercase bg-white border-b border-slate-100">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3 w-[40%]">Aluno</th>
                                                    <th scope="col" className="px-6 py-3">Matrícula</th>
                                                    <th scope="col" className="px-6 py-3 text-center">Situação</th>
                                                    <th scope="col" className="px-6 py-3 text-right">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {studentsInGroup.sort((a, b) => a.name.localeCompare(b.name)).map((student) => (
                                                    <tr key={student.id} className="bg-white hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-3 font-medium text-slate-900 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold">{student.name}</span>
                                                                <span className="text-[11px] text-slate-400">{student.cpf_aluno || 'CPF não inf.'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 text-xs font-mono text-slate-600">{student.code || '-'}</td>
                                                        <td className="px-6 py-3 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${(!student.status || student.status === 'CURSANDO' || student.status === 'ATIVO')
                                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                                        : (student.status === 'REPROVADO' || student.status === 'EVADIDO' || student.status === 'TRANSFERIDO')
                                                                            ? "bg-red-50 text-red-700 border-red-100"
                                                                            : "bg-slate-50 text-slate-600 border-slate-200"
                                                                    }`}>
                                                                    {student.status || 'CURSANDO'}
                                                                </span>
                                                                <span className={`text-[9px] font-medium ${student.isBlocked ? 'text-red-400' : 'text-slate-400'}`}>
                                                                    {student.isBlocked ? 'Acesso Bloqueado' : 'Acesso Ativo'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 text-right flex justify-end gap-2 items-center">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleEdit(student)}
                                                                className="h-7 px-3 text-xs font-medium text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                                                            >
                                                                <Pencil className="w-3 h-3 mr-1.5" />
                                                                Editar
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => handlePrintCarne(student)} className="h-8 w-8 p-0 rounded-full hover:bg-purple-50 hover:text-purple-600" title="Imprimir Carnê">
                                                                <Printer className="w-4 h-4" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                    {filteredStudents.length === 0 && !isLoading && (
                        <Card className="border-dashed border-2 border-slate-200 shadow-none bg-slate-50/50">
                            <CardContent className="px-6 py-12 text-center text-slate-400">
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <Search className="w-8 h-8 text-slate-300" />
                                    <span>Nenhum aluno encontrado com os filtros atuais.</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {isLoading && (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

