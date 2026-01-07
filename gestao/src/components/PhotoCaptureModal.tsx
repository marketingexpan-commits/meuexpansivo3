import { useState, useRef, useEffect } from 'react';
import { Check, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

interface PhotoCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (base64: string) => void;
}

export function PhotoCaptureModal({ isOpen, onClose, onCapture }: PhotoCaptureModalProps) {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Start camera when modal opens
    useEffect(() => {
        if (isOpen && !previewUrl) {
            startCamera();
        }
        return () => stopCamera();
    }, [isOpen, previewUrl]);

    async function startCamera() {
        try {
            setError(null);
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error('Error accessing camera:', err);
            setError('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Force 3:4 aspect ratio (300x400 for identity photo)
        const targetWidth = 600;
        const targetHeight = 800;
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Calculate crop to keep center
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const videoAspect = videoWidth / videoHeight;
        const targetAspect = 3 / 4;

        let sx, sy, sw, sh;
        if (videoAspect > targetAspect) {
            // Video is wider than target
            sh = videoHeight;
            sw = sh * targetAspect;
            sx = (videoWidth - sw) / 2;
            sy = 0;
        } else {
            // Video is taller than target
            sw = videoWidth;
            sh = sw / targetAspect;
            sx = 0;
            sy = (videoHeight - sh) / 2;
        }

        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setPreviewUrl(base64);
        stopCamera();
    };

    const handleSave = () => {
        if (previewUrl) {
            onCapture(previewUrl);
            handleClose();
        }
    };

    const handleRetake = () => {
        setPreviewUrl(null);
        setError(null);
    };

    const handleClose = () => {
        stopCamera();
        setPreviewUrl(null);
        setError(null);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Capturar Foto 3x4" maxWidth="max-w-md">
            <div className="flex flex-col items-center gap-4">
                {error ? (
                    <div className="bg-red-50 p-6 rounded-xl border border-red-100 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                        <Button onClick={startCamera} className="mt-4 bg-red-600 hover:bg-red-700">
                            Tentar Novamente
                        </Button>
                    </div>
                ) : (
                    <div className="relative w-full aspect-[3/4] bg-slate-900 rounded-xl overflow-hidden border-4 border-slate-100 shadow-inner">
                        {!previewUrl ? (
                            <>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-cover mirror"
                                    style={{ transform: 'scaleX(-1)' }} // Mirror mode
                                />
                                {/* Overlay Guide */}
                                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                                    <div className="w-full h-full border-2 border-dashed border-white/60 rounded-lg flex items-center justify-center">
                                        <div className="w-3/4 h-3/4 border border-white/20 rounded-full opacity-30"></div>
                                    </div>
                                </div>
                                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                                    <button
                                        onClick={handleCapture}
                                        className="w-16 h-16 bg-white rounded-full border-4 border-slate-300 shadow-xl flex items-center justify-center active:scale-95 transition-transform"
                                    >
                                        <div className="w-12 h-12 bg-white rounded-full border-2 border-slate-900"></div>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        )}
                    </div>
                )}

                <div className="w-full flex gap-3 mt-2">
                    {previewUrl ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleRetake}
                                className="flex-1 gap-2 py-6 text-slate-600"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Corrigir
                            </Button>
                            <Button
                                onClick={handleSave}
                                className="flex-1 gap-2 py-6 bg-green-600 hover:bg-green-700"
                            >
                                <Check className="w-4 h-4" />
                                Confirmar Foto
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            className="w-full"
                        >
                            Cancelar
                        </Button>
                    )}
                </div>

                <canvas ref={canvasRef} className="hidden" />

                <p className="text-[11px] text-slate-400 text-center italic">
                    Dica: Centralize o rosto do aluno no centro do visor.
                </p>
            </div>
        </Modal>
    );
}
