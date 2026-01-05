import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../../firebaseConfig';
import { Admin, Student, Teacher, SchoolUnit, Subject, SchoolShift, SchoolClass, UnitContact, CoordinationSegment } from '../types';
import { SCHOOL_UNITS_LIST, SUBJECT_LIST, SCHOOL_SHIFTS_LIST, SCHOOL_CLASSES_LIST, SCHOOL_GRADES_LIST } from '../constants';
import { Button } from './Button';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Input } from './Input';
import { Select } from './Select';
import { Sidebar, SidebarToggle } from './Sidebar';
import { SidebarCategory } from './SidebarCategory';
import { SidebarItem } from './SidebarItem';
import { GraduationCap, Users } from 'lucide-react';

interface AdminDashboardProps {
    admin: Admin;
    students: Student[];
    teachers: Teacher[];
    admins?: Admin[]; // Novo: Lista de admins
    onAddStudent: (student: Student) => void;
    onEditStudent: (student: Student) => void;
    onDeleteStudent: (id: string) => void;
    onToggleBlockStudent: (id: string) => void;
    onAddTeacher: (teacher: Teacher) => void;
    onEditTeacher: (teacher: Teacher) => void;
    onDeleteTeacher: (id: string) => void;
    onAddAdmin?: (admin: Admin) => void; // Novo
    onEditAdmin?: (admin: Admin) => void; // Novo
    onDeleteAdmin?: (id: string) => void; // Novo
    // Unit Contacts
    unitContacts?: UnitContact[];
    onAddUnitContact?: (contact: UnitContact) => void;
    onEditUnitContact?: (contact: UnitContact) => void;
    onDeleteUnitContact?: (id: string) => void;
    onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
    admin,
    students,
    teachers,
    admins = [],
    onAddStudent,
    onEditStudent,
    onDeleteStudent,
    onToggleBlockStudent,
    onAddTeacher,
    onEditTeacher,
    onDeleteTeacher,
    onAddAdmin,
    onEditAdmin,
    onDeleteAdmin,
    unitContacts = [],
    onAddUnitContact,
    onEditUnitContact,
    onDeleteUnitContact,
    onLogout
}) => {
    const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'admins' | 'contacts'>('students');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const adminUnit = admin.unit;
    const isGeneralAdmin = !adminUnit;

    // --- ESTADOS GERAIS ---
    // Student
    const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
    const [sName, setSName] = useState('');
    const [sCode, setSCode] = useState('');
    const [sGrade, setSGrade] = useState(SCHOOL_GRADES_LIST[0]);
    const [sUnit, setSUnit] = useState<SchoolUnit>(adminUnit || SchoolUnit.UNIT_1);
    const [sShift, setSShift] = useState<SchoolShift>(SchoolShift.MORNING);
    const [sClass, setSClass] = useState<SchoolClass>(SchoolClass.A);
    const [sPass, setSPass] = useState('');
    const [showStudentPassword, setShowStudentPassword] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
    const [studentSearchTerm, setStudentSearchTerm] = useState('');

    // Teacher
    const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
    const [tName, setTName] = useState('');
    const [tCpf, setTCpf] = useState('');
    const [tPhone, setTPhone] = useState('+55');
    const [tUnit, setTUnit] = useState<SchoolUnit>(adminUnit || SchoolUnit.UNIT_1);
    const [tPass, setTPass] = useState('');
    const [showTeacherPassword, setShowTeacherPassword] = useState(false);
    const [tSubjects, setTSubjects] = useState<Subject[]>([]);
    const [tempSubject, setTempSubject] = useState<Subject>(Subject.MATH);
    const [teacherToDelete, setTeacherToDelete] = useState<string | null>(null);

    // Admin (Gestão de Admins)
    const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
    const [aName, setAName] = useState('');
    const [aUser, setAUser] = useState('');
    const [aPass, setAPass] = useState('');
    const [aUnit, setAUnit] = useState<SchoolUnit>(SchoolUnit.UNIT_1);
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [adminToDelete, setAdminToDelete] = useState<string | null>(null);

    // Contact (Coordenação)
    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [cName, setCName] = useState('');
    const [cRole, setCRole] = useState('Coordenador');
    const [cPhone, setCPhone] = useState('+55');
    const [cUnit, setCUnit] = useState<SchoolUnit>(adminUnit || SchoolUnit.UNIT_1);
    const [cSegment, setCSegment] = useState<CoordinationSegment | undefined>(undefined);
    const [contactToDelete, setContactToDelete] = useState<string | null>(null);


    const isPasswordValid = (pass: string) => pass.length >= 6;

    // --- GERADOR DE SENHA ---
    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let password = "";
        password += "A"; password += "a"; password += "1";
        for (let i = 0; i < 5; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password.split('').sort(() => 0.5 - Math.random()).join('');
    };

    const handleGenerateStudentPass = () => { setSPass(generatePassword()); setShowStudentPassword(true); };
    const handleGenerateTeacherPass = () => { setTPass(generatePassword()); setShowTeacherPassword(true); };
    const handleGenerateAdminPass = () => { setAPass(generatePassword()); setShowAdminPassword(true); };


    // --- FILTRAGEM ---
    const filteredStudents = students.filter(student => {
        const matchesUnit = isGeneralAdmin ? true : student.unit === adminUnit;
        const term = studentSearchTerm.toLowerCase();
        const matchesSearch = student.name.toLowerCase().includes(term) || student.code.includes(term);
        return matchesUnit && matchesSearch;
    });

    const filteredTeachers = teachers.filter(teacher => {
        const matchesUnit = isGeneralAdmin ? true : teacher.unit === adminUnit;
        return matchesUnit;
    });

    const filteredAdmins = admins.filter(a => a.id !== 'a0' && a.unit);

    const filteredContacts = (unitContacts || []).filter(c => {
        const matchesUnit = isGeneralAdmin ? true : c.unit === adminUnit;
        return matchesUnit;
    });

    // Ordenação de Matérias
    const sortedSubjects = [...SUBJECT_LIST].sort((a, b) => a.localeCompare(b));


    // --- HANDLERS (Estudante & Professor omitidos para brevidade, mantidos do anterior) ---

    // Handlers ADMIN
    const handleAdminSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!onAddAdmin || !onEditAdmin) return;

        if (editingAdminId) {
            const originalAdmin = admins.find(a => a.id === editingAdminId);
            if (!originalAdmin) return;

            let passwordToUse = originalAdmin.password;
            if (aPass.trim()) passwordToUse = aPass;

            onEditAdmin({
                ...originalAdmin,
                name: aName,
                username: aUser,
                unit: aUnit,
                password: passwordToUse
            });
            alert("Administrador atualizado!");
            setEditingAdminId(null); setAName(''); setAUser(''); setAPass('');
        } else {
            onAddAdmin({
                id: Math.random().toString(36).substr(2, 9),
                name: aName,
                username: aUser,
                password: aPass,
                unit: aUnit
            });
            alert("Administrador criado!");
            setAName(''); setAUser(''); setAPass('');
        }
    };

    const startEditingAdmin = (adm: Admin) => {
        setEditingAdminId(adm.id);
        setAName(adm.name);
        setAUser(adm.username);
        setAUnit(adm.unit!);
        setAPass(adm.password);
        setShowAdminPassword(false);
    };

    const initiateDeleteAdmin = (id: string) => setAdminToDelete(id);
    const confirmDeleteAdmin = () => { if (onDeleteAdmin && adminToDelete) { onDeleteAdmin(adminToDelete); setAdminToDelete(null); } };

    // Handlers Contact
    const handleContactSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!onAddUnitContact || !onEditUnitContact) return;
        const unitToSave = isGeneralAdmin ? cUnit : adminUnit!;

        const contactData: UnitContact = {
            id: editingContactId || Date.now().toString(),
            name: cName,
            role: cRole,
            phoneNumber: cPhone,
            unit: unitToSave,
            segment: cSegment // Save the segment
        };

        if (editingContactId) {
            onEditUnitContact(contactData);
            alert("Contato atualizado!");
            setEditingContactId(null); setCName(''); setCRole('Coordenador'); setCPhone('+55'); setCSegment(undefined);
        } else {
            onAddUnitContact(contactData);
            alert("Contato criado!");
            setCName(''); setCRole('Coordenador'); setCPhone('+55'); setCSegment(undefined);
        }
    };

    const startEditingContact = (c: UnitContact) => {
        setEditingContactId(c.id);
        setCName(c.name);
        setCRole(c.role);
        setCPhone(c.phoneNumber);
        setCUnit(c.unit);
        setCSegment(c.segment);
    };

    const initiateDeleteContact = (id: string) => setContactToDelete(id);


    // Handlers Aluno
    const initiateDeleteStudent = (id: string) => setStudentToDelete(id);

    const startEditingStudent = (student: Student) => {
        setEditingStudentId(student.id);
        setSName(student.name);
        setSCode(student.code);
        setSGrade(student.gradeLevel);
        setSUnit(student.unit);
        setSShift(student.shift);
        setSClass(student.schoolClass);
        setSPass(student.password); setShowStudentPassword(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const cancelEditingStudent = () => { setEditingStudentId(null); setSName(''); setSCode(''); setSPass(''); };

    const fullHandleStudentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const unitToSave = isGeneralAdmin ? sUnit : adminUnit!;
        if (editingStudentId) {
            const original = students.find(s => s.id === editingStudentId);
            if (!original) return;
            const updated = { ...original, name: sName, code: sCode, gradeLevel: sGrade, unit: unitToSave, shift: sShift, schoolClass: sClass, password: sPass.trim() ? sPass : original.password };
            onEditStudent(updated);
            alert("Atualizado!");
            cancelEditingStudent();
        } else {
            onAddStudent({ id: Date.now().toString(), name: sName, code: sCode, gradeLevel: sGrade, unit: unitToSave, shift: sShift, schoolClass: sClass, password: sPass, isBlocked: false });
            alert("Cadastrado!");
            setSName(''); setSCode(''); setSPass('');
        }
    };

    // Handlers Professor
    const initiateDeleteTeacher = (id: string) => setTeacherToDelete(id);

    const startEditingTeacher = (t: Teacher) => {
        setEditingTeacherId(t.id); setTName(t.name); setTCpf(t.cpf); setTPhone(t.phoneNumber || '+55'); setTUnit(t.unit); setTSubjects(t.subjects); setTPass(t.password); setShowTeacherPassword(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const cancelEditingTeacher = () => { setEditingTeacherId(null); setTName(''); setTCpf(''); setTPhone('+55'); setTPass(''); setTSubjects([]); };

    const fullHandleTeacherSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const unitToSave = isGeneralAdmin ? tUnit : adminUnit!;
        if (editingTeacherId) {
            const original = teachers.find(t => t.id === editingTeacherId);
            if (!original) return;
            const updated = { ...original, name: tName, cpf: tCpf, phoneNumber: tPhone, unit: unitToSave, subjects: tSubjects, password: tPass.trim() ? tPass : original.password };
            onEditTeacher(updated);
            alert("Atualizado!");
            cancelEditingTeacher();
        } else {
            onAddTeacher({ id: Date.now().toString(), name: tName, cpf: tCpf, phoneNumber: tPhone, unit: unitToSave, subjects: tSubjects, password: tPass });
            alert("Cadastrado!");
            setTName(''); setTCpf(''); setTPass('');
        }
    };
    const handleAddSubject = () => { if (!tSubjects.includes(tempSubject)) setTSubjects([...tSubjects, tempSubject]); };
    const handleRemoveSubject = (s: Subject) => setTSubjects(tSubjects.filter(sub => sub !== s));

    // Função para telefone
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (!/^[+]?[0-9]*$/.test(val)) return;
        setTPhone(val);
    };

    // Ícones
    const EyeIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);
    const EyeOffIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>);


    return (
        <div className="min-h-screen bg-slate-50 flex overflow-hidden">

            {/* Modais de Exclusão */}
            {(studentToDelete || teacherToDelete || adminToDelete) && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900 bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in-up">
                        <h3 className="text-lg font-bold text-center text-gray-900 mb-2">Confirmar Exclusão</h3>
                        <p className="text-sm text-center text-gray-500 mb-6">Tem certeza? Essa ação não pode ser desfeita.</p>
                        <div className="flex gap-3 justify-center">
                            <Button variant="secondary" onClick={() => { setStudentToDelete(null); setTeacherToDelete(null); setAdminToDelete(null); }} className="w-full">Cancelar</Button>
                            <Button variant="danger" onClick={() => {
                                if (studentToDelete) { onDeleteStudent(studentToDelete); setStudentToDelete(null); }
                                if (teacherToDelete) { onDeleteTeacher(teacherToDelete); setTeacherToDelete(null); }
                                if (adminToDelete && onDeleteAdmin) { onDeleteAdmin(adminToDelete); setAdminToDelete(null); }
                                if (contactToDelete && onDeleteUnitContact) { onDeleteUnitContact(contactToDelete); setContactToDelete(null); }
                            }} className="w-full">Sim, Excluir</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Sidebar Layout */}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                userName={admin.name}
                onLogout={onLogout}
            >
                <SidebarCategory
                    icon={<GraduationCap className="w-5 h-5" />}
                    title="Acadêmico"
                    defaultOpen={true}
                >
                    <SidebarItem
                        label="Gerenciar Alunos"
                        isActive={activeTab === 'students'}
                        onClick={() => { setActiveTab('students'); setSidebarOpen(false); }}
                    />
                    <SidebarItem
                        label="Gerenciar Professores"
                        isActive={activeTab === 'teachers'}
                        onClick={() => { setActiveTab('teachers'); setSidebarOpen(false); }}
                    />
                </SidebarCategory>

                <SidebarCategory
                    icon={<Users className="w-5 h-5" />}
                    title="Gestão"
                    defaultOpen={false}
                >
                    {isGeneralAdmin && (
                        <SidebarItem
                            label="Gerenciar Admins"
                            isActive={activeTab === 'admins'}
                            onClick={() => { setActiveTab('admins'); setSidebarOpen(false); }}
                        />
                    )}
                    <SidebarItem
                        label="Contatos / Coordenação"
                        isActive={activeTab === 'contacts'}
                        onClick={() => { setActiveTab('contacts'); setSidebarOpen(false); }}
                    />
                </SidebarCategory>
            </Sidebar>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header - Simplified as identity is in sidebar */}
                <header className="bg-white shadow-sm border-b border-slate-200 h-16 flex items-center shrink-0">
                    <div className="px-4 sm:px-6 lg:px-8 flex justify-between items-center w-full">
                        <div className="flex items-center gap-3">
                            <SidebarToggle onClick={() => setSidebarOpen(!sidebarOpen)} />
                            <div className="overflow-hidden">
                                <h1 className="text-lg font-bold text-slate-800 truncate">
                                    {adminUnit || 'Administração Geral'}
                                </h1>
                                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
                                    Meu Expansivo V3 • {activeTab.toUpperCase()}
                                </p>
                            </div>
                        </div>
                        {/* Area for quick actions if needed */}
                    </div>
                </header>

                {/* Content Container */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">

                    {/* --- CONTEÚDO ALUNOS --- */}
                    {activeTab === 'students' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-bold text-gray-800">{editingStudentId ? 'Editar Aluno' : 'Cadastrar Novo Aluno'}</h2>
                                        {editingStudentId && <button onClick={cancelEditingStudent} className="text-sm text-red-600">Cancelar</button>}
                                    </div>
                                    <form onSubmit={fullHandleStudentSubmit} className="space-y-4">
                                        <div><label className="text-sm font-medium">Nome</label><input type="text" value={sName} onChange={e => setSName(e.target.value)} required className="w-full p-2 border rounded" /></div>
                                        <div><label className="text-sm font-medium">Código</label><input type="text" value={sCode} onChange={e => setSCode(e.target.value)} required className="w-full p-2 border rounded" /></div>
                                        <div>
                                            <label className="text-sm font-medium">Série</label>
                                            <select value={sGrade} onChange={e => setSGrade(e.target.value)} className="w-full p-2 border rounded">{SCHOOL_GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}</select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-sm font-medium">Turma</label>
                                                <select value={sClass} onChange={e => setSClass(e.target.value as SchoolClass)} className="w-full p-2 border rounded">{SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium">Turno</label>
                                                <select value={sShift} onChange={e => setSShift(e.target.value as SchoolShift)} className="w-full p-2 border rounded">{SCHOOL_SHIFTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Unidade</label>
                                            {isGeneralAdmin ? (
                                                <select value={sUnit} onChange={e => setSUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">{SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select>
                                            ) : <div className="p-2 bg-gray-100 rounded text-gray-600">{adminUnit}</div>}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Senha</label>
                                            <div className="flex gap-2 relative">
                                                <input type={showStudentPassword ? "text" : "password"} value={sPass} onChange={e => setSPass(e.target.value)} className="w-full p-2 border rounded" required={!editingStudentId} />
                                                <button type="button" onClick={() => setShowStudentPassword(!showStudentPassword)} className="absolute right-16 top-2 text-gray-500">{showStudentPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
                                                <button type="button" onClick={handleGenerateStudentPass} className="px-3 py-2 bg-gray-200 rounded text-sm">Gerar</button>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Senha automática (8 caracteres).</p>
                                        </div>
                                        <Button type="submit" className="w-full">{editingStudentId ? 'Salvar' : 'Cadastrar'}</Button>
                                    </form>
                                </div>
                            </div>
                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="p-4 bg-gray-50 border-b flex justify-between">
                                        <h3 className="font-bold">Alunos ({filteredStudents.length})</h3>
                                        <input type="text" placeholder="Buscar..." value={studentSearchTerm} onChange={e => setStudentSearchTerm(e.target.value)} className="p-1 border rounded text-sm" />
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Nome</th><th className="p-3">Código</th><th className="p-3">Unidade</th><th className="p-3">Ações</th></tr></thead>
                                            <tbody>
                                                {filteredStudents.map(s => (
                                                    <tr key={s.id} className="border-b">
                                                        <td className="p-3">{s.name}</td>
                                                        <td className="p-3">{s.code}</td>
                                                        <td className="p-3">{s.unit}</td>
                                                        <td className="p-3 flex gap-2">
                                                            <button onClick={() => startEditingStudent(s)} className="text-blue-600 hover:underline">Editar</button>
                                                            <button onClick={() => initiateDeleteStudent(s.id)} className="text-red-600 hover:underline">Excluir</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- CONTEÚDO PROFESSORES (RESTAURADO) --- */}
                    {activeTab === 'teachers' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-bold text-gray-800">{editingTeacherId ? 'Editar Professor' : 'Cadastrar Novo Professor'}</h2>
                                        {editingTeacherId && (<button onClick={cancelEditingTeacher} className="text-sm text-red-600 hover:underline">Cancelar</button>)}
                                    </div>
                                    <form onSubmit={fullHandleTeacherSubmit} className="space-y-4">
                                        <div><label className="text-sm font-medium">Nome Completo</label><input type="text" value={tName} onChange={e => setTName(e.target.value)} required className="w-full p-2 border rounded" /></div>

                                        <div>
                                            <label className="text-sm font-medium">Matérias</label>
                                            <div className="flex gap-2">
                                                <select value={tempSubject} onChange={e => setTempSubject(e.target.value as Subject)} className="flex-1 p-2 border rounded">
                                                    {sortedSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <button type="button" onClick={handleAddSubject} className="bg-blue-100 text-blue-800 px-3 rounded">Add</button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {tSubjects.map(s => (<span key={s} className="bg-gray-100 px-2 rounded text-xs flex items-center gap-1">{s} <button type="button" onClick={() => handleRemoveSubject(s)}>&times;</button></span>))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="text-sm font-medium">CPF</label><input type="text" value={tCpf} onChange={e => setTCpf(e.target.value)} required className="w-full p-2 border rounded" /></div>
                                            <div><label className="text-sm font-medium">Telefone</label><input type="text" value={tPhone} onChange={handlePhoneChange} className="w-full p-2 border rounded" maxLength={14} /></div>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium">Unidade</label>
                                            {isGeneralAdmin ? (
                                                <select value={tUnit} onChange={e => setTUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">{SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select>
                                            ) : <div className="p-2 bg-gray-100 rounded text-gray-600">{adminUnit}</div>}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium">Senha</label>
                                            <div className="flex gap-2 relative">
                                                <input type={showTeacherPassword ? "text" : "password"} value={tPass} onChange={e => setTPass(e.target.value)} className="w-full p-2 border rounded" required={!editingTeacherId} />
                                                <button type="button" onClick={() => setShowTeacherPassword(!showTeacherPassword)} className="absolute right-16 top-2 text-gray-500">{showTeacherPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
                                                <button type="button" onClick={handleGenerateTeacherPass} className="px-3 py-2 bg-gray-200 rounded text-sm">Gerar</button>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Senha automática (8 caracteres).</p>
                                        </div>
                                        <Button type="submit" className="w-full">{editingTeacherId ? 'Salvar' : 'Cadastrar'}</Button>
                                    </form>
                                </div>
                            </div>

                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="p-4 bg-gray-50 border-b"><h3 className="font-bold">Professores ({filteredTeachers.length})</h3></div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Nome</th><th className="p-3">Matérias</th><th className="p-3">Unidade</th><th className="p-3">Ações</th></tr></thead>
                                            <tbody>
                                                {filteredTeachers.map(t => (
                                                    <tr key={t.id} className="border-b">
                                                        <td className="p-3">{t.name}</td>
                                                        <td className="p-3"><div className="flex flex-wrap gap-1">{t.subjects.map(s => <span key={s} className="bg-gray-100 px-2 rounded text-xs">{s}</span>)}</div></td>
                                                        <td className="p-3">{t.unit}</td>
                                                        <td className="p-3 flex gap-2">
                                                            <button onClick={() => startEditingTeacher(t)} className="text-blue-600 hover:underline">Editar</button>
                                                            <button onClick={() => initiateDeleteTeacher(t.id)} className="text-red-600 hover:underline">Excluir</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- CONTEÚDO ADMINS (NOVA ABA) --- */}
                    {activeTab === 'admins' && isGeneralAdmin && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-200">
                                    <h2 className="text-lg font-bold text-purple-800 mb-4">{editingAdminId ? 'Editar Admin' : 'Novo Admin de Unidade'}</h2>
                                    <form onSubmit={handleAdminSubmit} className="space-y-4">
                                        <div><label className="text-sm font-medium">Nome (Descrição)</label><input type="text" value={aName} onChange={e => setAName(e.target.value)} required className="w-full p-2 border rounded" /></div>
                                        <div><label className="text-sm font-medium">Usuário de Login</label><input type="text" value={aUser} onChange={e => setAUser(e.target.value)} required className="w-full p-2 border rounded" /></div>
                                        <div>
                                            <label className="text-sm font-medium">Unidade Responsável</label>
                                            <select value={aUnit} onChange={e => setAUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">
                                                {SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Senha</label>
                                            <div className="flex gap-2 relative">
                                                <input type={showAdminPassword ? "text" : "password"} value={aPass} onChange={e => setAPass(e.target.value)} required={!editingAdminId} className="w-full p-2 border rounded" />
                                                <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} className="absolute right-16 top-2 text-gray-500">{showAdminPassword ? <EyeOffIcon /> : <EyeIcon />}</button>
                                                <button type="button" onClick={handleGenerateAdminPass} className="px-3 py-2 bg-gray-200 rounded text-sm">Gerar</button>
                                            </div>
                                        </div>
                                        <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">Salvar Admin</Button>
                                    </form>
                                </div>
                            </div>

                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                                    <div className="p-4 bg-purple-50 border-b border-purple-100"><h3 className="font-bold text-purple-900">Administradores Cadastrados</h3></div>
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50"><tr><th className="p-3">Nome</th><th className="p-3">Usuário</th><th className="p-3">Unidade</th><th className="p-3">Ações</th></tr></thead>
                                        <tbody>
                                            {filteredAdmins.map(a => (
                                                <tr key={a.id} className="border-b">
                                                    <td className="p-3 font-medium">{a.name}</td>
                                                    <td className="p-3 font-mono text-gray-600">{a.username}</td>
                                                    <td className="p-3"><span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{a.unit}</span></td>
                                                    <td className="p-3 flex gap-2">
                                                        <button onClick={() => startEditingAdmin(a)} className="text-blue-600 hover:underline">Editar</button>
                                                        <button onClick={() => initiateDeleteAdmin(a.id)} className="text-red-600 hover:underline">Excluir</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}


                    {/* --- CONTEÚDO CONTATOS / COORDENAÇÃO --- */}
                    {activeTab === 'contacts' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-green-200">
                                    <h2 className="text-lg font-bold text-green-800 mb-4">{editingContactId ? 'Editar Contato/Coord.' : 'Novo Contato'}</h2>
                                    <form onSubmit={handleContactSubmit} className="space-y-4">
                                        <div><label className="text-sm font-medium">Nome</label><input type="text" value={cName} onChange={e => setCName(e.target.value)} required className="w-full p-2 border rounded" placeholder="Ex: Coord. Pedagógica" /></div>
                                        <div><label className="text-sm font-medium">Cargo/Função</label><input type="text" value={cRole} onChange={e => setCRole(e.target.value)} required className="w-full p-2 border rounded" placeholder="Ex: Coordenador" /></div>
                                        <div><label className="text-sm font-medium">Whatsapp</label><input type="text" value={cPhone} onChange={e => setCPhone(e.target.value)} required className="w-full p-2 border rounded" /></div>

                                        <div>
                                            <label className="text-sm font-medium">Segmento de Atuação</label>
                                            <select value={cSegment || ''} onChange={e => setCSegment(e.target.value as CoordinationSegment)} className="w-full p-2 border rounded">
                                                <option value="">-- Selecione (Opcional) --</option>
                                                <option value="infantil_fund1">Educação Infantil / Fundamental I</option>
                                                <option value="fund2_medio">Fundamental II / Ensino Médio</option>
                                                <option value="geral">Geral / Ambos</option>
                                            </select>
                                            <p className="text-xs text-gray-500 mt-1">Define para quais alunos aparecerá no Fale com a Escola.</p>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium">Unidade</label>
                                            {isGeneralAdmin ? (
                                                <select value={cUnit} onChange={e => setCUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">{SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select>
                                            ) : <div className="p-2 bg-gray-100 rounded text-gray-600">{adminUnit}</div>}
                                        </div>

                                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">{editingContactId ? 'Salvar Coord.' : 'Cadastrar Coord.'}</Button>
                                        {editingContactId && <button type="button" onClick={() => { setEditingContactId(null); setCName(''); setCPhone(''); setCSegment(undefined); }} className="w-full text-center text-sm text-gray-500 mt-2">Cancelar</button>}
                                    </form>
                                </div>
                            </div>

                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                                    <div className="p-4 bg-green-50 border-b border-green-100"><h3 className="font-bold text-green-900">Coordenação Cadastrada ({filteredContacts.length})</h3></div>
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50"><tr><th className="p-3">Nome/Cargo</th><th className="p-3">Segmento</th><th className="p-3">Whatsapp</th><th className="p-3">Ações</th></tr></thead>
                                        <tbody>
                                            {filteredContacts.map(c => (
                                                <tr key={c.id} className="border-b">
                                                    <td className="p-3">
                                                        <div className="font-bold">{c.name}</div>
                                                        <div className="text-gray-500 text-xs">{c.role} ({c.unit})</div>
                                                    </td>
                                                    <td className="p-3">
                                                        {c.segment === CoordinationSegment.INFANTIL_FUND1 && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">Infantil/Fund I</span>}
                                                        {c.segment === CoordinationSegment.FUND2_MEDIO && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Fund II/Médio</span>}
                                                        {(c.segment === CoordinationSegment.GERAL || !c.segment) && <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">Geral</span>}
                                                    </td>
                                                    <td className="p-3 text-xs font-mono">{c.phone}</td>
                                                    <td className="p-3 flex gap-2">
                                                        <button onClick={() => startEditingContact(c)} className="text-blue-600 hover:underline">Editar</button>
                                                        <button onClick={() => initiateDeleteContact(c.id)} className="text-red-600 hover:underline">Excluir</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredContacts.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">Nenhum coordenador cadastrado.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SEÇÃO DE MANUTENÇÃO (APENAS ADMIN GERAL) */}
                    {
                        isGeneralAdmin && (
                            <section className="bg-gray-100 border-t border-gray-300 mt-12 py-12">
                                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                    <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                                        ⚙️ Manutenção do Sistema / Virada de Ano
                                    </h2>
                                    <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 mb-8 rounded shadow-sm">
                                        <p className="font-bold">⚠️ Área de Risco</p>
                                        <p>Estas ferramentas manipulam dados críticos. Certifique-se de que sabe o que está fazendo.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                                        {/* 1. BACKUP */}
                                        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                                            <h3 className="text-lg font-bold text-blue-900 mb-2">1. Exportar Dados</h3>
                                            <p className="text-sm text-gray-600 mb-4">Gera um arquivo Excel (.xlsx) com todas as notas, faltas e mensagens atuais.</p>
                                            <Button onClick={async () => {
                                                try {
                                                    const wb = XLSX.utils.book_new();

                                                    // Fetch Data
                                                    const [usersRel, gradesRel, attRel, msgRel, reportsRel] = await Promise.all([
                                                        db.collection('students').get(),
                                                        db.collection('grades').get(),
                                                        db.collection('attendance').get(),
                                                        db.collection('schoolMessages').get(),
                                                        db.collection('earlyChildhoodReports').get()
                                                    ]);

                                                    // Map Students for easy lookup
                                                    const studentsMap: any = {};
                                                    usersRel.docs.forEach(d => { studentsMap[d.id] = d.data(); });

                                                    // 1. GRADES
                                                    const gradesData = gradesRel.docs.map(doc => {
                                                        const g = doc.data();
                                                        const s = studentsMap[g.studentId] || {};
                                                        return {
                                                            ID: g.id,
                                                            ALUNO_ID: g.studentId,
                                                            ALUNO_NOME: s.name || 'Desconhecido',
                                                            UNIDADE: s.unit || '',
                                                            TURMA: s.schoolClass || '',
                                                            DISCIPLINA: g.subject,
                                                            MEDIA_ANUAL: g.mediaAnual,
                                                            RESULTADO: g.situacaoFinal,
                                                            RAW_DATA: JSON.stringify(g)
                                                        };
                                                    });
                                                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gradesData), "Notas");

                                                    // 2. ATTENDANCE
                                                    const attData = attRel.docs.map(doc => {
                                                        const a = doc.data();
                                                        return {
                                                            ID: a.id,
                                                            DATA: a.date,
                                                            TURMA: a.schoolClass,
                                                            PROFESSOR: a.teacherName,
                                                            RAW_DATA: JSON.stringify(a)
                                                        };
                                                    });
                                                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attData), "Frequencia");

                                                    // 3. MESSAGES & OTHERS
                                                    const msgData = msgRel.docs.map(doc => ({ ...doc.data(), ID: doc.id }));
                                                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(msgData), "Mensagens");

                                                    const repData = reportsRel.docs.map(doc => ({ ...doc.data(), ID: doc.id }));
                                                    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(repData), "RelatoriosInfantil");

                                                    XLSX.writeFile(wb, `Backup_MeuExpansivo_${new Date().toISOString().split('T')[0]}.xlsx`);
                                                    alert("Backup gerado com sucesso!");
                                                } catch (e) {
                                                    console.error(e);
                                                    alert("Erro ao gerar backup: " + e);
                                                }
                                            }} className="w-full">
                                                💾 Baixar Backup Completo
                                            </Button>
                                        </div>

                                        {/* 2. RESTORE */}
                                        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                                            <h3 className="text-lg font-bold text-green-900 mb-2">2. Restaurar Dados</h3>
                                            <p className="text-sm text-gray-600 mb-4">Reimporta dados de um backup anterior. Útil para desfazer erros.</p>
                                            <input type="file" id="restoreFile" accept=".xlsx" className="hidden" onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                if (!window.confirm("Isso irá mesclar/sobrescrever os dados atuais com os do arquivo. Confirmar?")) return;

                                                try {
                                                    const data = await file.arrayBuffer();
                                                    const wb = XLSX.read(data);
                                                    const batch = db.batch();

                                                    // Restore Grades
                                                    const wsGrades = wb.Sheets["Notas"];
                                                    if (wsGrades) {
                                                        const gradesJson = XLSX.utils.sheet_to_json(wsGrades);
                                                        gradesJson.forEach((row: any) => {
                                                            if (row.RAW_DATA) {
                                                                const gBase = JSON.parse(row.RAW_DATA);
                                                                batch.set(db.collection('grades').doc(gBase.id), gBase);
                                                            }
                                                        });
                                                    }

                                                    // Restore Attendance
                                                    const wsAtt = wb.Sheets["Frequencia"];
                                                    if (wsAtt) {
                                                        const attJson = XLSX.utils.sheet_to_json(wsAtt);
                                                        attJson.forEach((row: any) => {
                                                            if (row.RAW_DATA) {
                                                                const aBase = JSON.parse(row.RAW_DATA);
                                                                batch.set(db.collection('attendance').doc(aBase.id), aBase);
                                                            }
                                                        });
                                                    }

                                                    // Restore Messages
                                                    const wsMsg = wb.Sheets["Mensagens"];
                                                    if (wsMsg) {
                                                        const msgJson = XLSX.utils.sheet_to_json(wsMsg);
                                                        msgJson.forEach((row: any) => {
                                                            if (row.ID) {
                                                                const { ID, ...rest } = row;
                                                                batch.set(db.collection('schoolMessages').doc(ID), rest);
                                                            }
                                                        });
                                                    }

                                                    await batch.commit();
                                                    alert("Restauração concluída! Recarregue a página.");
                                                    window.location.reload();
                                                } catch (err) {
                                                    console.error(err);
                                                    alert("Erro na restauração: " + err);
                                                }
                                            }} />
                                            <Button variant="secondary" onClick={() => document.getElementById('restoreFile')?.click()} className="w-full">
                                                ♻️ Carregar Backup
                                            </Button>
                                        </div>

                                        {/* 3. RESET */}
                                        <div className="bg-white p-6 rounded-lg shadow border border-red-200">
                                            <h3 className="text-lg font-bold text-red-900 mb-2">3. Novo Ano Letivo</h3>
                                            <p className="text-sm text-gray-600 mb-4">Apaga NOTAS, FALTAS e MENSAGENS. Mantém alunos e professores.</p>
                                            <Button variant="danger" onClick={async () => {
                                                if (!window.confirm("VOCÊ É O ADMINISTRADOR GERAL.\n\nEsta ação apagará TODAS as notas, faltas e mensagens de TODAS as unidades para iniciar um novo ano.\n\nAs contas de Alunos e Professores SERÃO MANTIDAS.\n\nTem certeza absoluta?")) return;
                                                if (!window.confirm("CONFIRMAÇÃO FINAL: Você já baixou o backup dos dados atuais? Se não, cancele agora.")) return;

                                                try {
                                                    const collections = ['grades', 'attendance', 'schoolMessages', 'earlyChildhoodReports', 'notifications', 'access_logs', 'daily_stats'];
                                                    let deletedCount = 0;

                                                    // Batch delete function
                                                    const deleteCollection = async (col: string) => {
                                                        const snapshot = await db.collection(col).get();
                                                        const batch = db.batch();
                                                        snapshot.docs.forEach(doc => batch.delete(doc.ref));
                                                        await batch.commit();
                                                        deletedCount += snapshot.size;
                                                    };

                                                    await Promise.all(collections.map(c => deleteCollection(c)));
                                                    alert(`Ano Letivo Reiniciado! ${deletedCount} registros transacionais foram apagados.`);
                                                    window.location.reload();

                                                } catch (e) {
                                                    alert("Erro ao resetar: " + e);
                                                }
                                            }} className="w-full">
                                                🔥 Iniciar Novo Ano
                                            </Button>
                                        </div>

                                    </div>
                                </div>
                            </section>
                        )
                    }

                </main>
            </div>
        </div>
    );
};
