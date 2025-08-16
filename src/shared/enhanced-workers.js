// Enhanced Workers - Data Processing + Background Sync Workers
export const createDataProcessingWorker = () => {
  const workerCode = `
    let duckdb = null;
    let db = null;
    let conn = null;
    
    const initializeDuckDB = async () => {
      if (duckdb) return true;
      
      try {
        // Mock DuckDB implementation for worker
        duckdb = {
          async instantiate() {
            return {
              async connect() {
                return {
                  async query(sql) {
                    // Simulate query execution
                    return {
                      toArray() {
                        return [
                          { nome_parlamentar: 'João', valor_total: 1000 },
                          { nome_parlamentar: 'Maria', valor_total: 2000 }
                        ];
                      }
                    };
                  },
                  close() {}
                };
              }
            };
          }
        };
        
        db = await duckdb.instantiate();
        conn = await db.connect();
        return true;
        
      } catch (error) {
        console.error('Failed to initialize DuckDB in worker:', error);
        return false;
      }
    };
    
    const executeQuery = async (sql, options = {}) => {
      if (!conn) {
        await initializeDuckDB();
      }
      
      try {
        const result = await conn.query(sql);
        const rows = result.toArray();
        
        return {
          rows,
          rowCount: rows.length,
          columns: rows.length > 0 ? Object.keys(rows[0]) : []
        };
        
      } catch (error) {
        throw new Error(\`Query execution failed: \${error.message}\`);
      }
    };
    
    const aggregateData = async (tableName, options = {}) => {
      const { groupBy = [], aggregates = {}, filters = [], orderBy = '', limit = 1000 } = options;
      
      // Build SQL query
      let sql = 'SELECT ';
      
      // Add group by columns
      const selectCols = [...groupBy];
      
      // Add aggregates
      for (const [alias, expr] of Object.entries(aggregates)) {
        selectCols.push(\`\${expr} as \${alias}\`);
      }
      
      sql += selectCols.join(', ');
      sql += \` FROM \${tableName}\`;
      
      // Add filters
      if (filters.length > 0) {
        sql += ' WHERE ' + filters.join(' AND ');
      }
      
      // Add group by
      if (groupBy.length > 0) {
        sql += ' GROUP BY ' + groupBy.join(', ');
      }
      
      // Add order by
      if (orderBy) {
        sql += \` ORDER BY \${orderBy}\`;
      }
      
      // Add limit
      if (limit > 0) {
        sql += \` LIMIT \${limit}\`;
      }
      
      return await executeQuery(sql);
    };
    
    self.onmessage = async (event) => {
      const { id, type, data } = event.data;
      
      try {
        switch (type) {
          case 'init':
            const success = await initializeDuckDB();
            self.postMessage({ id, success });
            break;
            
          case 'query':
            const result = await executeQuery(data.sql, data.options);
            self.postMessage({ id, result });
            break;
            
          case 'aggregate':
            const aggResult = await aggregateData(data.tableName, data.options);
            self.postMessage({ id, result: aggResult });
            break;
            
          case 'terminate':
            if (conn) conn.close();
            self.close();
            break;
            
          default:
            throw new Error(\`Unknown message type: \${type}\`);
        }
        
      } catch (error) {
        self.postMessage({ id, error: error.message });
      }
    };
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

export const createBackgroundSyncWorker = () => {
  const workerCode = `
    let taskQueue = [];
    let isProcessing = false;
    let syncInterval = null;
    
    const processTask = async (task) => {
      try {
        switch (task.type) {
          case 'download':
            const response = await fetch(task.url);
            if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
            
            const data = await response.arrayBuffer();
            self.postMessage({
              type: 'taskComplete',
              taskId: task.id,
              result: { data, size: data.byteLength }
            });
            break;
            
          case 'cleanup':
            // Simulate cleanup
            await new Promise(resolve => setTimeout(resolve, 100));
            self.postMessage({
              type: 'taskComplete',
              taskId: task.id,
              result: { cleaned: 5 }
            });
            break;
            
          case 'sync':
            // Simulate sync operation
            await new Promise(resolve => setTimeout(resolve, 200));
            self.postMessage({
              type: 'taskComplete',
              taskId: task.id,
              result: { synced: true }
            });
            break;
            
          default:
            throw new Error(\`Unknown task type: \${task.type}\`);
        }
        
        task.status = 'completed';
        
      } catch (error) {
        task.status = 'failed';
        task.error = error.message;
        
        self.postMessage({
          type: 'taskError',
          taskId: task.id,
          error: error.message
        });
        
        // Retry logic
        if (task.retryCount > 0) {
          task.retryCount--;
          task.status = 'pending';
          taskQueue.push(task);
        }
      }
    };
    
    const processQueue = async () => {
      if (isProcessing || taskQueue.length === 0) return;
      
      isProcessing = true;
      
      while (taskQueue.length > 0) {
        const task = taskQueue.shift();
        if (task.status === 'pending') {
          await processTask(task);
        }
      }
      
      isProcessing = false;
    };
    
    const startPeriodicSync = (interval = 30000) => {
      if (syncInterval) clearInterval(syncInterval);
      
      syncInterval = setInterval(() => {
        if (navigator.onLine && taskQueue.length === 0) {
          self.postMessage({ type: 'periodicSync' });
        }
      }, interval);
    };
    
    self.onmessage = async (event) => {
      const { type, data } = event.data;
      
      try {
        switch (type) {
          case 'addTask':
            const task = {
              id: data.id || Date.now().toString(),
              type: data.type,
              status: 'pending',
              retryCount: data.retryCount || 3,
              ...data
            };
            
            taskQueue.push(task);
            processQueue();
            
            self.postMessage({
              type: 'taskAdded',
              taskId: task.id
            });
            break;
            
          case 'getQueueStatus':
            const status = {
              total: taskQueue.length,
              pending: taskQueue.filter(t => t.status === 'pending').length,
              processing: isProcessing ? 1 : 0,
              completed: taskQueue.filter(t => t.status === 'completed').length,
              failed: taskQueue.filter(t => t.status === 'failed').length
            };
            
            self.postMessage({
              type: 'queueStatus',
              status
            });
            break;
            
          case 'clearCompleted':
            const beforeCount = taskQueue.length;
            taskQueue = taskQueue.filter(t => t.status !== 'completed');
            const cleared = beforeCount - taskQueue.length;
            
            self.postMessage({
              type: 'tasksCleared',
              count: cleared
            });
            break;
            
          case 'startSync':
            startPeriodicSync(data.interval);
            self.postMessage({ type: 'syncStarted' });
            break;
            
          case 'stopSync':
            if (syncInterval) {
              clearInterval(syncInterval);
              syncInterval = null;
            }
            self.postMessage({ type: 'syncStopped' });
            break;
            
          case 'forceSync':
            processQueue();
            break;
            
          case 'terminate':
            if (syncInterval) clearInterval(syncInterval);
            self.close();
            break;
        }
        
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message
        });
      }
    };
    
    // Handle online/offline events
    self.addEventListener('online', () => {
      self.postMessage({ type: 'onlineStatusChanged', online: true });
      processQueue();
    });
    
    self.addEventListener('offline', () => {
      self.postMessage({ type: 'onlineStatusChanged', online: false });
    });
  `;
  
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};