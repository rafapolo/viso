// Theme Management for Index Application
import { COLORS } from '../core/config.js';
import { DOMUtils } from '../shared/dom-utils.js';

type ThemeName = 'dark' | 'light';

interface ThemeColors {
  linkStroke: string;
  backgroundColor: string;
  deputadoLabelColor: string;
  supplierLabelColor: string;
  selectionStroke: string;
  textColor: string;
  borderColor: string;
}

interface ThemeClasses {
  background: string;
  text: string;
  border: string;
  cardBg: string;
  buttonBg: string;
  inputBg: string;
}

interface ThemeSettings {
  currentTheme: ThemeName;
  colors: ThemeColors;
  classes: ThemeClasses;
}

export class ThemeManager {
  private currentTheme: ThemeName;

  constructor() {
    this.currentTheme = this.getInitialTheme();
  }

  getInitialTheme(): ThemeName {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'dark';
  }

  applyTheme(theme: ThemeName): void {
    const html = document.documentElement;
    const { body } = document;

    if (theme === 'dark') {
      html.classList.add('dark');
      body.className =
        'font-sans bg-white dark:bg-gray-950 text-gray-900 dark:text-white h-screen overflow-hidden';
    } else {
      html.classList.remove('dark');
      body.className = 'font-sans bg-white text-gray-900 h-screen overflow-hidden';
    }

    this.currentTheme = theme;
    localStorage.setItem('theme', theme);

    this.updateThemeToggleButton(theme);
    this.updateVisualizationColors();
    this.updateSliderTheme();
  }

  toggleTheme(): void {
    const newTheme: ThemeName = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }

  updateThemeToggleButton(theme: ThemeName): void {
    const themeToggle = DOMUtils.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '🌙' : '🌞';
    }
  }

  getThemeColors(): ThemeColors {
    const isDark = this.currentTheme === 'dark';
    return {
      linkStroke: isDark ? COLORS.THEME.dark.border : COLORS.THEME.light.border,
      backgroundColor: isDark ? COLORS.THEME.dark.background : COLORS.THEME.light.background,
      deputadoLabelColor: isDark ? '#ffffff' : '#000000',
      supplierLabelColor: COLORS.ENTITIES.fornecedor,
      selectionStroke: '#FFD700',
      textColor: isDark ? '#ffffff' : '#000000',
      borderColor: isDark ? COLORS.THEME.dark.border : COLORS.THEME.light.border,
    };
  }

  updateVisualizationColors(): void {
    if (!window.d3) return;

    const colors = this.getThemeColors();

    const visualization = DOMUtils.getElementById('visualization');
    if (visualization) {
      visualization.style.backgroundColor = colors.backgroundColor;
    }

    type D3Any = Record<string, (...args: unknown[]) => D3Any>;
    const d3 = window.d3 as unknown as D3Any;
    const svg = d3['select']('#network-svg');

    svg['selectAll']('line')['attr']('stroke', colors.linkStroke);

    svg['selectAll']('text:not(.edge-label)')['attr'](
      'fill',
      (d: unknown) => {
        const node = d as { type?: string } | null;
        if (node && node.type === 'deputado') {
          return colors.deputadoLabelColor;
        }
        return colors.supplierLabelColor;
      }
    );
  }

  updateSliderTheme(): void {
    const isDark = this.currentTheme === 'dark';
    const slider = DOMUtils.getElementById('minValue');

    if (slider) {
      slider.style.display = 'none';
      slider.offsetHeight; // trigger reflow
      slider.style.display = 'block';

      if (isDark) {
        slider.style.setProperty('--track-bg', COLORS.THEME.dark.border);
        slider.style.setProperty('--thumb-border', COLORS.THEME.dark.background);
      } else {
        slider.style.setProperty('--track-bg', COLORS.THEME.light.border);
        slider.style.setProperty('--thumb-border', COLORS.THEME.light.background);
      }
    }
  }

  setupThemeToggle(): void {
    const themeToggle = DOMUtils.getElementById('theme-toggle');

    if (themeToggle) {
      DOMUtils.addEventListener(themeToggle, 'click', () => {
        this.toggleTheme();
      });
    }

    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addListener((e) => {
        if (!localStorage.getItem('theme')) {
          this.applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  initialize(): void {
    this.applyTheme(this.currentTheme);
    this.setupThemeToggle();

    document.addEventListener('visualizationUpdated', () => {
      setTimeout(() => {
        this.updateVisualizationColors();
      }, 100);
    });
  }

  getCurrentTheme(): ThemeName {
    return this.currentTheme;
  }

  isDarkTheme(): boolean {
    return this.currentTheme === 'dark';
  }

  forceThemeUpdate(): void {
    this.updateVisualizationColors();
    this.updateSliderTheme();

    document.dispatchEvent(
      new CustomEvent('themeChanged', {
        detail: { theme: this.currentTheme, colors: this.getThemeColors() },
      })
    );
  }

  getThemeClasses(): ThemeClasses {
    const isDark = this.isDarkTheme();

    return {
      background: isDark ? 'bg-gray-950' : 'bg-white',
      text: isDark ? 'text-white' : 'text-gray-900',
      border: isDark ? 'border-gray-700' : 'border-gray-300',
      cardBg: isDark ? 'bg-gray-800' : 'bg-gray-100',
      buttonBg: isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300',
      inputBg: isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300',
    };
  }

  applyThemeToElement(element: Element, elementType: string): void {
    if (!element) return;

    const classes = this.getThemeClasses();

    switch (elementType) {
      case 'card':
        element.className = `${element.className.replace(/bg-\w+-\d+/g, '')} ${classes.cardBg}`;
        break;
      case 'button':
        element.className = `${element.className.replace(/bg-\w+-\d+/g, '')} ${classes.buttonBg}`;
        break;
      case 'input':
        element.className = `${element.className.replace(/bg-\w+-\d+|border-\w+-\d+/g, '')} ${classes.inputBg}`;
        break;
      default:
        element.className = `${element.className.replace(/bg-\w+-\d+|text-\w+-\d+/g, '')} ${classes.background} ${classes.text}`;
    }
  }

  exportThemeSettings(): ThemeSettings {
    return {
      currentTheme: this.currentTheme,
      colors: this.getThemeColors(),
      classes: this.getThemeClasses(),
    };
  }

  importThemeSettings(settings: ThemeSettings): void {
    if (settings.currentTheme) {
      this.applyTheme(settings.currentTheme);
    }
  }

  dispose(): void {
    // Event listeners managed by DOMUtils
  }
}
