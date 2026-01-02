import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { StudentForm } from '../components/StudentForm';
import { Plus, Search, Filter, Loader2, Printer } from 'lucide-react';
import { studentService } from '../services/studentService';
import type { Student } from '../types';
import { EDUCATION_LEVELS, GRADES_BY_LEVEL, SCHOOL_SHIFTS, SCHOOL_CLASSES_OPTIONS } from '../types';
import { normalizeClass } from '../utils/academicUtils';
import { financialService } from '../services/financialService';
import { generateCarne } from '../utils/carneGenerator';

export function Matriculas() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false); // Toggle filtros
    const [students, setStudents] = useState<Student[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Estados dos filtros
    const [filterGrade, setFilterGrade] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterShift, setFilterShift] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

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

        const matchesGrade = !filterGrade || student.gradeLevel === filterGrade;
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

    const handleBatchFix = async () => {
        if (!confirm("Isso irá converter turmas '3' para 'A' e '4' para 'B' em TODOS os alunos. Deseja continuar?")) return;
        try {
            setIsLoading(true);
            const count = await studentService.batchUpdateClassesNumericalToLetter();
            alert(`Correção finalizada! ${count} alunos atualizados.`);
            loadStudents();
        } catch (error) {
            alert("Erro ao executar correção.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleBatchFixDefault = async () => {
        if (!confirm("Isso irá definir a turma como 'A' para TODOS os alunos sem turma (vazios). Use isto se a maioria das suas turmas forem únicas (Turma A). Deseja continuar?")) return;
        try {
            setIsLoading(true);
            const count = await studentService.batchFixMissingClassesDefaultA();
            alert(`Processo finalizado! ${count} alunos foram atualizados para Turma A.`);
            loadStudents();
        } catch (error) {
            alert("Erro ao executar atualização.");
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestão de Matrículas</h1>
                    <p className="text-slate-500 text-sm">Gerencie alunos, enturmações e vagas escolares.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={isFiltersOpen ? "primary" : "outline"}
                        className="hidden sm:flex"
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        Filtros
                    </Button>
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

                {isFiltersOpen && (
                    <Card className="border-slate-200 shadow-sm bg-slate-50">
                        <CardContent className="p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                <div className="sm:col-span-2 lg:col-span-1">
                                    <Button variant="ghost" onClick={handleBatchFix} className="text-xs text-orange-500 hover:bg-orange-50 w-full">
                                        Corrigir Turmas (3→A)
                                    </Button>
                                </div>
                                <div className="sm:col-span-2 lg:col-span-1 hidden">
                                    {/* Secret or visible tool based on user request */}
                                    <Button variant="ghost" onClick={handleBatchFix} className="text-xs text-orange-500 hover:bg-orange-50">
                                        Corrigir Turmas (3→A)
                                    </Button>
                                </div>
                                <div className="sm:col-span-2 lg:col-span-1">
                                    <Button variant="ghost" onClick={handleBatchFixDefault} className="text-xs text-blue-600 hover:bg-blue-50 w-full" title="Define a turma como 'A' para todos os alunos que estão sem turma">
                                        Preencher Vazios (Padrão A)
                                    </Button>
                                </div>



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
                )}
            </div>

            {/* Students Table */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                    <CardTitle className="text-sm font-medium text-slate-700">Listagem de Alunos ({filteredStudents.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-500">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Aluno</th>
                                    <th scope="col" className="px-6 py-3">Matrícula</th>
                                    <th scope="col" className="px-6 py-3">Série/Turma</th>
                                    <th scope="col" className="px-6 py-3">Situação</th>
                                    <th scope="col" className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr className="bg-white border-b">
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex justify-center items-center gap-2">
                                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                                <span>Carregando alunos...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredStudents.length === 0 ? (
                                    <tr className="bg-white border-b hover:bg-slate-50">
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Search className="w-8 h-8 text-slate-200" />
                                                <span>Nenhum aluno encontrado.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((student) => (
                                        <tr key={student.id} className="bg-white border-b hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span>{student.name}</span>
                                                    <span className="text-xs text-slate-500">{student.cpf_aluno || 'CPF não inf.'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{student.code || '-'}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span>{student.gradeLevel || '-'}</span>
                                                    {(student.schoolClass || student.shift) && (
                                                        <span className="text-xs text-slate-500 font-medium">
                                                            {normalizeClass(student.schoolClass)}{student.schoolClass && student.shift ? ', ' : ''}{student.shift}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-slate-400 capitalize">{student.unit}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={student.isBlocked ? "text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-medium" : "text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-medium"}>
                                                    {student.isBlocked ? 'Bloqueado' : 'Ativo'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => {
                                                    const keys = Object.keys(student).sort().join('\n');
                                                    alert(`Campos encontrados:\n${keys}\n\n---- DADOS COMPLETOS ----\n${JSON.stringify(student, null, 2)}`);
                                                }} title="Ver Estrutura de Dados">
                                                    <Search className="w-4 h-4 text-slate-400" />
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleEdit(student)}>
                                                    Editar
                                                </Button>
                                                <Button variant="secondary" size="sm" onClick={() => handlePrintCarne(student)} title="Imprimir Carnê">
                                                    <Printer className="w-4 h-4 text-slate-600" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
