// Database Application Main Controller - Refactored Version
import { EditorManager } from '../db/editor-manager.js';
import { QueryExecutor } from '../db/query-executor.js';
import { PaginationHandler } from '../db/pagination-handler.js';
import { ResultsDisplay } from '../db/results-display.js';
import { APIUtils } from '../shared/api-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { DOMUtils } from '../shared/dom-utils.js';
import { UIComponents } from '../shared/ui-utils.js';
import { SankeyTab } from '../features/visualization/sankey-tab.js';
import { getGlobalDatabaseService } from '../services/database-service.js';

/**
 * Main Database Application Controller
 * Orchestrates all database-related modules and functionality
 */
class DatabaseApp {
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

      // Setup category toggles
      UIComponents.setupCategoryToggles();

      // Register service worker for PWA functionality
      UIComponents.registerServiceWorker('/sw.js', false);

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
      
      // Initialize unified database service
      await this.databaseService.initialize();
      
      // Load parquet data to create the despesas table
      await this.databaseService.loadData();

      // Load database schema
      await this.loadSchema();

      // Load query from URL if specified, otherwise execute default query
      await this.loadQueryFromUrl();
      
      // Only execute default query if no URL query was loaded
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.get('query') && !urlParams.get('analise')) {
        
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
      const schema = await this.databaseService.getSchema();

      if (schema && schema.length > 0) {
        this.currentSchema = schema;
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
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    valor_liquido,\n    fornecedor,\n    strftime(data_emissao, '%d/%m/%Y') as data_emissao\nFROM despesas \nORDER BY valor_liquido DESC \nLIMIT 20`
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
      'gasto-hospedagem-por-partido': {
        title: 'Gasto mínimo, médio e máximo em hospedagem por partido',
        category: 'travel',
        query: `SELECT \n    sigla_partido,\n    MIN(valor_liquido) AS gasto_minimo,\n    AVG(valor_liquido) AS gasto_medio,\n    MAX(valor_liquido) AS gasto_maximo,\n    COUNT(*) AS total_despesas,\n    SUM(valor_liquido) AS valor_total\nFROM despesas \nWHERE categoria_despesa ILIKE '%HOSPEDAGEM%'\nGROUP BY sigla_partido \nORDER BY gasto_medio DESC`
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
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    fornecedor,\n    valor_liquido,\n    strftime(data_emissao, '%d/%m/%Y') as data_emissao,\n    COUNT(*) AS duplicatas\nFROM despesas \nGROUP BY \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    fornecedor,\n    valor_liquido,\n    data_emissao \nHAVING COUNT(*) > 1 \nORDER BY duplicatas DESC, valor_liquido DESC \nLIMIT 20`
      },
      'valores-redondos-suspeitos': {
        title: 'Valores redondos suspeitos',
        category: 'audit',
        query: `SELECT \n    valor_liquido,\n    COUNT(*) AS frequencia\nFROM despesas \nWHERE valor_liquido % 100 = 0 \n  AND valor_liquido >= 1000 \nGROUP BY valor_liquido \nORDER BY frequencia DESC \nLIMIT 20`
      },
      'gastos-altos-em-fins-de-semana': {
        title: 'Gastos altos em fins de semana',
        category: 'audit',
        query: `SELECT \n    nome_parlamentar,\n    sigla_partido,\n    categoria_despesa,\n    valor_liquido,\n    fornecedor,\n    strftime(data_emissao, '%d/%m/%Y') as data_emissao\nFROM despesas \nWHERE EXTRACT(DOW FROM data_emissao) IN (0, 6) \n  AND valor_liquido > 5000 \nORDER BY valor_liquido DESC \nLIMIT 25`
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
      },
      'padroes-restituicao': {
        title: 'Padrões de Restituição',
        category: 'risk',
        query: `-- Análise de Padrões de Restituição\n-- Detecta restituições/retidos acima do normal que podem indicar inflação ou erro sistemático\n\nWITH monthly_stats AS (\n    SELECT \n        nome_parlamentar as deputado,\n        fornecedor,\n        categoria_despesa,\n        date_part('year', data_emissao) * 100 + date_part('month', data_emissao) AS ano_mes,\n        COUNT(*) AS total_transacoes,\n        SUM(valor_liquido) AS valor_total,\n        AVG(valor_liquido) AS valor_medio\n    FROM despesas \n    WHERE data_emissao IS NOT NULL \n    AND valor_liquido IS NOT NULL\n    GROUP BY nome_parlamentar, fornecedor, categoria_despesa, ano_mes\n),\npercentiles AS (\n    SELECT \n        categoria_despesa,\n        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY valor_medio) AS p90_valor_medio\n    FROM monthly_stats \n    GROUP BY categoria_despesa\n)\nSELECT \n    ms.deputado,\n    ms.fornecedor,\n    ms.categoria_despesa,\n    ms.ano_mes,\n    ms.total_transacoes,\n    ms.valor_total,\n    ms.valor_medio,\n    p.p90_valor_medio,\n    CASE WHEN ms.valor_medio > p.p90_valor_medio THEN 1 ELSE 0 END AS flag_valor_alto\nFROM monthly_stats ms\nJOIN percentiles p ON ms.categoria_despesa = p.categoria_despesa\nWHERE ms.valor_medio > p.p90_valor_medio\nORDER BY ms.valor_medio DESC\nLIMIT 50`
      },
      'parcelamento-artificial': {
        title: 'Parcelamento Artificial',
        category: 'risk',
        query: `-- Análise de Parcelamento Artificial\n-- Identifica notas fracionadas em muitas parcelas para disfarçar grandes despesas\n\nWITH fornecedor_mensal AS (\n    SELECT \n        nome_parlamentar as deputado,\n        fornecedor,\n        date_part('year', data_emissao) * 100 + date_part('month', data_emissao) AS ano_mes,\n        COUNT(*) AS num_transacoes,\n        SUM(valor_liquido) AS valor_total,\n        AVG(valor_liquido) AS valor_medio,\n        STDDEV(valor_liquido) AS desvio_padrao,\n        MIN(data_emissao) AS primeira_data,\n        MAX(data_emissao) AS ultima_data\n    FROM despesas \n    WHERE data_emissao IS NOT NULL \n    AND valor_liquido IS NOT NULL\n    GROUP BY nome_parlamentar, fornecedor, ano_mes\n),\nsuspeitos AS (\n    SELECT *,\n        CASE WHEN desvio_padrao > 0 THEN desvio_padrao / NULLIF(valor_medio, 0) ELSE 0 END AS coef_variacao,\n        date_diff('day', primeira_data, ultima_data) AS span_dias,\n        DENSE_RANK() OVER (ORDER BY deputado, fornecedor, ano_mes) AS serie_id\n    FROM fornecedor_mensal\n    WHERE num_transacoes >= 3\n)\nSELECT \n    deputado,\n    fornecedor,\n    ano_mes,\n    serie_id,\n    num_transacoes,\n    valor_total,\n    valor_medio,\n    ROUND(coef_variacao, 3) AS variacao_relativa,\n    span_dias,\n    CASE WHEN num_transacoes >= 3 AND coef_variacao <= 0.1 THEN 1 ELSE 0 END AS flag_parcelamento\nFROM suspeitos\nWHERE num_transacoes >= 3 AND coef_variacao <= 0.1\nORDER BY valor_total DESC\nLIMIT 50`
      },
      'one-hit-wonder': {
        title: 'One-Hit Wonder',
        category: 'risk',
        query: `-- Análise One-Hit Wonder\n-- Localiza fornecedores que aparecem só uma vez ou em um único mês com valor alto\n\nWITH fornecedor_stats AS (\n    SELECT \n        fornecedor,\n        COUNT(*) AS total_transacoes,\n        COUNT(DISTINCT date_part('year', data_emissao) * 100 + date_part('month', data_emissao)) AS meses_distintos,\n        SUM(valor_liquido) AS valor_total,\n        MAX(valor_liquido) AS valor_maximo,\n        categoria_despesa\n    FROM despesas \n    WHERE data_emissao IS NOT NULL \n    AND valor_liquido IS NOT NULL\n    AND fornecedor IS NOT NULL\n    GROUP BY fornecedor, categoria_despesa\n),\ncategoria_percentiles AS (\n    SELECT \n        categoria_despesa,\n        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY valor_maximo) AS p90_categoria\n    FROM fornecedor_stats \n    GROUP BY categoria_despesa\n),\none_hit_candidates AS (\n    SELECT \n        fs.*,\n        cp.p90_categoria,\n        CASE \n            WHEN fs.total_transacoes = 1 THEN 'strict'\n            WHEN fs.meses_distintos = 1 AND fs.total_transacoes <= 2 THEN 'temporal'\n            ELSE 'normal'\n        END AS tipo_one_hit,\n        CASE WHEN fs.valor_maximo >= cp.p90_categoria THEN 1 ELSE 0 END AS flag_valor_suspeito\n    FROM fornecedor_stats fs\n    JOIN categoria_percentiles cp ON fs.categoria_despesa = cp.categoria_despesa\n)\nSELECT \n    fornecedor,\n    categoria_despesa,\n    total_transacoes,\n    meses_distintos,\n    valor_total,\n    valor_maximo,\n    tipo_one_hit,\n    flag_valor_suspeito\nFROM one_hit_candidates\nWHERE (tipo_one_hit IN ('strict', 'temporal')) \nAND flag_valor_suspeito = 1\nORDER BY valor_maximo DESC\nLIMIT 50`
      },
      'fornecedor-multiuso': {
        title: 'Fornecedor Multiuso',
        category: 'risk',
        query: `-- Análise Fornecedor Multiuso\n-- Encontra empresas ligadas a várias categorias de despesa fora do esperado\n\nWITH fornecedor_diversidade AS (\n    SELECT \n        fornecedor,\n        COUNT(DISTINCT categoria_despesa) AS num_categorias,\n        COUNT(DISTINCT subcategoria_despesa) AS num_subcategorias,\n        SUM(valor_liquido) AS valor_total,\n        STRING_AGG(DISTINCT categoria_despesa, ', ' ORDER BY categoria_despesa) AS categorias_atendidas\n    FROM despesas \n    WHERE fornecedor IS NOT NULL \n    AND categoria_despesa IS NOT NULL\n    AND valor_liquido IS NOT NULL\n    GROUP BY fornecedor\n),\ncategoria_shares AS (\n    SELECT \n        fd.fornecedor,\n        fd.num_categorias,\n        fd.num_subcategorias,\n        fd.valor_total,\n        fd.categorias_atendidas,\n        SUM(POWER(d.share_categoria, 2)) AS hhi_categorias\n    FROM fornecedor_diversidade fd\n    JOIN (\n        SELECT \n            fornecedor,\n            categoria_despesa,\n            SUM(valor_liquido) / SUM(SUM(valor_liquido)) OVER (PARTITION BY fornecedor) AS share_categoria\n        FROM despesas \n        WHERE fornecedor IS NOT NULL AND categoria_despesa IS NOT NULL\n        GROUP BY fornecedor, categoria_despesa\n    ) d ON fd.fornecedor = d.fornecedor\n    GROUP BY fd.fornecedor, fd.num_categorias, fd.num_subcategorias, fd.valor_total, fd.categorias_atendidas\n)\nSELECT \n    fornecedor,\n    num_categorias,\n    num_subcategorias,\n    valor_total,\n    categorias_atendidas,\n    ROUND(1 - hhi_categorias, 3) AS indice_diversidade,\n    CASE \n        WHEN num_categorias >= 3 OR (num_categorias >= 2 AND num_subcategorias >= 4) THEN 1 \n        ELSE 0 \n    END AS flag_multiuso\nFROM categoria_shares\nWHERE num_categorias >= 3 OR (num_categorias >= 2 AND num_subcategorias >= 4)\nORDER BY num_categorias DESC, valor_total DESC\nLIMIT 50`
      },
      'preferencia-politica': {
        title: 'Preferência Política',
        category: 'risk',
        query: `-- Análise de Preferência Política\n-- Verifica se fornecedores são usados de forma desproporcional por um partido específico\n\nWITH fornecedor_partido AS (\n    SELECT \n        fornecedor,\n        sigla_partido,\n        SUM(valor_liquido) AS valor_partido_fornecedor,\n        COUNT(*) AS transacoes_partido_fornecedor\n    FROM despesas \n    WHERE fornecedor IS NOT NULL \n    AND sigla_partido IS NOT NULL \n    AND valor_liquido IS NOT NULL\n    GROUP BY fornecedor, sigla_partido\n),\nfornecedor_totals AS (\n    SELECT \n        fornecedor,\n        SUM(valor_partido_fornecedor) AS valor_total_fornecedor,\n        SUM(transacoes_partido_fornecedor) AS transacoes_total_fornecedor\n    FROM fornecedor_partido\n    GROUP BY fornecedor\n),\npartido_totals AS (\n    SELECT \n        sigla_partido,\n        SUM(valor_liquido) AS valor_total_partido\n    FROM despesas \n    WHERE sigla_partido IS NOT NULL AND valor_liquido IS NOT NULL\n    GROUP BY sigla_partido\n),\nglobal_total AS (\n    SELECT SUM(valor_liquido) AS valor_total_geral\n    FROM despesas \n    WHERE valor_liquido IS NOT NULL\n),\npreferencia_analysis AS (\n    SELECT \n        fp.fornecedor,\n        fp.sigla_partido,\n        fp.valor_partido_fornecedor,\n        ft.valor_total_fornecedor,\n        pt.valor_total_partido,\n        gt.valor_total_geral,\n        fp.valor_partido_fornecedor / NULLIF(ft.valor_total_fornecedor, 0) AS share_partido_fornecedor,\n        pt.valor_total_partido / gt.valor_total_geral AS base_rate_partido,\n        (fp.valor_partido_fornecedor / NULLIF(ft.valor_total_fornecedor, 0)) / \n        NULLIF(pt.valor_total_partido / gt.valor_total_geral, 0) AS lift_ratio\n    FROM fornecedor_partido fp\n    JOIN fornecedor_totals ft ON fp.fornecedor = ft.fornecedor  \n    JOIN partido_totals pt ON fp.sigla_partido = pt.sigla_partido\n    CROSS JOIN global_total gt\n),\npercentile_75 AS (\n    SELECT PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY valor_total_fornecedor) AS p75_fornecedor\n    FROM fornecedor_totals\n)\nSELECT \n    pa.fornecedor,\n    pa.sigla_partido,\n    pa.valor_partido_fornecedor,\n    pa.valor_total_fornecedor,\n    ROUND(pa.share_partido_fornecedor, 3) AS share_partido,\n    ROUND(pa.base_rate_partido, 3) AS base_rate,\n    ROUND(pa.lift_ratio, 2) AS lift,\n    CASE WHEN pa.lift_ratio >= 2 AND pa.valor_total_fornecedor >= p75.p75_fornecedor THEN 1 ELSE 0 END AS flag_preferencia\nFROM preferencia_analysis pa\nCROSS JOIN percentile_75 p75\nWHERE pa.lift_ratio >= 2 AND pa.valor_total_fornecedor >= p75.p75_fornecedor\nORDER BY pa.lift_ratio DESC\nLIMIT 50`
      },
      'evolucao-liquido-retido': {
        title: 'Evolução Líquido vs Retido',
        category: 'risk',
        query: `-- Análise de Evolução Líquido vs Retido\n-- Analisa evolução de valores para detectar padrões de uso indevido (simulação)\n\nWITH monthly_ratios AS (\n    SELECT \n        nome_parlamentar as deputado,\n        date_part('year', data_emissao) * 100 + date_part('month', data_emissao) AS ano_mes,\n        SUM(valor_liquido) AS valor_total_mes,\n        COUNT(*) AS transacoes_mes,\n        AVG(valor_liquido) AS valor_medio_mes\n    FROM despesas \n    WHERE data_emissao IS NOT NULL \n    AND valor_liquido IS NOT NULL\n    AND nome_parlamentar IS NOT NULL\n    GROUP BY nome_parlamentar, ano_mes\n),\ndeputado_stats AS (\n    SELECT \n        deputado,\n        AVG(valor_medio_mes) AS media_deputado,\n        STDDEV(valor_medio_mes) AS desvio_deputado,\n        COUNT(*) AS meses_atividade\n    FROM monthly_ratios\n    GROUP BY deputado\n    HAVING COUNT(*) >= 6  -- Pelo menos 6 meses de atividade\n),\nz_scores AS (\n    SELECT \n        mr.deputado,\n        mr.ano_mes,\n        mr.valor_total_mes,\n        mr.valor_medio_mes,\n        ds.media_deputado,\n        ds.desvio_deputado,\n        CASE \n            WHEN ds.desvio_deputado > 0 THEN \n                (mr.valor_medio_mes - ds.media_deputado) / ds.desvio_deputado\n            ELSE 0 \n        END AS z_score\n    FROM monthly_ratios mr\n    JOIN deputado_stats ds ON mr.deputado = ds.deputado\n)\nSELECT \n    deputado,\n    ano_mes,\n    valor_total_mes,\n    valor_medio_mes,\n    ROUND(z_score, 2) AS z_score,\n    CASE WHEN ABS(z_score) >= 2 THEN 1 ELSE 0 END AS flag_outlier\nFROM z_scores\nWHERE ABS(z_score) >= 2\nORDER BY ABS(z_score) DESC\nLIMIT 50`
      },
      'duplicacao-indireta': {
        title: 'Duplicação Indireta',
        category: 'risk',
        query: `-- Análise de Duplicação Indireta\n-- Checa notas semelhantes entre deputados diferentes que podem ser replicadas\n\nWITH duplicatas_candidatas AS (\n    SELECT DISTINCT\n        d1.fornecedor,\n        d1.valor_liquido,\n        d1.data_emissao,\n        d1.nome_parlamentar as deputado1,\n        d2.nome_parlamentar as deputado2,\n        d1.categoria_despesa,\n        ABS(date_diff('day', d1.data_emissao::DATE, d2.data_emissao::DATE)) AS diferenca_dias\n    FROM despesas d1\n    JOIN despesas d2 ON d1.fornecedor = d2.fornecedor\n        AND ABS(d1.valor_liquido - d2.valor_liquido) / GREATEST(d1.valor_liquido, d2.valor_liquido) <= 0.01\n        AND d1.nome_parlamentar < d2.nome_parlamentar  -- Evita duplicatas e garante ordem consistente\n        AND d1.data_emissao IS NOT NULL \n        AND d2.data_emissao IS NOT NULL\n    WHERE d1.fornecedor IS NOT NULL \n    AND d1.valor_liquido IS NOT NULL\n    AND d2.valor_liquido IS NOT NULL\n    AND d1.valor_liquido > 1000  -- Foca em valores significativos\n),\nduplicatas_filtradas AS (\n    SELECT *\n    FROM duplicatas_candidatas\n    WHERE diferenca_dias <= 3  -- Mesmo dia ou ±3 dias\n),\nagrupadas AS (\n    SELECT \n        fornecedor,\n        ROUND(valor_liquido, 2) as valor_aproximado,\n        categoria_despesa,\n        COUNT(*) AS num_casos_similares,\n        STRING_AGG(DISTINCT deputado1 || ' & ' || deputado2, '; ') AS pares_deputados,\n        MIN(diferenca_dias) AS min_diferenca_dias,\n        AVG(diferenca_dias) AS media_diferenca_dias\n    FROM duplicatas_filtradas\n    GROUP BY fornecedor, ROUND(valor_liquido, 2), categoria_despesa\n    HAVING COUNT(*) >= 1\n)\nSELECT \n    fornecedor,\n    valor_aproximado,\n    categoria_despesa,\n    num_casos_similares,\n    pares_deputados,\n    min_diferenca_dias,\n    ROUND(media_diferenca_dias, 1) as media_diferenca_dias,\n    1 AS flag_duplicacao\nFROM agrupadas\nORDER BY valor_aproximado DESC, num_casos_similares DESC\nLIMIT 50`
      },
      'concentracao-fornecedores': {
        title: 'Concentração de Fornecedores',
        category: 'risk',
        query: `-- Análise de Concentração de Fornecedores (HHI)\n-- Mede dependência de poucos fornecedores por deputado via índice de concentração\n\nWITH deputado_fornecedor AS (\n    SELECT \n        nome_parlamentar as deputado,\n        fornecedor,\n        SUM(valor_liquido) AS valor_fornecedor\n    FROM despesas \n    WHERE nome_parlamentar IS NOT NULL \n    AND fornecedor IS NOT NULL \n    AND valor_liquido IS NOT NULL\n    GROUP BY nome_parlamentar, fornecedor\n),\ndeputado_totals AS (\n    SELECT \n        deputado,\n        SUM(valor_fornecedor) AS valor_total_deputado\n    FROM deputado_fornecedor\n    GROUP BY deputado\n),\nshares_calculadas AS (\n    SELECT \n        df.deputado,\n        df.fornecedor,\n        df.valor_fornecedor,\n        dt.valor_total_deputado,\n        df.valor_fornecedor / dt.valor_total_deputado AS share_fornecedor\n    FROM deputado_fornecedor df\n    JOIN deputado_totals dt ON df.deputado = dt.deputado\n),\nconcentracao_metrics AS (\n    SELECT \n        deputado,\n        valor_total_deputado,\n        COUNT(*) AS num_fornecedores,\n        MAX(share_fornecedor) AS top1_share,\n        SUM(POWER(share_fornecedor, 2)) AS hhi,\n        STRING_AGG(\n            fornecedor || ' (' || ROUND(share_fornecedor * 100, 1) || '%)', \n            ', ' \n            ORDER BY share_fornecedor DESC\n        ) AS top_fornecedores\n    FROM shares_calculadas\n    GROUP BY deputado, valor_total_deputado\n)\nSELECT \n    deputado,\n    valor_total_deputado,\n    num_fornecedores,\n    ROUND(top1_share, 3) AS participacao_top1,\n    ROUND(hhi, 3) AS indice_hhi,\n    CASE \n        WHEN hhi >= 0.25 OR top1_share >= 0.6 THEN 1 \n        ELSE 0 \n    END AS flag_concentracao,\n    SUBSTR(top_fornecedores, 1, 200) AS principais_fornecedores\nFROM concentracao_metrics\nWHERE hhi >= 0.25 OR top1_share >= 0.6\nORDER BY hhi DESC\nLIMIT 50`
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
    url.searchParams.set('analise', queryId);
    window.history.pushState({ queryId }, '', url);
  }

  /**
   * Load query from URL parameter
   * @returns {Promise<void>}
   */
  async loadQueryFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get('query') || urlParams.get('analise');
    
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
    this.setupSearchFunctionality();
    this.setupPanelToggles();

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
   * Setup search functionality for filtering analysis buttons
   */
  setupSearchFunctionality() {
    const searchInput = DOMUtils.getElementById('query-search');
    if (!searchInput) return;

    // Add input event listener for real-time filtering
    DOMUtils.addEventListener(searchInput, 'input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      this.filterAnalysisButtons(searchTerm);
    });

    // Add clear functionality on Escape key
    DOMUtils.addEventListener(searchInput, 'keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        this.filterAnalysisButtons('');
      }
    });
  }

  /**
   * Setup panel toggle functionality for both right panel and query panel
   */
  setupPanelToggles() {
    // Right panel (schema) toggle
    const rightPanelToggle = DOMUtils.getElementById('panel-toggle');
    const rightPanel = DOMUtils.getElementById('right-panel');
    const rightPanelContent = DOMUtils.getElementById('panel-content');
    const panelTitle = DOMUtils.getElementById('panel-title');
    const panelHeader = rightPanel?.querySelector('.p-4.border-b');
    
    if (rightPanelToggle && rightPanel) {
      DOMUtils.addEventListener(rightPanelToggle, 'click', () => {
        const isCollapsed = rightPanel.classList.contains('w-8');
        
        if (isCollapsed) {
          // Expand panel
          rightPanel.classList.remove('w-8');
          rightPanel.classList.add('w-80');
          if (rightPanelContent) rightPanelContent.classList.remove('hidden');
          if (panelTitle) panelTitle.classList.remove('hidden');
          if (panelHeader) {
            panelHeader.classList.remove('px-1', 'justify-center');
            panelHeader.classList.add('px-4');
          }
          rightPanelToggle.title = 'Recolher painel';
          // Rotate arrow to point right
          const arrow = rightPanelToggle.querySelector('svg');
          if (arrow) arrow.style.transform = 'rotate(0deg)';
          // Show the database icon
          const dbIcon = panelHeader?.querySelector('span:first-child');
          if (dbIcon) dbIcon.classList.remove('hidden');
        } else {
          // Collapse panel
          rightPanel.classList.remove('w-80');
          rightPanel.classList.add('w-8');
          if (rightPanelContent) rightPanelContent.classList.add('hidden');
          if (panelTitle) panelTitle.classList.add('hidden');
          if (panelHeader) {
            panelHeader.classList.remove('px-4');
            panelHeader.classList.add('px-1', 'justify-center');
          }
          rightPanelToggle.title = 'Expandir painel';
          // Rotate arrow to point left
          const arrow = rightPanelToggle.querySelector('svg');
          if (arrow) arrow.style.transform = 'rotate(180deg)';
          // Hide the database icon
          const dbIcon = panelHeader?.querySelector('span:first-child');
          if (dbIcon) dbIcon.classList.add('hidden');
        }
        
        // Trigger Sankey resize after panel animation
        this.triggerSankeyResize();
      });
    }

    // Query panel toggle
    const queryPanelToggle = DOMUtils.getElementById('query-panel-toggle');
    const editorContainer = document.querySelector('.editor-container');
    
    if (queryPanelToggle && editorContainer) {
      DOMUtils.addEventListener(queryPanelToggle, 'click', () => {
        const isCollapsed = editorContainer.classList.contains('h-10');
        
        if (isCollapsed) {
          // Expand panel
          editorContainer.classList.remove('h-10');
          editorContainer.classList.add('h-80');
          queryPanelToggle.title = 'Recolher painel de consulta';
          // Rotate arrow to point down
          const arrow = queryPanelToggle.querySelector('svg');
          if (arrow) arrow.style.transform = 'rotate(0deg)';
          // Show editor
          const editor = DOMUtils.getElementById('editor');
          if (editor) editor.classList.remove('hidden');
        } else {
          // Collapse panel
          editorContainer.classList.remove('h-80');
          editorContainer.classList.add('h-10');
          queryPanelToggle.title = 'Expandir painel de consulta';
          // Rotate arrow to point up
          const arrow = queryPanelToggle.querySelector('svg');
          if (arrow) arrow.style.transform = 'rotate(180deg)';
          // Hide editor
          const editor = DOMUtils.getElementById('editor');
          if (editor) editor.classList.add('hidden');
        }
        
        // Trigger Monaco editor resize if available
        if (this.editorManager && this.editorManager.editor) {
          setTimeout(() => {
            this.editorManager.editor.layout();
          }, 300); // Wait for animation to complete
        }
        
        // Trigger Sankey resize after panel animation
        this.triggerSankeyResize();
      });
    }
  }

  /**
   * Trigger Sankey diagram resize when panels are toggled
   */
  triggerSankeyResize() {
    if (this.sankeyTab && this.sankeyTab.resizeHandler) {
      // Use setTimeout to allow panel animation to complete
      setTimeout(() => {
        this.sankeyTab.resizeHandler();
      }, 350); // Slightly longer than panel animation
    }
  }

  /**
   * Filter analysis buttons based on search term
   * @param {string} searchTerm - Search term to filter by
   */
  filterAnalysisButtons(searchTerm) {
    const allSampleQueries = document.querySelectorAll('.sample-query');
    const allCategories = document.querySelectorAll('.category-section');
    
    if (!searchTerm.trim()) {
      // Show all buttons and categories when search is empty
      allSampleQueries.forEach(button => {
        button.style.display = 'block';
      });
      allCategories.forEach(category => {
        category.style.display = 'block';
      });
      return;
    }

    // Filter buttons by search term
    allSampleQueries.forEach(button => {
      const buttonText = button.textContent.toLowerCase();
      const buttonId = button.getAttribute('data-id') || '';
      
      // Check if button text or ID matches search term
      const matches = buttonText.includes(searchTerm) || 
                     buttonId.toLowerCase().includes(searchTerm);
      
      button.style.display = matches ? 'block' : 'none';
    });

    // Hide categories that have no visible buttons
    allCategories.forEach(category => {
      const visibleButtons = category.querySelectorAll('.sample-query[style*="display: block"], .sample-query:not([style*="display: none"])');
      const hasVisibleButtons = Array.from(visibleButtons).some(button => {
        return !button.style.display || button.style.display === 'block';
      });
      
      category.style.display = hasVisibleButtons ? 'block' : 'none';
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
      url.searchParams.set('analise', currentQueryId);
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

// Note: toggleCategory function is now defined directly in db.html for immediate availability

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (dbApp) {
    dbApp.dispose();
  }
});

// Export for potential external use
export { DatabaseApp };