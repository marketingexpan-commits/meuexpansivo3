import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Button } from './Button';
import { Input } from './Input';
import { SchoolLogo } from './SchoolLogo';
import { SchoolCalendar } from './SchoolCalendar';
import { UNIT_LABELS, SchoolUnit, CalendarEvent, AcademicSubject, SHIFT_LABELS, SchoolShift } from '../types';
import {
    Search,
    QrCode,
    UserCheck,
    Clock,
    ShieldAlert,
    LogOut,
    ChevronRight,
    Loader2,
    Home,
    ArrowLeft,
    Bell,
    ChevronUp,
    User,
    CheckCircle,
    CalendarDays,
    Calendar as CalendarIcon,
    Package,
    Camera,
    Trash2,
    Plus
} from 'lucide-react';
import { useLostAndFound } from '../hooks/useLostAndFound';
import { Dialog } from './Dialog';

interface AuthorizedRelease {
    id: string;
    studentId: string;
    studentName: string;
    coordinatorName: string;
    timestamp: string;
    status: 'pending' | 'released' | 'expired';
    unit: string;
    linkedAccessRecordId?: string;
    studentPhoto?: string;
    gradeLevel?: string;
    schoolClass?: string;
    shift?: string;
}

// --- SUB-COMPONENT: LOST AND FOUND ---
const LostFoundView: React.FC<{ unit: SchoolUnit }> = ({ unit }) => {
    const { items, loading: hookLoading, addItem, uploadPhoto } = useLostAndFound(unit);
    const [showAddForm, setShowAddForm] = useState(false);
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const [dialogConfig, setDialogConfig] = useState<{
        isOpen: boolean;
        type: 'alert' | 'confirm';
        title: string;
        message: string;
        image?: string;
        onConfirm?: () => void;
        variant?: 'success' | 'danger' | 'warning' | 'info';
    }>({ isOpen: false, type: 'alert', title: '', message: '' });

    const showDialog = (config: Omit<typeof dialogConfig, 'isOpen'>) => {
        setDialogConfig({ ...config, isOpen: true });
    };

    const closeDialog = () => setDialogConfig(prev => ({ ...prev, isOpen: false }));

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhoto(file);
            const reader = new FileReader();
            reader.onloadend = () => setPhotoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description || !location) return;

        setUploading(true);
        try {
            let photoUrl = '';
            if (photo) {
                photoUrl = await uploadPhoto(photo);
            }

            await addItem({
                unit,
                description,
                locationFound: location,
                createdBy: 'doorman',
                photoUrl
            });

            setDescription('');
            setLocation('');
            setPhoto(null);
            setPhotoPreview(null);
            setShowAddForm(false);
            showDialog({
                type: 'alert',
                title: 'Sucesso',
                message: 'Item cadastrado com sucesso!',
                variant: 'success'
            });
        } catch (error) {
            console.error("Erro ao salvar item:", error);
            showDialog({
                type: 'alert',
                title: 'Erro',
                message: 'Não foi possível salvar o item. Verifique sua conexão.',
                variant: 'danger'
            });
        } finally {
            setUploading(false);
        }
    };

    if (hookLoading && items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-blue-950 animate-spin mb-4" />
                <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Carregando itens...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300 pb-20">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-blue-950 uppercase tracking-tight">Achados e Perdidos</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-0.5">Gestão de itens na portaria</p>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 bg-blue-950 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-950/20 hover:bg-black transition-all active:scale-95"
                >
                    {showAddForm ? <ArrowLeft className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showAddForm ? 'Voltar' : 'Novo Item'}
                </button>
            </div>

            {showAddForm ? (
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xl max-w-xl mx-auto">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 ml-1 tracking-widest">O que foi encontrado?</label>
                            <Input
                                placeholder="Ex: Casaco amarelo, Lancheira do Batman..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="h-12 bg-gray-50 border-gray-200 rounded-xl font-bold"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 ml-1 tracking-widest">Onde foi encontrado?</label>
                            <Input
                                placeholder="Ex: Pátio, Quadra, Refeitório..."
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="h-12 bg-gray-50 border-gray-200 rounded-xl font-bold"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1.5 ml-1 tracking-widest">Foto do Item</label>
                            <div className="relative group">
                                {photoPreview ? (
                                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-blue-950/10">
                                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                                            className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full text-red-600 shadow-lg hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full aspect-video rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-blue-50/50 hover:border-blue-950/20 transition-all cursor-pointer group">
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                                            <Camera className="w-6 h-6 text-blue-950" />
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 uppercase">Tirar foto / Upload</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={handlePhotoChange}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={uploading}
                            className="w-full h-14 bg-blue-950 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-950/20 hover:bg-black transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                        >
                            {uploading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Salvando...</span>
                                </div>
                            ) : 'Cadastrar Item'}
                        </button>
                    </form>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => {
                        const isDelivered = item.status === 'delivered';
                        return (
                            <div
                                key={item.id}
                                className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md ${isDelivered ? 'opacity-50 grayscale blur-[1px]' : ''}`}
                            >
                                <div className="aspect-square bg-gray-100 relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                                    {item.photoUrl ? (
                                        <img src={item.photoUrl} alt={item.description} className="w-full h-full object-cover" />
                                    ) : (
                                        <Package className="w-12 h-12 text-gray-300" />
                                    )}
                                    <div className="absolute top-3 right-3">
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md shadow-sm tracking-widest ${item.status === 'active' ? 'bg-blue-950 text-white' :
                                            item.status === 'claimed' ? 'bg-orange-500 text-white' :
                                                'bg-green-600 text-white'
                                            }`}>
                                            {item.status === 'active' ? 'Ativo' :
                                                item.status === 'claimed' ? 'Reivindicado' :
                                                    'Entregue'}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 space-y-2">
                                    <h4 className="font-black text-blue-950 text-sm leading-tight uppercase tracking-tight line-clamp-2">{item.description}</h4>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <Search className="w-3 h-3" />
                                            <span className="text-[10px] font-bold uppercase">{item.locationFound}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-400 border-t border-gray-50 pt-1">
                                            <Clock className="w-3 h-3" />
                                            <span className="text-[10px] font-bold uppercase">
                                                Postado: {new Date(item.timestamp).toLocaleDateString()} às {new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        {isDelivered && item.deliveredAt && (
                                            <div className="flex items-center gap-2 text-green-600">
                                                <CheckCircle className="w-3 h-3" />
                                                <span className="text-[10px] font-bold uppercase">
                                                    Entregue: {new Date(item.deliveredAt).toLocaleDateString()} às {new Date(item.deliveredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {(item.status === 'claimed' || item.status === 'delivered') && (
                                        <div className={`p-2.5 rounded-xl border mt-2 transition-colors ${item.status === 'delivered'
                                                ? 'bg-gray-50 border-gray-100'
                                                : 'bg-orange-50 border-orange-100'
                                            }`}>
                                            <div className={`flex items-center gap-2 mb-1 ${item.status === 'delivered' ? 'text-gray-500' : 'text-orange-600'
                                                }`}>
                                                <User className="w-3 h-3" />
                                                <span className="text-[9px] font-black uppercase">
                                                    {item.status === 'delivered' ? 'Entregue para:' : 'Reivindicado p/:'}
                                                </span>
                                            </div>
                                            <p className={`text-xs font-bold truncate ${item.status === 'delivered' ? 'text-gray-600' : 'text-gray-700'
                                                }`}>
                                                {item.claimedByStudentName}
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                                                {item.claimedByStudentGrade && (
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${item.status === 'delivered'
                                                            ? 'text-gray-600 bg-gray-200/50'
                                                            : 'text-orange-700 bg-orange-100/50'
                                                        }`}>
                                                        {item.claimedByStudentGrade}
                                                    </span>
                                                )}
                                                {(item.claimedByStudentClass || item.claimedByStudentShift) && (
                                                    <span className={`text-[9px] font-bold border-l pl-2 uppercase ${item.status === 'delivered'
                                                            ? 'text-gray-400 border-gray-200'
                                                            : 'text-orange-600/70 border-orange-200'
                                                        }`}>
                                                        {item.claimedByStudentClass && `Turma ${item.claimedByStudentClass}`}
                                                        {item.claimedByStudentClass && item.claimedByStudentShift && ' | '}
                                                        {item.claimedByStudentShift && (SHIFT_LABELS[item.claimedByStudentShift as SchoolShift] || item.claimedByStudentShift)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {items.length === 0 && (
                        <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <Package className="w-8 h-8 text-gray-200" />
                            </div>
                            <h3 className="text-gray-400 font-black uppercase tracking-widest">Nada por aqui</h3>
                            <p className="text-[10px] text-gray-300 font-bold uppercase mt-1">Nenhum item registrado recentemente</p>
                        </div>
                    )}
                </div>
            )}
            {dialogConfig.isOpen && (
                <Dialog
                    {...dialogConfig}
                    onConfirm={() => {
                        closeDialog();
                        dialogConfig.onConfirm?.();
                    }}
                    onCancel={closeDialog}
                />
            )}
        </div>
    );
};

export const GatekeeperDashboard: React.FC = () => {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'menu' | 'scanner' | 'manual' | 'list' | 'calendar' | 'lost_found'>('menu');
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [academicSubjects, setAcademicSubjects] = useState<AcademicSubject[]>([]);
    const [releases, setReleases] = useState<AuthorizedRelease[]>([]);

    const [scanning, setScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const isProcessingRef = useRef(false); // Lock to prevent multiple scans
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [unit, setUnit] = useState(localStorage.getItem('userUnit') || '');
    const gatekeeperName = localStorage.getItem('gatekeeperName') || 'Portaria';
    const [showNotifications, setShowNotifications] = useState(false); // Placeholder for uniformity
    const [dialogConfig, setDialogConfig] = useState<{
        isOpen: boolean;
        type: 'alert' | 'confirm';
        title: string;
        message: string;
        image?: string;
        onConfirm?: () => void;
        onCancel?: () => void;
        variant?: 'success' | 'danger' | 'warning' | 'info';
    }>({ isOpen: false, type: 'alert', title: '', message: '' });

    const showDialog = (config: Omit<typeof dialogConfig, 'isOpen'>) => {
        setDialogConfig({ ...config, isOpen: true });
    };

    const closeDialog = () => setDialogConfig(prev => ({ ...prev, isOpen: false }));

    // --- EFFECTS ---
    useEffect(() => {
        // Redirect to login if no session data found
        const savedUnit = localStorage.getItem('userUnit');
        const savedName = localStorage.getItem('gatekeeperName');

        if (!savedUnit || !savedName) {
            console.warn("Session missing, redirecting to login...");
            window.location.href = '/';
            return;
        }

        if (unit !== savedUnit) setUnit(savedUnit);
    }, []);

    useEffect(() => {
        if (!unit) return;

        const q = query(
            collection(db, 'authorized_releases'),
            where('unit', '==', unit),
            where('status', '==', 'pending')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as AuthorizedRelease[];
            setReleases(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        });

        // Fetch School Calendar Events
        const eventsRef = collection(db, 'calendar_events');
        const unsubscribeEvents = onSnapshot(eventsRef, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent));
            setCalendarEvents(list);
        });

        // Fetch Academic Subjects
        const subjectsRef = collection(db, 'academic_subjects');
        const unsubscribeSubjects = onSnapshot(subjectsRef, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicSubject));
            setAcademicSubjects(list);
        });

        return () => {
            unsubscribe();
            unsubscribeEvents();
            unsubscribeSubjects();
        };
    }, [unit]);


    const onScanFailure = useCallback((error: any) => {
        // Ignored
    }, []);

    const handleVerifyStudent = useCallback(async (studentId: string) => {
        if (!unit) return;
        setLoading(true);
        try {
            let studentData: any = null;
            let finalId = studentId;

            // 1. Try direct ID lookup
            const studentRef = doc(db, 'students', studentId);
            const studentSnap = await getDoc(studentRef);

            if (studentSnap.exists()) {
                const data = studentSnap.data();
                // STRICT CHECK: Must be same unit
                if (data.unit === unit) {
                    studentData = data;
                }
            }

            // 2. If not found or unit mismatch, try code lookup WITHIN unit
            if (!studentData) {
                const qCode = query(
                    collection(db, 'students'),
                    where('unit', '==', unit),
                    where('code', '==', studentId.trim())
                );
                const snapCode = await getDocs(qCode);
                if (!snapCode.empty) {
                    finalId = snapCode.docs[0].id;
                    studentData = snapCode.docs[0].data();
                }
            }

            if (!studentData) {
                setLoading(false);
                showDialog({
                    type: 'alert',
                    title: 'Atenção',
                    message: "Aluno não encontrado nesta unidade."
                });
                return;
            }

            setSelectedStudent({ id: finalId, ...studentData });

            const release = releases.find(r => r.studentId === finalId || r.studentId === studentId);
            setLoading(false);
            if (release) {
                showDialog({
                    type: 'confirm',
                    title: 'LIBERAÇÃO ENCONTRADA!',
                    message: `Aluno: ${studentData.name}\nAutorizado por: ${release.coordinatorName}\n\nConfirmar saída agora?`,
                    image: studentData.photoUrl,
                    onConfirm: () => handleRelease(release.id)
                });
            } else {
                showDialog({
                    type: 'alert',
                    title: 'ALERTA',
                    message: `Aluno ${studentData.name} não possui autorização de saída para este momento.`
                });
            }
        } catch (error) {
            console.error("Verification error:", error);
            showDialog({
                type: 'alert',
                title: 'Erro',
                message: "Erro ao verificar aluno."
            });
        } finally {
            setLoading(false);
        }
    }, [unit, releases]);

    const onScanSuccess = useCallback(async (decodedText: string) => {
        if (isProcessingRef.current) return;

        isProcessingRef.current = true;

        // Pause to prevent multiple reads
        if (scannerRef.current?.isScanning) {
            try {
                scannerRef.current.pause(true);
            } catch (e) { console.warn("Could not pause scanner", e); }
        }

        const studentId = decodedText.trim();
        await handleVerifyStudent(studentId);

        // Resume after processing
        // We might not want to resume if we switched tabs or released successfully, 
        // but typically for continuous scanning we do. 
        // However, if we just released, maybe we want to stay paused until the user is ready? 
        // For now, let's resume to allow next student.

        // Small delay to prevent accidental double-scan of same code if user hasn't moved it
        setTimeout(() => {
            if (scannerRef.current && activeTab === 'scanner') {
                try {
                    scannerRef.current.resume();
                } catch (e) {
                    // If resume fails (e.g. was stopped), ignore
                    console.log("Scanner resume skipped/failed", e);
                }
            }
            isProcessingRef.current = false;
        }, 1500);

    }, [handleVerifyStudent, activeTab]);

    useEffect(() => {
        if (activeTab === 'scanner') {
            const startScanner = async () => {
                try {
                    // Small delay to ensure the DOM element 'reader' is mounted
                    const html5QrCode = new Html5Qrcode("reader");
                    scannerRef.current = html5QrCode;

                    await html5QrCode.start(
                        { facingMode: "environment" },
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                        },
                        onScanSuccess,
                        onScanFailure
                    );
                    setScanning(true);
                } catch (err) {
                    console.error("Erro ao iniciar scanner:", err);
                    setScanning(false);
                }
            };

            const timer = setTimeout(startScanner, 300);

            return () => {
                clearTimeout(timer);
                if (scannerRef.current) {
                    if (scannerRef.current.isScanning) {
                        scannerRef.current.stop().catch(err => console.error("Erro ao parar scanner:", err));
                    }
                    scannerRef.current = null;
                    setScanning(false);
                }
            };
        } else {
            // Cleanup when leaving scanner tab
            if (scannerRef.current) {
                if (scannerRef.current.isScanning) {
                    scannerRef.current.stop().catch(err => console.error("Erro ao parar scanner:", err));
                }
                scannerRef.current = null;
                setScanning(false);
            }
        }
    }, [activeTab, onScanSuccess, onScanFailure]);

    const handleManualSearch = async () => {
        const queryText = searchQuery.trim();
        if (!queryText || !unit) return;

        setLoading(true);
        try {
            // 1. Try search by CODE within Unit (Strict)
            const qCode = query(
                collection(db, 'students'),
                where('unit', '==', unit),
                where('code', '==', queryText)
            );
            const snapCode = await getDocs(qCode);
            let results = snapCode.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 2. If no code match, search by NAME within Unit (Strict)
            if (results.length === 0) {
                const upperQuery = queryText.toUpperCase();
                const qName = query(
                    collection(db, 'students'),
                    where('unit', '==', unit),
                    where('name', '>=', upperQuery),
                    where('name', '<=', upperQuery + '\uf8ff')
                );
                const snapName = await getDocs(qName);
                results = snapName.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            setSearchResults(results);
        } catch (error) {
            console.error("Search error:", error);
            // Minimal fallback: check results already in memory (fuzzy search local)
            setSearchResults([]);
            showDialog({
                type: 'alert',
                title: 'Erro na Busca',
                message: "Não foi possível realizar a busca. Verifique sua conexão."
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRelease = async (releaseId: string) => {
        try {
            const release = releases.find(r => r.id === releaseId);
            const now = new Date().toISOString();

            const ref = doc(db, 'authorized_releases', releaseId);
            await updateDoc(ref, {
                status: 'released',
                releasedAt: now,
                gatekeeperName: gatekeeperName
            });

            // Update linked Access Record if exists
            if (release?.linkedAccessRecordId) {
                const accessRef = doc(db, 'accessRecords', release.linkedAccessRecordId);
                await updateDoc(accessRef, {
                    exitTime: now,
                    gatekeeperName: gatekeeperName
                });
            }

            // --- NOTIFICATION FIX: Notify student that departure happened ---
            if (release) {
                const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                const notifRef = doc(db, 'notifications', notifId);

                // Format time for a friendly message
                const timeStr = new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                await setDoc(notifRef, {
                    id: notifId,
                    studentId: release.studentId,
                    title: "Saída Confirmada",
                    message: `Sua saída da escola foi confirmada agora às ${timeStr}.`,
                    timestamp: now,
                    read: false
                });
            }
            // -----------------------------------------------------------------

            // -----------------------------------------------------------------

            showDialog({
                type: 'alert',
                title: 'Sucesso',
                message: "Saída confirmada com sucesso!"
            });
            setSelectedStudent(null);
            // Optionally redirect back to menu or scanner?
            // setActiveTab('menu'); 
        } catch (error) {
            console.error(error);
            showDialog({
                type: 'alert',
                title: 'Erro',
                message: "Erro ao confirmar saída."
            });
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('userUnit');
        localStorage.removeItem('gatekeeperName');
        localStorage.removeItem('gatekeeperId');
        window.location.href = '/';
    };

    return (
        <div className="min-h-screen bg-gray-100 flex justify-center md:items-center md:py-8 md:px-4 p-0 font-sans transition-all duration-500 ease-in-out">
            {/* Professional Dialog Modal moved to end */}
            <div className={`w-full bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col transition-all duration-500 ease-in-out ${(activeTab === 'calendar' || activeTab === 'lost_found') ? 'max-w-5xl' : 'max-w-2xl'}`}>

                {/* MAIN CONTENT */}
                <main className="flex-1 w-full p-4 md:p-8 bg-gray-50/50 overflow-y-auto">

                    {/* Welcome Card / Header */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
                        {/* Top Bar */}
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                            <div className="flex items-center gap-2 text-base text-gray-600">
                                {activeTab !== 'menu' && (
                                    <button
                                        onClick={() => setActiveTab('menu')}
                                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-600 -ml-1 mr-1"
                                        title="Voltar ao Menu"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                )}
                                <span className="font-bold text-gray-800">{gatekeeperName}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                <span className="text-gray-500">{UNIT_LABELS[unit as SchoolUnit] || unit}</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    className="p-2 text-gray-400 hover:text-blue-950 hover:bg-blue-50 transition-colors relative rounded-full"
                                    title="Notificações"
                                >
                                    <Bell className="w-5 h-5" />
                                </button>
                                <Button
                                    variant="secondary"
                                    onClick={handleLogout}
                                    className="text-sm font-semibold py-1.5 px-4"
                                >
                                    Sair
                                </Button>
                            </div>
                        </div>

                        {/* Logo & Description */}
                        <div className="flex flex-col items-start text-left">
                            {activeTab === 'menu' && (
                                <div className="flex items-center gap-2 mt-4 mb-6 pl-1">
                                    <div className="h-10 w-auto shrink-0">
                                        <SchoolLogo className="!h-full w-auto" />
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <span className="text-[9px] text-orange-600 font-bold uppercase tracking-[0.15em] leading-none mb-1">Aplicativo</span>
                                        <h1 className="text-lg font-bold text-blue-950 tracking-tight leading-none">Meu Expansivo</h1>
                                        <span className="text-[9px] text-blue-950/60 font-bold uppercase tracking-wider leading-none mt-1">Portal da Portaria</span>
                                    </div>
                                </div>
                            )}
                            <p className="text-gray-600 max-w-lg">
                                {activeTab === 'menu'
                                    ? "Selecione uma opção para gerenciar o controle de acesso e saídas da unidade."
                                    : activeTab === 'scanner'
                                        ? "Aponte a câmera para o QR Code do aluno para verificar a autorização."
                                        : activeTab === 'manual'
                                            ? "Busque o aluno pelo nome para verificar autorizações manualmente."
                                            : activeTab === 'list'
                                                ? "Visualize as saídas autorizadas pela coordenação que aguardam liberação."
                                                : activeTab === 'calendar'
                                                    ? "Acompanhe o calendário escolar, feriados e eventos da unidade."
                                                    : activeTab === 'lost_found'
                                                        ? "Gerencie os itens achados e perdidos na unidade escolar."
                                                        : ""
                                }
                            </p>
                        </div>
                    </div>

                    {/* MENU GRID */}
                    {activeTab === 'menu' && (
                        <div className="grid grid-cols-2 gap-4 mb-8 animate-fade-in-up">
                            <button
                                onClick={() => setActiveTab('scanner')}
                                className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                            >
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                    <QrCode className="w-6 h-6 text-blue-950" />
                                </div>
                                <h3 className="font-bold text-gray-800 text-base text-center">Leitor QR</h3>
                            </button>

                            <button
                                onClick={() => setActiveTab('manual')}
                                className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                            >
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                    <Search className="w-6 h-6 text-blue-950" />
                                </div>
                                <h3 className="font-bold text-gray-800 text-base text-center">Busca Manual</h3>
                            </button>

                            <button
                                onClick={() => setActiveTab('list')}
                                className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square relative"
                            >
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                                    <Clock className="w-6 h-6 text-blue-950" />
                                </div>
                                <h3 className="font-bold text-gray-800 text-base text-center">Fila de Saída</h3>
                                {releases.length > 0 && (
                                    <span className="absolute top-4 right-4 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-pulse">
                                        {releases.length}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setActiveTab('calendar')}
                                className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                            >
                                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                    <CalendarIcon className="w-6 h-6 text-blue-950" />
                                </div>
                                <h3 className="font-bold text-gray-800 text-sm text-center leading-tight">Calendário Escolar</h3>
                            </button>

                            <button
                                onClick={() => setActiveTab('lost_found')}
                                className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-950 hover:shadow-md transition-all group aspect-square"
                            >
                                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                                    <Package className="w-6 h-6 text-blue-950" />
                                </div>
                                <h3 className="font-bold text-gray-800 text-sm text-center leading-tight">Achados e Perdidos</h3>
                            </button>


                        </div>
                    )}

                    {/* SCANNER VIEW */}
                    {activeTab === 'scanner' && (
                        <div className="animate-in fade-in zoom-in-95 duration-300">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col items-center">
                                <h3 className="text-sm font-bold text-gray-800 mb-6 uppercase tracking-wider flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    Aponte para o QR Code
                                </h3>
                                {/* Container styling for the scanner */}
                                <div className="rounded-2xl overflow-hidden bg-gray-100 border-2 border-gray-200 aspect-square relative w-full max-w-[300px]">
                                    <div id="reader" className="w-full h-full"></div>
                                    <div className="absolute inset-0 border-[30px] border-slate-900/5 pointer-events-none rounded-2xl"></div>
                                </div>
                                <p className="mt-6 text-xs text-gray-400 font-medium text-center">
                                    Mantenha o código centralizado na moldura.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* MANUAL SEARCH VIEW */}
                    {activeTab === 'manual' && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                            <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 mb-4 flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <Input
                                        placeholder="Digite o nome do aluno..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="border-none bg-transparent h-12 pl-10 text-gray-900 placeholder:text-gray-400 font-medium focus:ring-0"
                                    />
                                </div>
                                <button
                                    onClick={handleManualSearch}
                                    disabled={loading}
                                    className="w-12 h-12 rounded-xl bg-blue-50 text-blue-950 flex items-center justify-center shadow-sm hover:bg-blue-100 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-6 h-6" />}
                                </button>
                            </div>

                            <div className="space-y-3">
                                {searchResults.map(s => (
                                    <div
                                        key={s.id}
                                        onClick={() => handleVerifyStudent(s.id)}
                                        className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between active:scale-95 transition-all cursor-pointer hover:border-blue-950/20 group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-black text-blue-950 text-lg group-hover:bg-blue-50 transition-colors">
                                                {s.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-900 leading-tight mb-1">{s.name}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md uppercase tracking-wide">
                                                        {s.gradeLevel}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                        {s.schoolClass}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-950 transition-colors" />
                                    </div>
                                ))}
                                {searchResults.length === 0 && searchQuery && !loading && (
                                    <div className="text-center py-10 text-gray-400">
                                        <p className="text-sm">Nenhum aluno encontrado</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* LIST VIEW (Queue) */}
                    {activeTab === 'list' && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                            {releases.length === 0 ? (
                                <div className="text-center py-20 opacity-50 select-none flex flex-col items-center">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-300">
                                        <Clock className="w-8 h-8" />
                                    </div>
                                    <p className="font-bold text-gray-400 uppercase tracking-wide text-sm">Fila vazia</p>
                                    <p className="text-xs text-gray-300 mt-1">Nenhuma autorização pendente</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {releases.map(r => (
                                        <div key={r.id} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm border-l-4 border-l-blue-950 relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-4 relative z-10">
                                                <div>
                                                    <h4 className="text-base font-bold text-gray-900 leading-tight">{r.studentName}</h4>
                                                    <p className="text-[10px] font-bold text-blue-950/70 uppercase mt-1 flex items-center gap-1">
                                                        <UserCheck className="w-3 h-3" />
                                                        Autorizado por {r.coordinatorName}
                                                        {(r.gradeLevel || r.schoolClass || r.shift) && (
                                                            <span className="ml-1 text-orange-600">
                                                                • {r.gradeLevel} {r.schoolClass} {r.shift === 'shift_morning' ? '(MAT)' : r.shift === 'shift_afternoon' ? '(VESP)' : ''}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                                                    {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <Button
                                                onClick={async () => {
                                                    let photoToDisplay = r.studentPhoto;

                                                    // If missing (older record), try a quick fetch
                                                    if (!photoToDisplay) {
                                                        try {
                                                            const studentDoc = await getDoc(doc(db, 'students', r.studentId));
                                                            if (studentDoc.exists()) {
                                                                photoToDisplay = studentDoc.data().photoUrl;
                                                            }
                                                        } catch (e) {
                                                            console.error("Erro ao buscar foto:", e);
                                                        }
                                                    }

                                                    showDialog({
                                                        type: 'confirm',
                                                        title: 'Confirmar Liberação',
                                                        message: `Deseja confirmar a saída de ${r.studentName}?`,
                                                        image: photoToDisplay,
                                                        onConfirm: () => handleRelease(r.id)
                                                    });
                                                }}
                                                className="w-full bg-blue-950 hover:bg-black text-white font-bold uppercase text-xs tracking-wider py-3.5 rounded-xl shadow-lg shadow-blue-950/10 active:scale-95 transition-all"
                                            >
                                                Confirmar Saída
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* CALENDAR VIEW */}
                    {activeTab === 'calendar' && (
                        <SchoolCalendar events={calendarEvents} academicSubjects={academicSubjects} />
                    )}

                    {/* LOST AND FOUND VIEW */}
                    {activeTab === 'lost_found' && (
                        <LostFoundView unit={unit as SchoolUnit} />
                    )}

                </main>

                {/* LOADING OVERLAY */}
                {loading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in rounded-3xl">
                        <div className="text-center">
                            <Loader2 className="w-10 h-10 text-blue-950 animate-spin mx-auto mb-4" />
                            <p className="font-bold uppercase tracking-wider text-blue-950 text-xs">Processando...</p>
                        </div>
                    </div>
                )}

            </div>

            {dialogConfig.isOpen && (
                <Dialog
                    {...dialogConfig}
                    onConfirm={() => {
                        closeDialog();
                        dialogConfig.onConfirm?.();
                    }}
                    onCancel={closeDialog}
                />
            )}
        </div>
    );
};
