import { describe, it, expect } from 'vitest'
import { timezoneUtils } from '@/utils/timezoneUtils'

describe('timezoneUtils', () => {
    // ─── formatBrazilDate ────────────────────────────────────────────

    describe('formatBrazilDate', () => {
        it('should return "-" for null input', () => {
            expect(timezoneUtils.formatBrazilDate(null)).toBe('-')
        })

        it('should return "-" for undefined input', () => {
            expect(timezoneUtils.formatBrazilDate(undefined)).toBe('-')
        })

        it('should format YYYY-MM-DD string without UTC shift', () => {
            // This specifically tests the fix for date-only strings
            // "2024-12-25" should NOT shift to the 24th due to UTC conversion
            expect(timezoneUtils.formatBrazilDate('2024-12-25')).toBe('25/12/2024')
        })

        it('should format another YYYY-MM-DD string correctly', () => {
            expect(timezoneUtils.formatBrazilDate('2025-01-01')).toBe('01/01/2025')
        })

        it('should format a Date object to DD/MM/YYYY', () => {
            // Create a date that is unambiguously Feb 10 in Brazil timezone
            const date = new Date('2025-02-10T12:00:00Z')
            const result = timezoneUtils.formatBrazilDate(date)
            // Should contain 10/02/2025
            expect(result).toBe('10/02/2025')
        })
    })

    // ─── formatBrazilDateTime ────────────────────────────────────────

    describe('formatBrazilDateTime', () => {
        it('should return "-" for null input', () => {
            expect(timezoneUtils.formatBrazilDateTime(null)).toBe('-')
        })

        it('should return "-" for undefined input', () => {
            expect(timezoneUtils.formatBrazilDateTime(undefined)).toBe('-')
        })

        it('should format an ISO string with timezone offset', () => {
            // 2025-02-10T15:30:00-03:00 → should strip offset, force UTC, format to Brazil
            const result = timezoneUtils.formatBrazilDateTime('2025-02-10T15:30:00-03:00')
            // After stripping -03:00 and adding Z: "2025-02-10T15:30:00Z"
            // In São Paulo (UTC-3): 12:30 on 10/02/2025
            expect(result).toContain('10/02/2025')
            expect(result).toContain('12:30')
        })

        it('should format an ISO string ending with Z', () => {
            const result = timezoneUtils.formatBrazilDateTime('2025-06-15T18:00:00Z')
            // UTC 18:00 → São Paulo (UTC-3) = 15:00
            expect(result).toContain('15/06/2025')
            expect(result).toContain('15:00')
        })

        it('should format a Date object', () => {
            const date = new Date('2025-03-20T21:45:00Z')
            const result = timezoneUtils.formatBrazilDateTime(date)
            // UTC 21:45 → São Paulo (UTC-3) = 18:45
            expect(result).toContain('20/03/2025')
            expect(result).toContain('18:45')
        })
    })
})
