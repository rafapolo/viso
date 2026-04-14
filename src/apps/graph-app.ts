import StatisticsCharts from '../index/statistics-charts.js';
import { ColorUtils } from '../shared/color-utils.js';

type D3Any = Record<string, (...args: unknown[]) => D3Any>;

// ── Interfaces ────────────────────────────────────────────────────────────────

interface GraphFilters {
  densityMode: boolean;
  topExpensesMode: boolean;
}

interface RouteFocusState {
  active: boolean;
  entityType: string;
  slug: string;
  filtersPrepared: boolean;
  forcedSearchApplied: boolean;
  subgraphFallbackApplied: boolean;
  searchTerm: string;
}

interface NodeTotals {
  total: number;
  transactions: number;
  connections: number;
  type: string;
  party?: string;
}

interface NetworkNode {
  id: string;
  label: string;
  type: string;
  party?: string;
  totalValue: number;
  totalTransactions: number;
  totalConnections: number;
  size: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface NetworkLink {
  source: string | NetworkNode;
  target: string | NetworkNode;
  value: number;
  count: number;
  width: number;
}

interface ProcessedData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

interface AggregatedRecord {
  nome_parlamentar: string;
  sigla_partido: string;
  fornecedor: string;
  valor_total: number | string;
  num_transacoes: number | string;
}

interface ThemeColors {
  linkStroke: string;
  backgroundColor: string;
  deputadoLabelColor: string;
  selectionStroke: string;
}

interface EntityDetails {
  fornecedor?: string;
  nome_parlamentar?: string;
  sigla_partido?: string;
  data_emissao: string;
  valor_liquido: number | string;
  categoria_despesa?: string;
  subcategoria_despesa?: string;
}

// Simulation-augmented types (D3 adds x/y/fx/fy to nodes and resolves link endpoints)
type SimNode = NetworkNode & { x: number; y: number };
type SimLink = { source: SimNode; target: SimNode; value: number; count: number; width: number };

// ── Module state ──────────────────────────────────────────────────────────────

let processedData: ProcessedData = { nodes: [], links: [] };
const graphFilters: GraphFilters = {
  densityMode: false,
  topExpensesMode: false,
};

let colorByParty = false;
let statisticsCharts: StatisticsCharts | null = null;

// Make ColorUtils globally available
window.ColorUtils = ColorUtils;

const APP_BASE_PATH = (() => {
  const rawBase = (import.meta as unknown as Record<string, Record<string, string>>).env.BASE_URL || '/';
  const normalizedBase = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  const envBase = normalizedBase.endsWith('/') ? normalizedBase.slice(0, -1) : normalizedBase;

  if (envBase === '' || envBase === '/') {
    const pathname = window.location.pathname || '/';
    if (pathname === '/viso' || pathname.startsWith('/viso/')) {
      return '/viso';
    }
  }

  return envBase;
})();

const routeFocusState: RouteFocusState = {
  active: false,
  entityType: '',
  slug: '',
  filtersPrepared: false,
  forcedSearchApplied: false,
  subgraphFallbackApplied: false,
  searchTerm: '',
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function withBasePath(pathname: string): string {
  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }
  return APP_BASE_PATH === '' || APP_BASE_PATH === '/' ? pathname : `${APP_BASE_PATH}${pathname}`;
}

function stripBasePath(pathname: string): string {
  if (APP_BASE_PATH && APP_BASE_PATH !== '/' && pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length);
  }
  if (APP_BASE_PATH && APP_BASE_PATH !== '/' && pathname === APP_BASE_PATH) {
    return '/';
  }
  return pathname;
}

function slugifyLabel(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-');
}

function parseEntityFromPath(path: string): { entityType: string; slug: string } {
  if (path.startsWith('/deputado-')) {
    return { entityType: 'deputado', slug: path.replace('/deputado-', '') };
  }
  if (path.startsWith('/empresa-')) {
    return { entityType: 'fornecedor', slug: path.replace('/empresa-', '') };
  }
  return { entityType: '', slug: '' };
}

function linkEndpointId(endpoint: string | NetworkNode): string {
  return typeof endpoint === 'object' ? endpoint.id : endpoint.toString();
}

function resetRouteFocusState(): void {
  routeFocusState.active = false;
  routeFocusState.entityType = '';
  routeFocusState.slug = '';
  routeFocusState.filtersPrepared = false;
  routeFocusState.forcedSearchApplied = false;
  routeFocusState.subgraphFallbackApplied = false;
  routeFocusState.searchTerm = '';
}

function resetNodeAppearance(): void {
  const d3 = window.d3 as unknown as D3Any;
  const searchFilter = (document.getElementById('searchBox') as HTMLInputElement | null)?.value?.trim().toLowerCase() ?? '';
  d3['select']('#graph-svg')['selectAll']('circle')
    ['attr']('stroke-width', (d: unknown) => (searchFilter && (d as NetworkNode).label.toLowerCase().includes(searchFilter)) ? 3 : 1.5)
    ['attr']('stroke', '#fff')
    ['attr']('r', (d: unknown) => (d as NetworkNode).type === 'deputado' ? 8 : 6);
}

function highlightNode(nodeId: string): void {
  const d3 = window.d3 as unknown as D3Any;
  d3['select']('#graph-svg')['selectAll']('circle')
    ['filter']((d: unknown) => (d as NetworkNode).id === nodeId)
    ['attr']('stroke-width', 4)
    ['attr']('stroke', '#FFD700')
    ['attr']('r', (d: unknown) => ((d as NetworkNode).type === 'deputado' ? 8 : 6) + 2);
}

function getNodeSlug(nodeData: NetworkNode): string {
  if (nodeData.type === 'deputado') {
    const match = nodeData.label.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (match) {
      const [, name, party] = match;
      return slugifyLabel(`${name.trim()}-${party.trim()}`);
    }
    return slugifyLabel(nodeData.label);
  }

  if (nodeData.type === 'fornecedor') {
    return slugifyLabel(nodeData.label).substring(0, 50);
  }

  return '';
}

function getRouteFocusedNode(): NetworkNode | null {
  if (!routeFocusState.active || !routeFocusState.slug || !processedData?.nodes?.length) {
    return null;
  }

  if (routeFocusState.entityType === 'fornecedor') {
    return findFornecedorNodeBySlug(routeFocusState.slug);
  }

  if (routeFocusState.entityType === 'deputado') {
    let matched = processedData.nodes.find(node => {
      if (node.type !== 'deputado') return false;
      return getNodeSlug(node) === routeFocusState.slug;
    }) ?? null;

    if (!matched) {
      const routeNameSlug = getDeputadoNameOnlySlugFromRoute(routeFocusState.slug);
      matched = processedData.nodes.find(node => {
        if (node.type !== 'deputado') return false;
        return getDeputadoNameOnlySlugFromNode(node) === routeNameSlug;
      }) ?? null;
    }

    return matched;
  }

  return null;
}

function getDeputadoNameOnlySlugFromNode(node: NetworkNode): string {
  const match = node.label.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (match) {
    const [, name] = match;
    return slugifyLabel(name.trim());
  }
  return slugifyLabel(node.label);
}

function getDeputadoNameOnlySlugFromRoute(routeSlug: string): string {
  const parts = routeSlug.split('-').filter(Boolean);
  if (parts.length <= 1) {
    return routeSlug;
  }
  return parts.slice(0, -1).join('-');
}

function findFornecedorNodeBySlug(slug: string): NetworkNode | null {
  const fornecedores = processedData.nodes.filter(node => node.type === 'fornecedor');
  const normalizedSlug = (slug || '').toLowerCase().replace(/^-+|-+$/g, '');
  if (!normalizedSlug) return null;

  let matched = fornecedores.find(node => getNodeSlug(node) === normalizedSlug) ?? null;
  if (matched) return matched;

  matched = fornecedores.find(node => slugifyLabel(node.label) === normalizedSlug) ?? null;
  if (matched) return matched;

  const boundaryPrefixMatches = fornecedores
    .map(node => ({ node, fullSlug: slugifyLabel(node.label) }))
    .filter(({ fullSlug }) => fullSlug.startsWith(`${normalizedSlug}-`))
    .sort((a, b) => a.fullSlug.length - b.fullSlug.length);
  if (boundaryPrefixMatches.length > 0) return boundaryPrefixMatches[0].node;

  const prefixMatches = fornecedores
    .map(node => ({ node, fullSlug: slugifyLabel(node.label) }))
    .filter(({ fullSlug }) => fullSlug.startsWith(normalizedSlug))
    .sort((a, b) => a.fullSlug.length - b.fullSlug.length);
  if (prefixMatches.length > 0) return prefixMatches[0].node;

  const containsMatches = fornecedores
    .map(node => ({ node, fullSlug: slugifyLabel(node.label) }))
    .filter(({ fullSlug }) => fullSlug.includes(normalizedSlug))
    .sort((a, b) => a.fullSlug.length - b.fullSlug.length);
  if (containsMatches.length > 0) return containsMatches[0].node;

  return null;
}

const _fornecedorSlugCache = new Map<string, string | null>();

async function resolveFornecedorLabelFromDatabaseBySlug(slug: string): Promise<string | null> {
  if (!slug || !window.duckdbAPI?.query) return null;
  if (_fornecedorSlugCache.has(slug)) return _fornecedorSlugCache.get(slug) ?? null;

  try {
    const result = await window.duckdbAPI.query(`
            SELECT DISTINCT fornecedor
            FROM despesas
            WHERE fornecedor IS NOT NULL
        `);
    const fornecedores = result.toArray().map(row => row['fornecedor'] as string).filter(Boolean);

    const withSlugs = fornecedores.map(name => ({ name, s: slugifyLabel(name) }));

    const exact = withSlugs.find(({ s }) => s.substring(0, 50) === slug);
    if (exact) { _fornecedorSlugCache.set(slug, exact.name); return exact.name; }

    const boundary = withSlugs
      .filter(({ s }) => s.startsWith(`${slug}-`))
      .sort((a, b) => a.s.length - b.s.length);
    if (boundary.length) { _fornecedorSlugCache.set(slug, boundary[0].name); return boundary[0].name; }

    const prefix = withSlugs
      .filter(({ s }) => s.startsWith(slug))
      .sort((a, b) => a.s.length - b.s.length);
    if (prefix.length) { _fornecedorSlugCache.set(slug, prefix[0].name); return prefix[0].name; }
  } catch (error) {
    console.warn('Error resolving fornecedor label by slug:', error);
  }

  _fornecedorSlugCache.set(slug, null);
  return null;
}

function resetFormSelectionsForRoute(): boolean {
  let changed = false;

  const partyFilter = document.getElementById('partyFilter') as HTMLSelectElement | null;
  const categoryFilter = document.getElementById('categoryFilter') as HTMLSelectElement | null;
  const searchBox = document.getElementById('searchBox') as HTMLInputElement | null;
  const clearSearch = document.getElementById('clearSearch');
  const minValueSlider = document.getElementById('minValue') as HTMLInputElement | null;
  const graphDensityToggle = document.getElementById('graphDensityToggle') as HTMLInputElement | null;
  const topExpensesToggle = document.getElementById('topExpensesToggle') as HTMLInputElement | null;

  if (partyFilter && partyFilter.value !== '') {
    partyFilter.value = '';
    changed = true;
  }
  if (categoryFilter && categoryFilter.value !== '') {
    categoryFilter.value = '';
    changed = true;
  }
  if (searchBox && searchBox.value !== '') {
    searchBox.value = '';
    changed = true;
  }
  if (clearSearch) {
    clearSearch.classList.add('hidden');
  }
  if (minValueSlider && Number(minValueSlider.value) !== 0) {
    minValueSlider.value = '0';
    changed = true;
  }

  if (graphDensityToggle && graphDensityToggle.checked) {
    graphDensityToggle.checked = false;
    graphFilters.densityMode = false;
    changed = true;
  }
  if (topExpensesToggle && topExpensesToggle.checked) {
    topExpensesToggle.checked = false;
    graphFilters.topExpensesMode = false;
    changed = true;
  }

  return changed;
}

// ── Data processing ───────────────────────────────────────────────────────────

function setProcessedDataFromAggregatedData(aggregatedData: AggregatedRecord[]): void {
  const nodeMap = new Map<string, number>();
  const nodeTotals = new Map<string, NodeTotals>();
  const nodes: NetworkNode[] = [];
  const links: NetworkLink[] = [];
  let nodeId = 0;

  const deputadoSet = new Set<string>();
  const fornecedorSet = new Set<string>();
  let totalValue = 0;
  let totalTransactions = 0;

  aggregatedData.forEach(record => {
    const deputado = `${record.nome_parlamentar} (${record.sigla_partido})`;
    const { fornecedor } = record;
    const valor = Number(record.valor_total);
    const transacoes = Number(record.num_transacoes);

    deputadoSet.add(deputado);
    fornecedorSet.add(fornecedor);
    totalValue += valor;
    totalTransactions += transacoes;

    if (!nodeTotals.has(deputado)) {
      nodeTotals.set(deputado, { total: 0, transactions: 0, connections: 0, type: 'deputado', party: record.sigla_partido });
    }
    const dt = nodeTotals.get(deputado)!;
    dt.total += valor;
    dt.transactions += transacoes;
    dt.connections += 1;

    if (!nodeTotals.has(fornecedor)) {
      nodeTotals.set(fornecedor, { total: 0, transactions: 0, connections: 0, type: 'fornecedor' });
    }
    const ft = nodeTotals.get(fornecedor)!;
    ft.total += valor;
    ft.transactions += transacoes;
    ft.connections += 1;
  });

  aggregatedData.forEach(record => {
    const deputado = `${record.nome_parlamentar} (${record.sigla_partido})`;
    const { fornecedor } = record;

    if (!nodeMap.has(deputado)) {
      const totals = nodeTotals.get(deputado)!;
      nodeMap.set(deputado, nodeId);
      nodes.push({
        id: nodeId.toString(),
        label: deputado,
        type: 'deputado',
        party: record.sigla_partido,
        totalValue: totals.total,
        totalTransactions: totals.transactions,
        totalConnections: totals.connections,
        size: Math.log(totals.total) * 2,
      });
      nodeId++;
    }

    if (!nodeMap.has(fornecedor)) {
      const totals = nodeTotals.get(fornecedor)!;
      nodeMap.set(fornecedor, nodeId);
      nodes.push({
        id: nodeId.toString(),
        label: fornecedor,
        type: 'fornecedor',
        totalValue: totals.total,
        totalTransactions: totals.transactions,
        totalConnections: totals.connections,
        size: Math.log(totals.total) * 1.5,
      });
      nodeId++;
    }

    links.push({
      source: nodeMap.get(deputado)!.toString(),
      target: nodeMap.get(fornecedor)!.toString(),
      value: Number(record.valor_total),
      count: Number(record.num_transacoes),
      width: Math.max(1, Math.log(Number(record.valor_total)) * 0.5),
    });
  });

  processedData = { nodes, links };

  const totalDeputadosEl = document.getElementById('totalDeputados');
  const totalFornecedoresEl = document.getElementById('totalFornecedores');
  const totalValueEl = document.getElementById('totalValue');
  const totalTransactionsEl = document.getElementById('totalTransactions');

  if (totalDeputadosEl) totalDeputadosEl.textContent = String(deputadoSet.size);
  if (totalFornecedoresEl) totalFornecedoresEl.textContent = String(fornecedorSet.size);
  if (totalValueEl) totalValueEl.textContent = `${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (totalTransactionsEl) totalTransactionsEl.textContent = totalTransactions.toLocaleString();

  if (statisticsCharts) {
    statisticsCharts.createCategoryPieChart(aggregatedData as unknown as Parameters<typeof statisticsCharts.createCategoryPieChart>[0]);
  }

  window.currentAggregatedData = aggregatedData as unknown as Record<string, unknown>[];
}

async function loadRouteSubgraphFallback(entityType: string, slug: string): Promise<boolean> {
  if (!window.duckdbAPI?.queryAggregatedData || !slug || entityType !== 'fornecedor') return false;

  try {
    const label = await resolveFornecedorLabelFromDatabaseBySlug(slug);
    if (!label) return false;

    const data = await window.duckdbAPI.queryAggregatedData(0, '', '', label);
    if (!data.length) return false;

    setProcessedDataFromAggregatedData(data as unknown as AggregatedRecord[]);
    return true;
  } catch (error) {
    console.warn('Error loading route subgraph fallback:', error);
  }

  return false;
}

// ── DuckDB loading ────────────────────────────────────────────────────────────

async function loadData(): Promise<void> {
  try {
    const progressEl = document.getElementById('loadingProgress');

    while (!window.duckdbAPI || !window.duckdbAPI.initDuckDB || !window.updateConnectionStatus) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (progressEl) progressEl.textContent = 'Inicializando DuckDB...';
    await window.duckdbAPI.initDuckDB();

    if (progressEl) progressEl.textContent = 'Carregando arquivo parquet...';
    await window.duckdbAPI.loadParquetData();

    if (progressEl) progressEl.textContent = 'Configurando filtros...';
    await populateFilters();

    try {
      statisticsCharts = new StatisticsCharts();
    } catch (error) {
      console.error('Failed to initialize StatisticsCharts:', error);
      statisticsCharts = null;
    }

    const preUrlParams = new URLSearchParams(window.location.search);
    const preNodeParam = preUrlParams.get('node');
    const preNodePath = preNodeParam
      ? (preNodeParam.startsWith('/') ? preNodeParam : `/${preNodeParam}`)
      : stripBasePath(window.location.pathname);
    const { entityType: preEntityType, slug: preSlug } = parseEntityFromPath(preNodePath);
    let hasPreRoute = false;
    if (preSlug) {
      resetFormSelectionsForRoute();
      routeFocusState.active = true;
      routeFocusState.entityType = preEntityType;
      routeFocusState.slug = preSlug;
      routeFocusState.filtersPrepared = true;
      hasPreRoute = true;
      if (preEntityType === 'fornecedor') {
        const resolvedLabel = await resolveFornecedorLabelFromDatabaseBySlug(preSlug);
        routeFocusState.searchTerm = resolvedLabel || preSlug.replace(/-/g, ' ').trim();
      } else {
        const nameSlug = getDeputadoNameOnlySlugFromRoute(preSlug);
        routeFocusState.searchTerm = nameSlug.replace(/-/g, ' ').trim();
      }
    }

    if (progressEl) progressEl.textContent = 'Processando dados...';
    await updateVisualization();

    setupEventListeners();
    startConnectionMonitoring();

    document.addEventListener('createTimeSeriesChart', (event: Event) => {
      const customEvent = event as CustomEvent<{ detailsData: unknown }>;
      if (statisticsCharts && customEvent.detail && customEvent.detail.detailsData) {
        statisticsCharts.createTimeSeriesChart(customEvent.detail.detailsData as Parameters<typeof statisticsCharts.createTimeSeriesChart>[0]);
      }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('busca');
    if (searchTerm) {
      const searchBox = document.getElementById('searchBox') as HTMLInputElement | null;
      if (searchBox) {
        searchBox.value = decodeURIComponent(searchTerm);
        const clearSearch = document.getElementById('clearSearch');
        if (clearSearch) {
          clearSearch.classList.remove('hidden');
        }
      }
      setTimeout(() => {
        checkForSingleSearchResult(decodeURIComponent(searchTerm));
      }, 500);
    }

    setTimeout(() => void handleUrlRouting(), hasPreRoute ? 100 : 1500);

  } catch (error) {
    console.error('❌ Erro:', error);
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus('error', 'Erro de inicialização');
    }
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.innerHTML = `
            <div class="text-red-400">
                <div class="text-lg mb-2">❌ Erro de Conexão</div>
                <div class="text-sm">${(error as Error).message}</div>
                <button onclick="navigateHome()" class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                    🔄 Tentar Novamente
                </button>
            </div>
        `;
    }
  }
}

// ── Connection monitoring ─────────────────────────────────────────────────────

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

function startConnectionMonitoring(): void {
  healthCheckInterval = setInterval(async () => {
    if (window.getConnectionStatus && window.getConnectionStatus() === 'connected') {
      const isHealthy = await window.duckdbAPI.checkConnectionHealth();
      if (!isHealthy) {
        console.warn('🔴 Connection lost during health check');
        if (window.updateConnectionStatus) {
          window.updateConnectionStatus('error', 'Conexão perdida');
        }
      }
    }
  }, 30000);
}

function stopConnectionMonitoring(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

window.stopConnectionMonitoring = stopConnectionMonitoring;

// ── Filters ───────────────────────────────────────────────────────────────────

async function populateFilters(): Promise<void> {
  const { parties, categories } = await window.duckdbAPI.getFilterOptions();

  const partySelect = document.getElementById('partyFilter');
  if (partySelect) {
    parties.forEach(party => {
      const option = document.createElement('option');
      option.value = party;
      option.textContent = party;
      if (party === 'PSDB') option.selected = true;
      partySelect.appendChild(option);
    });
  }

  const categorySelect = document.getElementById('categoryFilter');
  if (categorySelect) {
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category.length > 50 ? `${category.substring(0, 47)}...` : category;
      categorySelect.appendChild(option);
    });
  }
}

async function processData(): Promise<void> {
  const partyFilter = (document.getElementById('partyFilter') as HTMLSelectElement | null)?.value ?? '';
  const categoryFilter = (document.getElementById('categoryFilter') as HTMLSelectElement | null)?.value ?? '';
  const uiSearchFilter = (document.getElementById('searchBox') as HTMLInputElement | null)?.value.trim() ?? '';
  const searchFilter = routeFocusState.searchTerm || uiSearchFilter;

  const valueRange = await window.duckdbAPI.getValueRange(partyFilter, categoryFilter, searchFilter);
  const minVal = valueRange.min;
  const maxVal = valueRange.max;

  const slider = document.getElementById('minValue') as HTMLInputElement | null;

  if (minVal !== null && maxVal !== null && maxVal > minVal) {
    const currentValue = slider ? parseInt(slider.value) : 0;

    const rangeMin = Math.max(0, Math.floor(minVal)) || 0;
    const rangeMax = Math.max(Math.ceil(maxVal), rangeMin + 1000);

    if (slider) {
      slider.min = String(rangeMin);
      slider.max = String(rangeMax);

      if (currentValue < rangeMin || currentValue > rangeMax) {
        slider.value = String(rangeMin);
      }
    }

    const formatCurrency = (value: number): string => `R$ ${value.toLocaleString('pt-BR')}`;
    const minRangeEl = document.getElementById('minRange');
    const maxRangeEl = document.getElementById('maxRange');
    if (minRangeEl) minRangeEl.textContent = `Min: ${formatCurrency(minVal)}`;
    if (maxRangeEl) maxRangeEl.textContent = `Max: ${formatCurrency(maxVal)}`;

    const actualMinValue = slider ? parseFloat(slider.value) || 0 : 0;
    const minValueDisplay = document.getElementById('minValueValue');
    const formatValue = (val: number): string => {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
      return val.toLocaleString('pt-BR');
    };
    if (minValueDisplay) minValueDisplay.textContent = formatValue(actualMinValue);
  } else {
    if (slider) {
      slider.min = '0';
      slider.max = '100000';
      slider.value = '0';
    }
    const minRangeEl = document.getElementById('minRange');
    const maxRangeEl = document.getElementById('maxRange');
    const minValueDisplay = document.getElementById('minValueValue');
    if (minRangeEl) minRangeEl.textContent = 'Min: R$ 0';
    if (maxRangeEl) maxRangeEl.textContent = 'Max: R$ 100.000';
    if (minValueDisplay) minValueDisplay.textContent = '0';
  }

  const sliderMinValue = slider ? parseFloat(slider.value) || 0 : 0;
  const actualMinValue = routeFocusState.searchTerm ? 0 : sliderMinValue;
  let aggregatedData = await window.duckdbAPI.queryAggregatedData(
    actualMinValue,
    partyFilter,
    categoryFilter,
    searchFilter
  );

  if (searchFilter) {
    const searchLower = searchFilter.toLowerCase();
    const matchingEntities = new Set<string>();

    aggregatedData.forEach(record => {
      const deputado = `${record['nome_parlamentar']} (${record['sigla_partido']})`;
      const fornecedor = record['fornecedor'] as string;

      if (deputado.toLowerCase().includes(searchLower)) {
        matchingEntities.add(deputado);
      }
      if (fornecedor.toLowerCase().includes(searchLower)) {
        matchingEntities.add(fornecedor);
      }
    });

    if (matchingEntities.size > 0) {
      aggregatedData = aggregatedData.filter(record => {
        const deputado = `${record['nome_parlamentar']} (${record['sigla_partido']})`;
        const fornecedor = record['fornecedor'] as string;
        return matchingEntities.has(deputado) || matchingEntities.has(fornecedor);
      });
    }
  }

  setProcessedDataFromAggregatedData(aggregatedData as unknown as AggregatedRecord[]);
}

// ── Graph filters ─────────────────────────────────────────────────────────────

function calculateNodeDensity(data: ProcessedData): Map<string, number> {
  const densityScores = new Map<string, number>();
  data.links.forEach(link => {
    const src = linkEndpointId(link.source);
    const tgt = linkEndpointId(link.target);
    densityScores.set(src, (densityScores.get(src) || 0) + 1);
    densityScores.set(tgt, (densityScores.get(tgt) || 0) + 1);
  });
  return densityScores;
}

function filterNodesByDensity(densityScores: Map<string, number>): Set<string> {
  const filteredScores = [...densityScores.entries()].filter(([, score]) => score >= 2);
  const sortedNodes = filteredScores
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(5, Math.floor(filteredScores.length * 0.2)));
  return new Set(sortedNodes.map(([nodeId]) => nodeId));
}

function applyGraphFilters(): ProcessedData {
  if (!processedData.nodes || !processedData.links) return processedData;

  let filteredNodes = [...processedData.nodes];
  let filteredLinks = [...processedData.links];

  if (graphFilters.densityMode) {
    const densityScores = calculateNodeDensity(processedData);
    const filteredNodeIds = filterNodesByDensity(densityScores);

    window.densityInfo = {
      totalNodes: processedData.nodes.length,
      filteredNodes: filteredNodeIds.size,
    };

    filteredNodes = processedData.nodes.filter(node => filteredNodeIds.has(node.id));
    filteredLinks = processedData.links.filter(link =>
      filteredNodeIds.has(linkEndpointId(link.source)) && filteredNodeIds.has(linkEndpointId(link.target))
    );
  }

  if (graphFilters.topExpensesMode) {
    const topLinks = [...filteredLinks].sort((a, b) => b.value - a.value).slice(0, 15);
    const topNodeIds = new Set<string>();
    topLinks.forEach(link => {
      topNodeIds.add(linkEndpointId(link.source));
      topNodeIds.add(linkEndpointId(link.target));
    });
    filteredNodes = filteredNodes.filter(node => topNodeIds.has(node.id));
    filteredLinks = topLinks;
  }

  const focusedNode = getRouteFocusedNode();
  if (focusedNode) {
    const focusedLinks = filteredLinks.filter(link => {
      const src = linkEndpointId(link.source);
      const tgt = linkEndpointId(link.target);
      return src === focusedNode.id || tgt === focusedNode.id;
    });

    const relatedNodeIds = new Set([focusedNode.id]);
    focusedLinks.forEach(link => {
      relatedNodeIds.add(linkEndpointId(link.source));
      relatedNodeIds.add(linkEndpointId(link.target));
    });

    filteredNodes = filteredNodes.filter(node => relatedNodeIds.has(node.id));
    filteredLinks = focusedLinks;
  }

  return { nodes: filteredNodes, links: filteredLinks };
}

// ── Visualization ─────────────────────────────────────────────────────────────

function initializeVisualization(): void {
  const d3 = window.d3 as unknown as D3Any;
  const loadingEl = document.querySelector('#loading') as HTMLElement | null;
  if (loadingEl) loadingEl.style.display = 'none';

  const filteredData = applyGraphFilters();

  if (graphFilters.densityMode || graphFilters.topExpensesMode) {
    if (statisticsCharts) {
      statisticsCharts.updateStatisticsForFilteredData(
        filteredData as unknown as Parameters<typeof statisticsCharts.updateStatisticsForFilteredData>[0],
        window.currentAggregatedData as unknown as Parameters<typeof statisticsCharts.updateStatisticsForFilteredData>[1]
      );
    }
  } else if (window.currentAggregatedData && statisticsCharts) {
    statisticsCharts.updateStatistics(window.currentAggregatedData as unknown as Parameters<typeof statisticsCharts.updateStatistics>[0]);
  }

  if (!filteredData.nodes || filteredData.nodes.length === 0) {
    if (loadingEl) {
      loadingEl.style.display = 'flex';
      loadingEl.innerHTML = 'Nenhum dado encontrado com os filtros aplicados';
    }
    return;
  }

  const svg = d3['select']('#graph-svg');
  const svgNode = svg['node']() as unknown as Element;
  const container = svgNode.parentElement;
  const width = container?.clientWidth ?? 800;
  const height = container?.clientHeight ?? 600;

  svg['attr']('width', width)['attr']('height', height);
  svg['selectAll']('*')['remove']();

  const zoom = d3['zoom']()
    ['scaleExtent']([0.1, 10])
    ['wheelDelta']((event: WheelEvent) => -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002))
    ['on']('zoom', (event: { transform: unknown }) => {
      g['attr']('transform', event.transform as string);
    });

  svg['call'](zoom)
    ['on']('dblclick.zoom', null)
    ['on']('click', (event: MouseEvent) => {
      if (event.target === event.currentTarget) {
        hideNodeInfo();
      }
    });

  const g = svg['append']('g');

  const nodes: NetworkNode[] = filteredData.nodes.map(d => ({
    ...d,
    id: d.id,
    x: Math.random() * width,
    y: Math.random() * height,
  }));

  const links: NetworkLink[] = filteredData.links.map(d => ({
    ...d,
    source: d.source,
    target: d.target,
  }));

  const getNodeRadius = (d: unknown): number => {
    return (d as NetworkNode).type === 'deputado' ? 8 : 6;
  };

  const forceSlider = document.getElementById('forceStrength') as HTMLInputElement | null;
  const currentForceValue = forceSlider ? parseInt(forceSlider.value) : 4;
  const forceStrength = -currentForceValue * 50;

  const simulation = d3['forceSimulation'](nodes as unknown as unknown[])
    ['force']('link', d3['forceLink'](links as unknown as unknown[])['id']((d: unknown) => (d as NetworkNode).id)['distance'](50))
    ['force']('charge', d3['forceManyBody']()['strength'](forceStrength))
    ['force']('center', d3['forceCenter'](width / 2, height / 2))
    ['force']('collision', d3['forceCollide']()['radius']((d: unknown) => getNodeRadius(d) + 2));

  window.currentSimulation = simulation;

  const colors = getThemeColors();
  const link = g['append']('g')
    ['selectAll']('line')
    ['data'](links as unknown as unknown[])
    ['enter']()['append']('line')
    ['attr']('stroke', colors.linkStroke)
    ['attr']('stroke-opacity', 0.4)
    ['attr']('stroke-width', 0.5);

  const searchFilter = (document.getElementById('searchBox') as HTMLInputElement | null)?.value.trim().toLowerCase() ?? '';
  const node = g['append']('g')
    ['selectAll']('circle')
    ['data'](nodes as unknown as unknown[])
    ['enter']()['append']('circle')
    ['attr']('r', getNodeRadius)
    ['attr']('fill', (d: unknown) => {
      const nd = d as NetworkNode;
      if (nd.type === 'deputado') {
        return colorByParty ? ColorUtils.getPartyColor(nd.party ?? '') : '#3b82f6';
      }
      return 'rgb(196, 82, 17)';
    })
    ['attr']('stroke', '#fff')
    ['attr']('stroke-width', (d: unknown) => (searchFilter && (d as NetworkNode).label.toLowerCase().includes(searchFilter)) ? 3 : 1.5)
    ['style']('cursor', 'pointer')
    ['on']('click', (event: MouseEvent, d: unknown) => {
      event.stopPropagation();
      void showNodeInfo(d as NetworkNode);
    })
    ['call'](d3['drag']()
      ['on']('start', dragstarted)
      ['on']('drag', dragged)
      ['on']('end', dragended)
    );

  const showCompanyNamesToggle = document.getElementById('showCompanyNames') as HTMLInputElement | null;
  const shouldShowCompanyNames = showCompanyNamesToggle?.checked || false;

  const label = g['append']('g')
    ['selectAll']('text')
    ['data'](nodes as unknown as unknown[])
    ['enter']()['append']('text')
    ['text']((d: unknown) => {
      const nd = d as NetworkNode;
      if (nd.type === 'deputado') {
        return nd.label;
      }
      return shouldShowCompanyNames ? (nd.label.length > 25 ? `${nd.label.substring(0, 25)}...` : nd.label) : '';
    })
    ['attr']('font-size', (d: unknown) => (d as NetworkNode).type === 'deputado' ? '10px' : '8px')
    ['attr']('fill', (d: unknown) => (d as NetworkNode).type === 'deputado' ? colors.deputadoLabelColor : 'rgb(196, 82, 17)')
    ['attr']('text-anchor', 'middle')
    ['attr']('dy', '0.35em')
    ['attr']('class', 'node-label')
    ['style']('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)');

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
    return `R$ ${value.toFixed(0)}`;
  };

  const showEdgeAmountsToggle = document.getElementById('showEdgeAmounts') as HTMLInputElement | null;
  const shouldShowEdgeAmounts = showEdgeAmountsToggle?.checked || false;

  const edgeLabels = g['append']('g')
    ['selectAll']('text')
    ['data'](links as unknown as unknown[])
    ['enter']()['append']('text')
    ['attr']('class', 'edge-label')
    ['text']((d: unknown) => formatCurrency((d as SimLink).value))
    ['attr']('font-size', '6px')
    ['attr']('fill', 'yellow')
    ['attr']('text-anchor', 'middle')
    ['attr']('dy', 3)
    ['style']('pointer-events', 'none')
    ['style']('opacity', shouldShowEdgeAmounts ? 0.8 : 0)
    ['style']('display', shouldShowEdgeAmounts ? 'block' : 'none')
    ['style']('font-weight', 'bold');

  simulation['on']('tick', () => {
    link
      ['attr']('x1', (d: unknown) => (d as SimLink).source.x)
      ['attr']('y1', (d: unknown) => (d as SimLink).source.y)
      ['attr']('x2', (d: unknown) => (d as SimLink).target.x)
      ['attr']('y2', (d: unknown) => (d as SimLink).target.y);

    node
      ['attr']('cx', (d: unknown) => (d as SimNode).x)
      ['attr']('cy', (d: unknown) => (d as SimNode).y);

    label
      ['attr']('x', (d: unknown) => (d as SimNode).x)
      ['attr']('y', (d: unknown) => (d as SimNode).y + 15);

    edgeLabels
      ['attr']('x', (d: unknown) => ((d as SimLink).source.x + (d as SimLink).target.x) / 2)
      ['attr']('y', (d: unknown) => ((d as SimLink).source.y + (d as SimLink).target.y) / 2);
  });

  function dragstarted(event: { active: boolean }, d: unknown): void {
    if (!event.active) (simulation as unknown as { alphaTarget(v: number): { restart(): void } }).alphaTarget(0.3).restart();
    const nd = d as SimNode;
    nd.fx = nd.x;
    nd.fy = nd.y;
  }

  function dragged(event: { x: number; y: number }, d: unknown): void {
    const nd = d as SimNode;
    nd.fx = event.x;
    nd.fy = event.y;
  }

  function dragended(event: { active: boolean }, _d: unknown): void {
    if (!event.active) (simulation as unknown as { alphaTarget(v: number): void }).alphaTarget(0);
  }

  const fitToView = (): void => {
    try {
      const gNode = g['node']() as unknown as SVGGraphicsElement;
      const bounds = gNode.getBBox();
      const fullWidth = bounds.width;
      const fullHeight = bounds.height;
      const centerX = bounds.x + fullWidth / 2;
      const centerY = bounds.y + fullHeight / 2;

      if (!isFinite(fullWidth) || !isFinite(fullHeight) || fullWidth <= 0 || fullHeight <= 0) {
        console.warn('Invalid bounds for fit to view, skipping');
        return;
      }

      const scale = Math.min(width / fullWidth, height / fullHeight) * 0.8;
      const translate: [number, number] = [width / 2 - scale * centerX, height / 2 - scale * centerY];

      if (!isFinite(translate[0]) || !isFinite(translate[1]) || !isFinite(scale)) {
        console.warn('Invalid transform values, skipping fit to view');
        return;
      }

      svg['transition']()
        ['duration'](750)
        ['call'](zoom['transform'], d3['zoomIdentity']['translate'](translate[0], translate[1])['scale'](scale));
    } catch (error) {
      console.warn('Error in fitToView:', error);
    }
  };

  d3['select']('#zoom-in')['on']('click', () => {
    svg['transition']()['duration'](300)['call'](zoom['scaleBy'], 1.5);
  });

  d3['select']('#zoom-out')['on']('click', () => {
    svg['transition']()['duration'](300)['call'](zoom['scaleBy'], 1 / 1.5);
  });

  d3['select']('#zoom-reset')['on']('click', fitToView);

  setTimeout(fitToView, 2000);

  updateD3Colors();

  window.currentVisualization = {
    label: label as unknown as Record<string, (...args: unknown[]) => unknown>,
    nodes,
    edgeLabels: edgeLabels as unknown as Record<string, (...args: unknown[]) => unknown>,
  };
}

function updateCompanyLabels(showNames: boolean): void {
  if (window.currentVisualization && window.currentVisualization.label) {
    const d3 = window.d3 as unknown as D3Any;
    const colors = getThemeColors();
    const label = window.currentVisualization.label as unknown as D3Any;
    label['text']((d: unknown) => {
      const nd = d as NetworkNode;
      if (nd.type === 'deputado') {
        return nd.label;
      }
      return showNames ? (nd.label.length > 25 ? `${nd.label.substring(0, 25)}...` : nd.label) : '';
    })
      ['attr']('font-size', (d: unknown) => (d as NetworkNode).type === 'deputado' ? '10px' : '8px')
      ['attr']('fill', (d: unknown) => (d as NetworkNode).type === 'deputado' ? colors.deputadoLabelColor : 'rgb(196, 82, 17)');
    void d3; // suppress unused warning
  }
}

function updateEdgeAmounts(showAmounts: boolean): void {
  if (window.currentVisualization && window.currentVisualization.edgeLabels) {
    const edgeLabels = window.currentVisualization.edgeLabels as unknown as D3Any;
    if (showAmounts) {
      edgeLabels['style']('display', 'block')
        ['transition']()['duration'](300)['style']('opacity', 0.8);
    } else {
      edgeLabels['transition']()
        ['duration'](300)
        ['style']('opacity', 0)
        ['on']('end', function(this: Element) {
          (window.d3 as unknown as D3Any)['select'](this)['style']('display', 'none');
        });
    }
  }
}

// ── URL handling ──────────────────────────────────────────────────────────────

function updateUrlForNode(nodeData: NetworkNode): void {
  try {
    let path = '';

    if (nodeData.type === 'deputado') {
      const slug = getNodeSlug(nodeData);
      path = `/deputado-${slug}`;
    } else if (nodeData.type === 'fornecedor') {
      const slug = getNodeSlug(nodeData);
      path = `/empresa-${slug}`;
    }

    if (path) {
      const params = new URLSearchParams(window.location.search);
      params.delete('route');
      params.delete('node');
      const nextSearch = params.toString();
      history.pushState({ nodeData }, '', `${withBasePath(path)}${nextSearch ? `?${nextSearch}` : ''}`);
    }
  } catch (error) {
    console.warn('Error updating URL for node:', error);
  }
}

async function handleUrlRouting(retryCount = 0): Promise<void> {
  try {
    if (!processedData || !processedData.nodes || processedData.nodes.length === 0) {
      if (retryCount >= 10) {
        console.error('Failed to load data for routing after 10 retries. Data may not be available.');
        showUrlRoutingFallback();
        return;
      }
      console.warn(`Data not yet available for routing, retrying... (attempt ${retryCount + 1}/10)`);
      setTimeout(() => { void handleUrlRouting(retryCount + 1); }, 1000);
      return;
    }

    let targetNode: NetworkNode | null = null;
    let slug = '';
    let entityType = '';
    const urlParams = new URLSearchParams(window.location.search);
    const routedPath = urlParams.get('route');
    const nodeParam = urlParams.get('node');

    const pathname = stripBasePath(window.location.pathname);
    const normalizedNodePath = nodeParam
      ? (nodeParam.startsWith('/') ? nodeParam : `/${nodeParam}`)
      : '';
    const normalizedRoutedPath = routedPath && routedPath.startsWith('/')
      ? stripBasePath(routedPath)
      : routedPath;
    const routePath = normalizedNodePath || (normalizedRoutedPath && normalizedRoutedPath.startsWith('/') ? normalizedRoutedPath : pathname);
    ({ entityType, slug } = parseEntityFromPath(routePath));
    if (!entityType) {
      const fragment = window.location.hash.slice(1);
      if (fragment.startsWith('parlamentar-')) {
        entityType = 'deputado';
        slug = fragment.replace('parlamentar-', '');
      } else if (fragment.startsWith('empresa-')) {
        entityType = 'fornecedor';
        slug = fragment.replace('empresa-', '');
      }
    }

    if (slug && entityType) {
      routeFocusState.active = true;
      routeFocusState.entityType = entityType;
      routeFocusState.slug = slug;

      if (!routeFocusState.filtersPrepared) {
        const hadChanges = resetFormSelectionsForRoute();
        routeFocusState.filtersPrepared = true;

        if (hadChanges || retryCount === 0) {
          updateVisualization()
            .then(() => {
              setTimeout(() => void handleUrlRouting(retryCount + 1), 200);
            })
            .catch(error => {
              console.warn('Error preparing route view:', error);
            });
          return;
        }
      }

      if (entityType === 'deputado') {
        targetNode = processedData.nodes.find(node => {
          if (node.type !== 'deputado') return false;
          return getNodeSlug(node) === slug;
        }) ?? null;

        if (!targetNode) {
          const routeNameSlug = getDeputadoNameOnlySlugFromRoute(slug);
          targetNode = processedData.nodes.find(node => {
            if (node.type !== 'deputado') return false;
            return getDeputadoNameOnlySlugFromNode(node) === routeNameSlug;
          }) ?? null;
        }
      } else if (entityType === 'fornecedor') {
        targetNode = findFornecedorNodeBySlug(slug);
      }
    }

    if (!slug || !entityType) {
      resetRouteFocusState();
    }

    if (!targetNode && slug && entityType && !routeFocusState.forcedSearchApplied) {
      if (entityType === 'fornecedor') {
        const resolvedLabel = await resolveFornecedorLabelFromDatabaseBySlug(slug);
        routeFocusState.searchTerm = resolvedLabel || slug.replace(/-/g, ' ').trim();
      } else {
        const nameSlug = getDeputadoNameOnlySlugFromRoute(slug);
        routeFocusState.searchTerm = nameSlug.replace(/-/g, ' ').trim();
      }
      routeFocusState.forcedSearchApplied = true;
      updateVisualization()
        .then(() => {
          setTimeout(() => void handleUrlRouting(retryCount + 1), 200);
        })
        .catch(error => {
          console.warn('Error retrying URL routing with forced route search:', error);
        });
      return;
    }

    if (!targetNode && slug && entityType && !routeFocusState.subgraphFallbackApplied) {
      routeFocusState.subgraphFallbackApplied = true;
      const loaded = await loadRouteSubgraphFallback(entityType, slug);
      if (loaded) {
        initializeVisualization();
        setTimeout(() => void handleUrlRouting(retryCount + 1), 150);
        return;
      }
    }

    if (targetNode) {
      routeFocusState.searchTerm = '';
      initializeVisualization();
      setTimeout(() => {
        void showNodeInfo(targetNode!);
      }, 1000);
    }
  } catch (error) {
    console.warn('Error handling URL routing:', error);
  }
}

function showUrlRoutingFallback(): void {
  const pathname = stripBasePath(window.location.pathname);
  const urlParams = new URLSearchParams(window.location.search);
  const nodeParam = urlParams.get('node');
  const routeParam = urlParams.get('route');
  const routePath = nodeParam
    ? (nodeParam.startsWith('/') ? nodeParam : `/${nodeParam}`)
    : (routeParam || pathname);
  let entityName = '';
  let entityType = '';

  ({ entityType, slug: entityName } = parseEntityFromPath(routePath));
  entityName = entityName.replace(/-/g, ' ');

  if (entityName && entityType) {
    document.title = `${entityName} - VISO`;

    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.innerHTML = `
                <div class="text-center">
                    <div class="text-yellow-400 mb-4">
                        <h2 class="text-xl font-bold">Procurando por: ${entityName}</h2>
                        <p class="text-sm">Tipo: ${entityType === 'deputado' ? 'Deputado(a)' : 'Empresa'}</p>
                    </div>
                    <div class="text-white">
                        <p>Os dados não puderam ser carregados para mostrar os detalhes desta ${entityType === 'deputado' ? 'deputada/deputado' : 'empresa'}.</p>
                        <p class="text-gray-400 text-sm mt-2">Verifique se o arquivo de dados está disponível e tente novamente.</p>
                    </div>
                    <button onclick="navigateHome()" class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
                        Voltar à página inicial
                    </button>
                </div>
            `;
    }
  }
}

// ── Node info panel ───────────────────────────────────────────────────────────

async function showNodeInfo(nodeData: NetworkNode): Promise<void> {
  const content = document.getElementById('node-info-content');
  const closeBtn = document.getElementById('close-panel');
  const rightPanel = document.getElementById('right-panel');

  if (!content || !closeBtn || !rightPanel) return;

  updateUrlForNode(nodeData);

  resetNodeAppearance();
  highlightNode(nodeData.id);

  rightPanel.classList.remove('translate-x-full');

  content.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="loading-spinner"></div>Carregando detalhes...</div>';
  content.style.display = 'block';
  content.className = 'p-4 flex flex-col flex-1 min-h-0';
  closeBtn.classList.remove('hidden');

  try {
    const detailsData = await getEntityDetails(nodeData);

    const formatCurrency = (value: number | string): string => {
      return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    };
    const formatNumber = (value: number | string): string => {
      return Number(value).toLocaleString('pt-BR');
    };
    const formatDate = (dateStr: string | undefined): string => {
      if (!dateStr) return 'N/A';
      try {
        if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/');
          const date = new Date(Number(year), Number(month) - 1, Number(day));
          return date.toLocaleDateString('pt-BR');
        }
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
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

    let contentHTML = '';

    if (nodeData.type === 'deputado') {
      const totalTransactions = detailsData.length;
      const totalValue = detailsData.reduce((sum, item) => sum + Number(item.valor_liquido), 0);

      contentHTML = `
                <div class="pb-3 border-b border-gray-600 mb-3">
                    <h4 class="text-base font-bold text-deputy mb-1">${nodeData.label}</h4>
                    <div class="flex justify-between items-center text-xs text-gray-400 mb-1">
                        <span>Gastou ${formatCurrency(totalValue)} em ${formatNumber(totalTransactions)} Transações</span>
                    </div>
                    <div class="text-xs text-gray-400"></div>
                </div>
                <div class="flex-1 flex flex-col min-h-0">
                    <div class="mb-3">
                        <div class="bg-gray-800 rounded p-3">
                            <canvas id="timeSeriesChart" width="280" height="120" class="w-full"></canvas>
                        </div>
                    </div>

                    <div class="node-info-scroll-container">
                        ${detailsData.slice(0, 200).map(item => `
                            <div class="transaction-card bg-gray-800/50 backdrop-blur-sm border border-gray-600/30 rounded-lg p-3 hover:bg-gray-700/70 hover:border-gray-500/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md border-l-4 border-l-supplier" onclick="highlightNodeInVisualization('${(item.fornecedor ?? '').replace(/'/g, "\\'")}', 'fornecedor')">
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="font-semibold text-supplier text-sm truncate flex-1" title="${item.fornecedor ?? ''}">→ ${item.fornecedor ?? ''}</div>
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
                        `).join('')}
                    </div>
                </div>
            `;
    } else {
      const totalTransactions = detailsData.length;
      const totalValue = detailsData.reduce((sum, item) => sum + Number(item.valor_liquido), 0);

      contentHTML = `
                <div class="pb-3 border-b border-gray-600 mb-3">
                    <h4 class="text-base font-bold text-supplier mb-1">${nodeData.label}</h4>
                    <div class="flex justify-between items-center text-xs text-gray-400 mb-1">
                        <span>Recebeu ${formatCurrency(totalValue)} em ${formatNumber(totalTransactions)} Transações</span>
                    </div>
                    <div class="text-xs text-gray-400"></div>
                </div>
                <div class="flex-1 flex flex-col min-h-0">
                    <div class="mb-3">
                        <div class="bg-gray-800 rounded p-3">
                            <canvas id="timeSeriesChart" width="280" height="120" class="w-full"></canvas>
                        </div>
                    </div>

                    <div class="node-info-scroll-container">
                        ${detailsData.slice(0, 200).map(item => `
                            <div class="transaction-card bg-gray-800/50 backdrop-blur-sm border border-gray-600/30 rounded-lg p-3 hover:bg-gray-700/70 hover:border-gray-500/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md border-l-4 border-l-deputy" onclick="highlightNodeInVisualization('${(item.nome_parlamentar ?? '').replace(/'/g, "\\'")}', 'deputado')">
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="font-semibold text-deputy text-sm truncate flex-1">← ${item.nome_parlamentar ?? ''} ${item.sigla_partido ?? ''}</div>
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
                        `).join('')}
                    </div>
                </div>
            `;
    }

    content.innerHTML = contentHTML;

    setTimeout(() => {
      if (statisticsCharts) {
        statisticsCharts.createTimeSeriesChart(detailsData as unknown as Parameters<typeof statisticsCharts.createTimeSeriesChart>[0]);
      }
    }, 50);

  } catch (error) {
    console.error('Erro ao carregar detalhes:', error);
    if (content) {
      content.innerHTML = `<div class="text-red-400 text-sm">Erro ao carregar detalhes: ${(error as Error).message}</div>`;
    }
  }
}

async function getEntityDetails(nodeData: NetworkNode): Promise<EntityDetails[]> {
  let query = '';
  let entityName = '';

  if (nodeData.type === 'deputado') {
    entityName = nodeData.label.replace(/\([^)]*\)/, '').trim();
    query = `
            SELECT
                fornecedor,
                strftime(data_emissao, '%d/%m/%Y') as data_emissao,
                valor_liquido,
                categoria_despesa,
                subcategoria_despesa
            FROM despesas
            WHERE nome_parlamentar = '${entityName}'
            ORDER BY data_emissao DESC, valor_liquido DESC
        `;
  } else {
    entityName = nodeData.label;
    query = `
            SELECT
                nome_parlamentar,
                sigla_partido,
                strftime(data_emissao, '%d/%m/%Y') as data_emissao,
                valor_liquido,
                categoria_despesa,
                subcategoria_despesa
            FROM despesas
            WHERE fornecedor = '${entityName}'
            ORDER BY data_emissao DESC, valor_liquido DESC
        `;
  }

  const result = await window.duckdbAPI.query(query);
  return result.toArray() as unknown as EntityDetails[];
}

function highlightNodeInVisualization(entityName: string, entityType: string): void {
  if (!window.currentVisualization) return;

  const d3 = window.d3 as unknown as D3Any;

  const targetNode = window.currentVisualization.nodes.find(node => {
    if (entityType === 'fornecedor') {
      return node.type === 'fornecedor' && node.label === entityName;
    }
    return node.type === 'deputado' && (
      node.label.includes(entityName) ||
      entityName.includes(node.label.split('(')[0].trim())
    );
  });

  if (!targetNode) return;

  const svg = d3['select']('#graph-svg');
  resetNodeAppearance();
  highlightNode(targetNode.id);

  const svgEl = svg['node']() as unknown as Element;
  const transform = d3['zoomTransform'](svgEl) as unknown as { k: number; x: number; y: number };
  const x = targetNode.x ?? 0;
  const y = targetNode.y ?? 0;

  if (!isFinite(x) || !isFinite(y)) {
    console.warn('Node has invalid coordinates, skipping pan');
    return;
  }

  const scale = Math.max(transform.k, 1.5);

  const containerRect = svgEl.getBoundingClientRect();
  const centerX = containerRect.width / 2;
  const centerY = containerRect.height / 2;

  const translateX = centerX - scale * x;
  const translateY = centerY - scale * y;

  if (!isFinite(translateX) || !isFinite(translateY) || !isFinite(scale)) {
    console.warn('Invalid transform values in highlight, skipping pan');
    return;
  }

  const newTransform = d3['zoomIdentity']['translate'](translateX, translateY)['scale'](scale);

  svg['transition']()['duration'](800)['call'](d3['zoom']()['transform'], newTransform);
}

function hideNodeInfo(): void {
  const rightPanel = document.getElementById('right-panel');
  const content = document.getElementById('node-info-content');
  const closeBtn = document.getElementById('close-panel');

  if (!rightPanel || !content || !closeBtn) return;

  try {
    const params = new URLSearchParams(window.location.search);
    params.delete('route');
    params.delete('node');
    const nextSearch = params.toString();
    history.pushState('', '', `${withBasePath('/')}${nextSearch ? `?${nextSearch}` : ''}`);
  } catch (error) {
    console.warn('Error clearing URL:', error);
  }

  const hadRouteFocus = routeFocusState.active;
  resetRouteFocusState();

  resetNodeAppearance();

  rightPanel.classList.add('translate-x-full');

  setTimeout(() => {
    content.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-400">Clique em um nó para ver detalhes</p>';
    content.className = 'p-4 flex flex-col flex-1 min-h-0';
    closeBtn.classList.add('hidden');
  }, 300);

  if (hadRouteFocus) {
    void updateVisualization();
  }
}

async function updateVisualization(): Promise<void> {
  await processData();
  initializeVisualization();
}

// ── Event listeners ───────────────────────────────────────────────────────────

function setupEventListeners(): void {
  const minValueSlider = document.getElementById('minValue') as HTMLInputElement | null;
  const minValueDisplay = document.getElementById('minValueValue');
  const partyFilter = document.getElementById('partyFilter') as HTMLSelectElement | null;
  const categoryFilter = document.getElementById('categoryFilter') as HTMLSelectElement | null;
  const showCompanyNames = document.getElementById('showCompanyNames') as HTMLInputElement | null;
  const searchBox = document.getElementById('searchBox') as HTMLInputElement | null;
  const clearSearch = document.getElementById('clearSearch');

  function updateSliderDisplay(): void {
    if (!minValueSlider || !minValueDisplay) return;
    const value = parseInt(minValueSlider.value);
    const formatValue = (val: number): string => {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
      return val.toLocaleString('pt-BR');
    };
    minValueDisplay.textContent = formatValue(value);
  }

  let sliderTimeout: ReturnType<typeof setTimeout>;
  if (minValueSlider) {
    minValueSlider.addEventListener('input', () => {
      updateSliderDisplay();
      clearTimeout(sliderTimeout);
      sliderTimeout = setTimeout(() => { void updateVisualization(); }, 500);
    });
  }

  const forceSlider = document.getElementById('forceStrength') as HTMLInputElement | null;
  if (forceSlider) {
    forceSlider.addEventListener('input', (e) => {
      const forceValue = parseInt((e.target as HTMLInputElement).value);
      if (window.currentSimulation) {
        const d3 = window.d3 as unknown as D3Any;
        const sim = window.currentSimulation as D3Any;
        const strength = -forceValue * 50;
        sim['force']('charge', d3['forceManyBody']()['strength'](strength));
        (sim['alphaTarget'](0.3) as unknown as D3Any)['restart']();
        setTimeout(() => sim['alphaTarget'](0), 1000);
      }
    });
  }

  function resetSliderRange(): void {
    if (!minValueSlider) return;
    minValueSlider.value = '0';
    minValueSlider.min = '0';
    minValueSlider.max = '100000';
    const minRangeEl = document.getElementById('minRange');
    const maxRangeEl = document.getElementById('maxRange');
    if (minRangeEl) minRangeEl.textContent = 'Min: R$ 0';
    if (maxRangeEl) maxRangeEl.textContent = 'Max: R$ 100.000';
    updateSliderDisplay();
  }

  if (partyFilter) {
    partyFilter.addEventListener('change', () => {
      resetSliderRange();
      void updateVisualization();
    });
  }
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      resetSliderRange();
      void updateVisualization();
    });
  }

  let searchTimeout: ReturnType<typeof setTimeout>;
  if (searchBox) {
    searchBox.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value.trim();
      if (clearSearch) {
        if (value) {
          clearSearch.classList.remove('hidden');
        } else {
          clearSearch.classList.add('hidden');
        }
      }
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => { void updateVisualization(); }, 300);
    });

    searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        void updateVisualization();
      } else if (e.key === 'Escape') {
        searchBox.value = '';
        if (clearSearch) clearSearch.classList.add('hidden');
        clearTimeout(searchTimeout);
        void updateVisualization();
      }
    });
  }

  if (clearSearch) {
    clearSearch.addEventListener('click', () => {
      if (searchBox) searchBox.value = '';
      clearSearch.classList.add('hidden');
      void updateVisualization();
    });
  }

  if (showCompanyNames) {
    showCompanyNames.addEventListener('change', (e) => {
      updateCompanyLabels((e.target as HTMLInputElement).checked);
    });
  }

  const showEdgeAmounts = document.getElementById('showEdgeAmounts') as HTMLInputElement | null;
  if (showEdgeAmounts) {
    showEdgeAmounts.addEventListener('change', (e) => {
      updateEdgeAmounts((e.target as HTMLInputElement).checked);
    });
  }

  updateSliderDisplay();

  const graphDensityToggle = document.getElementById('graphDensityToggle') as HTMLInputElement | null;
  const topExpensesToggle = document.getElementById('topExpensesToggle') as HTMLInputElement | null;

  if (graphDensityToggle) {
    graphDensityToggle.addEventListener('change', () => {
      graphFilters.densityMode = graphDensityToggle.checked;
      initializeVisualization();
    });
  }

  if (topExpensesToggle) {
    topExpensesToggle.addEventListener('change', () => {
      graphFilters.topExpensesMode = topExpensesToggle.checked;
      initializeVisualization();
    });
  }

  const colorByPartyToggle = document.getElementById('colorByParty') as HTMLInputElement | null;
  if (colorByPartyToggle) {
    colorByPartyToggle.addEventListener('change', (e) => {
      colorByParty = (e.target as HTMLInputElement).checked;
      updateNodeColors();
    });
  }

  const closePanel = document.getElementById('close-panel');
  if (closePanel) {
    closePanel.addEventListener('click', () => {
      hideNodeInfo();
    });
  }
}

// ── Theme helpers ─────────────────────────────────────────────────────────────

function getThemeColors(): ThemeColors {
  return {
    linkStroke: '#999',
    backgroundColor: '#0f1419',
    deputadoLabelColor: 'white',
    selectionStroke: '#FFD700',
  };
}

function updateNodeColors(): void {
  if (!window.currentVisualization) return;
  const d3 = window.d3 as unknown as D3Any;
  const svg = d3['select']('#graph-svg');
  svg['selectAll']('circle')['attr']('fill', (d: unknown) => {
    const nd = d as NetworkNode;
    if (nd.type === 'deputado') {
      return colorByParty ? ColorUtils.getPartyColor(nd.party ?? '') : '#3b82f6';
    }
    return 'rgb(196, 82, 17)';
  });
}

function updateD3Colors(): void {
  const d3 = window.d3 as unknown as D3Any;
  const colors = getThemeColors();
  const svg = d3['select']('#graph-svg');
  svg['selectAll']('line')['attr']('stroke', colors.linkStroke);
  svg['selectAll']('text:not(.edge-label)')['attr']('fill', (d: unknown) => {
    if (d && (d as NetworkNode).type === 'deputado') {
      return colors.deputadoLabelColor;
    }
    return 'rgb(196, 82, 17)';
  });
}

function updateSliderTheme(): void {
  const slider = document.getElementById('minValue') as HTMLInputElement | null;
  if (slider) {
    slider.style.display = 'none';
    slider.offsetHeight; // Trigger reflow
    slider.style.display = 'block';
    slider.style.setProperty('--track-bg', '#374151');
    slider.style.setProperty('--thumb-border', '#1f2937');
  }
}

// ── Search result helpers ─────────────────────────────────────────────────────

function checkForSingleSearchResult(searchTerm: string): void {
  if (!processedData.nodes || !searchTerm) return;

  const searchLower = searchTerm.toLowerCase();
  const matchingNodes = processedData.nodes.filter(node =>
    node.label.toLowerCase().includes(searchLower)
  );

  if (matchingNodes.length === 1) {
    setTimeout(() => { void showNodeInfo(matchingNodes[0]); }, 500);
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────

window.addEventListener('popstate', () => {
  if (processedData && processedData.nodes) {
    hideNodeInfo();
    setTimeout(() => { void handleUrlRouting(); }, 100);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  updateSliderTheme();
  loadData().catch(error => {
    console.error('Failed to load data:', error);
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus('error', 'Falha na inicialização');
    }
  });
});

async function navigateHome(): Promise<void> {
  try {
    const { getBasePath } = await import('../shared/app-config.js');
    const basePath = getBasePath();
    window.location.href = `${basePath}index.html`;
  } catch (error) {
    window.location.href = './index.html';
  }
}

window.highlightNodeInVisualization = highlightNodeInVisualization;
window.navigateHome = navigateHome;

export { loadData, setupEventListeners, initializeVisualization };
