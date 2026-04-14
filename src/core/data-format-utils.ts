// Data Processing and Formatting Utilities - Consolidated Module

// ===== DATA UTILITIES =====
export class DataUtils {
  static safeToNumber(value: unknown): number | unknown {
    if (typeof value === 'bigint') {
      return Number(value);
    }
    return value;
  }

  static convertNumericFields(
    obj: Record<string, unknown>,
    fields = ['total_value', 'transaction_count', 'valor_liquido', 'valor_documento']
  ): Record<string, unknown> {
    const result = { ...obj };
    fields.forEach(field => {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = this.safeToNumber(result[field]);
      }
    });
    return result;
  }

  static calculateStatistics(values: unknown[]): {
    count: number; sum: number; mean: number; median: number;
    min: number; max: number; standardDeviation: number;
  } {
    const empty = { count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0, standardDeviation: 0 };
    if (!Array.isArray(values) || !values.length) return empty;

    const numericValues = values.filter((v): v is number => typeof v === 'number' && !isNaN(v));
    if (!numericValues.length) return empty;

    const sum = numericValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / numericValues.length;

    const sortedValues = [...numericValues].sort((a, b) => a - b);
    const median = sortedValues.length % 2 === 0
      ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
      : sortedValues[Math.floor(sortedValues.length / 2)];

    const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length;

    return {
      count: numericValues.length,
      sum,
      mean,
      median,
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      standardDeviation: Math.sqrt(variance),
    };
  }

  static groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups: Record<string, T[]>, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {});
  }

  static aggregateBy<T>(
    array: T[],
    keyFn: (item: T) => string,
    valueFn: (item: T) => number,
    aggregateFn: (values: number[]) => number = (values) => values.reduce((a, b) => a + b, 0)
  ): Record<string, number> {
    const groups = this.groupBy(array, keyFn);
    const result: Record<string, number> = {};

    for (const [key, items] of Object.entries(groups)) {
      const values = items.map(valueFn);
      result[key] = aggregateFn(values);
    }

    return result;
  }

  static createSlug(text: string): string {
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

interface CurrencyFormatOptions {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  abbreviated?: boolean;
}

interface DateFormatOptions {
  locale?: string;
  format?: string | Intl.DateTimeFormatOptions;
}

interface SQLFormatOptions {
  indent?: string;
  uppercase?: boolean;
  linesBetweenQueries?: number;
}

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

  static formatNumber(value: number, locale = 'pt-BR'): string | number {
    if (typeof value !== 'number') {
      return value;
    }
    return value.toLocaleString(locale);
  }

  static formatNumberAbbreviated(value: number, locale = 'pt-BR'): string | number {
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

  static truncateText(text: string, maxLength = 50, suffix = '...'): string {
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

      return sql.trim().split('\n').map(line => line.trim()).join('\n');
    } catch (error) {
      console.warn('SQL formatting error:', error);
      return sql.trim();
    }
  }
}

// ===== COLOR UTILITIES =====

interface CategoryColorOptions {
  useHash?: boolean;
  defaultColor?: string;
}

export class ColorUtils {
  static categoryColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280',
  ];

  static getCategoryColor(categoria: string, options: CategoryColorOptions = {}): string {
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

  static adjustColorBrightness(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return `#${(0x1000000 + (R * 0x10000) + (G * 0x100) + B).toString(16).slice(1)}`;
  }

  static hexToRgba(hex: string, alpha = 1): string | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  static getContrastColor(backgroundColor: string): string {
    const rgb = this.hexToRgba(backgroundColor);
    if (!rgb) return '#000000';

    const values = rgb.match(/\d+/g);
    if (!values) return '#000000';
    const brightness = (parseInt(values[0]) * 299 + parseInt(values[1]) * 587 + parseInt(values[2]) * 114) / 1000;

    return brightness > 128 ? '#000000' : '#FFFFFF';
  }

  static generateGradient(color: string, direction = 'to bottom', lighten = 20): string {
    const lightColor = this.adjustColorBrightness(color, lighten);
    return `linear-gradient(${direction}, ${color}, ${lightColor})`;
  }
}
