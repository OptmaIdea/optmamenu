import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';

interface ImageLightboxProps {
    images: string[];
    currentIndex: number;
    onIndexChange: (index: number) => void;
    onClose: () => void;
    alt: string;
}

/** A single full-screen image viewer shared by catalog products and loyalty prizes. */
export function ImageLightbox({ images, currentIndex, onIndexChange, onClose, alt }: ImageLightboxProps) {
    const closeRef = useRef<HTMLButtonElement>(null);
    const onCloseRef = useRef(onClose);
    const changeRef = useRef(onIndexChange);
    onCloseRef.current = onClose;
    changeRef.current = onIndexChange;

    useEffect(() => {
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        closeRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onCloseRef.current();
            }
            if (images.length > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
                event.preventDefault();
                event.stopPropagation();
                changeRef.current((currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + images.length) % images.length);
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('keydown', onKeyDown, true);
            previousFocus?.focus();
        };
    }, [images.length, currentIndex]);

    if (images.length === 0) return null;
    const index = Math.min(Math.max(currentIndex, 0), images.length - 1);

    return createPortal(
        <div className="fixed inset-0 z-[250] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label={`Imagem ampliada: ${alt}`}>
            <div className="safe-area-top flex shrink-0 items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex items-center gap-2 text-sm">
                    <ZoomIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{alt}</span>
                    {images.length > 1 && <span className="shrink-0 text-white/60">{index + 1}/{images.length}</span>}
                </div>
                <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar imagem ampliada" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">
                    <X className="h-6 w-6" />
                </button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-8" onClick={onClose}>
                <img src={images[index]} alt={alt} className="max-h-full max-w-full object-contain" onClick={(event) => event.stopPropagation()} />
                {images.length > 1 && (
                    <>
                        <button type="button" onClick={(event) => { event.stopPropagation(); onIndexChange((index + images.length - 1) % images.length); }} aria-label="Imagem anterior" className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 sm:left-6"><ChevronLeft className="h-6 w-6" /></button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); onIndexChange((index + 1) % images.length); }} aria-label="Próxima imagem" className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 sm:right-6"><ChevronRight className="h-6 w-6" /></button>
                    </>
                )}
            </div>
            <p className="safe-area-bottom shrink-0 px-4 pb-4 text-center text-xs text-white/60">Toque fora da imagem ou pressione Esc para fechar</p>
        </div>,
        document.body,
    );
}
