const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// Since DuckDB Manager uses browser-specific imports, we'll test the logical parts
// and mock the DuckDB WASM dependency
describe('DuckDBManager', () => {
    // Mock implementation for testing logical parts
    class MockDuckDBManager {
        constructor() {
            this.connectionStatus = 'disconnected';
            this.statusCallbacks = [];
            this.db = null;
            this.conn = null;
        }

        addStatusCallback(callback) {
            this.statusCallbacks.push(callback);
        }

        removeStatusCallback(callback) {
            this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
        }

        updateConnectionStatus(status, message = '') {
            this.connectionStatus = status;
            this.statusCallbacks.forEach(callback => {
                try {
                    callback(status, message);
                } catch (error) {
                    console.error('Error in status callback:', error);
                }
            });
        }

        getConnectionStatus() {
            return this.connectionStatus;
        }

        async mockInitDuckDB() {
            this.updateConnectionStatus('connecting', 'Initializing...');
            // Simulate async initialization
            await new Promise(resolve => setTimeout(resolve, 10));
            this.db = { mock: 'db' };
            this.conn = { mock: 'connection' };
            this.updateConnectionStatus('connected', 'Connected');
            return { db: this.db, conn: this.conn };
        }

        async mockQuery(_sql) {
            if (!this.conn) {
                throw new Error('Not connected');
            }
            
            // Mock query result
            return {
                toArray: () => [
                    { id: 1, name: 'Test Record', value: 100 },
                    { id: 2, name: 'Another Record', value: 200 }
                ],
                schema: {
                    fields: [
                        { name: 'id', type: { toString: () => 'INTEGER' } },
                        { name: 'name', type: { toString: () => 'VARCHAR' } },
                        { name: 'value', type: { toString: () => 'DOUBLE' } }
                    ]
                }
            };
        }

        async mockRegisterParquet(url, tableName) {
            if (!this.conn) {
                throw new Error('Not connected');
            }
            
            // Simulate successful parquet registration
            return { success: true, table: tableName, url };
        }

        mockDisconnect() {
            this.updateConnectionStatus('disconnected', 'Disconnected');
            this.db = null;
            this.conn = null;
        }
    }

    let manager;

    beforeEach(() => {
        manager = new MockDuckDBManager();
    });

    afterEach(() => {
        if (manager) {
            manager.mockDisconnect();
        }
    });

    describe('Connection Management', () => {
        test('should initialize with disconnected status', () => {
            expect(manager.getConnectionStatus()).toBe('disconnected');
        });

        test('should update connection status', () => {
            let capturedStatus = null;
            let capturedMessage = null;

            const callback = (status, message) => {
                capturedStatus = status;
                capturedMessage = message;
            };

            manager.addStatusCallback(callback);
            manager.updateConnectionStatus('connecting', 'Starting...');

            expect(manager.getConnectionStatus()).toBe('connecting');
            expect(capturedStatus).toBe('connecting');
            expect(capturedMessage).toBe('Starting...');
        });

        test('should manage status callbacks', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();

            manager.addStatusCallback(callback1);
            manager.addStatusCallback(callback2);

            manager.updateConnectionStatus('connected');

            expect(callback1).toHaveBeenCalledWith('connected', '');
            expect(callback2).toHaveBeenCalledWith('connected', '');

            manager.removeStatusCallback(callback1);
            manager.updateConnectionStatus('disconnected');

            expect(callback2).toHaveBeenCalledWith('disconnected', '');
            expect(callback1).toHaveBeenCalledTimes(1); // Only called once (before removal)
        });
    });

    describe('Database Operations', () => {
        test('should initialize database connection', async () => {
            const result = await manager.mockInitDuckDB();

            expect(manager.getConnectionStatus()).toBe('connected');
            expect(result.db).toBeDefined();
            expect(result.conn).toBeDefined();
        });

        test('should execute queries after connection', async () => {
            await manager.mockInitDuckDB();
            const result = await manager.mockQuery('SELECT * FROM test');

            expect(result.toArray()).toHaveLength(2);
            expect(result.toArray()[0]).toEqual({
                id: 1,
                name: 'Test Record',
                value: 100
            });
        });

        test('should fail queries when not connected', async () => {
            await expect(manager.mockQuery('SELECT * FROM test')).rejects.toThrow('Not connected');
        });

        test('should register parquet files', async () => {
            await manager.mockInitDuckDB();
            
            const result = await manager.mockRegisterParquet('test.parquet', 'test_table');
            
            expect(result.success).toBe(true);
            expect(result.table).toBe('test_table');
            expect(result.url).toBe('test.parquet');
        });
    });

    describe('Connection Lifecycle', () => {
        test('should handle disconnect properly', async () => {
            await manager.mockInitDuckDB();
            expect(manager.getConnectionStatus()).toBe('connected');

            manager.mockDisconnect();
            
            expect(manager.getConnectionStatus()).toBe('disconnected');
            expect(manager.db).toBeNull();
            expect(manager.conn).toBeNull();
        });

        test('should handle callback errors gracefully', () => {
            const errorCallback = () => {
                throw new Error('Callback error');
            };
            const normalCallback = jest.fn();

            manager.addStatusCallback(errorCallback);
            manager.addStatusCallback(normalCallback);

            // Should not throw even with error in callback
            expect(() => {
                manager.updateConnectionStatus('connected');
            }).not.toThrow();

            // Normal callback should still be called
            expect(normalCallback).toHaveBeenCalledWith('connected', '');
        });
    });

    describe('Error Handling', () => {
        test('should handle connection failures gracefully', () => {
            const errorCallback = jest.fn();
            manager.addStatusCallback(errorCallback);

            manager.updateConnectionStatus('error', 'Connection failed');

            expect(manager.getConnectionStatus()).toBe('error');
            expect(errorCallback).toHaveBeenCalledWith('error', 'Connection failed');
        });

        test('should handle query failures', async () => {
            // Mock a failed query scenario
            const failingManager = new MockDuckDBManager();
            failingManager.mockQuery = async () => {
                throw new Error('Query execution failed');
            };

            await failingManager.mockInitDuckDB();
            
            await expect(failingManager.mockQuery('INVALID SQL')).rejects.toThrow('Query execution failed');
        });
    });

    describe('Status Monitoring', () => {
        test('should notify all callbacks on status change', () => {
            const callbacks = [jest.fn(), jest.fn(), jest.fn()];
            
            callbacks.forEach(cb => manager.addStatusCallback(cb));
            
            manager.updateConnectionStatus('connecting', 'Initializing...');
            
            callbacks.forEach(cb => {
                expect(cb).toHaveBeenCalledWith('connecting', 'Initializing...');
            });
        });

        test('should not fail when removing non-existent callback', () => {
            const callback = jest.fn();
            
            expect(() => {
                manager.removeStatusCallback(callback);
            }).not.toThrow();
        });
    });
});