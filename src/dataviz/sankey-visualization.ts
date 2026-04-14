// Unified Sankey Visualization Service
import { TooltipManager } from '../shared/ui-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { FormatUtils } from '../shared/formatters.js';
import { getGlobalLibraryFacade } from '../services/library-facade.js';

type D3Any = Record<string, (...args: unknown[]) => D3Any>;

interface SankeyOptions {
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  maxSuppliers?: number;
  enableHoverPanel?: boolean;
  enableTooltips?: boolean;
  enableStatistics?: boolean;
  mode?: 'standalone' | 'embedded';
  databaseService?: DatabaseServiceLike | null;
}

interface DatabaseServiceLike {
  db?: unknown;
  conn?: unknown;
  ensureConnection(): Promise<boolean | void>;
  query(sql: string): Promise<{ toArray(): Record<string, unknown>[] }>;
  initialize?(): Promise<void>;
  loadData?(): Promise<void>;
}

interface FlowRecord {
  source_party: string;
  category: string;
  supplier: string;
  total_value: unknown;
  transaction_count: unknown;
}

interface SankeyNode {
  id: string;
  name: string;
  type: 'party' | 'category' | 'supplier';
  color: string;
  sortOrder: number;
}

interface SankeyLink {
  source: string | SankeyNode;
  target: string | SankeyNode;
  value: number;
  originalData?: FlowRecord;
  consolidatedData?: FlowRecord[];
  linkId?: string;
}

interface NodeStats {
  totalValue: number;
  transactionCount: number;
  connections: Set<string>;
}

interface SankeyStatistics {
  parties: number;
  categories: number;
  suppliers: number;
  totalValue: number;
}

interface HoverPanelData {
  name: string;
  type: string;
  value: string;
  transactions: string | number;
  extra: string | number;
  extraLabel: string;
}

interface SankeyElements {
  svg: D3Any;
  linkGroup: D3Any;
  nodeGroup: D3Any;
}

export class SankeyVisualization {
  private options: Required<Omit<SankeyOptions, 'databaseService'>> & { databaseService: DatabaseServiceLike | null };
  private container: HTMLElement | null;
  private currentFlowData: FlowRecord[] | null;
  private flowDataCache: Map<string, FlowRecord>;
  private hoveredElement: unknown;
  private sankeyElements: SankeyElements | null;
  resizeHandler: (() => void) | null;
  private tooltipManager: TooltipManager | null;
  private libraryFacade: ReturnType<typeof getGlobalLibraryFacade>;
  private databaseService: DatabaseServiceLike | null;

  constructor(options: SankeyOptions = {}) {
    this.options = {
      width: 1200,
      height: 600,
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
      maxSuppliers: 25,
      enableHoverPanel: true,
      enableTooltips: true,
      enableStatistics: true,
      mode: 'embedded',
      databaseService: null,
      ...options,
    };

    this.container = null;
    this.currentFlowData = null;
    this.flowDataCache = new Map();
    this.hoveredElement = null;
    this.sankeyElements = null;
    this.resizeHandler = null;

    this.tooltipManager = this.options.enableTooltips ? new TooltipManager() : null;
    this.libraryFacade = getGlobalLibraryFacade();

    this.databaseService = options.databaseService ?? null;
  }

  async initialize(
    container: HTMLElement | string,
    databaseService: DatabaseServiceLike | null = null
  ): Promise<boolean> {
    try {
      this.container =
        typeof container === 'string'
          ? document.querySelector<HTMLElement>(container)
          : container;

      if (!this.container) {
        throw new Error('Container not found');
      }

      if (databaseService) {
        this.databaseService = databaseService;
      }

      if (!this.databaseService) {
        throw new Error('Database service is required');
      }

      this.setupContainer();
      this.setupResizeHandler();

      return true;
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Sankey Visualization Initialization');
      return false;
    }
  }

  setupContainer(): void {
    const { enableHoverPanel, enableStatistics, mode } = this.options;

    let containerHTML = `<div class="sankey-visualization flex flex-col h-full">`;

    if (enableStatistics && mode === 'standalone') {
      containerHTML += `
        <div class="statistics-panel bg-gray-800 p-4 border-b border-gray-700">
          <div class="grid grid-cols-4 gap-4 text-center">
            <div class="bg-gray-700 rounded p-3">
              <div class="text-2xl font-bold text-blue-400" id="totalPartidos">-</div>
              <div class="text-xs text-gray-400">Partidos</div>
            </div>
            <div class="bg-gray-700 rounded p-3">
              <div class="text-2xl font-bold text-green-400" id="totalCategorias">-</div>
              <div class="text-xs text-gray-400">Categorias</div>
            </div>
            <div class="bg-gray-700 rounded p-3">
              <div class="text-2xl font-bold text-yellow-400" id="totalFornecedores">-</div>
              <div class="text-xs text-gray-400">Fornecedores</div>
            </div>
            <div class="bg-gray-700 rounded p-3">
              <div class="text-2xl font-bold text-purple-400" id="totalRegistros">-</div>
              <div class="text-xs text-gray-400">Valor Total</div>
            </div>
          </div>
        </div>
      `;
    }

    containerHTML += `
      <div class="flex-1 flex bg-gray-900 overflow-hidden relative">
        <div id="sankey-loading" class="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div class="text-center">
            <div class="loading-spinner mb-4 w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div class="text-gray-400" id="loading-message">Carregando dados...</div>
          </div>
        </div>
        <svg id="sankey-svg" width="100%" height="100%" style="display: none;"></svg>
      </div>
    `;

    if (enableHoverPanel && mode === 'embedded') {
      containerHTML += `
        <div id="sankey-hover-panel" class="border-t border-gray-700 bg-gray-800 p-3">
          <div class="stats-grid text-sm" id="hover-panel-content">
            <div class="bg-gray-200 dark:bg-gray-700 rounded p-2 border-l-2 border-blue-500">
              <div class="text-xs font-semibold text-blue-400" id="hover-element-name">Passe o mouse sobre elementos</div>
              <div class="text-gray-400 text-2xs" id="hover-element-type">Tipo</div>
            </div>
            <div class="bg-gray-200 dark:bg-gray-700 rounded p-2 border-l-2 border-green-500">
              <div class="text-xs font-semibold text-green-400" id="hover-element-value">-</div>
              <div class="text-gray-400 text-2xs">Valor</div>
            </div>
            <div class="bg-gray-200 dark:bg-gray-700 rounded p-2 border-l-2 border-yellow-500">
              <div class="text-xs font-semibold text-yellow-400" id="hover-element-transactions">-</div>
              <div class="text-gray-400 text-2xs">Transações</div>
            </div>
            <div class="bg-gray-200 dark:bg-gray-700 rounded p-2 border-l-2 border-purple-500">
              <div class="text-xs font-semibold text-purple-400" id="hover-element-extra">-</div>
              <div class="text-gray-400 text-2xs" id="hover-element-extra-label">Info</div>
            </div>
          </div>
        </div>
      `;
    }

    containerHTML += `</div>`;

    this.container!.innerHTML = containerHTML;

    if (enableHoverPanel && mode === 'embedded') {
      const style = document.createElement('style');
      style.textContent = `
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        .text-2xs {
          font-size: 0.65rem;
          line-height: 0.75rem;
        }
      `;
      document.head.appendChild(style);
    }
  }

  async render(): Promise<boolean> {
    try {
      await this.loadSankeyData();
      return true;
    } catch (error) {
      this.showError((error as Error).message);
      return false;
    }
  }

  async loadSankeyData(): Promise<void> {
    const loadingEl = this.container!.querySelector<HTMLElement>('#sankey-loading');
    const loadingMessage = this.container!.querySelector<HTMLElement>('#loading-message');

    try {
      await this.databaseService!.ensureConnection();

      if (loadingMessage) loadingMessage.textContent = 'Processando fornecedores...';

      const topSuppliersQuery = `
        SELECT fornecedor, SUM(CAST(valor_liquido AS DOUBLE)) as total_received
        FROM despesas
        WHERE fornecedor IS NOT NULL
        AND valor_liquido IS NOT NULL
        GROUP BY fornecedor
        ORDER BY total_received DESC
        LIMIT ${this.options.maxSuppliers}
      `;

      const topSuppliersResult = await this.databaseService!.query(topSuppliersQuery);
      const topSuppliers = topSuppliersResult.toArray().map(row => row['fornecedor'] as string);

      if (topSuppliers.length === 0) {
        throw new Error('No suppliers found in data');
      }

      if (loadingMessage) loadingMessage.textContent = 'Executando consulta Sankey...';

      const flowQuery = `
        SELECT
          sigla_partido as source_party,
          categoria_despesa as category,
          fornecedor as supplier,
          SUM(CAST(valor_liquido AS DOUBLE)) as total_value,
          COUNT(*) as transaction_count
        FROM despesas
        WHERE fornecedor IN (${topSuppliers.map(s => `'${s.replace(/'/g, "''")}'`).join(', ')})
        AND sigla_partido IS NOT NULL
        AND categoria_despesa IS NOT NULL
        AND valor_liquido IS NOT NULL
        GROUP BY sigla_partido, categoria_despesa, fornecedor
        ORDER BY total_value DESC
      `;

      const flowResult = await this.databaseService!.query(flowQuery);
      const flowData = flowResult.toArray() as unknown as FlowRecord[];

      this.flowDataCache.clear();
      flowData.forEach(d => {
        const linkKey = `${d.source_party}->${d.category}->${d.supplier}`;
        this.flowDataCache.set(linkKey, d);
      });

      if (loadingMessage) loadingMessage.textContent = 'Renderizando diagrama...';

      this.currentFlowData = flowData;

      await this.renderSankey(flowData);

      if (loadingEl) loadingEl.style.display = 'none';
      const svgEl = this.container!.querySelector<HTMLElement>('#sankey-svg');
      if (svgEl) svgEl.style.display = 'block';
    } catch (error) {
      throw new Error(`Failed to load Sankey data: ${(error as Error).message}`);
    }
  }

  async renderSankey(flowData: FlowRecord[]): Promise<void> {
    let loadedD3 = window.d3 as unknown as (D3Any & { sankey?: unknown }) | undefined;

    if (!loadedD3 || !loadedD3['sankey']) {
      let retries = 5;

      while (retries > 0) {
        try {
          const libraryD3 = await this.libraryFacade.getD3();
          const d3candidate = libraryD3 as unknown as D3Any & { sankey?: unknown };
          if (d3candidate && d3candidate['sankey']) {
            window.d3 = libraryD3 as typeof window.d3;
            loadedD3 = d3candidate;
            break;
          }
        } catch (error) {
          console.warn('D3 loading attempt failed:', error);
        }

        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    if (!loadedD3 || !loadedD3['sankey']) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      loadedD3 = window.d3 as unknown as D3Any & { sankey?: unknown };
    }

    if (!loadedD3 || !loadedD3['sankey']) {
      throw new Error('D3 Sankey extension not loaded after multiple attempts');
    }

    const d3 = loadedD3 as D3Any;

    const svgEl = this.container!.querySelector('#sankey-svg');
    const svg = d3['select'](svgEl);
    svg['selectAll']('*')['remove']();

    const containerRect = this.container!.getBoundingClientRect();
    const width = Math.max(800, containerRect.width - 40);
    const height = Math.max(
      400,
      containerRect.height - (this.options.enableHoverPanel ? 200 : 100)
    );

    const { sankeyData, statistics } = this.buildSankeyData(flowData, d3);

    if (this.options.enableStatistics && this.options.mode === 'standalone') {
      this.updateStatistics(statistics);
    }

    const sankey = d3['sankey']()
      ['nodeId']((d: unknown) => (d as SankeyNode).id)
      ['nodeWidth'](20)
      ['nodePadding'](15)
      ['nodeSort']((a: unknown, b: unknown) => (a as SankeyNode).sortOrder - (b as SankeyNode).sortOrder)
      ['extent']([
        [this.options.margin.left, this.options.margin.top],
        [width - this.options.margin.right, height - this.options.margin.bottom],
      ]);

    const sankeyGraph = (sankey as unknown as (data: unknown) => unknown)(sankeyData);
    const sankeyLinks = (sankeyGraph as unknown as { links: SankeyLink[] }).links;
    const sankeyNodes = (sankeyGraph as unknown as { nodes: (SankeyNode & { x0: number; x1: number; y0: number; y1: number }) [] }).nodes;

    const linkGroup = svg['append']('g')
      ['selectAll']('.link')
      ['data'](sankeyLinks as unknown as unknown[])
      ['enter']()['append']('path')
      ['attr']('class', 'link')
      ['attr']('d', d3['sankeyLinkHorizontal']())
      ['attr']('stroke', (d: unknown) => ((d as SankeyLink).source as SankeyNode).color)
      ['attr']('stroke-width', (d: unknown) => Math.max(1, (d as { width: number }).width))
      ['attr']('stroke-opacity', 0.5)
      ['attr']('fill', 'none')
      ['style']('cursor', 'pointer');

    const nodeGroup = svg['append']('g')
      ['selectAll']('.node')
      ['data'](sankeyNodes as unknown as unknown[])
      ['enter']()['append']('g')
      ['attr']('class', 'node')
      ['style']('cursor', 'pointer');

    nodeGroup['append']('rect')
      ['attr']('x', (d: unknown) => (d as { x0: number }).x0)
      ['attr']('y', (d: unknown) => (d as { y0: number }).y0)
      ['attr']('height', (d: unknown) => (d as { y1: number; y0: number }).y1 - (d as { y0: number }).y0)
      ['attr']('width', sankey['nodeWidth']())
      ['attr']('fill', (d: unknown) => (d as SankeyNode).color)
      ['attr']('stroke', '#000')
      ['attr']('stroke-width', 1);

    nodeGroup['append']('text')
      ['attr']('x', (d: unknown) => {
        const n = d as { x0: number; x1: number };
        return n.x0 < width / 2 ? n.x1 + 6 : n.x0 - 6;
      })
      ['attr']('y', (d: unknown) => {
        const n = d as { y0: number; y1: number };
        return (n.y1 + n.y0) / 2;
      })
      ['attr']('dy', '0.35em')
      ['attr']('text-anchor', (d: unknown) => {
        const n = d as { x0: number };
        return n.x0 < width / 2 ? 'start' : 'end';
      })
      ['attr']('font-size', '12px')
      ['attr']('fill', 'white')
      ['text']((d: unknown) => {
        const {name} = (d as SankeyNode);
        return name.length > 30 ? `${name.substring(0, 30)}...` : name;
      });

    this.addInteractivity(linkGroup, nodeGroup);

    this.sankeyElements = { svg, linkGroup, nodeGroup };
  }

  buildSankeyData(
    flowData: FlowRecord[],
    d3: D3Any
  ): { sankeyData: { nodes: SankeyNode[]; links: SankeyLink[] }; statistics: SankeyStatistics; nodeStats: Map<string, NodeStats> } {
    const nodes = new Map<string, SankeyNode>();
    const links: SankeyLink[] = [];
    const nodeStats = new Map<string, NodeStats>();

    type ColorFn = (val: unknown) => string;
    const partyColors = d3['scaleOrdinal'](d3['schemeCategory10']) as unknown as ColorFn;
    const categoryColors = d3['scaleOrdinal'](d3['schemeSet3']) as unknown as ColorFn;
    const supplierColors = d3['scaleOrdinal'](d3['schemeDark2']) as unknown as ColorFn;

    const parties = new Set<string>();
    const categories = new Set<string>();
    const suppliers = new Set<string>();
    let totalValue = 0;

    flowData.forEach(d => {
      const partyId = `party_${d.source_party}`;
      const categoryId = `category_${d.category}`;
      const supplierId = `supplier_${d.supplier}`;

      parties.add(d.source_party);
      categories.add(d.category);
      suppliers.add(d.supplier);

      const value = this.safeNumber(d.total_value);
      const count = this.safeNumber(d.transaction_count);
      totalValue += value;

      if (!nodes.has(partyId)) {
        nodes.set(partyId, {
          id: partyId,
          name: d.source_party,
          type: 'party',
          color: partyColors(d.source_party),
          sortOrder: 0,
        });
        nodeStats.set(partyId, { totalValue: 0, transactionCount: 0, connections: new Set() });
      }

      if (!nodes.has(categoryId)) {
        nodes.set(categoryId, {
          id: categoryId,
          name: d.category,
          type: 'category',
          color: categoryColors(d.category),
          sortOrder: 1,
        });
        nodeStats.set(categoryId, { totalValue: 0, transactionCount: 0, connections: new Set() });
      }

      if (!nodes.has(supplierId)) {
        nodes.set(supplierId, {
          id: supplierId,
          name: d.supplier,
          type: 'supplier',
          color: supplierColors(d.supplier),
          sortOrder: 2,
        });
        nodeStats.set(supplierId, { totalValue: 0, transactionCount: 0, connections: new Set() });
      }

      const ps = nodeStats.get(partyId)!;
      ps.totalValue += value;
      ps.transactionCount += count;
      ps.connections.add(supplierId);

      const cs = nodeStats.get(categoryId)!;
      cs.totalValue += value;
      cs.transactionCount += count;
      cs.connections.add(partyId);
      cs.connections.add(supplierId);

      const ss = nodeStats.get(supplierId)!;
      ss.totalValue += value;
      ss.transactionCount += count;
      ss.connections.add(partyId);

      const linkValue = value / 2;
      links.push(
        { source: partyId, target: categoryId, value: linkValue, originalData: d, linkId: `${partyId}->${categoryId}` },
        { source: categoryId, target: supplierId, value: linkValue, originalData: d, linkId: `${categoryId}->${supplierId}` }
      );
    });

    const linkMap = new Map<string, SankeyLink & { consolidatedData: FlowRecord[] }>();
    links.forEach(link => {
      const key = link.linkId!;
      if (linkMap.has(key)) {
        const existing = linkMap.get(key)!;
        existing.value += link.value;
        existing.consolidatedData.push(link.originalData!);
      } else {
        linkMap.set(key, { ...link, consolidatedData: [link.originalData!] });
      }
    });

    return {
      sankeyData: {
        nodes: Array.from(nodes.values()),
        links: Array.from(linkMap.values()),
      },
      statistics: {
        parties: parties.size,
        categories: categories.size,
        suppliers: suppliers.size,
        totalValue,
      },
      nodeStats,
    };
  }

  addInteractivity(linkGroup: D3Any, nodeGroup: D3Any): void {
    if (this.options.enableHoverPanel || this.tooltipManager) {
      linkGroup
        ['on']('mouseover', (event: MouseEvent, d: unknown) => this.handleLinkHover(event, d as SankeyLink))
        ['on']('mouseout', () => this.handleLinkOut())
        ['on']('mousemove', (event: MouseEvent, d: unknown) => this.handleLinkMove(event, d as SankeyLink));

      nodeGroup
        ['on']('mouseover', (event: MouseEvent, d: unknown) => this.handleNodeHover(event, d as SankeyNode))
        ['on']('mouseout', () => this.handleNodeOut())
        ['on']('mousemove', (event: MouseEvent, d: unknown) => this.handleNodeMove(event, d as SankeyNode));
    }
  }

  handleLinkHover(event: MouseEvent, linkData: SankeyLink): void {
    if (this.hoveredElement === linkData) return;
    this.hoveredElement = linkData;

    const data = linkData.consolidatedData || (linkData.originalData ? [linkData.originalData] : []);
    const totalValue = data.reduce((sum, d) => sum + this.safeNumber(d.total_value), 0);
    const totalTransactions = data.reduce((sum, d) => sum + this.safeNumber(d.transaction_count), 0);

    const sourceNode = linkData.source as SankeyNode;
    const targetNode = linkData.target as SankeyNode;

    if (this.options.enableHoverPanel) {
      this.updateCompactPanel({
        name: `${sourceNode.name} → ${targetNode.name}`,
        type: 'Fluxo',
        value: String(FormatUtils.formatCurrency(totalValue)),
        transactions: String(FormatUtils.formatNumber(totalTransactions)),
        extra: totalTransactions > 0 ? String(FormatUtils.formatCurrency(totalValue / totalTransactions)) : '-',
        extraLabel: 'Média',
      });
    }

    if (this.tooltipManager) {
      const content = `
        <strong>${sourceNode.name} → ${targetNode.name}</strong><br>
        <strong>Valor:</strong> ${FormatUtils.formatCurrency(totalValue)}<br>
        <strong>Transações:</strong> ${FormatUtils.formatNumber(totalTransactions)}
      `;
      this.tooltipManager.show(content, event.pageX, event.pageY);
    }

    this.highlightElement(linkData, 'link');
  }

  handleNodeHover(event: MouseEvent, nodeData: SankeyNode): void {
    if (this.hoveredElement === nodeData) return;
    this.hoveredElement = nodeData;

    const stats = this.getNodeStats(nodeData);

    const typeLabels: Record<string, string> = {
      party: 'Partido',
      category: 'Categoria',
      supplier: 'Fornecedor',
    };

    if (this.options.enableHoverPanel) {
      this.updateCompactPanel({
        name: nodeData.name,
        type: typeLabels[nodeData.type] ?? nodeData.type,
        value: String(FormatUtils.formatCurrency(stats.totalValue)),
        transactions: String(FormatUtils.formatNumber(stats.transactionCount)),
        extra: stats.connections,
        extraLabel: 'Conexões',
      });
    }

    if (this.tooltipManager) {
      const content = `
        <strong>${nodeData.name}</strong><br>
        <strong>Tipo:</strong> ${typeLabels[nodeData.type]}<br>
        <strong>Valor:</strong> ${FormatUtils.formatCurrency(stats.totalValue)}<br>
        <strong>Conexões:</strong> ${stats.connections}
      `;
      this.tooltipManager.show(content, event.pageX, event.pageY);
    }

    this.highlightElement(nodeData, 'node');
  }

  handleLinkOut(): void {
    this.hoveredElement = null;
    this.hideHoverPanel();
    if (this.tooltipManager) this.tooltipManager.hide();
    this.removeHighlight();
  }

  handleNodeOut(): void {
    this.hoveredElement = null;
    this.hideHoverPanel();
    if (this.tooltipManager) this.tooltipManager.hide();
    this.removeHighlight();
  }

  handleLinkMove(event: MouseEvent, linkData: SankeyLink): void {
    if (this.hoveredElement === linkData && this.tooltipManager) {
      const {tooltip} = (this.tooltipManager as unknown as { tooltip: HTMLElement });
      this.tooltipManager.show(tooltip?.innerHTML ?? '', event.pageX, event.pageY);
    }
  }

  handleNodeMove(event: MouseEvent, nodeData: SankeyNode): void {
    if (this.hoveredElement === nodeData && this.tooltipManager) {
      const {tooltip} = (this.tooltipManager as unknown as { tooltip: HTMLElement });
      this.tooltipManager.show(tooltip?.innerHTML ?? '', event.pageX, event.pageY);
    }
  }

  updateCompactPanel(data: HoverPanelData): void {
    if (!this.options.enableHoverPanel) return;

    const nameEl = this.container!.querySelector('#hover-element-name');
    const typeEl = this.container!.querySelector('#hover-element-type');
    const valueEl = this.container!.querySelector('#hover-element-value');
    const transactionsEl = this.container!.querySelector('#hover-element-transactions');
    const extraEl = this.container!.querySelector('#hover-element-extra');
    const extraLabelEl = this.container!.querySelector('#hover-element-extra-label');

    if (nameEl && typeEl && valueEl && transactionsEl && extraEl && extraLabelEl) {
      nameEl.textContent = data.name;
      typeEl.textContent = data.type;
      valueEl.textContent = data.value;
      transactionsEl.textContent = String(data.transactions);
      extraEl.textContent = String(data.extra);
      extraLabelEl.textContent = data.extraLabel;
    }
  }

  hideHoverPanel(): void {
    if (!this.options.enableHoverPanel) return;

    const nameEl = this.container!.querySelector('#hover-element-name');
    const typeEl = this.container!.querySelector('#hover-element-type');
    const valueEl = this.container!.querySelector('#hover-element-value');
    const transactionsEl = this.container!.querySelector('#hover-element-transactions');
    const extraEl = this.container!.querySelector('#hover-element-extra');
    const extraLabelEl = this.container!.querySelector('#hover-element-extra-label');

    if (nameEl) nameEl.textContent = 'Passe o mouse sobre elementos';
    if (typeEl) typeEl.textContent = 'Tipo';
    if (valueEl) valueEl.textContent = '-';
    if (transactionsEl) transactionsEl.textContent = '-';
    if (extraEl) extraEl.textContent = '-';
    if (extraLabelEl) extraLabelEl.textContent = 'Info';
  }

  updateStatistics(stats: SankeyStatistics): void {
    const partiesEl = this.container!.querySelector('#totalPartidos');
    const categoriesEl = this.container!.querySelector('#totalCategorias');
    const suppliersEl = this.container!.querySelector('#totalFornecedores');
    const totalEl = this.container!.querySelector('#totalRegistros');

    if (partiesEl) partiesEl.textContent = String(stats.parties);
    if (categoriesEl) categoriesEl.textContent = String(stats.categories);
    if (suppliersEl) suppliersEl.textContent = String(stats.suppliers);
    if (totalEl) totalEl.textContent = String(FormatUtils.formatCurrency(stats.totalValue));
  }

  getNodeStats(nodeData: SankeyNode): { totalValue: number; transactionCount: number; connections: number } {
    if (!this.currentFlowData) return { totalValue: 0, transactionCount: 0, connections: 0 };

    let totalValue = 0;
    let transactionCount = 0;
    const connections = new Set<string>();

    this.currentFlowData.forEach(d => {
      const matchesParty = nodeData.type === 'party' && nodeData.name === d.source_party;
      const matchesCategory = nodeData.type === 'category' && nodeData.name === d.category;
      const matchesSupplier = nodeData.type === 'supplier' && nodeData.name === d.supplier;

      if (matchesParty || matchesCategory || matchesSupplier) {
        totalValue += this.safeNumber(d.total_value);
        transactionCount += this.safeNumber(d.transaction_count);

        if (matchesParty) {
          connections.add(d.supplier);
        } else if (matchesSupplier) {
          connections.add(d.source_party);
        } else {
          connections.add(d.source_party);
          connections.add(d.supplier);
        }
      }
    });

    return { totalValue, transactionCount, connections: connections.size };
  }

  highlightElement(elementData: unknown, type: 'link' | 'node'): void {
    if (!this.sankeyElements) return;

    const { linkGroup, nodeGroup } = this.sankeyElements;

    this.removeHighlight();

    if (type === 'link') {
      linkGroup['selectAll']('path')
        ['filter']((d: unknown) => d === elementData)
        ['attr']('stroke-opacity', 0.8);
    } else {
      nodeGroup['selectAll']('rect')
        ['filter']((d: unknown) => d === elementData)
        ['attr']('stroke-width', 3)
        ['attr']('stroke', '#fff');
    }
  }

  removeHighlight(): void {
    if (!this.sankeyElements) return;

    const { linkGroup, nodeGroup } = this.sankeyElements;

    linkGroup['selectAll']('path')['attr']('stroke-opacity', 0.5);
    nodeGroup['selectAll']('rect')['attr']('stroke-width', 1)['attr']('stroke', '#000');
  }

  setupResizeHandler(): void {
    let resizeTimeout: ReturnType<typeof setTimeout>;
    this.resizeHandler = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const svgEl = this.container?.querySelector<HTMLElement>('#sankey-svg');
        if (this.currentFlowData && svgEl?.style.display !== 'none') {
          this.renderSankey(this.currentFlowData);
        }
      }, 300);
    };

    window.addEventListener('resize', this.resizeHandler);
  }

  showError(message: string): void {
    const loadingEl = this.container?.querySelector('#sankey-loading');
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div class="text-red-400 text-center">
          <div class="text-lg mb-2">❌ Erro ao carregar Sankey</div>
          <div class="text-sm">${message}</div>
        </div>
      `;
    }
  }

  safeNumber(value: unknown): number {
    return typeof value === 'bigint' ? Number(value) : Number(value) || 0;
  }

  cleanup(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    if (this.tooltipManager) {
      this.tooltipManager.hide();
    }

    this.flowDataCache.clear();
    this.currentFlowData = null;
    this.sankeyElements = null;
  }

  resize(): void {
    if (this.resizeHandler) {
      this.resizeHandler();
    }
  }
}

export const createStandaloneSankeyApp = (options: SankeyOptions = {}): SankeyVisualization => {
  return new SankeyVisualization({
    mode: 'standalone',
    enableStatistics: true,
    enableHoverPanel: false,
    enableTooltips: true,
    ...options,
  });
};

export const createEmbeddedSankeyTab = (options: SankeyOptions = {}): SankeyVisualization => {
  return new SankeyVisualization({
    mode: 'embedded',
    enableStatistics: false,
    enableHoverPanel: true,
    enableTooltips: false,
    ...options,
  });
};
