import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { SchoolUnit, UNIT_LABELS } from '../types';
import type { Admin } from '../types';
import { Loader2, Pencil, Trash2, Eye, EyeOff, ShieldCheck, Save, Plus } from 'lucide-react';

const SCHOOL_UNITS_LIST = [
    { label: UNIT_LABELS[SchoolUnit.UNIT_BS], value: SchoolUnit.UNIT_BS },
    { label: UNIT_LABELS[SchoolUnit.UNIT_EXT], value: SchoolUnit.UNIT_EXT },
    { label: UNIT_LABELS[SchoolUnit.UNIT_ZN], value: SchoolUnit.UNIT_ZN },
    { label: UNIT_LABELS[SchoolUnit.UNIT_QUI], value: SchoolUnit.UNIT_QUI },
    { label: 'Todas as Unidades (Acesso Geral)', value: 'admin_geral' }
];

export default function AdminUnidades() {
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);

    // Form States
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [unit, setUnit] = useState<string>(SchoolUnit.UNIT_BS);
    const [roleType, setRoleType] = useState<'gestao' | 'student_app'>('student_app');
    const [isGeneralAdmin, setIsGeneralAdmin] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Filters
    const [unitFilter, setUnitFilter] = useState('all');

    useEffect(() => {
        fetchAdmins();
    }, []);

    // Sync unit when isGeneralAdmin changes
    useEffect(() => {
        if (isGeneralAdmin) {
            setUnit('admin_geral');
        } else if (unit === 'admin_geral') {
            setUnit(SchoolUnit.UNIT_BS); // Reset to default if unchecking
        }
    }, [isGeneralAdmin]);

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'admins'), orderBy('name'));
            const snapshot = await getDocs(q);
            const fetchedAdmins = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Admin));
            setAdmins(fetchedAdmins.filter(a => a.id !== 'a0')); // Filter out potential master/root admin if implied by a0
        } catch (error) {
            console.error("Error fetching admins:", error);
            alert("Erro ao carregar administradores.");
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let newPass = "A" + "a" + "1" + Array(5).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        newPass = newPass.split('').sort(() => 0.5 - Math.random()).join('');
        setPassword(newPass);
        setShowPassword(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setName('');
        setUsername('');
        setPassword('');
        setUnit(SchoolUnit.UNIT_BS);
        setRoleType('student_app');
        setIsGeneralAdmin(false);
        setShowPassword(false);
    };

    const handleEdit = (admin: Admin) => {
        setEditingId(admin.id);
        setName(admin.name);
        setUsername(admin.username);
        setPassword(admin.password);

        const isGeneral = admin.unit === 'admin_geral';
        setIsGeneralAdmin(isGeneral);
        setUnit(admin.unit || SchoolUnit.UNIT_BS);

        setRoleType(admin.roleType || 'student_app');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este administrador?")) return;

        try {
            await deleteDoc(doc(db, 'admins', id));
            setAdmins(prev => prev.filter(a => a.id !== id));
            alert("Administrador excluído com sucesso.");
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const adminData = {
                name,
                username,
                password,
                unit: unit as SchoolUnit,
                roleType,
                updatedAt: new Date().toISOString()
            };

            if (editingId) {
                await updateDoc(doc(db, 'admins', editingId), adminData);
                setAdmins(prev => prev.map(a => a.id === editingId ? { ...a, ...adminData } : a));
                alert("Administrador atualizado com sucesso!");
            } else {
                const docRef = await addDoc(collection(db, 'admins'), {
                    ...adminData,
                    createdAt: new Date().toISOString()
                });
                setAdmins(prev => [...prev, { id: docRef.id, ...adminData }]);
                alert("Administrador criado com sucesso!");
            }
            resetForm();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar administrador.");
        } finally {
            setSubmitting(false);
        }
    };

    // Filter Logic
    const filteredAdmins = admins.filter(a => unitFilter === 'all' || a.unit === unitFilter);

    const gestaoAdmins = filteredAdmins.filter(a => a.roleType === 'gestao');
    const appAdmins = filteredAdmins.filter(a => !a.roleType || a.roleType === 'student_app'); // Default to student_app for backwards compatibility

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
                <div className="bg-blue-950 p-2 rounded-xl">
                    <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gerenciar Administradores</h1>
                    <p className="text-slate-500">Controle de acesso para Gestão e App do Aluno</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* FORM COLUMN */}
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-slate-200 shadow-sm sticky top-6">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                            <CardTitle className="text-lg font-bold text-slate-800 flex justify-between items-center">
                                {editingId ? 'Editar Admin' : 'Novo Admin'}
                                {editingId && (
                                    <button onClick={resetForm} className="text-xs text-red-600 hover:underline font-normal">
                                        Cancelar
                                    </button>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="Nome (Descrição)"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ex: Direção Zona Norte"
                                    required
                                />
                                <Input
                                    label="Usuário de Login"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="Ex: admin.zn"
                                    required
                                />

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium text-slate-700">Unidade Responsável</label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            {username === 'admingeral' ? (
                                                <span className="text-xs font-semibold text-blue-950/50 cursor-not-allowed">Admin Principal</span>
                                            ) : (
                                                (!editingId || isGeneralAdmin) && (
                                                    <>
                                                        <input
                                                            type="checkbox"
                                                            checked={isGeneralAdmin}
                                                            onChange={e => setIsGeneralAdmin(e.target.checked)}
                                                            className="w-4 h-4 text-blue-950 rounded-xl border-slate-300 focus:ring-blue-950"
                                                        />
                                                        <span className="text-xs font-semibold text-blue-950">É Admin Geral?</span>
                                                    </>
                                                )
                                            )}
                                        </label>
                                    </div>

                                    {!isGeneralAdmin ? (
                                        <Select
                                            value={unit}
                                            onChange={e => setUnit(e.target.value)}
                                            options={SCHOOL_UNITS_LIST.filter(u => u.value !== 'admin_geral')} // Hide admin_geral from dropdown as it's handled by checkbox
                                        />
                                    ) : (
                                        <div className="p-2 bg-slate-100 rounded border border-slate-200 text-sm text-slate-500 italic text-center">
                                            Acesso total a todas as unidades
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Acesso</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setRoleType('student_app')}
                                            className={`p-2 text-xs font-bold rounded-xl border transition-all ${roleType === 'student_app' ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            App do Aluno
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRoleType('gestao')}
                                            className={`p-2 text-xs font-bold rounded-xl border transition-all ${roleType === 'gestao' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            Sistema Gestão
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        {roleType === 'student_app'
                                            ? 'Admin terá acesso ao Painel Administrativo do App do Aluno.'
                                            : 'Admin terá acesso completo a este Sistema de Gestão.'}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                                    <div className="relative flex gap-2">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm shadow-sm placeholder-slate-400
                                            focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            placeholder="••••••••"
                                            required={!editingId}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-20 top-2.5 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleGeneratePassword}
                                            className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-200 border border-slate-200"
                                        >
                                            Gerar
                                        </button>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full mt-4 bg-blue-950 hover:bg-blue-900"
                                    isLoading={submitting}
                                >
                                    {editingId ? <><Save className="w-4 h-4 mr-2" /> Salvar Alterações</> : <><Plus className="w-4 h-4 mr-2" /> Criar Admin</>}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* LIST COLUMN */}
                <div className="lg:col-span-2 space-y-6">
                    {/* FILTER */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                        <h3 className="font-bold text-slate-700">Lista de Administradores</h3>
                        <select
                            value={unitFilter}
                            onChange={(e) => setUnitFilter(e.target.value)}
                            className="p-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-blue-950/20 outline-none"
                        >
                            <option value="all">Todas as Unidades</option>
                            <option value="all">Todas as Unidades</option>
                            {SCHOOL_UNITS_LIST.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-950 mx-auto mb-2" />
                            <p className="text-slate-400">Carregando...</p>
                        </div>
                    ) : (
                        <>
                            {/* APP DO ALUNO TABLE */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                                    <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-950"></div>
                                        Admins - App do Aluno
                                    </h4>
                                    <span className="text-xs font-medium bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">{appAdmins.length}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50/50 text-slate-500 font-medium">
                                            <tr>
                                                <th className="p-3">Nome</th>
                                                <th className="p-3">Usuário</th>
                                                <th className="p-3">Unidade</th>
                                                <th className="p-3 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {appAdmins.length === 0 ? (
                                                <tr><td colSpan={4} className="p-6 text-center text-slate-400 italic">Nenhum admin encontrado.</td></tr>
                                            ) : appAdmins.map(a => (
                                                <tr key={a.id} className="hover:bg-blue-50 transition-colors group">
                                                    <td className="p-3 font-medium text-slate-700">{a.name}</td>
                                                    <td className="p-3 font-mono text-slate-500">{a.username}</td>
                                                    <td className="p-3"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs border border-slate-200 font-medium">{a.unit === 'admin_geral' ? 'Todas as Unidades' : a.unit}</span></td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleEdit(a)}
                                                                className="p-1.5 text-slate-600 hover:text-blue-950 hover:bg-slate-200 rounded-xl transition-colors"
                                                                title="Editar"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(a.id)}
                                                                className="p-1.5 text-red-400 hover:text-red-700 hover:bg-slate-200 rounded-xl transition-colors"
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

                            {/* GESTÃO DO SISTEMA TABLE */}
                            <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
                                <div className="bg-orange-100 p-3 border-b border-orange-200 flex justify-between items-center">
                                    <h4 className="font-bold text-orange-900 text-sm flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-orange-600"></div>
                                        Admins - Sistema Gestão
                                    </h4>
                                    <span className="text-xs font-medium bg-white px-2 py-1 rounded border border-orange-200 text-orange-700">{gestaoAdmins.length}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50/50 text-orange-900/70 font-medium">
                                            <tr>
                                                <th className="p-3">Nome</th>
                                                <th className="p-3">Usuário</th>
                                                <th className="p-3">Unidade</th>
                                                <th className="p-3 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {gestaoAdmins.length === 0 ? (
                                                <tr><td colSpan={4} className="p-6 text-center text-slate-400 italic">Nenhum admin encontrado.</td></tr>
                                            ) : gestaoAdmins.map(a => (
                                                <tr key={a.id} className="hover:bg-orange-100/30 transition-colors group">
                                                    <td className="p-3 font-medium text-slate-700">{a.name}</td>
                                                    <td className="p-3 font-mono text-slate-500">{a.username}</td>
                                                    <td className="p-3"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs border border-slate-200 font-medium">{a.unit}</span></td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleEdit(a)}
                                                                className="p-1.5 text-slate-600 hover:text-orange-900 hover:bg-orange-100 rounded-xl transition-colors"
                                                                title="Editar"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(a.id)}
                                                                className="p-1.5 text-red-400 hover:text-red-700 hover:bg-slate-200 rounded-xl transition-colors"
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
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
