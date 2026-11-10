import { describe, expect, it } from 'vitest';
import {
    getStoreSlugFromPath,
    hasMatchingStoreId,
    onlyCurrentPublicStore,
    resolveStoreSlugForLayout,
} from './storeLayoutScope';

describe('isolamento da loja pública no StoreLayout', () => {
    it.each([
        ['/s/loja-b', 'loja-b'],
        ['/loja/loja-b', 'loja-b'],
        ['/cardapio/loja-b', 'loja-b'],
        ['/q/loja-b/mesa-01', 'loja-b'],
        ['/mesa/loja-b/mesa-01', 'loja-b'],
        ['/s/loja-b/legal/privacidade', 'loja-b'],
        ['/checkout', null],
    ] as const)('identifica slug da URL %s', (path, expected) => {
        expect(getStoreSlugFromPath(path)).toBe(expected);
    });

    it('rota pública prevalece sobre carrinho persistido de outra loja', () => {
        expect(resolveStoreSlugForLayout('/s/loja-b', 'loja-a')).toBe('loja-b');
        expect(resolveStoreSlugForLayout('/q/loja-b/T12', 'loja-a')).toBe('loja-b');
        expect(resolveStoreSlugForLayout('/checkout', 'loja-a')).toBe('loja-a');
        expect(resolveStoreSlugForLayout('/checkout', null)).toBeNull();
    });

    it('não reexibe dados carregados para slug anterior durante a transição A/B', () => {
        const old = { requestedSlug: 'loja-a', store: { id: 'id-a', name: 'Loja A' } };
        expect(onlyCurrentPublicStore('loja-b', old)).toBeNull();
        expect(onlyCurrentPublicStore('loja-a', old)).toEqual(old.store);
        expect(onlyCurrentPublicStore('loja-b', { requestedSlug: 'loja-b', store: { id: 'id-b' } }))
            .toEqual({ id: 'id-b' });
        expect(onlyCurrentPublicStore('loja-b', null)).toBeNull();
    });

    it('bloqueia catálogo e carrinho de outras lojas; aliases legítimos usam o mesmo ID', () => {
        expect(hasMatchingStoreId('id-a', 'id-b')).toBe(false);
        expect(hasMatchingStoreId('id-a', 'id-a')).toBe(true);
        expect(hasMatchingStoreId(null, 'id-b')).toBe(false);
        expect(hasMatchingStoreId('id-a', undefined)).toBe(false);
    });
});
