// Theme Management for Index Application
import { COLORS } from '../shared/constants.js';
import { DOMUtils } from '../shared/dom-utils.js';

export class ThemeManager {
  constructor() {
    this.currentTheme = this.getInitialTheme();
  }

  /**
   * Get initial theme from system/storage
   * @returns {string} Theme name ('dark' or 'light')
   */
  getInitialTheme() {
    // Check if user has a saved preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme;
    }

    // Default to dark theme or use system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'dark'; // Default to dark for this application
  }

  /**
   * Apply theme to document
   * @param {string} theme - Theme name ('dark' or 'light')
   */
  applyTheme(theme) {
    const html = document.documentElement;
    const {body} = document;

    if (theme === 'dark') {
      html.classList.add('dark');
      body.className = 'font-sans bg-white dark:bg-gray-950 text-gray-900 dark:text-white h-screen overflow-hidden';
    } else {
      html.classList.remove('dark');
      body.className = 'font-sans bg-white text-gray-900 h-screen overflow-hidden';
    }

    this.currentTheme = theme;
    localStorage.setItem('theme', theme);

    // Update theme toggle button
    this.updateThemeToggleButton(theme);

    // Update visualization colors
    this.updateVisualizationColors();

    // Update slider theme
    this.updateSliderTheme();

    console.log(`🎨 Theme applied: ${theme}`);
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }

  /**
   * Update theme toggle button appearance
   * @param {string} theme - Current theme
   */
  updateThemeToggleButton(theme) {
    const themeToggle = DOMUtils.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '🌙' : '🌞';
    }
  }

  /**
   * Get theme-aware colors for visualization
   * @returns {Object} Color scheme object
   */
  getThemeColors() {
    const isDark = this.currentTheme === 'dark';
    return {
      linkStroke: isDark ? COLORS.THEME.DARK.BORDER : COLORS.THEME.LIGHT.BORDER,
      backgroundColor: isDark ? COLORS.THEME.DARK.BACKGROUND : COLORS.THEME.LIGHT.BACKGROUND,
      deputadoLabelColor: isDark ? COLORS.SEMANTIC.WHITE : COLORS.SEMANTIC.BLACK,
      supplierLabelColor: isDark ? COLORS.ENTITIES.SUPPLIER : COLORS.ENTITIES.SUPPLIER,
      selectionStroke: COLORS.SEMANTIC.SELECTION_GOLD,
      textColor: isDark ? COLORS.SEMANTIC.WHITE : COLORS.SEMANTIC.BLACK,
      borderColor: isDark ? COLORS.THEME.DARK.BORDER : COLORS.THEME.LIGHT.BORDER
    };
  }

  /**
   * Update D3 visualization colors based on current theme
   */
  updateVisualizationColors() {
    if (!window.d3) return;

    const colors = this.getThemeColors();

    // Update visualization container background
    const visualization = DOMUtils.getElementById('visualization');
    if (visualization) {
      visualization.style.backgroundColor = colors.backgroundColor;
    }

    // Update D3 elements
    const svg = window.d3.select("#network-svg");
    
    // Update link colors
    svg.selectAll("line")
      .attr("stroke", colors.linkStroke);

    // Update node label colors (excluding edge labels)
    svg.selectAll("text:not(.edge-label)")
      .attr("fill", d => {
        if (d && d.type === 'deputado') {
          return colors.deputadoLabelColor;
        }
        return colors.supplierLabelColor;
      });

    console.log('🎨 Visualization colors updated for theme:', this.currentTheme);
  }

  /**
   * Update slider styling for current theme
   */
  updateSliderTheme() {
    const isDark = this.currentTheme === 'dark';
    const slider = DOMUtils.getElementById('minValue');

    if (slider) {
      // Force re-render by temporarily changing display
      slider.style.display = 'none';
      slider.offsetHeight; // Trigger reflow
      slider.style.display = 'block';

      // Update CSS custom properties for slider styling
      if (isDark) {
        slider.style.setProperty('--track-bg', COLORS.THEME.DARK.BORDER);
        slider.style.setProperty('--thumb-border', COLORS.THEME.DARK.BACKGROUND);
      } else {
        slider.style.setProperty('--track-bg', COLORS.THEME.LIGHT.BORDER);
        slider.style.setProperty('--thumb-border', COLORS.THEME.LIGHT.BACKGROUND);
      }
    }
  }

  /**
   * Setup theme toggle event listeners
   */
  setupThemeToggle() {
    const themeToggle = DOMUtils.getElementById('theme-toggle');
    
    if (themeToggle) {
      DOMUtils.addEventListener(themeToggle, 'click', () => {
        this.toggleTheme();
      });
    }

    // Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addListener((e) => {
        // Only auto-switch if user hasn't manually set a preference
        if (!localStorage.getItem('theme')) {
          this.applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  /**
   * Initialize theme manager
   */
  initialize() {
    // Apply initial theme
    this.applyTheme(this.currentTheme);
    
    // Setup event listeners
    this.setupThemeToggle();
    
    // Listen for visualization updates to reapply colors
    document.addEventListener('visualizationUpdated', () => {
      setTimeout(() => {
        this.updateVisualizationColors();
      }, 100);
    });

    console.log('✅ Theme manager initialized');
  }

  /**
   * Get current theme
   * @returns {string} Current theme name
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Check if current theme is dark
   * @returns {boolean} Whether current theme is dark
   */
  isDarkTheme() {
    return this.currentTheme === 'dark';
  }

  /**
   * Force update all theme-dependent elements
   */
  forceThemeUpdate() {
    this.updateVisualizationColors();
    this.updateSliderTheme();
    
    // Dispatch event for other components to update
    document.dispatchEvent(new CustomEvent('themeChanged', {
      detail: { theme: this.currentTheme, colors: this.getThemeColors() }
    }));
  }

  /**
   * Get CSS classes for current theme
   * @returns {Object} CSS class names for different elements
   */
  getThemeClasses() {
    const isDark = this.isDarkTheme();
    
    return {
      background: isDark ? 'bg-gray-950' : 'bg-white',
      text: isDark ? 'text-white' : 'text-gray-900',
      border: isDark ? 'border-gray-700' : 'border-gray-300',
      cardBg: isDark ? 'bg-gray-800' : 'bg-gray-100',
      buttonBg: isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300',
      inputBg: isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
    };
  }

  /**
   * Apply theme to a specific element
   * @param {Element} element - Element to theme
   * @param {string} elementType - Type of element ('card', 'button', 'input', etc.)
   */
  applyThemeToElement(element, elementType) {
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

  /**
   * Export theme settings
   * @returns {Object} Theme configuration
   */
  exportThemeSettings() {
    return {
      currentTheme: this.currentTheme,
      colors: this.getThemeColors(),
      classes: this.getThemeClasses()
    };
  }

  /**
   * Import theme settings
   * @param {Object} settings - Theme settings to import
   */
  importThemeSettings(settings) {
    if (settings.currentTheme) {
      this.applyTheme(settings.currentTheme);
    }
  }

  /**
   * Dispose of theme manager
   */
  dispose() {
    // Remove event listeners if needed
    const themeToggle = DOMUtils.getElementById('theme-toggle');
    if (themeToggle) {
      // Event listeners are handled by DOMUtils, which manages cleanup
    }
  }
}