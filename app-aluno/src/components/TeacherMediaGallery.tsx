import React, { useState, useMemo, useEffect } from 'react';
import { db, storage } from '../firebaseConfig';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { Camera, Image as ImageIcon, Video, Trash2, AlertCircle, Info, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { Teacher, SchoolUnit, SchoolShift, SchoolClass, TeacherMedia, SHIFT_LABELS } from '../types';
import { normalizeShift, normalizeClass, parseGradeLevel, resolveGradeId } from '../utils/academicUtils';
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
    
    const [mediaList, setMediaList] = useState<TeacherMedia[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadType, setUploadType] = useState<'image' | 'video' | null>(null);

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

    const fetchMedia = async () => {
        if (!filterGrade || !filterShift) return;
        setIsLoading(true);
        try {
            await cleanupExpiredMedia(); // Clean up before fetching
            const snapshot = await db.collection('teacher_media')
                .where('unit', '==', activeUnit)
                .where('gradeLevel', '==', filterGrade)
                .where('schoolClass', '==', filterClass)
                .where('shift', '==', filterShift)
                .orderBy('timestamp', 'desc')
                .get();
            
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherMedia));
            setMediaList(docs);
        } catch (error) {
            console.error("Error fetching media:", error);
        } finally {
            setIsLoading(false);
        }
    };

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
                // Delete from Firestore
                batch.delete(doc.ref);
                // Attempt Storage Delete
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

    useEffect(() => {
        fetchMedia();
    }, [filterGrade, filterClass, filterShift, activeUnit]);

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
                            subjectId: 'disc_musica',
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            {availableShifts.map(s => <option key={s} value={s}>{SHIFT_LABELS[s]}</option>)}
                        </select>
                    </div>
                </div>

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {mediaList.map(item => (
                            <div key={item.id} className="group relative bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all">
                                <div className="aspect-video relative overflow-hidden bg-black">
                                    {item.type === 'image' ? (
                                        <img src={item.url} alt={item.filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <video src={item.url} className="w-full h-full object-cover" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-full text-gray-800 hover:scale-110 transition-transform">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                        </a>
                                        <button onClick={() => handleDelete(item)} className="p-2 bg-white rounded-full text-red-600 hover:scale-110 transition-transform">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-wider">
                                        {item.type === 'image' ? 'Imagem' : 'Vídeo'}
                                    </div>
                                </div>
                                <div className="p-4 flex flex-col gap-1">
                                    <div className="flex justify-between items-start">
                                        <span className="text-[10px] font-black text-gray-400 tracking-wider uppercase">{item.schoolClass} • {SHIFT_LABELS[item.shift as SchoolShift]}</span>
                                        <span className="text-[9px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded">Expira em {new Date(item.expiresAt).toLocaleDateString()}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-400">Postado em {new Date(item.timestamp).toLocaleDateString()} às {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
