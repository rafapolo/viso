// Data Processing for Network Visualization
import { APIUtils } from '../shared/api-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { APP_CONSTANTS } from '../core/config.js';

interface DataFilters {
  minValue?: number;
  partyFilter?: string;
  categoryFilter?: string;
  searchFilter?: string;
  densityMode?: boolean;
  topExpensesMode?: boolean;
}

interface NetworkNode {
  id: string;
  nodeId: number;
  nome: string;
  type: 'deputado' | 'fornecedor';
  partido?: string;
  total_value: number;
  transaction_count: number;
  connections: number;
}

interface NetworkLink {
  source: string;
  target: string;
  value: number;
  transaction_count: number;
  categoria: string;
}

interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

interface RawRow {
  nome_parlamentar: string;
  sigla_partido: string;
  fornecedor: string;
  categoria_despesa: string;
  total_value: number;
  transaction_count: number;
}

interface NodeDetails {
  transactions: Record<string, unknown>[];
  summary: Record<string, unknown>;
}

interface NetworkStatistics {
  totalDeputados: number;
  totalFornecedores: number;
  totalValue: number;
  totalTransactions: number;
  avgTransactionValue: number;
}

interface PieChartData {
  category: string;
  value: number;
}

export class DataProcessor {
  private rawData: RawRow[];
  private processedData: NetworkData;
  private densityScores: Map<string, number>;

  constructor() {
    this.rawData = [];
    this.processedData = { nodes: [], links: [] };
    this.densityScores = new Map();
  }

  async processData(filters: DataFilters = {}): Promise<NetworkData> {
    try {
      const result = await this.queryAggregatedData(filters);
      this.rawData = (result.data || []) as unknown as RawRow[];

      const networkData = this.transformToNetworkData(this.rawData);
      this.processedData = this.applyNetworkFilters(networkData, filters);

      return this.processedData;
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Data Processing');
      throw error;
    }
  }

  async queryAggregatedData(filters: DataFilters = {}): Promise<{ data: Record<string, unknown>[] }> {
    const {
      minValue = 0,
      partyFilter = '',
      categoryFilter = '',
      searchFilter = '',
    } = filters;

    const whereClause = APIUtils.buildFilterClause({
      minValue,
      partyFilter,
      categoryFilter,
      searchFilter,
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

  transformToNetworkData(data: RawRow[]): NetworkData {
    const nodes = new Map<string, NetworkNode>();
    const links = new Map<string, NetworkLink>();
    let nodeId = 0;

    if (!data || !Array.isArray(data)) {
      console.warn('No data available for network transformation');
      return { nodes: [], links: [] };
    }

    data.forEach(row => {
      const deputyKey = `deputy_${row.nome_parlamentar}`;
      const supplierKey = `supplier_${row.fornecedor}`;

      if (!nodes.has(deputyKey)) {
        nodes.set(deputyKey, {
          id: deputyKey,
          nodeId: nodeId++,
          nome: row.nome_parlamentar,
          type: 'deputado',
          partido: row.sigla_partido,
          total_value: 0,
          transaction_count: 0,
          connections: 0,
        });
      }

      if (!nodes.has(supplierKey)) {
        nodes.set(supplierKey, {
          id: supplierKey,
          nodeId: nodeId++,
          nome: row.fornecedor,
          type: 'fornecedor',
          total_value: 0,
          transaction_count: 0,
          connections: 0,
        });
      }

      const deputyNode = nodes.get(deputyKey)!;
      const supplierNode = nodes.get(supplierKey)!;

      deputyNode.total_value += Number(row.total_value) || 0;
      deputyNode.transaction_count += Number(row.transaction_count) || 0;
      deputyNode.connections += 1;

      supplierNode.total_value += Number(row.total_value) || 0;
      supplierNode.transaction_count += Number(row.transaction_count) || 0;
      supplierNode.connections += 1;

      const linkKey = `${deputyKey}_${supplierKey}`;
      if (!links.has(linkKey)) {
        links.set(linkKey, {
          source: deputyKey,
          target: supplierKey,
          value: 0,
          transaction_count: 0,
          categoria: row.categoria_despesa,
        });
      }

      const link = links.get(linkKey)!;
      link.value += Number(row.total_value) || 0;
      link.transaction_count += Number(row.transaction_count) || 0;
    });

    return {
      nodes: Array.from(nodes.values()),
      links: Array.from(links.values()),
    };
  }

  applyNetworkFilters(networkData: NetworkData, filters: DataFilters = {}): NetworkData {
    let filteredData = { ...networkData };

    if (filters.densityMode) {
      filteredData = this.filterByDensity(filteredData);
    }

    if (filters.topExpensesMode) {
      filteredData = this.filterByTopExpenses(filteredData, 15);
    }

    return filteredData;
  }

  filterByDensity(networkData: NetworkData): NetworkData {
    const densityScores = this.calculateNodeDensity(networkData);

    const threshold = Math.ceil(networkData.nodes.length * APP_CONSTANTS.NETWORK.TOP_PERCENTILE);
    const topNodes = Array.from(densityScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, threshold)
      .map(([nodeId]) => nodeId);

    const filteredNodes = networkData.nodes.filter(node => topNodes.includes(node.id));
    const filteredLinks = networkData.links.filter(
      link => topNodes.includes(link.source) && topNodes.includes(link.target)
    );

    return { nodes: filteredNodes, links: filteredLinks };
  }

  filterByTopExpenses(networkData: NetworkData, topCount = 15): NetworkData {
    const topNodes = [...networkData.nodes]
      .sort((a, b) => b.total_value - a.total_value)
      .slice(0, topCount)
      .map(node => node.id);

    const filteredLinks = networkData.links.filter(
      link => topNodes.includes(link.source) && topNodes.includes(link.target)
    );

    const filteredNodes = networkData.nodes.filter(node => topNodes.includes(node.id));

    return { nodes: filteredNodes, links: filteredLinks };
  }

  calculateNodeDensity(networkData: NetworkData): Map<string, number> {
    const densityScores = new Map<string, number>();

    if (!networkData || !networkData.nodes || !networkData.links) {
      console.warn('Invalid network data for density calculation');
      return densityScores;
    }

    networkData.nodes.forEach(node => {
      densityScores.set(node.id, 0);
    });

    networkData.links.forEach(link => {
      const sourceScore = densityScores.get(link.source) || 0;
      const targetScore = densityScores.get(link.target) || 0;

      densityScores.set(link.source, sourceScore + 1);
      densityScores.set(link.target, targetScore + 1);
    });

    this.densityScores = densityScores;
    return densityScores;
  }

  getStatistics(): NetworkStatistics {
    const stats: NetworkStatistics = {
      totalDeputados: 0,
      totalFornecedores: 0,
      totalValue: 0,
      totalTransactions: 0,
      avgTransactionValue: 0,
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

  updateStatisticsDisplay(customStats: NetworkStatistics | null = null): void {
    const stats = customStats || this.getStatistics();

    const updateStat = (id: string, value: number, isValue = false) => {
      const element = document.getElementById(id);
      if (element) {
        const displayValue = isValue
          ? `R$ ${(value || 0).toLocaleString()}`
          : (value || 0).toLocaleString();
        element.textContent = displayValue;
      }
    };

    updateStat('totalDeputados', stats.totalDeputados);
    updateStat('totalFornecedores', stats.totalFornecedores);
    updateStat('totalValue', stats.totalValue, true);
    updateStat('totalTransactions', stats.totalTransactions);
  }

  async getNodeDetails(nodeData: NetworkNode): Promise<NodeDetails> {
    try {
      if (nodeData.type === 'deputado') {
        return await this.getDeputyDetails(nodeData);
      } else if (nodeData.type === 'fornecedor') {
        return await this.getSupplierDetails(nodeData);
      }

      return { transactions: [], summary: {} };
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Node Details Query');
      return { transactions: [], summary: {} };
    }
  }

  async getDeputyDetails(nodeData: NetworkNode): Promise<NodeDetails> {
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
        totalSuppliers: new Set(result.data.map(r => r['fornecedor'])).size,
        totalCategories: new Set(result.data.map(r => r['categoria_despesa'])).size,
        totalValue: result.data.reduce((sum, r) => sum + (Number(r['total_value']) || 0), 0),
        totalTransactions: result.data.reduce((sum, r) => sum + (Number(r['transaction_count']) || 0), 0),
      },
    };
  }

  async getSupplierDetails(nodeData: NetworkNode): Promise<NodeDetails> {
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
        totalDeputies: new Set(result.data.map(r => r['nome_parlamentar'])).size,
        totalParties: new Set(result.data.map(r => r['sigla_partido'])).size,
        totalCategories: new Set(result.data.map(r => r['categoria_despesa'])).size,
        totalValue: result.data.reduce((sum, r) => sum + (Number(r['total_value']) || 0), 0),
        totalTransactions: result.data.reduce((sum, r) => sum + (Number(r['transaction_count']) || 0), 0),
      },
    };
  }

  createCategoryPieChartData(_transactionData: unknown): PieChartData[] {
    const categoryTotals = new Map<string, number>();

    if (!this.rawData || !Array.isArray(this.rawData)) {
      console.warn('No raw data available for pie chart');
      return [];
    }

    this.rawData.forEach(row => {
      const category = row.categoria_despesa;
      const currentTotal = categoryTotals.get(category) || 0;
      categoryTotals.set(category, currentTotal + (Number(row.total_value) || 0));
    });

    const data = Array.from(categoryTotals.entries())
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, APP_CONSTANTS.TEXT.MAX_PIE_SLICES);

    return data;
  }

  getCurrentData(): NetworkData {
    return { ...this.processedData };
  }

  getRawData(): RawRow[] {
    return [...this.rawData];
  }

  clearData(): void {
    this.rawData = [];
    this.processedData = { nodes: [], links: [] };
    this.densityScores.clear();
  }

  exportData(): string {
    return JSON.stringify(
      {
        metadata: {
          timestamp: new Date().toISOString(),
          nodeCount: this.processedData.nodes.length,
          linkCount: this.processedData.links.length,
          rawDataCount: this.rawData.length,
        },
        network: this.processedData,
        statistics: this.getStatistics(),
      },
      null,
      2
    );
  }
}
