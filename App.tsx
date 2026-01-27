
// src/App.tsx

import React, { useState, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { UserRole, UserSession, Student, Teacher, GradeEntry, Admin, SchoolMessage, AttendanceRecord, EarlyChildhoodReport, UnitContact, AppNotification, Mensalidade, EventoFinanceiro, AcademicSettings, Ticket, ClassMaterial, DailyAgenda, ExamGuide, CalendarEvent, ClassSchedule, SchoolUnit, UNIT_LABELS } from './types';
import { MOCK_STUDENTS, MOCK_TEACHERS, MOCK_ADMINS, FINAL_GRADES_CALCULATED, ALLOW_MOCK_LOGIN } from './constants';
import { Login } from './components/Login';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { CoordinatorDashboard } from './components/CoordinatorDashboard';
import { db } from './firebaseConfig';
import { BackToTopButton } from './components/BackToTopButton';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { SchoolLogo } from './components/SchoolLogo';
import { subscribeToAcademicSettings } from './src/services/academicSettings';
import { normalizeUnit } from './src/utils/academicUtils';

import { ValidateReceipt } from './components/ValidateReceipt';
import { StudentDashboardSkeleton, TeacherDashboardSkeleton, AdminDashboardSkeleton, CoordinatorDashboardSkeleton } from './components/Skeleton';

// Extracted Main Application Logic (formerly App)
// Extracted Main Application Logic (formerly App)
const AppContent: React.FC = () => {
  const [session, setSession] = useState<UserSession>(() => {
    try {
      const saved = localStorage.getItem('app_session');
      return saved ? JSON.parse(saved) : { role: UserRole.NONE, user: null };
    } catch (e) {
      console.error("Failed to load session from storage:", e);
      return { role: UserRole.NONE, user: null };
    }
  });

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
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings | null>(null);
  const [classMaterials, setClassMaterials] = useState<ClassMaterial[]>([]);
  const [dailyAgendas, setDailyAgendas] = useState<DailyAgenda[]>([]);
  const [examGuides, setExamGuides] = useState<ExamGuide[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]); // New State
  const [classSchedules, setClassSchedules] = useState<ClassSchedule[]>([]);


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
    eventosFinanceiros: false,
    academicSettings: false,
    materials: false,
    agenda: false,
    examGuides: false,
    tickets: false,
    calendarEvents: false, // New Initial Load Key
    classSchedules: false
  });

  const [isSeeding, setIsSeeding] = useState(false);

  // 1. Static/Public Data (Loaded on mount)
  useEffect(() => {
    // Only fetch relatively static or global configurations
    const unsubContacts = db.collection('unitContacts').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as UnitContact);
      setUnitContacts(data);
      setInitialLoad(prev => ({ ...prev, unitContacts: true }));
    }, (error) => {
      console.error("Erro ao carregar contatos:", error);
      setUnitContacts([]);
      setInitialLoad(prev => ({ ...prev, unitContacts: true }));
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

    const unsubAdmins = db.collection('admins').onSnapshot((snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Admin));
      setAdmins(data);
      setInitialLoad(prev => ({ ...prev, admins: true }));
    }, (error) => {
      if (ALLOW_MOCK_LOGIN) { setAdmins(MOCK_ADMINS); }
      setInitialLoad(prev => ({ ...prev, admins: true }));
    });

    return () => {
      unsubContacts();
      unsubEventos();
      unsubAdmins();
    };
  }, []);

  // 2. Role-Based Dynamic Data (Loaded after login)
  useEffect(() => {
    if (session.role === UserRole.NONE || !session.user) {
      // Clear data on logout
      setStudents([]);
      setTeachers([]);
      setAdmins([]);
      setGrades([]);
      setMensalidades([]);
      setNotifications([]);
      setSchoolMessages([]);
      setAttendanceRecords([]);
      setEarlyChildhoodReports([]);
      return;
    }

    const unsubs: (() => void)[] = [];
    const userUnit = normalizeUnit((session.user as any).unit);
    const userId = session.user.id;

    if (session.role === UserRole.STUDENT) {
      // Student Data Scoping
      unsubs.push(db.collection('grades').where('studentId', '==', userId).onSnapshot(snap => {
        setGrades(snap.docs.map(doc => doc.data() as GradeEntry));
        setInitialLoad(prev => ({ ...prev, grades: true }));
      }, (err) => {
        console.error("Grades listen error:", err);
        setInitialLoad(prev => ({ ...prev, grades: true }));
      }));

      unsubs.push(db.collection('mensalidades').where('studentId', '==', userId).onSnapshot(snap => {
        setMensalidades(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mensalidade)));
        setInitialLoad(prev => ({ ...prev, mensalidades: true }));
      }, (err) => {
        console.error("Mensalidades listen error:", err);
        setInitialLoad(prev => ({ ...prev, mensalidades: true }));
      }));

      unsubs.push(db.collection('notifications').where('studentId', '==', userId).onSnapshot(snap => {
        const data = snap.docs.map(doc => ({ ...doc.data() as AppNotification, id: doc.id }));
        data.sort((a: any, b: any) => {
          const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : (a.timestamp ? new Date(a.timestamp) : new Date(0));
          const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : (b.timestamp ? new Date(b.timestamp) : new Date(0));
          const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
          const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
          return timeB - timeA;
        });
        setNotifications(data);
        setInitialLoad(prev => ({ ...prev, notifications: true }));
      }, (err) => {
        console.error("Notifications listen error:", err);
        setInitialLoad(prev => ({ ...prev, notifications: true }));
      }));

      unsubs.push(db.collection('earlyChildhoodReports').where('studentId', '==', userId).onSnapshot(snap => {
        setEarlyChildhoodReports(snap.docs.map(doc => doc.data() as EarlyChildhoodReport));
        setInitialLoad(prev => ({ ...prev, earlyChildhoodReports: true }));
      }, (err) => {
        console.error("EarlyChildhoodReports listen error:", err);
        setInitialLoad(prev => ({ ...prev, earlyChildhoodReports: true }));
      }));

      unsubs.push(db.collection('teachers').where('unit', '==', userUnit).onSnapshot(snap => {
        setTeachers(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Teacher)));
        setInitialLoad(prev => ({ ...prev, teachers: true }));
      }, (err) => {
        console.error("Teachers listen error:", err);
        setInitialLoad(prev => ({ ...prev, teachers: true }));
      }));

      // Fetch Attendance for the specific student based on their ID
      const studentUser = session.user as Student;
      unsubs.push(db.collection('attendance')
        .where('unit', '==', userUnit)
        .onSnapshot(snap => {
          const allAttendance = snap.docs.map(doc => doc.data() as AttendanceRecord);
          // Filter records where this specific student has a recorded status
          const filtered = allAttendance.filter(record =>
            record.studentStatus && (record.studentStatus[studentUser.id] !== undefined)
          );
          setAttendanceRecords(filtered);
          setInitialLoad(prev => ({ ...prev, attendance: true }));
        }, (err) => {
          console.error("Attendance listen error:", err);
          setInitialLoad(prev => ({ ...prev, attendance: true }));
        }));

      // Subscribe to Academic Settings
      unsubs.push(subscribeToAcademicSettings(2026, (settings) => {
        setAcademicSettings(settings);
        setInitialLoad(prev => ({ ...prev, academicSettings: true }));
      }, userUnit));

      // Real-time Support Tickets
      unsubs.push(db.collection('tickets_pedagogicos').where('studentId', '==', userId).onSnapshot(snap => {
        setTickets(snap.docs.map(doc => ({ ...doc.data() as Ticket, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, tickets: true }));
      }, (err) => {
        console.error("Tickets listen error:", err);
        setInitialLoad(prev => ({ ...prev, tickets: true }));
      }));

      // Real-time Materials, Agenda, and Exam Guides (Student view)
      unsubs.push(db.collection('materials').where('unit', '==', userUnit).onSnapshot(snap => {
        setClassMaterials(snap.docs.map(doc => ({ ...doc.data() as ClassMaterial, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, materials: true }));
      }, (err) => {
        console.error("Materials listen error:", err);
        setInitialLoad(prev => ({ ...prev, materials: true }));
      }));

      unsubs.push(db.collection('daily_agenda').where('unit', '==', userUnit).onSnapshot(snap => {
        setDailyAgendas(snap.docs.map(doc => ({ ...doc.data() as DailyAgenda, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, agenda: true }));
      }, (err) => {
        console.error("Agenda listen error:", err);
        setInitialLoad(prev => ({ ...prev, agenda: true }));
      }));

      unsubs.push(db.collection('exam_guides').where('unit', '==', userUnit).onSnapshot(snap => {
        setExamGuides(snap.docs.map(doc => ({ ...doc.data() as ExamGuide, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, examGuides: true }));
      }, (err) => {
        console.error("ExamGuides listen error:", err);
        setInitialLoad(prev => ({ ...prev, examGuides: true }));
      }));

      // Calendar Events (Unit + All)
      unsubs.push(db.collection('calendar_events')
        .where('units', 'array-contains-any', [userUnit, 'all'])
        .onSnapshot(snap => {
          setCalendarEvents(snap.docs.map(doc => ({ ...doc.data() as CalendarEvent, id: doc.id })));
          setInitialLoad(prev => ({ ...prev, calendarEvents: true }));
        }, (err) => {
          console.error("Calendar Events listen error:", err);
          setInitialLoad(prev => ({ ...prev, calendarEvents: true }));
        }));

      // Class Schedules (Unit)
      unsubs.push(db.collection('class_schedules').where('schoolId', '==', userUnit).onSnapshot(snap => {
        setClassSchedules(snap.docs.map(doc => ({ ...doc.data() as ClassSchedule, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, classSchedules: true }));
      }, (err) => {
        console.error("Class Schedules listen error:", err);
        setInitialLoad(prev => ({ ...prev, classSchedules: true }));
      }));

      // Real-time School Messages (Fale com a Escola) for the student
      unsubs.push(db.collection('schoolMessages').where('studentId', '==', userId).onSnapshot(snap => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolMessage));
        data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setSchoolMessages(data);
        setInitialLoad(prev => ({ ...prev, messages: true }));
      }, (err) => {
        console.error("Student Messages listen error:", err);
        setInitialLoad(prev => ({ ...prev, messages: true }));
      }));

      // Set others to ready for students
      setInitialLoad(prev => ({ ...prev, students: true, admins: true, messages: true }));

    } else if (session.role === UserRole.TEACHER) {
      // Teacher Data Scoping
      unsubs.push(db.collection('students').where('unit', '==', userUnit).onSnapshot(snap => {
        setStudents(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Student)));
        setInitialLoad(prev => ({ ...prev, students: true }));
      }, (err) => {
        console.error("Students listen error:", err);
        setInitialLoad(prev => ({ ...prev, students: true }));
      }));

      unsubs.push(db.collection('attendance').where('unit', '==', userUnit).onSnapshot(snap => {
        setAttendanceRecords(snap.docs.map(doc => doc.data() as AttendanceRecord));
        setInitialLoad(prev => ({ ...prev, attendance: true }));
      }, (err) => {
        console.error("Attendance listen error:", err);
        setInitialLoad(prev => ({ ...prev, attendance: true }));
      }));

      // Grades and EarlyChildhoodReports - ideally filtered by unit if schema allowed, for now fetch all for the unit if possible via multiple id queries? 
      // Simplified for production: teachers still load unit-wide data.
      unsubs.push(db.collection('grades').onSnapshot(snap => {
        setGrades(snap.docs.map(doc => doc.data() as GradeEntry));
        setInitialLoad(prev => ({ ...prev, grades: true }));
      }, (err) => {
        console.error("Grades listen error:", err);
        setInitialLoad(prev => ({ ...prev, grades: true }));
      }));

      unsubs.push(db.collection('earlyChildhoodReports').onSnapshot(snap => {
        setEarlyChildhoodReports(snap.docs.map(doc => doc.data() as EarlyChildhoodReport));
        setInitialLoad(prev => ({ ...prev, earlyChildhoodReports: true }));
      }, (err) => {
        console.error("EarlyChildhoodReports listen error:", err);
        setInitialLoad(prev => ({ ...prev, earlyChildhoodReports: true }));
      }));

      // Load teacher notifications
      unsubs.push(db.collection('notifications').where('teacherId', '==', userId).onSnapshot(snap => {
        const data = snap.docs.map(doc => ({ ...doc.data() as AppNotification, id: doc.id }));
        data.sort((a: any, b: any) => {
          const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : (a.timestamp ? new Date(a.timestamp) : new Date(0));
          const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : (b.timestamp ? new Date(b.timestamp) : new Date(0));
          const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
          const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
          return timeB - timeA;
        });
        setNotifications(data);
        setInitialLoad(prev => ({ ...prev, notifications: true }));
      }, (err) => {
        console.error("Teacher Notifications listen error:", err);
        setInitialLoad(prev => ({ ...prev, notifications: true }));
      }));

      // Real-time Data for Teacher (Materials, Agenda, Exam Guides, Tickets)
      unsubs.push(db.collection('materials').where('unit', '==', userUnit).onSnapshot(snap => {
        setClassMaterials(snap.docs.map(doc => ({ ...doc.data() as ClassMaterial, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, materials: true }));
      }, (err) => {
        console.error("Materials listen error:", err);
        setInitialLoad(prev => ({ ...prev, materials: true }));
      }));

      unsubs.push(db.collection('daily_agenda').where('unit', '==', userUnit).onSnapshot(snap => {
        setDailyAgendas(snap.docs.map(doc => ({ ...doc.data() as DailyAgenda, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, agenda: true }));
      }, (err) => {
        console.error("Agenda listen error:", err);
        setInitialLoad(prev => ({ ...prev, agenda: true }));
      }));

      unsubs.push(db.collection('exam_guides').where('unit', '==', userUnit).onSnapshot(snap => {
        setExamGuides(snap.docs.map(doc => ({ ...doc.data() as ExamGuide, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, examGuides: true }));
      }, (err) => {
        console.error("ExamGuides listen error:", err);
        setInitialLoad(prev => ({ ...prev, examGuides: true }));
      }));

      unsubs.push(db.collection('tickets_pedagogicos').where('unit', '==', userUnit).onSnapshot(snap => {
        setTickets(snap.docs.map(doc => ({ ...doc.data() as Ticket, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, tickets: true }));
      }, (err) => {
        console.error("Tickets listen error:", err);
        setInitialLoad(prev => ({ ...prev, tickets: true }));
      }));

      // Calendar Events (Unit + All)
      unsubs.push(db.collection('calendar_events')
        .where('units', 'array-contains-any', [userUnit, 'all'])
        .onSnapshot(snap => {
          setCalendarEvents(snap.docs.map(doc => ({ ...doc.data() as CalendarEvent, id: doc.id })));
          setInitialLoad(prev => ({ ...prev, calendarEvents: true }));
        }, (err) => {
          console.error("Calendar Events listen error:", err);
          setInitialLoad(prev => ({ ...prev, calendarEvents: true }));
        }));

      // Class Schedules (Unit) - ADDED FOR TEACHER
      unsubs.push(db.collection('class_schedules').where('schoolId', '==', userUnit).onSnapshot(snap => {
        setClassSchedules(snap.docs.map(doc => ({ ...doc.data() as ClassSchedule, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, classSchedules: true }));
      }, (err) => {
        console.error("Class Schedules (Teacher) listen error:", err);
        setInitialLoad(prev => ({ ...prev, classSchedules: true }));
      }));

      setInitialLoad(prev => ({ ...prev, teachers: true, admins: true, messages: true, mensalidades: true, academicSettings: true }));

    } else if (session.role === UserRole.ADMIN) {
      const isGeneral = !userUnit || userUnit === 'admin_geral';

      const studentsQuery = isGeneral ? db.collection('students') : db.collection('students').where('unit', '==', userUnit);
      unsubs.push(studentsQuery.onSnapshot(snap => {
        setStudents(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Student)));
        setInitialLoad(prev => ({ ...prev, students: true }));
      }, (err) => {
        console.error("Students listen error:", err);
        setInitialLoad(prev => ({ ...prev, students: true }));
      }));

      const teachersQuery = isGeneral ? db.collection('teachers') : db.collection('teachers').where('unit', '==', userUnit);
      unsubs.push(teachersQuery.onSnapshot(snap => {
        setTeachers(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Teacher)));
        setInitialLoad(prev => ({ ...prev, teachers: true }));
      }, (err) => {
        console.error("Teachers listen error:", err);
        setInitialLoad(prev => ({ ...prev, teachers: true }));
      }));

      // Admins already fetched globally for Login
      setInitialLoad(prev => ({ ...prev, admins: true }));

      unsubs.push(db.collection('grades').onSnapshot(snap => {
        setGrades(snap.docs.map(doc => doc.data() as GradeEntry));
        setInitialLoad(prev => ({ ...prev, grades: true }));
      }, (err) => {
        console.error("Grades listen error:", err);
        setInitialLoad(prev => ({ ...prev, grades: true }));
      }));

      const messagesQuery = isGeneral ? db.collection('schoolMessages') : db.collection('schoolMessages').where('unit', '==', userUnit);
      unsubs.push(messagesQuery.onSnapshot(snap => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolMessage));
        data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setSchoolMessages(data);
        setInitialLoad(prev => ({ ...prev, messages: true }));
      }, (err) => {
        console.error("Messages listen error:", err);
        setInitialLoad(prev => ({ ...prev, messages: true }));
      }));

      const attendanceQuery = isGeneral ? db.collection('attendance') : db.collection('attendance').where('unit', '==', userUnit);
      unsubs.push(attendanceQuery.onSnapshot(snap => {
        setAttendanceRecords(snap.docs.map(doc => doc.data() as AttendanceRecord));
        setInitialLoad(prev => ({ ...prev, attendance: true }));
      }, (err) => {
        console.error("Attendance listen error:", err);
        setInitialLoad(prev => ({ ...prev, attendance: true }));
      }));

      unsubs.push(db.collection('mensalidades').onSnapshot(snap => {
        setMensalidades(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mensalidade)));
        setInitialLoad(prev => ({ ...prev, mensalidades: true }));
      }, (err) => {
        console.error("Mensalidades listen error:", err);
        setInitialLoad(prev => ({ ...prev, mensalidades: true }));
      }));

      const calendarQuery = isGeneral
        ? db.collection('calendar_events')
        : db.collection('calendar_events').where('units', 'array-contains-any', [userUnit, 'all']);

      unsubs.push(calendarQuery.onSnapshot(snap => {
        setCalendarEvents(snap.docs.map(doc => ({ ...doc.data() as CalendarEvent, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, calendarEvents: true }));
      }, (err) => {
        console.error("Calendar Events (Admin) listen error:", err);
        setInitialLoad(prev => ({ ...prev, calendarEvents: true }));
      }));

      setInitialLoad(prev => ({
        ...prev,
        notifications: true,
        earlyChildhoodReports: true,
        academicSettings: true,
        materials: true,
        agenda: true,
        examGuides: true,
        tickets: true,
        calendarEvents: true,
        classSchedules: true
      }));

    } else if (session.role === UserRole.COORDINATOR) {
      // Coordinator manages their own data fetch in the dashboard or doesn't need global data pre-loaded
      // FIX: CoordinatorDashboard EXPECTS these to be passed as props!

      // Real-time Support Tickets (Unit Scoped)
      unsubs.push(db.collection('tickets_pedagogicos').where('unit', '==', userUnit).onSnapshot(snap => {
        setTickets(snap.docs.map(doc => ({ ...doc.data() as Ticket, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, tickets: true }));
      }, (err) => {
        console.error("Coordinator Tickets listen error:", err);
        setInitialLoad(prev => ({ ...prev, tickets: true }));
      }));

      // Calendar Events (Unit + All)
      unsubs.push(db.collection('calendar_events')
        .where('units', 'array-contains-any', [userUnit, 'all'])
        .onSnapshot(snap => {
          setCalendarEvents(snap.docs.map(doc => ({ ...doc.data() as CalendarEvent, id: doc.id })));
          setInitialLoad(prev => ({ ...prev, calendarEvents: true }));
        }, (err) => {
          console.error("Coordinator Calendar Events listen error:", err);
          setInitialLoad(prev => ({ ...prev, calendarEvents: true }));
        }));

      // Class Schedules (Unit)
      unsubs.push(db.collection('class_schedules').where('schoolId', '==', userUnit).onSnapshot(snap => {
        setClassSchedules(snap.docs.map(doc => ({ ...doc.data() as ClassSchedule, id: doc.id })));
        setInitialLoad(prev => ({ ...prev, classSchedules: true }));
      }, (err) => {
        console.error("Coordinator Class Schedules listen error:", err);
        setInitialLoad(prev => ({ ...prev, classSchedules: true }));
      }));

      // We just need to signal that the "initial load" is complete so the router can proceed.
      setInitialLoad(prev => ({
        ...prev,
        students: true,
        teachers: true,
        admins: true,
        grades: true,
        messages: true,
        attendance: true,
        earlyChildhoodReports: true,
        unitContacts: true,
        notifications: true,
        mensalidades: true,
        eventosFinanceiros: true,
        academicSettings: true,
        materials: true,
        agenda: true,
        examGuides: true,
        tickets: true,
        calendarEvents: true,
        classSchedules: true
      }));
    }

    return () => unsubs.forEach(u => u());
  }, [session.role, session.user]);

  const seedDatabase = async () => {
    if (!ALLOW_MOCK_LOGIN) return;
    const batch = db.batch();
    MOCK_ADMINS.forEach(admin => batch.set(db.collection('admins').doc(admin.id), admin));
    MOCK_STUDENTS.forEach(student => batch.set(db.collection('students').doc(student.id), student));
    MOCK_TEACHERS.forEach(teacher => batch.set(db.collection('teachers').doc(teacher.id), teacher));
    FINAL_GRADES_CALCULATED.forEach(grade => batch.set(db.collection('grades').doc(grade.id), grade));
    await batch.commit();
  };

  // No data strictly required for login now (Login uses constants and public admins/contacts)
  const isDataReady = (() => {
    if (session.role === UserRole.NONE) {
      return true; // Skip pre-loader for login screen
    }
    if (session.role === UserRole.STUDENT) {
      // Essentials for student: Grades, Fees and Settings
      return initialLoad.grades && initialLoad.mensalidades && initialLoad.academicSettings;
    }
    // Teachers and Admins still need more full sets
    return Object.values(initialLoad).every(Boolean);
  })();

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
    const today = new Date().toLocaleDateString('en-CA');
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

  const handleStudentLogin = async (code: string, pass: string) => {
    try {
      // Direct Firestore query instead of local filtering
      const snapshot = await db.collection('students')
        .where('code', '==', code)
        .where('password', '==', pass)
        .get();

      if (!snapshot.empty) {
        const student = { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Student;
        if (student.isBlocked) {
          setLoginError('Acesso negado. Entre em contato com a secretaria.');
          return;
        }
        setSession({ role: UserRole.STUDENT, user: student });
        setLoginError('');
        logAccess(student.id);
      } else {
        // Fallback to Mock if enabled and DB is empty
        if (ALLOW_MOCK_LOGIN) {
          const matchedStudent = MOCK_STUDENTS.find(s => s.code === code && s.password === pass);
          if (matchedStudent) {
            setSession({ role: UserRole.STUDENT, user: matchedStudent });
            setLoginError('');
            logAccess(matchedStudent.id);
            return;
          }
        }
        setLoginError('Código ou senha incorretos');
      }
    } catch (error) {
      console.error("Login error:", error);
      setLoginError('Erro ao conectar ao servidor. Tente novamente.');
    }
  };

  const handleTeacherLogin = async (cpf: string, pass: string, unit?: string) => {
    try {
      // Tentar com o CPF formatado
      let snapshot = await db.collection('teachers')
        .where('cpf', '==', cpf)
        .where('password', '==', pass)
        .where('unit', '==', unit)
        .get();

      // Se não encontrar, tentar com o CPF apenas números
      if (snapshot.empty) {
        const rawCpf = cpf.replace(/\D/g, '');
        snapshot = await db.collection('teachers')
          .where('cpf', '==', rawCpf)
          .where('password', '==', pass)
          .where('unit', '==', unit)
          .get();
      }

      if (!snapshot.empty) {
        const teacher = { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Teacher;
        setSession({ role: UserRole.TEACHER, user: teacher });
        setLoginError('');
        logAccess(teacher.id);
      } else {
        if (ALLOW_MOCK_LOGIN) {
          const teacher = MOCK_TEACHERS.find(t => t.cpf === cpf && t.password === pass && t.unit === unit);
          if (teacher) {
            setSession({ role: UserRole.TEACHER, user: teacher });
            setLoginError('');
            logAccess(teacher.id);
            return;
          }
        }
        setLoginError('Professor não encontrado, CPF ou senha inválidos.');
      }
    } catch (error) {
      console.error("Teacher Login error:", error);
      setLoginError('Erro ao conectar ao servidor.');
    }
  };


  const handleAdminLogin = async (user: string, pass: string) => {
    try {
      const snapshot = await db.collection('admins')
        .where('username', '==', user)
        .where('password', '==', pass)
        .get();

      if (!snapshot.empty) {
        const admin = { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Admin;
        setSession({ role: UserRole.ADMIN, user: admin });
        setLoginError('');
        logAccess(admin.id);
      } else {
        if (ALLOW_MOCK_LOGIN) {
          const admin = MOCK_ADMINS.find(a => a.username === user && a.password === pass);
          if (admin) {
            setSession({ role: UserRole.ADMIN, user: admin });
            setLoginError('');
            logAccess(admin.id);
            return;
          }
        }
        setLoginError('Credenciais inválidas.');
      }
    } catch (error) {
      console.error("Admin Login error:", error);
      setLoginError('Erro ao conectar ao servidor.');
    }
  };

  const handleCoordinatorLogin = async (name: string, pass: string, unit: string) => {
    try {
      const snapshot = await db.collection('unitContacts')
        .where('name', '==', name.trim())
        .where('password', '==', pass)
        .where('unit', '==', unit)
        .get();

      if (!snapshot.empty) {
        const coord = { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as UnitContact;
        setSession({ role: UserRole.COORDINATOR, user: coord });
        setLoginError('');
        logAccess(coord.id);
      } else {
        setLoginError('Coordenador não encontrado ou senha incorreta.');
      }

    } catch (error) {
      console.error("Coordinator Login error:", error);
      setLoginError('Erro ao conectar ao servidor.');
    }
  };

  const handleLogout = () => {
    setSession({ role: UserRole.NONE, user: null });
    setLoginError('');
    localStorage.removeItem('app_session');
  };

  // 3. Validation: Check if the user document still exists in Firestore on boot/refresh
  useEffect(() => {
    if (session.role === UserRole.NONE || !session.user || !session.user.id || ALLOW_MOCK_LOGIN) return;

    const validateSession = async () => {
      let collectionName = '';
      switch (session.role) {
        case UserRole.STUDENT: collectionName = 'students'; break;
        case UserRole.TEACHER: collectionName = 'teachers'; break;
        case UserRole.ADMIN: collectionName = 'admins'; break;
        case UserRole.COORDINATOR: collectionName = 'unitContacts'; break;
        default: return;
      }

      try {
        const doc = await db.collection(collectionName).doc(session.user!.id).get();
        if (!doc.exists) {
          console.warn("Session user not found in database. Logging out.");
          handleLogout();
        }
      } catch (error) {
        console.error("Session validation error:", error);
      }
    };

    validateSession();
  }, [session.role, session.user?.id]);

  // 4. Persist Session

  useEffect(() => {
    if (session.role !== UserRole.NONE) {
      localStorage.setItem('app_session', JSON.stringify(session));
    }
  }, [session]);

  // Helper para criar notificação interna
  const createNotification = async (title: string, message: string, studentId?: string, teacherId?: string) => {
    const notification: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      ...(studentId && { studentId }),
      ...(teacherId && { teacherId }),
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
      // Add teacherId if it's a teacher saving the grade
      const gradeToSave = {
        ...grade,
        ...(session.role === UserRole.TEACHER && { teacherId: session.user?.id })
      };

      await db.collection('grades').doc(grade.id).set(gradeToSave);
      // Let display side (StudentDashboard) handle ID-to-Name mapping for notifications
      // as App.tsx doesn't always have the full academicSubjects list loaded yet.
      await createNotification(
        'Boletim Atualizado',
        `Sua nota de ${grade.subject} foi atualizada pelo professor.`,
        grade.studentId
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
        'Relatório Disponível',
        `O relatório de desenvolvimento do ${report.semester}º Semestre foi atualizado.`,
        report.studentId
      );
    } catch (error) {
      console.error("Erro ao salvar relatório:", error);
      alert("Erro ao salvar o relatório. Verifique sua conexão e tente novamente.");
      throw error;
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await db.collection('notifications').doc(id).delete();
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error("Erro ao deletar notificação", e);
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

  const handleDeleteAttendance = async (recordId: string) => {
    try {
      await db.collection('attendance').doc(recordId).delete();
      alert('Chamada excluída com sucesso!');
    } catch (error) {
      console.error("Erro ao excluir chamada:", error);
      alert("Erro ao excluir a chamada. Verifique sua conexão.");
      throw error;
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
  const generate2026Fees = (student: Student, batch: firebase.firestore.WriteBatch, excludedMonths: string[] = [], startMonthIndex: number = 0) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const year = 2026;
    const value = student.valor_mensalidade || 0;

    months.forEach((month, index) => {
      // Skip months before the start index (Proportional logic)
      if (index < startMonthIndex) return;

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
    if (student.isScholarship) {
      alert(`O aluno ${student.name} está marcado como BOLSISTA e está isento de mensalidades. Nenhuma cobrança foi gerada.`);
      return;
    }

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

      // --- LOGICA PROPORCIONAL ---
      const now = new Date();
      const currentYear = now.getFullYear();
      let startMonthIndex = 0; // Default: Jan

      if (currentYear === 2026) {
        startMonthIndex = now.getMonth(); // 0 = Jan, 3 = Abril, etc.
      } else if (currentYear > 2026) {
        // Se ja passou de 2026, tecnicamente nao deveria gerar nada proporcionalmente
        // Mas vamos deixar gerar Dezembro se estiver no final do ano ou bloquear?
        // User pediu especificamente 2026. Se for > 2026, vamos travar.
        alert("O ano de 2026 já passou. Não é possível gerar novos carnês para este ano.");
        return;
      }
      // ----------------------------

      // 1. Delete ALL Pending fees (Cleanup)
      let deletedCount = 0;
      for (const fee of pendingFees) {
        const feeRef = db.collection('mensalidades').doc(fee.id);
        batch.delete(feeRef);
        deletedCount++;
      }

      // 2. Generate fees, EXCLUDING the months that are already Paid
      const paidMonths = paidFees.map(m => m.month);
      generate2026Fees(student, batch, paidMonths, startMonthIndex);

      await batch.commit();

      if (existingFees2026.length > 0) {
        alert(`Carnê atualizado com sucesso! ${deletedCount} pendentes recriadas. ${paidFees.length} pagas mantidas.`);
      } else {
        const monthsText = startMonthIndex === 0 ? "12 meses" : "proporcional";
        alert(`Carnê ${monthsText} gerado com sucesso para ${student.name}`);
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

      // --- LOGICA PROPORCIONAL ---
      const now = new Date();
      const currentYear = now.getFullYear();
      let startMonthIndex = 0; // Default: Jan

      if (currentYear === 2026) {
        startMonthIndex = now.getMonth();
      } else if (currentYear > 2026) {
        alert("O ano de 2026 já passou. Não é possível gerar novos carnês para este ano.");
        return;
      }
      // ----------------------------

      // Filtra alunos que já têm mensalidades (otimização básica) ou checa na hora
      // Para simplificar e garantir, vamos iterar todos e verificar se já existe a mensalidade de Janeiro/2026
      // Se não existir, gera o ano todo.

      const skippedStudents: string[] = [];

      for (const student of students) {
        // Verifica se já existe mensalidade de Janeiro 2026 para este aluno localmente para evitar reads excessivos
        const existingFee = mensalidades.find(m => m.studentId === student.id && m.month === 'Janeiro/2026');

        if (!existingFee) {
          if (student.isScholarship) {
            console.log(`Pulando aluno bolsista: ${student.name}`);
            skippedStudents.push(`${student.name} (Bolsista)`);
            continue;
          }

          if (!student.valor_mensalidade || student.valor_mensalidade <= 0) {
            skippedStudents.push(student.name);
            continue;
          }
          generate2026Fees(student, batch, [], startMonthIndex);
          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
        const monthsLabel = startMonthIndex === 0 ? "12 meses (Jan-Dez)" : "meses proporcionais";
        let msg = `Sucesso! Carnês de 2026 (${monthsLabel}) gerados para ${count} alunos.`;
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
    if (session.role === UserRole.STUDENT) return <StudentDashboardSkeleton />;
    if (session.role === UserRole.TEACHER) return <TeacherDashboardSkeleton />;
    if (session.role === UserRole.ADMIN) return <AdminDashboardSkeleton />;
    if (session.role === UserRole.COORDINATOR) return <CoordinatorDashboardSkeleton />;

    // Fallback for unexpected states while loading
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 mb-6 animate-pulse opacity-50">
          <SchoolLogo variant="login" />
        </div>

        <div className="space-y-4 w-full max-w-sm">
          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="bg-blue-900 h-full animate-progress-indeterminate"></div>
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <span>Sincronizando</span>
            <span className="animate-pulse">Aguarde...</span>
          </div>
        </div>
      </div>
    );
  }

  if (session.role === UserRole.NONE) {
    return (
      <>
        <Login onLoginStudent={handleStudentLogin} onLoginTeacher={handleTeacherLogin} onLoginAdmin={handleAdminLogin} onLoginCoordinator={handleCoordinatorLogin} onResetSystem={handleResetSystem} error={loginError} adminsList={admins} />
        <BackToTopButton />
      </>
    );
  }

  if (session.role === UserRole.COORDINATOR && session.user) {
    return (
      <>
        <CoordinatorDashboard
          coordinator={session.user as UnitContact}
          onLogout={handleLogout}
          onCreateNotification={createNotification}
          academicSettings={academicSettings}
          tickets={tickets}
          calendarEvents={calendarEvents}
          classSchedules={classSchedules}
        />
        <BackToTopButton />
      </>
    );
  }

  if (session.role === UserRole.STUDENT && session.user) {
    return (
      <>
        <StudentDashboard
          calendarEvents={calendarEvents}
          student={session.user as Student}
          grades={grades}
          teachers={teachers}
          attendanceRecords={attendanceRecords}
          earlyChildhoodReports={earlyChildhoodReports}
          unitContacts={unitContacts}
          academicSettings={academicSettings}
          onLogout={handleLogout}
          onSendMessage={handleSendMessage}
          onCreateNotification={createNotification}
          notifications={notifications.filter(n => n.studentId === (session.user as Student).id)}
          onDeleteNotification={handleDeleteNotification}
          mensalidades={mensalidades}
          eventos={eventosFinanceiros}
          materials={classMaterials}
          agendas={dailyAgendas}
          examGuides={examGuides}
          tickets={tickets}
          classSchedules={classSchedules}
          schoolMessages={schoolMessages}
        />
        <BackToTopButton />
      </>
    );
  }

  if (session.role === UserRole.TEACHER && session.user) {
    return (
      <>
        <TeacherDashboard
          calendarEvents={calendarEvents}
          teacher={session.user as Teacher}
          students={students}
          grades={grades}
          onSaveGrade={handleSaveGrade}
          onLogout={handleLogout}
          attendanceRecords={attendanceRecords}
          onSaveAttendance={handleSaveAttendance}
          onDeleteAttendance={handleDeleteAttendance}
          earlyChildhoodReports={earlyChildhoodReports}
          onSaveEarlyChildhoodReport={handleSaveEarlyChildhoodReport}
          notifications={notifications}
          onDeleteNotification={handleDeleteNotification}
          academicSettings={academicSettings}
          materials={classMaterials}
          agendas={dailyAgendas}
          examGuides={examGuides}
          tickets={tickets}
          classSchedules={classSchedules}
        />
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
          initialLoad={initialLoad}
          academicSettings={academicSettings}
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

// New App Wrapper with Router
const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/validar-recibo/:id" element={<ValidateReceipt />} />
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </Router>
  );
};

export default App;
