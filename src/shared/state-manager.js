// ===== STATE MANAGER =====
export class StateManager {
    constructor() {
        this.state = {};
        this.listeners = {};
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
    }

    setState(key, value, options = {}) {
        const { silent = false, saveToHistory = true } = options;
        
        const oldValue = this.state[key];
        this.state[key] = value;

        if (saveToHistory && oldValue !== value) {
            this.saveToHistory(key, oldValue, value);
        }

        if (!silent && this.listeners[key]) {
            this.listeners[key].forEach(callback => {
                try {
                    callback(value, oldValue);
                } catch (error) {
                    console.error('Error in state listener:', error);
                }
            });
        }

        return this;
    }

    getState(key, defaultValue = null) {
        return Object.prototype.hasOwnProperty.call(this.state, key) ? this.state[key] : defaultValue;
    }

    getAllState() {
        return { ...this.state };
    }

    subscribe(key, callback) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        this.listeners[key].push(callback);

        return () => {
            this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
        };
    }

    unsubscribe(key, callback) {
        if (this.listeners[key]) {
            this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
        }
    }

    saveToHistory(key, oldValue, newValue) {
        const entry = {
            timestamp: Date.now(),
            key,
            oldValue,
            newValue
        };

        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(entry);

        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    undo() {
        if (this.historyIndex >= 0) {
            const entry = this.history[this.historyIndex];
            this.setState(entry.key, entry.oldValue, { silent: false, saveToHistory: false });
            this.historyIndex--;
            return true;
        }
        return false;
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const entry = this.history[this.historyIndex];
            this.setState(entry.key, entry.newValue, { silent: false, saveToHistory: false });
            return true;
        }
        return false;
    }

    clearHistory() {
        this.history = [];
        this.historyIndex = -1;
    }

    reset() {
        this.state = {};
        this.listeners = {};
        this.clearHistory();
    }
}

// ===== URL STATE MANAGER =====
export class URLStateManager extends StateManager {
    constructor() {
        super();
        this.config = new Map();
        this.isUpdatingURL = false;
        
        window.addEventListener('popstate', () => {
            if (!this.isUpdatingURL) {
                this.loadFromURL();
            }
        });
    }

    configureParam(stateKey, config) {
        this.config.set(stateKey, {
            urlParam: config.urlParam || stateKey,
            serialize: config.serialize || JSON.stringify,
            deserialize: config.deserialize || JSON.parse,
            defaultValue: config.defaultValue || null
        });

        this.loadFromURL();
        return this;
    }

    setState(key, value, options = {}) {
        super.setState(key, value, options);
        
        if (this.config.has(key)) {
            this.updateURL();
        }
        
        return this;
    }

    loadFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        
        for (const [stateKey, config] of this.config) {
            const paramValue = urlParams.get(config.urlParam);
            
            if (paramValue !== null) {
                try {
                    const deserializedValue = config.deserialize(paramValue);
                    super.setState(stateKey, deserializedValue, { silent: false, saveToHistory: false });
                } catch (error) {
                    console.warn(`Error deserializing URL param ${config.urlParam}:`, error);
                }
            } else if (config.defaultValue !== null) {
                super.setState(stateKey, config.defaultValue, { silent: true, saveToHistory: false });
            }
        }
    }

    updateURL() {
        if (this.isUpdatingURL) return;
        
        this.isUpdatingURL = true;
        const url = new URL(window.location);
        
        for (const [stateKey, config] of this.config) {
            const value = this.getState(stateKey);
            
            if (value !== null && value !== config.defaultValue) {
                try {
                    const serializedValue = config.serialize(value);
                    url.searchParams.set(config.urlParam, serializedValue);
                } catch (error) {
                    console.warn(`Error serializing state ${stateKey}:`, error);
                }
            } else {
                url.searchParams.delete(config.urlParam);
            }
        }
        
        window.history.replaceState({}, '', url);
        this.isUpdatingURL = false;
    }
}

// ===== LOCAL STORAGE =====
export class LocalStorage {
    constructor(prefix = 'app_') {
        this.prefix = prefix;
    }

    setItem(key, value) {
        try {
            const serializedValue = JSON.stringify(value);
            localStorage.setItem(this.prefix + key, serializedValue);
        } catch (error) {
            console.warn('Error saving to localStorage:', error);
        }
    }

    getItem(key, defaultValue = null) {
        try {
            const serializedValue = localStorage.getItem(this.prefix + key);
            return serializedValue ? JSON.parse(serializedValue) : defaultValue;
        } catch (error) {
            console.warn('Error reading from localStorage:', error);
            return defaultValue;
        }
    }

    removeItem(key) {
        try {
            localStorage.removeItem(this.prefix + key);
        } catch (error) {
            console.warn('Error removing from localStorage:', error);
        }
    }

    clear() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.warn('Error clearing localStorage:', error);
        }
    }

    getAllKeys() {
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    keys.push(key.substring(this.prefix.length));
                }
            }
            return keys;
        } catch (error) {
            console.warn('Error getting localStorage keys:', error);
            return [];
        }
    }
}

// Global instances for backward compatibility
export const globalStateManager = new StateManager();
export const globalURLStateManager = new URLStateManager();
export const globalLocalStorage = new LocalStorage();