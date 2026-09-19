import { describe, expect, it } from 'vitest';
import { ensureReadableStorefrontTextColor } from '@/services/publicStorefrontService';

describe('ensureReadableStorefrontTextColor', () => {
    it('corrige texto escuro com contraste insuficiente sobre azul da Gelinhares', () => {
        expect(ensureReadableStorefrontTextColor('#3C5EC3', '#1f2937')).toBe('#ffffff');
    });

    it('preserva uma cor configurada quando ela já atende contraste mínimo', () => {
        expect(ensureReadableStorefrontTextColor('#ffffff', '#111827')).toBe('#111827');
    });

    it('escolhe texto escuro para fundo muito claro', () => {
        expect(ensureReadableStorefrontTextColor('#f9fafb', '#e5e7eb')).toBe('#111827');
    });
});
