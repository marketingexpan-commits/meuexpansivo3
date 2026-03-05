import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebaseConfig';
import { Student, SchoolUnit, UNIT_LABELS, SHIFT_LABELS, SchoolShift, PhotographerDemand } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { LogOut, Search, Filter, Camera, CameraOff, AlertTriangle, CheckCircle2, User, XCircle, Users, CalendarDays, Bell, ChevronDown } from 'lucide-react';
import { SCHOOL_UNITS_LIST } from '../constants';
import { useAcademicData } from '../hooks/useAcademicData';

export const PhotographerDashboard: React.FC = () => {
    const { grades: allGrades, loading: loadingAcademic } = useAcademicData();
    const [students, setStudents] = useState<Student[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedShift, setSelectedShift] = useState('');
    const [activeUnitFilter, setActiveUnitFilter] = useState('');
    const [showOnlyExceptions, setShowOnlyExceptions] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [signatures, setSignatures] = useState<Record<string, { isAuthorized: boolean }>>({});
    const [activeTab, setActiveTab] = useState<'students' | 'demands'>('students');
    const [demands, setDemands] = useState<PhotographerDemand[]>([]);
    const [suggestionForm, setSuggestionForm] = useState<{ demandId: string; date: string; time: string } | null>(null);
    const [demandsUnitFilter, setDemandsUnitFilter] = useState<string>('');
    const pendingDemandsCount = useMemo(() => demands.filter(d => d.status === 'pending').length, [demands]);

    const photographerName = localStorage.getItem('photographerName') || 'Fotógrafo';
    const userUnit = localStorage.getItem('userUnit') || '';

    useEffect(() => {
        if (!userUnit) {
            window.location.href = '/login';
            return;
        }

        const fetchStudentsAndSignatures = async () => {
            try {
                // Fetch students - using 'CURSANDO' as the active status per database check
                let studentsQuery: any = db.collection('students').where('status', '==', 'CURSANDO');
                if (userUnit !== 'all') {
                    studentsQuery = studentsQuery.where('unit', '==', userUnit);
                }
                const studentsSnap = await studentsQuery.get();
                console.log(`Fetched ${studentsSnap.docs.length} students`);

                const studentsData = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
                setStudents(studentsData);

                // Fetch image rights signatures
                let termsQuery: any = db.collection('legal_terms');
                if (userUnit !== 'all') {
                    termsQuery = termsQuery.where('applicableUnits', 'array-contains-any', ['all', userUnit]);
                }
                const termsSnap = await termsQuery.get();

                const imageTermIds = termsSnap.docs
                    .filter(doc => {
                        const title = (doc.data().title || '').toLowerCase();
                        return title.includes('imagem') || title.includes('fotografia');
                    })
                    .map(doc => doc.id);

                const sigMap: Record<string, { isAuthorized: boolean }> = {};
                let sigDocsCount = 0;

                if (imageTermIds.length > 0) {
                    let sigQuery: any = db.collection('term_signatures');
                    if (userUnit !== 'all') {
                        sigQuery = sigQuery.where('unit', '==', userUnit);
                    }
                    const sigSnap = await sigQuery.get();
                    sigDocsCount = sigSnap.docs.length;

                    sigSnap.docs.forEach(doc => {
                        const data = doc.data() as any;
                        if (imageTermIds.includes(data.termId)) {
                            // se for false, é explicitamente false. se não (antigo ou true), é true
                            sigMap[data.studentId] = {
                                isAuthorized: data.isAuthorized === false ? false : true
                            };
                        }
                    });
                }
                setSignatures(sigMap);

            } catch (error) {
                console.error("Erro ao carregar dados:", error);
                alert("Erro ao carregar lista de alunos e autorizações.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchStudentsAndSignatures();
    }, [userUnit]);

    // REAL-TIME DEMANDS LISTENER
    useEffect(() => {
        if (!userUnit) return;

        let demandsQuery: any = db.collection('photographer_demands');
        if (userUnit !== 'all') {
            demandsQuery = demandsQuery.where('unit', '==', userUnit);
        }

        const unsubscribe = demandsQuery.onSnapshot((snap: any) => {
            const demandsData = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as PhotographerDemand));
            setDemands(demandsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        }, (error: any) => {
            console.error("Erro listener demandas:", error);
        });

        return () => unsubscribe();
    }, [userUnit]);

    const handleUpdateDemandStatus = async (demandId: string, newStatus: PhotographerDemand['status']) => {
        try {
            const updateData: any = { status: newStatus };
            const now = new Date().toISOString();

            if (newStatus === 'read') updateData.readAt = now;
            if (newStatus === 'confirmed') updateData.confirmedAt = now;

            await db.collection('photographer_demands').doc(demandId).update(updateData);
            setDemands(prev => prev.map(d => d.id === demandId ? { ...d, ...updateData } : d));
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            alert("Erro ao atualizar o status da demanda.");
        }
    };

    const handleSuggestDateTime = async (demandId: string, suggestedDate: string, suggestedTime: string) => {
        try {
            const now = new Date().toISOString();
            await db.collection('photographer_demands').doc(demandId).update({
                status: 'suggested',
                suggestedDate,
                suggestedTime,
                suggestedAt: now
            });
            setDemands(prev => prev.map(d => d.id === demandId ? {
                ...d,
                status: 'suggested',
                suggestedDate,
                suggestedTime,
                suggestedAt: now
            } : d));
            setSuggestionForm(null);
        } catch (error) {
            console.error("Erro ao sugerir data:", error);
            alert("Erro ao enviar sugestão.");
        }
    };

    const normalizeString = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // Filters logic
    const filteredStudents = students.filter(student => {
        const matchesSearch = normalizeString(student.name).includes(normalizeString(searchTerm)) || (student.code && student.code.includes(searchTerm));

        // Strict Canonical ID matching
        const studentGradeId = student.gradeId || student.gradeLevel;
        const matchesGrade = selectedGrade ? studentGradeId === selectedGrade : true;

        const matchesClass = selectedClass ? student.schoolClass === selectedClass : true;
        const matchesShift = selectedShift ? student.shift === selectedShift : true;
        const matchesUnit = activeUnitFilter ? student.unit === activeUnitFilter : true;

        // Academic Year Filter (Current Year 2026)
        const matchesYear = student.enrolledYears?.includes('2026');

        const isExplicitlyUnauthorized = signatures[student.id] && signatures[student.id].isAuthorized === false;
        const matchesException = showOnlyExceptions ? isExplicitlyUnauthorized : true;

        return matchesSearch && matchesGrade && matchesClass && matchesShift && matchesUnit && matchesException && matchesYear;
    });

    // Process unique data for dropdowns
    const availableGrades = useMemo(() => {
        const activeStudents2026 = students.filter(s => s.enrolledYears?.includes('2026'));
        const activeGradeIds = new Set(activeStudents2026.map(s => s.gradeId || s.gradeLevel));

        // Filter and sort canonical grades
        return allGrades
            .filter(g => activeGradeIds.has(g.id))
            .filter(g => g.name !== 'BE' && g.name !== 'N1')
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [allGrades, students]);

    const uniqueClasses = useMemo(() =>
        Array.from(new Set(students.filter(s => s.enrolledYears?.includes('2026')).map(s => s.schoolClass)))
            .filter(Boolean)
            .sort(),
        [students]);

    const uniqueShifts = useMemo(() => {
        const shifts = Array.from(new Set(students.filter(s => s.enrolledYears?.includes('2026')).map(s => s.shift)))
            .filter(Boolean)
            .filter(s => s === 'shift_morning' || s === 'shift_afternoon'); // Keep only canonical
        return Array.from(new Set(shifts)).sort();
    }, [students]);

    const handleLogout = () => {
        localStorage.removeItem('userUnit');
        localStorage.removeItem('photographerName');
        localStorage.removeItem('photographerId');
        window.location.href = '/login';
    };

    // Helper for labels
    const getUnitLabel = (u: string) => (UNIT_LABELS as any)[u] || u;
    const getShiftLabel = (s: string) => (SHIFT_LABELS as any)[s] || s;

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans transition-all duration-500 ease-in-out">
            <div className={`w-full bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col transition-all duration-500 ease-in-out max-w-md`}>
                {/* Header */}
                <header className="flex items-center justify-between p-4 sm:p-6 bg-white shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="h-8 sm:h-10 w-auto shrink-0">
                            <SchoolLogo className="!h-full w-auto" />
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="text-[9px] text-orange-600 font-bold uppercase tracking-[0.15em] leading-none mb-1">Aplicativo</span>
                            <h1 className="text-sm sm:text-lg font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                            <span className="text-[9px] text-blue-950/60 font-bold uppercase tracking-wider leading-none mt-1">Painel do Fotógrafo</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 relative">
                        <button
                            className="p-2 text-gray-400 relative hover:bg-slate-50 transition-colors rounded-full"
                            onClick={() => setActiveTab('demands')}
                        >
                            <Bell className="w-6 h-6" />
                            {pendingDemandsCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-orange-600 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-pulse px-0.5">
                                    {pendingDemandsCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={handleLogout}
                            className="bg-slate-100 hover:bg-slate-200 text-blue-950 font-bold py-2 px-5 rounded-xl transition-all text-sm ml-1"
                        >
                            Sair
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white custom-scrollbar">
                    {isLoading || loadingAcademic ? (
                        <div className="text-center py-40 animate-pulse flex flex-col items-center">
                            <Camera className="w-16 h-16 text-blue-200 mb-6" />
                            <p className="text-blue-950 font-black uppercase text-[10px] tracking-widest italic">Acessando sistema...</p>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-fade-in-up">
                            {/* Greeting Area */}
                            <div>
                                <h2 className="text-blue-950 font-black text-xl leading-tight">Olá, {photographerName}</h2>
                                <p className="text-gray-400 text-sm font-medium">
                                    {activeTab === 'students' ? 'Busque os alunos para verificar autorizações.' : 'Acompanhe as solicitações de presença.'}
                                </p>
                            </div>

                            {/* Tabs Navigation */}
                            <div className="flex p-1 bg-gray-100 rounded-2xl gap-1">
                                <button
                                    onClick={() => setActiveTab('students')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'students' ? 'bg-white text-blue-950 shadow-sm' : 'text-gray-500 hover:text-blue-950 hover:bg-white/50'}`}
                                >
                                    <Users className="w-4 h-4" />
                                    <span>Alunos</span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('demands')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'demands' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-orange-600 hover:bg-white/50'}`}
                                >
                                    <CalendarDays className="w-4 h-4" />
                                    <span>Demandas</span>
                                </button>
                            </div>

                            {activeTab === 'students' && (
                                <>
                                    {/* Search & Filters */}
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                                            <input
                                                type="text"
                                                placeholder="Nome ou código do aluno..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 font-bold text-blue-950 placeholder:text-gray-300"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="relative group">
                                                <select
                                                    value={selectedGrade}
                                                    onChange={(e) => setSelectedGrade(e.target.value)}
                                                    className="w-full pl-4 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold text-blue-950 appearance-none focus:outline-none cursor-pointer"
                                                >
                                                    <option value="">Série</option>
                                                    {availableGrades.map(g => (
                                                        <option key={g.id} value={g.id}>{g.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="relative group">
                                                <select
                                                    value={selectedClass}
                                                    onChange={(e) => setSelectedClass(e.target.value)}
                                                    className="w-full pl-4 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold text-blue-950 appearance-none focus:outline-none cursor-pointer"
                                                >
                                                    <option value="">Turma</option>
                                                    {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div className="relative group">
                                                <select
                                                    value={selectedShift}
                                                    onChange={(e) => setSelectedShift(e.target.value)}
                                                    className="w-full pl-4 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold text-blue-950 appearance-none focus:outline-none cursor-pointer"
                                                >
                                                    <option value="">Turno</option>
                                                    {uniqueShifts.map(s => <option key={s} value={s}>{getShiftLabel(s)}</option>)}
                                                </select>
                                            </div>
                                            {userUnit === 'all' && (
                                                <div className="relative group">
                                                    <select
                                                        value={activeUnitFilter}
                                                        onChange={(e) => setActiveUnitFilter(e.target.value)}
                                                        className="w-full pl-4 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold text-blue-950 appearance-none focus:outline-none cursor-pointer"
                                                    >
                                                        <option value="">Unidade</option>
                                                        {SCHOOL_UNITS_LIST.map(u => (
                                                            <option key={u} value={u}>{UNIT_LABELS[u as any] || u}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 py-2">
                                            <label className="flex items-center cursor-pointer relative group">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={showOnlyExceptions}
                                                    onChange={(e) => setShowOnlyExceptions(e.target.checked)}
                                                />
                                                <div className="w-10 h-5 bg-gray-100 rounded-full transition-colors peer-checked:bg-orange-500"></div>
                                                <div className="absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                                            </label>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Somente não autorizados</span>
                                        </div>
                                    </div>

                                    {/* List Section */}
                                    <div className="space-y-3">
                                        {(() => {
                                            const isUnitSelected = userUnit !== 'all' || activeUnitFilter;
                                            const isGradeSelected = selectedGrade;
                                            const canShowResults = isUnitSelected && isGradeSelected;

                                            if (!canShowResults) {
                                                return (
                                                    <div className="p-16 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 mt-4">
                                                        <Filter className="w-12 h-12 mx-auto text-blue-100 mb-4" />
                                                        <h3 className="text-sm font-black text-blue-950 uppercase tracking-tight">Selecione os Filtros</h3>
                                                        <p className="text-xs text-gray-400 mt-2 font-medium">Escolha a Unidade e a Série para listar os alunos.</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <>
                                                    <div className="flex items-center justify-between px-1">
                                                        <span className="text-[10px] font-black text-blue-950/40 uppercase tracking-widest">Resultados 2026</span>
                                                        <span className="text-[10px] font-black text-blue-950 uppercase tracking-widest">{filteredStudents.length} alunos</span>
                                                    </div>

                                                    {filteredStudents.length === 0 ? (
                                                        <div className="p-12 text-center bg-gray-50 rounded-3xl">
                                                            <CameraOff className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                                                            <h3 className="text-sm font-black text-gray-300 uppercase">Nenhum aluno nesta série</h3>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4 pb-10">
                                                            {filteredStudents.map(student => {
                                                                const hasAuth = signatures[student.id];
                                                                const studentGradeId = student.gradeId || student.gradeLevel;
                                                                const gradeLabel = allGrades.find(g => g.id === studentGradeId)?.name || student.gradeLevel;

                                                                return (
                                                                    <div key={student.id} className="p-4 bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 group">
                                                                        {/* Student Photo */}
                                                                        <div className="w-[3.5rem] h-[4.5rem] rounded-[10px] bg-slate-50 overflow-hidden flex-shrink-0 border border-slate-100 relative">
                                                                            {(student as any).photoUrl || (student as any).photo ? (
                                                                                <img
                                                                                    src={(student as any).photoUrl || (student as any).photo}
                                                                                    alt={student.name}
                                                                                    className="w-full h-full object-cover"
                                                                                />
                                                                            ) : (
                                                                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                                                    <User className="w-6 h-6" />
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex-1 min-w-0">
                                                                            <h3 className="font-bold text-blue-950 uppercase text-sm truncate">{student.name}</h3>
                                                                            <div className="flex flex-wrap items-center gap-x-2 mt-1">
                                                                                <span className="text-[9px] font-bold text-gray-400 uppercase">
                                                                                    {gradeLabel || 'S/G'} {student.schoolClass ? `- TURMA ${student.schoolClass}` : ''}
                                                                                </span>
                                                                                <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                                                                                <span className="text-[9px] font-bold text-orange-600 uppercase">
                                                                                    {getUnitLabel(student.unit)}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="shrink-0 ml-auto">
                                                                            {hasAuth ? (
                                                                                hasAuth.isAuthorized === false ? (
                                                                                    <div className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-full border border-red-100 shadow-sm shadow-red-500/5">
                                                                                        <XCircle className="w-4 h-4 animate-pulse" />
                                                                                        <span className="text-[9px] font-black uppercase tracking-tight">Não Autorizado</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm shadow-emerald-500/5">
                                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                                        <span className="text-[9px] font-black uppercase tracking-tight">Autorizado</span>
                                                                                    </div>
                                                                                )
                                                                            ) : (
                                                                                <div className="flex items-center gap-1.5 bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full border border-orange-100 shadow-sm shadow-orange-500/5">
                                                                                    <AlertTriangle className="w-4 h-4 animate-pulse" />
                                                                                    <span className="text-[9px] font-black uppercase tracking-tight">Pendente</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </>
                            )}

                            {activeTab === 'demands' && (
                                <div className="space-y-4 pt-4">
                                    {userUnit === 'all' && (
                                        <div className="relative group px-1">
                                            <select
                                                value={demandsUnitFilter}
                                                onChange={(e) => setDemandsUnitFilter(e.target.value)}
                                                className="w-full px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-2xl text-xs font-bold text-blue-950 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/10 cursor-pointer transition-all"
                                            >
                                                <option value="">Filtrar Unidade (Todas)</option>
                                                {SCHOOL_UNITS_LIST.map(u => (
                                                    <option key={u} value={u}>{UNIT_LABELS[u as any] || u}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <ChevronDown className="w-4 h-4 text-blue-400" />
                                            </div>
                                        </div>
                                    )}
                                    {demands.length === 0 ? (
                                        <div className="p-16 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 mt-4">
                                            <CalendarDays className="w-12 h-12 mx-auto text-orange-200 mb-4" />
                                            <h3 className="text-sm font-black text-orange-900 uppercase tracking-tight">Nenhuma solicitação no momento</h3>
                                            <p className="text-xs text-gray-400 mt-2 font-medium">As demandas enviadas pelas coordenadoras aparecerão aqui.</p>
                                        </div>
                                    ) : (
                                        demands
                                            .filter(d => demandsUnitFilter ? d.unit === demandsUnitFilter : true)
                                            .map(demand => (
                                                <div key={demand.id} className="p-4 bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h3 className="font-black text-blue-950 uppercase tracking-tight text-sm">
                                                                {getUnitLabel(demand.unit)}
                                                            </h3>
                                                            <p className="text-xs text-gray-500 font-medium">Solicitado por: {demand.coordinatorName}</p>
                                                        </div>
                                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${demand.status === 'confirmed' ? 'bg-blue-950 text-white' :
                                                            demand.status === 'read' ? 'bg-blue-50 text-blue-600' :
                                                                demand.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                                                                    'bg-orange-50 text-orange-600'
                                                            }`}>
                                                            {demand.status === 'confirmed' && 'Confirmado'}
                                                            {demand.status === 'read' && 'Lido'}
                                                            {demand.status === 'cancelled' && 'Cancelado'}
                                                            {demand.status === 'pending' && 'Pendente'}
                                                            {demand.status === 'suggested' && 'Sugerido'}
                                                        </div>
                                                    </div>

                                                    <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                                                        <div className="flex items-start gap-3 mb-4">
                                                            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                                                                <CalendarDays className="w-5 h-5 text-orange-600" />
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-0.5">Data Solicitada</span>
                                                                <span className="text-sm font-black text-blue-950">
                                                                    {demand.date.split('-').reverse().join('/')} às {demand.time}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="bg-white rounded-xl p-3 border border-gray-100 mb-4">
                                                            <p className="text-sm text-gray-700 font-medium leading-relaxed">{demand.reason}</p>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-2 border-t border-gray-200/50 pt-3">
                                                            <div className="flex items-center justify-between text-[10px] font-bold">
                                                                <span className="text-gray-400 uppercase">Postado em:</span>
                                                                <span className="text-blue-950">{new Date(demand.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                            {demand.readAt && (
                                                                <div className="flex items-center justify-between text-[10px] font-bold">
                                                                    <span className="text-blue-400 uppercase">Lido em:</span>
                                                                    <span className="text-blue-950">{new Date(demand.readAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                            )}
                                                            {demand.confirmedAt && (
                                                                <div className="flex items-center justify-between text-[10px] font-bold">
                                                                    <span className="text-blue-950 uppercase opacity-60">Confirmado em:</span>
                                                                    <span className="text-blue-950">{new Date(demand.confirmedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {demand.status !== 'cancelled' && demand.status !== 'confirmed' && (
                                                        <div className="flex gap-2">
                                                            {(demand.status === 'pending' || demand.status === 'read') && (
                                                                <>
                                                                    {demand.status === 'pending' && (
                                                                        <button
                                                                            onClick={() => handleUpdateDemandStatus(demand.id, 'read')}
                                                                            className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                                                                        >
                                                                            Lido
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleUpdateDemandStatus(demand.id, 'confirmed')}
                                                                        className="flex-1 py-2.5 bg-blue-950 hover:bg-blue-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                                                                    >
                                                                        Confirmar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setSuggestionForm({ demandId: demand.id, date: demand.date, time: demand.time })}
                                                                        className="flex-1 py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                                                                    >
                                                                        Sugerir Data
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}

                                                    {suggestionForm?.demandId === demand.id && (
                                                        <div className="mt-4 p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                                                            <h4 className="text-xs font-black text-orange-800 uppercase mb-3">Sugerir novo horário</h4>
                                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-orange-600 uppercase block mb-1">Nova Data</label>
                                                                    <input
                                                                        type="date"
                                                                        value={suggestionForm.date}
                                                                        onChange={e => setSuggestionForm({ ...suggestionForm, date: e.target.value })}
                                                                        className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 text-sm font-bold text-blue-950 outline-none focus:ring-2 focus:ring-orange-500/20"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-orange-600 uppercase block mb-1">Nova Hora</label>
                                                                    <input
                                                                        type="time"
                                                                        value={suggestionForm.time}
                                                                        onChange={e => setSuggestionForm({ ...suggestionForm, time: e.target.value })}
                                                                        className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 text-sm font-bold text-blue-950 outline-none focus:ring-2 focus:ring-orange-500/20"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => setSuggestionForm(null)}
                                                                    className="flex-1 py-2 text-xs font-bold text-gray-500 uppercase hover:bg-white rounded-xl transition-colors"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                                <button
                                                                    onClick={() => handleSuggestDateTime(demand.id, suggestionForm.date, suggestionForm.time)}
                                                                    className="flex-1 py-2 bg-orange-600 text-white text-xs font-bold uppercase rounded-xl shadow-sm hover:bg-orange-700 transition-colors"
                                                                >
                                                                    Enviar Sugestão
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {demand.status === 'suggested' && (
                                                        <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                                            <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Sua sugestão enviada:</p>
                                                            <p className="text-xs font-black text-blue-950">
                                                                {demand.suggestedDate?.split('-').reverse().join('/')} às {demand.suggestedTime}
                                                            </p>
                                                            <p className="text-[9px] text-blue-400 font-medium mt-1 italic">Aguardando resposta da coordenação...</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
