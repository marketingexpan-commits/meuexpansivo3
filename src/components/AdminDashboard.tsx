import React, { useState } from 'react';
import { Admin, Student, Teacher, SchoolUnit, Subject, SchoolShift, SchoolClass } from '../types';
import { SCHOOL_UNITS_LIST, SUBJECT_LIST, SCHOOL_SHIFTS_LIST, SCHOOL_CLASSES_LIST, SCHOOL_GRADES_LIST } from '../constants';
import { Button } from './Button';
import { SchoolLogo } from './SchoolLogo';

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
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'admins'>('students');
  
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
  const confirmDeleteAdmin = () => { if(onDeleteAdmin && adminToDelete) { onDeleteAdmin(adminToDelete); setAdminToDelete(null); } };
  
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
  const handleAddSubject = () => { if(!tSubjects.includes(tempSubject)) setTSubjects([...tSubjects, tempSubject]); };
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
    <div className="min-h-screen bg-gray-50 relative">
      
      {/* Modais de Exclusão */}
      {(studentToDelete || teacherToDelete || adminToDelete) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in-up">
            <h3 className="text-lg font-bold text-center text-gray-900 mb-2">Confirmar Exclusão</h3>
            <p className="text-sm text-center text-gray-500 mb-6">Tem certeza? Essa ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => { setStudentToDelete(null); setTeacherToDelete(null); setAdminToDelete(null); }} className="w-full">Cancelar</Button>
              <Button variant="danger" onClick={() => {
                  if (studentToDelete) { onDeleteStudent(studentToDelete); setStudentToDelete(null); }
                  if (teacherToDelete) { onDeleteTeacher(teacherToDelete); setTeacherToDelete(null); }
                  if (adminToDelete && onDeleteAdmin) { onDeleteAdmin(adminToDelete); setAdminToDelete(null); }
              }} className="w-full">Sim, Excluir</Button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <SchoolLogo variant="header" />
             <div>
                <h1 className="text-xl font-bold text-gray-900">Meu Expansivo</h1>
                <p className="text-sm text-gray-500">Administração ({adminUnit || 'GERAL'}) - {admin.name}</p>
             </div>
          </div>
          <Button variant="secondary" onClick={onLogout}>Sair</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex space-x-4 mb-6 overflow-x-auto pb-2">
          <button onClick={() => setActiveTab('students')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'students' ? 'bg-blue-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Gerenciar Alunos</button>
          <button onClick={() => setActiveTab('teachers')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'teachers' ? 'bg-blue-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>Gerenciar Professores</button>
          
          {/* ABA EXCLUSIVA PARA ADMIN GERAL */}
          {isGeneralAdmin && (
              <button onClick={() => setActiveTab('admins')} className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${activeTab === 'admins' ? 'bg-purple-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                  Gerenciar Admins
              </button>
          )}
        </div>

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
                   <div><label className="text-sm font-medium">Nome</label><input type="text" value={sName} onChange={e=>setSName(e.target.value)} required className="w-full p-2 border rounded"/></div>
                   <div><label className="text-sm font-medium">Código</label><input type="text" value={sCode} onChange={e=>setSCode(e.target.value)} required className="w-full p-2 border rounded"/></div>
                   <div>
                       <label className="text-sm font-medium">Série</label>
                       <select value={sGrade} onChange={e=>setSGrade(e.target.value)} className="w-full p-2 border rounded">{SCHOOL_GRADES_LIST.map(g=><option key={g} value={g}>{g}</option>)}</select>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                       <div>
                            <label className="text-sm font-medium">Turma</label>
                            <select value={sClass} onChange={e=>setSClass(e.target.value as SchoolClass)} className="w-full p-2 border rounded">{SCHOOL_CLASSES_LIST.map(c=><option key={c} value={c}>{c}</option>)}</select>
                       </div>
                       <div>
                            <label className="text-sm font-medium">Turno</label>
                            <select value={sShift} onChange={e=>setSShift(e.target.value as SchoolShift)} className="w-full p-2 border rounded">{SCHOOL_SHIFTS_LIST.map(s=><option key={s} value={s}>{s}</option>)}</select>
                       </div>
                   </div>
                   <div>
                       <label className="text-sm font-medium">Unidade</label>
                       {isGeneralAdmin ? (
                           <select value={sUnit} onChange={e=>setSUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">{SCHOOL_UNITS_LIST.map(u=><option key={u} value={u}>{u}</option>)}</select>
                       ) : <div className="p-2 bg-gray-100 rounded text-gray-600">{adminUnit}</div>}
                   </div>
                   <div>
                        <label className="text-sm font-medium">Senha</label>
                        <div className="flex gap-2 relative">
                            <input type={showStudentPassword ? "text" : "password"} value={sPass} onChange={e=>setSPass(e.target.value)} className="w-full p-2 border rounded" required={!editingStudentId}/>
                            <button type="button" onClick={()=>setShowStudentPassword(!showStudentPassword)} className="absolute right-16 top-2 text-gray-500">{showStudentPassword ? <EyeOffIcon/> : <EyeIcon/>}</button>
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
                        <input type="text" placeholder="Buscar..." value={studentSearchTerm} onChange={e=>setStudentSearchTerm(e.target.value)} className="p-1 border rounded text-sm"/>
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
                                            <button onClick={()=>startEditingStudent(s)} className="text-blue-600 hover:underline">Editar</button>
                                            <button onClick={()=>initiateDeleteStudent(s.id)} className="text-red-600 hover:underline">Excluir</button>
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
                  <div><label className="text-sm font-medium">Nome Completo</label><input type="text" value={tName} onChange={e=>setTName(e.target.value)} required className="w-full p-2 border rounded"/></div>
                  
                  <div>
                    <label className="text-sm font-medium">Matérias</label>
                    <div className="flex gap-2">
                        <select value={tempSubject} onChange={e=>setTempSubject(e.target.value as Subject)} className="flex-1 p-2 border rounded">
                            {sortedSubjects.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                        <button type="button" onClick={handleAddSubject} className="bg-blue-100 text-blue-800 px-3 rounded">Add</button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {tSubjects.map(s=>(<span key={s} className="bg-gray-100 px-2 rounded text-xs flex items-center gap-1">{s} <button type="button" onClick={()=>handleRemoveSubject(s)}>&times;</button></span>))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                       <div><label className="text-sm font-medium">CPF</label><input type="text" value={tCpf} onChange={e=>setTCpf(e.target.value)} required className="w-full p-2 border rounded"/></div>
                       <div><label className="text-sm font-medium">Telefone</label><input type="text" value={tPhone} onChange={handlePhoneChange} className="w-full p-2 border rounded" maxLength={14}/></div>
                  </div>

                   <div>
                       <label className="text-sm font-medium">Unidade</label>
                       {isGeneralAdmin ? (
                           <select value={tUnit} onChange={e=>setTUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">{SCHOOL_UNITS_LIST.map(u=><option key={u} value={u}>{u}</option>)}</select>
                       ) : <div className="p-2 bg-gray-100 rounded text-gray-600">{adminUnit}</div>}
                   </div>

                   <div>
                        <label className="text-sm font-medium">Senha</label>
                        <div className="flex gap-2 relative">
                            <input type={showTeacherPassword ? "text" : "password"} value={tPass} onChange={e=>setTPass(e.target.value)} className="w-full p-2 border rounded" required={!editingTeacherId}/>
                            <button type="button" onClick={()=>setShowTeacherPassword(!showTeacherPassword)} className="absolute right-16 top-2 text-gray-500">{showTeacherPassword ? <EyeOffIcon/> : <EyeIcon/>}</button>
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
                                        <td className="p-3"><div className="flex flex-wrap gap-1">{t.subjects.map(s=><span key={s} className="bg-gray-100 px-2 rounded text-xs">{s}</span>)}</div></td>
                                        <td className="p-3">{t.unit}</td>
                                        <td className="p-3 flex gap-2">
                                            <button onClick={()=>startEditingTeacher(t)} className="text-blue-600 hover:underline">Editar</button>
                                            <button onClick={()=>initiateDeleteTeacher(t.id)} className="text-red-600 hover:underline">Excluir</button>
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
                            <div><label className="text-sm font-medium">Nome (Descrição)</label><input type="text" value={aName} onChange={e=>setAName(e.target.value)} required className="w-full p-2 border rounded"/></div>
                            <div><label className="text-sm font-medium">Usuário de Login</label><input type="text" value={aUser} onChange={e=>setAUser(e.target.value)} required className="w-full p-2 border rounded"/></div>
                            <div>
                                <label className="text-sm font-medium">Unidade Responsável</label>
                                <select value={aUnit} onChange={e=>setAUnit(e.target.value as SchoolUnit)} className="w-full p-2 border rounded">
                                    {SCHOOL_UNITS_LIST.map(u=><option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Senha</label>
                                <div className="flex gap-2 relative">
                                    <input type={showAdminPassword ? "text" : "password"} value={aPass} onChange={e=>setAPass(e.target.value)} required={!editingAdminId} className="w-full p-2 border rounded"/>
                                    <button type="button" onClick={()=>setShowAdminPassword(!showAdminPassword)} className="absolute right-16 top-2 text-gray-500">{showAdminPassword ? <EyeOffIcon/> : <EyeIcon/>}</button>
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
                                            <button onClick={()=>startEditingAdmin(a)} className="text-blue-600 hover:underline">Editar</button>
                                            <button onClick={()=>initiateDeleteAdmin(a.id)} className="text-red-600 hover:underline">Excluir</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

      </main>
    </div>
  );
}