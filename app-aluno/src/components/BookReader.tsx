import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Loader2, Maximize2, Minimize2, Volume2, Play, Pause, Award } from 'lucide-react';
import { db } from '../firebaseConfig';
import confetti from 'canvas-confetti';
import BookCertificate from './BookCertificate';
import { UNIT_LABELS, SHIFT_LABELS } from '../types';

interface BookReaderProps {
    bookId: string;
    student: any;
    onBack: () => void;
}

type FlipState = 'idle' | 'flipping-next' | 'flipping-prev';

const BookReader: React.FC<BookReaderProps> = ({ bookId, student, onBack }) => {
    const studentId = student.id;
    const studentName = student.name;
    const [book, setBook] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isDualPage, setIsDualPage] = useState(window.innerWidth >= 1024);
    const [dimensions, setDimensions] = useState({ width: 350, height: 500 });

    const [spreadIndex, setSpreadIndex] = useState(0);
    const [flipState, setFlipState] = useState<FlipState>('idle');
    const [isAnimating, setIsAnimating] = useState(false);
    const [backLayerReady, setBackLayerReady] = useState(false);
    const [showCertificate, setShowCertificate] = useState(false);
    const pendingSpread = useRef<number>(0);
    const initialSaveDone = useRef(false);

    const [answeredState, setAnsweredState] = useState<Record<number, number>>({});
    const [pagesRead, setPagesRead] = useState<Set<number>>(new Set([0])); // Start with cover
    const [isCompleted, setIsCompleted] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [playingPage, setPlayingPage] = useState<number | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const handleAudioPlay = (pageIdx: number, url: string) => {
        if (playingPage === pageIdx) {
            audioRef.current?.pause();
            setPlayingPage(null);
            return;
        }

        if (audioRef.current) {
            audioRef.current.pause();
        }

        const audio = new Audio(url);
        audioRef.current = audio;
        setPlayingPage(pageIdx);
        audio.play();
        audio.onended = () => setPlayingPage(null);
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            setPlayingPage(null);
        }
    };

    const handleAnswerClick = (pageIdx: number, selectedOpt: number, correctOpt: number) => {
        setAnsweredState(prev => ({ ...prev, [pageIdx]: selectedOpt }));
        if (selectedOpt === correctOpt) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#f97316', '#3b82f6', '#10b981', '#fcd34d'],
                zIndex: 9999
            });
        }
    };

    // Longer duration for a more cinematic, natural feel
    const FLIP_DURATION = 900; // ms

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            setIsDualPage(width >= 1024);
            const availableHeight = height - 120;
            const availableWidth = width - (width > 768 ? 220 : 40);
            let h = availableHeight * 0.85;
            let w = h * 0.73;
            if (width >= 1024) {
                if (w * 2 > availableWidth) { w = availableWidth / 2; h = w / 0.73; }
            } else {
                if (w > availableWidth) { w = availableWidth; h = w / 0.73; }
            }
            setDimensions({ width: Math.round(w), height: Math.round(h) });
        };
        handleResize();
        window.addEventListener('resize', handleResize);

        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        document.documentElement.requestFullscreen?.().catch(() => {});

        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('fullscreenchange', handleFsChange);
        };
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Book
                const docRef = await db.collection('e_books').doc(bookId).get();
                if (docRef.exists) {
                    const bookData = { id: docRef.id, ...docRef.data() };
                    setBook(bookData);
                }

                // 2. Fetch Progress
                const progressRef = await db.collection('ebook_progress').doc(`${studentId}_${bookId}`).get();
                if (progressRef.exists) {
                    const data = progressRef.data();
                    if (data?.answeredState) setAnsweredState(data.answeredState);
                    if (data?.pagesRead) setPagesRead(new Set(data.pagesRead));
                    if (data?.lastSpreadIndex !== undefined) setSpreadIndex(data.lastSpreadIndex);
                    if (data?.completed) setIsCompleted(true);
                }
            } catch (e) { 
                console.error("Erro ao carregar dados do livro/progresso:", e); 
            } finally { 
                setIsLoading(false); 
            }
        };
        fetchData();
    }, [bookId, studentId]);

    // Save Progress Auto-sync
    useEffect(() => {
        if (!book || isLoading) return;

        const saveProgress = async () => {
            setIsSaving(true);
            try {
                const totalPages = (book.coverUrl ? 1 : 0) + (book.pages?.length || 0);
                const quizPages = (book.pages || []).filter((p: any) => p.type === 'activity').length;
                
                const readCount = pagesRead.size;
                const answeredCount = Object.keys(answeredState).length;
                
                // Completion logic: All pages seen AND all quiz pages answered
                const completed = readCount >= totalPages && answeredCount >= quizPages;

                await db.collection('ebook_progress').doc(`${studentId}_${bookId}`).set({
                    studentId,
                    bookId,
                    bookTitle: book.title,
                    pagesRead: Array.from(pagesRead),
                    answeredState,
                    lastSpreadIndex: spreadIndex,
                    progressPercent: Math.round((readCount / totalPages) * 100),
                    completed,
                    updatedAt: new Date(),
                    completedAt: completed && !isCompleted ? new Date() : (isCompleted ? new Date() : null)
                }, { merge: true });

                if (completed && !isCompleted) {
                    setIsCompleted(true);
                    confetti({
                        particleCount: 150,
                        spread: 100,
                        origin: { y: 0.5 },
                        colors: ['#3b82f6', '#1d4ed8', '#f8fafc']
                    });
                }
            } catch (e) {
                console.error("Erro ao salvar progresso:", e);
            } finally {
                setIsSaving(false);
            }
        };

        const timeoutId = setTimeout(saveProgress, initialSaveDone.current ? 800 : 0); 
        initialSaveDone.current = true;
        return () => clearTimeout(timeoutId);
    }, [pagesRead, answeredState, spreadIndex, book, studentId, isLoading]);

    // Update pages read when flipping
    useEffect(() => {
        if (!isLoading && book) {
            const [left, right] = getPagesForSpread(spreadIndex);
            setPagesRead(prev => {
                const next = new Set(prev);
                if (left !== null) next.add(left);
                if (right !== null) next.add(right);
                return next;
            });
        }
    }, [spreadIndex, isLoading, isDualPage]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(e => alert(e.message));
        } else {
            document.exitFullscreen?.();
        }
    };

    if (isLoading) return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-orange-500 mb-4" size={48} />
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Carregando livro...</p>
        </div>
    );

    if (!book) return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center">
            <p className="text-gray-500 mb-4">Livro não encontrado.</p>
            <button onClick={onBack} className="px-6 py-2 bg-blue-900 text-white rounded-xl font-bold">Voltar</button>
        </div>
    );

    const rawPages: any[] = book.pages || [];
    const pages: any[] = book.coverUrl ? [{ imageUrl: book.coverUrl, isCover: true }, ...rawPages] : rawPages;
    const totalPages = pages.length;

    const totalSpreads = isDualPage
        ? Math.ceil((totalPages - 1) / 2) + 1
        : totalPages;

    const getPagesForSpread = (si: number): [number | null, number | null] => {
        if (!isDualPage) return [si, null];
        if (si === 0) return [null, 0];
        const leftIdx = (si - 1) * 2 + 1;
        const rightIdx = leftIdx + 1;
        return [
            leftIdx < totalPages ? leftIdx : null,
            rightIdx < totalPages ? rightIdx : null
        ];
    };

    const doFlip = (direction: 'next' | 'prev') => {
        if (isAnimating) return;
        stopAudio();
        const next = direction === 'next' ? spreadIndex + 1 : spreadIndex - 1;
        if (next < 0 || next >= totalSpreads) return;
        pendingSpread.current = next;
        setFlipState(direction === 'next' ? 'flipping-next' : 'flipping-prev');
        setIsAnimating(true);
        setBackLayerReady(false);
        setTimeout(() => setBackLayerReady(true), 16);
        setTimeout(() => {
            setSpreadIndex(next);
            setFlipState('idle');
            setIsAnimating(false);
            setBackLayerReady(false);
        }, FLIP_DURATION);
    };

    const [leftPageIdx, rightPageIdx] = getPagesForSpread(spreadIndex);

    const nextSpreadIdx = spreadIndex + 1 < totalSpreads ? spreadIndex + 1 : spreadIndex;
    const prevSpreadIdx = spreadIndex - 1 >= 0 ? spreadIndex - 1 : spreadIndex;
    const [nextLeft, nextRight] = getPagesForSpread(nextSpreadIdx);
    const [prevLeft, prevRight] = getPagesForSpread(prevSpreadIdx);

    const pageStyle: React.CSSProperties = {
        width: dimensions.width,
        height: dimensions.height,
        position: 'absolute',
        top: 0,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
    };

    const getRadius = (isLeft: boolean) => {
        const r = Math.max(8, dimensions.width * 0.045); // e.g., 15px at 350px width
        return isDualPage ? (isLeft ? `${r}px 0 0 ${r}px` : `0 ${r}px ${r}px 0`) : `${r}px`;
    };

    // ── Page renderer with realistic per-page styling ──
    const renderPageImg = (idx: number | null, side?: 'left' | 'right', isFlipping: boolean = false, alt?: string) => {
        if (idx === null || !pages[idx]) return null;
        const isLeft = side === 'left' || (side === undefined && idx % 2 === 1);
        
        // Responsive rounded corners
        const radius = getRadius(isLeft);
        
        // Responsive stacked paper effect
        const s1 = Math.max(1, dimensions.width * 0.006);
        const s2 = Math.max(2, dimensions.width * 0.012);
        const s3 = Math.max(3, dimensions.width * 0.018);
        const dropY = Math.max(3, dimensions.width * 0.01);
        const blur = Math.max(10, dimensions.width * 0.06);
        const dropX = Math.max(5, dimensions.width * 0.035);

        const paperStackShadow = isFlipping 
            ? `0 ${dropY}px ${blur/2}px rgba(0,0,0,0.2)` 
            : isDualPage
                ? (isLeft
                    ? `-${s1}px 1px 0px #fff, -${s2}px 2px 0px #f0f0f0, -${s3}px 3px 0px #e0e0e0, -${dropX}px ${dropY * 3}px ${blur}px rgba(0,0,0,0.25)`
                    : `${s1}px 1px 0px #fff, ${s2}px 2px 0px #f0f0f0, ${s3}px 3px 0px #e0e0e0, ${dropX}px ${dropY * 3}px ${blur}px rgba(0,0,0,0.25)`)
                : `0 ${dropY * 3}px ${blur}px rgba(0,0,0,0.25)`;

        return (
            <div style={{ 
                width: dimensions.width, height: dimensions.height, 
                position: 'relative', borderRadius: radius, 
                boxShadow: paperStackShadow, background: '#f8f5f0'
            }}>
                <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: radius, position: 'relative' }}>
                    {pages[idx]?.imageUrl && (
                        <img
                            src={pages[idx].imageUrl}
                            alt={alt || `Página ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
                        />
                    )}
                    {/* Lighting overlay: Volumetric "inflated" curve effect */}
                    {isDualPage && (
                        isLeft ? (
                            <div style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden', pointerEvents: 'none' }}>
                                {/* Horizontal Curve (Spine to Edge) */}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 6%, transparent 18%, rgba(255,255,255,0.20) 35%, transparent 60%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.25) 100%)' }} />
                                {/* Vertical Curve (Top to Bottom) */}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 8%, transparent 92%, rgba(0,0,0,0.25) 100%)' }} />
                                {/* Paper Edge Highlight */}
                                <div style={{ position: 'absolute', inset: 0, borderRadius: radius, boxShadow: 'inset 2px 0 10px rgba(255,255,255,0.2), inset 0 2px 5px rgba(255,255,255,0.4), inset 0 -2px 5px rgba(0,0,0,0.1)' }} />
                            </div>
                        ) : (
                            <div style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden', pointerEvents: 'none' }}>
                                {/* Horizontal Curve (Spine to Edge) */}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 6%, transparent 18%, rgba(255,255,255,0.20) 35%, transparent 60%, rgba(0,0,0,0.05) 85%, rgba(0,0,0,0.25) 100%)' }} />
                                {/* Vertical Curve (Top to Bottom) */}
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 8%, transparent 92%, rgba(0,0,0,0.25) 100%)' }} />
                                {/* Paper Edge Highlight */}
                                <div style={{ position: 'absolute', inset: 0, borderRadius: radius, boxShadow: 'inset -2px 0 10px rgba(255,255,255,0.2), inset 0 2px 5px rgba(255,255,255,0.4), inset 0 -2px 5px rgba(0,0,0,0.1)' }} />
                            </div>
                        )
                    )}
                    {/* Page number badge (Don't show on cover) */}
                    {!pages[idx]?.isCover && (
                        <div style={{
                            position: 'absolute', bottom: 12,
                            [isLeft ? 'left' : 'right']: 16,
                            background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(4px)',
                            color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: 700,
                            padding: '2px 10px', borderRadius: 20, pointerEvents: 'none',
                            border: '1px solid rgba(255,255,255,0.1)',
                            zIndex: 40
                        }}>{idx}</div>
                    )}

                    {/* Audio Narration Button */}
                    {pages[idx]?.audioUrl && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAudioPlay(idx, pages[idx].audioUrl);
                            }}
                            style={{ zIndex: 100 }}
                            className={`absolute top-4 ${isLeft ? 'left-4' : 'right-4'} p-3 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all transform active:scale-95 flex items-center justify-center ${
                                playingPage === idx 
                                    ? 'bg-orange-500 text-white ring-4 ring-orange-500/20' 
                                    : 'bg-white/95 text-orange-500 hover:bg-white backdrop-blur-md border border-orange-100'
                            }`}
                            title="Ouvir Narração"
                        >
                            {playingPage === idx ? (
                                <div className="flex items-center gap-1">
                                    <Pause size={18} fill="currentColor" />
                                    <span className="text-[8px] font-black uppercase tracking-tighter mr-1">Ouvindo</span>
                                </div>
                            ) : (
                                <Volume2 size={20} />
                            )}
                        </button>
                    )}

                    {/* Interactive Quiz Overlay */}
                    {/* Interactive Quiz Overlay */}
                    {pages[idx]?.type === 'activity' && pages[idx]?.question && (
                        <div 
                            style={{
                                position: 'absolute',
                                left: `${pages[idx].question.position?.x ?? 50}%`,
                                top: `${pages[idx].question.position?.y ?? 50}%`,
                                transform: 'translate(-50%, -50%)',
                            }}
                            className={`w-11/12 max-w-[280px] animate-in zoom-in duration-500 rounded-2xl ${
                                (pages[idx].question.style || 'card') === 'card' 
                                    ? "bg-white/95 backdrop-blur-md p-3 sm:p-4 shadow-xl border border-white/50" 
                                    : (pages[idx].question.style === 'glass')
                                        ? "bg-white/20 backdrop-blur-xl p-3 sm:p-4 shadow-2xl border border-white/40"
                                        : "p-1"
                            }`}
                        >
                            <div className="text-center">
                                <h4 className={`font-bold text-xs sm:text-sm mb-3 text-center leading-snug ${
                                    (pages[idx].question.style || 'card') === 'card'
                                        ? "text-slate-800"
                                        : (pages[idx].question.style === 'glass')
                                            ? "text-white drop-shadow-md"
                                            : "text-slate-900 bg-white/80 backdrop-blur px-3 py-2 rounded-xl inline-block drop-shadow-sm"
                                }`}>
                                    {pages[idx].question.text}
                                </h4>
                            </div>
                            <div className="space-y-2">
                                {pages[idx].question.options.map((opt: string, i: number) => {
                                    if (!opt) return null;
                                    const isAnswered = answeredState[idx] !== undefined;
                                    const isSelected = answeredState[idx] === i;
                                    const isCorrect = i === pages[idx].question.correctIndex;
                                    
                                    let btnClass = "bg-white border-slate-200 text-slate-600 hover:border-orange-500 hover:bg-orange-50";
                                    if (isAnswered) {
                                        if (isSelected) {
                                            btnClass = isCorrect ? "bg-green-500 text-white border-green-600" : "bg-red-500 text-white border-red-600";
                                        } else if (isCorrect) {
                                            btnClass = "bg-green-100 text-green-700 border-green-200";
                                        } else {
                                            btnClass = "bg-slate-50 text-slate-400 border-slate-200 opacity-50";
                                        }
                                    }
                                    
                                    return (
                                        <button 
                                            key={i}
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent page flip if clicked
                                                handleAnswerClick(idx, i, pages[idx].question.correctIndex);
                                            }}
                                            disabled={isAnswered}
                                            className={`w-full p-2 sm:p-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all flex items-center gap-3 ${btnClass} ${isAnswered ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'}`}
                                        >
                                            <span className="w-6 h-6 shrink-0 rounded-full border border-current flex items-center justify-center text-[10px]">
                                                {['A', 'B', 'C'][i]}
                                            </span>
                                            <span className="text-left flex-1">{opt}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const isNext = flipState === 'flipping-next';
    const isPrev = flipState === 'flipping-prev';

    const bookWidth = isDualPage ? dimensions.width * 2 : dimensions.width;
    const isCoverSpread = spreadIndex === 0 && isDualPage;
    const coverOffset = isCoverSpread ? -dimensions.width / 2 : 0;

    // ── Spine shadow: Sharp dark crease mimicking a tightly bound book ──
    const SpineShadow = () => {
        // Responsive spine shadow width based on book dimensions
        const shadowWidth = Math.max(30, dimensions.width * 0.15); 
        const shadowOffset = shadowWidth / 2;
        return (
            <div style={{
                position: 'absolute', top: 0,
                left: dimensions.width - shadowOffset, width: shadowWidth,
                height: dimensions.height, zIndex: 15,
                pointerEvents: 'none',
                background: `linear-gradient(to right,
                    transparent 0%,
                    rgba(0,0,0,0.05) 35%,
                    rgba(0,0,0,0.50) 48%,
                    rgba(0,0,0,0.85) 50%,
                    rgba(0,0,0,0.50) 52%,
                    rgba(0,0,0,0.05) 65%,
                    transparent 100%)`,
            }} />
        );
    };

    // ── Dynamic shadow cast on the static page during the flip ──
    // As the flap rotates, it casts a widening shadow on the opposite page
    const FlipCastShadow = () => {
        // Overlay on the page that the flapping card is moving toward
        // For "next": shadow falls on the left static page; for "prev": on the right
        const shadowSide = isNext ? 0 : dimensions.width;
        const gradDir = isNext ? 'to left' : 'to right';
        return (
            <div style={{
                position: 'absolute', top: 0,
                left: shadowSide, width: dimensions.width,
                height: dimensions.height, zIndex: 18,
                pointerEvents: 'none',
                // Animate shadow width via CSS keyframes (grows as page sweeps over)
                animation: `${isNext ? 'castShadowNext' : 'castShadowPrev'} ${FLIP_DURATION}ms ease-in-out forwards`,
                background: `linear-gradient(${gradDir}, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.18) 35%, transparent 65%)`,
            }} />
        );
    };

    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in overflow-hidden">
            {/* Top Bar */}
            <div className="h-14 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors group">
                        <X size={24} className="text-gray-400 group-hover:text-red-500" />
                    </button>
                    <button onClick={toggleFullscreen} className="p-2 hover:bg-gray-100 rounded-full transition-colors group text-gray-400 hover:text-orange-500" title="Alternar Tela Cheia">
                        {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                    </button>
                </div>
                <div className="flex flex-col items-center flex-1">
                    <span className="text-[10px] font-bold text-blue-900 uppercase tracking-widest flex items-center gap-1">
                        {isSaving ? (
                            <Loader2 size={10} className="animate-spin" />
                        ) : (
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        )}
                        {isCompleted ? 'Leitura Concluída' : 'Lendo agora'}
                    </span>
                    <h4 className="font-bold text-gray-800 text-sm truncate max-w-[150px] sm:max-w-md">{book.title}</h4>
                    
                    {/* Progress Bar */}
                    <div className="w-full max-w-[120px] h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div 
                            className="h-full bg-blue-600 transition-all duration-500"
                            style={{ width: `${Math.round((pagesRead.size / totalPages) * 100)}%` }}
                        />
                    </div>
                </div>
                <div className="w-10 flex justify-end gap-2 pr-4 sm:pr-0">
                    {isCompleted && (
                        <button 
                            onClick={() => setShowCertificate(true)}
                            className="bg-blue-900 text-white p-2 rounded-xl shadow-lg hover:bg-black transition-all transform hover:scale-110 active:scale-95 flex items-center gap-2 group"
                            title="Ver Certificado"
                        >
                            <Award size={20} />
                            <span className="hidden sm:inline font-bold text-xs uppercase tracking-widest">Certificado</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Certificate Modal */}
            {showCertificate && (
                <BookCertificate 
                    studentName={studentName}
                    gradeLevel={student.gradeLevel}
                    schoolClass={student.schoolClass}
                    shift={SHIFT_LABELS[student.shift as keyof typeof SHIFT_LABELS] || student.shift}
                    unit={UNIT_LABELS[student.unit as keyof typeof UNIT_LABELS] || student.unit}
                    bookTitle={book.title}
                    completionDate={new Date()}
                    onClose={() => setShowCertificate(false)}
                />
            )}

            {/* Reader */}
            <div className="flex-1 overflow-hidden relative bg-gray-900 flex items-center justify-center p-4 sm:p-8">
                {totalPages === 0 ? (
                    <div className="text-white bg-gray-800 px-8 py-4 rounded-2xl border border-gray-700">Este livro ainda não possui páginas publicadas.</div>
                ) : (
                    <div className="relative flex items-center justify-center w-full h-full">
                        <div
                            className="flex items-center justify-center relative"
                            style={{ transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)', transform: `translateX(${coverOffset}px)` }}
                        >
                            {/* Prev button */}
                            <button
                                onClick={() => doFlip('prev')}
                                disabled={spreadIndex === 0 || isAnimating}
                                className="absolute left-0 -translate-x-full z-30 p-2 sm:p-4 bg-white/5 hover:bg-white/20 backdrop-blur-sm rounded-l-2xl shadow-2xl border border-white/10 transition-all disabled:opacity-0 group/prev"
                            >
                                <ChevronLeft size={48} className="text-white/30 group-hover/prev:text-white transition-colors" />
                            </button>

                            {/* Book stage */}
                            <div
                                style={{
                                    width: bookWidth,
                                    height: dimensions.height,
                                    position: 'relative',
                                    perspective: dimensions.width * 4,
                                    perspectiveOrigin: '50% 50%',
                                    // Removed stage shadow/background so rounded pages cast their own shadows
                                }}
                            >
                                {/* ── Static back layer (revealed pages) ── */}
                                {isDualPage && (
                                    <>
                                        <div style={{ ...pageStyle, left: 0 }}>
                                            {renderPageImg(isNext && backLayerReady ? nextLeft : isPrev && backLayerReady ? prevLeft : leftPageIdx, 'left', false)}
                                        </div>
                                        <div style={{ ...pageStyle, left: dimensions.width }}>
                                            {renderPageImg(isNext && backLayerReady ? nextRight : isPrev && backLayerReady ? prevRight : rightPageIdx, 'right', false)}
                                        </div>
                                    </>
                                )}
                                {!isDualPage && (
                                    <div style={{ ...pageStyle, left: 0 }}>
                                        {renderPageImg(isNext ? (nextLeft ?? nextRight) : isPrev ? (prevLeft ?? prevRight) : (leftPageIdx ?? rightPageIdx), undefined, false)}
                                    </div>
                                )}

                                {/* ── Dynamic cast shadow during animation ── */}
                                {isAnimating && isDualPage && <FlipCastShadow />}

                                {/* ── Flipping card (animates on top) ── */}
                                {isAnimating && isDualPage && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: isNext ? dimensions.width : 0,
                                        width: dimensions.width,
                                        height: dimensions.height,
                                        transformStyle: 'preserve-3d',
                                        transformOrigin: isNext ? 'left center' : 'right center',
                                        animation: `${isNext ? 'flipNext' : 'flipPrev'} ${FLIP_DURATION}ms cubic-bezier(0.42, 0, 0.35, 1) forwards`,
                                        zIndex: 20,
                                    }}>
                                        {/* Front face: departing page */}
                                        <div style={{ ...pageStyle, left: 0 }}>
                                            {renderPageImg(isNext ? rightPageIdx : leftPageIdx, isNext ? 'right' : 'left', true)}
                                            {/* Progressive shadow on the front face as it turns away */}
                                            <div style={{
                                                position: 'absolute', inset: 0, pointerEvents: 'none',
                                                backgroundColor: 'black', borderRadius: getRadius(!isNext), // matches the front face side
                                                animation: `frontFaceDarken ${FLIP_DURATION}ms ease-in forwards`,
                                            }} />
                                        </div>
                                        {/* Back face: arriving page */}
                                        <div style={{
                                            ...pageStyle, left: 0,
                                            transform: 'rotateY(180deg)',
                                        }}>
                                            {renderPageImg(isNext ? nextLeft : prevRight, isNext ? 'left' : 'right', true)}
                                            {/* Progressive shadow lifting off the back face as it arrives */}
                                            <div style={{
                                                position: 'absolute', inset: 0, pointerEvents: 'none',
                                                backgroundColor: 'black', borderRadius: getRadius(isNext), // matches the back face side
                                                animation: `backFaceLighten ${FLIP_DURATION}ms ease-out forwards`,
                                            }} />
                                        </div>
                                    </div>
                                )}

                                {/* Static front (current spread, idle state) */}
                                {!isAnimating && isDualPage && (
                                    <>
                                        <div style={{ ...pageStyle, left: 0, zIndex: 5 }}>{renderPageImg(leftPageIdx, 'left', false)}</div>
                                        <div style={{ ...pageStyle, left: dimensions.width, zIndex: 5 }}>{renderPageImg(rightPageIdx, 'right', false)}</div>
                                        {/* ── Center spine shadow ── */}
                                        <SpineShadow />
                                    </>
                                )}
                                {!isAnimating && !isDualPage && (
                                    <div style={{ ...pageStyle, left: 0, zIndex: 5 }}>{renderPageImg(leftPageIdx ?? rightPageIdx, undefined, false)}</div>
                                )}
                            </div>

                            {/* Next button */}
                            <button
                                onClick={() => doFlip('next')}
                                disabled={spreadIndex >= totalSpreads - 1 || isAnimating}
                                className="absolute right-0 translate-x-full z-30 p-2 sm:p-4 bg-white/5 hover:bg-white/20 backdrop-blur-sm rounded-r-2xl shadow-2xl border border-white/10 transition-all disabled:opacity-0 group/next"
                            >
                                <ChevronRight size={48} className="text-white/30 group-hover/next:text-white transition-colors" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Keyframe styles */}
            <style>{`
                /* ── Page flip rotation ── */
                @keyframes flipNext {
                    0%   { transform: rotateY(0deg); }
                    100% { transform: rotateY(-180deg); }
                }
                @keyframes flipPrev {
                    0%   { transform: rotateY(0deg); }
                    100% { transform: rotateY(180deg); }
                }

                /* ── Front face darkens as it turns away from viewer ── */
                @keyframes frontFaceDarken {
                    0%   { opacity: 0; }
                    40%  { opacity: 0.35; }
                    100% { opacity: 0.60; }
                }

                /* ── Back face brightens as it arrives toward viewer ── */
                @keyframes backFaceLighten {
                    0%   { opacity: 0.55; }
                    60%  { opacity: 0.25; }
                    100% { opacity: 0; }
                }

                /* ── Shadow cast on the static page during the sweep ── */
                @keyframes castShadowNext {
                    0%   { opacity: 0; }
                    20%  { opacity: 1; }
                    80%  { opacity: 0.6; }
                    100% { opacity: 0; }
                }
                @keyframes castShadowPrev {
                    0%   { opacity: 0; }
                    20%  { opacity: 1; }
                    80%  { opacity: 0.6; }
                    100% { opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default BookReader;
