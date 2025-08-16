// Database Application Main Controller - Refactored Version
import { EditorManager } from '../db/editor-manager.js';
import { QueryExecutor } from '../db/query-executor.js';
import { PaginationHandler } from '../db/pagination-handler.js';
import { ResultsDisplay } from '../db/results-display.js';
import { APIUtils } from '../shared/api-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { DOMUtils } from '../shared/dom-utils.js';
// import { APP_CONSTANTS } from './shared/constants.js';
import { SankeyTab } from '../features/visualization/sankey-tab.js';

/**
 * Main Database Application Controller
 * Orchestrates all database-related modules and functionality
 */
class DatabaseApp {
  constructor() {
    this.editorManager = null;
    this.queryExecutor = null;
    this.paginationHandler = null;
    this.resultsDisplay = null;
    this.sankeyTab = null;
    this.isInitialized = false;
    this.currentSchema = [];
  }

  /**
   * Initialize the database application
   */
  async initialize() {
    try {

      // Initialize core modules
      this.initializeModules();

      // Setup the Monaco editor
      await this.setupEditor();

      // Load initial data and schema
      await this.loadInitialData();

      // Setup event listeners
      this.setupEventListeners();

      // Mark as initialized
      this.isInitialized = true;


    } catch (error) {
      ErrorHandler.handleError(error, 'Database App Initialization');
      this.showInitializationError(error);
    }
  }

  /**
   * Initialize all module instances
   */
  initializeModules() {
    // Initialize pagination handler first
    this.paginationHandler = new PaginationHandler();

    // Initialize results display with pagination handler
    this.resultsDisplay = new ResultsDisplay(this.paginationHandler);

    // Initialize query executor with results display
    this.queryExecutor = new QueryExecutor(this.resultsDisplay);

    // Initialize editor manager
    this.editorManager = new EditorManager();

    // Initialize Sankey tab
    this.sankeyTab = new SankeyTab();

  }

  /**
   * Setup Monaco Editor
   */
  async setupEditor() {
    try {
      await this.editorManager.initializeEditor();

      // Set default query
      const defaultQuery = this.getDefaultQuery();
      this.editorManager.setValue(defaultQuery);


    } catch (error) {
      ErrorHandler.handleError(error, 'Editor Setup');
      throw error;
    }
  }

  /**
   * Load initial data and schema
   */
  async loadInitialData() {
    try {
      
      // Initialize DuckDB first
      await APIUtils.initializeDuckDB();
      
      // Load parquet data to create the despesas table
      await APIUtils.loadParquetData('./despesas.parquet');

      // Load database schema
      await this.loadSchema();

      // Load query from URL if specified, otherwise execute default query
      await this.loadQueryFromUrl();
      
      // Only execute default query if no URL query was loaded
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get('query')) {
        
        // Mark Sankey button as selected for default load
        const sankeyButton = document.querySelector('[data-id="sankey-fluxos"]');
        if (sankeyButton) {
          document.querySelectorAll('.sample-query').forEach(btn => {
            btn.classList.remove('selected');
          });
          sankeyButton.classList.add('selected');
        }
        
        await this.executeDefaultQuery();
      }


    } catch (error) {
      ErrorHandler.handleError(error, 'Initial Data Load');
      // Don't throw - allow app to continue with limited functionality
    }
  }

  /**
   * Load database schema
   */
  async loadSchema() {
    try {
      const schema = await APIUtils.executeDuckDBQuery(
        "DESCRIBE SELECT * FROM despesas LIMIT 1"
      );

      if (schema && schema.data) {
        this.currentSchema = schema.data;
        this.resultsDisplay.displaySchema(this.currentSchema);
        this.resultsDisplay.updateConnectionStatus('Conectado', false);
      }

    } catch (error) {
      ErrorHandler.handleError(error, 'Schema Load');
      this.resultsDisplay.setDisconnectedStatus();
    }
  }

  /**
   * Execute the default query
   */
  async executeDefaultQuery() {
    const defaultQuery = this.getDefaultQuery();
    
    try {
      const result = await this.queryExecutor.executeQuery(defaultQuery);
      
      if (result) {
        this.resultsDisplay.displayResults(result);
      }
    } catch (error) {
      ErrorHandler.handleError(error, 'Default Query Execution');
      this.resultsDisplay.clearResults();
    }
  }

  /**
   * Get default SQL query
   * @returns {string} Default query - now returns Sankey query as default
   */
  getDefaultQuery() {
    return this.getSankeyFluxosQuery();
  }

  /**
   * Query registry mapping IDs to query data
   * @returns {Object} Registry of all available queries
   */
  getQueryRegistry() {
    return {
      'sankey-fluxos': {
        title: 'Fluxos para top 100 Empresas',
        category: 'exemplos',
        query: this.getSankeyFluxosQuery(),
        isVisualization: true
      },
      'ver-primeiros-10-registros': {
        title: 'Ver primeiros 10 registros',
        category: 'exemplos',
        query: `SELECT *\nFROM despesas\nLIMIT 10`
      },
      'top-fornecedores-por-valor': {
        title: 'Top fornecedores por valor',
        category: 'exemplos',
        query: `SELECT fornecedor,\n    COUNT(*) AS total,\n    SUM(valor_liquido) AS value\nFROM despesas\nGROUP BY fornecedor\nORDER BY value DESC\nLIMIT 15`
      },
      'top-categorias': {
        title: 'Top categorias',
        category: 'exemplos',
        query: `SELECT categoria_despesa,\n    COUNT(*) AS count,\n    AVG(valor_liquido) AS avg\nFROM despesas\nGROUP BY categoria_despesa\nORDER BY count DESC\nLIMIT 10`
      },
      'top-deputados': {
        title: 'Top deputados',
        category: 'exemplos',
        query: `SELECT nome_parlamentar,\n    sigla_partido,\n    SUM(valor_liquido) AS total\nFROM despesas\nGROUP BY nome_parlamentar, sigla_partido\nORDER BY total DESC\nLIMIT 20`
      },
      'fornecedores-multi-deputados': {
        title: 'Fornecedores multi-deputados',
        category: 'exemplos',
        query: `SELECT fornecedor,\n    COUNT(DISTINCT nome_parlamentar) AS deputies,\n    SUM(valor_liquido) AS total\nFROM despesas\nGROUP BY fornecedor\nHAVING deputies > 5\nORDER BY total DESC\nLIMIT 15`
      },
      'tendencias-mensais-2-anos': {
        title: 'Tendências mensais (2 anos)',
        category: 'temporal',
        query: `SELECT EXTRACT(YEAR FROM data_emissao) AS ano,\n    EXTRACT(MONTH FROM data_emissao) AS mes,\n    SUM(valor_liquido) AS total,\n    COUNT(*) AS transacoes\nFROM despesas\nWHERE data_emissao IS NOT NULL\nGROUP BY ano, mes\nORDER BY ano DESC, mes DESC\nLIMIT 24`
      },
      'padrao-por-dia-da-semana': {
        title: 'Padrão por dia da semana',
        category: 'temporal',
        query: `SELECT \n    CASE EXTRACT(DOW FROM data_emissao) \n        WHEN 0 THEN 'Domingo' \n        WHEN 1 THEN 'Segunda' \n        WHEN 2 THEN 'Terça' \n        WHEN 3 THEN 'Quarta' \n        WHEN 4 THEN 'Quinta' \n        WHEN 5 THEN 'Sexta' \n        WHEN 6 THEN 'Sábado' \n    END AS dia_semana,\n    COUNT(*) AS total_despesas,\n    SUM(valor_liquido) AS valor_total,\n    AVG(valor_liquido) AS valor_medio\nFROM despesas \nWHERE data_emissao IS NOT NULL \nGROUP BY EXTRACT(DOW FROM data_emissao) \nORDER BY EXTRACT(DOW FROM data_emissao)`
      },
      'comparacao-ano-a-ano': {
        title: 'Comparação ano a ano',
        category: 'temporal',
        query: `SELECT \n    EXTRACT(YEAR FROM data_emissao) AS ano,\n    SUM(valor_liquido) AS total_ano,\n    COUNT(*) AS transacoes\nFROM despesas \nWHERE data_emissao IS NOT NULL \nGROUP BY ano \nORDER BY ano DESC`
      },
      'top-transacoes-mais-caras': {
        title: 'Top transações mais caras',
        category: 'category',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    valor_liquido,\n    fornecedor,\n    data_emissao\nFROM despesas \nORDER BY valor_liquido DESC \nLIMIT 20`
      },
      'categorias-e-subcategorias': {
        title: 'Categorias e subcategorias',
        category: 'category',
        query: `SELECT \n    categoria_despesa,\n    subcategoria_despesa,\n    COUNT(*) AS total_transacoes,\n    SUM(valor_liquido) AS total_valor,\n    AVG(valor_liquido) AS valor_medio\nFROM despesas \nGROUP BY categoria_despesa, subcategoria_despesa \nORDER BY total_valor DESC \nLIMIT 30`
      },
      'estatisticas-por-categoria': {
        title: 'Estatísticas por categoria',
        category: 'category',
        query: `SELECT \n    categoria_despesa,\n    MAX(valor_liquido) AS maior_valor,\n    AVG(valor_liquido) AS valor_medio,\n    MIN(valor_liquido) AS menor_valor,\n    COUNT(*) AS total\nFROM despesas \nGROUP BY categoria_despesa \nORDER BY maior_valor DESC`
      },
      'gastos-relacionados-a-viagens': {
        title: 'Gastos relacionados a viagens',
        category: 'travel',
        query: `SELECT \n    categoria_despesa,\n    COUNT(*) AS total,\n    SUM(valor_liquido) AS valor\nFROM despesas \nWHERE categoria_despesa ILIKE '%PASSAGEM%' \n   OR categoria_despesa ILIKE '%VEÍCULOS%' \n   OR categoria_despesa ILIKE '%COMBUSTÍVEIS%' \n   OR categoria_despesa ILIKE '%HOSPEDAGEM%' \n   OR categoria_despesa ILIKE '%LOCAÇÃO%' \n   OR categoria_despesa ILIKE '%TÁXI%' \nGROUP BY categoria_despesa \nORDER BY valor DESC`
      },
      'despesas-por-ano-de-competencia': {
        title: 'Despesas por ano de competência',
        category: 'travel',
        query: `SELECT \n    ano_competencia,\n    COUNT(*) AS total_despesas,\n    SUM(valor_liquido) AS valor_total,\n    AVG(valor_liquido) AS valor_medio\nFROM despesas \nWHERE ano_competencia IS NOT NULL \nGROUP BY ano_competencia \nORDER BY ano_competencia DESC`
      },
      'top-gastos-por-deputado': {
        title: 'Top gastos por deputado',
        category: 'travel',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    SUM(valor_liquido) AS total_gastos,\n    COUNT(*) AS num_despesas\nFROM despesas \nGROUP BY nome_parlamentar, sigla_partido \nORDER BY total_gastos DESC \nLIMIT 25`
      },
      'top-fornecedores-por-receita': {
        title: 'Top fornecedores por receita',
        category: 'vendor',
        query: `SELECT \n    fornecedor,\n    SUM(valor_liquido) AS receita_total,\n    COUNT(*) AS total_transacoes,\n    COUNT(DISTINCT nome_parlamentar) AS deputados_atendidos,\n    AVG(valor_liquido) AS valor_medio\nFROM despesas \nGROUP BY fornecedor \nORDER BY receita_total DESC \nLIMIT 20`
      },
      'concentracao-do-mercado': {
        title: 'Concentração do mercado (%)',
        category: 'vendor',
        query: `WITH market_share AS (\n    SELECT \n        fornecedor,\n        SUM(valor_liquido) AS receita,\n        (SUM(valor_liquido) * 100.0 / (\n            SELECT SUM(valor_liquido) FROM despesas\n        )) AS participacao\n    FROM despesas \n    GROUP BY fornecedor \n    ORDER BY receita DESC\n)\nSELECT \n    fornecedor,\n    receita,\n    ROUND(participacao, 2) AS participacao_pct\nFROM market_share \nLIMIT 15`
      },
      'relacionamentos-de-alto-valor': {
        title: 'Relacionamentos de alto valor',
        category: 'vendor',
        query: `SELECT \n    fornecedor,\n    nome_parlamentar,\n    sigla_partido,\n    SUM(valor_liquido) AS total_gasto,\n    COUNT(*) AS transacoes\nFROM despesas \nGROUP BY fornecedor, nome_parlamentar, sigla_partido \nHAVING SUM(valor_liquido) > 50000 \nORDER BY total_gasto DESC \nLIMIT 30`
      },
      'principal-fornecedor-por-categoria': {
        title: 'Principal fornecedor por categoria',
        category: 'vendor',
        query: `WITH fornecedor_categoria AS (\n    SELECT \n        categoria_despesa,\n        fornecedor,\n        COUNT(*) AS num_transacoes,\n        SUM(valor_liquido) AS gasto_total,\n        ROW_NUMBER() OVER (\n            PARTITION BY categoria_despesa \n            ORDER BY COUNT(*) DESC, SUM(valor_liquido) DESC\n        ) AS rank_transacoes\n    FROM despesas \n    GROUP BY categoria_despesa, fornecedor\n)\nSELECT \n    categoria_despesa,\n    fornecedor AS principal_fornecedor,\n    num_transacoes,\n    gasto_total\nFROM fornecedor_categoria \nWHERE rank_transacoes = 1 \nORDER BY num_transacoes DESC`
      },
      'ranking-de-gastos-por-deputado': {
        title: 'Ranking de gastos por deputado',
        category: 'parliamentary',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    SUM(valor_liquido) AS total_gasto,\n    COUNT(*) AS num_transacoes,\n    AVG(valor_liquido) AS gasto_medio\nFROM despesas \nGROUP BY nome_parlamentar, sigla_partido \nORDER BY total_gasto DESC \nLIMIT 20`
      },
      'deputados-mais-menos-ativos': {
        title: 'Deputados mais/menos ativos',
        category: 'parliamentary',
        query: `WITH activity_stats AS (\n    SELECT \n        nome_parlamentar,\n        sigla_partido,\n        COUNT(*) AS num_transacoes,\n        SUM(valor_liquido) AS total_gasto\n    FROM despesas \n    GROUP BY nome_parlamentar, sigla_partido\n),\ntop_active AS (\n    SELECT \n        'Mais ativos' AS tipo,\n        nome_parlamentar,\n        sigla_partido,\n        num_transacoes,\n        total_gasto\n    FROM activity_stats \n    ORDER BY num_transacoes DESC \n    LIMIT 10\n),\nleast_active AS (\n    SELECT \n        'Menos ativos' AS tipo,\n        nome_parlamentar,\n        sigla_partido,\n        num_transacoes,\n        total_gasto\n    FROM activity_stats \n    ORDER BY num_transacoes ASC \n    LIMIT 10\n)\nSELECT * \nFROM (\n    SELECT * FROM top_active \n    UNION ALL \n    SELECT * FROM least_active\n) \nORDER BY \n    CASE WHEN tipo = 'Mais ativos' THEN 1 ELSE 2 END,\n    num_transacoes DESC`
      },
      'possiveis-despesas-duplicadas': {
        title: 'Possíveis despesas duplicadas',
        category: 'audit',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    fornecedor,\n    valor_liquido,\n    data_emissao,\n    COUNT(*) AS duplicatas\nFROM despesas \nGROUP BY \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    fornecedor,\n    valor_liquido,\n    data_emissao \nHAVING COUNT(*) > 1 \nORDER BY duplicatas DESC, valor_liquido DESC \nLIMIT 20`
      },
      'valores-redondos-suspeitos': {
        title: 'Valores redondos suspeitos',
        category: 'audit',
        query: `SELECT \n    valor_liquido,\n    COUNT(*) AS frequencia\nFROM despesas \nWHERE valor_liquido % 100 = 0 \n  AND valor_liquido >= 1000 \nGROUP BY valor_liquido \nORDER BY frequencia DESC \nLIMIT 20`
      },
      'gastos-altos-em-fins-de-semana': {
        title: 'Gastos altos em fins de semana',
        category: 'audit',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    valor_liquido,\n    fornecedor,\n    data_emissao\nFROM despesas \nWHERE EXTRACT(DOW FROM data_emissao) IN (0, 6) \n  AND valor_liquido > 5000 \nORDER BY valor_liquido DESC \nLIMIT 25`
      },
      'outliers-estatisticos': {
        title: 'Outliers estatísticos (Z > 3)',
        category: 'audit',
        query: `WITH outliers AS (\n    SELECT *,\n        (valor_liquido - AVG(valor_liquido) OVER (\n            PARTITION BY categoria_despesa\n        )) / STDDEV(valor_liquido) OVER (\n            PARTITION BY categoria_despesa\n        ) AS z_score\n    FROM despesas \n    WHERE valor_liquido IS NOT NULL\n)\nSELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    valor_liquido,\n    fornecedor,\n    ROUND(z_score, 2) AS desvio_padrao\nFROM outliers \nWHERE ABS(z_score) > 3 \nORDER BY ABS(z_score) DESC \nLIMIT 30`
      },
      'valores-altos-duplicados': {
        title: 'Valores altos duplicados',
        category: 'audit',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    valor_liquido,\n    fornecedor,\n    COUNT(*) AS frequencia\nFROM despesas \nWHERE valor_liquido > 50000 \nGROUP BY \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    valor_liquido,\n    fornecedor \nHAVING COUNT(*) > 1 \nORDER BY valor_liquido DESC \nLIMIT 20`
      }
    };
  }

  /**
   * Get Sankey Fluxos SQL query
   * @returns {string} Sankey query for top suppliers flow analysis
   */
  getSankeyFluxosQuery() {
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

  /**
   * Generate URL-friendly slug from query ID or title
   * @param {string} text - Text to convert to slug
   * @returns {string} URL-friendly slug
   */
  generateSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters except words, spaces, and hyphens
      .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading and trailing hyphens
  }

  /**
   * Get current active query ID from DOM
   * @returns {string|null} Currently active query ID
   */
  getCurrentQueryId() {
    const activeButton = document.querySelector('.sample-query.selected');
    return activeButton ? activeButton.getAttribute('data-id') : null;
  }

  /**
   * Update browser URL without page reload
   * @param {string} queryId - Query ID to add to URL
   */
  updateBrowserUrl(queryId) {
    if (!queryId) return;
    
    const url = new URL(window.location);
    url.searchParams.set('query', queryId);
    window.history.pushState({ queryId }, '', url);
  }

  /**
   * Load query from URL parameter
   * @returns {Promise<void>}
   */
  async loadQueryFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get('query');
    
    if (queryId) {
      const registry = this.getQueryRegistry();
      const queryData = registry[queryId];
      
      if (queryData) {
        // Find and activate the corresponding button
        const button = document.querySelector(`[data-id="${queryId}"]`);
        if (button) {
          // Remove selected class from all buttons
          document.querySelectorAll('.sample-query').forEach(btn => {
            btn.classList.remove('selected');
          });
          
          // Add selected class to the URL query button
          button.classList.add('selected');
          
          // Load the query into editor
          this.loadSampleQuery(queryData.query);
          
          // Execute the query
          if (queryData.isVisualization) {
            await this.showSankey();
          } else {
            await this.executeSampleQuery(queryData.query);
          }
          
          
        }
      }
      
    }
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    this.setupQueryExecution();
    this.setupPagination();
    this.setupExport();
    this.setupEditorEventListeners();
    this.setupSampleQueries();
    this.setupResizeHandle();

  }

  /**
   * Setup query execution event listeners
   */
  setupQueryExecution() {
    // Execute button
    const executeBtn = DOMUtils.getElementById('run-query-btn');
    if (executeBtn) {
      DOMUtils.addEventListener(executeBtn, 'click', () => {
        this.executeCurrentQuery();
      });
    }

    // Keyboard shortcut (Ctrl+Enter or Cmd+Enter)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.executeCurrentQuery();
      }
    });

    // Clear button
    const clearBtn = DOMUtils.getElementById('clear-btn');
    if (clearBtn) {
      DOMUtils.addEventListener(clearBtn, 'click', () => {
        this.clearResults();
      });
    }
  }

  /**
   * Setup pagination event listeners
   */
  setupPagination() {
    // Setup mobile pagination buttons
    this.paginationHandler.setupMobileEventListeners();

    // Listen for page change events
    document.addEventListener('pageChanged', (event) => {
      if (event.detail && event.detail.results) {
        this.resultsDisplay.displayResults(event.detail.results);
      }
    });

    // Make pagination handler globally available for inline onclick handlers
    window.paginationHandler = this.paginationHandler;
  }

  /**
   * Setup export functionality
   */
  setupExport() {
    const exportBtn = DOMUtils.getElementById('export-btn');
    if (exportBtn) {
      DOMUtils.addEventListener(exportBtn, 'click', () => {
        this.exportResults();
      });
    }
  }

  /**
   * Setup editor-specific event listeners
   */
  setupEditorEventListeners() {
    // Format button - not present in current HTML
    // const formatBtn = DOMUtils.getElementById('format-btn');
    // if (formatBtn) {
    //   DOMUtils.addEventListener(formatBtn, 'click', () => {
    //     this.editorManager.formatSQL();
    //   });
    // }

    // Editor keyboard shortcuts
    this.editorManager.setupKeyboardShortcuts(() => {
      this.executeCurrentQuery();
    });
  }

  /**
   * Setup sample query buttons
   */
  setupSampleQueries() {
    // Find all sample query buttons
    const sampleButtons = document.querySelectorAll('[data-sample-query]');
    
    sampleButtons.forEach(button => {
      DOMUtils.addEventListener(button, 'click', () => {
        const query = button.getAttribute('data-sample-query');
        if (query) {
          this.loadSampleQuery(query);
        }
      });
    });

    // Setup predefined sample queries if buttons exist
    this.setupPredefinedSamples();
  }

  /**
   * Setup predefined sample query buttons
   */
  setupPredefinedSamples() {
    document.querySelectorAll('.sample-query').forEach(btn => {
      DOMUtils.addEventListener(btn, 'click', async (e) => {
        const {query} = e.target.dataset;
        const analysisId = e.target.dataset.id;
        
        // Handle Sankey Fluxos button specially
        if (analysisId === 'sankey-fluxos') {
          // Remove selected class from all query buttons
          document.querySelectorAll('.sample-query').forEach(button => {
            button.classList.remove('selected');
          });
          
          // Add selected class to clicked button
          e.target.classList.add('selected');
          
          // Update browser URL
          this.updateBrowserUrl(analysisId);
          
          // Show the Sankey SQL queries in the editor AND render the diagram
          const sankeyQuery = this.getSankeyFluxosQuery();
          this.loadSampleQuery(sankeyQuery);
          await this.showSankey();
          return;
        }
        
        if (query) {
          
          // Remove selected class from all query buttons
          document.querySelectorAll('.sample-query').forEach(button => {
            button.classList.remove('selected');
          });
          
          // Add selected class to clicked button
          e.target.classList.add('selected');
          
          // Update browser URL
          if (analysisId) {
            this.updateBrowserUrl(analysisId);
          }
          
          // Load the query into editor
          this.loadSampleQuery(query);
          
          // Execute the query directly (don't rely on editor value)
          await this.executeSampleQuery(query);
        }
      });
    });
  }

  /**
   * Setup resize handle for editor panels
   */
  setupResizeHandle() {
    const resizeHandle = document.getElementById('resize-handle');
    const editorContainer = document.querySelector('.editor-container');
    
    if (!resizeHandle || !editorContainer) {
      return;
    }

    let isResizing = false;
    let startY = 0;
    let startEditorHeight = 0;

    const handleMouseDown = (e) => {
      isResizing = true;
      startY = e.clientY;
      startEditorHeight = editorContainer.offsetHeight;
      
      // Add visual feedback
      resizeHandle.classList.add('active');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      
      // Prevent text selection during resize
      e.preventDefault();
      
      // Add event listeners
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
    };

    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      e.preventDefault();
      
      const deltaY = e.clientY - startY;
      // Invert the delta: dragging up (negative deltaY) should increase height
      const newHeight = Math.max(200, Math.min(600, startEditorHeight - deltaY));
      
      // Update editor container height
      editorContainer.style.height = `${newHeight}px`;
      
      // Trigger Monaco editor resize if available
      if (this.editorManager && this.editorManager.editor) {
        this.editorManager.editor.layout();
      }
    };

    const handleMouseUp = () => {
      if (!isResizing) return;
      
      isResizing = false;
      
      // Remove visual feedback
      resizeHandle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Remove event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
    };

    // Add mousedown event listener
    resizeHandle.addEventListener('mousedown', handleMouseDown);

    // Double click to reset to default height
    resizeHandle.addEventListener('dblclick', () => {
      editorContainer.style.height = '20rem'; // 320px default (h-80)
      
      if (this.editorManager && this.editorManager.editor) {
        this.editorManager.editor.layout();
      }
      
    });

  }

  /**
   * Execute a sample query directly
   * @param {string} query - The SQL query to execute
   */
  async executeSampleQuery(query) {
    if (!this.isInitialized) {
      return;
    }

    try {
      if (!query || !query.trim()) {
        ErrorHandler.handleError('Sample query is empty', 'Query Execution', 'warn');
        return;
      }

      // Show results container and hide Sankey if it's visible
      const resultsContainer = DOMUtils.getElementById('results-container');
      const sankeyContainer = DOMUtils.getElementById('sankey-container');
      const paginationContainer = DOMUtils.getElementById('pagination-container');
      
      if (resultsContainer) resultsContainer.classList.remove('hidden');
      if (sankeyContainer) sankeyContainer.classList.add('hidden');
      if (paginationContainer) paginationContainer.classList.remove('hidden');

      const result = await this.queryExecutor.executeQuery(query);
      
      if (result) {
        this.resultsDisplay.displayResults(result);
      }

    } catch (error) {
      ErrorHandler.handleError(error, 'Sample Query Execution');
    }
  }

  /**
   * Execute the current query in the editor
   */
  async executeCurrentQuery() {
    if (!this.isInitialized) {
      return;
    }

    try {
      const query = this.editorManager.getValue();
      
      if (!query.trim()) {
        ErrorHandler.handleError('Query is empty', 'Query Execution', 'warn');
        return;
      }

      // Show results container and hide Sankey if it's visible
      const resultsContainer = DOMUtils.getElementById('results-container');
      const sankeyContainer = DOMUtils.getElementById('sankey-container');
      const paginationContainer = DOMUtils.getElementById('pagination-container');
      
      if (resultsContainer) resultsContainer.classList.remove('hidden');
      if (sankeyContainer) sankeyContainer.classList.add('hidden');
      if (paginationContainer) paginationContainer.classList.remove('hidden');

      const result = await this.queryExecutor.executeQuery(query);
      
      if (result) {
        this.resultsDisplay.displayResults(result);
      }

    } catch (error) {
      ErrorHandler.handleError(error, 'Query Execution');
    }
  }

  /**
   * Clear results and reset UI
   */
  clearResults() {
    this.resultsDisplay.clearResults();
  }

  /**
   * Load a sample query into the editor
   * @param {string} query - SQL query to load
   */
  loadSampleQuery(query) {
    if (!query) return;

    try {
      this.editorManager.setValue(query);

    } catch (error) {
      ErrorHandler.handleError(error, 'Sample Query Load');
    }
  }

  /**
   * Export current results
   */
  async exportResults() {
    try {
      const query = this.editorManager.getValue();
      
      if (!query.trim()) {
        ErrorHandler.handleError('No query to export', 'Export', 'warn');
        return;
      }

      // Show loading state
      const exportBtn = DOMUtils.getElementById('export-btn');
      // const originalText = exportBtn ? exportBtn.textContent : '';
      
      if (exportBtn) {
        DOMUtils.updateContent(exportBtn, '⏳ Exportando...', false);
        exportBtn.disabled = true;
      }

      // Execute query and export
      await APIUtils.exportToCSV(query, 'database_query_results');


    } catch (error) {
      ErrorHandler.handleError(error, 'Export Results');
    } finally {
      // Reset button state
      const exportBtn = DOMUtils.getElementById('export-btn');
      if (exportBtn) {
        DOMUtils.updateContent(exportBtn, '📤 Exportar CSV', false);
        exportBtn.disabled = false;
      }
    }
  }

  /**
   * Show initialization error
   * @param {Error} error - Initialization error
   */
  showInitializationError(error) {
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

  /**
   * Show Sankey diagram view
   */
  async showSankey() {
    try {
      const resultsContainer = DOMUtils.getElementById('results-container');
      const sankeyContainer = DOMUtils.getElementById('sankey-container');
      const paginationContainer = DOMUtils.getElementById('pagination-container');
      
      // Hide other containers and show Sankey
      if (resultsContainer) resultsContainer.classList.add('hidden');
      if (paginationContainer) paginationContainer.classList.add('hidden');
      
      // Create or get the Sankey container
      let sankeyContent = sankeyContainer;
      if (!sankeyContent) {
        sankeyContent = document.createElement('div');
        sankeyContent.id = 'sankey-container';
        sankeyContent.className = 'flex-1 min-h-0 bg-gray-900';
        
        // Insert after results container
        const resultsContainer = DOMUtils.getElementById('results-container');
        if (resultsContainer && resultsContainer.parentNode) {
          resultsContainer.parentNode.insertBefore(sankeyContent, resultsContainer.nextSibling);
        }
      }
      
      sankeyContent.classList.remove('hidden');
      
      // Render the Sankey diagram
      if (this.sankeyTab) {
        await this.sankeyTab.render(sankeyContent);
      } else {
        throw new Error('SankeyTab not initialized');
      }
      
    } catch (error) {
      ErrorHandler.handleError(error, 'Sankey Display');
    }
  }

  /**
   * Get current application state
   * @returns {Object} Current state information
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      currentQuery: this.editorManager ? this.editorManager.getValue() : '',
      schemaLoaded: this.currentSchema.length > 0,
      paginationInfo: this.paginationHandler ? this.paginationHandler.getPaginationInfo() : null
    };
  }

  /**
   * Refresh the database connection and schema
   */
  async refresh() {
    try {
      
      await this.loadSchema();
      
      // Re-execute current query if exists
      const currentQuery = this.editorManager.getValue();
      if (currentQuery.trim()) {
        const result = await this.queryExecutor.executeQuery(currentQuery);
        if (result) {
          this.resultsDisplay.displayResults(result);
        }
      }
      

    } catch (error) {
      ErrorHandler.handleError(error, 'Database Refresh');
    }
  }

  /**
   * Share current query - creates shareable URL and copies to clipboard
   * @returns {Promise<string|null>} Shareable URL or null if no active query
   */
  async shareCurrentQuery() {
    try {
      const currentQueryId = this.getCurrentQueryId();
      
      if (!currentQueryId) {
        return null;
      }

      const registry = this.getQueryRegistry();
      const queryData = registry[currentQueryId];
      
      if (!queryData) {
        return null;
      }

      // Create shareable URL
      const url = new URL(window.location);
      url.searchParams.set('query', currentQueryId);
      const shareUrl = url.toString();

      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        
        // Show success feedback
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
          const originalText = shareBtn.innerHTML;
          shareBtn.innerHTML = '✅ Copiado!';
          shareBtn.classList.add('bg-green-200', 'dark:bg-green-800');
          shareBtn.classList.remove('bg-blue-200', 'dark:bg-blue-800');
          
          setTimeout(() => {
            shareBtn.innerHTML = originalText;
            shareBtn.classList.remove('bg-green-200', 'dark:bg-green-800');
            shareBtn.classList.add('bg-blue-200', 'dark:bg-blue-800');
          }, 2000);
        }
        
        return shareUrl;
        
      } catch (clipboardError) {
        
        // Fallback: create temporary input and select text
        const tempInput = document.createElement('input');
        tempInput.value = shareUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        
        // Show feedback
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
          const originalText = shareBtn.innerHTML;
          shareBtn.innerHTML = '📋 URL Selecionado';
          setTimeout(() => {
            shareBtn.innerHTML = originalText;
          }, 2000);
        }
        
        return shareUrl;
      }

    } catch (error) {
      
      // Show error feedback
      const shareBtn = document.getElementById('share-btn');
      if (shareBtn) {
        const originalText = shareBtn.innerHTML;
        shareBtn.innerHTML = '❌ Erro';
        setTimeout(() => {
          shareBtn.innerHTML = originalText;
        }, 2000);
      }
      
      return null;
    }
  }

  /**
   * Dispose of the application and cleanup resources
   */
  dispose() {
    
    // Dispose of modules
    if (this.editorManager) {
      this.editorManager.dispose();
    }
    if (this.queryExecutor) {
      this.queryExecutor.dispose();
    }
    if (this.paginationHandler) {
      this.paginationHandler.reset();
    }

    // Clear global references
    if (window.paginationHandler) {
      delete window.paginationHandler;
    }

    this.isInitialized = false;
  }
}

// Initialize the application when DOM is ready
let dbApp = null;

// Wait for required dependencies to be available
async function waitForDependencies() {
  let retries = 0;
  const maxRetries = 50; // 5 seconds max wait
  
  while (retries < maxRetries) {
    if (typeof window.monaco !== 'undefined' && typeof window.duckdbAPI !== 'undefined') {
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
    
    // Make app globally available for debugging
    window.dbApp = dbApp;
    
    // Make shareCurrentQuery globally available for onclick handler
    window.shareCurrentQuery = async () => {
      return await dbApp.shareCurrentQuery();
    };
    
  } catch (error) {
    ErrorHandler.handleError(error, 'Database App Startup');
  }
});

// Global function for category toggle (used by inline onclick handlers in db.html)
window.toggleCategory = function(categoryId) {
  const categorySection = document.querySelector(`[data-category="${categoryId}"]`);
  if (!categorySection) return;
  
  const content = categorySection.querySelector('.category-content');
  const chevron = categorySection.querySelector('.category-chevron');
  
  if (!content || !chevron) return;
  
  if (content.style.display === 'none' || content.style.display === '') {
    content.style.display = 'block';
    chevron.style.transform = 'rotate(0deg)';
  } else {
    content.style.display = 'none';
    chevron.style.transform = 'rotate(-90deg)';
  }
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (dbApp) {
    dbApp.dispose();
  }
});

// Export for potential external use
export { DatabaseApp };