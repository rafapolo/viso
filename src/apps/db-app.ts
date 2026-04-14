// Database Application Main Controller - Refactored Version
import { EditorManager } from '../db/editor-manager.js';
import { QueryExecutor } from '../db/query-executor.js';
import { PaginationHandler } from '../db/pagination-handler.js';
import { ResultsDisplay, SchemaColumn } from '../db/results-display.js';
import { APIUtils } from '../shared/api-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { DOMUtils } from '../shared/dom-utils.js';
import { UIComponents } from '../shared/ui-utils.js';
import { SankeyTab } from '../features/visualization/sankey-tab.js';
import { getGlobalDatabaseService } from '../services/database-service.js';

interface QueryData {
  title: string;
  category: string;
  query: string;
  isVisualization?: boolean;
}

type QueryRegistry = Record<string, QueryData>;

class DatabaseApp {
  private databaseService: ReturnType<typeof getGlobalDatabaseService>;
  private editorManager: EditorManager | null;
  private queryExecutor: QueryExecutor | null;
  private paginationHandler: PaginationHandler | null;
  private resultsDisplay: ResultsDisplay | null;
  private sankeyTab: SankeyTab | null;
  private isInitialized: boolean;
  private currentSchema: SchemaColumn[];

  constructor() {
    this.databaseService = getGlobalDatabaseService();
    this.editorManager = null;
    this.queryExecutor = null;
    this.paginationHandler = null;
    this.resultsDisplay = null;
    this.sankeyTab = null;
    this.isInitialized = false;
    this.currentSchema = [];
  }

  async initialize(): Promise<void> {
    try {
      this.initializeModules();
      await this.setupEditor();
      await this.loadInitialData();
      this.setupEventListeners();
      UIComponents.setupCategoryToggles();
      UIComponents.registerServiceWorker('/sw.js', false);
      this.isInitialized = true;
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Database App Initialization');
      this.showInitializationError(error as Error);
    }
  }

  initializeModules(): void {
    this.paginationHandler = new PaginationHandler();
    this.resultsDisplay = new ResultsDisplay(this.paginationHandler);
    this.queryExecutor = new QueryExecutor();
    this.editorManager = new EditorManager();
    this.sankeyTab = new SankeyTab();
  }

  async setupEditor(): Promise<void> {
    try {
      await this.editorManager!.initializeEditor();
      const defaultQuery = this.getDefaultQuery();
      this.editorManager!.setValue(defaultQuery);
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Editor Setup');
      throw error;
    }
  }

  async loadInitialData(): Promise<void> {
    try {
      await this.databaseService.initialize?.();
      await this.databaseService.loadData?.();
      await this.loadSchema();
      await this.loadQueryFromUrl();

      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get('query') && !urlParams.get('analise')) {
        const sankeyButton = document.querySelector('[data-id="sankey-fluxos"]');
        if (sankeyButton) {
          document.querySelectorAll('.sample-query').forEach(btn => {
            btn.classList.remove('selected');
          });
          sankeyButton.classList.add('selected');
        }

        await this.showSankey();
      }
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Initial Data Load');
    }
  }

  async loadSchema(): Promise<void> {
    try {
      const schema = await this.databaseService.getSchema();

      if (schema && schema.length > 0) {
        this.currentSchema = schema as unknown as SchemaColumn[];
        this.resultsDisplay!.displaySchema(this.currentSchema);
        this.resultsDisplay!.updateConnectionStatus('Conectado', false);
      }
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Schema Load');
      this.resultsDisplay!.setDisconnectedStatus();
    }
  }

  async executeDefaultQuery(): Promise<void> {
    const defaultQuery = this.getDefaultQuery();

    try {
      const result = await this.queryExecutor!.executeQuery(defaultQuery);

      if (result) {
        this.resultsDisplay!.displayResults(result);
      }
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Default Query Execution');
      this.resultsDisplay!.clearResults();
    }
  }

  getDefaultQuery(): string {
    return this.getSankeyFluxosQuery();
  }

  getQueryRegistry(): QueryRegistry {
    return {
      'sankey-fluxos': {
        title: 'Fluxos para top 100 Empresas',
        category: 'exemplos',
        query: this.getSankeyFluxosQuery(),
        isVisualization: true,
      },
      'ver-primeiros-10-registros': {
        title: 'Ver primeiros 10 registros',
        category: 'exemplos',
        query: `SELECT *\nFROM despesas\nLIMIT 10`,
      },
      'top-fornecedores-por-valor': {
        title: 'Top fornecedores por valor',
        category: 'exemplos',
        query: `SELECT fornecedor,\n    COUNT(*) AS total,\n    SUM(valor_liquido) AS value\nFROM despesas\nGROUP BY fornecedor\nORDER BY value DESC\nLIMIT 15`,
      },
      'top-categorias': {
        title: 'Top categorias',
        category: 'exemplos',
        query: `SELECT categoria_despesa,\n    COUNT(*) AS count,\n    AVG(valor_liquido) AS avg\nFROM despesas\nGROUP BY categoria_despesa\nORDER BY count DESC\nLIMIT 10`,
      },
      'top-deputados': {
        title: 'Top deputados',
        category: 'exemplos',
        query: `SELECT nome_parlamentar,\n    sigla_partido,\n    SUM(valor_liquido) AS total\nFROM despesas\nGROUP BY nome_parlamentar, sigla_partido\nORDER BY total DESC\nLIMIT 20`,
      },
      'fornecedores-multi-deputados': {
        title: 'Fornecedores multi-deputados',
        category: 'exemplos',
        query: `SELECT fornecedor,\n    COUNT(DISTINCT nome_parlamentar) AS deputies,\n    SUM(valor_liquido) AS total\nFROM despesas\nGROUP BY fornecedor\nHAVING deputies > 5\nORDER BY total DESC\nLIMIT 15`,
      },
      'tendencias-mensais-2-anos': {
        title: 'Tendências mensais (2 anos)',
        category: 'temporal',
        query: `SELECT EXTRACT(YEAR FROM data_emissao) AS ano,\n    EXTRACT(MONTH FROM data_emissao) AS mes,\n    SUM(valor_liquido) AS total,\n    COUNT(*) AS transacoes\nFROM despesas\nWHERE data_emissao IS NOT NULL\nGROUP BY ano, mes\nORDER BY ano DESC, mes DESC\nLIMIT 24`,
      },
      'padrao-por-dia-da-semana': {
        title: 'Padrão por dia da semana',
        category: 'temporal',
        query: `SELECT \n    CASE EXTRACT(DOW FROM data_emissao) \n        WHEN 0 THEN 'Domingo' \n        WHEN 1 THEN 'Segunda' \n        WHEN 2 THEN 'Terça' \n        WHEN 3 THEN 'Quarta' \n        WHEN 4 THEN 'Quinta' \n        WHEN 5 THEN 'Sexta' \n        WHEN 6 THEN 'Sábado' \n    END AS dia_semana,\n    COUNT(*) AS total_despesas,\n    SUM(valor_liquido) AS valor_total,\n    AVG(valor_liquido) AS valor_medio\nFROM despesas \nWHERE data_emissao IS NOT NULL \nGROUP BY EXTRACT(DOW FROM data_emissao) \nORDER BY EXTRACT(DOW FROM data_emissao)`,
      },
      'comparacao-ano-a-ano': {
        title: 'Comparação ano a ano',
        category: 'temporal',
        query: `SELECT \n    EXTRACT(YEAR FROM data_emissao) AS ano,\n    SUM(valor_liquido) AS total_ano,\n    COUNT(*) AS transacoes\nFROM despesas \nWHERE data_emissao IS NOT NULL \nGROUP BY ano \nORDER BY ano DESC`,
      },
      'top-transacoes-mais-caras': {
        title: 'Top transações mais caras',
        category: 'category',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    valor_liquido,\n    fornecedor,\n    strftime(data_emissao, '%d/%m/%Y') as data_emissao\nFROM despesas \nORDER BY valor_liquido DESC \nLIMIT 20`,
      },
      'categorias-e-subcategorias': {
        title: 'Categorias e subcategorias',
        category: 'category',
        query: `SELECT \n    categoria_despesa,\n    subcategoria_despesa,\n    COUNT(*) AS total_transacoes,\n    SUM(valor_liquido) AS total_valor,\n    AVG(valor_liquido) AS valor_medio\nFROM despesas \nGROUP BY categoria_despesa, subcategoria_despesa \nORDER BY total_valor DESC \nLIMIT 30`,
      },
      'estatisticas-por-categoria': {
        title: 'Estatísticas por categoria',
        category: 'category',
        query: `SELECT \n    categoria_despesa,\n    MAX(valor_liquido) AS maior_valor,\n    AVG(valor_liquido) AS valor_medio,\n    MIN(valor_liquido) AS menor_valor,\n    COUNT(*) AS total\nFROM despesas \nGROUP BY categoria_despesa \nORDER BY maior_valor DESC`,
      },
      'gastos-relacionados-a-viagens': {
        title: 'Gastos relacionados a viagens',
        category: 'travel',
        query: `SELECT \n    categoria_despesa,\n    COUNT(*) AS total,\n    SUM(valor_liquido) AS valor\nFROM despesas \nWHERE categoria_despesa ILIKE '%PASSAGEM%' \n   OR categoria_despesa ILIKE '%VEÍCULOS%' \n   OR categoria_despesa ILIKE '%COMBUSTÍVEIS%' \n   OR categoria_despesa ILIKE '%HOSPEDAGEM%' \n   OR categoria_despesa ILIKE '%LOCAÇÃO%' \n   OR categoria_despesa ILIKE '%TÁXI%' \nGROUP BY categoria_despesa \nORDER BY valor DESC`,
      },
      'despesas-por-ano-de-competencia': {
        title: 'Despesas por ano de competência',
        category: 'travel',
        query: `SELECT \n    ano_competencia,\n    COUNT(*) AS total_despesas,\n    SUM(valor_liquido) AS valor_total,\n    AVG(valor_liquido) AS valor_medio\nFROM despesas \nWHERE ano_competencia IS NOT NULL \nGROUP BY ano_competencia \nORDER BY ano_competencia DESC`,
      },
      'top-gastos-por-deputado': {
        title: 'Top gastos por deputado',
        category: 'travel',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    SUM(valor_liquido) AS total_gastos,\n    COUNT(*) AS num_despesas\nFROM despesas \nGROUP BY nome_parlamentar, sigla_partido \nORDER BY total_gastos DESC \nLIMIT 25`,
      },
      'gasto-hospedagem-por-partido': {
        title: 'Gasto mínimo, médio e máximo em hospedagem por partido',
        category: 'travel',
        query: `SELECT \n    sigla_partido,\n    MIN(valor_liquido) AS gasto_minimo,\n    AVG(valor_liquido) AS gasto_medio,\n    MAX(valor_liquido) AS gasto_maximo,\n    COUNT(*) AS total_despesas,\n    SUM(valor_liquido) AS valor_total\nFROM despesas \nWHERE categoria_despesa ILIKE '%HOSPEDAGEM%'\nGROUP BY sigla_partido \nORDER BY gasto_medio DESC`,
      },
      'top-fornecedores-por-receita': {
        title: 'Top fornecedores por receita',
        category: 'vendor',
        query: `SELECT \n    fornecedor,\n    SUM(valor_liquido) AS receita_total,\n    COUNT(*) AS total_transacoes,\n    COUNT(DISTINCT nome_parlamentar) AS deputados_atendidos,\n    AVG(valor_liquido) AS valor_medio\nFROM despesas \nGROUP BY fornecedor \nORDER BY receita_total DESC \nLIMIT 20`,
      },
      'concentracao-do-mercado': {
        title: 'Concentração do mercado (%)',
        category: 'vendor',
        query: `WITH market_share AS (\n    SELECT \n        fornecedor,\n        SUM(valor_liquido) AS receita,\n        (SUM(valor_liquido) * 100.0 / (\n            SELECT SUM(valor_liquido) FROM despesas\n        )) AS participacao\n    FROM despesas \n    GROUP BY fornecedor \n    ORDER BY receita DESC\n)\nSELECT \n    fornecedor,\n    receita,\n    ROUND(participacao, 2) AS participacao_pct\nFROM market_share \nLIMIT 15`,
      },
      'relacionamentos-de-alto-valor': {
        title: 'Relacionamentos de alto valor',
        category: 'vendor',
        query: `SELECT \n    fornecedor,\n    nome_parlamentar,\n    sigla_partido,\n    SUM(valor_liquido) AS total_gasto,\n    COUNT(*) AS transacoes\nFROM despesas \nGROUP BY fornecedor, nome_parlamentar, sigla_partido \nHAVING SUM(valor_liquido) > 50000 \nORDER BY total_gasto DESC \nLIMIT 30`,
      },
      'principal-fornecedor-por-categoria': {
        title: 'Principal fornecedor por categoria',
        category: 'vendor',
        query: `WITH fornecedor_categoria AS (\n    SELECT \n        categoria_despesa,\n        fornecedor,\n        COUNT(*) AS num_transacoes,\n        SUM(valor_liquido) AS gasto_total,\n        ROW_NUMBER() OVER (\n            PARTITION BY categoria_despesa \n            ORDER BY COUNT(*) DESC, SUM(valor_liquido) DESC\n        ) AS rank_transacoes\n    FROM despesas \n    GROUP BY categoria_despesa, fornecedor\n)\nSELECT \n    categoria_despesa,\n    fornecedor AS principal_fornecedor,\n    num_transacoes,\n    gasto_total\nFROM fornecedor_categoria \nWHERE rank_transacoes = 1 \nORDER BY num_transacoes DESC`,
      },
      'ranking-de-gastos-por-deputado': {
        title: 'Ranking de gastos por deputado',
        category: 'parliamentary',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    SUM(valor_liquido) AS total_gasto,\n    COUNT(*) AS num_transacoes,\n    AVG(valor_liquido) AS gasto_medio\nFROM despesas \nGROUP BY nome_parlamentar, sigla_partido \nORDER BY total_gasto DESC \nLIMIT 20`,
      },
      'deputados-mais-menos-ativos': {
        title: 'Deputados mais/menos ativos',
        category: 'parliamentary',
        query: `WITH activity_stats AS (\n    SELECT \n        nome_parlamentar,\n        sigla_partido,\n        COUNT(*) AS num_transacoes,\n        SUM(valor_liquido) AS total_gasto\n    FROM despesas \n    GROUP BY nome_parlamentar, sigla_partido\n),\ntop_active AS (\n    SELECT \n        'Mais ativos' AS tipo,\n        nome_parlamentar,\n        sigla_partido,\n        num_transacoes,\n        total_gasto\n    FROM activity_stats \n    ORDER BY num_transacoes DESC \n    LIMIT 10\n),\nleast_active AS (\n    SELECT \n        'Menos ativos' AS tipo,\n        nome_parlamentar,\n        sigla_partido,\n        num_transacoes,\n        total_gasto\n    FROM activity_stats \n    ORDER BY num_transacoes ASC \n    LIMIT 10\n)\nSELECT * \nFROM (\n    SELECT * FROM top_active \n    UNION ALL \n    SELECT * FROM least_active\n) \nORDER BY \n    CASE WHEN tipo = 'Mais ativos' THEN 1 ELSE 2 END,\n    num_transacoes DESC`,
      },
      'possiveis-despesas-duplicadas': {
        title: 'Possíveis despesas duplicadas',
        category: 'audit',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    fornecedor,\n    valor_liquido,\n    strftime(data_emissao, '%d/%m/%Y') as data_emissao,\n    COUNT(*) AS duplicatas\nFROM despesas \nGROUP BY \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    fornecedor,\n    valor_liquido,\n    data_emissao \nHAVING COUNT(*) > 1 \nORDER BY duplicatas DESC, valor_liquido DESC \nLIMIT 20`,
      },
      'valores-redondos-suspeitos': {
        title: 'Valores redondos suspeitos',
        category: 'audit',
        query: `SELECT \n    valor_liquido,\n    COUNT(*) AS frequencia\nFROM despesas \nWHERE valor_liquido % 100 = 0 \n  AND valor_liquido >= 1000 \nGROUP BY valor_liquido \nORDER BY frequencia DESC \nLIMIT 20`,
      },
      'gastos-altos-em-fins-de-semana': {
        title: 'Gastos altos em fins de semana',
        category: 'audit',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    valor_liquido,\n    fornecedor,\n    strftime(data_emissao, '%d/%m/%Y') as data_emissao\nFROM despesas \nWHERE EXTRACT(DOW FROM data_emissao) IN (0, 6) \n  AND valor_liquido > 5000 \nORDER BY valor_liquido DESC \nLIMIT 25`,
      },
      'outliers-estatisticos': {
        title: 'Outliers estatísticos (Z > 3)',
        category: 'audit',
        query: `WITH outliers AS (\n    SELECT *,\n        (valor_liquido - AVG(valor_liquido) OVER (\n            PARTITION BY categoria_despesa\n        )) / STDDEV(valor_liquido) OVER (\n            PARTITION BY categoria_despesa\n        ) AS z_score\n    FROM despesas \n    WHERE valor_liquido IS NOT NULL\n)\nSELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    valor_liquido,\n    fornecedor,\n    ROUND(z_score, 2) AS desvio_padrao\nFROM outliers \nWHERE ABS(z_score) > 3 \nORDER BY ABS(z_score) DESC \nLIMIT 30`,
      },
      'valores-altos-duplicados': {
        title: 'Valores altos duplicados',
        category: 'audit',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    valor_liquido,\n    fornecedor,\n    COUNT(*) AS frequencia\nFROM despesas \nWHERE valor_liquido > 50000 \nGROUP BY \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    valor_liquido,\n    fornecedor \nHAVING COUNT(*) > 1 \nORDER BY valor_liquido DESC \nLIMIT 20`,
      },
      'escore-z-por-deputado': {
        title: 'Escore Z por deputado',
        category: 'civica',
        query: `WITH totais AS (\n    SELECT nome_parlamentar, sigla_partido,\n           SUM(valor_liquido) AS total_gasto\n    FROM despesas\n    WHERE valor_liquido IS NOT NULL\n    GROUP BY nome_parlamentar, sigla_partido\n),\nstats AS (\n    SELECT AVG(total_gasto) AS media, STDDEV(total_gasto) AS desvio\n    FROM totais\n)\nSELECT t.nome_parlamentar, t.sigla_partido, t.total_gasto,\n       ROUND(s.media, 2) AS media_nacional,\n       ROUND((t.total_gasto - s.media) / NULLIF(s.desvio, 0), 2) AS z_score\nFROM totais t CROSS JOIN stats s\nORDER BY z_score DESC\nLIMIT 30`,
      },
      'deputados-fora-do-padrao': {
        title: 'Deputados fora do padrão (≥2σ)',
        category: 'civica',
        query: `WITH totais AS (\n    SELECT nome_parlamentar, sigla_partido,\n           SUM(valor_liquido) AS total_gasto\n    FROM despesas\n    WHERE valor_liquido IS NOT NULL\n    GROUP BY nome_parlamentar, sigla_partido\n),\nstats AS (\n    SELECT AVG(total_gasto) AS media, STDDEV(total_gasto) AS desvio\n    FROM totais\n),\nz_scores AS (\n    SELECT t.nome_parlamentar, t.sigla_partido, t.total_gasto,\n           s.media, s.desvio,\n           (t.total_gasto - s.media) / NULLIF(s.desvio, 0) AS z_score\n    FROM totais t CROSS JOIN stats s\n)\nSELECT nome_parlamentar, sigla_partido, total_gasto,\n       ROUND(media, 2) AS media_nacional,\n       ROUND(desvio, 2) AS desvio_padrao,\n       ROUND(z_score, 2) AS z_score,\n       CASE WHEN z_score >= 2 THEN 'Acima (>=2σ)'\n            WHEN z_score <= -2 THEN 'Abaixo (<=-2σ)' END AS posicao\nFROM z_scores\nWHERE ABS(z_score) >= 2\nORDER BY z_score DESC`,
      },
    };
  }

  getSankeyFluxosQuery(): string {
    return `-- Análise de Fluxo para Top 100 Empresas (Sankey Diagram)
-- Esta query mostra o fluxo: Partido → Categoria → Fornecedor

SELECT
    sigla_partido as partido,
    categoria_despesa as categoria,
    fornecedor as empresa,
    SUM(CAST(valor_liquido AS DOUBLE)) as valor_total,
    COUNT(*) as total_transacoes,
    ROUND(AVG(CAST(valor_liquido AS DOUBLE)), 2) as valor_medio
FROM despesas
WHERE fornecedor IN (
    -- Subquery: Top 100 fornecedores por valor recebido
    SELECT fornecedor
    FROM (
        SELECT fornecedor, SUM(CAST(valor_liquido AS DOUBLE)) as total_received
        FROM despesas
        WHERE fornecedor IS NOT NULL
        AND valor_liquido IS NOT NULL
        GROUP BY fornecedor
        ORDER BY total_received DESC
        LIMIT 100
    ) top_suppliers
)
AND sigla_partido IS NOT NULL
AND categoria_despesa IS NOT NULL
AND valor_liquido IS NOT NULL
GROUP BY sigla_partido, categoria_despesa, fornecedor
ORDER BY valor_total DESC
LIMIT 500`;
  }

  generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  getCurrentQueryId(): string | null {
    const activeButton = document.querySelector('.sample-query.selected');
    return activeButton ? activeButton.getAttribute('data-id') : null;
  }

  updateBrowserUrl(queryId: string): void {
    if (!queryId) return;

    const url = new URL(window.location.href);
    url.searchParams.set('analise', queryId);
    window.history.pushState({ queryId }, '', url);
  }

  async loadQueryFromUrl(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get('query') || urlParams.get('analise');

    if (queryId) {
      const registry = this.getQueryRegistry();
      const queryData = registry[queryId];

      if (queryData) {
        const button = document.querySelector(`[data-id="${queryId}"]`);
        if (button) {
          document.querySelectorAll('.sample-query').forEach(btn => {
            btn.classList.remove('selected');
          });

          button.classList.add('selected');
          this.loadSampleQuery(queryData.query);

          if (queryData.isVisualization) {
            await this.showSankey();
          } else {
            await this.executeSampleQuery(queryData.query);
          }
        }
      }
    }
  }

  setupEventListeners(): void {
    this.setupQueryExecution();
    this.setupPagination();
    this.setupExport();
    this.setupEditorEventListeners();
    this.setupSampleQueries();
    this.setupResizeHandle();
    this.setupSearchFunctionality();
    this.setupPanelToggles();
  }

  setupQueryExecution(): void {
    const executeBtn = DOMUtils.getElementById('run-query-btn');
    if (executeBtn) {
      DOMUtils.addEventListener(executeBtn, 'click', () => {
        this.executeCurrentQuery();
      });
    }

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.executeCurrentQuery();
      }
    });

    const clearBtn = DOMUtils.getElementById('clear-btn');
    if (clearBtn) {
      DOMUtils.addEventListener(clearBtn, 'click', () => {
        this.clearResults();
      });
    }
  }

  setupPagination(): void {
    this.paginationHandler!.setupMobileEventListeners();

    document.addEventListener('pageChanged', (event) => {
      const e = event as CustomEvent<{ results: unknown }>;
      if (e.detail && e.detail.results) {
        this.resultsDisplay!.displayResults(e.detail.results as Parameters<ResultsDisplay['displayResults']>[0]);
      }
    });

    (window as unknown as Record<string, unknown>)['paginationHandler'] = this.paginationHandler;
  }

  setupExport(): void {
    const exportBtn = DOMUtils.getElementById('export-btn');
    if (exportBtn) {
      DOMUtils.addEventListener(exportBtn, 'click', () => {
        this.exportResults();
      });
    }
  }

  setupEditorEventListeners(): void {
    this.editorManager!.setupKeyboardShortcuts();
  }

  setupSampleQueries(): void {
    const sampleButtons = document.querySelectorAll('[data-sample-query]');

    sampleButtons.forEach(button => {
      DOMUtils.addEventListener(button, 'click', () => {
        const query = button.getAttribute('data-sample-query');
        if (query) {
          this.loadSampleQuery(query);
        }
      });
    });

    this.setupPredefinedSamples();
  }

  setupPredefinedSamples(): void {
    document.querySelectorAll('.sample-query').forEach(btn => {
      DOMUtils.addEventListener(btn, 'click', async (e) => {
        const target = (e as Event).target as HTMLElement;
        const { query, id: analysisId } = target.dataset;

        if (analysisId === 'sankey-fluxos') {
          document.querySelectorAll('.sample-query').forEach(button => {
            button.classList.remove('selected');
          });

          target.classList.add('selected');
          this.updateBrowserUrl(analysisId);

          const sankeyQuery = this.getSankeyFluxosQuery();
          this.loadSampleQuery(sankeyQuery);
          await this.showSankey();
          return;
        }

        if (query) {
          document.querySelectorAll('.sample-query').forEach(button => {
            button.classList.remove('selected');
          });

          target.classList.add('selected');

          if (analysisId) {
            this.updateBrowserUrl(analysisId);
          }

          this.loadSampleQuery(query);
          await this.executeSampleQuery(query);
        }
      });
    });
  }

  setupResizeHandle(): void {
    const resizeHandle = document.getElementById('resize-handle');
    const editorContainer = document.querySelector<HTMLElement>('.editor-container');

    if (!resizeHandle || !editorContainer) return;

    let isResizing = false;
    let startY = 0;
    let startEditorHeight = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isResizing = true;
      startY = e.clientY;
      startEditorHeight = editorContainer.offsetHeight;

      resizeHandle.classList.add('active');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      e.preventDefault();

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      e.preventDefault();

      const deltaY = e.clientY - startY;
      const newHeight = Math.max(200, Math.min(600, startEditorHeight - deltaY));

      editorContainer.style.height = `${newHeight}px`;

      if (this.editorManager) {
        this.editorManager.layout();
      }
    };

    const handleMouseUp = () => {
      if (!isResizing) return;

      isResizing = false;

      resizeHandle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    resizeHandle.addEventListener('mousedown', handleMouseDown);

    resizeHandle.addEventListener('dblclick', () => {
      editorContainer.style.height = '20rem';

      if (this.editorManager) {
        this.editorManager.layout();
      }
    });
  }

  setupSearchFunctionality(): void {
    const searchInput = DOMUtils.getElementById('query-search') as HTMLInputElement | null;
    if (!searchInput) return;

    DOMUtils.addEventListener(searchInput, 'input', (e) => {
      const searchTerm = ((e as InputEvent).target as HTMLInputElement).value.toLowerCase();
      this.filterAnalysisButtons(searchTerm);
    });

    DOMUtils.addEventListener(searchInput, 'keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') {
        searchInput.value = '';
        this.filterAnalysisButtons('');
      }
    });
  }

  setupPanelToggles(): void {
    const rightPanelToggle = DOMUtils.getElementById('panel-toggle');
    const rightPanel = DOMUtils.getElementById('right-panel');
    const rightPanelContent = DOMUtils.getElementById('panel-content');
    const panelTitle = DOMUtils.getElementById('panel-title');
    const panelHeader = rightPanel?.querySelector<HTMLElement>('.p-4.border-b');

    if (rightPanelToggle && rightPanel) {
      DOMUtils.addEventListener(rightPanelToggle, 'click', () => {
        const isCollapsed = rightPanel.classList.contains('w-8');

        if (isCollapsed) {
          rightPanel.classList.remove('w-8');
          rightPanel.classList.add('w-80');
          if (rightPanelContent) rightPanelContent.classList.remove('hidden');
          if (panelTitle) panelTitle.classList.remove('hidden');
          if (panelHeader) {
            panelHeader.classList.remove('px-1', 'justify-center');
            panelHeader.classList.add('px-4');
          }
          (rightPanelToggle as HTMLElement).title = 'Recolher painel';
          const arrow = (rightPanelToggle as HTMLElement).querySelector('svg');
          if (arrow) arrow.style.transform = 'rotate(0deg)';
          const dbIcon = panelHeader?.querySelector<HTMLElement>('span:first-child');
          if (dbIcon) dbIcon.classList.remove('hidden');
        } else {
          rightPanel.classList.remove('w-80');
          rightPanel.classList.add('w-8');
          if (rightPanelContent) rightPanelContent.classList.add('hidden');
          if (panelTitle) panelTitle.classList.add('hidden');
          if (panelHeader) {
            panelHeader.classList.remove('px-4');
            panelHeader.classList.add('px-1', 'justify-center');
          }
          (rightPanelToggle as HTMLElement).title = 'Expandir painel';
          const arrow = (rightPanelToggle as HTMLElement).querySelector('svg');
          if (arrow) arrow.style.transform = 'rotate(180deg)';
          const dbIcon = panelHeader?.querySelector<HTMLElement>('span:first-child');
          if (dbIcon) dbIcon.classList.add('hidden');
        }

        this.triggerSankeyResize();
      });
    }

    const queryPanelToggle = DOMUtils.getElementById('query-panel-toggle');
    const editorContainer = document.querySelector<HTMLElement>('.editor-container');

    if (queryPanelToggle && editorContainer) {
      DOMUtils.addEventListener(queryPanelToggle, 'click', () => {
        const isCollapsed = editorContainer.classList.contains('h-10');

        if (isCollapsed) {
          editorContainer.classList.remove('h-10');
          editorContainer.classList.add('h-80');
          (queryPanelToggle as HTMLElement).title = 'Recolher painel de consulta';
          const arrow = (queryPanelToggle as HTMLElement).querySelector('svg');
          if (arrow) arrow.style.transform = 'rotate(0deg)';
          const editor = DOMUtils.getElementById('editor');
          if (editor) editor.classList.remove('hidden');
        } else {
          editorContainer.classList.remove('h-80');
          editorContainer.classList.add('h-10');
          (queryPanelToggle as HTMLElement).title = 'Expandir painel de consulta';
          const arrow = (queryPanelToggle as HTMLElement).querySelector('svg');
          if (arrow) arrow.style.transform = 'rotate(180deg)';
          const editor = DOMUtils.getElementById('editor');
          if (editor) editor.classList.add('hidden');
        }

        if (this.editorManager) {
          setTimeout(() => {
            this.editorManager!.layout();
          }, 300);
        }

        this.triggerSankeyResize();
      });
    }
  }

  triggerSankeyResize(): void {
    if (this.sankeyTab?.resizeHandler) {
      setTimeout(() => {
        this.sankeyTab!.resizeHandler!();
      }, 350);
    }
  }

  filterAnalysisButtons(searchTerm: string): void {
    const allSampleQueries = document.querySelectorAll<HTMLElement>('.sample-query');
    const allCategories = document.querySelectorAll<HTMLElement>('.category-section');

    if (!searchTerm.trim()) {
      allSampleQueries.forEach(button => {
        button.style.display = 'block';
      });
      allCategories.forEach(category => {
        category.style.display = 'block';
      });
      return;
    }

    allSampleQueries.forEach(button => {
      const buttonText = button.textContent?.toLowerCase() ?? '';
      const buttonId = button.getAttribute('data-id') || '';

      const matches = buttonText.includes(searchTerm) || buttonId.toLowerCase().includes(searchTerm);

      button.style.display = matches ? 'block' : 'none';
    });

    allCategories.forEach(category => {
      const visibleButtons = Array.from(
        category.querySelectorAll<HTMLElement>('.sample-query')
      ).some(button => !button.style.display || button.style.display === 'block');

      category.style.display = visibleButtons ? 'block' : 'none';
    });
  }

  async executeSampleQuery(query: string): Promise<void> {
    if (!this.isInitialized) return;

    try {
      if (!query || !query.trim()) {
        ErrorHandler.handleError(new Error('Sample query is empty'), 'Query Execution', 'warn');
        return;
      }

      const resultsContainer = DOMUtils.getElementById('results-container');
      const sankeyContainer = DOMUtils.getElementById('sankey-container');
      const paginationContainer = DOMUtils.getElementById('pagination-container');

      if (resultsContainer) resultsContainer.classList.remove('hidden');
      if (sankeyContainer) sankeyContainer.classList.add('hidden');
      if (paginationContainer) paginationContainer.classList.remove('hidden');

      const result = await this.queryExecutor!.executeQuery(query);

      if (result) {
        this.resultsDisplay!.displayResults(result);
      }
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Sample Query Execution');
    }
  }

  async executeCurrentQuery(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      const query = this.editorManager!.getValue();

      if (!query.trim()) {
        ErrorHandler.handleError(new Error('Query is empty'), 'Query Execution', 'warn');
        return;
      }

      const resultsContainer = DOMUtils.getElementById('results-container');
      const sankeyContainer = DOMUtils.getElementById('sankey-container');
      const paginationContainer = DOMUtils.getElementById('pagination-container');

      if (resultsContainer) resultsContainer.classList.remove('hidden');
      if (sankeyContainer) sankeyContainer.classList.add('hidden');
      if (paginationContainer) paginationContainer.classList.remove('hidden');

      const result = await this.queryExecutor!.executeQuery(query);

      if (result) {
        this.resultsDisplay!.displayResults(result);
      }
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Query Execution');
    }
  }

  clearResults(): void {
    this.resultsDisplay!.clearResults();
  }

  loadSampleQuery(query: string): void {
    if (!query) return;

    try {
      this.editorManager!.setValue(query);
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Sample Query Load');
    }
  }

  async exportResults(): Promise<void> {
    try {
      const query = this.editorManager!.getValue();

      if (!query.trim()) {
        ErrorHandler.handleError(new Error('No query to export'), 'Export', 'warn');
        return;
      }

      const exportBtn = DOMUtils.getElementById('export-btn') as HTMLButtonElement | null;

      if (exportBtn) {
        DOMUtils.updateContent(exportBtn, '⏳ Exportando...', false);
        exportBtn.disabled = true;
      }

      const currentResults = this.queryExecutor!.getCurrentResults();
      if (!currentResults) {
        ErrorHandler.handleError(new Error('No results to export'), 'Export', 'warn');
        return;
      }
      APIUtils.exportToCSV(
        { data: currentResults.data, columns: currentResults.columns ?? [] },
        'database_query_results'
      );
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Export Results');
    } finally {
      const exportBtn = DOMUtils.getElementById('export-btn') as HTMLButtonElement | null;
      if (exportBtn) {
        DOMUtils.updateContent(exportBtn, '📤 Exportar CSV', false);
        exportBtn.disabled = false;
      }
    }
  }

  showInitializationError(error: Error): void {
    const container = DOMUtils.getElementById('main-content') || document.body;

    const errorHTML = `
      <div class="flex flex-col items-center justify-center h-screen text-red-500 dark:text-red-400">
        <div class="text-6xl mb-4">⚠️</div>
        <div class="text-xl font-bold mb-2">Erro de Inicialização</div>
        <div class="text-sm opacity-75 mb-4">${error.message}</div>
        <button onclick="location.reload()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
          🔄 Tentar Novamente
        </button>
      </div>
    `;

    DOMUtils.updateContent(container, errorHTML, true);
  }

  collapseEditor(): void {
    const editorContainer = document.querySelector<HTMLElement>('.editor-container');
    const queryPanelToggle = DOMUtils.getElementById('query-panel-toggle');
    if (!editorContainer) return;
    editorContainer.classList.remove('h-80');
    editorContainer.classList.add('h-10');
    const editor = DOMUtils.getElementById('editor');
    if (editor) editor.classList.add('hidden');
    if (queryPanelToggle) {
      (queryPanelToggle as HTMLElement).title = 'Expandir painel de consulta';
      const arrow = (queryPanelToggle as HTMLElement).querySelector('svg');
      if (arrow) arrow.style.transform = 'rotate(180deg)';
    }
    this.editorManager?.layout();
  }

  async showSankey(): Promise<void> {
    try {
      const resultsContainer = DOMUtils.getElementById('results-container');
      const sankeyContainer = DOMUtils.getElementById('sankey-container');
      const paginationContainer = DOMUtils.getElementById('pagination-container');

      if (resultsContainer) resultsContainer.classList.add('hidden');
      if (paginationContainer) paginationContainer.classList.add('hidden');

      let sankeyContent = sankeyContainer;
      if (!sankeyContent) {
        sankeyContent = document.createElement('div');
        sankeyContent.id = 'sankey-container';
        sankeyContent.className = 'flex-1 min-h-0 bg-gray-900';

        const rc = DOMUtils.getElementById('results-container');
        if (rc && rc.parentNode) {
          rc.parentNode.insertBefore(sankeyContent, rc.nextSibling);
        }
      }

      sankeyContent.classList.remove('hidden');
      this.collapseEditor();

      if (this.sankeyTab) {
        await this.sankeyTab.render(sankeyContent as HTMLElement);
      } else {
        throw new Error('SankeyTab not initialized');
      }
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Sankey Display');
    }
  }

  getState(): Record<string, unknown> {
    return {
      isInitialized: this.isInitialized,
      currentQuery: this.editorManager ? this.editorManager.getValue() : '',
      schemaLoaded: this.currentSchema.length > 0,
      paginationInfo: this.paginationHandler ? this.paginationHandler.getPaginationInfo() : null,
    };
  }

  async refresh(): Promise<void> {
    try {
      await this.loadSchema();

      const currentQuery = this.editorManager!.getValue();
      if (currentQuery.trim()) {
        const result = await this.queryExecutor!.executeQuery(currentQuery);
        if (result) {
          this.resultsDisplay!.displayResults(result);
        }
      }
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Database Refresh');
    }
  }

  async shareCurrentQuery(): Promise<string | null> {
    try {
      const currentQueryId = this.getCurrentQueryId();

      if (!currentQueryId) return null;

      const registry = this.getQueryRegistry();
      const queryData = registry[currentQueryId];

      if (!queryData) return null;

      const url = new URL(window.location.href);
      url.searchParams.set('analise', currentQueryId);
      const shareUrl = url.toString();

      try {
        await navigator.clipboard.writeText(shareUrl);

        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
          const originalHTML = shareBtn.innerHTML;
          shareBtn.innerHTML = '✅ Copiado!';
          shareBtn.classList.add('bg-green-200', 'dark:bg-green-800');
          shareBtn.classList.remove('bg-blue-200', 'dark:bg-blue-800');

          setTimeout(() => {
            shareBtn.innerHTML = originalHTML;
            shareBtn.classList.remove('bg-green-200', 'dark:bg-green-800');
            shareBtn.classList.add('bg-blue-200', 'dark:bg-blue-800');
          }, 2000);
        }

        return shareUrl;
      } catch {
        const tempInput = document.createElement('input');
        tempInput.value = shareUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);

        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
          const originalHTML = shareBtn.innerHTML;
          shareBtn.innerHTML = '📋 URL Selecionado';
          setTimeout(() => {
            shareBtn.innerHTML = originalHTML;
          }, 2000);
        }

        return shareUrl;
      }
    } catch {
      const shareBtn = document.getElementById('share-btn');
      if (shareBtn) {
        const originalHTML = shareBtn.innerHTML;
        shareBtn.innerHTML = '❌ Erro';
        setTimeout(() => {
          shareBtn.innerHTML = originalHTML;
        }, 2000);
      }

      return null;
    }
  }

  dispose(): void {
    if (this.editorManager) {
      this.editorManager.dispose();
    }
    if (this.queryExecutor) {
      this.queryExecutor.dispose();
    }
    if (this.paginationHandler) {
      this.paginationHandler.reset();
    }

    const win = window as unknown as Record<string, unknown>;
    delete win['paginationHandler'];

    this.isInitialized = false;
  }
}

let dbApp: DatabaseApp | null = null;

async function waitForDependencies(): Promise<boolean> {
  let retries = 0;
  const maxRetries = 50;

  while (retries < maxRetries) {
    if (typeof window.duckdbAPI !== 'undefined') {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  return false;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await waitForDependencies();

    dbApp = new DatabaseApp();
    await dbApp.initialize();

    const win = window as unknown as Record<string, unknown>;
    win['dbApp'] = dbApp;

    win['shareCurrentQuery'] = async () => {
      return await dbApp!.shareCurrentQuery();
    };
  } catch (error) {
    ErrorHandler.handleError(error as Error, 'Database App Startup');
  }
});

window.addEventListener('beforeunload', () => {
  if (dbApp) {
    dbApp.dispose();
  }
});

export { DatabaseApp };
