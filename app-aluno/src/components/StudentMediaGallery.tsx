import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { AlertCircle, Download, ExternalLink, ImageIcon, Play, X, Clock, Info } from 'lucide-react';
import { Student, TeacherMedia } from '../types';
import { Button } from './Button';
import { resolveGradeId } from '../utils/academicUtils';

interface StudentMediaGalleryProps {
    student: Student;
}

const StudentMediaGallery: React.FC<StudentMediaGalleryProps> = ({ student }) => {
    const [mediaList, setMediaList] = useState<TeacherMedia[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingMedia, setViewingMedia] = useState<TeacherMedia | null>(null);

    const fetchMedia = async () => {
        setLoading(true);
        try {
            const now = new Date().toISOString();
            const resolvedGradeId = student.gradeId || resolveGradeId(student.gradeLevel) || student.gradeLevel;

            const snapshot = await db.collection('teacher_media')
                .where('unit', '==', student.unit)
                .where('gradeLevel', '==', resolvedGradeId)
                .where('schoolClass', '==', student.schoolClass)
                .where('shift', '==', student.shift)
                .where('subjectId', '==', 'disc_musica')
                .where('expiresAt', '>', now)
                .orderBy('expiresAt', 'asc')
                .get();
            
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherMedia));
            setMediaList(docs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        } catch (error) {
            console.error("Error fetching student media:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMedia();
    }, [student]);

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

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="aspect-video bg-gray-100 rounded-2xl animate-pulse"></div>
                    ))}
                </div>
            ) : mediaList.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 shadow-inner">
                    <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <h3 className="text-xl font-bold text-gray-400">Nenhuma mídia por aqui...</h3>
                    <p className="text-gray-400 text-sm">Seu professor de música ainda não postou arquivos para sua turma recentemente.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {mediaList.map(item => (
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
                                        <Button 
                                            onClick={(e) => { e.stopPropagation(); setViewingMedia(item); }}
                                            className="flex-1 bg-white hover:bg-white/90 text-gray-900 border-none rounded-xl text-xs font-black shadow-lg"
                                        >
                                            VISUALIZAR
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 flex flex-col gap-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Professor(a)</span>
                                        <span className="text-sm font-bold text-gray-800 leading-tight">{item.teacherName}</span>
                                    </div>
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
            )}

            {/* Media Viewer Modal */}
            {viewingMedia && (
                <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="relative max-w-5xl w-full max-h-full flex flex-col items-center gap-4">
                        <button 
                            onClick={() => setViewingMedia(null)}
                            className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:rotate-90"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        
                        <div className="w-full bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center">
                            {viewingMedia.type === 'image' ? (
                                <img src={viewingMedia.url} alt="Preview" className="max-w-full max-h-[80vh] object-contain" />
                            ) : (
                                <video src={viewingMedia.url} controls autoPlay className="max-w-full max-h-[80vh]" />
                            )}
                        </div>

                        <div className="w-full flex justify-between items-center bg-white p-6 rounded-3xl shadow-2xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-lg leading-tight uppercase tracking-tight">{viewingMedia.teacherName}</h4>
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Postado em {new Date(viewingMedia.timestamp).toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <a 
                                    href={viewingMedia.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-4 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-colors"
                                    title="Baixar Mídia"
                                >
                                    <Download className="w-6 h-6" />
                                </a>
                                <Button 
                                    onClick={() => setViewingMedia(null)}
                                    className="bg-blue-950 px-8 py-4 rounded-2xl font-black tracking-widest"
                                >
                                    FECHAR
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
