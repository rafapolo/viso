export interface CategoryColorOptions {
  useHash?: boolean;
  defaultColor?: string;
}

export interface PartyColorOptions {
  defaultColor?: string;
}

export class ColorUtils {
  static categoryColors: string[] = [
    '#3B82F6',
    '#EF4444',
    '#10B981',
    '#F59E0B',
    '#8B5CF6',
    '#06B6D4',
    '#84CC16',
    '#F97316',
    '#EC4899',
    '#6B7280',
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
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
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
    const brightness =
      (parseInt(values[0]) * 299 + parseInt(values[1]) * 587 + parseInt(values[2]) * 114) / 1000;

    return brightness > 128 ? '#000000' : '#FFFFFF';
  }

  static generateGradient(color: string, direction = 'to bottom', lighten = 20): string {
    const lightColor = this.adjustColorBrightness(color, lighten);
    return `linear-gradient(${direction}, ${color}, ${lightColor})`;
  }

  static getPartyColor(party: string, options: PartyColorOptions = {}): string {
    const { defaultColor = '#3b82f6' } = options;

    if (!party) return defaultColor;

    // Predefined colors for common Brazilian parties
    const partyColors: Record<string, string> = {
      PT: '#e11d1d',
      PSDB: '#0070f3',
      MDB: '#10b981',
      PL: '#8b5cf6',
      PP: '#f59e0b',
      PSB: '#06b6d4',
      PDT: '#84cc16',
      REPUBLICANOS: '#f97316',
      UNIÃO: '#ec4899',
      PSL: '#6366f1',
      PODE: '#14b8a6',
      DEM: '#0ea5e9',
      SOLIDARIEDADE: '#a855f7',
      AVANTE: '#059669',
      PCdoB: '#dc2626',
      REDE: '#16a34a',
      PMN: '#ca8a04',
      PROS: '#9333ea',
      PV: '#65a30d',
      PMB: '#2563eb',
    };

    if (partyColors[party]) {
      return partyColors[party];
    }

    // Fallback to hash-based color generation for unknown parties
    let hash = 0;
    for (let i = 0; i < party.length; i++) {
      const char = party.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    const colorIndex = Math.abs(hash) % this.categoryColors.length;
    return this.categoryColors[colorIndex];
  }
}
