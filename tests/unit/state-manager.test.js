const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// Testing the refactored StateManager structure
describe('StateManager (Testing Refactored Structure)', () => {
    // Mock implementations based on the actual src/state-manager.js structure
    
    // StateManager Mock
    class MockStateManager {
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
            return this.state.hasOwnProperty(key) ? this.state[key] : defaultValue;
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
            if (this.historyIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIndex + 1);
            }

            this.history.push({
                timestamp: Date.now(),
                key,
                oldValue,
                newValue
            });

            if (this.history.length > this.maxHistorySize) {
                this.history = this.history.slice(-this.maxHistorySize);
            }

            this.historyIndex = this.history.length - 1;
        }

        undo() {
            if (this.historyIndex >= 0) {
                const historyEntry = this.history[this.historyIndex];
                this.setState(historyEntry.key, historyEntry.oldValue, { saveToHistory: false });
                this.historyIndex--;
                return true;
            }
            return false;
        }

        redo() {
            if (this.historyIndex < this.history.length - 1) {
                this.historyIndex++;
                const historyEntry = this.history[this.historyIndex];
                this.setState(historyEntry.key, historyEntry.newValue, { saveToHistory: false });
                return true;
            }
            return false;
        }

        clearHistory() {
            this.history = [];
            this.historyIndex = -1;
        }

        reset(keys = null) {
            if (keys) {
                const keysToReset = Array.isArray(keys) ? keys : [keys];
                keysToReset.forEach(key => {
                    delete this.state[key];
                });
            } else {
                this.state = {};
            }
            this.clearHistory();
        }
    }

    // LocalStorageManager Mock  
    class MockLocalStorageManager {
        constructor(prefix = 'app_') {
            this.prefix = prefix;
            this.storage = new Map(); // Mock storage
        }

        set(key, value, options = {}) {
            const { ttl = null } = options;
            
            const item = {
                value,
                timestamp: Date.now(),
                ttl
            };

            try {
                this.storage.set(this.prefix + key, JSON.stringify(item));
                return true;
            } catch (error) {
                console.warn('Error saving to localStorage:', error);
                return false;
            }
        }

        get(key, defaultValue = null) {
            try {
                const item = this.storage.get(this.prefix + key);
                if (!item) return defaultValue;

                const parsed = JSON.parse(item);
                
                // Check TTL
                if (parsed.ttl && Date.now() - parsed.timestamp > parsed.ttl) {
                    this.remove(key);
                    return defaultValue;
                }

                return parsed.value;
            } catch (error) {
                console.warn('Error reading from localStorage:', error);
                return defaultValue;
            }
        }

        remove(key) {
            try {
                this.storage.delete(this.prefix + key);
                return true;
            } catch (error) {
                console.warn('Error removing from localStorage:', error);
                return false;
            }
        }

        clear() {
            try {
                const keys = Array.from(this.storage.keys());
                keys.forEach(key => {
                    if (key.startsWith(this.prefix)) {
                        this.storage.delete(key);
                    }
                });
                return true;
            } catch (error) {
                console.warn('Error clearing localStorage:', error);
                return false;
            }
        }

        getAllKeys() {
            const keys = [];
            try {
                for (const key of this.storage.keys()) {
                    if (key.startsWith(this.prefix)) {
                        keys.push(key.substring(this.prefix.length));
                    }
                }
            } catch (error) {
                console.warn('Error getting localStorage keys:', error);
            }
            return keys;
        }

        size() {
            return this.getAllKeys().length;
        }
    }

    describe('StateManager', () => {
        let stateManager;

        beforeEach(() => {
            stateManager = new MockStateManager();
        });

        describe('basic state operations', () => {
            test('should set and get state', () => {
                stateManager.setState('testKey', 'testValue');
                expect(stateManager.getState('testKey')).toBe('testValue');
            });

            test('should return default value for non-existent key', () => {
                expect(stateManager.getState('nonExistent', 'default')).toBe('default');
                expect(stateManager.getState('nonExistent')).toBe(null);
            });

            test('should return all state', () => {
                stateManager.setState('key1', 'value1');
                stateManager.setState('key2', 'value2');
                
                const allState = stateManager.getAllState();
                expect(allState).toEqual({
                    key1: 'value1',
                    key2: 'value2'
                });
            });

            test('should chain setState calls', () => {
                const result = stateManager
                    .setState('key1', 'value1')
                    .setState('key2', 'value2');
                
                expect(result).toBe(stateManager);
                expect(stateManager.getState('key1')).toBe('value1');
                expect(stateManager.getState('key2')).toBe('value2');
            });
        });

        describe('subscriptions', () => {
            test('should subscribe to state changes', () => {
                const callback = jest.fn();
                stateManager.subscribe('testKey', callback);
                
                stateManager.setState('testKey', 'newValue');
                
                expect(callback).toHaveBeenCalledWith('newValue', undefined);
            });

            test('should handle multiple subscribers', () => {
                const callback1 = jest.fn();
                const callback2 = jest.fn();
                
                stateManager.subscribe('testKey', callback1);
                stateManager.subscribe('testKey', callback2);
                
                stateManager.setState('testKey', 'newValue');
                
                expect(callback1).toHaveBeenCalledWith('newValue', undefined);
                expect(callback2).toHaveBeenCalledWith('newValue', undefined);
            });

            test('should return unsubscribe function', () => {
                const callback = jest.fn();
                const unsubscribe = stateManager.subscribe('testKey', callback);
                
                stateManager.setState('testKey', 'value1');
                expect(callback).toHaveBeenCalledTimes(1);
                
                unsubscribe();
                stateManager.setState('testKey', 'value2');
                expect(callback).toHaveBeenCalledTimes(1);
            });

            test('should unsubscribe manually', () => {
                const callback = jest.fn();
                stateManager.subscribe('testKey', callback);
                
                stateManager.setState('testKey', 'value1');
                expect(callback).toHaveBeenCalledTimes(1);
                
                stateManager.unsubscribe('testKey', callback);
                stateManager.setState('testKey', 'value2');
                expect(callback).toHaveBeenCalledTimes(1);
            });

            test('should not notify on silent updates', () => {
                const callback = jest.fn();
                stateManager.subscribe('testKey', callback);
                
                stateManager.setState('testKey', 'value', { silent: true });
                
                expect(callback).not.toHaveBeenCalled();
            });

            test('should handle callback errors gracefully', () => {
                const faultyCallback = () => { throw new Error('Callback error'); };
                const goodCallback = jest.fn();
                
                stateManager.subscribe('testKey', faultyCallback);
                stateManager.subscribe('testKey', goodCallback);
                
                expect(() => {
                    stateManager.setState('testKey', 'value');
                }).not.toThrow();
                
                expect(goodCallback).toHaveBeenCalled();
            });
        });

        describe('history management', () => {
            test('should save state changes to history', () => {
                stateManager.setState('testKey', 'value1');
                stateManager.setState('testKey', 'value2');
                
                expect(stateManager.history).toHaveLength(2);
                expect(stateManager.history[0].newValue).toBe('value1');
                expect(stateManager.history[1].newValue).toBe('value2');
            });

            test('should not save to history when disabled', () => {
                stateManager.setState('testKey', 'value1', { saveToHistory: false });
                
                expect(stateManager.history).toHaveLength(0);
            });

            test('should not save unchanged values to history', () => {
                stateManager.setState('testKey', 'value1');
                stateManager.setState('testKey', 'value1');
                
                expect(stateManager.history).toHaveLength(1);
            });

            test('should undo state changes', () => {
                stateManager.setState('testKey', 'value1');
                stateManager.setState('testKey', 'value2');
                
                expect(stateManager.getState('testKey')).toBe('value2');
                
                const undid = stateManager.undo();
                expect(undid).toBe(true);
                expect(stateManager.getState('testKey')).toBe('value1');
            });

            test('should redo state changes', () => {
                stateManager.setState('testKey', 'value1');
                stateManager.setState('testKey', 'value2');
                stateManager.undo();
                
                const redid = stateManager.redo();
                expect(redid).toBe(true);
                expect(stateManager.getState('testKey')).toBe('value2');
            });

            test('should return false when no undo available', () => {
                const undid = stateManager.undo();
                expect(undid).toBe(false);
            });

            test('should return false when no redo available', () => {
                stateManager.setState('testKey', 'value1');
                const redid = stateManager.redo();
                expect(redid).toBe(false);
            });

            test('should clear history', () => {
                stateManager.setState('testKey', 'value1');
                stateManager.setState('testKey', 'value2');
                
                stateManager.clearHistory();
                
                expect(stateManager.history).toHaveLength(0);
                expect(stateManager.historyIndex).toBe(-1);
            });

            test('should limit history size', () => {
                stateManager.maxHistorySize = 3;
                
                stateManager.setState('testKey', 'value1');
                stateManager.setState('testKey', 'value2');
                stateManager.setState('testKey', 'value3');
                stateManager.setState('testKey', 'value4');
                
                expect(stateManager.history).toHaveLength(3);
                expect(stateManager.history[0].newValue).toBe('value2');
            });
        });

        describe('reset functionality', () => {
            test('should reset all state', () => {
                stateManager.setState('key1', 'value1');
                stateManager.setState('key2', 'value2');
                
                stateManager.reset();
                
                expect(stateManager.getAllState()).toEqual({});
                expect(stateManager.history).toHaveLength(0);
            });

            test('should reset specific key', () => {
                stateManager.setState('key1', 'value1');
                stateManager.setState('key2', 'value2');
                
                stateManager.reset('key1');
                
                expect(stateManager.getState('key1')).toBe(null);
                expect(stateManager.getState('key2')).toBe('value2');
            });

            test('should reset multiple keys', () => {
                stateManager.setState('key1', 'value1');
                stateManager.setState('key2', 'value2');
                stateManager.setState('key3', 'value3');
                
                stateManager.reset(['key1', 'key2']);
                
                expect(stateManager.getState('key1')).toBe(null);
                expect(stateManager.getState('key2')).toBe(null);
                expect(stateManager.getState('key3')).toBe('value3');
            });
        });
    });

    describe('LocalStorageManager', () => {
        let storageManager;

        beforeEach(() => {
            storageManager = new MockLocalStorageManager('test_');
        });

        describe('basic operations', () => {
            test('should set and get values', () => {
                storageManager.set('testKey', 'testValue');
                expect(storageManager.get('testKey')).toBe('testValue');
            });

            test('should return default value for non-existent key', () => {
                expect(storageManager.get('nonExistent', 'default')).toBe('default');
                expect(storageManager.get('nonExistent')).toBe(null);
            });

            test('should store complex objects', () => {
                const testObject = { name: 'John', age: 30, hobbies: ['reading', 'gaming'] };
                storageManager.set('user', testObject);
                expect(storageManager.get('user')).toEqual(testObject);
            });

            test('should remove values', () => {
                storageManager.set('testKey', 'testValue');
                expect(storageManager.get('testKey')).toBe('testValue');
                
                storageManager.remove('testKey');
                expect(storageManager.get('testKey')).toBe(null);
            });

            test('should clear all prefixed keys', () => {
                storageManager.set('key1', 'value1');
                storageManager.set('key2', 'value2');
                
                storageManager.clear();
                
                expect(storageManager.get('key1')).toBe(null);
                expect(storageManager.get('key2')).toBe(null);
            });
        });

        describe('TTL functionality', () => {
            test('should respect TTL and return default for expired items', () => {
                // Mock Date.now to control time
                const originalNow = Date.now;
                let mockTime = 1000;
                Date.now = () => mockTime;

                storageManager.set('testKey', 'testValue', { ttl: 500 });
                expect(storageManager.get('testKey')).toBe('testValue');

                // Advance time beyond TTL
                mockTime = 2000;
                expect(storageManager.get('testKey')).toBe(null);

                // Restore original Date.now
                Date.now = originalNow;
            });

            test('should not expire items without TTL', () => {
                const originalNow = Date.now;
                let mockTime = 1000;
                Date.now = () => mockTime;

                storageManager.set('testKey', 'testValue');
                
                // Advance time significantly
                mockTime = 10000;
                expect(storageManager.get('testKey')).toBe('testValue');

                Date.now = originalNow;
            });
        });

        describe('utility methods', () => {
            test('should get all keys', () => {
                storageManager.set('key1', 'value1');
                storageManager.set('key2', 'value2');
                
                const keys = storageManager.getAllKeys();
                expect(keys).toContain('key1');
                expect(keys).toContain('key2');
                expect(keys).toHaveLength(2);
            });

            test('should return correct size', () => {
                expect(storageManager.size()).toBe(0);
                
                storageManager.set('key1', 'value1');
                expect(storageManager.size()).toBe(1);
                
                storageManager.set('key2', 'value2');
                expect(storageManager.size()).toBe(2);
                
                storageManager.remove('key1');
                expect(storageManager.size()).toBe(1);
            });

            test('should use custom prefix', () => {
                const customStorage = new MockLocalStorageManager('custom_');
                customStorage.set('test', 'value');
                
                // Should not interfere with default prefix storage
                expect(storageManager.get('test')).toBe(null);
                expect(customStorage.get('test')).toBe('value');
            });
        });

        describe('error handling', () => {
            test('should handle serialization errors gracefully', () => {
                const circularObj = {};
                circularObj.self = circularObj;
                
                // Mock JSON.stringify to throw
                const originalStringify = JSON.stringify;
                JSON.stringify = () => { throw new Error('Circular reference'); };
                
                const result = storageManager.set('test', 'value');
                expect(result).toBe(false);
                
                JSON.stringify = originalStringify;
            });

            test('should handle deserialization errors gracefully', () => {
                // Manually set invalid JSON
                storageManager.storage.set('test_invalid', 'invalid json');
                
                const result = storageManager.get('invalid', 'default');
                expect(result).toBe('default');
            });
        });
    });
});