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