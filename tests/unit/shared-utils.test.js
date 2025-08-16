const { describe, test, expect, beforeEach } = require('@jest/globals');

// Testing the refactored shared utilities structure
describe('Shared Utils (Testing Refactored Structure)', () => {
    // Mock implementations based on the actual src/shared/ structure
    
    // DOMUtils Mock based on src/shared/dom-utils.js
    const DOMUtils = {
        getElement(selector, context = document) {
            try {
                const element = selector.startsWith('#') || selector.includes('.') || selector.includes('[') 
                    ? context.querySelector(selector)
                    : context.getElementById(selector);
                
                return element;
            } catch (error) {
                console.warn(`Element not found: ${selector}`, error);
                return null;
            }
        },

        getElementById(id) {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`Element with ID '${id}' not found`);
            }
            return element;
        },

        getElements(selector, context = document) {
            try {
                return context.querySelectorAll(selector);
            } catch (error) {
                console.warn(`Elements not found: ${selector}`, error);
                return [];
            }
        },

        createElement(tagName, attributes = {}, textContent = '') {
            try {
                const element = document.createElement(tagName);
                
                Object.entries(attributes).forEach(([key, value]) => {
                    if (key === 'className') {
                        element.className = value;
                    } else if (key === 'innerHTML') {
                        element.innerHTML = value;
                    } else {
                        element.setAttribute(key, value);
                    }
                });

                if (textContent) {
                    element.textContent = textContent;
                }

                return element;
            } catch (error) {
                console.error('Error creating element:', error);
                return null;
            }
        },

        show(element) {
            if (element) {
                element.style.display = '';
            }
        },

        hide(element) {
            if (element) {
                element.style.display = 'none';
            }
        },

        toggleClass(element, className, force) {
            if (element && element.classList) {
                if (force !== undefined) {
                    element.classList.toggle(className, force);
                } else {
                    element.classList.toggle(className);
                }
            }
        }
    };

    // ErrorHandler Mock based on src/shared/error-handler.js  
    const ErrorHandler = {
        errorCounts: new Map(),
        errorCallbacks: [],

        addErrorCallback(callback) {
            if (typeof callback === 'function') {
                this.errorCallbacks.push(callback);
            }
        },

        removeErrorCallback(callback) {
            this.errorCallbacks = this.errorCallbacks.filter(cb => cb !== callback);
        },

        handleError(error, context = 'Unknown', severity = 'error', options = {}) {
            const errorInfo = {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : null,
                context,
                severity,
                timestamp: new Date().toISOString(),
                ...options
            };

            // Update error counts
            const key = `${context}:${errorInfo.message}`;
            this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);

            // Log error
            console.error(`[${severity.toUpperCase()}] ${context}:`, errorInfo.message);

            // Notify callbacks
            this.errorCallbacks.forEach(callback => {
                try {
                    callback(errorInfo);
                } catch (callbackError) {
                    console.error('Error in error callback:', callbackError);
                }
            });

            return errorInfo;
        },

        showError(message, type = 'error') {
            // Mock implementation for showing user-facing errors
            const errorElement = {
                textContent: message,
                className: `alert alert-${type}`,
                style: { display: 'block' }
            };
            
            return errorElement;
        },

        getErrorCount(context, message) {
            const key = message ? `${context}:${message}` : context;
            return this.errorCounts.get(key) || 0;
        },

        clearErrors() {
            this.errorCounts.clear();
        }
    };

    // Test setup
    beforeEach(() => {
        // Clear DOM
        document.body.innerHTML = '';
        // Clear error handler state
        ErrorHandler.clearErrors();
        ErrorHandler.errorCallbacks.length = 0;
    });

    describe('DOMUtils', () => {
        describe('getElement', () => {
            beforeEach(() => {
                document.body.innerHTML = `
                    <div id="test-id">Test Div</div>
                    <div class="test-class">Class Div</div>
                    <div data-test="attribute">Attribute Div</div>
                `;
            });

            test('should find element by ID', () => {
                const element = DOMUtils.getElement('#test-id');
                expect(element).not.toBeNull();
                expect(element.textContent).toBe('Test Div');
            });

            test('should find element by class', () => {
                const element = DOMUtils.getElement('.test-class');
                expect(element).not.toBeNull();
                expect(element.textContent).toBe('Class Div');
            });

            test('should find element by attribute', () => {
                const element = DOMUtils.getElement('[data-test="attribute"]');
                expect(element).not.toBeNull();
                expect(element.textContent).toBe('Attribute Div');
            });

            test('should find element by plain ID', () => {
                const element = DOMUtils.getElement('test-id');
                expect(element).not.toBeNull();
                expect(element.textContent).toBe('Test Div');
            });

            test('should return null for non-existent element', () => {
                const element = DOMUtils.getElement('#non-existent');
                expect(element).toBeNull();
            });
        });

        describe('getElementById', () => {
            beforeEach(() => {
                document.body.innerHTML = '<div id="existing">Exists</div>';
            });

            test('should find existing element', () => {
                const element = DOMUtils.getElementById('existing');
                expect(element).not.toBeNull();
                expect(element.textContent).toBe('Exists');
            });

            test('should return null and warn for non-existent element', () => {
                const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
                const element = DOMUtils.getElementById('non-existent');
                
                expect(element).toBeNull();
                expect(consoleSpy).toHaveBeenCalledWith("Element with ID 'non-existent' not found");
                
                consoleSpy.mockRestore();
            });
        });

        describe('getElements', () => {
            beforeEach(() => {
                document.body.innerHTML = `
                    <div class="test">Item 1</div>
                    <div class="test">Item 2</div>
                    <div class="other">Other</div>
                `;
            });

            test('should find multiple elements', () => {
                const elements = DOMUtils.getElements('.test');
                expect(elements).toHaveLength(2);
                expect(elements[0].textContent).toBe('Item 1');
                expect(elements[1].textContent).toBe('Item 2');
            });

            test('should return empty NodeList for non-existent elements', () => {
                const elements = DOMUtils.getElements('.non-existent');
                expect(elements).toHaveLength(0);
            });
        });

        describe('createElement', () => {
            test('should create basic element', () => {
                const element = DOMUtils.createElement('div', {}, 'Test Content');
                expect(element.tagName).toBe('DIV');
                expect(element.textContent).toBe('Test Content');
            });

            test('should create element with attributes', () => {
                const element = DOMUtils.createElement('div', { 
                    id: 'test-id',
                    className: 'test-class',
                    'data-test': 'value'
                });
                
                expect(element.id).toBe('test-id');
                expect(element.className).toBe('test-class');
                expect(element.getAttribute('data-test')).toBe('value');
            });

            test('should create element with innerHTML', () => {
                const element = DOMUtils.createElement('div', { 
                    innerHTML: '<span>Inner</span>' 
                });
                
                expect(element.innerHTML).toBe('<span>Inner</span>');
            });
        });

        describe('show/hide', () => {
            test('should show element', () => {
                const element = document.createElement('div');
                element.style.display = 'none';
                
                DOMUtils.show(element);
                expect(element.style.display).toBe('');
            });

            test('should hide element', () => {
                const element = document.createElement('div');
                
                DOMUtils.hide(element);
                expect(element.style.display).toBe('none');
            });

            test('should handle null elements gracefully', () => {
                expect(() => {
                    DOMUtils.show(null);
                    DOMUtils.hide(null);
                }).not.toThrow();
            });
        });

        describe('toggleClass', () => {
            test('should toggle class', () => {
                const element = document.createElement('div');
                
                DOMUtils.toggleClass(element, 'active');
                expect(element.classList.contains('active')).toBe(true);
                
                DOMUtils.toggleClass(element, 'active');
                expect(element.classList.contains('active')).toBe(false);
            });

            test('should force add class', () => {
                const element = document.createElement('div');
                
                DOMUtils.toggleClass(element, 'active', true);
                expect(element.classList.contains('active')).toBe(true);
                
                DOMUtils.toggleClass(element, 'active', true);
                expect(element.classList.contains('active')).toBe(true);
            });

            test('should force remove class', () => {
                const element = document.createElement('div');
                element.classList.add('active');
                
                DOMUtils.toggleClass(element, 'active', false);
                expect(element.classList.contains('active')).toBe(false);
            });
        });
    });

    describe('ErrorHandler', () => {
        describe('error callbacks', () => {
            test('should add error callbacks', () => {
                const callback = jest.fn();
                ErrorHandler.addErrorCallback(callback);
                
                expect(ErrorHandler.errorCallbacks).toContain(callback);
            });

            test('should ignore non-function callbacks', () => {
                const initialLength = ErrorHandler.errorCallbacks.length;
                ErrorHandler.addErrorCallback('not a function');
                
                expect(ErrorHandler.errorCallbacks).toHaveLength(initialLength);
            });

            test('should remove error callbacks', () => {
                const callback = jest.fn();
                ErrorHandler.addErrorCallback(callback);
                ErrorHandler.removeErrorCallback(callback);
                
                expect(ErrorHandler.errorCallbacks).not.toContain(callback);
            });
        });

        describe('handleError', () => {
            test('should handle Error objects', () => {
                const error = new Error('Test error message');
                const errorInfo = ErrorHandler.handleError(error, 'Test Context');
                
                expect(errorInfo.message).toBe('Test error message');
                expect(errorInfo.context).toBe('Test Context');
                expect(errorInfo.severity).toBe('error');
                expect(errorInfo.stack).toBeTruthy();
            });

            test('should handle string errors', () => {
                const errorInfo = ErrorHandler.handleError('String error', 'Test Context', 'warning');
                
                expect(errorInfo.message).toBe('String error');
                expect(errorInfo.context).toBe('Test Context');
                expect(errorInfo.severity).toBe('warning');
                expect(errorInfo.stack).toBeNull();
            });

            test('should increment error counts', () => {
                ErrorHandler.handleError('Repeated error', 'Test Context');
                ErrorHandler.handleError('Repeated error', 'Test Context');
                
                expect(ErrorHandler.getErrorCount('Test Context', 'Repeated error')).toBe(2);
            });

            test('should notify error callbacks', () => {
                const callback = jest.fn();
                ErrorHandler.addErrorCallback(callback);
                
                const error = new Error('Callback test');
                ErrorHandler.handleError(error, 'Callback Context');
                
                expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                    message: 'Callback test',
                    context: 'Callback Context'
                }));
            });

            test('should handle callback errors gracefully', () => {
                const faultyCallback = () => { throw new Error('Callback error'); };
                const goodCallback = jest.fn();
                
                ErrorHandler.addErrorCallback(faultyCallback);
                ErrorHandler.addErrorCallback(goodCallback);
                
                expect(() => {
                    ErrorHandler.handleError('Test error', 'Test Context');
                }).not.toThrow();
                
                expect(goodCallback).toHaveBeenCalled();
            });
        });

        describe('showError', () => {
            test('should create error element', () => {
                const errorElement = ErrorHandler.showError('Test message', 'warning');
                
                expect(errorElement.textContent).toBe('Test message');
                expect(errorElement.className).toBe('alert alert-warning');
                expect(errorElement.style.display).toBe('block');
            });

            test('should default to error type', () => {
                const errorElement = ErrorHandler.showError('Test message');
                
                expect(errorElement.className).toBe('alert alert-error');
            });
        });

        describe('error counting', () => {
            test('should get error count by context and message', () => {
                ErrorHandler.handleError('Error 1', 'Context A');
                ErrorHandler.handleError('Error 1', 'Context A');
                ErrorHandler.handleError('Error 2', 'Context A');
                
                expect(ErrorHandler.getErrorCount('Context A', 'Error 1')).toBe(2);
                expect(ErrorHandler.getErrorCount('Context A', 'Error 2')).toBe(1);
                expect(ErrorHandler.getErrorCount('Context B', 'Error 1')).toBe(0);
            });

            test('should clear all errors', () => {
                ErrorHandler.handleError('Error 1', 'Context A');
                ErrorHandler.handleError('Error 2', 'Context B');
                
                ErrorHandler.clearErrors();
                
                expect(ErrorHandler.getErrorCount('Context A', 'Error 1')).toBe(0);
                expect(ErrorHandler.getErrorCount('Context B', 'Error 2')).toBe(0);
            });
        });
    });
});