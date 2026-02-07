import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Button } from './Button';
import { Input } from './Input';
import { Search, QrCode, UserCheck, Clock, ShieldAlert, LogOut, ChevronRight, Loader2, Home, ArrowLeft, Bell, ChevronUp, User } from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { UNIT_LABELS, SchoolUnit } from '../types';

interface AuthorizedRelease {
    id: string;
    studentId: string;
    studentName: string;
    coordinatorName: string;
    timestamp: string;
    status: 'pending' | 'released' | 'expired';
    unit: string;
}

export const GatekeeperDashboard: React.FC = () => {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'menu' | 'scanner' | 'manual' | 'list'>('menu');
    const [releases, setReleases] = useState<AuthorizedRelease[]>([]);
    const [scanning, setScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [unit, setUnit] = useState(localStorage.getItem('userUnit') || '');
    const gatekeeperName = localStorage.getItem('gatekeeperName') || 'Portaria';
    const [showNotifications, setShowNotifications] = useState(false); // Placeholder for uniformity

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

        return () => unsubscribe();
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
                alert("Aluno não encontrado nesta unidade.");
                return;
            }

            setSelectedStudent({ id: finalId, ...studentData });

            const release = releases.find(r => r.studentId === finalId || r.studentId === studentId);
            if (release) {
                if (confirm(`LIBERAÇÃO ENCONTRADA!\n\nAluno: ${studentData.name}\nAutorizado por: ${release.coordinatorName}\n\nConfirmar saída agora?`)) {
                    await handleRelease(release.id);
                }
            } else {
                alert(`ALERTA: Aluno ${studentData.name} não possui autorização de saída para este momento.`);
            }
        } catch (error) {
            console.error("Verification error:", error);
            alert("Erro ao verificar aluno.");
        } finally {
            setLoading(false);
        }
    }, [unit, releases]);

    const onScanSuccess = useCallback(async (decodedText: string) => {
        const studentId = decodedText.trim();
        handleVerifyStudent(studentId);
    }, [handleVerifyStudent]);

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
            alert("Erro ao realizar busca. Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    const handleRelease = async (releaseId: string) => {
        try {
            const ref = doc(db, 'authorized_releases', releaseId);
            await updateDoc(ref, {
                status: 'released',
                releasedAt: new Date().toISOString(),
                gatekeeperName: gatekeeperName
            });
            alert("Saída confirmada com sucesso!");
            setSelectedStudent(null);
            // Optionally redirect back to menu or scanner?
            // setActiveTab('menu'); 
        } catch (error) {
            console.error(error);
            alert("Erro ao confirmar saída.");
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
            <div className={`w-full bg-white md:rounded-3xl rounded-none shadow-2xl overflow-hidden relative min-h-screen md:min-h-[600px] flex flex-col transition-all duration-500 ease-in-out max-w-2xl`}>

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

                            {/* Placeholder filler if needed, or maybe History */}
                            <div className="flex flex-col items-center justify-center p-6 bg-gray-50 border border-gray-100 rounded-xl border-dashed opacity-60 aspect-square">
                                <ShieldAlert className="w-8 h-8 text-gray-300 mb-2" />
                                <span className="text-xs font-bold text-gray-400 uppercase text-center">Área Segura</span>
                            </div>

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
                                                    </p>
                                                </div>
                                                <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                                                    {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <Button
                                                onClick={() => handleRelease(r.id)}
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
        </div>
    );
};
