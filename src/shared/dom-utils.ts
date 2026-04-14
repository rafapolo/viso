// DOM Utilities

export interface CreateElementOptions {
  id?: string;
  className?: string;
  innerHTML?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  style?: Partial<CSSStyleDeclaration>;
  dataset?: Record<string, string>;
}

export interface ElementBounds {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

export class DOMUtils {
  static getElement(
    selector: string,
    context: Document | Element = document
  ): Element | null {
    try {
      const element =
        selector.startsWith('#') || selector.includes('.') || selector.includes('[')
          ? context.querySelector(selector)
          : (context as Document).getElementById?.(selector) ??
            context.querySelector(`#${selector}`);

      return element;
    } catch {
      return null;
    }
  }

  static getElementById(id: string): HTMLElement | null {
    return document.getElementById(id);
  }

  static getElements(
    selector: string,
    context: Document | Element = document
  ): NodeListOf<Element> | Element[] {
    try {
      return context.querySelectorAll(selector);
    } catch {
      return [];
    }
  }

  static updateContent(
    element: string | Element,
    content: string,
    isHTML = true
  ): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    try {
      if (isHTML) {
        (el as HTMLElement).innerHTML = content;
      } else {
        el.textContent = content;
      }
      return true;
    } catch {
      return false;
    }
  }

  static updateAttributes(
    element: string | Element,
    attributes: Record<string, string | null | undefined>
  ): boolean {
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

  static toggleClass(
    element: string | Element,
    classes: string | string[],
    force?: boolean
  ): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    const classList = Array.isArray(classes) ? classes : [classes];

    try {
      classList.forEach((className) => {
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

    elementList.forEach((element) => {
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

    const { id, className, innerHTML, textContent, attributes = {}, style = {}, dataset = {} } =
      options;

    if (id) element.id = id;
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    if (textContent) element.textContent = textContent;

    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });

    Object.entries(style).forEach(([key, value]) => {
      if (value !== undefined) {
        element.style.setProperty(
          key.replace(/([A-Z])/g, '-$1').toLowerCase(),
          value as string
        );
      }
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
      (el as HTMLElement).innerHTML = '';
      return true;
    }
    return false;
  }

  static addEventListener(
    element: string | Element,
    event: string,
    handler: EventListener,
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
    handler: EventListener,
    options: boolean | AddEventListenerOptions = false
  ): number {
    const elements = this.getElements(selector);
    let successCount = 0;

    elements.forEach((element) => {
      if (this.addEventListener(element, event, handler, options)) {
        successCount++;
      }
    });

    return successCount;
  }

  static debounce<T extends unknown[]>(
    func: (this: unknown, ...args: T) => void,
    delay: number
  ): (...args: T) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (this: unknown, ...args: T) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  static throttle<T extends unknown[]>(
    func: (this: unknown, ...args: T) => void,
    limit: number
  ): (...args: T) => void {
    let inThrottle = false;
    return function (this: unknown, ...args: T) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  static getElementBounds(element: string | Element): ElementBounds | null {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
    };
  }

  static isElementVisible(element: string | Element, _threshold = 0): boolean {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    const vertInView = rect.top <= windowHeight && rect.top + rect.height >= 0;
    const horInView = rect.left <= windowWidth && rect.left + rect.width >= 0;

    return vertInView && horInView;
  }

  static getValue(element: string | Element): string | null {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return null;

    try {
      return (el as HTMLInputElement).value ?? '';
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
