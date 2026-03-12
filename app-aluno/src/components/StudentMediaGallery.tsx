import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { AlertCircle, Download, ExternalLink, ImageIcon, Play, X, Clock, Info } from 'lucide-react';
import { Student, TeacherMedia } from '../types';
import { Button } from './Button';
import { resolveGradeId, normalizeShift, normalizeClass, normalizeUnit, parseGradeLevel } from '../utils/academicUtils';
import { getFullSubjectLabel } from '../utils/subjectUtils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StudentMediaGalleryProps {
    student: Student;
}

const StudentMediaGallery: React.FC<StudentMediaGalleryProps> = ({ student }) => {
    const [mediaList, setMediaList] = useState<TeacherMedia[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingMedia, setViewingMedia] = useState<TeacherMedia | null>(null);
    const [viewingIndex, setViewingIndex] = useState(0);
    const [viewingItems, setViewingItems] = useState<TeacherMedia[]>([]);
    const [subjectFilter, setSubjectFilter] = useState('');
    const [dateFilter, setDateFilter] = useState(new Date().toLocaleDateString('en-CA')); // Volta ao padrão de hoje
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const fetchMedia = async () => {
        setLoading(true);
        try {
            const now = new Date().toISOString();
            const resolvedGradeId = student.gradeId || resolveGradeId(student.gradeLevel) || student.gradeLevel;

            let query = db.collection('teacher_media')
                .where('unit', '==', normalizeUnit(student.unit))
                .where('gradeLevel', '==', resolvedGradeId)
                .where('schoolClass', '==', normalizeClass(student.schoolClass))
                .where('shift', '==', normalizeShift(student.shift));

            if (dateFilter) {
                // Filtro por data específica (Campo 'date' facilitado)
                query = query.where('date', '==', dateFilter);
            } else {
                // Comportamento padrão: Apenas mídias que ainda não expiraram
                query = query.where('expiresAt', '>', now);
            }

            const snapshot = await query.orderBy('timestamp', 'desc').get();
            
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherMedia));
            setMediaList(docs);
        } catch (error) {
            console.error("Error fetching student media:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Download error:", error);
            window.open(url, '_blank');
        }
    };

    const handlePrev = () => {
        if (!viewingItems.length) return;
        const newIndex = (viewingIndex - 1 + viewingItems.length) % viewingItems.length;
        setViewingIndex(newIndex);
        setViewingMedia(viewingItems[newIndex]);
    };

    const handleNext = () => {
        if (!viewingItems.length) return;
        const newIndex = (viewingIndex + 1) % viewingItems.length;
        setViewingIndex(newIndex);
        setViewingMedia(viewingItems[newIndex]);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe) handleNext();
        if (isRightSwipe) handlePrev();

        setTouchStart(null);
        setTouchEnd(null);
    };

    const openViewer = (item: TeacherMedia, items: TeacherMedia[]) => {
        const index = items.findIndex(m => m.id === item.id);
        setViewingItems(items);
        setViewingIndex(index !== -1 ? index : 0);
        setViewingMedia(item);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!viewingMedia) return;
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'Escape') setViewingMedia(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [viewingMedia, viewingIndex, viewingItems]);

    useEffect(() => {
        fetchMedia();
    }, [student, dateFilter]);

    const availableSubjects = React.useMemo(() => {
        const subjects = new Set<string>();
        mediaList.forEach(m => {
            if (m.subjectId) subjects.add(m.subjectId);
        });
        return Array.from(subjects);
    }, [mediaList]);

    const groupedMedia = React.useMemo(() => {
        const filtered = subjectFilter ? mediaList.filter(m => m.subjectId === subjectFilter) : mediaList;
        const groups: Record<string, TeacherMedia[]> = {};
        filtered.forEach(m => {
            const title = m.albumTitle || 'Álbum Geral';
            if (!groups[title]) groups[title] = [];
            groups[title].push(m);
        });
        return groups;
    }, [mediaList, subjectFilter]);

    return (
        <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 fade-in duration-300 pb-20">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4 mb-2">
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                        <svg className="w-10 h-10 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-blue-950">Galeria de Mídia</h2>
                        <p className="text-gray-500 text-sm font-medium">Momentos Especiais</p>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl text-blue-900 flex gap-4 shadow-sm">
                <div className="bg-blue-100 p-3 rounded-xl h-fit">
                    <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-sm">
                    <p className="font-black uppercase tracking-tight mb-0.5">Aviso de Expiração</p>
                    <p className="opacity-80 font-medium">Os arquivos desta galeria ficam disponíveis para download por apenas <strong>7 dias</strong> após a postagem. Aproveite para baixar seus momentos favoritos!</p>
                </div>
            </div>

            {(availableSubjects.length > 0 || true) && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-2 flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-xs font-black text-blue-900 uppercase tracking-widest mb-2">Filtrar por Disciplina</label>
                        <select 
                            value={subjectFilter} 
                            onChange={(e) => setSubjectFilter(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-900 transition-all font-bold text-gray-700 cursor-pointer"
                        >
                            <option value="">Todas as Disciplinas</option>
                            {availableSubjects.map(sub => (
                                <option key={sub} value={sub}>{getFullSubjectLabel(sub)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-black text-blue-900 uppercase tracking-widest mb-2">Filtrar por Data</label>
                        <div className="relative">
                            <input 
                                type="date" 
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-900 transition-all font-bold text-gray-700 cursor-pointer"
                            />
                            {dateFilter && (
                                <button 
                                    onClick={() => setDateFilter('')}
                                    className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-900 transition-colors"
                                    title="Limpar Data"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="aspect-video bg-gray-100 rounded-2xl animate-pulse"></div>
                    ))}
                </div>
            ) : Object.keys(groupedMedia).length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 shadow-inner">
                    <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <h3 className="text-xl font-bold text-gray-400">Nenhuma postagem encontrada</h3>
                    <p className="text-gray-400 text-sm">Tente limpar os filtros para visualizar as mídias disponíveis.</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {Object.entries(groupedMedia).map(([albumTitle, medias]) => (
                        <div key={albumTitle} className="space-y-6">
                            <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <ImageIcon className="w-5 h-5 text-blue-900" />
                                </div>
                                <h3 className="text-xl font-black text-blue-950">{albumTitle}</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {medias.map(item => (
                                    <div 
                                        key={item.id} 
                                        className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col group"
                                    >
                                        <div className="aspect-video relative overflow-hidden bg-black cursor-pointer" onClick={() => setViewingMedia(item)}>
                                            {item.type === 'image' ? (
                                                <img src={item.url} alt="Media" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                                    <Play className="w-12 h-12 text-white opacity-80 group-hover:scale-125 transition-transform" />
                                                    <video src={item.url} className="w-full h-full object-cover opacity-60" />
                                                </div>
                                            )}
                                            <div className="absolute top-4 left-4">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg ${item.type === 'image' ? 'bg-blue-900/80 text-white' : 'bg-blue-600/80 text-white'}`}>
                                                    {item.type === 'image' ? 'Foto' : 'Vídeo'}
                                                </span>
                                            </div>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                                                <div className="flex gap-2 w-full">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); openViewer(item, medias); }}
                                                        className="flex-1 bg-white hover:bg-gray-50 text-blue-900 border-none rounded-2xl py-4 text-xs font-black shadow-xl uppercase tracking-widest transition-all active:scale-95"
                                                    >
                                                        VISUALIZAR
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-6 flex flex-col gap-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                                                    {parseGradeLevel(item.gradeLevel).grade} - {getFullSubjectLabel(item.subjectId)}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center pt-3 border-t border-gray-50 mt-auto">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Postado em</span>
                                                    <span className="text-[11px] font-bold text-gray-600">{new Date(item.timestamp).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-0.5">Expira em</span>
                                                    <span className="text-[11px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">{new Date(item.expiresAt).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Media Viewer Modal */}
            {viewingMedia && (
                <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
                    <div className="relative max-w-5xl w-full max-h-full flex flex-col items-center gap-2 sm:gap-4">
                        <div 
                            className="relative w-full bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center group/viewer"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            {/* Navigation Arrows (Visible on Desktop) */}
                            {viewingItems.length > 1 && (
                                <>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                                        className="absolute left-4 z-10 p-4 bg-black/40 hover:bg-black/60 rounded-2xl text-white backdrop-blur-md transition-all opacity-0 group-hover/viewer:opacity-100 hidden md:block"
                                    >
                                        <ChevronLeft className="w-8 h-8" />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleNext(); }}
                                        className="absolute right-4 z-10 p-4 bg-black/40 hover:bg-black/60 rounded-2xl text-white backdrop-blur-md transition-all opacity-0 group-hover/viewer:opacity-100 hidden md:block"
                                    >
                                        <ChevronRight className="w-8 h-8" />
                                    </button>
                                </>
                            )}

                            <div className="w-full h-full flex items-center justify-center min-h-[50vh]">
                                {viewingMedia.type === 'image' ? (
                                    <img 
                                        key={viewingMedia.id}
                                        src={viewingMedia.url} 
                                        alt="Preview" 
                                        className="max-w-full max-h-[80vh] object-contain animate-in fade-in zoom-in-95 duration-300" 
                                    />
                                ) : (
                                    <video 
                                        key={viewingMedia.id}
                                        src={viewingMedia.url} 
                                        controls 
                                        autoPlay 
                                        className="max-w-full max-h-[80vh] animate-in fade-in duration-300" 
                                    />
                                )}
                            </div>

                            {/* Pagination Dots */}
                            {viewingItems.length > 1 && (
                                <div className="absolute bottom-4 sm:bottom-6 flex gap-1.5 sm:gap-2">
                                    {viewingItems.map((_, i) => (
                                        <div 
                                            key={i} 
                                            className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${i === viewingIndex ? 'w-6 sm:w-8 bg-white' : 'w-1.5 sm:w-2 bg-white/20'}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                                          <div className="w-full bg-white p-4 sm:p-6 rounded-3xl shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                                <div className="hidden sm:flex w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center shrink-0">
                                    <svg className="w-6 h-6 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                </div>
                                <div className="text-center sm:text-left flex-1">
                                    <p className="text-gray-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-70">Álbum: {viewingMedia.albumTitle || 'Geral'}</p>
                                    <p className="text-gray-950 font-black text-sm sm:text-base leading-tight">Mídia {viewingIndex + 1} de {viewingItems.length}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-3 w-full sm:w-auto">
                                <Button 
                                    onClick={() => handleDownload(viewingMedia.url, viewingMedia.filename)}
                                    className="flex-1 sm:flex-none p-4 bg-blue-950 text-white rounded-2xl hover:bg-blue-900 transition-all border-2 border-blue-950 shadow-sm active:scale-95"
                                    title="Baixar Mídia"
                                >
                                    <Download className="w-6 h-6 mx-auto" />
                                </Button>
                                <Button 
                                    onClick={() => setViewingMedia(null)}
                                    className="flex-1 sm:flex-none p-4 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all border-2 border-gray-900 shadow-sm active:scale-95"
                                    title="Fechar"
                                >
                                    <X className="w-6 h-6 mx-auto" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentMediaGallery;
