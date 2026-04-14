// Query Execution Management
import { APIUtils } from '../shared/api-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { DOMUtils } from '../shared/dom-utils.js';

interface QueryResult {
  rowCount: number;
  data: Record<string, unknown>[];
  columns?: string[];
  executionTime?: number;
  success?: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class QueryExecutor {
  private currentResults: QueryResult | null;
  private isExecuting: boolean;

  constructor() {
    this.currentResults = null;
    this.isExecuting = false;
  }

  async executeQuery(sql: string, onProgress: ((msg: string) => void) | null = null): Promise<QueryResult | null> {
    if (!sql || !sql.trim()) {
      throw new Error('Empty query provided');
    }

    if (this.isExecuting) {
      return null;
    }

    this.isExecuting = true;

    try {
      this.showLoadingState();

      if (onProgress) onProgress('Formatting query...');

      const formattedSQL = APIUtils.formatSQL(sql);

      if (onProgress) onProgress('Executing query...');

      const raw = await APIUtils.executeDuckDBQuery(formattedSQL);
      // Normalise: the ArrowTable result coming from duckdbAPI.executeQuery is passed through
      // api-utils and may carry rowCount on the underlying shape
      const result = raw as unknown as QueryResult;

      if (onProgress) onProgress('Processing results...');

      this.currentResults = result;

      if (onProgress) onProgress(`Query completed - ${result.rowCount} rows`);

      return result;
    } catch (error) {
      ErrorHandler.handleDatabaseError(error as Error, 'Query Execution');
      this.showErrorState((error as Error).message);
      throw error;
    } finally {
      this.isExecuting = false;
      this.hideLoadingState();
    }
  }

  showLoadingState(): void {
    const runBtn = DOMUtils.getElementById('run-query-btn') as HTMLButtonElement | null;
    const resultsContent = DOMUtils.getElementById('results');

    if (runBtn) {
      runBtn.disabled = true;
      DOMUtils.updateContent(runBtn, '<span class="loading-spinner"></span> Executando', true);
    }

    if (resultsContent) {
      DOMUtils.updateContent(
        resultsContent,
        '<div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2"><span class="loading-spinner"></span><div>Executando consulta...</div></div>',
        true
      );
    }
  }

  hideLoadingState(): void {
    const runBtn = DOMUtils.getElementById('run-query-btn') as HTMLButtonElement | null;

    if (runBtn) {
      runBtn.disabled = false;
      DOMUtils.updateContent(runBtn, '▶️ Executar', true);
    }
  }

  showErrorState(errorMessage: string): void {
    const resultsContent = DOMUtils.getElementById('results');
    const executionStats = DOMUtils.getElementById('execution-stats');

    if (resultsContent) {
      const errorHTML = `
        <div class="bg-red-900/20 border border-red-500 text-red-200 p-3 m-3 rounded">
          <strong>Erro:</strong> ${errorMessage}
        </div>
      `;
      DOMUtils.updateContent(resultsContent, errorHTML, true);
    }

    if (executionStats) {
      DOMUtils.updateContent(executionStats, 'Consulta falhou', false);
    }
  }

  getCurrentResults(): QueryResult | null {
    return this.currentResults;
  }

  clearResults(): void {
    this.currentResults = null;

    const resultsContent = DOMUtils.getElementById('results');
    if (resultsContent) {
      const clearHTML = `
        <div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
          <div class="text-5xl opacity-30">📊</div>
          <div>Execute uma consulta para ver os resultados</div>
        </div>
      `;
      DOMUtils.updateContent(resultsContent, clearHTML, true);
    }

    this.updateExecutionStats('despesas', '');
  }

  updateExecutionStats(status: string, resultInfo = ''): void {
    const executionStats = DOMUtils.getElementById('execution-stats');
    const resultStats = DOMUtils.getElementById('result-stats');

    if (executionStats) {
      DOMUtils.updateContent(executionStats, status, false);
    }

    if (resultStats) {
      DOMUtils.updateContent(resultStats, resultInfo, false);
    }
  }

  async executeFromSampleButton(buttonElement: HTMLElement): Promise<void> {
    const btn = buttonElement as HTMLElement & { dataset: DOMStringMap };
    const { query, id: analysisId } = btn.dataset;

    if (!query) {
      return;
    }

    try {
      if (analysisId === 'top-categorias') {
        this.resetAllFilters();
      }

      this.updateButtonSelection(buttonElement);

      const formattedQuery = APIUtils.formatSQL(query);

      document.dispatchEvent(new CustomEvent('updateEditor', {
        detail: { query: formattedQuery },
      }));

      this.updateURLWithQuery(formattedQuery, buttonElement.textContent?.trim() ?? '', analysisId);

      await this.executeQuery(formattedQuery);
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Sample Query Execution');
    }
  }

  updateButtonSelection(selectedButton: Element): void {
    DOMUtils.getElements('.sample-query').forEach((button: Element) => {
      DOMUtils.removeClass(button as HTMLElement, 'selected');
    });

    DOMUtils.addClass(selectedButton as HTMLElement, 'selected');
  }

  resetAllFilters(): void {
    const searchInput = DOMUtils.getElementById('query-search') as HTMLInputElement | null;
    if (searchInput) {
      searchInput.value = '';
    }

    document.dispatchEvent(new CustomEvent('resetFilters'));
  }

  updateURLWithQuery(query: string, analysisName: string, analysisId: string | undefined = undefined): void {
    try {
      const url = new URL(window.location.href);

      url.searchParams.delete('query');
      url.searchParams.delete('name');
      url.searchParams.delete('analise');

      if (analysisId) {
        url.searchParams.set('analise', analysisId);
      } else {
        url.searchParams.set('query', btoa(encodeURIComponent(query)));
        url.searchParams.set('name', encodeURIComponent(analysisName));
      }

      window.history.pushState({ query, analysisName, analysisId }, analysisName, url);
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'URL Update');
    }
  }

  exportResults(filename = 'query_results.csv'): void {
    if (!this.currentResults || !this.currentResults.data.length) {
      ErrorHandler.showUserError('Nenhum resultado para exportar', null, { type: 'warning' });
      return;
    }

    try {
      const exportData = {
        data: this.currentResults.data,
        columns: this.currentResults.columns ?? Object.keys(this.currentResults.data[0] ?? {}),
      };
      APIUtils.exportToCSV(exportData, filename);
      ErrorHandler.showUserError(`Resultados exportados para ${filename}`, null, {
        type: 'success',
        duration: 3000,
      });
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'CSV Export');
      ErrorHandler.showUserError('Falha ao exportar resultados', null, { type: 'error' });
    }
  }

  isQueryExecuting(): boolean {
    return this.isExecuting;
  }

  validateSQL(sql: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!sql || !sql.trim()) {
      errors.push('Query cannot be empty');
    }

    const sqlUpper = sql.toUpperCase().trim();

    const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];
    dangerousKeywords.forEach(keyword => {
      if (sqlUpper.includes(keyword)) {
        warnings.push(`Query contains potentially dangerous keyword: ${keyword}`);
      }
    });

    if (!sqlUpper.startsWith('SELECT') && !sqlUpper.startsWith('WITH')) {
      warnings.push('Only SELECT queries are recommended');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  dispose(): void {
    this.currentResults = null;
    this.isExecuting = false;

    const resultsContent = DOMUtils.getElementById('results');
    if (resultsContent) resultsContent.innerHTML = '';

    const executionStats = DOMUtils.getElementById('execution-stats');
    if (executionStats) executionStats.innerHTML = '';

    const resultStats = DOMUtils.getElementById('result-stats');
    if (resultStats) resultStats.innerHTML = '';
  }
}
