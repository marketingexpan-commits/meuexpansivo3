import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { StudentForm } from '../components/StudentForm';
import { Search, Filter, Loader2, Printer, Barcode, ShieldAlert, ShieldCheck } from 'lucide-react';
import { studentService } from '../services/studentService';
import type { Student } from '../types';
import { SCHOOL_SHIFTS, SCHOOL_CLASSES_OPTIONS } from '../utils/academicDefaults';
import { SHIFT_LABELS, SchoolShift } from '../types';
import { useAcademicData } from '../hooks/useAcademicData';
import { getCurrentSchoolYear, parseGradeLevel, normalizeClass } from '../utils/academicUtils';

import { financialService } from '../services/financialService';
import { generateCarne } from '../utils/carneGenerator';
import { generateStudentList } from '../utils/studentListGenerator';
import { useSchoolUnits } from '../hooks/useSchoolUnits';
import { FileText, Pencil, Trash2 } from 'lucide-react';

export function Matriculas() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();

    const [searchTerm, setSearchTerm] = useState('');
    const { segments, grades, loading: loadingAcademic } = useAcademicData();
    const { getUnitById } = useSchoolUnits();

    // Estados dos filtros
    const [filterGrade, setFilterGrade] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterShift, setFilterShift] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const hasActiveFilters = filterGrade || filterClass || filterShift || (filterStatus && filterStatus !== 'active') || searchTerm;

    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);


    // Effect to handle URL actions
    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            setIsFormOpen(true);
            setSelectedStudent(null);
        }
    }, [searchParams]);

    // State for Admin Unit Selection - Read Only from Global Context
    const [adminUnit, setAdminUnit] = useState<string | null>(localStorage.getItem('adminSelectedUnitCode'));

    useEffect(() => {
        const handleUnitChange = () => {
            // Upstream changed (Dashboard), so we update local state to trigger reload
            const newUnit = localStorage.getItem('adminSelectedUnitCode');
            setAdminUnit(newUnit);
            loadStudents(newUnit);
        };

        window.addEventListener('adminUnitChange', handleUnitChange);
        return () => window.removeEventListener('adminUnitChange', handleUnitChange);
    }, []);

    const loadStudents = async (overrideUnit?: string | null) => {
        try {
            setIsLoading(true);

            // Determinar filtro de unidade baseado no login
            const userUnit = localStorage.getItem('userUnit');
            let unitFilter: string | null = null;

            if (userUnit && userUnit === 'admin_geral') {
                // Use the passed override or current state or localStorage
                unitFilter = overrideUnit !== undefined ? overrideUnit : (adminUnit || localStorage.getItem('adminSelectedUnitCode'));
            } else if (userUnit && userUnit !== 'admin_geral') {
                unitFilter = userUnit;
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
        const currentYear = getCurrentSchoolYear();
        const searchLower = searchTerm.toLowerCase();

        // 1. Get Enrollment for selected Year
        const enrollment = student.enrollmentHistory?.find(h => h.year === currentYear);

        // Dynamic fields for display/filter
        const displayGrade = enrollment?.gradeLevel || student.gradeLevel;
        const displayClass = enrollment?.schoolClass || student.schoolClass;
        const displayShift = enrollment?.shift || student.shift;
        const displayStatus = enrollment?.status || student.status || 'CURSANDO';

        // SMART SEARCH LOGIC:
        // If the search term is a number AND matches a student code exactly,
        // we show ONLY that student (ignoring CPFs that happen to contain those digits).
        const isExactCodeMatch = /^\d+$/.test(searchTerm) && students.some(s => s.code === searchTerm);

        // 2. Strict Year Filtering Logic
        // If the student has ANY enrollment history, they MUST have an entry for the current year to be shown.
        // Exception: Unless we are in "Historical" mode (handled by different component usually, but here we expect strictly current year context).
        // Exception 2: If the student has NO history (freshly created), we show them as "Pending".
        if (currentYear !== 'HISTORICAL') {
            const hasAnyHistory = student.enrollmentHistory && student.enrollmentHistory.length > 0;
            const isStudentActive = student.status === 'CURSANDO' || student.status === 'ATIVO';

            if (hasAnyHistory && !enrollment && !isStudentActive) {
                return false; // Student belongs to past years only and is not active anymore
            }
        }

        const matchesSearch = isExactCodeMatch
            ? student.code === searchTerm
            : (
                student.name.toLowerCase().includes(searchLower) ||
                (student.code && student.code.toLowerCase().includes(searchLower)) ||
                (student.cpf_aluno && student.cpf_aluno.includes(searchLower))
            );

        const matchesGrade = !filterGrade || (() => {
            const segment = segments.find(s => s.name === filterGrade);
            if (segment) {
                const segmentGrades = grades.filter(g => g.segmentId === segment.id).map(g => g.name);
                return segmentGrades.some(g => displayGrade && typeof displayGrade === 'string' && displayGrade.includes(g));
            }

            // Safer Logic using parseGradeLevel to avoid "Nível I" matching "Nível II"
            if (!displayGrade || typeof displayGrade !== 'string') return false;

            const { grade: parsedName } = parseGradeLevel(displayGrade);
            return parsedName === filterGrade;
        })();
        const matchesClass = !filterClass || displayClass === filterClass;
        const matchesShift = !filterShift || displayShift === filterShift;
        const matchesStatus = !filterStatus || (() => {
            if (filterStatus === 'active') {
                return !student.isBlocked && displayStatus !== 'CONCLUÍDO' && displayStatus !== 'EVADIDO' && displayStatus !== 'TRANSFERIDO';
            }
            if (filterStatus === 'archived') {
                return displayStatus === 'CONCLUÍDO' || displayStatus === 'EVADIDO' || displayStatus === 'TRANSFERIDO';
            }
            if (filterStatus === 'blocked') {
                return student.isBlocked;
            }
            return displayStatus === filterStatus;
        })();

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
        // Clean URL params
        if (searchParams.get('action') === 'new') {
            setSearchParams({});
        }

        if (shouldRefresh) {
            loadStudents();
        }
    };

    const handleEdit = (student: Student) => {
        setSelectedStudent(student);
        setIsFormOpen(true);
    };

    const handleDelete = async (student: Student) => {
        if (!confirm(`TEM CERTEZA que deseja excluir permanentemente o aluno ${student.name}?\n\nEsta ação excluirá todos os dados do aluno e NÃO pode ser desfeita.`)) {
            return;
        }

        try {
            await studentService.deleteStudent(student.id);
            alert("Aluno excluído com sucesso.");
            loadStudents(); // Recarregar lista
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir aluno.");
        }
    };

    const handlePrintCarne = async (student: Student) => {
        const year = new Date().getFullYear(); // Ou permitir escolher, por padrão ano atual
        const confirmPrint = confirm(`Deseja imprimir o carnê de ${year} para ${student.name}?`);
        if (!confirmPrint) return;

        try {
            // Busca parcelas do ano
            // Busca parcelas do ano
            const rawInstallments = await financialService.getInstallmentsForPrint(student.id, year) as any[];

            if (rawInstallments.length === 0) {
                alert("Nenhuma parcela pendente encontrada para este aluno neste ano.");
                return;
            }

            // Garantir que todas as parcelas têm Código de Baixa Sequencial (self-healing)
            const installments = await financialService.ensureSequentialDocumentNumbers(rawInstallments);

            // Gerar PDF/Janela
            const unitDetail = getUnitById(student.unit);
            if (!unitDetail) {
                alert("Dados da unidade não encontrados.");
                return;
            }
            generateCarne(student, installments, unitDetail);

        } catch (error) {
            console.error(error);
            alert("Erro ao buscar dados para o carnê.");
        }
    };

    const handleToggleBlock = async (student: Student) => {
        const newStatus = !student.isBlocked;
        if (!confirm(`Deseja ${newStatus ? 'BLOQUEAR' : 'DESBLOQUEAR'} o acesso do aluno ${student.name} ao aplicativo?`)) return;

        try {
            await studentService.updateStudent(student.id, { isBlocked: newStatus });
            setStudents(prev => prev.map(s => s.id === student.id ? { ...s, isBlocked: newStatus } : s));
        } catch (error) {
            console.error(error);
            alert("Erro ao atualizar status de acesso.");
        }
    };

    const handleGenerateBoletosForStudent = async (student: Student) => {
        const year = new Date().getFullYear();
        const now = new Date();
        const limitDate = new Date();
        limitDate.setDate(now.getDate() + 28);

        try {
            const installments = await financialService.getInstallmentsForPrint(student.id, year) as any[];
            const pending = installments.filter(inst => inst.status !== 'Pago' && !inst.barcode);

            // Filter for installments eligible for Mercado Pago (limit 29 days)
            const eligible = pending.filter(inst => {
                const dueDate = new Date(inst.dueDate);
                return dueDate <= limitDate;
            });

            if (eligible.length === 0) {
                alert("Não há mensalidades pendentes com vencimento nos próximos 28 dias. O Mercado Pago não permite gerar boletos para datas muito distantes.");
                return;
            }

            // For the test, we take only the first one (avulso)
            const inst = eligible[0];

            if (!confirm(`Gerar boleto AVULSO para a mensalidade de ${inst.month}?`)) return;

            setIsGenerating(true);

            const payerName = student.nome_responsavel || student.name;
            const payer = {
                email: student.email_responsavel || 'email@padrao.com',
                firstName: payerName.split(' ')[0],
                lastName: payerName.split(' ').slice(1).join(' ') || 'Responsável',
                cpf: student.cpf_responsavel || '00000000000',
                address: {
                    zipCode: (student.cep || '').replace(/\D/g, '') || '59000000',
                    streetName: student.endereco_logradouro || 'Endereço não informado',
                    streetNumber: student.endereco_numero || 'S/N',
                    neighborhood: student.endereco_bairro || 'Bairro',
                    city: student.endereco_cidade || 'Natal',
                    state: student.endereco_uf || 'RN'
                }
            };

            const parseCurrency = (val: any) => {
                if (typeof val === 'number') return val;
                if (!val) return 0;
                const clean = String(val).replace(/[^\d,.]/g, '');
                if (clean.includes(',') && clean.includes('.')) {
                    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
                } else if (clean.includes(',')) {
                    return parseFloat(clean.replace(',', '.'));
                }
                return parseFloat(clean) || 0;
            };

            const cleanAmount = parseCurrency(inst.value);

            const boletoData = await financialService.generateBoleto({
                studentId: student.id,
                amount: cleanAmount,
                dueDate: new Date(inst.dueDate).toISOString(),
                description: `Mensalidade ${inst.month} - ${student.name}`,
                payer: payer
            });

            const updates: any = {
                barcode: boletoData.barcode,
                digitableLine: boletoData.digitableLine,
                mpPaymentId: boletoData.id,
                ticketUrl: boletoData.ticketUrl,
                qrCode: boletoData.qrCode,
                qrCodeBase64: boletoData.qrCodeBase64
            };

            if (!inst.documentNumber) {
                const monthIdx = parseInt(financialService._getMonthNumber(inst.month));
                updates.documentNumber = financialService._generateDocumentNumber(monthIdx);
            }

            await financialService.updateInstallment(inst.id, updates);

            alert(`Boleto de ${inst.month} gerado com sucesso para ${student.name}!`);
        } catch (error: any) {
            console.error("Erro ao gerar boleto:", error);
            alert(`Erro ao gerar boleto: ${error.message}\n\nVerifique o cadastro do aluno (CPF, Endereço, etc) ou se a parcela está dentro do prazo de 29 dias.`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateBoletosForGroup = async (studentsList: Student[], groupName: string) => {
        const now = new Date();
        const limitDate = new Date();
        limitDate.setDate(now.getDate() + 28);

        if (!confirm(`Deseja tentar gerar boletos pendentes (próximos 28 dias) para os ${studentsList.length} alunos do grupo "${groupName}"?`)) return;

        setIsGenerating(true);
        let totalGenerated = 0;
        let studentsWithNewBoletos = 0;

        try {
            for (const student of studentsList) {
                const year = new Date().getFullYear();
                const installments = await financialService.getInstallmentsForPrint(student.id, year) as any[];
                const pending = installments.filter(inst => inst.status !== 'Pago' && !inst.barcode);

                // Filter for installments eligible for Mercado Pago (limit 29 days)
                const eligible = pending.filter(inst => {
                    const dueDate = new Date(inst.dueDate);
                    return dueDate <= limitDate;
                });

                if (eligible.length > 0) {
                    let studentGenerated = 0;
                    for (const inst of eligible) {
                        try {
                            const payerName = student.nome_responsavel || student.name;
                            const payer = {
                                email: student.email_responsavel || 'email@padrao.com',
                                firstName: payerName.split(' ')[0],
                                lastName: payerName.split(' ').slice(1).join(' ') || 'Responsável',
                                cpf: student.cpf_responsavel || '00000000000',
                                address: {
                                    zipCode: (student.cep || '').replace(/\D/g, '') || '59000000',
                                    streetName: student.endereco_logradouro || 'Endereço não informado',
                                    streetNumber: student.endereco_numero || 'S/N',
                                    neighborhood: student.endereco_bairro || 'Bairro',
                                    city: student.endereco_cidade || 'Natal',
                                    state: student.endereco_uf || 'RN'
                                }
                            };

                            const parseCurrency = (val: any) => {
                                if (typeof val === 'number') return val;
                                if (!val) return 0;
                                const clean = String(val).replace(/[^\d,.]/g, '');
                                if (clean.includes(',') && clean.includes('.')) {
                                    return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
                                } else if (clean.includes(',')) {
                                    return parseFloat(clean.replace(',', '.'));
                                }
                                return parseFloat(clean) || 0;
                            };

                            const cleanAmount = parseCurrency(inst.value);

                            const boletoData = await financialService.generateBoleto({
                                studentId: student.id,
                                amount: cleanAmount,
                                dueDate: new Date(inst.dueDate).toISOString(),
                                description: `Mensalidade ${inst.month} - ${student.name}`,
                                payer: payer
                            });

                            const updates: any = {
                                barcode: boletoData.barcode,
                                digitableLine: boletoData.digitableLine,
                                mpPaymentId: boletoData.id,
                                ticketUrl: boletoData.ticketUrl,
                                qrCode: boletoData.qrCode,
                                qrCodeBase64: boletoData.qrCodeBase64
                            };

                            if (!inst.documentNumber) {
                                const monthIdx = parseInt(financialService._getMonthNumber(inst.month));
                                updates.documentNumber = financialService._generateDocumentNumber(monthIdx);
                            }

                            await financialService.updateInstallment(inst.id, updates);
                            studentGenerated++;
                            totalGenerated++;
                        } catch (err: any) {
                            console.error(`Erro ao gerar boleto para ${student.name} (${inst.month}):`, err);
                        }
                    }
                    if (studentGenerated > 0) studentsWithNewBoletos++;
                }
            }
            alert(`Processo concluído! \n\n${totalGenerated} boletos gerados para ${studentsWithNewBoletos} alunos.`);
        } catch (error) {
            console.error("Erro geral no processamento do grupo:", error);
            alert("Ocorreu um erro durante o processamento do grupo.");
        } finally {
            setIsGenerating(false);
        }
    };




    const handleSyncClasses = async () => {
        if (!confirm("Isso irá verificar TODOS os alunos listados e corrigir a enturmação de 2026 (ex: mudar de 'U' para 'A' se necessário).\n\nDeseja continuar?")) return;

        setIsGenerating(true);
        let fixedCount = 0;

        try {
            const currentYear = getCurrentSchoolYear();

            for (const student of students) {
                // Skip if no history
                if (!student.enrollmentHistory || student.enrollmentHistory.length === 0) continue;

                const history = [...student.enrollmentHistory];
                const index = history.findIndex(h => h.year === currentYear);

                // If enrolled in current year
                if (index >= 0) {
                    // THE FIX: We want everyone to be out of 'U' for 2026.
                    // 1. Calculate the 'Target' class (trust Root, but map 'U' to 'A')
                    const normalizedRoot = normalizeClass(student.schoolClass || 'A');
                    const targetClass = normalizedRoot === 'U' ? 'A' : normalizedRoot;

                    const historyClass = history[index].schoolClass;
                    // 2. Check if we need to update (if history differs from target OR if root is 'U')
                    if (historyClass !== targetClass || (student.schoolClass as any) === 'U') {

                        // Update History Entry
                        history[index] = {
                            ...history[index],
                            schoolClass: targetClass
                        };

                        // Construct Update Payload
                        const updates = {
                            schoolClass: targetClass as any,
                            enrollmentHistory: history
                        };

                        await studentService.updateStudent(student.id, updates);
                        fixedCount++;
                    }
                }
            }

            if (fixedCount > 0) {
                alert(`Sucesso! ${fixedCount} alunos tiveram a enturmação corrigida para 2026.`);
                loadStudents(); // Reload list
            } else {
                alert("Nenhuma correção necessária encontrada. Todos os alunos já estão sincronizados.");
            }

        } catch (error) {
            console.error("Erro na sincronização:", error);
            alert("Erro ao sincronizar turmas.");
        } finally {
            setIsGenerating(false);
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
                                <span className="bg-blue-950/10 text-blue-950 px-2.5 py-0.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border border-blue-950/20 shadow-sm">
                                    {students.length} Alunos
                                </span>
                                {hasActiveFilters && filteredStudents.length !== students.length && (
                                    <span className="bg-blue-950/10 text-blue-950 px-2.5 py-0.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border border-blue-950/20 shadow-sm animate-in fade-in slide-in-from-left-2 transition-all">
                                        {filteredStudents.length} Filtrados
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                </div>

            </div>


            {isFormOpen && (
                <StudentForm
                    onClose={handleFormClose}
                    onSaveSuccess={loadStudents}
                    student={selectedStudent}
                />
            )}

            {/* Filters & Search */}
            <div className="space-y-4">
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-4 flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <Input
                                className="pl-9 bg-slate-50 border-slate-200"
                                placeholder="Buscar por nome do aluno, código ou CPF..."
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
                                options={loadingAcademic ? [{ label: 'Carregando...', value: '' }] : [
                                    ...segments.flatMap(s => [
                                        { label: `--- ${s.name.toUpperCase()} ---`, value: s.name },
                                        ...grades.filter(g => g.segmentId === s.id && g.isActive).map(g => ({ label: g.name, value: g.name }))
                                    ])
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
                                    { label: 'CURSANDO', value: 'CURSANDO' },
                                    { label: 'TRANSFERIDO', value: 'TRANSFERIDO' },
                                    { label: 'EVADIDO', value: 'EVADIDO' },
                                    { label: 'TRANCADO', value: 'TRANCADO' },
                                    { label: 'RESERVADO', value: 'RESERVADO' },
                                    { label: 'REPROVADO', value: 'REPROVADO' },
                                    { label: 'APROVADO', value: 'APROVADO' },
                                    { label: 'ATIVO', value: 'ATIVO' },
                                    { label: 'INATIVO', value: 'INATIVO' },
                                    { label: 'CONCLUÍDO', value: 'CONCLUÍDO' }
                                ]}
                            />
                            <Button
                                variant="outline"
                                onClick={handleSyncClasses}
                                disabled={isGenerating}
                                className="w-full text-slate-500 hover:text-blue-600 hover:bg-blue-50 border-dashed border-slate-300"
                            >
                                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <ShieldCheck className="w-3 h-3 mr-2" />}
                                Sincronizar Turmas
                            </Button>
                            <Button variant="ghost" onClick={clearFilters} className="w-full text-slate-500 hover:text-red-500 hover:bg-red-50">
                                Limpar Filtros
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Results Summary */}
            {
                hasActiveFilters && filteredStudents.length > 0 && (() => {
                    const currentYear = getCurrentSchoolYear();
                    const missingEnturmacao = filteredStudents.filter(s => {
                        const enrollment = s.enrollmentHistory?.find(h => h.year === currentYear);
                        const displayClass = enrollment?.schoolClass || s.schoolClass;
                        const displayShift = enrollment?.shift || s.shift;
                        return !displayClass || !displayShift;
                    }).length;

                    return (
                        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center bg-white border border-slate-200 py-3 px-6 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 text-slate-700 font-semibold whitespace-nowrap">
                                <span className="text-blue-950 flex items-center justify-center bg-blue-950/10 w-6 h-6 rounded-xl text-xs">
                                    <Search className="w-3.5 h-3.5" />
                                </span>
                                <span>Resultado da Pesquisa:</span>
                                <span className="bg-slate-900 text-white px-2.5 py-0.5 rounded-xl font-bold text-xs tabular-nums">
                                    {filteredStudents.length} {filteredStudents.length === 1 ? 'aluno' : 'alunos'}
                                </span>
                            </div>

                            <div className="hidden sm:block text-slate-300">|</div>

                            <div className="flex items-center gap-3 text-sm">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-950"></span>
                                    <span className="text-slate-500 font-medium">Enturmados:</span>
                                    <span className="text-slate-900 font-bold tabular-nums">{filteredStudents.length - missingEnturmacao}</span>
                                </div>
                                {missingEnturmacao > 0 && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 rounded-xl border border-amber-100">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                        <span className="text-amber-700 font-medium">Sem Turma/Turno:</span>
                                        <span className="text-amber-900 font-bold tabular-nums">{missingEnturmacao}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()
            }

            {/* Students List Grouped by Class */}
            {
                !hasActiveFilters ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-xl">
                        <Filter className="w-12 h-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700">Selecione filtros para visualizar</h3>
                        <p className="text-slate-500 max-w-md text-center">Use a barra de pesquisa ou os filtros acima para encontrar turmas e alunos específicos.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(
                            filteredStudents.reduce((acc, student) => {
                                // Obter dados do ano selecionado para agrupamento
                                const currentYear = getCurrentSchoolYear();
                                const enrollment = student.enrollmentHistory?.find(h => h.year === currentYear);

                                const studentGrade = enrollment?.gradeLevel || student.gradeLevel || '';
                                const studentClass = enrollment?.schoolClass || student.schoolClass || '';
                                const studentShift = enrollment?.shift || student.shift || '';

                                // Normalizar String da Série
                                const normalizedGrade = studentGrade
                                    ? studentGrade.trim().toUpperCase()
                                        .replace(/\s+/g, ' ')
                                        .replace('NÍVEL 5', 'NÍVEL V')
                                        .replace('NIVEL 5', 'NÍVEL V')
                                        .replace('NIVEL V', 'NÍVEL V')
                                    : 'Série não informada';

                                const shiftLabel = SHIFT_LABELS[studentShift as SchoolShift] || studentShift;
                                const key = (studentClass && studentShift)
                                    ? `${normalizedGrade} - Turma ${studentClass} / ${shiftLabel}`
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
                                            <div className={`w-2 h-8 rounded-full ${groupName.includes('Pendente') ? 'bg-orange-600' :
                                                groupName.includes('ENS. MÉDIO') ? 'bg-blue-950' :
                                                    groupName.includes('FUNDAMENTAL II') ? 'bg-blue-950' :
                                                        groupName.includes('FUNDAMENTAL I') ? 'bg-blue-950' :
                                                            groupName.includes('INFANTIL') || groupName.includes('NÍVEL') ? 'bg-blue-950' : 'bg-slate-400'
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
                                                className="h-7 px-2 text-xs text-slate-500 hover:text-blue-950 hover:bg-blue-50"
                                                onClick={() => {
                                                    const unitDetail = getUnitById(studentsInGroup[0].unit);
                                                    if (!unitDetail) return alert("Dados da unidade não encontrados.");
                                                    generateStudentList(studentsInGroup, groupName, 'simple', unitDetail);
                                                }}
                                                title="Lista Simples (A4 Retrato)"
                                            >
                                                <FileText className="w-3 h-3 mr-1" />
                                                Simples
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-xs text-slate-500 hover:text-blue-950 hover:bg-blue-50"
                                                onClick={() => {
                                                    const unitDetail = getUnitById(studentsInGroup[0].unit);
                                                    if (!unitDetail) return alert("Dados da unidade não encontrados.");
                                                    generateStudentList(studentsInGroup, groupName, 'complete', unitDetail);
                                                }}
                                                title="Lista Completa (A4 Paisagem)"
                                            >
                                                <Printer className="w-3 h-3 mr-1" />
                                                Completa
                                            </Button>

                                            <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-[10px] text-blue-900 font-bold hover:bg-blue-50"
                                                    onClick={() => handleGenerateBoletosForGroup(studentsInGroup, groupName)}
                                                    disabled={isGenerating}
                                                >
                                                    {isGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Barcode className="w-3 h-3 mr-1" />}
                                                    Gerar Boletos da Turma
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="relative overflow-x-auto">
                                            <table className="w-full text-sm text-left text-slate-500">
                                                <thead className="text-xs text-slate-700 uppercase bg-white border-b border-slate-100">
                                                    <tr>
                                                        <th scope="col" className="px-6 py-3 w-[40%]">Aluno</th>
                                                        <th scope="col" className="px-6 py-3">Código</th>
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
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-xl text-[10px] font-bold border uppercase ${(!student.status || student.status === 'CURSANDO' || student.status === 'ATIVO')
                                                                        ? "bg-blue-100/50 text-blue-950 border-blue-200"
                                                                        : (student.status === 'REPROVADO' || student.status === 'EVADIDO' || student.status === 'TRANSFERIDO')
                                                                            ? "bg-orange-100/50 text-orange-600 border-orange-200"
                                                                            : "bg-slate-100 text-slate-600 border-slate-200"
                                                                        }`}>
                                                                        {(() => {
                                                                            const currentYear = getCurrentSchoolYear();
                                                                            const enrollment = student.enrollmentHistory?.find(h => h.year === currentYear);
                                                                            const displayStatus = enrollment?.status || (student.status === 'CURSANDO' || student.status === 'ATIVO' ? 'PENDENTE' : student.status) || 'CURSANDO';

                                                                            if (displayStatus === 'PENDENTE') return 'Pendente de Rematrícula';
                                                                            return displayStatus;
                                                                        })()}
                                                                    </span>
                                                                    <span className={`text-[9px] font-medium ${student.isBlocked ? 'text-orange-600' : 'text-slate-400'}`}>
                                                                        {student.isBlocked ? 'Acesso Bloqueado' : 'Acesso Ativo'}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-3 text-right flex justify-end gap-2 items-center">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleEdit(student)}
                                                                    className="h-7 px-3 text-xs font-medium text-blue-950 border-blue-100 hover:bg-blue-50 hover:text-blue-950 hover:border-blue-200"
                                                                >
                                                                    <Pencil className="w-3 h-3 mr-1.5" />
                                                                    Editar
                                                                </Button>
                                                                <Button variant="ghost" size="sm" onClick={() => handlePrintCarne(student)} className="h-8 w-8 p-0 rounded-xl hover:bg-blue-50 hover:text-blue-950" title="Imprimir Carnê">
                                                                    <Printer className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleGenerateBoletosForStudent(student)}
                                                                    className="h-8 w-8 p-0 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-950"
                                                                    title="Gerar Boletos Pendentes"
                                                                    disabled={isGenerating}
                                                                >
                                                                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Barcode className="w-4 h-4" />}
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleToggleBlock(student)}
                                                                    className={`h-8 w-8 p-0 rounded-xl transition-colors ${student.isBlocked ? 'text-orange-600 hover:bg-orange-50' : 'text-slate-400 hover:bg-blue-50 hover:text-blue-950'}`}
                                                                    title={student.isBlocked ? "Desbloquear Aluno" : "Bloquear Aluno"}
                                                                >
                                                                    {student.isBlocked ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleDelete(student)}
                                                                    className="h-8 w-8 p-0 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                                                    title="Excluir Aluno"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
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
                                <Loader2 className="w-8 h-8 animate-spin text-blue-950" />
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
}

