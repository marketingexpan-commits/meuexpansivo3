
// src/App.tsx

import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { UserRole, UserSession, Student, Teacher, GradeEntry, Admin, SchoolMessage, AttendanceRecord, EarlyChildhoodReport, UnitContact, AppNotification, Mensalidade, EventoFinanceiro } from './types';
import { MOCK_STUDENTS, MOCK_TEACHERS, MOCK_ADMINS, FINAL_GRADES_CALCULATED, ALLOW_MOCK_LOGIN } from './constants';
import { Login } from './components/Login';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { db } from './firebaseConfig';

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession>({ role: UserRole.NONE, user: null });

  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [schoolMessages, setSchoolMessages] = useState<SchoolMessage[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [earlyChildhoodReports, setEarlyChildhoodReports] = useState<EarlyChildhoodReport[]>([]);
  const [unitContacts, setUnitContacts] = useState<UnitContact[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [eventosFinanceiros, setEventosFinanceiros] = useState<EventoFinanceiro[]>([]);


  const [loginError, setLoginError] = useState<string>('');

  const [initialLoad, setInitialLoad] = useState({
    students: false,
    teachers: false,
    admins: false,
    grades: false,
    messages: false,
    attendance: false,
    earlyChildhoodReports: false,
    unitContacts: false,
    notifications: false,
    mensalidades: false,
    eventosFinanceiros: false
  });

  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    const unsubStudents = db.collection('students').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Student);
      setStudents(data);
      setInitialLoad(prev => ({ ...prev, students: true }));
    }, (error) => {
      if (ALLOW_MOCK_LOGIN) { setStudents(MOCK_STUDENTS); }
      setInitialLoad(prev => ({ ...prev, students: true }));
    });

    const unsubTeachers = db.collection('teachers').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Teacher);
      setTeachers(data);
      setInitialLoad(prev => ({ ...prev, teachers: true }));
    }, (error) => {
      if (ALLOW_MOCK_LOGIN) { setTeachers(MOCK_TEACHERS); }
      setInitialLoad(prev => ({ ...prev, teachers: true }));
    });

    const unsubAdmins = db.collection('admins').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Admin);
      setAdmins(data);
      setInitialLoad(prev => ({ ...prev, admins: true }));
    }, (error) => {
      if (ALLOW_MOCK_LOGIN) { setAdmins(MOCK_ADMINS); }
      setInitialLoad(prev => ({ ...prev, admins: true }));
    });

    const unsubGrades = db.collection('grades').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as GradeEntry);
      setGrades(data);
      setInitialLoad(prev => ({ ...prev, grades: true }));
    }, (error) => {
      if (ALLOW_MOCK_LOGIN) { setGrades(FINAL_GRADES_CALCULATED); }
      setInitialLoad(prev => ({ ...prev, grades: true }));
    });

    const unsubMessages = db.collection('schoolMessages').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolMessage));
      setSchoolMessages(data);
      setInitialLoad(prev => ({ ...prev, messages: true }));
    }, (error) => {
      console.error("Erro ao carregar mensagens:", error);
      setInitialLoad(prev => ({ ...prev, messages: true }));
    });

    const unsubAttendance = db.collection('attendance').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as AttendanceRecord);
      setAttendanceRecords(data);
      setInitialLoad(prev => ({ ...prev, attendance: true }));
    }, (error) => {
      console.error("Erro ao carregar registros de chamada:", error);
      setInitialLoad(prev => ({ ...prev, attendance: true }));
    });

    const unsubEarlyChildhoodReports = db.collection('earlyChildhoodReports').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => {
        const reportData = doc.data() as any;
        if (reportData.bimester && !reportData.semester) {
          reportData.semester = Math.ceil(reportData.bimester / 2) as 1 | 2;
          delete reportData.bimester;
        }
        return reportData as EarlyChildhoodReport;
      });
      setEarlyChildhoodReports(data);
      setInitialLoad(prev => ({ ...prev, earlyChildhoodReports: true }));
    }, (error) => {
      console.error("Erro ao carregar relatórios da educação infantil:", error);
      setEarlyChildhoodReports([]);
      setInitialLoad(prev => ({ ...prev, earlyChildhoodReports: true }));
    });

    const unsubContacts = db.collection('unitContacts').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as UnitContact);
      setUnitContacts(data);
      setInitialLoad(prev => ({ ...prev, unitContacts: true }));
    }, (error) => {
      console.error("Erro ao carregar contatos:", error);
      setUnitContacts([]);
      setInitialLoad(prev => ({ ...prev, unitContacts: true }));
    });

    const unsubNotifications = db.collection('notifications').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as AppNotification);
      setNotifications(data);
      setInitialLoad(prev => ({ ...prev, notifications: true }));
    }, (error) => {
      console.error("Erro ao carregar notificações:", error);
      setNotifications([]);
      setInitialLoad(prev => ({ ...prev, notifications: true }));
    });

    const unsubMensalidades = db.collection('mensalidades').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mensalidade));
      setMensalidades(data);
      setInitialLoad(prev => ({ ...prev, mensalidades: true }));
    }, (error) => {
      console.error("Erro ao carregar mensalidades:", error);
      setMensalidades([]);
      setInitialLoad(prev => ({ ...prev, mensalidades: true }));
    });

    const unsubEventos = db.collection('eventos_financeiros').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventoFinanceiro));
      setEventosFinanceiros(data);
      setInitialLoad(prev => ({ ...prev, eventosFinanceiros: true }));
    }, (error) => {
      console.error("Erro ao carregar eventos financeiros:", error);
      setEventosFinanceiros([]);
      setInitialLoad(prev => ({ ...prev, eventosFinanceiros: true }));
    });

    return () => {
      unsubStudents();
      unsubTeachers();
      unsubAdmins();
      unsubGrades();
      unsubMessages();
      unsubAttendance();
      unsubEarlyChildhoodReports();
      unsubContacts();
      unsubNotifications();
      unsubMensalidades();
      unsubEventos();
    };
  }, []);

  const seedDatabase = async () => {
    if (!ALLOW_MOCK_LOGIN) return;
    const batch = db.batch();
    MOCK_ADMINS.forEach(admin => batch.set(db.collection('admins').doc(admin.id), admin));
    MOCK_STUDENTS.forEach(student => batch.set(db.collection('students').doc(student.id), student));
    MOCK_TEACHERS.forEach(teacher => batch.set(db.collection('teachers').doc(teacher.id), teacher));
    FINAL_GRADES_CALCULATED.forEach(grade => batch.set(db.collection('grades').doc(grade.id), grade));
    await batch.commit();
  };

  const isDataReady = Object.values(initialLoad).every(Boolean);

  useEffect(() => {
    const checkAndSeedDatabase = async () => {
      if (isSeeding || !isDataReady) return;
      if (admins.length === 0 && ALLOW_MOCK_LOGIN) {
        setIsSeeding(true);
        try { await seedDatabase(); } catch (error) { console.warn("Seed ignorado (Permissões insuficientes ou Backend Offline)."); }
        finally { setIsSeeding(false); }
      }
    };
    checkAndSeedDatabase();
  }, [isDataReady, admins.length, isSeeding]);

  const handleResetSystem = async () => {
    if (!ALLOW_MOCK_LOGIN || !window.confirm("Isso apagará TODOS os dados atuais e restaurará os dados de teste. Deseja continuar?")) return;
    setIsSeeding(true);
    try {
      const collections = ['students', 'teachers', 'admins', 'grades', 'schoolMessages', 'attendance', 'earlyChildhoodReports', 'unitContacts', 'notifications', 'access_logs', 'daily_stats']; // Incluídos logs na limpeza
      for (const col of collections) {
        const snapshot = await db.collection(col).get();
        if (!snapshot.empty) {
          const batch = db.batch();
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      }
      await seedDatabase();
      alert("Sistema restaurado com sucesso!");
    } catch (e) {
      setStudents(MOCK_STUDENTS); setTeachers(MOCK_TEACHERS); setAdmins(MOCK_ADMINS); setGrades(FINAL_GRADES_CALCULATED); setSchoolMessages([]);
      alert("Sistema restaurado em Modo Offline (Backend inacessível).");
    } finally { setIsSeeding(false); }
  };

  const logAccess = async (userId: string) => {
    if (process.env.NODE_ENV === 'development' && ALLOW_MOCK_LOGIN) console.log(`[Mock] Logged access for ${userId}`);

    // Data para o ID do documento de estatísticas (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    let ip = 'unknown';

    // Tentar obter IP (sem bloquear o fluxo principal se falhar)
    try {
      // Executa em "background" relative ao login, mas await aqui é rápido
      const res = await fetch('https://api.ipify.org?format=json').catch(() => null);
      if (res) {
        const data = await res.json();
        ip = data.ip;
      }
    } catch (e) {
      // Ignora erro de IP
    }

    const logData = {
      user_id: userId,
      date: new Date().toISOString(),
      ip: ip,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      // 1. Gravar Log Individual
      db.collection('access_logs').add(logData).catch(err => console.error("Erro ao gravar log de acesso:", err));

      // 2. Incrementar Contador Diário (Atomicamente)
      const statsRef = db.collection('daily_stats').doc(today);
      statsRef.set({
        total_logins: firebase.firestore.FieldValue.increment(1),
        last_updated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(err => console.error("Erro ao atualizar daily_stats:", err));

    } catch (error) {
      console.error("Erro geral no sistema de logs:", error);
    }
  };

  const handleStudentLogin = (code: string, pass: string) => {
    let student = students.find(s => s.code === code);
    if (!student && ALLOW_MOCK_LOGIN && students.length === 0) student = MOCK_STUDENTS.find(s => s.code === code);
    if (student) {
      if (student.password === pass) {
        if (student.isBlocked) { setLoginError('Acesso negado. Entre em contato com a secretaria.'); return; }
        setSession({ role: UserRole.STUDENT, user: student }); setLoginError('');
        logAccess(student.id);
      } else { setLoginError('Senha incorreta.'); }
    } else { setLoginError('Código de aluno não encontrado.'); }
  };

  const handleTeacherLogin = (cpf: string, pass: string, unit?: string) => {
    let teacher = teachers.find(t => t.cpf === cpf && t.unit === unit);
    if (!teacher && ALLOW_MOCK_LOGIN && teachers.length === 0) teacher = MOCK_TEACHERS.find(t => t.cpf === cpf && t.unit === unit);
    if (!teacher) {
      setLoginError(teachers.some(t => t.cpf === cpf) ? `Professor não encontrado na unidade ${unit}. Verifique seu cadastro.` : 'Professor não encontrado ou CPF inválido.');
      return;
    }
    if (teacher.password !== pass) { setLoginError('Senha inválida.'); return; }
    setSession({ role: UserRole.TEACHER, user: teacher }); setLoginError('');
    logAccess(teacher.id);
  };

  const handleAdminLogin = (user: string, pass: string) => {
    let admin = admins.find(a => a.username === user && a.password === pass);
    if (!admin && ALLOW_MOCK_LOGIN && admins.length === 0) admin = MOCK_ADMINS.find(a => a.username === user && a.password === pass);
    if (admin) {
      setSession({ role: UserRole.ADMIN, user: admin });
      setLoginError('');
      logAccess(admin.id);
    }
    else { setLoginError('Credenciais inválidas.'); }
  }

  const handleLogout = () => { setSession({ role: UserRole.NONE, user: null }); setLoginError(''); };

  // Helper para criar notificação interna
  const createNotification = async (studentId: string, title: string, message: string) => {
    const notification: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      studentId,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false
    };
    try {
      await db.collection('notifications').doc(notification.id).set(notification);
    } catch (e) {
      console.error("Erro ao criar notificação", e);
    }
  };

  const handleSaveGrade = async (grade: GradeEntry) => {
    try {
      await db.collection('grades').doc(grade.id).set(grade);
      // Cria notificação automática
      await createNotification(
        grade.studentId,
        'Boletim Atualizado',
        `Sua nota de ${grade.subject} foi atualizada pelo professor.`
      );
    }
    catch (error) {
      if (ALLOW_MOCK_LOGIN) {
        setGrades(prev => {
          const idx = prev.findIndex(g => g.id === grade.id);
          if (idx >= 0) { const newGrades = [...prev]; newGrades[idx] = grade; return newGrades; }
          return [...prev, grade];
        });
        alert("Nota salva localmente (Modo Offline).");
      } else { alert("Erro ao salvar nota. Verifique sua conexão."); }
    }
  };

  // NOVO: Handler para salvar relatórios da educação infantil
  const handleSaveEarlyChildhoodReport = async (report: EarlyChildhoodReport) => {
    try {
      await db.collection('earlyChildhoodReports').doc(report.id).set(report);
      // Cria notificação automática
      await createNotification(
        report.studentId,
        'Relatório Disponível',
        `O relatório de desenvolvimento do ${report.semester}º Semestre foi atualizado.`
      );
    } catch (error) {
      console.error("Erro ao salvar relatório:", error);
      alert("Erro ao salvar o relatório. Verifique sua conexão e tente novamente.");
      throw error;
    }
  };

  const handleMarkNotificationAsRead = async (id: string) => {
    try {
      await db.collection('notifications').doc(id).update({ read: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.error("Erro ao marcar notificação como lida", e);
    }
  };


  const handleSaveAttendance = async (record: AttendanceRecord) => {
    try {
      await db.collection('attendance').doc(record.id).set(record);
      alert('Chamada salva com sucesso!');
    } catch (error) {
      console.error("Erro ao salvar chamada:", error);
      alert("Erro ao salvar a chamada. Verifique sua conexão e tente novamente.");
      throw error; // Re-throw para o componente poder lidar com o estado de 'isSaving'
    }
  };

  const handleSendMessage = async (message: Omit<SchoolMessage, 'id'>) => {
    try { await db.collection('schoolMessages').add(message); }
    catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      alert("Não foi possível enviar sua mensagem. Tente novamente mais tarde.");
      throw error;
    }
  };

  const handleUpdateMessageStatus = async (messageId: string, status: 'new' | 'read') => {
    setSchoolMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, status } : msg));
    try { await db.collection('schoolMessages').doc(messageId).update({ status }); }
    catch (error) { console.error("Erro ao atualizar status da mensagem:", error); }
  };

  // Handlers para gerenciar contatos de liderança
  const handleAddUnitContact = async (contact: UnitContact) => {
    try { await db.collection('unitContacts').doc(contact.id).set(contact); }
    catch (error) {
      console.error("Erro ao adicionar contato:", error);
      if (ALLOW_MOCK_LOGIN) setUnitContacts(prev => [...prev, contact]);
      else alert("Erro ao salvar contato.");
    }
  };

  const handleEditUnitContact = async (updatedContact: UnitContact) => {
    try { await db.collection('unitContacts').doc(updatedContact.id).set(updatedContact); }
    catch (error) {
      console.error("Erro ao editar contato:", error);
      if (ALLOW_MOCK_LOGIN) setUnitContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
      else alert("Erro ao editar contato.");
    }
  };

  const handleDeleteUnitContact = async (id: string) => {
    try { await db.collection('unitContacts').doc(id).delete(); }
    catch (error) {
      console.error("Erro ao remover contato:", error);
      if (ALLOW_MOCK_LOGIN) setUnitContacts(prev => prev.filter(c => c.id !== id));
      else alert("Erro ao remover contato.");
    }
  };

  const handleAddStudent = async (newStudent: Student) => { try { await db.collection('students').doc(newStudent.id).set(newStudent); } catch (e) { if (ALLOW_MOCK_LOGIN) setStudents(prev => [...prev, newStudent]); } };
  const handleEditStudent = async (updatedStudent: Student) => { try { await db.collection('students').doc(updatedStudent.id).set(updatedStudent); } catch (e) { if (ALLOW_MOCK_LOGIN) setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s)); } };
  const handleDeleteStudent = async (studentId: string) => { try { await db.collection('students').doc(studentId).delete(); } catch (e) { if (ALLOW_MOCK_LOGIN) setStudents(prev => prev.filter(s => s.id !== studentId)); } };
  const handleToggleBlockStudent = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      const updated = { ...student, isBlocked: !student.isBlocked };
      try { await db.collection('students').doc(studentId).set(updated); } catch (e) { if (ALLOW_MOCK_LOGIN) setStudents(prev => prev.map(s => s.id === studentId ? updated : s)); }
    }
  };

  const handleAddTeacher = async (newTeacher: Teacher) => { try { await db.collection('teachers').doc(newTeacher.id).set(newTeacher); } catch (e) { if (ALLOW_MOCK_LOGIN) setTeachers(prev => [...prev, newTeacher]); } };
  const handleEditTeacher = async (updatedTeacher: Teacher) => { try { await db.collection('teachers').doc(updatedTeacher.id).set(updatedTeacher); } catch (e) { if (ALLOW_MOCK_LOGIN) setTeachers(prev => prev.map(t => t.id === updatedTeacher.id ? updatedTeacher : t)); } };
  const handleDeleteTeacher = async (teacherId: string) => { try { await db.collection('teachers').doc(teacherId).delete(); } catch (e) { if (ALLOW_MOCK_LOGIN) setTeachers(prev => prev.filter(t => t.id !== teacherId)); } };

  const handleAddAdmin = async (newAdmin: Admin) => { try { await db.collection('admins').doc(newAdmin.id).set(newAdmin); } catch (e) { if (ALLOW_MOCK_LOGIN) setAdmins(prev => [...prev, newAdmin]); } };
  const handleEditAdmin = async (updatedAdmin: Admin) => { try { await db.collection('admins').doc(updatedAdmin.id).set(updatedAdmin); } catch (e) { if (ALLOW_MOCK_LOGIN) setAdmins(prev => prev.map(a => a.id === updatedAdmin.id ? updatedAdmin : a)); } };
  const handleDeleteAdmin = async (adminId: string) => { try { await db.collection('admins').doc(adminId).delete(); } catch (e) { if (ALLOW_MOCK_LOGIN) setAdmins(prev => prev.filter(a => a.id !== adminId)); } };


  if (!isDataReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 flex-col">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950 mb-4"></div>
        <p className="text-gray-600 font-semibold">Conectando ao banco de dados...</p>
        <p className="text-xs text-gray-400 mt-2">Caso demore, o modo offline será ativado.</p>
      </div>
    );
  }

  if (session.role === UserRole.NONE) {
    return (<Login onLoginStudent={handleStudentLogin} onLoginTeacher={handleTeacherLogin} onLoginAdmin={handleAdminLogin} onResetSystem={handleResetSystem} error={loginError} adminsList={admins} />);
  }

  if (session.role === UserRole.STUDENT && session.user) {
    return (
      <StudentDashboard
        student={session.user as Student}
        grades={grades}
        teachers={teachers}
        attendanceRecords={attendanceRecords}
        earlyChildhoodReports={earlyChildhoodReports}
        unitContacts={unitContacts}
        onLogout={handleLogout}
        onSendMessage={handleSendMessage}
        notifications={notifications}
        onMarkNotificationAsRead={handleMarkNotificationAsRead}
        mensalidades={mensalidades}
        eventos={eventosFinanceiros}
      />
    );
  }

  if (session.role === UserRole.TEACHER && session.user) {
    return (<TeacherDashboard teacher={session.user as Teacher} students={students} grades={grades} onSaveGrade={handleSaveGrade} onLogout={handleLogout} attendanceRecords={attendanceRecords} onSaveAttendance={handleSaveAttendance} earlyChildhoodReports={earlyChildhoodReports} onSaveEarlyChildhoodReport={handleSaveEarlyChildhoodReport} />);
  }

  if (session.role === UserRole.ADMIN && session.user) {
    return (
      <AdminDashboard
        admin={session.user as Admin}
        students={students}
        teachers={teachers}
        admins={admins}
        schoolMessages={schoolMessages}
        attendanceRecords={attendanceRecords}
        unitContacts={unitContacts}
        onAddStudent={handleAddStudent}
        onEditStudent={handleEditStudent}
        onDeleteStudent={handleDeleteStudent}
        onToggleBlockStudent={handleToggleBlockStudent}
        onAddTeacher={handleAddTeacher}
        onEditTeacher={handleEditTeacher}
        onDeleteTeacher={handleDeleteTeacher}
        onAddAdmin={handleAddAdmin}
        onEditAdmin={handleEditAdmin}
        onDeleteAdmin={handleDeleteAdmin}
        onUpdateMessageStatus={handleUpdateMessageStatus}
        onAddUnitContact={handleAddUnitContact}
        onEditUnitContact={handleEditUnitContact}
        onDeleteUnitContact={handleDeleteUnitContact}
        onLogout={handleLogout}
      />
    );
  }

  return <div>Erro inesperado no estado da aplicação.</div>;
};

export default App;
