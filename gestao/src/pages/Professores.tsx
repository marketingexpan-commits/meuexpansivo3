import { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { TeacherForm } from '../components/TeacherForm';
import { Search, Loader2, UserPlus, Pencil, Trash2, MessagesSquare, ShieldAlert, ShieldCheck, GraduationCap, BookOpen, Layers } from 'lucide-react';
import { teacherService } from '../services/teacherService';
import type { Teacher } from '../types';
import { useAcademicData } from '../hooks/useAcademicData';
import { useSchoolUnits } from '../hooks/useSchoolUnits';

export function Professores() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

    const { subjects, segments, grades } = useAcademicData();
    const { units } = useSchoolUnits();

    const userUnit = localStorage.getItem('userUnit');
    const isAdminGeral = userUnit === 'admin_geral';

    const unitMapping: Record<string, string> = {
        'unit_zn': 'Zona Norte',
        'unit_ext': 'Extremoz',
        'unit_qui': 'Quintas',
        'unit_bs': 'Boa Sorte'
    };

    const mappedUnit = (userUnit && !isAdminGeral) ? unitMapping[userUnit] : userUnit;

    // Filters
    const [filterUnit, setFilterUnit] = useState(isAdminGeral ? '' : mappedUnit || '');
    const [filterSubject, setFilterSubject] = useState('');
    const [filterGrade, setFilterGrade] = useState('');

    const loadTeachers = async () => {
        try {
            setIsLoading(true);
            const data = await teacherService.getTeachers(isAdminGeral ? null : mappedUnit);
            setTeachers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadTeachers();
    }, []);

    const handleEdit = (teacher: Teacher) => {
        setSelectedTeacher(teacher);
        setIsFormOpen(true);
    };

    const handleDelete = async (teacher: Teacher) => {
        if (!confirm(`Tem certeza que deseja excluir o registro do professor ${teacher.name}?`)) return;
        try {
            await teacherService.deleteTeacher(teacher.id);
            alert("Professor excluído com sucesso!");
            loadTeachers();
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir professor.");
        }
    };

    const handleToggleBlock = async (teacher: Teacher) => {
        try {
            const newStatus = !teacher.isBlocked;
            await teacherService.updateTeacher(teacher.id, { isBlocked: newStatus });
            setTeachers(prev => prev.map(t => t.id === teacher.id ? { ...t, isBlocked: newStatus } : t));
        } catch (error) {
            console.error(error);
            alert("Erro ao alterar status de acesso.");
        }
    };

    const filteredTeachers = teachers.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.cpf?.includes(searchTerm) ||
            t.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesUnit = !filterUnit || t.unit === filterUnit;
        const matchesSubject = !filterSubject || t.subjects?.includes(filterSubject);
        const matchesGrade = !filterGrade || t.gradeLevels?.includes(filterGrade);

        return matchesSearch && matchesUnit && matchesSubject && matchesGrade;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestão de Professores</h1>
                    <p className="text-slate-500 text-sm">Gerencie o corpo docente, permissões de acesso e alocações acadêmicas.</p>
                </div>
                <Button
                    onClick={() => { setSelectedTeacher(null); setIsFormOpen(true); }}
                    className="bg-blue-950 hover:bg-slate-900 shadow-lg shadow-blue-950/20"
                >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Novo Professor
                </Button>
            </div>

            {/* Filters */}
            <Card className="border-slate-200/60 shadow-sm overflow-visible">
                <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por nome, CPF ou e-mail..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-10"
                            />
                        </div>
                        <Select
                            value={filterUnit}
                            onChange={(e) => setFilterUnit(e.target.value)}
                            options={isAdminGeral ? [
                                { label: 'Todas as Unidades', value: '' },
                                ...units.map(u => ({ label: u.fullName, value: u.id }))
                            ] : units.filter(u => u.id === mappedUnit || u.fullName === mappedUnit).map(u => ({ label: u.fullName, value: u.id }))}
                            className="h-10"
                            disabled={!isAdminGeral}
                        />
                        <Select
                            value={filterSubject}
                            onChange={(e) => setFilterSubject(e.target.value)}
                            options={[
                                { label: 'Todas as Disciplinas', value: '' },
                                ...subjects.map(s => ({ label: s.name, value: s.name }))
                            ]}
                            className="h-10"
                        />
                        <Select
                            value={filterGrade}
                            onChange={(e) => setFilterGrade(e.target.value)}
                            options={[
                                { label: 'Todas as Séries', value: '' },
                                ...segments.flatMap(s => [
                                    // { label: `--- ${s.name} ---`, value: 'ignore', disabled: true },
                                    ...grades.filter(g => g.segmentId === s.id).map(g => ({ label: g.name, value: g.name }))
                                ])
                            ]}
                            className="h-10"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Teacher List */}
            <div className="grid grid-cols-1 gap-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="w-10 h-10 animate-spin mb-4" />
                        <p className="font-medium">Carregando professores...</p>
                    </div>
                ) : filteredTeachers.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-900">Nenhum professor encontrado</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mt-1">Ajuste os filtros ou cadastre um novo docente para começar.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-200">
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Professor</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidade / Acesso</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Matérias e Séries</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredTeachers.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold group-hover:border-blue-950/20 group-hover:bg-blue-50/50 transition-all">
                                                        {t.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 leading-tight">{t.name}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{t.email || 'Sem e-mail'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                                        <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                                                        {t.unit}
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggleBlock(t)}
                                                        className={`flex items-center gap-1.5 text-[10px] font-bold uppercase transition-all px-2 py-0.5 rounded-full border ${t.isBlocked ? 'text-red-600 bg-red-50 border-red-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}
                                                    >
                                                        {t.isBlocked ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                                                        {t.isBlocked ? 'Acesso Bloqueado' : 'Acesso Liberado'}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1.5 max-w-[300px]">
                                                    {t.subjects?.slice(0, 3).map(s => (
                                                        <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold border border-blue-100 flex items-center gap-1">
                                                            <BookOpen className="w-2.5 h-2.5" /> {s}
                                                        </span>
                                                    ))}
                                                    {t.gradeLevels?.slice(0, 2).map(g => (
                                                        <span key={g} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold border border-slate-200 flex items-center gap-1">
                                                            <Layers className="w-2.5 h-2.5" /> {g}
                                                        </span>
                                                    ))}
                                                    {(t.subjects?.length > 3 || t.gradeLevels?.length > 2) && (
                                                        <span className="text-[10px] text-slate-400 font-medium">...</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    {t.phoneNumber && (
                                                        <a
                                                            href={`https://wa.me/${t.phoneNumber}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                                                            title="WhatsApp"
                                                        >
                                                            <MessagesSquare className="w-4 h-4" />
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={() => handleEdit(t)}
                                                        className="p-2 text-blue-900 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                        title="Editar"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(t)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {isFormOpen && (
                <TeacherForm
                    onClose={(refresh) => {
                        setIsFormOpen(false);
                        if (refresh) loadTeachers();
                    }}
                    teacher={selectedTeacher}
                />
            )}
        </div>
    );
}
