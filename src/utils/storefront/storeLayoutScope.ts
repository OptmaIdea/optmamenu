/**
 * A URL visitada é a autoridade para identificar a loja pública.
 * O contexto persistido do carrinho só pode ser fallback em rotas sem slug
 * (por exemplo, /checkout), nunca trocar a loja visível em /s/:slug.
 */
export function getStoreSlugFromPath(pathname: string): string | null {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length < 2) return null;
    const [prefix, slug] = segments;
    return ['s', 'loja', 'cardapio', 'q', 'mesa'].includes(prefix) && slug ? slug : null;
}

export function resolveStoreSlugForLayout(pathname: string, cartCanonicalSlug?: string | null): string | null {
    return getStoreSlugFromPath(pathname) || cartCanonicalSlug || null;
}

/** Nunca associar dados carregados para a rota anterior à rota atual. */
export function onlyCurrentPublicStore<T>(
    requestedSlug: string | null,
    loaded: { requestedSlug: string; store: T | null } | null,
): T | null {
    return requestedSlug && loaded?.requestedSlug === requestedSlug ? loaded.store : null;
}

/** Uma sincronização de catálogo não pode utilizar o storeId do carrinho de outra loja. */
export function hasMatchingStoreId(cartStoreId: string | null | undefined, publicStoreId: string | null | undefined): boolean {
    return Boolean(cartStoreId && publicStoreId && cartStoreId === publicStoreId);
}
