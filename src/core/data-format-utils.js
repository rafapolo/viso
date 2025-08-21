// Data Processing and Formatting Utilities - Consolidated Module
// Consolidates: shared/data-utils.js + shared/formatters.js + shared/color-utils.js

// ===== DATA UTILITIES =====
export class DataUtils {
    static safeToNumber(value) {
        if (typeof value === 'bigint') {
            return Number(value);
        }
        return value;
    }
    
    static convertNumericFields(obj, fields = ['total_value', 'transaction_count', 'valor_liquido', 'valor_documento']) {
        const result = { ...obj };
        fields.forEach(field => {
            if (result[field] !== undefined && result[field] !== null) {
                result[field] = this.safeToNumber(result[field]);
            }
        });
        return result;
    }

    static calculateStatistics(values) {
        if (!Array.isArray(values) || !values.length) {
            return {
                count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0, standardDeviation: 0
            };
        }

        const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
        if (!numericValues.length) {
            return {
                count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0, standardDeviation: 0
            };
        }

        const sum = numericValues.reduce((acc, val) => acc + val, 0);
        const mean = sum / numericValues.length;
        
        const sortedValues = [...numericValues].sort((a, b) => a - b);
        const median = sortedValues.length % 2 === 0
            ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
            : sortedValues[Math.floor(sortedValues.length / 2)];

        const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length;
        const standardDeviation = Math.sqrt(variance);

        return {
            count: numericValues.length,
            sum,
            mean,
            median,
            min: Math.min(...numericValues),
            max: Math.max(...numericValues),
            standardDeviation
        };
    }

    static groupBy(array, keyFn) {
        return array.reduce((groups, item) => {
            const key = keyFn(item);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    }

    static aggregateBy(array, keyFn, valueFn, aggregateFn = (values) => values.reduce((a, b) => a + b, 0)) {
        const groups = this.groupBy(array, keyFn);
        const result = {};
        
        for (const [key, items] of Object.entries(groups)) {
            const values = items.map(valueFn);
            result[key] = aggregateFn(values);
        }
        
        return result;
    }

    static createSlug(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }
}

// ===== FORMAT UTILITIES =====
export class FormatUtils {
    static formatCurrency(value, options = {}) {
        const {
            locale = 'pt-BR',
            currency = 'BRL',
            minimumFractionDigits = 2,
            abbreviated = false
        } = options;

        if (abbreviated && typeof value === 'number') {
            if (value >= 1000000) {
                const millions = value / 1000000;
                return `R$ ${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)}M`;
            }
            if (value >= 10000) {
                return `R$ ${(value / 1000).toFixed(0)}K`;
            }
            if (value >= 1000) {
                return `R$ ${(value / 1000).toFixed(1)}K`;
            }
        }

        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits
        }).format(value);
    }

    static formatNumber(value, locale = 'pt-BR') {
        if (typeof value !== 'number') {
            return value;
        }
        return value.toLocaleString(locale);
    }

    static formatNumberAbbreviated(value, locale = 'pt-BR') {
        if (typeof value !== 'number') {
            return value;
        }
        
        if (value >= 1000000) {
            const millions = value / 1000000;
            return millions >= 10 ? `${millions.toFixed(0)}M` : `${millions.toFixed(1)}M`;
        }
        
        if (value >= 1000) {
            const thousands = value / 1000;
            return thousands >= 10 ? `${thousands.toFixed(0)}K` : `${thousands.toFixed(1)}K`;
        }
        
        return value.toLocaleString(locale);
    }

    static formatDate(dateStr, options = {}) {
        const {
            locale = 'pt-BR',
            format = 'short'
        } = options;

        if (!dateStr) return 'N/A';
        
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return 'Data inválida';

            if (format === 'short') {
                return new Intl.DateTimeFormat(locale, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }).format(date);
            } else if (format === 'long') {
                return new Intl.DateTimeFormat(locale, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                }).format(date);
            } else {
                return new Intl.DateTimeFormat(locale, format).format(date);
            }
        } catch (error) {
            console.warn('Error formatting date:', dateStr, error);
            return 'Data inválida';
        }
    }

    static formatPercentage(value, decimals = 1) {
        if (typeof value !== 'number') return '0%';
        return `${value.toFixed(decimals)}%`;
    }

    static truncateText(text, maxLength = 50, suffix = '...') {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - suffix.length) + suffix;
    }

    static formatSQL(sql, options = {}) {
        const {
            indent = '    ',
            uppercase = true,
            linesBetweenQueries = 2
        } = options;

        if (!sql || typeof sql !== 'string') return sql;

        try {
            if (typeof window.sqlFormatter !== 'undefined') {
                return window.sqlFormatter.format(sql.trim(), {
                    language: 'sql',
                    indent,
                    uppercase,
                    linesBetweenQueries
                });
            }
            
            return sql.trim().split('\n').map(line => line.trim()).join('\n');
        } catch (error) {
            console.warn('SQL formatting error:', error);
            return sql.trim();
        }
    }
}

// ===== COLOR UTILITIES =====
export class ColorUtils {
    static categoryColors = [
        '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
        '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
    ];

    static getCategoryColor(categoria, options = {}) {
        const { useHash = true, defaultColor = '#6B7280' } = options;
        
        if (!categoria) return defaultColor;
        
        if (!useHash) {
            return this.categoryColors[0];
        }

        let hash = 0;
        for (let i = 0; i < categoria.length; i++) {
            const char = categoria.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        const colorIndex = Math.abs(hash) % this.categoryColors.length;
        return this.categoryColors[colorIndex];
    }

    static adjustColorBrightness(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, Math.max(0, (num >> 16) + amt));
        const G = Math.min(255, Math.max(0, (num >> 8 & 0x00FF) + amt));
        const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
        return `#${(0x1000000 + (R * 0x10000) + (G * 0x100) + B).toString(16).slice(1)}`;
    }

    static hexToRgba(hex, alpha = 1) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return null;
        
        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    static getContrastColor(backgroundColor) {
        const rgb = this.hexToRgba(backgroundColor);
        if (!rgb) return '#000000';
        
        const values = rgb.match(/\d+/g);
        const brightness = (parseInt(values[0]) * 299 + parseInt(values[1]) * 587 + parseInt(values[2]) * 114) / 1000;
        
        return brightness > 128 ? '#000000' : '#FFFFFF';
    }

    static generateGradient(color, direction = 'to bottom', lighten = 20) {
        const lightColor = this.adjustColorBrightness(color, lighten);
        return `linear-gradient(${direction}, ${color}, ${lightColor})`;
    }
}