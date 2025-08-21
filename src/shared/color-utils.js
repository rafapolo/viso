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

    static getPartyColor(party, options = {}) {
        const { defaultColor = '#3b82f6' } = options;
        
        if (!party) return defaultColor;
        
        // Predefined colors for common Brazilian parties
        const partyColors = {
            'PT': '#e11d1d',     // Red
            'PSDB': '#0070f3',   // Blue  
            'MDB': '#10b981',    // Green
            'PL': '#8b5cf6',     // Purple
            'PP': '#f59e0b',     // Orange
            'PSB': '#06b6d4',    // Cyan
            'PDT': '#84cc16',    // Lime
            'REPUBLICANOS': '#f97316', // Orange-red
            'UNIÃO': '#ec4899',  // Pink
            'PSL': '#6366f1',    // Indigo
            'PODE': '#14b8a6',   // Teal
            'DEM': '#0ea5e9',    // Sky blue
            'SOLIDARIEDADE': '#a855f7', // Violet
            'AVANTE': '#059669', // Emerald
            'PCdoB': '#dc2626',  // Red-600
            'REDE': '#16a34a',   // Green-600
            'PMN': '#ca8a04',    // Yellow-600
            'PROS': '#9333ea',   // Purple-600
            'PV': '#65a30d',     // Lime-600
            'PMB': '#2563eb'     // Blue-600
        };
        
        // Return predefined color if exists
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