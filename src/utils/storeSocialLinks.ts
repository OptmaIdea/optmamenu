/**
 * Links institucionais são dados públicos fornecidos por cada loja.
 * Normalização única para edição e exibição; nunca confiar no JSONB vindo da RPC.
 */
export type StoreSocialLinkPlatform =
    | 'twitter'
    | 'youtube'
    | 'tiktok'
    | 'instagram'
    | 'facebook'
    | 'website'
    | 'google_reviews';

const allowedHosts: Record<Exclude<StoreSocialLinkPlatform, 'website'>, readonly string[]> = {
    twitter: ['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'],
    youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'],
    tiktok: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'],
    instagram: ['instagram.com', 'www.instagram.com', 'm.instagram.com'],
    facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com', 'fb.com', 'www.fb.com'],
    google_reviews: [
        'google.com', 'www.google.com', 'maps.google.com',
        'google.com.br', 'www.google.com.br', 'maps.google.com.br',
        'maps.app.goo.gl', 'g.page', 'www.g.page', 'goo.gl',
    ],
};

const reservedProfiles: Partial<Record<StoreSocialLinkPlatform, readonly string[]>> = {
    twitter: ['home', 'share', 'intent', 'login', 'signup', 'search', 'explore', 'i', 'settings'],
    instagram: ['p', 'reel', 'reels', 'stories', 'accounts', 'explore', 'direct', 'share', 'about', 'developer'],
    facebook: ['login', 'share', 'sharer', 'dialog', 'plugins', 'l', 'help', 'watch', 'reel', 'events'],
};

/**
 * Empty = hidden; invalid = null. Bare domains are accepted only when there is
 * no explicit protocol; explicit HTTP and all other schemes are rejected.
 */
export function normalizeStoreSocialLink(
    platform: StoreSocialLinkPlatform,
    value: unknown,
): string | null {
    if (typeof value !== 'string') return null;
    const input = value.trim();
    if (!input || input.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(input) || input.startsWith('//')) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(input) && !/^https:\/\//i.test(input)) return null;

    let url: URL;
    try {
        url = new URL(/^https:\/\//i.test(input) ? input : 'https://' + input);
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null;

    const host = url.hostname.toLowerCase();
    if (platform === 'website') {
        // Domínio público, não localhost, IP ou hostname interno.
        if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return null;
        if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test')) return null;
        return url.href;
    }
    if (!allowedHosts[platform].includes(host)) return null;

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.some(part => /%|\.{2}|[^\w@.-]/.test(part))) return null;
    const first = parts[0] || '';
    const blocked = reservedProfiles[platform] || [];
    if (blocked.includes(first.toLowerCase())) return null;

    // Nunca publicar atalhos de redirecionamento ou login como perfil.
    const forbiddenQuery = /^(?:next|redirect|redirect_uri|return|returnurl|continue|url|u|target|to|dest|destination)$/i;
    if ([...url.searchParams.keys()].some(key => forbiddenQuery.test(key))) return null;

    switch (platform) {
        case 'twitter':
            if (parts.length !== 1 || !/^[a-zA-Z0-9_]{1,15}$/.test(first)) return null;
            break;
        case 'instagram':
            if (parts.length !== 1 || !/^[a-zA-Z0-9._]{1,30}$/.test(first)) return null;
            break;
        case 'tiktok':
            if (parts.length !== 1 || !/^@[a-zA-Z0-9._]{2,24}$/.test(first)) return null;
            break;
        case 'youtube':
            if (!(
                (parts.length === 1 && /^@[a-zA-Z0-9._-]{2,60}$/.test(first))
                || (parts.length === 2 && /^(?:channel|user|c)$/.test(first)
                    && /^[a-zA-Z0-9_-]{2,100}$/.test(parts[1]))
            )) return null;
            break;
        case 'facebook':
            if (!(
                (parts.length === 1 && first === 'profile.php'
                    && /^[0-9]{5,30}$/.test(url.searchParams.get('id') || ''))
                || (parts.length === 1 && /^[a-zA-Z0-9._-]{2,100}$/.test(first))
                || (parts.length === 2 && first === 'p' && /^[a-zA-Z0-9._-]{2,100}$/.test(parts[1]))
                || (parts.length === 3 && ['people', 'pages'].includes(first)
                    && parts.slice(1).every(part => /^[a-zA-Z0-9._-]{2,100}$/.test(part)))
            )) return null;
            break;
        case 'google_reviews':
            if (parts.length === 0 || (host === 'goo.gl' && first !== 'maps')) return null;
            break;
    }
    return url.href;
}
