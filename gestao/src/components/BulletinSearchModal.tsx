import { useState } from 'react';
import { X, Search, Loader2, AlertCircle, FileBarChart, Users, User } from 'lucide-react';
import { useAcademicData } from '../hooks/useAcademicData';
import { Button } from './Button';
import { Input } from './Input';
import { studentService } from '../services/studentService';
import { pedagogicalService } from '../services/pedagogicalService';
import { generateSchoolBulletin, generateBatchSchoolBulletin } from '../utils/bulletinGenerator';
import type { Student } from '../types';
import { SCHOOL_SHIFTS, SCHOOL_CLASSES_OPTIONS } from '../utils/academicDefaults';
import { useSchoolUnits } from '../hooks/useSchoolUnits';
import { getAcademicSettings } from '../services/academicSettings';
import type { AcademicSettings, CalendarEvent } from '../types';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface BulletinSearchModalProps {
    onClose: () => void;
}

type ModalStep = 'SEARCH' | 'CONFIRM';
type SearchType = 'INDIVIDUAL' | 'CLASS';

export function BulletinSearchModal({ onClose }: BulletinSearchModalProps) {
    const { grades: academicGrades, subjects: academicSubjects, loading: loadingAcademic } = useAcademicData();
    const { getUnitById } = useSchoolUnits();
    const [step, setStep] = useState<ModalStep>('SEARCH');
    const [searchType, setSearchType] = useState<SearchType>('INDIVIDUAL');

    // Individual Search State
    const [code, setCode] = useState('');

    // Class Search State
    const [gradeLevel, setGradeLevel] = useState('');
    const [shift, setShift] = useState('');
    const [schoolClass, setSchoolClass] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Results
    const [foundStudents, setFoundStudents] = useState<Student[]>([]); // Array for single or multiple
    const [preparedData, setPreparedData] = useState<any[]>([]); // { student, grades, attendance }
    const [academicSettings, setAcademicSettings] = useState<AcademicSettings | null>(null);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

    const handleSearch = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const allStudents = await studentService.getStudents();
            let results: Student[] = [];

            // Filter by logged user unit using correct mapping
            const userUnitCode = localStorage.getItem('userUnit') || 'Zona Norte';


            // Support both Legacy and New IDs for transition safety
            // If user has 'unit_bs' and student has 'unit_bs' -> Match
            // If user has 'Boa Sorte' and student has 'unit_bs' -> We need a map for that, 
            // BUT the original code was mapping 'unit_bs' -> 'Boa Sorte' which broke the check against 'unit_bs'.

            // We'll trust that after migration, students have technical IDs.
            // If the user's localstorage has technical ID, direct comparison works.
            // If user has legacy in localstorage, we might need to map Legacy -> Tech.

            const legacyToTechCtx: Record<string, string> = {
                'Boa Sorte': 'unit_bs',
                'Zona Norte': 'unit_zn',
                'Extremoz': 'unit_ext',
                'Quintas': 'unit_qui'
            };

            // Normalize user unit to Technical ID if possible
            const normalizedUserUnit = legacyToTechCtx[userUnitCode] || userUnitCode;

            if (searchType === 'INDIVIDUAL') {
                if (!code.trim()) { setError('Digite o código de matrícula'); setIsLoading(false); return; }
                const s = allStudents.find(stu => stu.code?.trim() === code.trim());

                if (s) {
                    if (userUnitCode !== 'admin_geral' && s.unit !== normalizedUserUnit) {
                        setError('Aluno pertence a outra unidade.');
                    } else {
                        results = [s];
                    }
                } else {
                    setError('Nenhum aluno encontrado com este código.');
                }
            } else {
                // Class Search
                if (!gradeLevel || !shift || !schoolClass) { setError('Selecione Série, Turno e Turma.'); setIsLoading(false); return; }

                results = allStudents.filter(s => {
                    const isUnitMatch = (userUnitCode === 'admin_geral' || s.unit === normalizedUserUnit);
                    if (!isUnitMatch) return false;

                    // Grade match logic: Check if DB value INCLUDES the selected value (e.g. "3ª Série - Ens. Médio" includes "3ª Série")
                    const dbGrade = s.gradeLevel || '';
                    const isGradeMatch = dbGrade === gradeLevel || dbGrade.includes(gradeLevel);

                    const isShiftMatch = s.shift === shift;
                    const isClassMatch = s.schoolClass === schoolClass;

                    return isGradeMatch && isShiftMatch && isClassMatch;
                });

                if (results.length === 0) setError('Nenhum aluno encontrado nesta turma.');
            }

            if (results.length > 0) {
                // Fetch data for all found students in parallel (with limit if needed, but for a class ~40 is fine)
                const dataPromises = results.map(async (student) => {
                    const [grades, attendance] = await Promise.all([
                        pedagogicalService.getGrades(student.id),
                        pedagogicalService.getAttendance(student.id, student.unit)
                    ]);
                    return { student, grades, attendance };
                });

                const finalData = await Promise.all(dataPromises);

                // Fetch Academic Settings for the unit
                const unitToFetch = results[0].unit;
                const settings = await getAcademicSettings(2026, unitToFetch);
                setAcademicSettings(settings);

                try {
                    const calendarQuery = query(
                        collection(db, 'calendar_events'),
                        where('units', 'array-contains-any', [unitToFetch, 'all'])
                    );
                    const snap = await getDocs(calendarQuery);
                    const events = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as CalendarEvent));
                    setCalendarEvents(events);
                } catch (e) {
                    console.error("Error fetching calendar events", e);
                }

                setFoundStudents(results);
                setPreparedData(finalData);
                setStep('CONFIRM');
            }

        } catch (err) {
            console.error(err);
            setError('Ocorreu um erro ao buscar os dados.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerate = () => {
        if (preparedData.length === 0) return;

        // Use student's unit to find detail
        const studentUnit = preparedData[0].student.unit;
        const unitDetail = getUnitById(studentUnit);

        if (!unitDetail) {
            alert("Dados da unidade não encontrados. Verifique a gestão de unidades.");
            return;
        }

        try {
            if (preparedData.length === 1) {
                generateSchoolBulletin(preparedData[0].student, preparedData[0].grades, preparedData[0].attendance, unitDetail, academicSubjects, academicSettings, calendarEvents);
            } else {
                generateBatchSchoolBulletin(preparedData, unitDetail, academicSubjects, academicSettings, calendarEvents);
            }
        }
        catch (e) {
            console.error("Error generating bulletin:", e);
            alert("Erro ao gerar. Verifique se o bloqueador de pop-ups está ativo.");
        }
    };


    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={`bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 animate-in zoom-in-95`}>

                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 bg-blue-950/10 text-blue-950 rounded-xl flex items-center justify-center shadow-sm`}>
                            <FileBarChart className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">
                                Emitir Boletim
                            </h2>
                            <p className="text-sm text-slate-500">
                                {step === 'SEARCH' ? 'Selecione o modo de emissão' : (
                                    searchType === 'INDIVIDUAL' ? foundStudents[0]?.name : `Turma: ${gradeLevel} - ${schoolClass}`
                                )}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-xl transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Content - Step 1: Search */}
                {step === 'SEARCH' && (
                    <div className="p-6 space-y-6">

                        {/* Tabs */}
                        <div className="flex p-1 bg-slate-100 rounded-xl">
                            <button
                                onClick={() => setSearchType('INDIVIDUAL')}
                                className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${searchType === 'INDIVIDUAL' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <User className="w-4 h-4" /> Individual
                            </button>
                            <button
                                onClick={() => setSearchType('CLASS')}
                                className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${searchType === 'CLASS' ? 'bg-white text-blue-950 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Users className="w-4 h-4" /> Por Turma
                            </button>
                        </div>

                        <div className="space-y-4">
                            {searchType === 'INDIVIDUAL' ? (
                                <Input
                                    label="Código de Matrícula"
                                    placeholder="Digite o código (ex: 12345)"
                                    value={code}
                                    onChange={(e) => {
                                        setCode(e.target.value);
                                        setError(null);
                                    }}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    autoFocus
                                    className="text-lg py-6"
                                />
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-sm font-semibold text-slate-700">Série/Ano</label>
                                        <select
                                            value={gradeLevel}
                                            onChange={(e) => setGradeLevel(e.target.value)}
                                            className="w-full h-12 rounded-xl border-slate-200 focus:border-blue-950 focus:ring-blue-950"
                                        >
                                            <option value="">Selecione a Série</option>
                                            {loadingAcademic ? (
                                                <option>Carregando...</option>
                                            ) : (
                                                academicGrades.map(g => (
                                                    <option key={g.id} value={g.name}>{g.name}</option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-sm font-semibold text-slate-700">Turno</label>
                                            <select
                                                value={shift}
                                                onChange={(e) => setShift(e.target.value)}
                                                className="w-full h-12 rounded-xl border-slate-200 focus:border-blue-950 focus:ring-blue-950"
                                            >
                                                <option value="">Selecione</option>
                                                {SCHOOL_SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-semibold text-slate-700">Turma</label>
                                            <select
                                                value={schoolClass}
                                                onChange={(e) => setSchoolClass(e.target.value)}
                                                className="w-full h-12 rounded-xl border-slate-200 focus:border-blue-950 focus:ring-blue-950"
                                            >
                                                <option value="">Selecione</option>
                                                {SCHOOL_CLASSES_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm animate-in slide-in-from-top-1">
                                    <AlertCircle className="w-5 h-5" />
                                    <span className="font-medium">{error}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={handleSearch}
                                disabled={isLoading}
                                className="w-full py-7 font-bold text-base shadow-xl shadow-blue-950/20 rounded-xl transition-all"
                            >
                                {isLoading ? (
                                    <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Buscando...</>
                                ) : (
                                    <><Search className="w-5 h-5 mr-3" /> Buscar {searchType === 'INDIVIDUAL' ? 'Aluno' : 'Turma'}</>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Content - Step 2: Confirm */}
                {step === 'CONFIRM' && (
                    <div className="p-8 space-y-6">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600 space-y-4">
                            {searchType === 'INDIVIDUAL' ? (
                                <>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="font-bold">Aluno:</span>
                                        <span className="font-medium text-slate-800">{foundStudents[0]?.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold">Série/Turma:</span>
                                        <span>{foundStudents[0]?.gradeLevel} - {foundStudents[0]?.schoolClass}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center space-y-2">
                                    <div className="bg-blue-950/10 w-12 h-12 mx-auto rounded-xl flex items-center justify-center text-blue-950 mb-3">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <p className="font-medium text-slate-900 text-lg">
                                        {foundStudents.length} {foundStudents.length === 1 ? 'aluno encontrado' : 'alunos encontrados'}
                                    </p>
                                    <p className="text-slate-500">
                                        Turma: {gradeLevel} - {schoolClass} ({shift})
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={handleGenerate}
                                className="w-full py-4 font-bold text-base shadow-lg shadow-blue-900/20 rounded-xl transition-all"
                            >
                                <FileBarChart className="w-5 h-5 mr-2" />
                                {searchType === 'INDIVIDUAL' ? 'Gerar Boletim' : 'Gerar Boletins da Turma'}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setStep('SEARCH');
                                    setFoundStudents([]);
                                    setPreparedData([]);
                                }}
                                className="w-full text-slate-400 hover:text-slate-600 font-semibold"
                            >
                                Voltar / Nova Busca
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
