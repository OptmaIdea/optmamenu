import { Play } from 'lucide-react';
import type { StoreConfig } from '@/types';

interface PublicStoreHeroProps {
    storeName: string;
    description?: string;
    config?: StoreConfig;
}

function clampOverlayOpacity(value: number | undefined) {
    if (!Number.isFinite(value)) return 0.5;
    return Math.min(0.78, Math.max(0.16, Number(value)));
}

export function PublicStoreHero({ storeName, description, config }: PublicStoreHeroProps) {
    const imageUrl = config?.visual_banner_url;
    const videoUrl = config?.visual_banner_video_url;
    const posterUrl = config?.visual_banner_video_poster_url || imageUrl;
    const eyebrow = config?.visual_banner_eyebrow || 'Conheça nosso cardápio';
    const title = config?.visual_banner_title || config?.visual_title || storeName;
    const subtitle = config?.visual_banner_subtitle || config?.visual_slogan || description;
    const overlayOpacity = clampOverlayOpacity(config?.visual_banner_overlay_opacity);
    const align = config?.visual_banner_alignment === 'center' ? 'center' : 'left';
    const hasMedia = Boolean(imageUrl || videoUrl);

    if (!hasMedia && !title && !subtitle) return null;

    return (
        <section
            aria-label={`Destaque da ${storeName}`}
            className="mx-auto mt-4 max-w-5xl px-4"
        >
            <div
                className="relative isolate min-h-[180px] overflow-hidden rounded-3xl bg-slate-900 shadow-lg sm:min-h-[220px] lg:min-h-[280px]"
                style={{
                    backgroundColor: config?.visual_color_primary || '#0f766e',
                }}
            >
                {imageUrl && (
                    <img
                        src={imageUrl}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="eager"
                    />
                )}

                <div
                    className="absolute inset-0"
                    style={{
                        background: align === 'center'
                            ? `linear-gradient(180deg, rgba(2, 6, 23, ${overlayOpacity * 0.55}) 0%, rgba(2, 6, 23, ${overlayOpacity}) 100%)`
                            : `linear-gradient(90deg, rgba(2, 6, 23, ${Math.min(0.9, overlayOpacity + 0.2)}) 0%, rgba(2, 6, 23, ${overlayOpacity}) 48%, rgba(2, 6, 23, ${Math.max(0.08, overlayOpacity - 0.22)}) 100%)`,
                    }}
                />

                <div
                    className={`relative z-10 grid min-h-[180px] items-center gap-5 p-5 text-white sm:min-h-[220px] sm:p-7 lg:min-h-[280px] lg:grid-cols-[minmax(0,1fr)_minmax(260px,400px)] lg:p-9 ${align === 'center' && !videoUrl ? 'text-center' : 'text-left'}`}
                >
                    <div className={align === 'center' && !videoUrl ? 'mx-auto max-w-2xl' : 'max-w-2xl'}>
                        {eyebrow && (
                            <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-white/80 sm:text-sm">
                                {eyebrow}
                            </p>
                        )}

                        <h2 className="text-2xl font-black leading-tight drop-shadow-sm sm:text-3xl lg:text-4xl">
                            {title}
                        </h2>

                        {subtitle && (
                            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/90 sm:text-base sm:leading-7">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    {videoUrl && (
                        <div className="relative mx-auto w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/25 bg-black/25 shadow-2xl backdrop-blur-sm">
                            <video
                                className="aspect-video w-full object-cover"
                                src={videoUrl}
                                poster={posterUrl}
                                autoPlay
                                muted
                                loop
                                playsInline
                                preload="metadata"
                                aria-label={`Vídeo de apresentação da ${storeName}`}
                            />
                            <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm">
                                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                                Vídeo da loja
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
