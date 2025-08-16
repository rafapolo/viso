// DOM Utilities
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