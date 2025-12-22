
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
import { BackToTopButton } from './components/BackToTopButton';

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
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Student));
      setStudents(data);
      setInitialLoad(prev => ({ ...prev, students: true }));
    }, (error) => {
      if (ALLOW_MOCK_LOGIN) { setStudents(MOCK_STUDENTS); }
      setInitialLoad(prev => ({ ...prev, students: true }));
    });

    const unsubTeachers = db.collection('teachers').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Teacher));
      setTeachers(data);
      setInitialLoad(prev => ({ ...prev, teachers: true }));
    }, (error) => {
      if (ALLOW_MOCK_LOGIN) { setTeachers(MOCK_TEACHERS); }
      setInitialLoad(prev => ({ ...prev, teachers: true }));
    });

    const unsubAdmins = db.collection('admins').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Admin));
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

    const unsubEventos = db.collection('eventos_escola').onSnapshot((snapshot) => {
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
    // Busca por Combinação: Buscar todos os documentos que correspondam ao código
    let potentialStudents = students.filter(s => s.code === code);

    // Mock Fallback
    if (potentialStudents.length === 0 && ALLOW_MOCK_LOGIN && students.length === 0) {
      potentialStudents = MOCK_STUDENTS.filter(s => s.code === code);
    }

    if (potentialStudents.length > 0) {
      // Validação Dinâmica: Percorrer lista e verificar qual possui senha correspondente
      const matchedStudent = potentialStudents.find(s => s.password === pass);

      if (matchedStudent) {
        // Login Transparente: Logar no perfil correto
        if (matchedStudent.isBlocked) { setLoginError('Acesso negado. Entre em contato com a secretaria.'); return; }
        setSession({ role: UserRole.STUDENT, user: matchedStudent }); setLoginError('');
        logAccess(matchedStudent.id);
      } else {
        // Tratamento de Erro: Código existe mas senha não bate com nenhum
        setLoginError('Código ou senha incorretos');
      }
    } else {
      setLoginError('Código ou senha incorretos');
    }
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

  /* --- FUNÇÃO DE GERAÇÃO DE MENSALIDADES --- */
  const generate2026Fees = (student: Student, batch: firebase.firestore.WriteBatch, excludedMonths: string[] = []) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const year = 2026;
    const value = student.valor_mensalidade || 0;

    months.forEach((month, index) => {
      const monthStr = `${month}/${year}`;
      if (excludedMonths.includes(monthStr)) return; // Pula meses pagos/existentes solicitados

      const monthNum = index + 1;
      const dueDate = `${year}-${monthNum.toString().padStart(2, '0')}-10`; // Vencimento dia 10
      const feeId = `fee-${student.id}-${year}-${monthNum}`;

      const newFee: Mensalidade = {
        id: feeId,
        studentId: student.id,
        month: monthStr,
        value: value,
        dueDate: dueDate,
        status: 'Pendente',
        lastUpdated: new Date().toISOString()
      };

      const feeRef = db.collection('mensalidades').doc(feeId);
      batch.set(feeRef, newFee);
    });
  };

  const handleGenerateIndividualFees = async (student: Student) => {
    if (!student.valor_mensalidade || student.valor_mensalidade <= 0) {
      alert(`Erro: O aluno ${student.name} não possui valor de mensalidade definido ou é zero.`);
      return;
    }

    if (student.valor_mensalidade < 1) {
      alert('O valor mínimo para cobrança é de R$ 1,00 devido às regras do processador de pagamentos');
      return;
    }

    // Check for existing fees locally
    // Filter for 2026 fees specifically
    const existingFees2026 = mensalidades.filter(m => m.studentId === student.id && m.month.includes('/2026'));

    // Check for Paid fees
    const paidFees = existingFees2026.filter(m => m.status === 'Pago');
    const pendingFees = existingFees2026.filter(m => m.status !== 'Pago');

    if (paidFees.length > 0) {
      // Warning if Paid fees exist
      const confirmWithPaid = window.confirm(
        `ATENÇÃO: Este aluno possui ${paidFees.length} mensalidade(s) PAGA(S) em 2026.\n` +
        `O sistema manterá as pagas e recriará as pendentes com o novo valor.\n\n` +
        `Deseja continuar?`
      );
      if (!confirmWithPaid) return;
    } else if (existingFees2026.length > 0) {
      // Only Pending fees exist - Automatic Cleanup (as requested "Cleaning Preventive")
      // We do not need a confirmation here anymore because the user clicked "Gerar Carnê" to fix/create.
      // But to be safe on a "destructive" action that acts implicitly, a small toast would be nice, but here just do it.
      // Actually, user said: "Limpeza Preventiva: Antes de criar... deletar automaticamente... para ID de aluno."
      // So we proceed.
    }

    if (existingFees2026.length > 0 || !window.confirm(`Confirma a geração do carnê de 2026 para ${student.name}?\nValor: R$ ${student.valor_mensalidade.toFixed(2)}`)) {
      // If we are in the "Update/Cleanup" path, we skip the basic generation confirm or reuse it?
      // Simplification: If updating existing, we already confirmed (if paid) or we just do it (if pending). 
      // Let's rely on the button click + Paid confirm.
      // For fresh generation, keep the confirm.
      if (existingFees2026.length === 0 && !window.confirm(`Confirma a geração do carnê de 2026 para ${student.name}?\nValor: R$ ${student.valor_mensalidade.toFixed(2)}`)) return;
    }

    try {
      const batch = db.batch();

      // 1. Delete ALL Pending fees (Cleanup)
      let deletedCount = 0;
      for (const fee of pendingFees) {
        const feeRef = db.collection('mensalidades').doc(fee.id);
        batch.delete(feeRef);
        deletedCount++;
      }

      // 2. Generate fees, EXCLUDING the months that are already Paid
      const paidMonths = paidFees.map(m => m.month);
      generate2026Fees(student, batch, paidMonths);

      await batch.commit();

      if (existingFees2026.length > 0) {
        alert(`Carnê atualizado com sucesso! ${deletedCount} pendentes recriadas. ${paidFees.length} pagas mantidas.`);
      } else {
        alert(`Carnê de 12 meses gerado com sucesso para ${student.name}`);
      }

    } catch (error) {
      console.error("Erro ao gerar/atualizar carnê:", error);
      alert("Erro ao processar. Verifique o console.");
    }
    // Return early to avoid falling through to old logic
    return;


  };

  const handleFixDuplicateFees = async () => {
    if (!window.confirm("Isso irá normalizar nomes de meses (ex: 'Janeiro' -> 'Janeiro/2026') e remover duplicatas (mantendo Pagos sobre Pendentes, e valores atuais sobre antigos). Continuar?")) return;

    try {
      const batch = db.batch();
      let updatesCount = 0;
      let deletesCount = 0;
      const fixedStudentNames = new Set<string>();

      // 1. Normalization & Grouping
      const studentMonthMap = new Map<string, Mensalidade[]>();

      for (const fee of mensalidades) {
        let needsUpdate = false;
        let currentMonth = fee.month;

        // Fix Name: "Janeiro" -> "Janeiro/2026" if due in 2026
        if (!currentMonth.includes('/') && fee.dueDate.includes('2026')) {
          currentMonth = `${currentMonth}/2026`;
          const feeRef = db.collection('mensalidades').doc(fee.id);
          // We update the doc in batch, but for grouping logic below we use the NEW name
          batch.update(feeRef, { month: currentMonth });
          updatesCount++;
          needsUpdate = true;
        }

        const key = `${fee.studentId}-${currentMonth}`;
        if (!studentMonthMap.has(key)) {
          studentMonthMap.set(key, []);
        }
        // Push a copy with potentially updated month for logic
        studentMonthMap.get(key)!.push({ ...fee, month: currentMonth });
      }

      // 2. Deduplication
      for (const [key, fees] of studentMonthMap.entries()) {
        if (fees.length > 1) {
          const studentId = fees[0].studentId;
          const student = students.find(s => s.id === studentId);
          const studentName = student?.name || "Desconhecido";

          // Check if any is Paid
          const paidFee = fees.find(f => f.status === 'Pago');

          if (paidFee) {
            // If we have a Paid fee, delete ALL Pending duplicates
            for (const f of fees) {
              if (f.status !== 'Pago') {
                const feeRef = db.collection('mensalidades').doc(f.id);
                batch.delete(feeRef);
                deletesCount++;
                fixedStudentNames.add(studentName);
              } else if (f.id !== paidFee.id) {
                console.warn(`Duplicate PAID fees for ${studentName} (${key})`, fees);
              }
            }
          } else {
            // Multiple Pending fees? Use smart attributes to decide which to keep.
            // Priority 1: Match current student monthly fee (if available)
            let bestFeeIndex = 0;
            if (student && student.valor_mensalidade) {
              const exactMatchIndex = fees.findIndex(f => Math.abs(f.value - student.valor_mensalidade!) < 0.01);
              if (exactMatchIndex !== -1) {
                bestFeeIndex = exactMatchIndex;
              } else {
                // Sort by lastUpdated desc
                fees.sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''));
                bestFeeIndex = 0;
              }
            } else {
              // Fallback: Latest lastUpdated
              fees.sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''));
              bestFeeIndex = 0;
            }

            // Delete others
            // CAUTION: If we sorted above (fees.sort), indices changed.
            // If we found exactMatchIndex BEFORE sort, and then sorted, index is wrong.
            // Wait, the logic above is: if exactMatchIndex found, we set bestFeeIndex. But we DID NOT SORT in that branch.
            // If we went to else, we sorted and set index 0. Correct.

            // However, fees array references the objects. 
            const keep = fees[bestFeeIndex];

            for (let i = 0; i < fees.length; i++) {
              if (fees[i].id !== keep.id) { // explicit ID check is safer than index if we didn't sort
                const feeRef = db.collection('mensalidades').doc(fees[i].id);
                batch.delete(feeRef);
                deletesCount++;
                fixedStudentNames.add(studentName);
              }
            }
          }
        }
      }

      if (updatesCount > 0 || deletesCount > 0) {
        await batch.commit();
        const namesList = Array.from(fixedStudentNames);
        const namesMsg = namesList.length > 10
          ? namesList.slice(0, 10).join(', ') + ` e mais ${namesList.length - 10} alunos.`
          : namesList.join(', ');

        alert(`Concluído! \n- ${updatesCount} nomes de meses normalizados.\n- ${deletesCount} duplicatas removidas.\n\nAlunos corrigidos: ${namesMsg}`);
        console.log("Alunos com duplicidades corrigidas:", namesList);
      } else {
        alert("Nenhuma duplicidade ou erro de nome encontrado. O banco de dados está limpo!");
      }

    } catch (error) {
      console.error("Erro ao corrigir duplicatas:", error);
      alert("Erro ao executar correção. Verifique o console.");
    }
  };

  const handleResetStudentFees = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // Confirmação Dupla
    if (!window.confirm(`ATENÇÃO: Você está prestes a EXCLUIR TODAS as mensalidades de 2026 do aluno ${student.name}, INCLUINDO AS PAGAS.\n\nIsso é irreversível e geralmente usado apenas para correção de erros graves ou testes.\n\nDeseja continuar?`)) return;

    const userInput = prompt(`Para confirmar, digite o nome do aluno: ${student.name}`);
    if (userInput !== student.name) {
      alert("Nome incorreto. Operação cancelada.");
      return;
    }

    try {
      const batch = db.batch();

      const feesToDelete = mensalidades.filter(m => m.studentId === student.id && (m.month.includes('2026') || m.dueDate.includes('2026')));

      if (feesToDelete.length === 0) {
        alert("Nenhuma mensalidade de 2026 encontrada para este aluno.");
        return;
      }

      feesToDelete.forEach(fee => {
        const ref = db.collection('mensalidades').doc(fee.id);
        batch.delete(ref);
      });

      await batch.commit();
      alert(`Sucesso! ${feesToDelete.length} mensalidades de 2026 foram removidas do aluno ${student.name}. Agora você pode gerar um novo carnê.`);

    } catch (error) {
      console.error("Erro ao resetar financeiro:", error);
      alert("Erro ao executar reset.");
    }
  };

  const handleGenerate2026FeesForAll = async () => {
    if (!window.confirm("ATENÇÃO: Isso irá gerar 12 mensalidades (Jan-Dez 2026) para TODOS os alunos que ainda não possuem carnê de 2026. Deseja continuar?")) return;

    // setIsLoading(true) - se houvesse estado global de loading
    try {
      const batch = db.batch();
      let count = 0;

      // Filtra alunos que já têm mensalidades (otimização básica) ou checa na hora
      // Para simplificar e garantir, vamos iterar todos e verificar se já existe a mensalidade de Janeiro/2026
      // Se não existir, gera o ano todo.

      const skippedStudents: string[] = [];

      for (const student of students) {
        // Verifica se já existe mensalidade de Janeiro 2026 para este aluno localmente para evitar reads excessivos
        const existingFee = mensalidades.find(m => m.studentId === student.id && m.month === 'Janeiro/2026');

        if (!existingFee) {
          if (!student.valor_mensalidade || student.valor_mensalidade <= 0) {
            skippedStudents.push(student.name);
            continue;
          }
          generate2026Fees(student, batch);
          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
        let msg = `Sucesso! Carnês de 2026 gerados para ${count} alunos.`;
        if (skippedStudents.length > 0) {
          msg += `\n\nATENÇÃO: ${skippedStudents.length} alunos foram pulados pois não possuem valor de mensalidade definido:\n- ${skippedStudents.join('\n- ')}`;
        }
        alert(msg);
      } else {
        if (skippedStudents.length > 0) {
          alert(`Nenhum carnê gerado. ${skippedStudents.length} alunos foram pulados por falta de valor definido:\n- ${skippedStudents.join('\n- ')}`);
        } else {
          alert("Todos os alunos elegíveis já possuem mensalidades para 2026.");
        }
      }

    } catch (error) {
      console.error("Erro ao gerar mensalidades em massa:", error);
      alert("Erro ao processar. Verifique o console.");
    }
  };

  const handleAddStudent = async (newStudent: Student) => {
    try {
      const batch = db.batch();

      // 1. Salva o Aluno
      const studentRef = db.collection('students').doc(newStudent.id);
      batch.set(studentRef, newStudent);

      // 2. Financeiro removido da geração automática. Deve ser feito manualmente no Editar.
      // generate2026Fees(newStudent, batch); - DESATIVADO A PEDIDO DO HOST

      await batch.commit();

    } catch (e) {
      if (ALLOW_MOCK_LOGIN) {
        setStudents(prev => [...prev, newStudent]);
        // Mock generation local (simplificado, apenas adiciona no estado se quiser, mas foco é persistência)
        alert("Aluno salvo (Mock). Financeiro simulado não persistido.");
      }
    }
  };
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
    return (
      <>
        <Login onLoginStudent={handleStudentLogin} onLoginTeacher={handleTeacherLogin} onLoginAdmin={handleAdminLogin} onResetSystem={handleResetSystem} error={loginError} adminsList={admins} />
        <BackToTopButton />
      </>
    );
  }

  if (session.role === UserRole.STUDENT && session.user) {
    return (
      <>
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
        <BackToTopButton />
      </>
    );
  }

  if (session.role === UserRole.TEACHER && session.user) {
    return (
      <>
        <TeacherDashboard teacher={session.user as Teacher} students={students} grades={grades} onSaveGrade={handleSaveGrade} onLogout={handleLogout} attendanceRecords={attendanceRecords} onSaveAttendance={handleSaveAttendance} earlyChildhoodReports={earlyChildhoodReports} onSaveEarlyChildhoodReport={handleSaveEarlyChildhoodReport} />
        <BackToTopButton />
      </>
    );
  }

  if (session.role === UserRole.ADMIN && session.user) {
    return (
      <>
        <AdminDashboard
          admin={session.user as Admin}
          students={students}
          teachers={teachers}
          admins={admins}
          schoolMessages={schoolMessages}
          attendanceRecords={attendanceRecords}
          grades={grades}
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
          onGenerateFees={handleGenerate2026FeesForAll}
          onGenerateIndividualFees={handleGenerateIndividualFees}
          onFixDuplicates={handleFixDuplicateFees}
          onResetFees={handleResetStudentFees}
          mensalidades={mensalidades} // Passando mensalidades para admin geral calcular totais
          onLogout={handleLogout}
        />
        <BackToTopButton />
      </>
    );
  }

  return <div>Erro inesperado no estado da aplicação.</div>;
};

export default App;
