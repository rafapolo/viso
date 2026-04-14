export interface SetStateOptions {
  silent?: boolean;
  saveToHistory?: boolean;
}

export interface HistoryEntry<T = unknown> {
  timestamp: number;
  key: string;
  oldValue: T;
  newValue: T;
}

export type StateListener<T = unknown> = (newValue: T, oldValue: T) => void;
export type UnsubscribeFn = () => void;

// ===== STATE MANAGER =====
export class StateManager {
  protected state: Record<string, unknown> = {};
  protected listeners: Record<string, StateListener[]> = {};
  protected history: HistoryEntry[] = [];
  protected historyIndex = -1;
  protected maxHistorySize = 50;

  setState(key: string, value: unknown, options: SetStateOptions = {}): this {
    const { silent = false, saveToHistory = true } = options;

    const oldValue = this.state[key];
    this.state[key] = value;

    if (saveToHistory && oldValue !== value) {
      this.saveToHistory(key, oldValue, value);
    }

    if (!silent && this.listeners[key]) {
      this.listeners[key].forEach((callback) => {
        try {
          callback(value, oldValue);
        } catch (error) {
          console.error('Error in state listener:', error);
        }
      });
    }

    return this;
  }

  getState<T = unknown>(key: string, defaultValue: T | null = null): T | null {
    return Object.prototype.hasOwnProperty.call(this.state, key)
      ? (this.state[key] as T)
      : defaultValue;
  }

  getAllState(): Record<string, unknown> {
    return { ...this.state };
  }

  subscribe(key: string, callback: StateListener): UnsubscribeFn {
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    this.listeners[key].push(callback);

    return () => {
      this.listeners[key] = this.listeners[key].filter((cb) => cb !== callback);
    };
  }

  unsubscribe(key: string, callback: StateListener): void {
    if (this.listeners[key]) {
      this.listeners[key] = this.listeners[key].filter((cb) => cb !== callback);
    }
  }

  saveToHistory(key: string, oldValue: unknown, newValue: unknown): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      key,
      oldValue,
      newValue,
    };

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(entry);

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  undo(): boolean {
    if (this.historyIndex >= 0) {
      const entry = this.history[this.historyIndex];
      this.setState(entry.key, entry.oldValue, { silent: false, saveToHistory: false });
      this.historyIndex--;
      return true;
    }
    return false;
  }

  redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const entry = this.history[this.historyIndex];
      this.setState(entry.key, entry.newValue, { silent: false, saveToHistory: false });
      return true;
    }
    return false;
  }

  clearHistory(): void {
    this.history = [];
    this.historyIndex = -1;
  }

  reset(): void {
    this.state = {};
    this.listeners = {};
    this.clearHistory();
  }
}

export interface URLParamConfig<T = unknown> {
  urlParam?: string;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  defaultValue?: T | null;
}

// ===== URL STATE MANAGER =====
export class URLStateManager extends StateManager {
  private config: Map<string, Required<URLParamConfig>> = new Map();
  private isUpdatingURL = false;

  constructor() {
    super();

    window.addEventListener('popstate', () => {
      if (!this.isUpdatingURL) {
        this.loadFromURL();
      }
    });
  }

  configureParam(stateKey: string, config: URLParamConfig): this {
    this.config.set(stateKey, {
      urlParam: config.urlParam ?? stateKey,
      serialize: config.serialize ?? JSON.stringify,
      deserialize: config.deserialize ?? JSON.parse,
      defaultValue: config.defaultValue ?? null,
    });

    this.loadFromURL();
    return this;
  }

  setState(key: string, value: unknown, options: SetStateOptions = {}): this {
    super.setState(key, value, options);

    if (this.config.has(key)) {
      this.updateURL();
    }

    return this;
  }

  loadFromURL(): void {
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

  updateURL(): void {
    if (this.isUpdatingURL) return;

    this.isUpdatingURL = true;
    const url = new URL(window.location.href);

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
  private prefix: string;

  constructor(prefix = 'app_') {
    this.prefix = prefix;
  }

  setItem(key: string, value: unknown): void {
    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(this.prefix + key, serializedValue);
    } catch (error) {
      console.warn('Error saving to localStorage:', error);
    }
  }

  getItem<T = unknown>(key: string, defaultValue: T | null = null): T | null {
    try {
      const serializedValue = localStorage.getItem(this.prefix + key);
      return serializedValue ? (JSON.parse(serializedValue) as T) : defaultValue;
    } catch (error) {
      console.warn('Error reading from localStorage:', error);
      return defaultValue;
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.warn('Error removing from localStorage:', error);
    }
  }

  clear(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Error clearing localStorage:', error);
    }
  }

  getAllKeys(): string[] {
    try {
      const keys: string[] = [];
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
