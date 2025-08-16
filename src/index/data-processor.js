// Data Processing for Network Visualization
import { APIUtils } from '../shared/api-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { APP_CONSTANTS } from '../shared/constants.js';

export class DataProcessor {
  constructor() {
    this.rawData = [];
    this.processedData = { nodes: [], links: [] };
    this.densityScores = new Map();
  }

  /**
   * Load and process data from DuckDB
   * @param {Object} filters - Data filters
   * @returns {Promise<Object>} Processed network data
   */
  async processData(filters = {}) {
    try {
      // Query aggregated data
      const result = await this.queryAggregatedData(filters);
      this.rawData = result.data || [];

      // Process into network format
      const networkData = this.transformToNetworkData(this.rawData);

      // Apply network filters
      this.processedData = this.applyNetworkFilters(networkData, filters);

      // Data processed into network format
      
      return this.processedData;

    } catch (error) {
      ErrorHandler.handleError(error, 'Data Processing');
      throw error;
    }
  }

  /**
   * Query aggregated data from DuckDB
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Query results
   */
  async queryAggregatedData(filters = {}) {
    const {
      minValue = 0,
      partyFilter = '',
      categoryFilter = '',
      searchFilter = ''
    } = filters;

    const whereClause = APIUtils.buildFilterClause({
      minValue,
      partyFilter,
      categoryFilter,
      searchFilter
    });

    const query = `
      SELECT 
        nome_parlamentar,
        sigla_partido,
        fornecedor,
        categoria_despesa,
        SUM(CAST(valor_liquido AS DOUBLE)) as total_value,
        COUNT(*) as transaction_count
      FROM despesas 
      ${whereClause}
      AND nome_parlamentar IS NOT NULL 
      AND sigla_partido IS NOT NULL 
      AND fornecedor IS NOT NULL 
      AND categoria_despesa IS NOT NULL
      AND valor_liquido > 0
      GROUP BY nome_parlamentar, sigla_partido, fornecedor, categoria_despesa
      HAVING SUM(CAST(valor_liquido AS DOUBLE)) > ${minValue}
      ORDER BY total_value DESC
    `;

    return await APIUtils.executeDuckDBQuery(query);
  }

  /**
   * Transform raw data into network format
   * @param {Array} data - Raw transaction data
   * @returns {Object} Network data with nodes and links
   */
  transformToNetworkData(data) {
    const nodes = new Map();
    const links = new Map();
    let nodeId = 0;

    // Handle empty or undefined data
    if (!data || !Array.isArray(data)) {
      console.warn('⚠️ No data available for network transformation');
      return { nodes: [], links: [] };
    }

    // Process each transaction record
    data.forEach(row => {
      const deputyKey = `deputy_${row.nome_parlamentar}`;
      const supplierKey = `supplier_${row.fornecedor}`;

      // Create deputy node
      if (!nodes.has(deputyKey)) {
        nodes.set(deputyKey, {
          id: deputyKey,
          nodeId: nodeId++,
          nome: row.nome_parlamentar,
          type: 'deputado',
          partido: row.sigla_partido,
          total_value: 0,
          transaction_count: 0,
          connections: 0
        });
      }

      // Create supplier node
      if (!nodes.has(supplierKey)) {
        nodes.set(supplierKey, {
          id: supplierKey,
          nodeId: nodeId++,
          nome: row.fornecedor,
          type: 'fornecedor',
          total_value: 0,
          transaction_count: 0,
          connections: 0
        });
      }

      // Update node values
      const deputyNode = nodes.get(deputyKey);
      const supplierNode = nodes.get(supplierKey);

      deputyNode.total_value += row.total_value;
      deputyNode.transaction_count += row.transaction_count;
      deputyNode.connections += 1;

      supplierNode.total_value += row.total_value;
      supplierNode.transaction_count += row.transaction_count;
      supplierNode.connections += 1;

      // Create link
      const linkKey = `${deputyKey}_${supplierKey}`;
      if (!links.has(linkKey)) {
        links.set(linkKey, {
          source: deputyKey,
          target: supplierKey,
          value: 0,
          transaction_count: 0,
          categoria: row.categoria_despesa
        });
      }

      const link = links.get(linkKey);
      link.value += row.total_value;
      link.transaction_count += row.transaction_count;
    });

    return {
      nodes: Array.from(nodes.values()),
      links: Array.from(links.values())
    };
  }

  /**
   * Apply network filtering options
   * @param {Object} networkData - Raw network data
   * @param {Object} filters - Network filters
   * @returns {Object} Filtered network data
   */
  applyNetworkFilters(networkData, filters = {}) {
    let filteredData = { ...networkData };

    // Apply density filtering
    if (filters.densityMode) {
      filteredData = this.filterByDensity(filteredData);
    }

    // Apply top expenses filtering
    if (filters.topExpensesMode) {
      filteredData = this.filterByTopExpenses(filteredData, 15);
    }

    return filteredData;
  }

  /**
   * Filter network by node density (top 20% most connected nodes)
   * @param {Object} networkData - Network data
   * @returns {Object} Filtered network data
   */
  filterByDensity(networkData) {
    // Calculate density scores
    const densityScores = this.calculateNodeDensity(networkData);
    
    // Get top 20% of nodes by connections
    const threshold = Math.ceil(networkData.nodes.length * APP_CONSTANTS.NETWORK.TOP_PERCENTILE);
    const topNodes = Array.from(densityScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, threshold)
      .map(([nodeId]) => nodeId);

    // Filter nodes and links
    const filteredNodes = networkData.nodes.filter(node => topNodes.includes(node.id));
    const filteredLinks = networkData.links.filter(link => 
      topNodes.includes(link.source) && topNodes.includes(link.target)
    );

    // Density filter applied

    return {
      nodes: filteredNodes,
      links: filteredLinks
    };
  }

  /**
   * Filter network by top expenses
   * @param {Object} networkData - Network data
   * @param {number} topCount - Number of top nodes to keep
   * @returns {Object} Filtered network data
   */
  filterByTopExpenses(networkData, topCount = 15) {
    // Sort nodes by total value and take top N
    const topNodes = networkData.nodes
      .sort((a, b) => b.total_value - a.total_value)
      .slice(0, topCount)
      .map(node => node.id);

    // Filter links to only include connections between top nodes
    const filteredLinks = networkData.links.filter(link =>
      topNodes.includes(link.source) && topNodes.includes(link.target)
    );

    const filteredNodes = networkData.nodes.filter(node => topNodes.includes(node.id));

    // Top expenses filter applied

    return {
      nodes: filteredNodes,
      links: filteredLinks
    };
  }

  /**
   * Calculate density scores for nodes
   * @param {Object} networkData - Network data
   * @returns {Map} Node density scores
   */
  calculateNodeDensity(networkData) {
    const densityScores = new Map();

    // Handle empty or undefined network data
    if (!networkData || !networkData.nodes || !networkData.links) {
      console.warn('⚠️ Invalid network data for density calculation');
      return densityScores;
    }

    // Initialize scores
    networkData.nodes.forEach(node => {
      densityScores.set(node.id, 0);
    });

    // Count connections
    networkData.links.forEach(link => {
      const sourceScore = densityScores.get(link.source) || 0;
      const targetScore = densityScores.get(link.target) || 0;
      
      densityScores.set(link.source, sourceScore + 1);
      densityScores.set(link.target, targetScore + 1);
    });

    this.densityScores = densityScores;
    return densityScores;
  }

  /**
   * Get statistics for current processed data
   * @returns {Object} Statistics object
   */
  getStatistics() {
    const stats = {
      totalDeputados: 0,
      totalFornecedores: 0,
      totalValue: 0,
      totalTransactions: 0,
      avgTransactionValue: 0
    };

    if (this.processedData.nodes) {
      this.processedData.nodes.forEach(node => {
        if (node.type === 'deputado') {
          stats.totalDeputados++;
        } else if (node.type === 'fornecedor') {
          stats.totalFornecedores++;
        }
        
        stats.totalValue += node.total_value || 0;
        stats.totalTransactions += node.transaction_count || 0;
      });
    }

    if (stats.totalTransactions > 0) {
      stats.avgTransactionValue = stats.totalValue / stats.totalTransactions;
    }

    return stats;
  }

  /**
   * Update statistics display in UI
   * @param {Object} customStats - Optional custom statistics
   */
  updateStatisticsDisplay(customStats = null) {
    const stats = customStats || this.getStatistics();

    const updateStat = (id, value, isValue = false) => {
      const element = document.getElementById(id);
      if (element) {
        const displayValue = isValue ? 
          `R$ ${(value || 0).toLocaleString()}` : 
          (value || 0).toLocaleString();
        element.textContent = displayValue;
      }
    };

    updateStat('totalDeputados', stats.totalDeputados);
    updateStat('totalFornecedores', stats.totalFornecedores);
    updateStat('totalValue', stats.totalValue, true);
    updateStat('totalTransactions', stats.totalTransactions);
  }

  /**
   * Get node details for information panel
   * @param {Object} nodeData - Node data
   * @returns {Promise<Object>} Detailed node information
   */
  async getNodeDetails(nodeData) {
    try {
      if (nodeData.type === 'deputado') {
        return await this.getDeputyDetails(nodeData);
      } else if (nodeData.type === 'fornecedor') {
        return await this.getSupplierDetails(nodeData);
      }
      
      return { transactions: [], summary: {} };
    } catch (error) {
      ErrorHandler.handleError(error, 'Node Details Query');
      return { transactions: [], summary: {} };
    }
  }

  /**
   * Get deputy details
   * @param {Object} nodeData - Deputy node data
   * @returns {Promise<Object>} Deputy details
   */
  async getDeputyDetails(nodeData) {
    const query = `
      SELECT 
        fornecedor,
        categoria_despesa,
        SUM(CAST(valor_liquido AS DOUBLE)) as total_value,
        COUNT(*) as transaction_count,
        AVG(CAST(valor_liquido AS DOUBLE)) as avg_value,
        MAX(CAST(valor_liquido AS DOUBLE)) as max_value,
        MIN(data_emissao) as first_date,
        MAX(data_emissao) as last_date
      FROM despesas 
      WHERE nome_parlamentar = '${APIUtils.escapeSQLString(nodeData.nome)}'
      GROUP BY fornecedor, categoria_despesa
      ORDER BY total_value DESC
      LIMIT 50
    `;

    const result = await APIUtils.executeDuckDBQuery(query);
    
    return {
      transactions: result.data,
      summary: {
        totalSuppliers: new Set(result.data.map(r => r.fornecedor)).size,
        totalCategories: new Set(result.data.map(r => r.categoria_despesa)).size,
        totalValue: result.data.reduce((sum, r) => sum + (r.total_value || 0), 0),
        totalTransactions: result.data.reduce((sum, r) => sum + (r.transaction_count || 0), 0)
      }
    };
  }

  /**
   * Get supplier details
   * @param {Object} nodeData - Supplier node data
   * @returns {Promise<Object>} Supplier details
   */
  async getSupplierDetails(nodeData) {
    const query = `
      SELECT 
        nome_parlamentar,
        sigla_partido,
        categoria_despesa,
        SUM(CAST(valor_liquido AS DOUBLE)) as total_value,
        COUNT(*) as transaction_count,
        AVG(CAST(valor_liquido AS DOUBLE)) as avg_value,
        MAX(CAST(valor_liquido AS DOUBLE)) as max_value,
        MIN(data_emissao) as first_date,
        MAX(data_emissao) as last_date
      FROM despesas 
      WHERE fornecedor = '${APIUtils.escapeSQLString(nodeData.nome)}'
      GROUP BY nome_parlamentar, sigla_partido, categoria_despesa
      ORDER BY total_value DESC
      LIMIT 50
    `;

    const result = await APIUtils.executeDuckDBQuery(query);
    
    return {
      transactions: result.data,
      summary: {
        totalDeputies: new Set(result.data.map(r => r.nome_parlamentar)).size,
        totalParties: new Set(result.data.map(r => r.sigla_partido)).size,
        totalCategories: new Set(result.data.map(r => r.categoria_despesa)).size,
        totalValue: result.data.reduce((sum, r) => sum + (r.total_value || 0), 0),
        totalTransactions: result.data.reduce((sum, r) => sum + (r.transaction_count || 0), 0)
      }
    };
  }

  /**
   * Create pie chart data for categories
   * @param {Array} transactionData - Transaction data
   * @returns {Array} Pie chart data
   */
  createCategoryPieChartData(_transactionData) {
    const categoryTotals = new Map();

    // Handle empty or undefined data
    if (!this.rawData || !Array.isArray(this.rawData)) {
      console.warn('⚠️ No raw data available for pie chart');
      return [];
    }

    // Aggregate by category
    this.rawData.forEach(row => {
      const category = row.categoria_despesa;
      const currentTotal = categoryTotals.get(category) || 0;
      categoryTotals.set(category, currentTotal + (row.total_value || 0));
    });

    // Convert to array and sort
    const data = Array.from(categoryTotals.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, APP_CONSTANTS.TEXT.MAX_PIE_SLICES);

    return data;
  }

  /**
   * Get current processed data
   * @returns {Object} Current network data
   */
  getCurrentData() {
    return { ...this.processedData };
  }

  /**
   * Get raw data
   * @returns {Array} Raw transaction data
   */
  getRawData() {
    return [...this.rawData];
  }

  /**
   * Clear all data
   */
  clearData() {
    this.rawData = [];
    this.processedData = { nodes: [], links: [] };
    this.densityScores.clear();
  }

  /**
   * Export processed data to JSON
   * @returns {string} JSON string of processed data
   */
  exportData() {
    return JSON.stringify({
      metadata: {
        timestamp: new Date().toISOString(),
        nodeCount: this.processedData.nodes.length,
        linkCount: this.processedData.links.length,
        rawDataCount: this.rawData.length
      },
      network: this.processedData,
      statistics: this.getStatistics()
    }, null, 2);
  }
}