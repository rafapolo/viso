export interface CurrencyFormatOptions {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  abbreviated?: boolean;
}

export interface DateFormatOptions {
  locale?: string;
  format?: 'short' | 'long' | Intl.DateTimeFormatOptions;
}

export interface SQLFormatOptions {
  indent?: string;
  uppercase?: boolean;
  linesBetweenQueries?: number;
}

// ===== FORMAT UTILITIES =====
export class FormatUtils {
  static formatCurrency(value: number, options: CurrencyFormatOptions = {}): string {
    const {
      locale = 'pt-BR',
      currency = 'BRL',
      minimumFractionDigits = 2,
      abbreviated = false,
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
      minimumFractionDigits,
    }).format(value);
  }

  static formatNumber(value: number, locale = 'pt-BR'): number | string {
    if (typeof value !== 'number') {
      return value;
    }
    return value.toLocaleString(locale);
  }

  static formatNumberAbbreviated(value: number, locale = 'pt-BR'): number | string {
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

  static formatDate(dateStr: string | null | undefined, options: DateFormatOptions = {}): string {
    const { locale = 'pt-BR', format = 'short' } = options;

    if (!dateStr) return 'N/A';

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Data inválida';

      if (format === 'short') {
        return new Intl.DateTimeFormat(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(date);
      } else if (format === 'long') {
        return new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(date);
      } else {
        return new Intl.DateTimeFormat(locale, format as Intl.DateTimeFormatOptions).format(date);
      }
    } catch (error) {
      console.warn('Error formatting date:', dateStr, error);
      return 'Data inválida';
    }
  }

  static formatPercentage(value: number, decimals = 1): string {
    if (typeof value !== 'number') return '0%';
    return `${value.toFixed(decimals)}%`;
  }

  static truncateText(text: string | null | undefined, maxLength = 50, suffix = '...'): string | null | undefined {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  static formatSQL(sql: string, options: SQLFormatOptions = {}): string {
    const { indent = '    ', uppercase = true, linesBetweenQueries = 2 } = options;

    if (!sql || typeof sql !== 'string') return sql;

    try {
      if (typeof window.sqlFormatter !== 'undefined') {
        return window.sqlFormatter.format(sql.trim(), {
          language: 'sql',
          indent,
          uppercase,
          linesBetweenQueries,
        });
      }

      return sql
        .trim()
        .split('\n')
        .map((line) => line.trim())
        .join('\n');
    } catch (error) {
      console.warn('SQL formatting error:', error);
      return sql.trim();
    }
  }
}
