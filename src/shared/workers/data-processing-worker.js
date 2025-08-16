// Data Processing Worker for Heavy Computations
// Handles DuckDB operations, data aggregation, and complex calculations off the main thread

// Import DuckDB for worker context
importScripts('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-browser.js');

let duckdb = null;
let db = null;
let conn = null;
let isInitialized = false;

// Initialize DuckDB in worker context
async function initializeDuckDB() {
  if (isInitialized) return true;
  
  try {
    // Load DuckDB
    duckdb = self.duckdb;
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    
    // Create worker and database instance
    const worker = await duckdb.createWorker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    
    conn = await db.connect();
    
    // Test connection
    await conn.query('SELECT 1 as test');
    
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Worker DuckDB initialization failed:', error);
    throw error;
  }
}

// Register data in DuckDB
async function registerData(name, data, options = {}) {
  await initializeDuckDB();
  
  try {
    const { format = 'parquet', createView = true } = options;
    
    // Register the data buffer
    await db.registerFileBuffer(name, new Uint8Array(data));
    
    // Create view if requested
    if (createView) {
      const viewName = name.replace(/\.[^/.]+$/, ''); // Remove extension
      
      if (format === 'parquet') {
        await conn.query(`
          CREATE OR REPLACE VIEW ${viewName} AS 
          SELECT * FROM read_parquet('${name}')
        `);
      } else if (format === 'csv') {
        await conn.query(`
          CREATE OR REPLACE VIEW ${viewName} AS 
          SELECT * FROM read_csv_auto('${name}')
        `);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to register data ${name}:`, error);
    throw error;
  }
}

// Execute SQL query
async function executeQuery(sql, options = {}) {
  await initializeDuckDB();
  
  try {
    const {
      limit = null,
      offset = 0,
      returnMetadata = true
    } = options;
    
    let finalSql = sql;
    
    // Add pagination if specified
    if (limit !== null) {
      finalSql += ` LIMIT ${limit}`;
      if (offset > 0) {
        finalSql += ` OFFSET ${offset}`;
      }
    }
    
    const result = await conn.query(finalSql);
    const data = result.toArray();
    
    // Convert BigInt values to regular numbers for JSON serialization
    const processedData = data.map(row => {
      const processedRow = {};
      for (const [key, value] of Object.entries(row)) {
        processedRow[key] = typeof value === 'bigint' ? Number(value) : value;
      }
      return processedRow;
    });
    
    const response = {
      rows: processedData,
      rowCount: processedData.length
    };
    
    if (returnMetadata) {
      response.columns = result.schema.fields.map(field => ({
        name: field.name,
        type: field.type.toString()
      }));
      response.schema = result.schema.fields;
    }
    
    return response;
  } catch (error) {
    console.error('Query execution failed:', error);
    throw error;
  }
}

// Get data statistics
async function getDataStatistics(tableName, columnName = null) {
  await initializeDuckDB();
  
  try {
    let sql;
    
    if (columnName) {
      // Statistics for specific column
      sql = `
        SELECT 
          COUNT(*) as count,
          COUNT(DISTINCT ${columnName}) as distinct_count,
          MIN(${columnName}) as min_value,
          MAX(${columnName}) as max_value,
          AVG(${columnName}) as avg_value,
          STDDEV(${columnName}) as std_dev
        FROM ${tableName}
        WHERE ${columnName} IS NOT NULL
      `;
    } else {
      // General table statistics
      sql = `
        SELECT 
          COUNT(*) as total_rows,
          COUNT(*) as non_null_rows
        FROM ${tableName}
      `;
    }
    
    const result = await conn.query(sql);
    const stats = result.toArray()[0];
    
    // Convert BigInt values
    const processedStats = {};
    for (const [key, value] of Object.entries(stats)) {
      processedStats[key] = typeof value === 'bigint' ? Number(value) : value;
    }
    
    return processedStats;
  } catch (error) {
    console.error(`Failed to get statistics for ${tableName}:`, error);
    throw error;
  }
}

// Aggregate data for visualization
async function aggregateData(tableName, options = {}) {
  await initializeDuckDB();
  
  try {
    const {
      groupBy = [],
      aggregates = { count: 'COUNT(*)' },
      filters = [],
      orderBy = null,
      limit = 1000
    } = options;
    
    // Build WHERE clause
    let whereClause = '';
    if (filters.length > 0) {
      whereClause = 'WHERE ' + filters.join(' AND ');
    }
    
    // Build GROUP BY clause
    let groupByClause = '';
    if (groupBy.length > 0) {
      groupByClause = 'GROUP BY ' + groupBy.join(', ');
    }
    
    // Build SELECT clause
    const selectFields = [...groupBy];
    for (const [alias, expr] of Object.entries(aggregates)) {
      selectFields.push(`${expr} as ${alias}`);
    }
    
    // Build ORDER BY clause
    let orderByClause = '';
    if (orderBy) {
      orderByClause = `ORDER BY ${orderBy}`;
    }
    
    const sql = `
      SELECT ${selectFields.join(', ')}
      FROM ${tableName}
      ${whereClause}
      ${groupByClause}
      ${orderByClause}
      LIMIT ${limit}
    `;
    
    return await executeQuery(sql);
  } catch (error) {
    console.error('Data aggregation failed:', error);
    throw error;
  }
}

// Process network data for visualization
async function processNetworkData(tableName, options = {}) {
  await initializeDuckDB();
  
  try {
    const {
      sourceColumn,
      targetColumn,
      valueColumn = null,
      filters = [],
      minValue = 0,
      limit = 5000
    } = options;
    
    // Build WHERE clause
    let whereClause = `WHERE ${sourceColumn} IS NOT NULL AND ${targetColumn} IS NOT NULL`;
    if (filters.length > 0) {
      whereClause += ' AND ' + filters.join(' AND ');
    }
    if (valueColumn && minValue > 0) {
      whereClause += ` AND ${valueColumn} > ${minValue}`;
    }
    
    // Build aggregation query
    const valueSelect = valueColumn ? `, SUM(${valueColumn}) as total_value` : ', COUNT(*) as total_value';
    
    const sql = `
      SELECT 
        ${sourceColumn} as source,
        ${targetColumn} as target
        ${valueSelect}
      FROM ${tableName}
      ${whereClause}
      GROUP BY ${sourceColumn}, ${targetColumn}
      ORDER BY total_value DESC
      LIMIT ${limit}
    `;
    
    const result = await executeQuery(sql);
    
    // Transform to network format
    const nodes = new Map();
    const links = [];
    
    result.rows.forEach(row => {
      const { source, target, total_value } = row;
      
      // Add nodes
      if (!nodes.has(source)) {
        nodes.set(source, {
          id: source,
          type: 'source',
          value: 0,
          connections: 0
        });
      }
      if (!nodes.has(target)) {
        nodes.set(target, {
          id: target,
          type: 'target',
          value: 0,
          connections: 0
        });
      }
      
      // Update node values
      nodes.get(source).value += total_value;
      nodes.get(target).value += total_value;
      nodes.get(source).connections++;
      nodes.get(target).connections++;
      
      // Add link
      links.push({
        source,
        target,
        value: total_value
      });
    });
    
    return {
      nodes: Array.from(nodes.values()),
      links,
      statistics: {
        nodeCount: nodes.size,
        linkCount: links.length,
        totalValue: links.reduce((sum, link) => sum + link.value, 0)
      }
    };
  } catch (error) {
    console.error('Network data processing failed:', error);
    throw error;
  }
}

// Generate time series data
async function generateTimeSeries(tableName, options = {}) {
  await initializeDuckDB();
  
  try {
    const {
      dateColumn,
      valueColumn,
      aggregateFunction = 'SUM',
      groupBy = null,
      period = 'month', // day, week, month, year
      filters = []
    } = options;
    
    // Date truncation based on period
    const dateTrunc = {
      day: `DATE_TRUNC('day', ${dateColumn})`,
      week: `DATE_TRUNC('week', ${dateColumn})`,
      month: `DATE_TRUNC('month', ${dateColumn})`,
      year: `DATE_TRUNC('year', ${dateColumn})`
    };
    
    // Build WHERE clause
    let whereClause = `WHERE ${dateColumn} IS NOT NULL`;
    if (filters.length > 0) {
      whereClause += ' AND ' + filters.join(' AND ');
    }
    
    // Build GROUP BY clause
    const groupByFields = [dateTrunc[period] + ' as period'];
    if (groupBy) {
      groupByFields.push(groupBy);
    }
    
    const sql = `
      SELECT 
        ${groupByFields.join(', ')},
        ${aggregateFunction}(${valueColumn}) as value
      FROM ${tableName}
      ${whereClause}
      GROUP BY ${groupByFields.join(', ')}
      ORDER BY period
    `;
    
    return await executeQuery(sql);
  } catch (error) {
    console.error('Time series generation failed:', error);
    throw error;
  }
}

// Calculate complex metrics
async function calculateMetrics(tableName, metrics = {}) {
  await initializeDuckDB();
  
  try {
    const results = {};
    
    for (const [metricName, metricConfig] of Object.entries(metrics)) {
      const { type, column, filters = [], ...options } = metricConfig;
      
      let sql;
      let whereClause = '';
      if (filters.length > 0) {
        whereClause = 'WHERE ' + filters.join(' AND ');
      }
      
      switch (type) {
        case 'percentile':
          const { percentile = 50 } = options;
          sql = `
            SELECT PERCENTILE_CONT(${percentile / 100.0}) WITHIN GROUP (ORDER BY ${column}) as value
            FROM ${tableName} ${whereClause}
          `;
          break;
          
        case 'histogram':
          const { bins = 10 } = options;
          sql = `
            SELECT 
              WIDTH_BUCKET(${column}, 
                (SELECT MIN(${column}) FROM ${tableName} ${whereClause}),
                (SELECT MAX(${column}) FROM ${tableName} ${whereClause}),
                ${bins}
              ) as bin,
              COUNT(*) as count
            FROM ${tableName} ${whereClause}
            GROUP BY bin
            ORDER BY bin
          `;
          break;
          
        case 'correlation':
          const { withColumn } = options;
          sql = `
            SELECT CORR(${column}, ${withColumn}) as value
            FROM ${tableName} ${whereClause}
          `;
          break;
          
        default:
          // Standard aggregations
          sql = `
            SELECT ${type.toUpperCase()}(${column}) as value
            FROM ${tableName} ${whereClause}
          `;
      }
      
      const result = await executeQuery(sql);
      results[metricName] = result.rows[0]?.value || null;
    }
    
    return results;
  } catch (error) {
    console.error('Metrics calculation failed:', error);
    throw error;
  }
}

// Message handler
self.onmessage = async function(e) {
  const { id, type, ...params } = e.data;
  
  try {
    let result;
    
    switch (type) {
      case 'initialize':
        result = await initializeDuckDB();
        break;
        
      case 'register':
        result = await registerData(params.name, params.data, params.options);
        break;
        
      case 'query':
        result = await executeQuery(params.sql, params.options);
        break;
        
      case 'statistics':
        result = await getDataStatistics(params.tableName, params.columnName);
        break;
        
      case 'aggregate':
        result = await aggregateData(params.tableName, params.options);
        break;
        
      case 'network':
        result = await processNetworkData(params.tableName, params.options);
        break;
        
      case 'timeseries':
        result = await generateTimeSeries(params.tableName, params.options);
        break;
        
      case 'metrics':
        result = await calculateMetrics(params.tableName, params.metrics);
        break;
        
      default:
        throw new Error(`Unknown operation: ${type}`);
    }
    
    self.postMessage({
      id,
      type: 'success',
      result
    });
    
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
  }
};