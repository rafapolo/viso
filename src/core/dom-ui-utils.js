// DOM and Basic UI Utilities - Consolidated Module
// Consolidates: shared/dom-utils.js + basic parts of shared/ui-utils.js

// ===== DOM UTILITIES =====
export class DOMUtils {
  /**
   * Safe element selection with error handling
   * @param {string} selector - CSS selector or element ID
   * @param {Element} context - Parent element to search within (optional)
   * @returns {Element|null} Found element or null
   */
  static getElement(selector, context = document) {
    try {
      // Handle both ID strings and CSS selectors
      const element = selector.startsWith('#') || selector.includes('.') || selector.includes('[') 
        ? context.querySelector(selector)
        : context.getElementById(selector);
      
      return element;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get element by ID with warning if not found
   * @param {string} id - Element ID (without #)
   * @returns {Element|null} Found element or null
   */
  static getElementById(id) {
    const element = document.getElementById(id);
    return element;
  }

  /**
   * Get multiple elements with error handling
   * @param {string} selector - CSS selector
   * @param {Element} context - Parent element to search within (optional)
   * @returns {NodeList} Found elements (empty if none found)
   */
  static getElements(selector, context = document) {
    try {
      return context.querySelectorAll(selector);
    } catch (error) {
      return [];
    }
  }

  /**
   * Safely update element content
   * @param {string|Element} element - Element or selector
   * @param {string} content - HTML content to set
   * @param {boolean} isHTML - Whether content is HTML (true) or text (false)
   */
  static updateContent(element, content, isHTML = true) {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    try {
      if (isHTML) {
        el.innerHTML = content;
      } else {
        el.textContent = content;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Safely update element attributes
   * @param {string|Element} element - Element or selector
   * @param {Object} attributes - Key-value pairs of attributes to set
   */
  static updateAttributes(element, attributes) {
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
    } catch (error) {
      return false;
    }
  }

  /**
   * Toggle CSS classes safely
   * @param {string|Element} element - Element or selector
   * @param {string|string[]} classes - Class name(s) to toggle
   * @param {boolean} force - Force add (true) or remove (false)
   */
  static toggleClass(element, classes, force = undefined) {
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
    } catch (error) {
      return false;
    }
  }

  /**
   * Add CSS classes safely
   * @param {string|Element} element - Element or selector
   * @param {string|string[]} classes - Class name(s) to add
   */
  static addClass(element, classes) {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    const classList = Array.isArray(classes) ? classes : [classes];
    
    try {
      el.classList.add(...classList);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove CSS classes safely
   * @param {string|Element} element - Element or selector
   * @param {string|string[]} classes - Class name(s) to remove
   */
  static removeClass(element, classes) {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    const classList = Array.isArray(classes) ? classes : [classes];
    
    try {
      el.classList.remove(...classList);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Show/hide elements
   * @param {string|Element|Element[]} elements - Element(s) or selector(s)
   * @param {boolean} show - Whether to show (true) or hide (false)
   * @param {string} displayType - CSS display value when showing
   */
  static toggleVisibility(elements, show, displayType = 'block') {
    const elementList = Array.isArray(elements) ? elements : [elements];
    
    elementList.forEach(element => {
      const el = typeof element === 'string' ? this.getElement(element) : element;
      if (el) {
        el.style.display = show ? displayType : 'none';
      }
    });
  }

  /**
   * Create and append element
   * @param {string} tagName - HTML tag name
   * @param {Object} options - Element options
   * @param {Element} parent - Parent element to append to
   * @returns {Element} Created element
   */
  static createElement(tagName, options = {}, parent = null) {
    const element = document.createElement(tagName);
    
    const { 
      id, 
      className, 
      innerHTML, 
      textContent, 
      attributes = {}, 
      style = {},
      dataset = {}
    } = options;

    if (id) element.id = id;
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    if (textContent) element.textContent = textContent;

    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });

    // Set styles
    Object.entries(style).forEach(([key, value]) => {
      element.style[key] = value;
    });

    // Set data attributes
    Object.entries(dataset).forEach(([key, value]) => {
      element.dataset[key] = value;
    });

    if (parent) {
      parent.appendChild(element);
    }

    return element;
  }

  /**
   * Remove element safely
   * @param {string|Element} element - Element or selector to remove
   */
  static removeElement(element) {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
      return true;
    }
    return false;
  }

  /**
   * Clear element content
   * @param {string|Element} element - Element or selector to clear
   */
  static clearContent(element) {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (el) {
      el.innerHTML = '';
      return true;
    }
    return false;
  }

  /**
   * Add event listener with error handling
   * @param {string|Element} element - Element or selector
   * @param {string} event - Event type
   * @param {Function} handler - Event handler function
   * @param {boolean|Object} options - Event listener options
   */
  static addEventListener(element, event, handler, options = false) {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el || typeof handler !== 'function') return false;

    try {
      el.addEventListener(event, handler, options);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Add event listeners to multiple elements
   * @param {string} selector - CSS selector
   * @param {string} event - Event type
   * @param {Function} handler - Event handler function
   * @param {boolean|Object} options - Event listener options
   */
  static addEventListeners(selector, event, handler, options = false) {
    const elements = this.getElements(selector);
    let successCount = 0;

    elements.forEach(element => {
      if (this.addEventListener(element, event, handler, options)) {
        successCount++;
      }
    });

    return successCount;
  }

  /**
   * Debounce function calls
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  static debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Throttle function calls
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} Throttled function
   */
  static throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Get element dimensions and position
   * @param {string|Element} element - Element or selector
   * @returns {Object} Element bounds and position
   */
  static getElementBounds(element) {
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
      y: rect.y
    };
  }

  /**
   * Check if element is visible in viewport
   * @param {string|Element} element - Element or selector
   * @param {number} threshold - Visibility threshold (0-1)
   * @returns {boolean} Whether element is visible
   */
  static isElementVisible(element, _threshold = 0) {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    const vertInView = (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);
    const horInView = (rect.left <= windowWidth) && ((rect.left + rect.width) >= 0);

    return vertInView && horInView;
  }

  /**
   * Get input element value safely
   * @param {string|Element} element - Element or selector
   * @returns {string|null} Element value or null if not found
   */
  static getValue(element) {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return null;

    try {
      return el.value || '';
    } catch (error) {
      return null;
    }
  }

  /**
   * Set input element value safely
   * @param {string|Element} element - Element or selector
   * @param {string} value - Value to set
   * @returns {boolean} Success status
   */
  static setValue(element, value) {
    const el = typeof element === 'string' ? this.getElement(element) : element;
    if (!el) return false;

    try {
      el.value = value;
      return true;
    } catch (error) {
      return false;
    }
  }
}

// ===== BASIC UI COMPONENTS =====
export class BasicUIComponents {
  /**
   * Setup accordion-style category toggles
   * @param {Object} options - Configuration options
   */
  static setupCategoryToggles(options = {}) {
    const {
      categorySelector = '.category-section',
      contentSelector = '.category-content',
      chevronSelector = '.category-chevron',
      allowMultiple = false
    } = options;

    // Create the toggle function
    const toggleCategory = (categoryId) => {
      const categorySection = document.querySelector(`[data-category="${categoryId}"]`);
      if (!categorySection) return;
      
      const content = categorySection.querySelector(contentSelector);
      const chevron = categorySection.querySelector(chevronSelector);
      
      if (!content || !chevron) return;
      
      // Check if currently open
      const isCurrentlyOpen = content.style.display === 'block' || 
                              window.getComputedStyle(content).display === 'block';
      
      // If not allowing multiple, close all categories first
      if (!allowMultiple) {
        document.querySelectorAll(categorySelector).forEach(section => {
          const otherContent = section.querySelector(contentSelector);
          const otherChevron = section.querySelector(chevronSelector);
          
          if (otherContent && otherChevron) {
            otherContent.style.display = 'none';
            otherChevron.style.transform = 'rotate(-90deg)';
          }
        });
      }
      
      // If the clicked category was closed, open it
      if (!isCurrentlyOpen) {
        content.style.display = 'block';
        chevron.style.transform = 'rotate(0deg)';
      } else if (allowMultiple) {
        // If allowing multiple and it was open, close it
        content.style.display = 'none';
        chevron.style.transform = 'rotate(-90deg)';
      }
    };

    // Make function globally available
    window.toggleCategory = toggleCategory;
    
    return toggleCategory;
  }

  /**
   * Register service worker for PWA functionality
   * @param {string} swPath - Path to service worker file (default: '/sw.js')
   * @param {boolean} enableLogging - Enable console logging (default: false in production)
   */
  static async registerServiceWorker(swPath = '/sw.js', enableLogging = false) {
    if (!('serviceWorker' in navigator)) {
      if (enableLogging) console.warn('Service workers not supported');
      return false;
    }

    // Only register service worker in production
    const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
    
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
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
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
        // eslint-disable-next-line no-console
        console.log('SW registration failed: ', error);
      }
      return false;
    }
  }

  /**
   * Create a simple notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, warning, info)
   * @param {number} duration - Duration in milliseconds (0 for persistent)
   */
  static createNotification(message, type = 'info', duration = 5000) {
    const typeStyles = {
      success: 'bg-green-600 border-green-500',
      error: 'bg-red-600 border-red-500',
      warning: 'bg-yellow-600 border-yellow-500',
      info: 'bg-blue-600 border-blue-500'
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

    notification.querySelector('.notification-close').addEventListener('click', remove);

    if (duration > 0) {
      setTimeout(remove, duration);
    }

    return { remove };
  }
}

// ===== TOOLTIP MANAGER =====
export class TooltipManager {
    constructor() {
        this.tooltip = null;
        this.isVisible = false;
        this.hideTimeout = null;
        this.createTooltip();
    }

    createTooltip() {
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

    show(content, x, y) {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        this.tooltip.innerHTML = content;
        
        // Position tooltip
        const rect = this.tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Adjust horizontal position
        let adjustedX = x + 15;
        if (adjustedX + rect.width > viewportWidth - 10) {
            adjustedX = x - rect.width - 15;
        }
        
        // Adjust vertical position  
        let adjustedY = y - 10;
        if (adjustedY + rect.height > viewportHeight - 10) {
            adjustedY = y - rect.height - 10;
        }
        
        this.tooltip.style.left = `${Math.max(10, adjustedX)}px`;
        this.tooltip.style.top = `${Math.max(10, adjustedY)}px`;
        
        // Show with animation
        requestAnimationFrame(() => {
            this.tooltip.style.opacity = '1';
            this.tooltip.style.transform = 'translateY(0)';
            this.isVisible = true;
        });
    }

    hide() {
        if (!this.isVisible) return;
        
        this.tooltip.style.opacity = '0';
        this.tooltip.style.transform = 'translateY(10px)';
        this.isVisible = false;
        
        this.hideTimeout = setTimeout(() => {
            this.tooltip.style.left = '-9999px';
        }, 150);
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    formatNumber(value) {
        return new Intl.NumberFormat('pt-BR').format(value);
    }
}