import React, { useState, useMemo, useEffect } from 'react';
import { db, storage } from '../firebaseConfig';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { Camera, Image as ImageIcon, Video, Trash2, AlertCircle, Info, ChevronLeft, ChevronRight, CheckCircle, X, Download, Pencil } from 'lucide-react';
import { Teacher, SchoolUnit, SchoolShift, SchoolClass, TeacherMedia, SHIFT_LABELS } from '../types';
import { normalizeShift, normalizeClass, parseGradeLevel, resolveGradeId } from '../utils/academicUtils';
import { getFullSubjectLabel } from '../utils/subjectUtils';
import { SCHOOL_CLASSES_LIST } from '../constants';
import { Button } from './Button';

interface TeacherMediaGalleryProps {
    teacher: Teacher;
    academicGrades: any[];
    loadingAcademic: boolean;
    activeUnit: SchoolUnit;
}

export const TeacherMediaGallery: React.FC<TeacherMediaGalleryProps> = ({
    teacher,
    academicGrades,
    loadingAcademic,
    activeUnit
}) => {
    const [filterGrade, setFilterGrade] = useState('');
    const [filterClass, setFilterClass] = useState<SchoolClass>(SchoolClass.A);
    const [filterShift, setFilterShift] = useState<SchoolShift | ''>('');
    const [dateFilter, setDateFilter] = useState(new Date().toLocaleDateString('en-CA'));
    const [albumTitle, setAlbumTitle] = useState('');
    const [albumSubjectId, setAlbumSubjectId] = useState('');
    
    const [mediaList, setMediaList] = useState<TeacherMedia[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadType, setUploadType] = useState<'image' | 'video' | null>(null);

    // Media Viewer State
    const [viewingMedia, setViewingMedia] = useState<TeacherMedia | null>(null);
    const [viewingIndex, setViewingIndex] = useState(0);
    const [viewingItems, setViewingItems] = useState<TeacherMedia[]>([]);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    // Initial Filter Setup
    useEffect(() => {
        if (teacher.gradeIds?.length === 1) {
            setFilterGrade(teacher.gradeIds[0]);
        } else if (teacher.gradeLevels?.length === 1) {
            setFilterGrade(resolveGradeId(teacher.gradeLevels[0]) || '');
        }
        
        if (teacher.shift) setFilterShift(teacher.shift as SchoolShift);
    }, [teacher]);

    const filteredGrades = useMemo(() => {
        if (!teacher.gradeIds?.length) return [];
        return academicGrades.filter(g => teacher.gradeIds?.includes(g.id) && g.isActive);
    }, [academicGrades, teacher.gradeIds]);

    const availableShifts = useMemo(() => {
        const shifts = new Set<SchoolShift>();
        if (teacher.assignments?.length) {
            teacher.assignments.forEach(a => shifts.add(a.shift as SchoolShift));
        } else if (teacher.shift) {
            shifts.add(teacher.shift as SchoolShift);
        }
        return Array.from(shifts);
    }, [teacher.assignments, teacher.shift]);

    const availableSubjects = useMemo(() => {
        const subjects = new Set<string>();
        
        // 1. Considerar as disciplinas do cadastro base do professor
        if (teacher.subjects) {
            teacher.subjects.forEach(s => subjects.add(s as string));
        }

        // 2. Considerar as disciplinas das atribuições específicas (se houver)
        if (teacher.assignments && filterGrade) {
            let assignments = teacher.assignments.filter(a => a.gradeLevel === filterGrade || a.gradeId === filterGrade);
            if (filterShift) {
                assignments = assignments.filter(a => a.shift === filterShift);
            }
            assignments.forEach(a => {
                if (a.subjects) {
                    a.subjects.forEach(s => subjects.add(s as string));
                }
            });
        }
        
        // 3. Fallback para Educação Infantil (se não houver nenhuma outra disciplina)
        if (filterGrade && parseGradeLevel(filterGrade).segmentId === 'seg_infantil' && subjects.size === 0) {
            subjects.add('general_early_childhood');
        }
        
        const list = Array.from(subjects);
        if (list.length === 1 && !albumSubjectId) {
            setAlbumSubjectId(list[0]);
        }
        return list;
    }, [teacher, filterGrade, filterShift]);

    const cleanupExpiredMedia = async () => {
        try {
            const now = new Date().toISOString();
            const expiredSnapshot = await db.collection('teacher_media')
                .where('teacherId', '==', teacher.id)
                .where('expiresAt', '<', now)
                .get();
            
            if (expiredSnapshot.empty) return;

            const batch = db.batch();
            for (const doc of expiredSnapshot.docs) {
                const data = doc.data() as TeacherMedia;
                batch.delete(doc.ref);
                try {
                    const storageRef = ref(storage, data.url);
                    await deleteObject(storageRef);
                } catch (e) {
                    console.warn("Field to delete from storage during cleanup:", data.url);
                }
            }
            await batch.commit();
            console.log(`Cleaned up ${expiredSnapshot.size} expired media items.`);
        } catch (error) {
            console.error("Cleanup error:", error);
        }
    };

    const fetchMedia = async () => {
        if (!filterGrade || !filterShift) return;
        setIsLoading(true);
        try {
            await cleanupExpiredMedia(); // Clean up before fetching
            
            let query = db.collection('teacher_media')
                .where('unit', '==', activeUnit)
                .where('gradeLevel', '==', filterGrade)
                .where('schoolClass', '==', filterClass)
                .where('shift', '==', filterShift);

            if (dateFilter) {
                // Filtro por data específica
                const startOfDay = new Date(dateFilter + 'T00:00:00').toISOString();
                const endOfDay = new Date(dateFilter + 'T23:59:59').toISOString();
                query = query.where('timestamp', '>=', startOfDay).where('timestamp', '<=', endOfDay);
            }

            const snapshot = await query.orderBy('timestamp', 'desc').get();
            
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherMedia));
            setMediaList(docs);
        } catch (error) {
            console.error("Error fetching media:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const groupedMedia = useMemo(() => {
        const groups: { [key: string]: TeacherMedia[] } = {};
        mediaList.forEach(item => {
            const album = item.albumTitle || 'Geral';
            if (!groups[album]) groups[album] = [];
            groups[album].push(item);
        });
        return groups;
    }, [mediaList]);


    useEffect(() => {
        fetchMedia();
    }, [filterGrade, filterClass, filterShift, activeUnit, dateFilter]);

    const checkLimits = async (type: 'image' | 'video') => {
        const today = new Date().toLocaleDateString('en-CA');
        const snapshot = await db.collection('teacher_media')
            .where('teacherId', '==', teacher.id)
            .where('gradeLevel', '==', filterGrade)
            .where('date', '==', today)
            .where('type', '==', type)
            .get();
        
        const limit = type === 'video' ? 1 : 5;
        return snapshot.size < limit;
    };

    const processImage = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const max_size = 1200;
                    
                    if (width > height) {
                        if (width > max_size) {
                            height *= max_size / width;
                            width = max_size;
                        }
                    } else {
                        if (height > max_size) {
                            width *= max_size / height;
                            height = max_size;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Canvas to Blob failed'));
                    }, 'image/jpeg', 0.7);
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const checkVideoDuration = (file: File): Promise<number> => {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                resolve(video.duration);
            };
            video.src = URL.createObjectURL(file);
        });
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, useCamera = false) => {
        const file = e.target.files?.[0];
        if (!file || !filterGrade || !filterShift) return;

        if (!albumTitle.trim()) {
            alert('Por favor, informe o título do álbum antes de anexar uma mídia.');
            return;
        }

        if (!albumSubjectId) {
            alert('Por favor, selecione a disciplina deste álbum.');
            return;
        }

        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const type = isImage ? 'image' : 'video';

        if (!isImage && !isVideo) {
            alert("Tipo de arquivo não suportado.");
            return;
        }

        const withinLimits = await checkLimits(type);
        if (!withinLimits) {
            alert(`Limite diário atingido para esta série: ${type === 'video' ? '1 vídeo' : '5 imagens'}.`);
            return;
        }

        if (isVideo) {
            const duration = await checkVideoDuration(file);
            if (duration > 61) { // 1 minute buffer
                alert("O vídeo deve ter no máximo 1 minuto de duração.");
                return;
            }
            if (file.size > 50 * 1024 * 1024) { // 50MB limit
                alert("O arquivo de vídeo é muito grande. Tente reduzir a resolução.");
                return;
            }
        }

        setUploading(true);
        setUploadType(type);
        setUploadProgress(0);

        try {
            let blobToUpload: Blob | File = file;
            if (isImage) {
                blobToUpload = await processImage(file);
            }

            const timestamp = Date.now();
            const extension = isImage ? 'jpg' : (file.name.split('.').pop() || 'mp4');
            const storagePath = `teacher_media/${activeUnit}/${filterGrade}/${type}/${timestamp}_${teacher.id}.${extension}`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, blobToUpload);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                    reject,
                    async () => {
                        const url = await getDownloadURL(uploadTask.snapshot.ref);
                        const today = new Date().toLocaleDateString('en-CA');
                        const expiresAt = new Date();
                        expiresAt.setDate(expiresAt.getDate() + 7);

                        const newMedia: Omit<TeacherMedia, 'id'> = {
                            teacherId: teacher.id,
                            teacherName: teacher.name,
                            unit: activeUnit,
                            gradeLevel: filterGrade,
                            schoolClass: filterClass,
                            shift: filterShift,
                            type,
                            url,
                            filename: `${timestamp}.${extension}`,
                            timestamp: new Date().toISOString(),
                            date: today,
                            subjectId: albumSubjectId || 'disc_musica',
                            albumTitle: albumTitle.trim() || 'Álbum Geral',
                            expiresAt: expiresAt.toISOString()
                        };

                        await db.collection('teacher_media').add(newMedia);
                        resolve();
                    }
                );
            });

            alert("Mídia postada com sucesso!");
            fetchMedia();
        } catch (error) {
            console.error("Upload error:", error);
            alert("Erro ao realizar upload.");
        } finally {
            setUploading(false);
            setUploadType(null);
            setUploadProgress(0);
            e.target.value = '';
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

    const handleEditAlbum = (item: TeacherMedia) => {
        setAlbumTitle(item.albumTitle || '');
        setAlbumSubjectId(item.subjectId || '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (item: TeacherMedia) => {
        if (!window.confirm("Deseja realmente excluir esta mídia?")) return;
        try {
            await db.collection('teacher_media').doc(item.id).delete();
            // Optional: delete from storage too
            const storageRef = ref(storage, item.url);
            // Ignore storage delete errors if file missing
            try { await deleteObject(storageRef); } catch(e) {}
            setMediaList(prev => prev.filter(m => m.id !== item.id));
        } catch (error) {
            alert("Erro ao excluir.");
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4 mb-2">
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <svg className="w-8 h-8 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-blue-950">Galeria de Mídia</h2>
                        <p className="text-gray-500 text-sm font-medium">Compartilhe momentos da disciplina de música</p>
                    </div>
                </div>
                <div className="mt-4 flex items-start gap-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                    <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] space-y-1 text-blue-900">
                        <p className="font-bold">Informações Importantes:</p>
                        <p>• Os arquivos ficarão disponíveis para download por <strong>7 dias</strong> e serão excluídos automaticamente.</p>
                        <p>• Limite diário por série: <strong>1 vídeo</strong> (max 1min) e <strong>5 imagens</strong>.</p>
                        <p>• Fotos e vídeos são processados para garantir melhor performance e economia de dados.</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    Configurações de Postagem
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Série</label>
                        <select 
                            value={filterGrade} 
                            onChange={(e) => setFilterGrade(e.target.value)}
                            className="w-full p-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-900 transition-all font-bold text-gray-700"
                        >
                            <option value="">Selecione a Série</option>
                            {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Turma</label>
                        <select 
                            value={filterClass} 
                            onChange={(e) => setFilterClass(e.target.value as SchoolClass)}
                            className="w-full p-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-900 transition-all font-bold text-gray-700"
                        >
                            {SCHOOL_CLASSES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Turno</label>
                        <select 
                            value={filterShift} 
                            onChange={(e) => setFilterShift(e.target.value as SchoolShift)}
                            className="w-full p-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-900 transition-all font-bold text-gray-700"
                        >
                            <option value="">Selecione o Turno</option>
                            {availableShifts.map(s => (
                                <option key={s} value={s}>{SHIFT_LABELS[s]}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Filtrar por Data</label>
                        <div className="relative">
                            <input 
                                type="date" 
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="w-full p-3 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-900 transition-all font-bold text-gray-700 cursor-pointer"
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

                {filterGrade && filterShift && (
                    <div className="mt-6 p-4 bg-blue-50/30 rounded-xl border border-blue-100 flex flex-col md:flex-row gap-4">
                         <div className="flex-1">
                            <label className="block text-xs font-black text-blue-900 uppercase tracking-widest mb-2">Disciplina da Mídia</label>
                            <select 
                                value={albumSubjectId} 
                                onChange={(e) => setAlbumSubjectId(e.target.value)}
                                className="w-full p-3 bg-white border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-900 transition-all font-bold text-gray-700"
                            >
                                <option value="">Selecione a Disciplina...</option>
                                {availableSubjects.map(sub => (
                                    <option key={sub} value={sub}>{getFullSubjectLabel(sub)}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-[2]">
                            <label className="block text-xs font-black text-blue-900 uppercase tracking-widest mb-2">Título do Álbum</label>
                            <input 
                                type="text"
                                value={albumTitle}
                                onChange={(e) => setAlbumTitle(e.target.value)}
                                placeholder="Ex: Apresentação Dia das Mães, Atividade Prática 01..."
                                className="w-full p-3 bg-white border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-900 transition-all font-bold text-gray-700 placeholder:font-normal"
                            />
                        </div>
                    </div>
                )}

                {filterGrade && filterShift && (
                    <div className="mt-8 pt-8 border-t border-gray-100 flex flex-wrap gap-4">
                        <div className="relative group flex-1 min-w-[150px]">
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment"
                                onChange={(e) => handleUpload(e, true)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={uploading}
                            />
                            <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl group-hover:bg-blue-50/50 group-hover:border-blue-300 transition-all">
                                <Camera className="w-8 h-8 text-blue-900 mb-2" />
                                <span className="text-sm font-bold text-blue-950">Tirar Foto</span>
                            </div>
                        </div>

                        <div className="relative group flex-1 min-w-[150px]">
                            <input 
                                type="file" 
                                accept="image/jpeg,image/png" 
                                onChange={(e) => handleUpload(e)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={uploading}
                            />
                            <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl group-hover:bg-blue-50/50 group-hover:border-blue-300 transition-all">
                                <ImageIcon className="w-8 h-8 text-blue-900 mb-2" />
                                <span className="text-sm font-bold text-blue-950">Anexar Imagem</span>
                            </div>
                        </div>

                        <div className="relative group flex-1 min-w-[150px]">
                            <input 
                                type="file" 
                                accept="video/mp4,video/quicktime" 
                                onChange={(e) => handleUpload(e)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={uploading}
                            />
                            <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-dashed border-gray-200 rounded-2xl group-hover:bg-blue-50/50 group-hover:border-blue-300 transition-all">
                                <Video className="w-8 h-8 text-blue-900 mb-2" />
                                <span className="text-sm font-bold text-blue-950">Postar Vídeo</span>
                            </div>
                        </div>
                    </div>
                )}

                {uploading && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Enviando {uploadType === 'image' ? 'Imagem' : 'Vídeo'}...</span>
                            <span className="text-sm font-bold text-blue-900">{Math.round(uploadProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div className="bg-blue-900 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-800">Mídias Recentes</h3>
                    <Button variant="secondary" onClick={fetchMedia} className="text-xs px-4">Atualizar</Button>
                </div>

                {!filterGrade || !filterShift ? (
                    <div className="text-center py-12 text-gray-400">
                        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium italic">Selecione uma série e turno para visualizar a galeria.</p>
                    </div>
                ) : isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                        {[1,2,3,4].map(i => <div key={i} className="aspect-square bg-gray-100 rounded-xl"></div>)}
                    </div>
                ) : mediaList.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h4 className="font-bold text-gray-400">Nenhuma postagem encontrada</h4>
                        <p className="text-xs text-gray-400">Para esta turma e filtros selecionados.</p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {(Object.entries(groupedMedia) as [string, TeacherMedia[]][]).map(([albumTitle, items]) => (
                            <div key={albumTitle} className="space-y-6">
                                <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center text-white shadow-sm">
                                            <ImageIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-blue-950 tracking-tight">{albumTitle}</h4>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{items.length} {items.length === 1 ? 'Mídia' : 'Mídias'}</p>
                                        </div>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => handleEditAlbum(items[0])}
                                        className="gap-2 border-blue-200 text-blue-900 hover:bg-blue-50 font-black text-xs uppercase tracking-widest px-6"
                                    >
                                        <Pencil className="w-4 h-4" />
                                        Editar Álbum
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {items.map(item => (
                                        <div key={item.id} className="group relative bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all">
                                            <div className="aspect-video relative overflow-hidden bg-black">
                                                {item.type === 'image' ? (
                                                    <img src={item.url} alt={item.filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <video src={item.url} className="w-full h-full object-cover" />
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                    <button 
                                                        onClick={() => openViewer(item, items)}
                                                        className="p-4 bg-white rounded-full text-blue-900 hover:scale-110 transition-transform shadow-lg"
                                                        title="Visualizar"
                                                    >
                                                        <ImageIcon className="w-6 h-6" />
                                                    </button>
                                                    <button onClick={() => handleDelete(item)} className="p-4 bg-white rounded-full text-red-600 hover:scale-110 transition-transform shadow-lg">
                                                        <Trash2 className="w-6 h-6" />
                                                    </button>
                                                </div>
                                                <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-wider">
                                                    {item.type === 'image' ? 'Imagem' : 'Vídeo'}
                                                </div>
                                            </div>
                                            <div className="p-4 flex flex-col gap-2">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] font-black text-gray-400 tracking-wider uppercase">{item.schoolClass} • {SHIFT_LABELS[item.shift as SchoolShift]}</span>
                                                        <span className="text-[9px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded">Expira em {new Date(item.expiresAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 block">Postado em {new Date(item.timestamp).toLocaleDateString()} às {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

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
                                <div className="hidden sm:flex w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center text-blue-900 border border-blue-100 shrink-0">
                                    {viewingMedia.type === 'image' ? <ImageIcon className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                                </div>
                                <div className="text-center sm:text-left flex-1">
                                    <p className="text-gray-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest leading-none mb-1 opacity-70">Álbum: {viewingMedia.albumTitle || 'Geral'}</p>
                                    <p className="text-gray-950 font-black text-sm sm:text-base leading-tight">Mídia {viewingIndex + 1} de {viewingItems.length}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto">
                                <Button 
                                    onClick={() => handleDelete(viewingMedia)}
                                    className="flex-1 sm:flex-none p-4 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all shadow-sm border-none active:scale-95"
                                    title="Excluir Mídia"
                                >
                                    <Trash2 className="w-6 h-6" />
                                </Button>
                                <Button 
                                    onClick={() => setViewingMedia(null)}
                                    className="flex-1 sm:flex-none p-4 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all border-2 border-gray-900 active:scale-95"
                                    title="Fechar"
                                >
                                    <X className="w-6 h-6" />
                                </Button>
                                <Button 
                                    onClick={() => handleDownload(viewingMedia.url, viewingMedia.filename)}
                                    className="flex-1 sm:flex-none p-4 bg-blue-950 text-white rounded-2xl hover:bg-blue-900 transition-all border-2 border-blue-950 active:scale-95"
                                    title="Baixar Mídia"
                                >
                                    <Download className="w-6 h-6" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
