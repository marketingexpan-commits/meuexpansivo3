import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from './Button';
import { Modal } from './Modal';
import { Check, X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImageCropperModalProps {
    isOpen: boolean;
    imageSrc: string | null;
    onClose: () => void;
    onCropComplete: (croppedImageBase64: string) => void;
}

export function ImageCropperModal({ isOpen, imageSrc, onClose, onCropComplete }: ImageCropperModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const onCropChange = (crop: { x: number, y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteHandler = useCallback((_: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous');
            image.src = url;
        });

    const getCroppedImg = async (imageSrc: string, pixelCrop: any, rotation = 0): Promise<string> => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return '';
        }

        const maxSize = Math.max(image.width, image.height);
        const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

        // set each dimensions to double largest dimension to allow for a safe area for the
        // image to rotate in without being clipped by canvas context
        canvas.width = safeArea;
        canvas.height = safeArea;

        // translate canvas context to a central location on image to allow rotating around the center.
        ctx.translate(safeArea / 2, safeArea / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-safeArea / 2, -safeArea / 2);

        // draw rotated image and store data.
        ctx.drawImage(
            image,
            safeArea / 2 - image.width * 0.5,
            safeArea / 2 - image.height * 0.5
        );

        const data = ctx.getImageData(0, 0, safeArea, safeArea);

        // set canvas width to final desired crop size - this will clear existing context
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        // paste generated rotate image with correct offsets for x,y crop values.
        ctx.putImageData(
            data,
            0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x,
            0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y
        );

        // Resize to target 3x4 if needed (optional since we rely on crop box)
        // But for consistent output let's create a new canvas of 300x400
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = 300;
        finalCanvas.height = 400;
        const finalCtx = finalCanvas.getContext('2d');
        if (finalCtx) {
            finalCtx.drawImage(canvas, 0, 0, 300, 400);
            return finalCanvas.toDataURL('image/jpeg', 0.8);
        }

        return canvas.toDataURL('image/jpeg', 0.8);
    };

    const handleSave = async () => {
        if (imageSrc && croppedAreaPixels) {
            try {
                const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
                onCropComplete(croppedImage);
                onClose();
            } catch (e) {
                console.error(e);
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajustar Foto 3x4" maxWidth="max-w-2xl">
            <div className="flex flex-col gap-4">
                <div className="relative w-full h-[400px] bg-slate-900 rounded-lg overflow-hidden border border-slate-200">
                    {imageSrc && (
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            rotation={rotation}
                            aspect={3 / 4}
                            onCropChange={onCropChange}
                            onCropComplete={onCropCompleteHandler}
                            onZoomChange={onZoomChange}
                            zoomSpeed={0.5}
                            showGrid={true}
                        />
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Zoom</span>
                        <div className="flex items-center gap-3">
                            <ZoomOut className="w-4 h-4 text-slate-400" />
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                aria-label="Zoom"
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <ZoomIn className="w-4 h-4 text-slate-400" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rotação</span>
                        <div className="flex items-center gap-3">
                            <RotateCw className="w-4 h-4 text-slate-400" />
                            <input
                                type="range"
                                value={rotation}
                                min={0}
                                max={360}
                                step={1}
                                aria-label="Rotação"
                                onChange={(e) => setRotation(Number(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                            />
                            <span className="text-xs text-slate-500 w-8 text-right">{rotation}°</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={onClose}>
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                    </Button>
                    <Button onClick={handleSave}>
                        <Check className="w-4 h-4 mr-2" />
                        Confirmar Recorte
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
