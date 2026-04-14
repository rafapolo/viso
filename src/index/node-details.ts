// Node Details and Information Panel Management
import { DOMUtils } from '../shared/dom-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { APIUtils } from '../shared/api-utils.js';

interface NodeData {
  id: string;
  type: 'deputado' | 'fornecedor';
  label: string;
  nome?: string;
  x?: number;
  y?: number;
  [key: string]: unknown;
}

interface TransactionItem {
  fornecedor?: string;
  nome_parlamentar?: string;
  sigla_partido?: string;
  data_emissao?: string;
  valor_liquido?: number | string;
  categoria_despesa?: string;
  subcategoria_despesa?: string;
}

export class NodeDetails {
  private currentNode: NodeData | null;

  constructor() {
    this.currentNode = null;
  }

  async showNodeInfo(nodeData: NodeData): Promise<void> {
    try {
      const content = DOMUtils.getElementById('node-info-content');
      const closeBtn = DOMUtils.getElementById('close-panel');
      const rightPanel = DOMUtils.getElementById('right-panel');

      if (!content || !rightPanel) {
        console.warn('Node info panel elements not found');
        return;
      }

      this.currentNode = nodeData;

      this.highlightSelectedNode(nodeData);

      DOMUtils.removeClass(rightPanel, 'translate-x-full');

      const loadingHTML =
        '<div class="flex items-center gap-2 text-gray-400"><div class="loading-spinner"></div>Carregando detalhes...</div>';
      DOMUtils.updateContent(content, loadingHTML, true);
      content.style.display = 'block';
      content.className = 'p-4 flex flex-col flex-1 min-h-0';

      if (closeBtn) {
        DOMUtils.removeClass(closeBtn, 'hidden');
      }

      const detailsData = await this.getEntityDetails(nodeData);

      const contentHTML = this.createNodeInfoHTML(nodeData, detailsData);
      DOMUtils.updateContent(content, contentHTML, true);

      setTimeout(() => {
        this.createTimeSeriesChart(detailsData);
      }, 50);
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Show Node Info');
      const content = DOMUtils.getElementById('node-info-content');
      if (content) {
        DOMUtils.updateContent(
          content,
          `<div class="text-red-400 text-sm">Erro ao carregar detalhes: ${(error as Error).message}</div>`,
          true
        );
      }
    }
  }

  hideNodeInfo(): void {
    const rightPanel = DOMUtils.getElementById('right-panel');
    const content = DOMUtils.getElementById('node-info-content');
    const closeBtn = DOMUtils.getElementById('close-panel');

    this.resetNodeAppearance();

    if (rightPanel) {
      DOMUtils.addClass(rightPanel, 'translate-x-full');
    }

    setTimeout(() => {
      if (content) {
        DOMUtils.updateContent(
          content,
          '<p class="text-xs text-gray-500 dark:text-gray-400">Clique em um nó para ver detalhes</p>',
          true
        );
        content.className = 'p-4 flex flex-col flex-1 min-h-0';
      }
      if (closeBtn) {
        DOMUtils.addClass(closeBtn, 'hidden');
      }
    }, 300);

    this.currentNode = null;
  }

  async getEntityDetails(nodeData: NodeData): Promise<TransactionItem[]> {
    try {
      let query = '';

      if (nodeData.type === 'deputado') {
        const entityName = nodeData.label.replace(/\([^)]*\)/, '').trim();
        query = `
          SELECT
            fornecedor,
            strftime(data_emissao, '%d/%m/%Y') as data_emissao,
            valor_liquido,
            categoria_despesa,
            subcategoria_despesa
          FROM despesas
          WHERE nome_parlamentar = '${APIUtils.escapeSQLString(entityName)}'
          ORDER BY data_emissao DESC, valor_liquido DESC
        `;
      } else {
        const entityName = nodeData.label;
        query = `
          SELECT
            nome_parlamentar,
            sigla_partido,
            strftime(data_emissao, '%d/%m/%Y') as data_emissao,
            valor_liquido,
            categoria_despesa,
            subcategoria_despesa
          FROM despesas
          WHERE fornecedor = '${APIUtils.escapeSQLString(entityName)}'
          ORDER BY data_emissao DESC, valor_liquido DESC
        `;
      }

      const result = await window.duckdbAPI.query(query);
      return result.toArray() as unknown as TransactionItem[];
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Entity Details Query');
      return [];
    }
  }

  createNodeInfoHTML(nodeData: NodeData, detailsData: TransactionItem[]): string {
    const totalTransactions = detailsData.length;
    const totalValue = detailsData.reduce((sum, item) => sum + Number(item.valor_liquido), 0);

    const formatCurrency = (value: number | string) =>
      `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const formatNumber = (value: number) => Number(value).toLocaleString('pt-BR');

    if (nodeData.type === 'deputado') {
      return this.createDeputyInfoHTML(
        nodeData,
        detailsData,
        totalTransactions,
        totalValue,
        formatCurrency,
        formatNumber
      );
    } else {
      return this.createSupplierInfoHTML(
        nodeData,
        detailsData,
        totalTransactions,
        totalValue,
        formatCurrency,
        formatNumber
      );
    }
  }

  createDeputyInfoHTML(
    nodeData: NodeData,
    detailsData: TransactionItem[],
    totalTransactions: number,
    totalValue: number,
    formatCurrency: (v: number | string) => string,
    formatNumber: (v: number) => string
  ): string {
    return `
      <div class="pb-3 border-b border-gray-600 mb-3">
        <h4 class="text-base font-bold text-deputy mb-1">${nodeData.label}</h4>
        <div class="flex justify-between items-center text-xs text-gray-400 mb-1">
          <span>Gastou ${formatCurrency(totalValue)} em ${formatNumber(totalTransactions)} Transações</span>
        </div>
      </div>
      <div class="flex-1 flex flex-col min-h-0">
        <div class="mb-3">
          <div class="bg-gray-800 rounded p-3">
            <canvas id="timeSeriesChart" width="280" height="120" class="w-full"></canvas>
          </div>
        </div>
        <div class="node-info-scroll-container">
          ${detailsData
            .slice(0, 200)
            .map(item => this.createTransactionCard(item, 'supplier'))
            .join('')}
        </div>
      </div>
    `;
  }

  createSupplierInfoHTML(
    nodeData: NodeData,
    detailsData: TransactionItem[],
    totalTransactions: number,
    totalValue: number,
    formatCurrency: (v: number | string) => string,
    formatNumber: (v: number) => string
  ): string {
    return `
      <div class="pb-3 border-b border-gray-600 mb-3">
        <h4 class="text-base font-bold text-supplier mb-1">${nodeData.label}</h4>
        <div class="flex justify-between items-center text-xs text-gray-400 mb-1">
          <span>Recebeu ${formatCurrency(totalValue)} em ${formatNumber(totalTransactions)} Transações</span>
        </div>
      </div>
      <div class="flex-1 flex flex-col min-h-0">
        <div class="mb-3">
          <div class="bg-gray-800 rounded p-3">
            <canvas id="timeSeriesChart" width="280" height="120" class="w-full"></canvas>
          </div>
        </div>
        <div class="node-info-scroll-container">
          ${detailsData
            .slice(0, 200)
            .map(item => this.createTransactionCard(item, 'deputy'))
            .join('')}
        </div>
      </div>
    `;
  }

  createTransactionCard(item: TransactionItem, linkType: 'supplier' | 'deputy'): string {
    const formatCurrency = (value: number | string | undefined) =>
      `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const formatDate = (dateStr: string | undefined): string => {
      if (!dateStr) return 'N/A';
      try {
        if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/');
          const date = new Date(Number(year), Number(month) - 1, Number(day));
          return date.toLocaleDateString('pt-BR');
        }
        return new Date(dateStr).toLocaleDateString('pt-BR');
      } catch {
        return dateStr;
      }
    };

    const getCategoryBadge = (categoria: string | undefined): string => {
      if (!categoria) return '';

      const hashCode = (str: string): number => {
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
        { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-800 dark:text-cyan-200' },
      ];

      const colorIndex = Math.abs(hashCode(categoria)) % colors.length;
      const color = colors[colorIndex];

      return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-light ${color.bg} ${color.text}" style="font-size: 8px;" title="${categoria}"><span class="w-1 h-1 rounded-full bg-current"></span>${categoria}</span>`;
    };

    const calendarIcon = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
    </svg>`;

    if (linkType === 'supplier') {
      const entityName = (item.fornecedor ?? '').replace(/'/g, "\\'");
      return `
        <div class="transaction-card bg-gray-800/50 backdrop-blur-sm border border-gray-600/30 rounded-lg p-3 hover:bg-gray-700/70 hover:border-gray-500/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md border-l-4 border-l-supplier" onclick="highlightNodeInVisualization('${entityName}', 'fornecedor')">
          <div class="flex items-center gap-2 mb-2">
            <div class="font-semibold text-supplier text-sm truncate flex-1" title="${item.fornecedor}">→ ${item.fornecedor}</div>
          </div>
          <div class="flex justify-between items-center mb-2">
            <div class="font-bold text-xs">${formatCurrency(item.valor_liquido)}</div>
            <div class="flex items-center gap-1 text-xs text-gray-400">
              ${calendarIcon}
              ${formatDate(item.data_emissao)}
            </div>
          </div>
          <div class="flex gap-1 truncate">
            ${getCategoryBadge(item.categoria_despesa)}
          </div>
        </div>
      `;
    } else {
      const entityName = (item.nome_parlamentar ?? '').replace(/'/g, "\\'");
      return `
        <div class="transaction-card bg-gray-800/50 backdrop-blur-sm border border-gray-600/30 rounded-lg p-3 hover:bg-gray-700/70 hover:border-gray-500/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md border-l-4 border-l-deputy" onclick="highlightNodeInVisualization('${entityName}', 'deputado')">
          <div class="flex items-center gap-2 mb-2">
            <div class="font-semibold text-deputy text-sm truncate flex-1">← ${item.nome_parlamentar} ${item.sigla_partido}</div>
          </div>
          <div class="flex justify-between items-center mb-2">
            <div class="font-bold text-sm">${formatCurrency(item.valor_liquido)}</div>
            <div class="flex items-center gap-1 text-xs text-gray-400">
              ${calendarIcon}
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

  highlightSelectedNode(nodeData: NodeData): void {
    if (!window.d3) return;

    type D3Any = Record<string, (...args: unknown[]) => D3Any>;
    const d3 = window.d3 as unknown as D3Any;
    const svg = d3['select']('#network-svg');
    const searchFilter = DOMUtils.getValue('searchBox')?.trim().toLowerCase() || '';

    svg['selectAll']('circle')
      ['attr']('stroke-width', (d: unknown) => {
        const node = d as { label?: string };
        return searchFilter && node.label?.toLowerCase().includes(searchFilter) ? 3 : 1.5;
      })
      ['attr']('stroke', () => '#fff')
      ['attr']('r', (d: unknown) => {
        const node = d as { type?: string };
        return node.type === 'deputado' ? 8 : 6;
      });

    svg['selectAll']('circle')
      ['filter']((d: unknown) => (d as { id?: string }).id === nodeData.id)
      ['attr']('stroke-width', 4)
      ['attr']('stroke', '#FFD700')
      ['attr']('r', (d: unknown) => {
        const node = d as { type?: string };
        return (node.type === 'deputado' ? 8 : 6) + 2;
      });
  }

  resetNodeAppearance(): void {
    if (!window.d3) return;

    type D3Any = Record<string, (...args: unknown[]) => D3Any>;
    const d3 = window.d3 as unknown as D3Any;
    const svg = d3['select']('#network-svg');
    const searchFilter = DOMUtils.getValue('searchBox')?.trim().toLowerCase() || '';

    svg['selectAll']('circle')
      ['attr']('stroke-width', (d: unknown) => {
        const node = d as { label?: string };
        return searchFilter && node.label?.toLowerCase().includes(searchFilter) ? 3 : 1.5;
      })
      ['attr']('stroke', () => '#fff')
      ['attr']('r', (d: unknown) => {
        const node = d as { type?: string };
        return node.type === 'deputado' ? 8 : 6;
      });
  }

  highlightNodeInVisualization(entityName: string, entityType: string): void {
    const win = window as unknown as Record<string, unknown>;
    if (!win['currentVisualization'] || !window.d3) return;

    type D3Any = Record<string, (...args: unknown[]) => D3Any>;
    const d3 = window.d3 as unknown as D3Any;

    const viz = win['currentVisualization'] as { nodes: NodeData[] };
    const targetNode = viz.nodes.find(node => {
      if (entityType === 'fornecedor') {
        return node.type === 'fornecedor' && node.label === entityName;
      } else {
        return (
          node.type === 'deputado' &&
          (node.label.includes(entityName) ||
            entityName.includes(node.label.split('(')[0].trim()))
        );
      }
    });

    if (!targetNode) return;

    const svg = d3['select']('#network-svg');

    this.resetNodeAppearance();

    svg['selectAll']('circle')
      ['filter']((d: unknown) => (d as { id?: string }).id === targetNode.id)
      ['attr']('stroke-width', 4)
      ['attr']('stroke', '#FFD700')
      ['attr']('r', (d: unknown) => {
        const node = d as { type?: string };
        return (node.type === 'deputado' ? 8 : 6) + 2;
      });

    this.panToNode(targetNode, svg);
  }

  panToNode(targetNode: NodeData, svg: Record<string, (...args: unknown[]) => unknown>): void {
    type D3Any = Record<string, (...args: unknown[]) => D3Any>;
    const d3 = window.d3 as unknown as D3Any;

    const svgNode = (svg['node'] as () => SVGSVGElement | null)();
    if (!svgNode) return;

    const transform = d3['zoomTransform'](svgNode) as unknown as { k: number };
    const x = targetNode.x ?? 0;
    const y = targetNode.y ?? 0;

    if (!isFinite(x) || !isFinite(y)) return;

    const scale = Math.max(transform.k, 1.5);
    const containerRect = svgNode.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;

    const translateX = centerX - scale * x;
    const translateY = centerY - scale * y;

    if (!isFinite(translateX) || !isFinite(translateY) || !isFinite(scale)) return;

    const newTransform = d3['zoomIdentity']['translate'](translateX, translateY)['scale'](scale);

    (svg['transition'] as () => D3Any)()['duration'](800)['call'](
      d3['zoom']()['transform'] as unknown as (...args: unknown[]) => unknown,
      newTransform
    );
  }

  createTimeSeriesChart(detailsData: TransactionItem[]): void {
    document.dispatchEvent(
      new CustomEvent('createTimeSeriesChart', {
        detail: { detailsData },
      })
    );
  }

  setupEventListeners(): void {
    const closeBtn = DOMUtils.getElementById('close-panel');
    if (closeBtn) {
      DOMUtils.addEventListener(closeBtn, 'click', () => {
        this.hideNodeInfo();
      });
    }

    document.addEventListener('nodeSelected', (event) => {
      const e = event as CustomEvent<{ node: NodeData }>;
      if (e.detail && e.detail.node) {
        this.showNodeInfo(e.detail.node);
      }
    });
  }

  getCurrentNode(): NodeData | null {
    return this.currentNode;
  }

  dispose(): void {
    this.currentNode = null;
  }
}

// Make highlightNodeInVisualization available globally for onclick handlers
(window as unknown as Record<string, unknown>)['highlightNodeInVisualization'] = (
  entityName: string,
  entityType: string
) => {
  const { nodeDetails } = window as unknown as Record<string, unknown>;
  if (nodeDetails && typeof (nodeDetails as NodeDetails).highlightNodeInVisualization === 'function') {
    (nodeDetails as NodeDetails).highlightNodeInVisualization(entityName, entityType);
  }
};
