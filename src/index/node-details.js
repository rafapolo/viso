// Node Details and Information Panel Management
import { DOMUtils } from '../shared/dom-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { APIUtils } from '../shared/api-utils.js';

export class NodeDetails {
  constructor() {
    this.currentNode = null;
  }

  /**
   * Show detailed information for a selected node
   * @param {Object} nodeData - Node data object
   */
  async showNodeInfo(nodeData) {
    try {
      const content = DOMUtils.getElementById('node-info-content');
      const closeBtn = DOMUtils.getElementById('close-panel');
      const rightPanel = DOMUtils.getElementById('right-panel');

      if (!content || !rightPanel) {
        console.warn('Node info panel elements not found');
        return;
      }

      this.currentNode = nodeData;

      // Reset node appearance and highlight selected
      this.highlightSelectedNode(nodeData);

      // Show panel
      DOMUtils.removeClass(rightPanel, 'translate-x-full');

      // Show loading state
      const loadingHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="loading-spinner"></div>Carregando detalhes...</div>';
      DOMUtils.updateContent(content, loadingHTML, true);
      content.style.display = 'block';
      content.className = 'p-4 flex flex-col flex-1 min-h-0';
      
      if (closeBtn) {
        DOMUtils.removeClass(closeBtn, 'hidden');
      }

      // Query detailed transactions for this entity
      const detailsData = await this.getEntityDetails(nodeData);

      // Create and display content
      const contentHTML = this.createNodeInfoHTML(nodeData, detailsData);
      DOMUtils.updateContent(content, contentHTML, true);

      // Create time series chart after content is set
      setTimeout(() => {
        this.createTimeSeriesChart(detailsData);
      }, 50);

    } catch (error) {
      ErrorHandler.handleError(error, 'Show Node Info');
      const content = DOMUtils.getElementById('node-info-content');
      if (content) {
        DOMUtils.updateContent(content, `<div class="text-red-400 text-sm">Erro ao carregar detalhes: ${error.message}</div>`, true);
      }
    }
  }

  /**
   * Hide node information panel
   */
  hideNodeInfo() {
    const rightPanel = DOMUtils.getElementById('right-panel');
    const content = DOMUtils.getElementById('node-info-content');
    const closeBtn = DOMUtils.getElementById('close-panel');

    // Reset all nodes to normal appearance
    this.resetNodeAppearance();

    // Hide panel
    if (rightPanel) {
      DOMUtils.addClass(rightPanel, 'translate-x-full');
    }

    // Reset content after animation
    setTimeout(() => {
      if (content) {
        DOMUtils.updateContent(content, '<p class="text-xs text-gray-500 dark:text-gray-400">Clique em um nó para ver detalhes</p>', true);
        content.className = 'p-4 flex flex-col flex-1 min-h-0';
      }
      if (closeBtn) {
        DOMUtils.addClass(closeBtn, 'hidden');
      }
    }, 300);

    this.currentNode = null;
  }

  /**
   * Get detailed transaction data for an entity
   * @param {Object} nodeData - Node data
   * @returns {Promise<Array>} Transaction details
   */
  async getEntityDetails(nodeData) {
    try {
      let query = '';
      let entityName = '';

      if (nodeData.type === 'deputado') {
        entityName = nodeData.label.replace(/\([^)]*\)/, '').trim(); // Remove party from label
        query = `
          SELECT 
            fornecedor,
            data_emissao,
            valor_liquido,
            categoria_despesa,
            subcategoria_despesa
          FROM despesas 
          WHERE nome_parlamentar = '${APIUtils.escapeSQLString(entityName)}'
          ORDER BY data_emissao DESC, valor_liquido DESC
        `;
      } else {
        entityName = nodeData.label;
        query = `
          SELECT 
            nome_parlamentar,
            sigla_partido,
            data_emissao,
            valor_liquido,
            categoria_despesa,
            subcategoria_despesa
          FROM despesas 
          WHERE fornecedor = '${APIUtils.escapeSQLString(entityName)}'
          ORDER BY data_emissao DESC, valor_liquido DESC
        `;
      }

      console.log('🔍 Executing entity details query:', query);
      const result = await window.duckdbAPI.query(query);
      return result.toArray();

    } catch (error) {
      ErrorHandler.handleError(error, 'Entity Details Query');
      return [];
    }
  }

  /**
   * Create HTML content for node information panel
   * @param {Object} nodeData - Node data
   * @param {Array} detailsData - Transaction details
   * @returns {string} HTML content
   */
  createNodeInfoHTML(nodeData, detailsData) {
    const totalTransactions = detailsData.length;
    const totalValue = detailsData.reduce((sum, item) => sum + Number(item.valor_liquido), 0);

    const formatCurrency = (value) => {
      return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    };
    const formatNumber = (value) => {
      return Number(value).toLocaleString('pt-BR');
    };

    if (nodeData.type === 'deputado') {
      return this.createDeputyInfoHTML(nodeData, detailsData, totalTransactions, totalValue, formatCurrency, formatNumber);
    } else {
      return this.createSupplierInfoHTML(nodeData, detailsData, totalTransactions, totalValue, formatCurrency, formatNumber);
    }
  }

  /**
   * Create HTML for deputy information
   * @param {Object} nodeData - Deputy node data
   * @param {Array} detailsData - Transaction details
   * @param {number} totalTransactions - Total transaction count
   * @param {number} totalValue - Total value
   * @param {Function} formatCurrency - Currency formatter
   * @param {Function} formatNumber - Number formatter
   * @returns {string} HTML content
   */
  createDeputyInfoHTML(nodeData, detailsData, totalTransactions, totalValue, formatCurrency, formatNumber) {
    return `
      <div class="pb-3 border-b border-gray-600 mb-3">
        <h4 class="text-base font-bold text-deputy mb-1">${nodeData.label}</h4>
        <div class="flex justify-between items-center text-xs text-gray-400 mb-1">
          <span>Gastou ${formatCurrency(totalValue)} em ${formatNumber(totalTransactions)} Transações</span>
        </div>
      </div>
      <div class="flex-1 flex flex-col min-h-0">
        <!-- Time Series Chart -->
        <div class="mb-3">
          <div class="bg-gray-800 rounded p-3">
            <canvas id="timeSeriesChart" width="280" height="120" class="w-full"></canvas>
          </div>
        </div>
        
        <div class="node-info-scroll-container">
          ${detailsData.slice(0, 200).map(item => this.createTransactionCard(item, 'supplier')).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Create HTML for supplier information
   * @param {Object} nodeData - Supplier node data
   * @param {Array} detailsData - Transaction details
   * @param {number} totalTransactions - Total transaction count
   * @param {number} totalValue - Total value
   * @param {Function} formatCurrency - Currency formatter
   * @param {Function} formatNumber - Number formatter
   * @returns {string} HTML content
   */
  createSupplierInfoHTML(nodeData, detailsData, totalTransactions, totalValue, formatCurrency, formatNumber) {
    return `
      <div class="pb-3 border-b border-gray-600 mb-3">
        <h4 class="text-base font-bold text-supplier mb-1">${nodeData.label}</h4>
        <div class="flex justify-between items-center text-xs text-gray-400 mb-1">
          <span>Recebeu ${formatCurrency(totalValue)} em ${formatNumber(totalTransactions)} Transações</span>
        </div>
      </div>
      <div class="flex-1 flex flex-col min-h-0">
        <!-- Time Series Chart -->
        <div class="mb-3">
          <div class="bg-gray-800 rounded p-3">
            <canvas id="timeSeriesChart" width="280" height="120" class="w-full"></canvas>
          </div>
        </div>
        
        <div class="node-info-scroll-container">
          ${detailsData.slice(0, 200).map(item => this.createTransactionCard(item, 'deputy')).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Create transaction card HTML
   * @param {Object} item - Transaction item
   * @param {string} linkType - Type of link ('supplier' or 'deputy')
   * @returns {string} Transaction card HTML
   */
  createTransactionCard(item, linkType) {
    const formatCurrency = (value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      try {
        return new Date(dateStr).toLocaleDateString('pt-BR');
      } catch {
        return dateStr;
      }
    };

    const getCategoryBadge = (categoria) => {
      if (!categoria) return '';

      const hashCode = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return hash;
      };

      const colors = [
        { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' },
        { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
        { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200' },
        { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' },
        { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-800 dark:text-pink-200' },
        { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-800 dark:text-indigo-200' },
        { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200' },
        { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200' },
        { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-800 dark:text-teal-200' },
        { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-800 dark:text-cyan-200' }
      ];

      const colorIndex = Math.abs(hashCode(categoria)) % colors.length;
      const color = colors[colorIndex];

      return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-light ${color.bg} ${color.text}" style="font-size: 8px;" title="${categoria}"><span class="w-1 h-1 rounded-full bg-current"></span>${categoria}</span>`;
    };

    if (linkType === 'supplier') {
      const entityName = item.fornecedor.replace(/'/g, "\\'");
      return `
        <div class="transaction-card bg-gray-800/50 backdrop-blur-sm border border-gray-600/30 rounded-lg p-3 hover:bg-gray-700/70 hover:border-gray-500/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md border-l-4 border-l-supplier" onclick="highlightNodeInVisualization('${entityName}', 'fornecedor')">
          <div class="flex items-center gap-2 mb-2">
            <div class="font-semibold text-supplier text-sm truncate flex-1" title="${item.fornecedor}">→ ${item.fornecedor}</div>
          </div>
          <div class="flex justify-between items-center mb-2">
            <div class="font-bold text-xs">${formatCurrency(item.valor_liquido)}</div>
            <div class="flex items-center gap-1 text-xs text-gray-400">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
              </svg>
              ${formatDate(item.data_emissao)}
            </div>
          </div>
          <div class="flex gap-1 truncate">
            ${getCategoryBadge(item.categoria_despesa)}
          </div>
        </div>
      `;
    } else {
      const entityName = item.nome_parlamentar.replace(/'/g, "\\'");
      return `
        <div class="transaction-card bg-gray-800/50 backdrop-blur-sm border border-gray-600/30 rounded-lg p-3 hover:bg-gray-700/70 hover:border-gray-500/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md border-l-4 border-l-deputy" onclick="highlightNodeInVisualization('${entityName}', 'deputado')">
          <div class="flex items-center gap-2 mb-2">
            <div class="font-semibold text-deputy text-sm truncate flex-1">← ${item.nome_parlamentar} ${item.sigla_partido}</div>
          </div>
          <div class="flex justify-between items-center mb-2">
            <div class="font-bold text-sm">${formatCurrency(item.valor_liquido)}</div>
            <div class="flex items-center gap-1 text-xs text-gray-400">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
              </svg>
              ${formatDate(item.data_emissao)}
            </div>
          </div>
          <div class="flex gap-1 truncate">
            ${getCategoryBadge(item.categoria_despesa)}
          </div>
        </div>
      `;
    }
  }

  /**
   * Highlight selected node in visualization
   * @param {Object} nodeData - Node to highlight
   */
  highlightSelectedNode(nodeData) {
    if (!window.d3) return;

    const svg = window.d3.select('#network-svg');
    const searchFilter = DOMUtils.getValue('searchBox')?.trim().toLowerCase() || '';

    // Reset all nodes to normal appearance
    svg.selectAll('circle')
      .attr("stroke-width", d => {
        return (searchFilter && d.label.toLowerCase().includes(searchFilter)) ? 3 : 1.5;
      })
      .attr("stroke", d => {
        if (searchFilter && d.label.toLowerCase().includes(searchFilter)) {
          return "#fff";
        }
        return "#fff";
      })
      .attr("r", d => d.type === 'deputado' ? 8 : 6);

    // Highlight the selected node
    svg.selectAll('circle')
      .filter(d => d.id === nodeData.id)
      .attr("stroke-width", 4)
      .attr("stroke", "#FFD700") // Gold highlight
      .attr("r", d => (d.type === 'deputado' ? 8 : 6) + 2);
  }

  /**
   * Reset all nodes to normal appearance
   */
  resetNodeAppearance() {
    if (!window.d3) return;

    const svg = window.d3.select('#network-svg');
    const searchFilter = DOMUtils.getValue('searchBox')?.trim().toLowerCase() || '';

    svg.selectAll('circle')
      .attr("stroke-width", d => {
        return (searchFilter && d.label.toLowerCase().includes(searchFilter)) ? 3 : 1.5;
      })
      .attr("stroke", d => {
        if (searchFilter && d.label.toLowerCase().includes(searchFilter)) {
          return "#fff";
        }
        return "#fff";
      })
      .attr("r", d => d.type === 'deputado' ? 8 : 6);
  }

  /**
   * Highlight node in visualization by name and type
   * @param {string} entityName - Entity name to highlight
   * @param {string} entityType - Entity type ('deputado' or 'fornecedor')
   */
  highlightNodeInVisualization(entityName, entityType) {
    if (!window.currentVisualization || !window.d3) return;

    // Find the target node
    const targetNode = window.currentVisualization.nodes.find(node => {
      if (entityType === 'fornecedor') {
        return node.type === 'fornecedor' && node.label === entityName;
      } else {
        return node.type === 'deputado' && (
          node.label.includes(entityName) || 
          entityName.includes(node.label.split('(')[0].trim())
        );
      }
    });

    if (!targetNode) return;

    const svg = window.d3.select("#network-svg");
    const nodes = svg.selectAll("circle");

    // Reset all nodes
    this.resetNodeAppearance();

    // Highlight the target node
    nodes
      .filter(d => d.id === targetNode.id)
      .attr("stroke-width", 4)
      .attr("stroke", "#FFD700")
      .attr("r", d => (d.type === 'deputado' ? 8 : 6) + 2);

    // Pan to the node
    this.panToNode(targetNode, svg);
  }

  /**
   * Pan visualization to show specific node
   * @param {Object} targetNode - Node to pan to
   * @param {Object} svg - D3 SVG selection
   */
  panToNode(targetNode, svg) {
    const transform = window.d3.zoomTransform(svg.node());
    const {x} = targetNode;
    const {y} = targetNode;

    if (!isFinite(x) || !isFinite(y)) {
      console.warn('Node has invalid coordinates, skipping pan');
      return;
    }

    const scale = Math.max(transform.k, 1.5);
    const containerRect = svg.node().getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;

    const translateX = centerX - scale * x;
    const translateY = centerY - scale * y;

    if (!isFinite(translateX) || !isFinite(translateY) || !isFinite(scale)) {
      console.warn('Invalid transform values in highlight, skipping pan');
      return;
    }

    const newTransform = window.d3.zoomIdentity
      .translate(translateX, translateY)
      .scale(scale);

    svg.transition()
      .duration(800)
      .call(window.d3.zoom().transform, newTransform);
  }

  /**
   * Create time series chart (delegates to StatisticsCharts)
   * @param {Array} detailsData - Transaction details
   */
  createTimeSeriesChart(detailsData) {
    // Dispatch event for StatisticsCharts to handle
    document.dispatchEvent(new CustomEvent('createTimeSeriesChart', {
      detail: { detailsData }
    }));
  }

  /**
   * Setup event listeners for node details
   */
  setupEventListeners() {
    const closeBtn = DOMUtils.getElementById('close-panel');
    if (closeBtn) {
      DOMUtils.addEventListener(closeBtn, 'click', () => {
        this.hideNodeInfo();
      });
    }

    // Listen for node selection events
    document.addEventListener('nodeSelected', (event) => {
      if (event.detail && event.detail.node) {
        this.showNodeInfo(event.detail.node);
      }
    });
  }

  /**
   * Get current node
   * @returns {Object|null} Current node data
   */
  getCurrentNode() {
    return this.currentNode;
  }

  /**
   * Dispose of node details
   */
  dispose() {
    this.currentNode = null;
  }
}

// Make highlightNodeInVisualization available globally for onclick handlers
window.highlightNodeInVisualization = (entityName, entityType) => {
  if (window.nodeDetails) {
    window.nodeDetails.highlightNodeInVisualization(entityName, entityType);
  }
};