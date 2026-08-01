import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StoreConfig, StorefrontBannerMedia } from '@/types';

interface PublicStoreHeroProps {
    storeName: string;
    storeSlug?: string;
    description?: string;
    config?: StoreConfig;
}

const TEST_BUCKET_PUBLIC_URL = 'https://lgkkfmqzaorrutuoqeax.supabase.co/storage/v1/object/public/teste_banner';
const MAX_PUBLIC_MEDIA = 5;

const demoUrl = (name: string) => `${TEST_BUCKET_PUBLIC_URL}/${encodeURIComponent(name)}`;

const GELINHARES_DEMO_MEDIA: StorefrontBannerMedia[] = [
    { id: 'demo-1', type: 'image', url: demoUrl('Gemini_Generated_Image_ojpljkojpljkojpl_11zon.webp'), alt_text: 'Destaque visual da Gelinhares', sort_order: 1 },
    { id: 'demo-2', type: 'image', url: demoUrl('Gemini_Generated_Image_wsxy8hwsxy8hwsxy_11zon.webp'), alt_text: 'Produto em destaque da Gelinhares', sort_order: 2 },
    { id: 'demo-video', type: 'video', url: demoUrl('crie_um_video_de_alguem_tomand(1).mp4'), poster_url: demoUrl('Gemini_Generated_Image_1107s91107s91107_11zon.webp'), alt_text: 'Vídeo promocional da Gelinhares', sort_order: 3 },
    { id: 'demo-4', type: 'image', url: demoUrl('Gemini_Generated_Image_1107s91107s91107_11zon.webp'), alt_text: 'Experiência Gelinhares', sort_order: 4 },
    { id: 'demo-5', type: 'image', url: demoUrl('Gemini_Generated_Image_f60iyif60iyif60i_11zon.webp'), alt_text: 'Seleção especial da Gelinhares', sort_order: 5 },
];

function configuredMedia(config?: StoreConfig): StorefrontBannerMedia[] {
    const published = (config?.banners || [])
        .filter((item) => item.active !== false && item.published !== false && item.url)
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

    if (published.length) {
        const planLimit = Math.max(1, Math.min(MAX_PUBLIC_MEDIA, Number(config?.banner_publication_limit || MAX_PUBLIC_MEDIA)));
        return published.slice(0, planLimit);
    }

    const legacy: StorefrontBannerMedia[] = [];
    if (config?.visual_banner_url) legacy.push({
        id: 'legacy-image',
        type: 'image',
        url: config.visual_banner_url,
        alt_text: 'Banner da loja',
        title: config.visual_banner_title || config.visual_title,
        subtitle: config.visual_banner_subtitle || config.visual_slogan,
    });
    if (config?.visual_banner_video_url) legacy.push({
        id: 'legacy-video',
        type: 'video',
        url: config.visual_banner_video_url,
        poster_url: config.visual_banner_video_poster_url || config.visual_banner_url,
        alt_text: 'Vídeo da loja',
        title: config.visual_banner_title || config.visual_title,
        subtitle: config.visual_banner_subtitle || config.visual_slogan,
    });
    return legacy.slice(0, MAX_PUBLIC_MEDIA);
}

function overlayOpacity(value?: number) {
    if (!Number.isFinite(value)) return 0.46;
    return Math.min(0.78, Math.max(0.08, Number(value)));
}

export function PublicStoreHero({ storeName, storeSlug, config }: PublicStoreHeroProps) {
    const fromConfig = useMemo(() => configuredMedia(config), [config]);
    const isGelinhares = `${storeSlug || ''} ${storeName}`.toLowerCase().includes('gelinhares');
    const media = useMemo(
        () => fromConfig.length ? fromConfig : isGelinhares ? GELINHARES_DEMO_MEDIA : [],
        [fromConfig, isGelinhares],
    );

    const [activeIndex, setActiveIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const touchStart = useRef<number | null>(null);

    const active = media[activeIndex];
    const title = active?.title?.trim() || '';
    const subtitle = active?.subtitle?.trim() || '';
    const eyebrow = title || subtitle ? config?.visual_banner_eyebrow?.trim() || '' : '';
    const hasCopy = Boolean(eyebrow || title || subtitle);
    const centered = config?.visual_banner_alignment === 'center';
    const opacity = overlayOpacity(config?.visual_banner_overlay_opacity);

    const next = () => setActiveIndex((current) => media.length ? (current + 1) % media.length : 0);
    const previous = () => setActiveIndex((current) => media.length ? (current - 1 + media.length) % media.length : 0);

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReduceMotion(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        if (media.length > 1) setActiveIndex(Math.floor(Math.random() * media.length));
        else setActiveIndex(0);
    }, [media.length]);

    useEffect(() => {
        if (media.length <= 1 || paused || reduceMotion || active?.type === 'video') return;
        const duration = Math.max(3_000, Number(active?.duration_seconds || 6) * 1_000);
        const timer = window.setTimeout(next, duration);
        return () => window.clearTimeout(timer);
    }, [activeIndex, active, media.length, paused, reduceMotion]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || active?.type !== 'video') return;
        if (paused || reduceMotion) video.pause();
        else void video.play().catch(() => undefined);
    }, [activeIndex, active, paused, reduceMotion]);

    if (!media.length) return null;

    return (
        <section aria-label={`Destaques da ${storeName}`} className="mx-auto mt-4 max-w-5xl px-4">
            <div
                className="relative isolate min-h-[180px] overflow-hidden rounded-3xl bg-slate-900 shadow-lg sm:min-h-[220px] lg:min-h-[280px]"
                style={{ backgroundColor: config?.visual_color_primary || '#0f766e' }}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onFocusCapture={() => setPaused(true)}
                onBlurCapture={() => setPaused(false)}
                onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
                onTouchEnd={(event) => {
                    const start = touchStart.current;
                    const end = event.changedTouches[0]?.clientX;
                    touchStart.current = null;
                    if (start == null || end == null || Math.abs(start - end) < 45) return;
                    start > end ? next() : previous();
                }}
            >
                {active?.type === 'video' ? (
                    <video
                        key={active.url}
                        ref={videoRef}
                        src={active.url}
                        poster={active.poster_url}
                        className="absolute inset-0 h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        onEnded={next}
                        aria-label={active.alt_text || `Vídeo promocional da ${storeName}`}
                    />
                ) : active ? (
                    <picture>
                        {active.mobile_url && <source media="(max-width: 639px)" srcSet={active.mobile_url} />}
                        <img
                            key={active.url}
                            src={active.url}
                            alt={active.alt_text || `Destaque da ${storeName}`}
                            className="absolute inset-0 h-full w-full object-cover"
                            loading={activeIndex === 0 ? 'eager' : 'lazy'}
                            fetchPriority={activeIndex === 0 ? 'high' : 'auto'}
                        />
                    </picture>
                ) : null}

                {hasCopy && (
                    <>
                        <div
                            className="absolute inset-0"
                            style={{
                                background: centered
                                    ? `linear-gradient(180deg, rgba(2,6,23,${opacity * 0.35}), rgba(2,6,23,${opacity}))`
                                    : `linear-gradient(90deg, rgba(2,6,23,${Math.min(0.92, opacity + 0.28)}), rgba(2,6,23,${opacity}) 50%, rgba(2,6,23,${Math.max(0.04, opacity - 0.28)}))`,
                            }}
                        />

                        <div className={`relative z-10 flex min-h-[180px] items-center p-5 text-white sm:min-h-[220px] sm:p-7 lg:min-h-[280px] lg:p-9 ${centered ? 'justify-center text-center' : 'justify-start text-left'}`}>
                            <div className={centered ? 'max-w-2xl' : 'max-w-xl'}>
                                {eyebrow && <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-white/80 sm:text-sm">{eyebrow}</p>}
                                {title && <h2 className="text-2xl font-black leading-tight drop-shadow-sm sm:text-3xl lg:text-4xl">{title}</h2>}
                                {subtitle && <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/90 sm:text-base sm:leading-7">{subtitle}</p>}
                            </div>
                        </div>
                    </>
                )}

                {media.length > 1 && (
                    <>
                        <button type="button" onClick={previous} className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur hover:bg-black/65 sm:flex" aria-label="Mídia anterior"><ChevronLeft className="h-5 w-5" /></button>
                        <button type="button" onClick={next} className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur hover:bg-black/65 sm:flex" aria-label="Próxima mídia"><ChevronRight className="h-5 w-5" /></button>
                        <div className="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-2 px-4">
                            <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-2 backdrop-blur">
                                {media.map((item, index) => (
                                    <button
                                        key={item.id || `${item.url}-${index}`}
                                        type="button"
                                        onClick={() => setActiveIndex(index)}
                                        className={`h-2 rounded-full transition-all ${index === activeIndex ? 'w-6 bg-white' : 'w-2 bg-white/55 hover:bg-white/80'}`}
                                        aria-label={`Ir para mídia ${index + 1}`}
                                        aria-current={index === activeIndex ? 'true' : undefined}
                                    />
                                ))}
                            </div>
                            {!reduceMotion && (
                                <button type="button" onClick={() => setPaused((current) => !current)} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60" aria-label={paused ? 'Continuar carrossel' : 'Pausar carrossel'}>
                                    {paused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
