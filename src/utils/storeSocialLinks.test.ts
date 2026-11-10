import { describe, expect, it } from 'vitest';
import { normalizeStoreSocialLink } from './storeSocialLinks';

describe('validação das redes sociais institucionais', () => {
    it.each([
        ['twitter', 'twitter.com/loja_antiga', 'https://twitter.com/loja_antiga'],
        ['twitter', 'https://x.com/loja_nova', 'https://x.com/loja_nova'],
        ['youtube', 'https://www.youtube.com/@CanalDaLoja', 'https://www.youtube.com/@CanalDaLoja'],
        ['youtube', 'youtube.com/channel/UC1234567890123456789012', 'https://youtube.com/channel/UC1234567890123456789012'],
        ['tiktok', 'https://www.tiktok.com/@lojinha', 'https://www.tiktok.com/@lojinha'],
        ['instagram', 'instagram.com/loja.oficial', 'https://instagram.com/loja.oficial'],
        ['facebook', 'www.facebook.com/minhaloja', 'https://www.facebook.com/minhaloja'],
        ['facebook', 'https://facebook.com/profile.php?id=123456789', 'https://facebook.com/profile.php?id=123456789'],
        ['website', 'www.minhaloja.com.br', 'https://www.minhaloja.com.br/'],
        ['google_reviews', 'https://maps.app.goo.gl/Abc123', 'https://maps.app.goo.gl/Abc123'],
    ] as const)('aceita %s e normaliza %s', (platform, input, expected) => {
        expect(normalizeStoreSocialLink(platform, input)).toBe(expected);
    });

    it.each([
        ['instagram', 'javascript:alert(1)'],
        ['instagram', 'data:text/html,hello'],
        ['instagram', 'http://instagram.com/loja'],
        ['instagram', 'https://instagram.com.evil.example/loja'],
        ['instagram', 'https://instagram.com@evil.example/loja'],
        ['instagram', 'https://user:password@instagram.com/loja'],
        ['instagram', '//instagram.com/loja'],
        ['instagram', 'https://instagram.com/p/abc123'],
        ['instagram', 'https://instagram.com/loja?redirect=https://example.com'],
        ['facebook', 'https://l.facebook.com/l.php?u=https://evil.example'],
        ['twitter', 'https://x.com/intent/tweet'],
        ['tiktok', 'https://tiktok.com/redirect'],
        ['youtube', 'https://youtu.be/clip'],
        ['youtube', 'https://youtube.com/watch?v=abc'],
        ['youtube', 'https://youtube.com@evil.example/@loja'],
        ['website', 'https://localhost/admin'],
        ['website', 'https://192.168.1.10/admin'],
        ['google_reviews', 'https://maps.app.goo.gl.evil.example/abc'],
        ['twitter', ''],
    ] as const)('não publica %s inválido: %s', (platform, input) => {
        expect(normalizeStoreSocialLink(platform, input)).toBeNull();
    });

    it('não converte dados arbitrários, incluindo objetos, em links', () => {
        expect(normalizeStoreSocialLink('instagram', { url: 'https://instagram.com/loja' })).toBeNull();
        expect(normalizeStoreSocialLink('instagram', null)).toBeNull();
        expect(normalizeStoreSocialLink('instagram', '   ')).toBeNull();
    });
});
