import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { FormatUtils } from '../../src/shared/formatters.js';

describe('FormatUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('currency formatting', () => {
        test('should format currency with default options', () => {
            expect(FormatUtils.formatCurrency(1000)).toMatch(/R\$.*1.*000/);
            expect(FormatUtils.formatCurrency(1234.56)).toMatch(/R\$.*1.*234/);
        });

        test('should format abbreviated currency', () => {
            expect(FormatUtils.formatCurrency(1500000, { abbreviated: true })).toBe('R$ 1.5M');
            expect(FormatUtils.formatCurrency(15000, { abbreviated: true })).toBe('R$ 15K');
            expect(FormatUtils.formatCurrency(2500, { abbreviated: true })).toBe('R$ 2.5K');
        });

        test('should handle null and undefined values', () => {
            const nullResult = FormatUtils.formatCurrency(null);
            const undefinedResult = FormatUtils.formatCurrency(undefined);
            expect(nullResult).toMatch(/R\$/);
            expect(undefinedResult).toMatch(/R\$/);
        });
    });

    describe('number formatting', () => {
        test('should format numbers with locale', () => {
            const result1 = FormatUtils.formatNumber(1000);
            const result2 = FormatUtils.formatNumber(1234567);
            expect(typeof result1).toBe('string');
            expect(typeof result2).toBe('string');
        });

        test('should return non-numeric values as-is', () => {
            expect(FormatUtils.formatNumber('abc')).toBe('abc');
            expect(FormatUtils.formatNumber(null)).toBe(null);
        });
    });

    describe('date formatting', () => {
        test('should format valid dates', () => {
            const result = FormatUtils.formatDate('2023-01-15');
            expect(result).toMatch(/15.*01.*2023/);
        });

        test('should handle invalid dates', () => {
            expect(FormatUtils.formatDate('invalid-date')).toBe('Data inválida');
            expect(FormatUtils.formatDate('')).toBe('N/A');
            expect(FormatUtils.formatDate(null)).toBe('N/A');
        });
    });

    describe('percentage formatting', () => {
        test('should format percentage with default decimals', () => {
            expect(FormatUtils.formatPercentage(25.6789)).toBe('25.7%');
            expect(FormatUtils.formatPercentage(25.6789, 2)).toBe('25.68%');
        });

        test('should handle non-numeric values', () => {
            expect(FormatUtils.formatPercentage('abc')).toBe('0%');
        });
    });

    describe('text formatting', () => {
        test('should truncate text', () => {
            const longText = 'This is a very long text that should be truncated';
            const result = FormatUtils.truncateText(longText, 20);
            expect(result.length).toBeLessThanOrEqual(20);
            expect(result).toContain('...');
        });

        test('should return short text unchanged', () => {
            const shortText = 'Short';
            expect(FormatUtils.truncateText(shortText, 20)).toBe(shortText);
        });
    });
});
