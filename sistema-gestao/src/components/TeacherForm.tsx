import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from './Input';
import { Select } from './Select';
import { Checkbox } from './Checkbox';
import { Button } from './Button';
import { User, Phone, Mail, GraduationCap, X, Loader2, ShieldAlert, Key, BookOpen, Layers } from 'lucide-react';
import { teacherService } from '../services/teacherService';
import type { Teacher } from '../types';
import { UNIT_LABELS, SchoolUnit, SUBJECT_LABELS, Subject } from '../types';
import { useAcademicData } from '../hooks/useAcademicData';
import { useSchoolUnits } from '../hooks/useSchoolUnits';
import { maskCPF, sanitizePhone } from '../utils';

interface TeacherFormProps {
    onClose: (shouldRefresh?: boolean) => void;
    teacher?: Teacher | null;
}

export function TeacherForm({ onClose, teacher }: TeacherFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { subjects, segments, grades, loading: loadingAcademic } = useAcademicData();
    const { } = useSchoolUnits();
    const [showPassword, setShowPassword] = useState(false);

    const userUnit = localStorage.getItem('userUnit');
    const isAdminGeral = userUnit === 'admin_geral';

    const mappedUnit = (userUnit && !isAdminGeral) ? userUnit : userUnit;

    const [formData, setFormData] = useState<Partial<Teacher>>({
        name: '',
        cpf: '',
        password: '',
        phoneNumber: '55',
        email: '',
        unit: (isAdminGeral ? '' : mappedUnit) as any,
        subjects: [],
        gradeLevels: [],
        gradeIds: [], // NEW: Initialize gradeIds
        assignments: [],
        isBlocked: false
    });

    useEffect(() => {
        if (teacher) {
            // Normalize old short grade levels to complete format
            const normalizedGradeLevels = (teacher.gradeLevels || []).map(tGrade => {
                if (tGrade.includes(' - ')) return tGrade;
                const match = grades.find(g => g.name.startsWith(tGrade + ' - '));
                return match ? match.name : tGrade;
            });

            // Also normalize assignments
            const normalizedAssignments = (teacher.assignments || []).map(a => {
                let gName = a.gradeLevel;
                if (!gName.includes(' - ')) {
                    const match = grades.find(g => g.name.startsWith(gName + ' - '));
                    if (match) gName = match.name;
                }
                return { ...a, gradeLevel: gName };
            });

            setFormData({
                ...teacher,
                email: teacher.email || '',
                password: teacher.password || '',
                phoneNumber: teacher.phoneNumber || '55',
                cpf: teacher.cpf ? maskCPF(teacher.cpf) : '',
                subjects: teacher.subjects || [],
                gradeLevels: normalizedGradeLevels,
                gradeIds: teacher.gradeIds || [], // Load existing IDs
                assignments: normalizedAssignments
            });
        }
    }, [teacher, grades]);

    const handleToggleAssignment = useCallback((gradeLevel: string, subject: string) => {
        setFormData(prev => {
            const currentAssignments = [...(prev.assignments || [])];
            const assignmentIndex = currentAssignments.findIndex(a => a.gradeLevel === gradeLevel);

            if (assignmentIndex >= 0) {
                const updatedAssignment = { ...currentAssignments[assignmentIndex] };
                const subjects = [...updatedAssignment.subjects];
                const subjectIndex = subjects.indexOf(subject);

                if (subjectIndex >= 0) {
                    subjects.splice(subjectIndex, 1);
                } else {
                    subjects.push(subject);
                }

                if (subjects.length === 0) {
                    currentAssignments.splice(assignmentIndex, 1);
                } else {
                    updatedAssignment.subjects = subjects;
                    currentAssignments[assignmentIndex] = updatedAssignment;
                }
            } else {
                currentAssignments.push({ gradeLevel, subjects: [subject] });
            }

            return { ...prev, assignments: currentAssignments };
        });
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let finalValue: any = value;

        if (type === 'checkbox') {
            finalValue = (e.target as HTMLInputElement).checked;
        }

        if (name === 'cpf') {
            finalValue = maskCPF(value);
        }

        setFormData(prev => ({ ...prev, [name]: finalValue }));
    }, []);

    const handleToggleCollection = useCallback((name: 'subjects' | 'gradeLevels', item: string) => {
        setFormData(prev => {
            const current = (prev[name] || []) as string[];
            const exists = current.includes(item);
            if (exists) {
                return { ...prev, [name]: current.filter(i => i !== item) };
            } else {
                return { ...prev, [name]: [...current, item] };
            }
        });
    }, []);

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let pass = "P" + "a" + "1" + Array(5).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        setFormData(prev => ({ ...prev, password: pass }));
        setShowPassword(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // --- BLINDAGEM: VALIDAÇÃO RIGOROSA ---
        const requiredFields = [
            { key: 'name', label: 'Nome Completo' },
            { key: 'cpf', label: 'CPF' },
            { key: 'unit', label: 'Unidade' }
        ];

        for (const field of requiredFields) {
            if (!(formData as any)[field.key]) {
                return alert(`O campo "${field.label}" é obrigatório.`);
            }
        }

        if (!teacher && !formData.password) {
            return alert("Por favor, defina uma senha para o novo professor.");
        }

        const isInfantilTeacher = formData.gradeLevels?.some(gl => {
            const grade = grades.find(g => g.name === gl);
            const segment = segments.find(s => s.id === grade?.segmentId);
            return segment?.name === 'Educação Infantil';
        });

        const hasNonInfantilGrade = formData.gradeLevels?.some(gl => {
            const grade = grades.find(g => g.name === gl);
            const segment = segments.find(s => s.id === grade?.segmentId);
            return segment && segment.name !== 'Educação Infantil';
        });

        const isOnlyInfantil = isInfantilTeacher && !hasNonInfantilGrade;

        if (!isOnlyInfantil) {
            if (!formData.subjects || formData.subjects.length === 0) {
                return alert("Selecione pelo menos uma disciplina.");
            }

            if (!formData.assignments || formData.assignments.length === 0) {
                return alert("É necessário vincular pelo menos uma matéria a uma série no quadro de 'Vínculos de Aula'.");
            }
        }

        setIsLoading(true);
        try {
            const dataToSave = {
                ...formData,
                // CRITICAL: Map selected grade names (Strings) to their IDs (grade_X)
                // This ensures "Dual Support" - saving both for compatibility
                gradeIds: formData.gradeLevels?.map(gName => {
                    const match = grades.find(g => g.name === gName);
                    return match ? match.id : null;
                }).filter(id => id !== null) as string[],
                phoneNumber: sanitizePhone(formData.phoneNumber || '')
            };

            if (teacher) {
                await teacherService.updateTeacher(teacher.id, dataToSave);
                alert("Professor atualizado com sucesso!");
            } else {
                await teacherService.createTeacher(dataToSave);
                alert("Professor cadastrado com sucesso!");
            }
            onClose(true);
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar professor.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-950 flex items-center justify-center text-white shadow-lg shadow-blue-950/20">
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                {teacher ? 'Editar Professor' : 'Novo Professor'}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                                {teacher ? teacher.name : 'Cadastro de docente'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => onClose()}
                        className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {/* Basic Info */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-6 bg-blue-950 rounded-xl" />
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Dados Básicos</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Nome Completo"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                startIcon={<User className="w-4 h-4" />}
                                placeholder="Ex: João da Silva"
                                required
                            />
                            <Input
                                label="CPF"
                                name="cpf"
                                value={formData.cpf}
                                onChange={handleChange}
                                startIcon={<ShieldAlert className="w-4 h-4" />}
                                placeholder="000.000.000-00"
                                maxLength={14}
                                required
                            />
                            <Input
                                label="WhatsApp / Telefone"
                                name="phoneNumber"
                                value={formData.phoneNumber}
                                onChange={handleChange}
                                startIcon={<Phone className="w-4 h-4" />}
                                placeholder="5584999999999"
                            />
                            <Input
                                label="E-mail"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                startIcon={<Mail className="w-4 h-4" />}
                                placeholder="professor@escola.com"
                            />
                            <Select
                                label="Unidade"
                                name="unit"
                                value={formData.unit}
                                onChange={handleChange}
                                options={Object.values(SchoolUnit).map(unit => ({
                                    label: UNIT_LABELS[unit],
                                    value: unit
                                }))}
                                startIcon={<GraduationCap className="w-4 h-4" />}
                                required
                                disabled={!isAdminGeral}
                            />
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-slate-700">Senha de Acesso (App)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            value={formData.password}
                                            onChange={handleChange}
                                            startIcon={<Key className="w-4 h-4" />}
                                            placeholder="Mínimo 6 caracteres"
                                            required={!teacher}
                                            className="pr-10 flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPassword ? <X className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-[42px] px-3 border-2 border-slate-200"
                                        onClick={generatePassword}
                                    >
                                        Gerar
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Checkbox
                                label="Status de Acesso ao App (Ativo / Bloqueado)"
                                name="isBlocked"
                                checked={formData.isBlocked}
                                onChange={handleChange}
                                className={formData.isBlocked ? "text-red-600" : "text-blue-600"}
                            />
                            <p className="text-[10px] text-slate-500 mt-1 ml-7 italic">
                                {formData.isBlocked
                                    ? "O acesso deste professor ao aplicativo do aluno está atualmente BLOQUEADO."
                                    : "Este professor tem permissão ativa para acessar o aplicativo do aluno."}
                            </p>
                        </div>
                    </section>

                    {/* Competencies (Subjects & Grades) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        {/* Subjects */}
                        <section className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                            <div className="flex items-center gap-2 mb-4">
                                <BookOpen className="w-5 h-5 text-blue-950" />
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Disciplinas</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                                {loadingAcademic ? (
                                    <p className="text-xs text-slate-400 italic">Carregando disciplinas...</p>
                                ) : (
                                    subjects.filter(sub => sub.isActive || formData.subjects?.includes(sub.id)).map(sub => (
                                        <Checkbox
                                            key={sub.id}
                                            label={`${sub.name}${!sub.isActive ? ' (Inativa)' : ''}`}
                                            checked={formData.subjects?.includes(sub.id)}
                                            onChange={() => handleToggleCollection('subjects', sub.id)}
                                            className="bg-white p-2 rounded-xl border border-slate-200 hover:border-blue-950/30 transition-all shadow-sm"
                                        />
                                    ))
                                )}
                            </div>
                        </section>

                        {/* Grade Levels */}
                        <section className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                            <div className="flex items-center gap-2 mb-4">
                                <Layers className="w-5 h-5 text-blue-950" />
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Séries de Atuação</h3>
                            </div>
                            <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                                {loadingAcademic ? (
                                    <p className="text-xs text-slate-400 italic">Carregando séries...</p>
                                ) : (
                                    segments.map(seg => (
                                        <div key={seg.id} className="space-y-2">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{seg.name}</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {grades
                                                    .filter(g => g.segmentId === seg.id)
                                                    .map(grade => (
                                                        <Checkbox
                                                            key={grade.id}
                                                            label={grade.name}
                                                            checked={formData.gradeLevels?.includes(grade.name)}
                                                            onChange={() => handleToggleCollection('gradeLevels', grade.name)}
                                                            className="bg-white p-2 rounded-xl border border-slate-200 hover:border-blue-950/30 transition-all shadow-sm"
                                                        />
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>

                    {/* NEW: Linked Assignments Section (Memoized to fix INP) */}
                    {useMemo(() => {
                        if (!formData.gradeLevels || formData.gradeLevels.length === 0 || !formData.subjects || formData.subjects.length === 0) return null;

                        return (
                            <section className="bg-slate-50 rounded-xl p-6 border border-slate-100 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Layers className="w-5 h-5 text-blue-950" />
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Vínculos de Aula (Matérias por Série)</h3>
                                </div>
                                <p className="text-xs text-slate-500 mb-4 italic">
                                    Marque especificamente quais matérias o professor leciona em cada série selecionada.
                                </p>

                                <div className="space-y-6">
                                    {formData.gradeLevels.map(grade => (
                                        <div key={grade} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="flex items-center gap-2 mb-3 border-b border-slate-50 pb-2">
                                                <GraduationCap className="w-4 h-4 text-blue-950" />
                                                <span className="text-xs font-black text-slate-700 uppercase">{grade}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {formData.subjects?.map(subject => {
                                                    const isLinked = formData.assignments?.find(a => a.gradeLevel === grade)?.subjects.includes(subject);
                                                    return (
                                                        <button
                                                            key={`${grade}-${subject}`}
                                                            type="button"
                                                            onClick={() => handleToggleAssignment(grade, subject)}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${isLinked
                                                                ? 'bg-blue-950 text-white border-blue-950 shadow-md shadow-blue-950/20'
                                                                : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-300'
                                                                }`}
                                                        >
                                                            {subjects.find(s => s.id === subject)?.name || SUBJECT_LABELS[subject as Subject] || subject}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    }, [formData.gradeLevels, formData.subjects, formData.assignments, subjects, handleToggleAssignment])}
                </form>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onClose()}
                        disabled={isLoading}
                        className="px-8 border-2"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="px-12 bg-blue-950 hover:bg-slate-900 shadow-xl shadow-blue-950/10"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            teacher ? 'Salvar Alterações' : 'Finalizar Cadastro'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
