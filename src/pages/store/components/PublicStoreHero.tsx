import {
    ChevronLeft,
    ChevronRight,
    Pause,
    Play,
} from 'lucide-react';
import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { StoreConfig, StorefrontBannerMedia } from '@/types';

interface PublicStoreHeroProps {
    storeName: string;
    storeSlug?: string;
    description?: string;
    config?: StoreConfig;
}

const TEST_BUCKET_PUBLIC_URL = 'https://lgkkfmqzaorrutuoqeax.supabase.co/storage/v1/object/public/teste_banner';
const DEFAULT_IMAGE_DURATION_MS = 6_000;
const MAX_PUBLIC_MEDIA = 5;

const GELINHARES_DEMO_MEDIA: StorefrontBannerMedia[] = [
    {
        id: 'gelinhares-demo-1',
        type: 'image',
        url: `${TEST_BUCKET_PUBLIC_URL}/${encodeURIComponent('Gemini_Generated_Image_ojpljkojpljkojpl_11zon.webp')}`,
        alt_text: 'Destaque visual da Gelinhares',
        sort_order: 1,
    },
    {
        id: 'gelinhares-demo-2',
        type: 'image',
        url: `${TEST_BUCKET_PUBLIC_URL}/${encodeURIComponent('Gemini_Generated_Image_wsxy8hwsxy8hwsxy_11zon.webp')}`,
        alt_text: 'Produto em destaque da Gelinhares',
        sort_order: 2,
    },
    {
        id: 'gelinhares-demo-video',
        type: 'video',
        url: `${TEST_BUCKET_PUBLIC_URL}/${encodeURIComponent('crie_um_video_de_alguem_tomand(1).mp4')}`,
        poster_url: `${TEST_BUCKET_PUBLIC_URL}/${encodeURIComponent('Gemini_Generated_Image_1107s91107s91107_11zon.webp')}`,
        alt_text: 'Vídeo promocional da Gelinhares',
        sort_order: 3,
    },
    {
        id: 'gelinhares-demo-4',
        type: 'image',
        url: `${TEST_BUCKET_PUBLIC_URL}/${encodeURIComponent('Gemini_Generated_Image_1107s91107s91107_11zon.webp')}`,
        alt_text: 'Experiência Gelinhares',
        sort_order: 4,
    },
    {
        id: 'gelinhares-demo-5',
        type: 'image',
        url: `${TEST_BUCKET_PUBLIC_URL}/${encodeURIComponent('Gemini_Generated_Image_f60iyif60iyif60i_11zon.webp')}`,
        alt_text: 'Seleção especial da Gelinhares',
        sort_order: 5,
    },
];

function clampOverlayOpacity(value: number | undefined) {
    if (!Number.isFinite(value)) return 0.46;
    return Math.min(0.78, Math.max(0.08, Number(value)));
}

function normalizeConfiguredMedia(config?: StoreConfig) {
    const configured = (config?.banners || [])
        .filter((media) => media.active !== false && media.published !== false && Boolean(media.url))
        .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));

    if (configured.length > 0) {
        const planLimit = Math.max(
            1,
            Math.min(MAX_PUBLIC_MEDIA, Number(config?.banner_publication_limit || MAX_PUBLIC_MEDIA)),
        );
        return configured.slice(0, planLimit);
    }

    const legacy: StorefrontBannerMedia[] = [];

    if (config?.visual_banner_url) {
        legacy.push({
            id: 'legacy-banner-image',
            type: 'image',
            url: config.visual_banner_url,
            alt_text: 'Banner da loja',
            sort_order: 1,
        });
    }

    if (config?.visual_banner_video_url) {
        legacy.push({
            id: 'legacy-banner-video',
            type: 'video',
            url: config.visual_banner_video_url,
            poster_url: config.visual_banner_video_poster_url || config.visual_banner_url,
            alt_text: 'Vídeo da loja',
            sort_order: 2,
        });
    }

    return legacy.slice(0, MAX_PUBLIC_MEDIA);
}

export function PublicStoreHero({
    storeName,
    storeSlug,
    description,
    config,
}: PublicStoreHeroProps) {
    const configuredMedia = useMemo(() => normalizeConfiguredMedia(config), [config]);
    const media = useMemo(() => {
        if (configuredMedia.length > 0) return configuredMedia;
        return storeSlug?.toLowerCase().includes('gelinhares')
            ? GELINHARES_DEMO_MEDIA
            : [];
    }, [configuredMedia, storeSlug]);

    const [activeIndex, setActiveIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);
    const touchStartX = useRef<number | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const eyebrow = config?.visual_banner_eyebrow || 'Conheça nosso cardápio';
    const title = config?.visual_banner_title || config?.visual_title || storeName;
    const subtitle = config?.visual_banner_subtitle || config?.visual_slogan || description;
    const overlayOpacity = clampOverlayOpacity(config?.visual_banner_overlay_opacity);
    const align = config?.visual_banner_alignment === 'center' ? 'center' : 'left';
    const activeMedia = media[activeIndex];

    const goTo = (index: number) => {
        if (media.length === 0) return;
        setActiveIndex((index + media.length) % media.length);
    };

    const goNext = () => goTo(activeIndex + 1);
    const goPrevious = () => goTo(activeIndex - 1);

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReduceMotion(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        if (media.length <= 1) {
            setActiveIndex(0);
            return;
        }

        setActiveIndex(Math.floor(Math.random() * media.length));
    }, [media.length]);

    useEffect(() => {
        if (
            media.length <= 1
            || isPaused
            || reduceMotion
            || activeMedia?.type === 'video'
        ) {
            return undefined;
        }

        const duration = Math.max(
            3_000,
            Number(activeMedia?.duration_seconds || 0) * 1_000 || DEFAULT_IMAGE_DURATION_MS,
        );
        const timer = window.setTimeout(goNext, duration);
        return () => window.clearTimeout(timer);
    }, [activeIndex, activeMedia, isPaused, media.length, reduceMotion]);

    useEffect(() => {
        if (activeMedia?.type !== 'video' || !videoRef.current) return;

        if (isPaused || reduceMotion) {
            videoRef.current.pause();
            return;
        }

        void videoRef.current.play().catch(() => undefined);
    }, [activeIndex, activeMedia, isPaused, reduceMotion]);

    if (media.length === 0 && !title && !subtitle) return null;

    return (
        <section
            aria-label={`Destaques da ${storeName}`}
            className="mx-auto mt-4 max-w-5xl px-4"
        >
            <div
                className="group relative isolate min-h-[180px] overflow-hidden rounded-3xl bg-slate-900 shadow-lg sm:min-h-[220px] lg:min-h-[280px]"
                style={{ backgroundColor: config?.visual_color_primary || '#0f766e' }}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onFocusCapture={() => setIsPaused(true)}
                onBlurCapture={() => setIsPaused(false)}
                onTouchStart={(event) => {
                    touchStartX.current = event.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(event) => {
                    const start = touchStartX.current;
                    const end = event.changedTouches[0]?.clientX;
                    touchStartX.current = null;
                    if (start == null || end == null || Math.abs(start - end) < 45) return;
                    if (start > end) goNext();
                    else goPrevious();
                }}
            >
                {activeMedia?.type === 'video' ? (
                    <video
                        key={activeMedia.url}
                        ref={videoRef}
                        className="absolute inset-0 h-full w-full object-cover"
                        src={activeMedia.url}
                        poster={activeMedia.poster_url}
                        muted
                        playsInline
                        preload="metadata"
                        onEnded={goNext}
                        aria-label={activeMedia.alt_text || `Vídeo promocional da ${storeName}`}
                    />
                ) : activeMedia ? (
                    <picture>
                        {activeMedia.mobile_url && (
                            <source media="(max-width: 639px)" srcSet={activeMedia.mobile_url} />
                        )}
                        <img
                            key={activeMedia.url}
                            src={activeMedia.url}
                            alt={activeMedia.alt_text || `Destaque da ${storeName}`}
                            className="absolute inset-0 h-full w-full object-cover"
                            loading={activeIndex === 0 ? 'eager' : 'lazy'}
                            fetchPriority={activeIndex === 0 ? 'high' : 'auto'}
                        />
                    </picture>
                ) : null}

                <div
                    className="absolute inset-0"
                    style={{
                        background: align === 'center'
                            ? `linear-gradient(180deg, rgba(2, 6, 23, ${overlayOpacity * 0.35}) 0%, rgba(2, 6, 23, ${overlayOpacity}) 100%)`
                            : `linear-gradient(90deg, rgba(2, 6, 23, ${Math.min(0.92, overlayOpacity + 0.28)}) 0%, rgba(2, 6, 23, ${overlayOpacity}) 50%, rgba(2, 6, 23, ${Math.max(0.04, overlayOpacity - 0.28)}) 100%)`,
                    }}
                />

                <div
                    className={`relative z-10 flex min-h-[180px] items-center p-5 text-white sm:min-h-[220px] sm:p-7 lg:min-h-[280px] lg:p-9 ${align === 'center' ? 'justify-center text-center' : 'justify-start text-left'}`}
                >
                    <div className={align === 'center' ? 'max-w-2xl' : 'max-w-xl'}>
                        {eyebrow && (
                            <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-white/80 sm:text-sm">
                                {eyebrow}
                            </p>
                        )}
                        <h2 className="text-2xl font-black leading-tight drop-shadow-sm sm:text-3xl lg:text-4xl">
                            {activeMedia?.title || title}
                        </h2>
                        {(activeMedia?.subtitle || subtitle) && (
                            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/90 sm:text-base sm:leading-7">
                                {activeMedia?.subtitle || subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {media.length > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={goPrevious}
                            className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur transition hover:bg-black/65 sm:flex"
                            aria-label="Mídia anterior"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={goNext}
                            className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur transition hover:bg-black/65 sm:flex"
                            aria-label="Próxima mídia"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>

                        <div className="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-2 px-4">
                            <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-2 backdrop-blur">
                                {media.map((item, index) => (
                                    <button
                                        key={item.id || `${item.url}-${index}`}
                                        type="button"
                                        onClick={() => goTo(index)}
                                        className={`h-2 rounded-full transition-all ${index === activeIndex ? 'w-6 bg-white' : 'w-2 bg-white/55 hover:bg-white/80'}`}
                                        aria-label={`Ir para mídia ${index + 1}`}
                                        aria-current={index === activeIndex ? 'true' : undefined}
                                    />
                                ))}
                            </div>

                            {!reduceMotion && (
                                <button
                                    type="button"
                                    onClick={() => setIsPaused((current) => !current)}
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"
                                    aria-label={isPaused ? 'Continuar carrossel' : 'Pausar carrossel'}
                                >
                                    {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
