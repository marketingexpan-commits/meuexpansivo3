import React, { useState } from 'react';
import { Admin, Student, Teacher, SchoolUnit, Subject, SchoolShift, SchoolClass, SchoolMessage, MessageType, MessageRecipient, AttendanceRecord, AttendanceStatus, UnitContact, ContactRole } from '../types';
import { SCHOOL_UNITS_LIST, SUBJECT_LIST, SCHOOL_SHIFTS_LIST, SCHOOL_CLASSES_LIST, SCHOOL_GRADES_LIST } from '../constants';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';

interface AdminDashboardProps {
    admin: Admin;
    students: Student[];
    teachers: Teacher[];
    admins?: Admin[];
    schoolMessages: SchoolMessage[];
    attendanceRecords: AttendanceRecord[];
    unitContacts?: UnitContact[]; // Nova prop
    onAddStudent: (student: Student) => void;
    onEditStudent: (student: Student) => void;
    onDeleteStudent: (id: string) => void;
    onToggleBlockStudent: (id: string) => void;
    onAddTeacher: (teacher: Teacher) => void;
    onEditTeacher: (teacher: Teacher) => void;
    onDeleteTeacher: (id: string) => void;
    onAddAdmin?: (admin: Admin) => void;
    onEditAdmin?: (admin: Admin) => void;
    onDeleteAdmin?: (id: string) => void;
    onUpdateMessageStatus: (messageId: string, status: 'new' | 'read') => Promise<void>;
    onAddUnitContact?: (contact: UnitContact) => void; // Nova prop
    onEditUnitContact?: (contact: UnitContact) => void; // Nova prop para edição
    onDeleteUnitContact?: (id: string) => void; // Nova prop
    onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
    admin,
    students,
    teachers,
    admins = [],
    schoolMessages,
    attendanceRecords,
    unitContacts = [],
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
    onUpdateMessageStatus,
    onAddUnitContact,
    onEditUnitContact,
    onDeleteUnitContact,
    onLogout
}) => {
    const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'admins' | 'messages' | 'attendance' | 'contacts'>('students');

    const adminUnit = admin.unit;
    const isGeneralAdmin = !adminUnit;

    // --- ESTADOS GERAIS ---
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
    const [studentFilterGrade, setStudentFilterGrade] = useState(''); // Novo estado para filtro de série

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

    const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
    const [aName, setAName] = useState('');
    const [aUser, setAUser] = useState('');
    const [aPass, setAPass] = useState('');
    const [aUnit, setAUnit] = useState<SchoolUnit>(SchoolUnit.UNIT_1);
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [adminToDelete, setAdminToDelete] = useState<string | null>(null);

    const [messageFilter, setMessageFilter] = useState<'new' | 'all'>('new');

    // Estados para Frequência
    const [attendanceFilterUnit, setAttendanceFilterUnit] = useState<SchoolUnit | ''>(adminUnit || '');
    const [attendanceFilterGrade, setAttendanceFilterGrade] = useState('');
    const [attendanceFilterDate, setAttendanceFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

    // Estados para Contatos
    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('+55');
    const [contactUnit, setContactUnit] = useState<SchoolUnit>(adminUnit || SchoolUnit.UNIT_1);

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let password = "A" + "a" + "1" + Array(5).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        return password.split('').sort(() => 0.5 - Math.random()).join('');
    };

    const handleGenerateStudentPass = () => { setSPass(generatePassword()); setShowStudentPassword(true); };
    const handleGenerateTeacherPass = () => { setTPass(generatePassword()); setShowTeacherPassword(true); };
    const handleGenerateAdminPass = () => { setAPass(generatePassword()); setShowAdminPassword(true); };

    const filteredStudents = students.filter(student => {
        const matchesUnit = isGeneralAdmin ? true : student.unit === adminUnit;
        const term = studentSearchTerm.toLowerCase();
        const matchesSearch = student.name.toLowerCase().includes(term) || student.code.includes(term);
        const matchesGrade = studentFilterGrade ? student.gradeLevel === studentFilterGrade : true;
        return matchesUnit && matchesSearch && matchesGrade;
    });

    const filteredTeachers = teachers.filter(teacher => isGeneralAdmin || teacher.unit === adminUnit);
    const filteredAdmins = admins.filter(a => a.id !== 'a0' && a.unit);
    const sortedSubjects = [...SUBJECT_LIST].sort((a, b) => a.localeCompare(b));

    const filteredMessages = schoolMessages.filter(message => (isGeneralAdmin || message.unit === adminUnit) && (messageFilter === 'all' || message.status === 'new'));
    const newMessagesCount = schoolMessages.filter(m => (isGeneralAdmin || m.unit === adminUnit) && m.status === 'new').length;

    const filteredAttendanceRecords = attendanceRecords.filter(record => {
        const unitMatch = isGeneralAdmin ? (attendanceFilterUnit ? record.unit === attendanceFilterUnit : true) : record.unit === adminUnit;
        const gradeMatch = attendanceFilterGrade ? record.gradeLevel === attendanceFilterGrade : true;
        const dateMatch = attendanceFilterDate ? record.date === attendanceFilterDate : true;
        return unitMatch && gradeMatch && dateMatch;
    }).sort((a, b) => a.id.localeCompare(b.id));

    // Filtros para contatos
    const filteredContacts = unitContacts.filter(c => isGeneralAdmin ? (contactUnit ? c.unit === contactUnit : true) : c.unit === adminUnit);
    const directors = filteredContacts.filter(c => c.role === ContactRole.DIRECTOR);
    const coordinators = filteredContacts.filter(c => c.role === ContactRole.COORDINATOR);

    const formatDate = (isoString: string, includeTime = true) => {
        const date = new Date(isoString);
        if (includeTime) {
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    };

    const getStudentNameById = (id: string) => students.find(s => s.id === id)?.name || 'Aluno não encontrado';


    // --- HANDLERS ---
    const handleAdminSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!onAddAdmin || !onEditAdmin) return; if (editingAdminId) { const originalAdmin = admins.find(a => a.id === editingAdminId)!; onEditAdmin({ ...originalAdmin, name: aName, username: aUser, unit: aUnit, password: aPass.trim() ? aPass : originalAdmin.password }); alert("Administrador atualizado!"); setEditingAdminId(null); } else { onAddAdmin({ id: `admin-${Date.now()}`, name: aName, username: aUser, password: aPass, unit: aUnit }); alert("Administrador criado!"); } setAName(''); setAUser(''); setAPass(''); };
    const startEditingAdmin = (adm: Admin) => { setEditingAdminId(adm.id); setAName(adm.name); setAUser(adm.username); setAUnit(adm.unit!); setAPass(adm.password); };
    const initiateDeleteAdmin = (id: string) => setAdminToDelete(id);
    const initiateDeleteStudent = (id: string) => setStudentToDelete(id);
    const startEditingStudent = (s: Student) => { setEditingStudentId(s.id); setSName(s.name); setSCode(s.code); setSGrade(s.gradeLevel); setSUnit(s.unit); setSShift(s.shift); setSClass(s.schoolClass); setSPass(s.password); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const cancelEditingStudent = () => { setEditingStudentId(null); setSName(''); setSCode(''); setSPass(''); };
    const fullHandleStudentSubmit = (e: React.FormEvent) => { e.preventDefault(); const unitToSave = isGeneralAdmin ? sUnit : adminUnit!; if (editingStudentId) { const original = students.find(s => s.id === editingStudentId)!; onEditStudent({ ...original, name: sName, code: sCode, gradeLevel: sGrade, unit: unitToSave, shift: sShift, schoolClass: sClass, password: sPass.trim() ? sPass : original.password }); alert("Atualizado!"); cancelEditingStudent(); } else { onAddStudent({ id: `student-${Date.now()}`, name: sName, code: sCode, gradeLevel: sGrade, unit: unitToSave, shift: sShift, schoolClass: sClass, password: sPass, isBlocked: false }); alert("Cadastrado!"); setSName(''); setSCode(''); setSPass(''); } };
    const initiateDeleteTeacher = (id: string) => setTeacherToDelete(id);
    const startEditingTeacher = (t: Teacher) => { setEditingTeacherId(t.id); setTName(t.name); setTCpf(t.cpf); setTPhone(t.phoneNumber || '+55'); setTUnit(t.unit); setTSubjects(t.subjects); setTPass(t.password); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const cancelEditingTeacher = () => { setEditingTeacherId(null); setTName(''); setTCpf(''); setTPhone('+55'); setTPass(''); setTSubjects([]); };
    const fullHandleTeacherSubmit = (e: React.FormEvent) => { e.preventDefault(); const unitToSave = isGeneralAdmin ? tUnit : adminUnit!; if (editingTeacherId) { const original = teachers.find(t => t.id === editingTeacherId)!; onEditTeacher({ ...original, name: tName, cpf: tCpf, phoneNumber: tPhone, unit: unitToSave, subjects: tSubjects, password: tPass.trim() ? tPass : original.password }); alert("Atualizado!"); cancelEditingTeacher(); } else { onAddTeacher({ id: `teacher-${Date.now()}`, name: tName, cpf: tCpf, phoneNumber: tPhone, unit: unitToSave, subjects: tSubjects, password: tPass }); alert("Cadastrado!"); setTName(''); setTCpf(''); setTPass(''); } };
    const handleAddSubject = () => { if (!tSubjects.includes(tempSubject)) setTSubjects([...tSubjects, tempSubject]); };
    const handleRemoveSubject = (s: Subject) => setTSubjects(tSubjects.filter(sub => sub !== s));

    // Handlers de Telefone (Separados)
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (/^[+]?[0-9]*$/.test(e.target.value)) setTPhone(e.target.value); };
    const handleContactPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (/^[+]?[0-9]*$/.test(e.target.value)) setContactPhone(e.target.value); };

    // Handlers de Contatos
    const handleSaveContact = (role: ContactRole) => {
        if (!contactName || !contactPhone) return alert("Preencha nome e telefone.");

        const newContact: UnitContact = {
            id: editingContactId || `contact-${Date.now()}`,
            name: contactName,
            phoneNumber: contactPhone,
            role: role,
            unit: contactUnit
        };

        if (editingContactId && onEditUnitContact) {
            onEditUnitContact(newContact);
            alert('Contato atualizado com sucesso!');
            setEditingContactId(null);
        } else if (onAddUnitContact) {
            onAddUnitContact(newContact);
            alert('Contato adicionado com sucesso!');
        }

        setContactName('');
        setContactPhone('+55');
    };

    const startEditingContact = (contact: UnitContact) => {
        setEditingContactId(contact.id);
        setContactName(contact.name);
        setContactPhone(contact.phoneNumber);
        setContactUnit(contact.unit);
    };

    const cancelEditingContact = () => {
        setEditingContactId(null);
        setContactName('');
        setContactPhone('+55');
    };

    const EyeIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);
    const EyeOffIcon = () => (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>);

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center items-center py-8 px-4 font-sans">
            {(studentToDelete || teacherToDelete || adminToDelete) && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-50 backdrop-blur-sm"><div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in-up"><h3 className="text-lg font-bold text-center text-gray-900 mb-2">Confirmar Exclusão</h3><p className="text-sm text-center text-gray-500 mb-6">Tem certeza? Essa ação não pode ser desfeita.</p><div className="flex gap-3 justify-center"><Button variant="secondary" onClick={() => { setStudentToDelete(null); setTeacherToDelete(null); setAdminToDelete(null); }} className="w-full">Cancelar</Button><Button variant="danger" onClick={() => { if (studentToDelete) { onDeleteStudent(studentToDelete); setStudentToDelete(null); } if (teacherToDelete) { onDeleteTeacher(teacherToDelete); setTeacherToDelete(null); } if (adminToDelete && onDeleteAdmin) { onDeleteAdmin(adminToDelete); setAdminToDelete(null); } }} className="w-full">Sim, Excluir</Button></div></div></div>)}

            <div className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl overflow-hidden relative min-h-[600px] flex flex-col">
                {/* HEADER */}
                <div className="bg-gradient-to-br from-blue-950 to-slate-900 p-6 pb-6 shadow-md relative shrink-0">
                    <div className="flex flex-row justify-between items-center relative z-10">
                        <div className="flex items-center gap-4 text-white">
                            <SchoolLogo variant="header" />
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-white mb-0.5 shadow-black drop-shadow-sm">
                                    Meu Expansivo
                                </h1>
                                <div className="flex items-center gap-2 text-blue-200 text-sm font-medium">
                                    <span>Administração ({adminUnit || 'GERAL'})</span>
                                    <span className="w-1 h-1 rounded-full bg-blue-400"></span>
                                    <span className="text-blue-200">{admin.name}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button variant="secondary" onClick={onLogout} className="!bg-transparent border-none !text-white font-medium hover:!text-gray-200 shadow-none !px-0">
                                Sair
                            </Button>
                        </div>
                    </div>
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
                    <div className="absolute top-0 right-20 -mt-10 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                    <div className="flex space-x-4 mb-6 overflow-x-auto pb-2">
                        <button onClick={() => setActiveTab('students')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'students' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Gerenciar Alunos</button>
                        <button onClick={() => setActiveTab('teachers')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'teachers' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Gerenciar Professores</button>
                        <button onClick={() => setActiveTab('messages')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2 ${activeTab === 'messages' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Mensagens{newMessagesCount > 0 && <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">{newMessagesCount}</span>}</button>
                        <button onClick={() => setActiveTab('attendance')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'attendance' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Controle de Frequência</button>
                        <button onClick={() => setActiveTab('contacts')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'contacts' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Gestão de Contatos</button>
                        <button onClick={() => setActiveTab('admins')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'admins' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Gerenciar Admins</button>
                    </div>

                    {activeTab === 'students' && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><div className="lg:col-span-1"><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><h2 className="text-lg font-bold text-gray-800 mb-4">{editingStudentId ? 'Editar Aluno' : 'Cadastrar Novo Aluno'}</h2><form onSubmit={fullHandleStudentSubmit} className="space-y-4"><div><label className="text-sm font-medium">Nome</label><input type="text" value={sName} onChange={e => setSName(e.target.value)} required className="w-full p-2 border rounded" /></div><div><label className="text-sm font-medium">Código</label><input type="text" value={sCode} onChange={e => setSCode(e.target.value)} required className="w-full p-2 border rounded" /></div><div><label className="text-sm font-medium">Série</label><select value={sGrade} onChange={e => setSGrade(e.target.value)} className="w-full p-2 border rounded">{SCHOOL_GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}</select></div><div className="grid grid-cols-2 gap-2"><div><label className="text-sm font-medium">Turma</label><select value={sClass} onChange={e => setSClass(e.target.value as SchoolClass)} className="w-full p-2 border rounded">{SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="text-sm font-medium">Turno</label><select value={sShift} onChange={e => setSShift(e.target.value as SchoolShift)} className="w-full p-2 border rounded">{SCHOOL_SHIFTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select></div></div><div><label className="text-sm font-medium">Unidade</label>{isGeneralAdmin ? (<select value={sUnit} onChange={e => setSUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">{SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select>) : <div className="p-2 bg-gray-100 rounded text-gray-600">{adminUnit}</div>}</div><div><label className="text-sm font-medium">Senha</label><div className="flex gap-2 relative"><input type={showStudentPassword ? "text" : "password"} value={sPass} onChange={e => setSPass(e.target.value)} className="w-full p-2 border rounded" required={!editingStudentId} /><button type="button" onClick={() => setShowStudentPassword(!showStudentPassword)} className="absolute right-16 top-2 text-gray-500">{showStudentPassword ? <EyeOffIcon /> : <EyeIcon />}</button><button type="button" onClick={handleGenerateStudentPass} className="px-3 py-2 bg-gray-200 rounded text-sm">Gerar</button></div><p className="text-xs text-gray-500 mt-1">Senha automática (8 caracteres).</p></div><Button type="submit" className="w-full">{editingStudentId ? 'Salvar' : 'Cadastrar'}</Button></form></div></div>

                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-4 bg-gray-50 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                                    <h3 className="font-bold text-gray-700 whitespace-nowrap">Alunos ({filteredStudents.length})</h3>
                                    <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                                        <select
                                            value={studentFilterGrade}
                                            onChange={(e) => setStudentFilterGrade(e.target.value)}
                                            className="p-2 border rounded text-sm bg-white text-gray-700 focus:ring-blue-950 focus:border-blue-950"
                                        >
                                            <option value="">Todas as Séries</option>
                                            {SCHOOL_GRADES_LIST.map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="Buscar por nome ou código..."
                                            value={studentSearchTerm}
                                            onChange={e => setStudentSearchTerm(e.target.value)}
                                            className="p-2 border rounded text-sm w-full md:w-64 focus:ring-blue-950 focus:border-blue-950"
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[600px] text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs"><tr><th className="p-3">Nome</th><th className="p-3">Código</th><th className="p-3">Unidade</th><th className="p-3">Ações</th></tr></thead>
                                        <tbody>{filteredStudents.map(s => (<tr key={s.id} className="border-b hover:bg-gray-50"><td className="p-3 font-medium text-gray-800">{s.name}{s.isBlocked && <span className="ml-2 bg-red-100 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full">BLOQUEADO</span>}</td><td className="p-3 font-mono text-gray-600">{s.code}</td><td className="p-3">{s.unit}</td><td className="p-3 flex gap-3 text-xs font-medium"><button onClick={() => startEditingStudent(s)} className="text-blue-950 hover:underline">Editar</button><button onClick={() => onToggleBlockStudent(s.id)} className={`hover:underline ${s.isBlocked ? 'text-green-600' : 'text-yellow-600'}`}>{s.isBlocked ? 'Desbloquear' : 'Bloquear'}</button><button onClick={() => initiateDeleteStudent(s.id)} className="text-red-600 hover:underline">Excluir</button></td></tr>))}</tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>)}
                    {activeTab === 'teachers' && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><div className="lg:col-span-1"><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-gray-800">{editingTeacherId ? 'Editar Professor' : 'Cadastrar Novo Professor'}</h2>{editingTeacherId && (<button onClick={cancelEditingTeacher} className="text-sm text-red-600 hover:underline">Cancelar</button>)}</div><form onSubmit={fullHandleTeacherSubmit} className="space-y-4"><div><label className="text-sm font-medium">Nome Completo</label><input type="text" value={tName} onChange={e => setTName(e.target.value)} required className="w-full p-2 border rounded" /></div><div><label className="text-sm font-medium">Matérias</label><div className="flex gap-2"><select value={tempSubject} onChange={e => setTempSubject(e.target.value as Subject)} className="flex-1 p-2 border rounded">{sortedSubjects.map(s => <option key={s} value={s}>{s}</option>)}</select><button type="button" onClick={handleAddSubject} className="bg-blue-100 text-blue-950 px-3 rounded">Add</button></div><div className="flex flex-wrap gap-2 mt-2">{tSubjects.map(s => (<span key={s} className="bg-gray-100 px-2 rounded text-xs flex items-center gap-1">{s} <button type="button" onClick={() => handleRemoveSubject(s)}>&times;</button></span>))}</div></div><div className="grid grid-cols-2 gap-2"><div><label className="text-sm font-medium">CPF</label><input type="text" value={tCpf} onChange={e => setTCpf(e.target.value)} required className="w-full p-2 border rounded" /></div><div><label className="text-sm font-medium">Telefone</label><input type="text" value={tPhone} onChange={handlePhoneChange} className="w-full p-2 border rounded" maxLength={14} /></div></div><div><label className="text-sm font-medium">Unidade</label>{isGeneralAdmin ? (<select value={tUnit} onChange={e => setTUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">{SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select>) : <div className="p-2 bg-gray-100 rounded text-gray-600">{adminUnit}</div>}</div><div><label className="text-sm font-medium">Senha</label><div className="flex gap-2 relative"><input type={showTeacherPassword ? "text" : "password"} value={tPass} onChange={e => setTPass(e.target.value)} className="w-full p-2 border rounded" required={!editingTeacherId} /><button type="button" onClick={() => setShowTeacherPassword(!showTeacherPassword)} className="absolute right-16 top-2 text-gray-500">{showTeacherPassword ? <EyeOffIcon /> : <EyeIcon />}</button><button type="button" onClick={handleGenerateTeacherPass} className="px-3 py-2 bg-gray-200 rounded text-sm">Gerar</button></div><p className="text-xs text-gray-500 mt-1">Senha automática (8 caracteres).</p></div><Button type="submit" className="w-full">{editingTeacherId ? 'Salvar' : 'Cadastrar'}</Button></form></div></div><div className="lg:col-span-2"><div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="p-4 bg-gray-50 border-b"><h3 className="font-bold">Professores ({filteredTeachers.length})</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm text-left"><thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Nome</th><th className="p-3">Matérias</th><th className="p-3">Unidade</th><th className="p-3">Ações</th></tr></thead><tbody>{filteredTeachers.map(t => (<tr key={t.id} className="border-b"><td className="p-3">{t.name}</td><td className="p-3"><div className="flex flex-wrap gap-1">{t.subjects.map(s => <span key={s} className="bg-gray-100 px-2 rounded text-xs">{s}</span>)}</div></td><td className="p-3">{t.unit}</td><td className="p-3 flex gap-2"><button onClick={() => startEditingTeacher(t)} className="text-blue-950 hover:underline">Editar</button><button onClick={() => initiateDeleteTeacher(t.id)} className="text-red-600 hover:underline">Excluir</button></td></tr>))}</tbody></table></div></div></div></div>)}
                    {activeTab === 'messages' && (<div className="animate-fade-in-up"><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b"><h2 className="text-2xl font-bold text-gray-800 mb-3 sm:mb-0">Central de Mensagens</h2><div className="flex items-center gap-2 p-1 bg-gray-200 rounded-lg"><button onClick={() => setMessageFilter('new')} className={`px-3 py-1 text-sm rounded-md font-medium ${messageFilter === 'new' ? 'bg-white shadow text-blue-950' : 'text-gray-600'}`}>Não Lidas</button><button onClick={() => setMessageFilter('all')} className={`px-3 py-1 text-sm rounded-md font-medium ${messageFilter === 'all' ? 'bg-white shadow text-blue-950' : 'text-gray-600'}`}>Todas</button></div></div>{filteredMessages.length > 0 ? (<div className="space-y-4">{filteredMessages.map(message => {
                        const sender = students.find(s => s.id === message.studentId);
                        const typeStyles = { [MessageType.COMPLIMENT]: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' }, [MessageType.SUGGESTION]: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' }, [MessageType.COMPLAINT]: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' }, }; const style = typeStyles[message.messageType]; return (<div key={message.id} className={`p-5 rounded-lg shadow-sm border ${message.status === 'new' ? 'bg-white border-l-4 border-l-blue-950' : 'bg-gray-50 border-gray-200'}`}><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 pb-3 border-b"><div><p className="font-bold text-gray-800">{message.studentName}</p><p className="text-xs text-gray-500">Unidade: <span className="font-semibold">{message.unit}</span></p> {sender && (<p className="text-xs text-gray-600 font-medium mt-0.5">{sender.gradeLevel} - {sender.schoolClass} ({sender.shift})</p>)}</div><p className="text-xs text-gray-400 mt-2 sm:mt-0">{formatDate(message.timestamp)}</p></div><div className="flex gap-4 mb-4"><span className={`px-2 py-1 text-xs font-bold rounded ${style.bg} ${style.border} ${style.text}`}>{message.messageType}</span><span className="text-xs text-gray-500 font-medium self-center">Para: <span className="font-bold text-gray-700">{message.recipient}</span></span></div><p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p><div className="mt-4 pt-3 border-t flex justify-end"><button onClick={() => onUpdateMessageStatus(message.id, message.status === 'new' ? 'read' : 'new')} className={`text-xs font-bold py-1 px-3 rounded-full transition-colors ${message.status === 'new' ? 'bg-blue-100 text-blue-950 hover:bg-blue-200' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{message.status === 'new' ? 'Marcar como Lida' : 'Marcar como Não Lida'}</button></div></div>);
                    })}</div>) : (<div className="text-center py-16"><p className="text-gray-500">Nenhuma mensagem {messageFilter === 'new' ? 'não lida' : ''} encontrada.</p></div>)}</div>)}

                    {activeTab === 'attendance' && (
                        <div className="animate-fade-in-up">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">Controle de Frequência</h2>
                            <div className="p-4 bg-white rounded-lg shadow-md border mb-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {isGeneralAdmin && (
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">Unidade</label>
                                            <select value={attendanceFilterUnit} onChange={e => setAttendanceFilterUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded mt-1">
                                                <option value="">Todas</option>
                                                {SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Série/Ano</label>
                                        <select value={attendanceFilterGrade} onChange={e => setAttendanceFilterGrade(e.target.value)} className="w-full p-2 border rounded mt-1">
                                            <option value="">Todas</option>
                                            {SCHOOL_GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Data</label>
                                        <input type="date" value={attendanceFilterDate} onChange={e => setAttendanceFilterDate(e.target.value)} className="w-full p-2 border rounded mt-1" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {filteredAttendanceRecords.length > 0 ? (
                                    filteredAttendanceRecords.map(record => {
                                        const total = Object.keys(record.studentStatus).length;
                                        const presents = Object.values(record.studentStatus).filter(s => s === AttendanceStatus.PRESENT).length;
                                        const absents = total - presents;
                                        return (
                                            <div key={record.id} className="bg-white rounded-lg shadow-sm border">
                                                <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer hover:bg-gray-50" onClick={() => setExpandedRecordId(expandedRecordId === record.id ? null : record.id)}>
                                                    <div>
                                                        <p className="font-bold text-blue-950">{record.gradeLevel} - Turma {record.schoolClass}</p>
                                                        <p className="text-sm text-gray-500">{record.unit} | Data: {formatDate(record.date, false)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-2 md:mt-0 text-sm">
                                                        <span className="font-bold text-green-600">{presents} Presentes</span>
                                                        <span className="font-bold text-red-600">{absents} Ausentes</span>
                                                        <span className="text-xs text-gray-400">por {record.teacherName.split(' ')[0]}</span>
                                                    </div>
                                                </div>
                                                {expandedRecordId === record.id && (
                                                    <div className="border-t p-4 bg-gray-50/50">
                                                        <h4 className="font-bold mb-2">Detalhes da Chamada:</h4>
                                                        <ul className="divide-y max-h-60 overflow-y-auto">
                                                            {Object.entries(record.studentStatus).map(([studentId, status]) => {
                                                                const student = students.find(s => s.id === studentId);
                                                                return (
                                                                    <li key={studentId} className="flex justify-between items-center py-2 px-1">
                                                                        <div>
                                                                            <span className="text-sm text-gray-800 font-medium">{student ? student.name : 'Aluno Removido'}</span>
                                                                            {student && <span className="text-xs text-gray-400 ml-2">({student.shift})</span>}
                                                                        </div>
                                                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${status === AttendanceStatus.PRESENT ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{status}</span>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-12 text-gray-500">
                                        <p>Nenhum registro de frequência encontrado para os filtros selecionados.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}



                    {/* --- CONTEÚDO GESTÃO DE CONTATOS (NOVA ABA) --- */}
                    {activeTab === 'contacts' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* FORMULÁRIO DE CADASTRO */}
                            <div className="lg:col-span-1">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-bold text-blue-950">{editingContactId ? 'Editar Contato' : 'Adicionar Contato'}</h2>
                                        {editingContactId && (
                                            <button onClick={cancelEditingContact} className="text-sm text-red-600 hover:underline">Cancelar</button>
                                        )}
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium">Nome Completo</label>
                                            <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className="w-full p-2 border rounded" placeholder="Ex: Maria Silva" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Telefone (WhatsApp)</label>
                                            <input type="text" value={contactPhone} onChange={handleContactPhoneChange} className="w-full p-2 border rounded" placeholder="Ex: 5584999999999" />
                                            <p className="text-xs text-gray-500 mt-1">Apenas números, com DDD (Ex: 5584...)</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Unidade</label>
                                            {isGeneralAdmin ? (
                                                <select value={contactUnit} onChange={e => setContactUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">{SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}</select>
                                            ) : <div className="p-2 bg-gray-100 rounded text-gray-600">{adminUnit}</div>}
                                        </div>
                                        <div className="pt-2 grid grid-cols-2 gap-3">
                                            <Button onClick={() => handleSaveContact(ContactRole.DIRECTOR)} className="w-full bg-blue-950 hover:bg-blue-900">
                                                Salvar Diretor
                                            </Button>
                                            <Button onClick={() => handleSaveContact(ContactRole.COORDINATOR)} className="w-full bg-orange-600 hover:bg-orange-700">
                                                Salvar Coord.
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* LISTAGEM DE CONTATOS */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* DIRETORES */}
                                <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-x-auto">
                                    <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center min-w-[500px]">
                                        <h3 className="font-bold text-blue-900 flex items-center gap-2">
                                            <span className="text-xl">👔</span> Diretoria
                                        </h3>
                                        <span className="text-xs font-semibold bg-blue-200 text-blue-800 px-2 py-1 rounded-full">{directors.length} cadastrados</span>
                                    </div>
                                    {directors.length > 0 ? (
                                        <table className="min-w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Nome</th><th className="p-3">Telefone</th><th className="p-3">Unidade</th><th className="p-3 text-right">Ação</th></tr></thead>
                                            <tbody>
                                                {directors.map(c => (
                                                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                                                        <td className="p-3 font-medium">{c.name}</td>
                                                        <td className="p-3 font-mono text-gray-600">{c.phoneNumber}</td>
                                                        <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{c.unit}</span></td>
                                                        <td className="p-3 text-right flex justify-end gap-2">
                                                            <button onClick={() => startEditingContact(c)} className="text-blue-950 hover:underline text-xs font-bold px-2 py-1">Editar</button>
                                                            <button onClick={() => onDeleteUnitContact && onDeleteUnitContact(c.id)} className="text-red-600 hover:text-red-800 text-xs font-bold bg-red-50 px-2 py-1 rounded border border-red-100">Remover</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-8 text-center text-gray-400 italic">Nenhum diretor cadastrado para esta seleção.</div>
                                    )}
                                </div>

                                {/* COORDENADORES */}
                                <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-x-auto">
                                    <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center min-w-[500px]">
                                        <h3 className="font-bold text-orange-900 flex items-center gap-2">
                                            <span className="text-xl">📋</span> Coordenação
                                        </h3>
                                        <span className="text-xs font-semibold bg-orange-200 text-orange-800 px-2 py-1 rounded-full">{coordinators.length} cadastrados</span>
                                    </div>
                                    {coordinators.length > 0 ? (
                                        <table className="min-w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-500"><tr><th className="p-3">Nome</th><th className="p-3">Telefone</th><th className="p-3">Unidade</th><th className="p-3 text-right">Ação</th></tr></thead>
                                            <tbody>
                                                {coordinators.map(c => (
                                                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                                                        <td className="p-3 font-medium">{c.name}</td>
                                                        <td className="p-3 font-mono text-gray-600">{c.phoneNumber}</td>
                                                        <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{c.unit}</span></td>
                                                        <td className="p-3 text-right flex justify-end gap-2">
                                                            <button onClick={() => startEditingContact(c)} className="text-blue-950 hover:underline text-xs font-bold px-2 py-1">Editar</button>
                                                            <button onClick={() => onDeleteUnitContact && onDeleteUnitContact(c.id)} className="text-red-600 hover:text-red-800 text-xs font-bold bg-red-50 px-2 py-1 rounded border border-red-100">Remover</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-8 text-center text-gray-400 italic">Nenhum coordenador cadastrado para esta seleção.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'admins' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* FORMULÁRIO DE ADMIN */}
                            <div className="lg:col-span-1">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <h2 className="text-lg font-bold text-gray-800 mb-4">{editingAdminId ? 'Editar Admin' : 'Novo Admin'}</h2>
                                    <form onSubmit={handleAdminSubmit} className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium">Nome</label>
                                            <input type="text" value={aName} onChange={e => setAName(e.target.value)} required className="w-full p-2 border rounded" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Usuário (Login)</label>
                                            <input type="text" value={aUser} onChange={e => setAUser(e.target.value)} required className="w-full p-2 border rounded" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Unidade</label>
                                            <select value={aUnit} onChange={e => setAUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">
                                                {SCHOOL_UNITS_LIST.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Senha</label>
                                            <div className="flex gap-2 relative">
                                                <input type={showAdminPassword ? "text" : "password"} value={aPass} onChange={e => setAPass(e.target.value)} className="w-full p-2 border rounded" required={!editingAdminId} />
                                                <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} className="absolute right-16 top-2 text-gray-500">
                                                    {showAdminPassword ? <EyeOffIcon /> : <EyeIcon />}
                                                </button>
                                                <button type="button" onClick={handleGenerateAdminPass} className="px-3 py-2 bg-gray-200 rounded text-sm">Gerar</button>
                                            </div>
                                        </div>
                                        <Button type="submit" className="w-full">{editingAdminId ? 'Salvar' : 'Cadastrar'}</Button>
                                    </form>
                                </div>
                            </div>

                            {/* LISTA DE ADMINS */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                                        <h3 className="font-bold text-gray-700">Administradores Cadastrados</h3>
                                        <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{filteredAdmins.length} admins</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-500">
                                                <tr>
                                                    <th className="p-3">Nome</th>
                                                    <th className="p-3">Usuário</th>
                                                    <th className="p-3">Unidade</th>
                                                    <th className="p-3 text-right">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredAdmins.map(adm => (
                                                    <tr key={adm.id} className="border-b last:border-0 hover:bg-gray-50">
                                                        <td className="p-3 font-medium">{adm.name}</td>
                                                        <td className="p-3 text-gray-500">{adm.username}</td>
                                                        <td className="p-3"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100">{adm.unit}</span></td>
                                                        <td className="p-3 text-right">
                                                            <button onClick={() => startEditingAdmin(adm)} className="text-blue-600 hover:underline mr-3">Editar</button>
                                                            <button onClick={() => initiateDeleteAdmin(adm.id)} className="text-red-600 hover:underline">Excluir</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {filteredAdmins.length === 0 && <div className="p-8 text-center text-gray-400 italic">Nenhum outro administrador cadastrado.</div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}