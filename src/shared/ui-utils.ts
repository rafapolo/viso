// ===== TOOLTIP MANAGER =====
export class TooltipManager {
  private tooltip: HTMLDivElement | null = null;
  private isVisible = false;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.createTooltip();
  }

  createTooltip(): void {
    if (document.getElementById('sankey-tooltip')) return;

    this.tooltip = document.createElement('div');
    this.tooltip.id = 'sankey-tooltip';
    this.tooltip.className = 'sankey-tooltip';
    this.tooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(10px);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.4;
      max-width: 300px;
      z-index: 10000;
      pointer-events: none;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      font-family: 'Inter', sans-serif;
    `;
    document.body.appendChild(this.tooltip);
  }

  show(content: string, x: number, y: number): void {
    if (!this.tooltip) return;
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    this.tooltip.innerHTML = content;

    const rect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x + 15;
    if (adjustedX + rect.width > viewportWidth - 10) adjustedX = x - rect.width - 15;

    let adjustedY = y - 10;
    if (adjustedY + rect.height > viewportHeight - 10) adjustedY = y - rect.height - 10;

    this.tooltip.style.left = `${Math.max(10, adjustedX)}px`;
    this.tooltip.style.top = `${Math.max(10, adjustedY)}px`;

    requestAnimationFrame(() => {
      if (!this.tooltip) return;
      this.tooltip.style.opacity = '1';
      this.tooltip.style.transform = 'translateY(0)';
      this.isVisible = true;
    });
  }

  hide(): void {
    if (!this.tooltip || !this.isVisible) return;
    this.tooltip.style.opacity = '0';
    this.tooltip.style.transform = 'translateY(10px)';
    this.isVisible = false;
    this.hideTimeout = setTimeout(() => {
      if (this.tooltip) this.tooltip.style.left = '-9999px';
    }, 150);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('pt-BR').format(value);
  }
}

// ===== UI COMPONENTS =====
export interface ThemeController {
  getCurrentTheme(): 'dark' | 'light';
  setTheme(theme: 'dark' | 'light'): void;
}

export interface PaginationOptions {
  currentPage?: number;
  totalPages?: number;
  maxVisiblePages?: number;
  onPageChange?: (page: number) => void;
}

export interface PaginationController {
  render(): void;
  generateButtons(): string[];
  createPageButton(page: number, isActive?: boolean): string;
  goToPage(page: number): void;
  updateTotalPages(total: number): void;
  currentPage: number;
  totalPages: number;
  maxVisiblePages: number;
  onPageChange: (page: number) => void;
}

export interface SearchOptions {
  placeholder?: string;
  onSearch?: (value: string) => void;
  debounceMs?: number;
  minChars?: number;
}

export interface SearchController {
  onSearch: (value: string) => void;
  handleInput(value: string): void;
  clear(): void;
  setValue(value: string): void;
  getValue(): string;
}

export interface NotificationOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface ChartData {
  category: string;
  value: number;
  percentage: number;
  color: string;
  startAngle: number;
  endAngle: number;
}

declare global {
  interface Window {
    toggleCategory: (categoryId: string) => void;
  }
}

export class UIComponents {
  static setupThemeToggle(toggleElementId = 'theme-toggle'): ThemeController | undefined {
    const themeToggle = document.getElementById(toggleElementId);
    const html = document.documentElement;

    if (!themeToggle) {
      console.warn(`Theme toggle element with id '${toggleElementId}' not found`);
      return;
    }

    const savedTheme = localStorage.getItem('theme') ?? 'dark';
    html.classList.toggle('dark', savedTheme === 'dark');

    themeToggle.addEventListener('click', () => {
      const isDark = html.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      themeToggle.dispatchEvent(
        new CustomEvent('themeChanged', { detail: { theme: isDark ? 'dark' : 'light' } })
      );
    });

    return {
      getCurrentTheme: () => (html.classList.contains('dark') ? 'dark' : 'light'),
      setTheme: (theme: 'dark' | 'light') => {
        html.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
      },
    };
  }

  static setupCategoryToggles(
    options: {
      categorySelector?: string;
      contentSelector?: string;
      chevronSelector?: string;
      allowMultiple?: boolean;
    } = {}
  ): (categoryId: string) => void {
    const {
      categorySelector = '.category-section',
      contentSelector = '.category-content',
      chevronSelector = '.category-chevron',
      allowMultiple = false,
    } = options;

    const toggleCategory = (categoryId: string): void => {
      const categorySection = document.querySelector(`[data-category="${categoryId}"]`);
      if (!categorySection) return;

      const content = categorySection.querySelector(contentSelector) as HTMLElement | null;
      const chevron = categorySection.querySelector(chevronSelector) as HTMLElement | null;
      if (!content || !chevron) return;

      const isCurrentlyOpen =
        content.style.display === 'block' ||
        window.getComputedStyle(content).display === 'block';

      if (!allowMultiple) {
        document.querySelectorAll<HTMLElement>(categorySelector).forEach((section) => {
          const otherContent = section.querySelector<HTMLElement>(contentSelector);
          const otherChevron = section.querySelector<HTMLElement>(chevronSelector);
          if (otherContent && otherChevron) {
            otherContent.style.display = 'none';
            otherChevron.style.transform = 'rotate(-90deg)';
          }
        });
      }

      if (!isCurrentlyOpen) {
        content.style.display = 'block';
        chevron.style.transform = 'rotate(0deg)';
      } else if (allowMultiple) {
        content.style.display = 'none';
        chevron.style.transform = 'rotate(-90deg)';
      }
    };

    window.toggleCategory = toggleCategory;
    return toggleCategory;
  }

  static async registerServiceWorker(
    swPath = '/sw.js',
    enableLogging = false
  ): Promise<ServiceWorkerRegistration | false> {
    if (!('serviceWorker' in navigator)) {
      if (enableLogging) console.warn('Service workers not supported');
      return false;
    }

    const isProduction =
      location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';

    if (!isProduction) {
      if (enableLogging) {
        // eslint-disable-next-line no-console
        console.log('SW registration skipped in development mode');
      }
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register(swPath);
      if (enableLogging) {
        // eslint-disable-next-line no-console
        console.log('SW registered: ', registration);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              UIComponents.createNotification(
                'Nova versão disponível. Recarregue a página para atualizar.',
                'info',
                10000
              );
            }
          });
        }
      });

      return registration;
    } catch (error) {
      if (enableLogging) {
        // eslint-disable-next-line no-console
        console.log('SW registration failed: ', error);
      }
      return false;
    }
  }

  static createPagination(containerId: string, options: PaginationOptions = {}): PaginationController | undefined {
    const {
      currentPage = 1,
      totalPages = 1,
      maxVisiblePages = 10,
      onPageChange = () => {},
    } = options;

    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`Pagination container with id '${containerId}' not found`);
      return;
    }

    const pagination: PaginationController = {
      currentPage,
      totalPages,
      maxVisiblePages,
      onPageChange,

      render() {
        if (this.totalPages <= 1) {
          container.innerHTML = '';
          (container as HTMLElement).style.display = 'none';
          return;
        }
        (container as HTMLElement).style.display = 'flex';
        container.className = 'flex items-center justify-center gap-2 mt-4';
        container.innerHTML = this.generateButtons().join('');

        container.querySelectorAll('button').forEach((button) => {
          button.addEventListener('click', (e) => {
            const page = parseInt((e.target as HTMLButtonElement).dataset['page'] ?? '');
            if (page && page !== this.currentPage) this.goToPage(page);
          });
        });
      },

      generateButtons() {
        const buttons: string[] = [];
        buttons.push(`
          <button data-page="${this.currentPage - 1}"
            class="px-3 py-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            ${this.currentPage === 1 ? 'disabled' : ''}>← Anterior</button>
        `);

        const startPage = Math.max(1, this.currentPage - Math.floor(this.maxVisiblePages / 2));
        const endPage = Math.min(this.totalPages, startPage + this.maxVisiblePages - 1);

        if (startPage > 1) {
          buttons.push(this.createPageButton(1));
          if (startPage > 2) buttons.push('<span class="px-2 text-gray-400">...</span>');
        }

        for (let i = startPage; i <= endPage; i++) {
          buttons.push(this.createPageButton(i, i === this.currentPage));
        }

        if (endPage < this.totalPages) {
          if (endPage < this.totalPages - 1)
            buttons.push('<span class="px-2 text-gray-400">...</span>');
          buttons.push(this.createPageButton(this.totalPages));
        }

        buttons.push(`
          <button data-page="${this.currentPage + 1}"
            class="px-3 py-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            ${this.currentPage === this.totalPages ? 'disabled' : ''}>Próxima →</button>
        `);

        return buttons;
      },

      createPageButton(page, isActive = false) {
        const activeClass = isActive
          ? 'bg-blue-600 text-white'
          : 'bg-gray-700 text-white hover:bg-gray-600';
        return `<button data-page="${page}" class="px-3 py-2 text-sm ${activeClass} rounded">${page}</button>`;
      },

      goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;
        this.currentPage = page;
        this.onPageChange(page);
        this.render();
      },

      updateTotalPages(total) {
        this.totalPages = total;
        if (this.currentPage > total) this.currentPage = Math.max(1, total);
        this.render();
      },
    };

    pagination.render();
    return pagination;
  }

  static createSearch(inputId: string, options: SearchOptions = {}): SearchController | undefined {
    const { placeholder = 'Pesquisar...', onSearch = () => {}, debounceMs = 300, minChars = 1 } =
      options;

    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (!input) {
      console.warn(`Search input with id '${inputId}' not found`);
      return;
    }

    input.placeholder = placeholder;

    let debounceTimer: ReturnType<typeof setTimeout>;

    const searchController: SearchController = {
      onSearch,

      handleInput(value) {
        clearTimeout(debounceTimer);
        if (value.length < minChars && value.length > 0) return;
        debounceTimer = setTimeout(() => this.onSearch(value), debounceMs);
      },

      clear() {
        input.value = '';
        this.onSearch('');
      },

      setValue(value) {
        input.value = value;
      },

      getValue() {
        return input.value;
      },
    };

    input.addEventListener('input', (e) =>
      searchController.handleInput((e.target as HTMLInputElement).value)
    );

    return searchController;
  }

  static createNotification(
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration = 5000
  ): { remove: () => void } {
    const typeStyles: Record<string, string> = {
      success: 'bg-green-600 border-green-500',
      error: 'bg-red-600 border-red-500',
      warning: 'bg-yellow-600 border-yellow-500',
      info: 'bg-blue-600 border-blue-500',
    };

    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white border ${typeStyles[type]} transform transition-transform duration-300 translate-x-full`;
    notification.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="flex-1">${message}</div>
        <button class="text-white hover:text-gray-200 notification-close">&times;</button>
      </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.classList.remove('translate-x-full'), 10);

    const remove = () => {
      notification.classList.add('translate-x-full');
      setTimeout(() => notification.remove(), 300);
    };

    notification.querySelector('.notification-close')!.addEventListener('click', remove);
    if (duration > 0) setTimeout(remove, duration);

    return { remove };
  }
}

// ===== CHART UTILITIES =====
export interface PieChartOptions {
  maxSlices?: number;
  showLegend?: boolean;
  legendElementId?: string | null;
  colors?: string[];
}

export class ChartUtils {
  static createCategoryPieChart(
    canvas: HTMLCanvasElement,
    data: [string, number][],
    options: PieChartOptions = {}
  ): ChartData[] | undefined {
    const {
      maxSlices = 10,
      showLegend = true,
      legendElementId = null,
      colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'],
    } = options;

    const ctx = canvas.getContext('2d')!;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - 20;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!data || !data.length) {
      this.showChartEmptyState(canvas);
      return;
    }

    const sortedData = [...data].sort((a, b) => b[1] - a[1]);
    const topData: [string, number][] = sortedData.slice(0, maxSlices);

    if (sortedData.length > maxSlices) {
      const othersValue = sortedData
        .slice(maxSlices)
        .reduce((sum, [, value]) => sum + value, 0);
      topData.push(['Outros', othersValue]);
    }

    const total = topData.reduce((sum, [, value]) => sum + value, 0);
    let currentAngle = -Math.PI / 2;

    const chartData: ChartData[] = topData.map(([category, value], index) => {
      const sliceAngle = (value / total) * 2 * Math.PI;
      const color = colors[index % colors.length];

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.lineTo(centerX, centerY);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 2;
      ctx.stroke();

      const result: ChartData = {
        category,
        value,
        percentage: (value / total) * 100,
        color,
        startAngle: currentAngle,
        endAngle: currentAngle + sliceAngle,
      };

      currentAngle += sliceAngle;
      return result;
    });

    if (showLegend && legendElementId) {
      this.createChartLegend(legendElementId, chartData);
    }

    return chartData;
  }

  static showChartEmptyState(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#6B7280';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhum dado disponível', canvas.width / 2, canvas.height / 2);
  }

  static createChartLegend(elementId: string, chartData: ChartData[]): void {
    const legendElement = document.getElementById(elementId);
    if (!legendElement) return;

    legendElement.innerHTML = chartData
      .map(
        (item) => `
      <div class="flex items-center gap-2 text-xs">
        <div class="w-3 h-3 rounded-full" style="background-color: ${item.color}"></div>
        <span class="flex-1 truncate text-gray-300">${item.category}</span>
        <span class="text-gray-400">${item.percentage.toFixed(1)}%</span>
      </div>
    `
      )
      .join('');
  }

  static addChartInteractivity(
    canvas: HTMLCanvasElement,
    chartData: ChartData[],
    onSliceClick: ((slice: ChartData) => void) | null = null,
    onSliceHover: ((slice: ChartData | null) => void) | null = null
  ): void {
    if (!chartData || !chartData.length) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - 20;

    const getSliceFromPoint = (x: number, y: number): ChartData | undefined => {
      const canvasX = (x - rect.left) * (canvas.width / rect.width);
      const canvasY = (y - rect.top) * (canvas.height / rect.height);
      const dx = canvasX - centerX;
      const dy = canvasY - centerY;
      if (Math.sqrt(dx * dx + dy * dy) > radius) return undefined;

      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;

      return chartData.find((slice) => angle >= slice.startAngle && angle < slice.endAngle);
    };

    if (onSliceClick) {
      canvas.addEventListener('click', (event) => {
        const slice = getSliceFromPoint(event.clientX, event.clientY);
        if (slice) onSliceClick(slice);
      });
    }

    if (onSliceHover) {
      canvas.addEventListener('mousemove', (event) => {
        const slice = getSliceFromPoint(event.clientX, event.clientY);
        onSliceHover(slice ?? null);
        canvas.style.cursor = slice ? 'pointer' : 'default';
      });
    }
  }
}
