import { describe, expect, it } from 'vitest';
import { formatTimeInRoute } from './timeInRoute';

describe('tempo em rota dos pedidos de entrega', () => {
    const now = new Date('2026-10-15T15:05:00.000Z');

    it('calcula a duração desde a saída com horário válido', () => {
        expect(formatTimeInRoute('2026-10-15T13:50:00.000Z', now)).toBe('Em rota há 1h 15min');
        expect(formatTimeInRoute('2026-10-15T14:40:00.000Z', now)).toBe('Em rota há 25 min');
    });

    it('não inventa tempo quando o horário falta ou é inválido', () => {
        expect(formatTimeInRoute(null, now)).toBe('Horário de saída não registrado');
        expect(formatTimeInRoute('inválido', now)).toBe('Horário de saída não registrado');
        expect(formatTimeInRoute('2026-10-15T16:00:00.000Z', now)).toBe('Horário de saída não registrado');
    });
});
