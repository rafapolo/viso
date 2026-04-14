// DOM and Basic UI Utilities - Consolidated Module

// ===== DOM UTILITIES =====

interface CreateElementOptions {
  id?: string;
  className?: string;
  innerHTML?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  style?: Record<string, string>;
  dataset?: Record<string, string>;
}

export class DOMUtils {
  static getElement(selector: string, context: Document | Element = document): Element | null {
    try {
      const element = selector.startsWith('#') || selector.includes('.') || selector.includes('[')
        ? context.querySelector(selector)
        : document.getElementById(selector);

      return element;
    } catch {
      return null;
    }
  }

  static getElementById(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  static getElements(selector: string, context: Document | Element = document): NodeListOf<Element> | Element[] {
    try {
      return context.querySelectorAll(selector);
    } catch {
      return [];
    }
  }

  static updateContent(element: string | Element, content: string, isHTML = true): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    try {
      if (isHTML) {
        (el as Element).innerHTML = content;
      } else {
        (el as Element).textContent = content;
      }
      return true;
    } catch {
      return false;
    }
  }

  static updateAttributes(element: string | Element, attributes: Record<string, string | null | undefined>): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el || !attributes) return false;

    try {
      Object.entries(attributes).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          el.removeAttribute(key);
        } else {
          el.setAttribute(key, value);
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  static toggleClass(element: string | Element, classes: string | string[], force?: boolean): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    const classList = Array.isArray(classes) ? classes : [classes];

    try {
      classList.forEach(className => {
        if (force !== undefined) {
          el.classList.toggle(className, force);
        } else {
          el.classList.toggle(className);
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  static addClass(element: string | Element, classes: string | string[]): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    const classList = Array.isArray(classes) ? classes : [classes];

    try {
      el.classList.add(...classList);
      return true;
    } catch {
      return false;
    }
  }

  static removeClass(element: string | Element, classes: string | string[]): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    const classList = Array.isArray(classes) ? classes : [classes];

    try {
      el.classList.remove(...classList);
      return true;
    } catch {
      return false;
    }
  }

  static toggleVisibility(
    elements: string | Element | (string | Element)[],
    show: boolean,
    displayType = 'block'
  ): void {
    const elementList = Array.isArray(elements) ? elements : [elements];

    elementList.forEach(element => {
      const el = typeof element === 'string' ? this.getElement(element) : element;
      if (el) {
        (el as HTMLElement).style.display = show ? displayType : 'none';
      }
    });
  }

  static createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    options: CreateElementOptions = {},
    parent: Element | null = null
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);

    const { id, className, innerHTML, textContent, attributes = {}, style = {}, dataset = {} } = options;

    if (id) element.id = id;
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    if (textContent) element.textContent = textContent;

    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });

    Object.entries(style).forEach(([key, value]) => {
      element.style.setProperty(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
    });

    Object.entries(dataset).forEach(([key, value]) => {
      element.dataset[key] = value;
    });

    if (parent) {
      parent.appendChild(element);
    }

    return element;
  }

  static removeElement(element: string | Element): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
      return true;
    }
    return false;
  }

  static clearContent(element: string | Element): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (el) {
      (el as Element).innerHTML = '';
      return true;
    }
    return false;
  }

  static addEventListener(
    element: string | Element,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options: boolean | AddEventListenerOptions = false
  ): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el || typeof handler !== 'function') return false;

    try {
      el.addEventListener(event, handler, options);
      return true;
    } catch {
      return false;
    }
  }

  static addEventListeners(
    selector: string,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options: boolean | AddEventListenerOptions = false
  ): number {
    const elements = this.getElements(selector);
    let successCount = 0;

    elements.forEach((element: Element) => {
      if (this.addEventListener(element, event, handler, options)) {
        successCount++;
      }
    });

    return successCount;
  }

  static debounce<T extends (...args: unknown[]) => void>(func: T, delay: number): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (this: unknown, ...args: Parameters<T>) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  static throttle<T extends (...args: unknown[]) => void>(func: T, limit: number): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return function (this: unknown, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  static getElementBounds(element: string | Element): DOMRect | null {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return null;

    return el.getBoundingClientRect();
  }

  static isElementVisible(element: string | Element, _threshold = 0): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    const vertInView = (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);
    const horInView = (rect.left <= windowWidth) && ((rect.left + rect.width) >= 0);

    return vertInView && horInView;
  }

  static getValue(element: string | Element): string | null {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return null;

    try {
      return (el as HTMLInputElement).value || '';
    } catch {
      return null;
    }
  }

  static setValue(element: string | Element, value: string): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    try {
      (el as HTMLInputElement).value = value;
      return true;
    } catch {
      return false;
    }
  }
}

// ===== BASIC UI COMPONENTS =====

interface CategoryToggleOptions {
  categorySelector?: string;
  contentSelector?: string;
  chevronSelector?: string;
  allowMultiple?: boolean;
}

export class BasicUIComponents {
  static setupCategoryToggles(options: CategoryToggleOptions = {}): (categoryId: string) => void {
    const {
      categorySelector = '.category-section',
      contentSelector = '.category-content',
      chevronSelector = '.category-chevron',
      allowMultiple = false,
    } = options;

    const toggleCategory = (categoryId: string) => {
      const categorySection = document.querySelector<HTMLElement>(`[data-category="${categoryId}"]`);
      if (!categorySection) return;

      const content = categorySection.querySelector<HTMLElement>(contentSelector);
      const chevron = categorySection.querySelector<HTMLElement>(chevronSelector);

      if (!content || !chevron) return;

      const isCurrentlyOpen = content.style.display === 'block' ||
        window.getComputedStyle(content).display === 'block';

      if (!allowMultiple) {
        document.querySelectorAll<HTMLElement>(categorySelector).forEach(section => {
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

    (window as unknown as Record<string, unknown>)['toggleCategory'] = toggleCategory;

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

    const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';

    if (!isProduction) {
      if (enableLogging) {
        console.log('SW registration skipped in development mode');
      }
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register(swPath);

      if (enableLogging) {
        console.log('SW registered: ', registration);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              BasicUIComponents.createNotification(
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
        console.log('SW registration failed: ', error);
      }
      return false;
    }
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

    setTimeout(() => {
      notification.classList.remove('translate-x-full');
    }, 10);

    const remove = () => {
      notification.classList.add('translate-x-full');
      setTimeout(() => notification.remove(), 300);
    };

    notification.querySelector('.notification-close')?.addEventListener('click', remove);

    if (duration > 0) {
      setTimeout(remove, duration);
    }

    return { remove };
  }
}

// ===== TOOLTIP MANAGER =====

export class TooltipManager {
  private tooltip: HTMLElement | null;
  private isVisible: boolean;
  private hideTimeout: ReturnType<typeof setTimeout> | null;

  constructor() {
    this.tooltip = null;
    this.isVisible = false;
    this.hideTimeout = null;
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
    if (adjustedX + rect.width > viewportWidth - 10) {
      adjustedX = x - rect.width - 15;
    }

    let adjustedY = y - 10;
    if (adjustedY + rect.height > viewportHeight - 10) {
      adjustedY = y - rect.height - 10;
    }

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
    if (!this.isVisible || !this.tooltip) return;

    this.tooltip.style.opacity = '0';
    this.tooltip.style.transform = 'translateY(10px)';
    this.isVisible = false;

    this.hideTimeout = setTimeout(() => {
      if (this.tooltip) this.tooltip.style.left = '-9999px';
    }, 150);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('pt-BR').format(value);
  }
}
