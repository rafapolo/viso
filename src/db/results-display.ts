// Results Display Management
import { DOMUtils } from '../shared/dom-utils.js';
import { DATA_TYPE_ICONS } from '../core/config.js';
import { ErrorHandler } from '../shared/error-handler.js';
import type { PaginationHandler } from './pagination-handler.js';

interface QueryResult {
  rowCount: number;
  data: Record<string, unknown>[];
  columns?: string[];
  executionTime?: number;
}

export interface SchemaColumn {
  column_name: unknown;
  column_type: unknown;
}

interface ResultSummary {
  totalRows: number;
  columns: number;
  executionTime: number | undefined;
  dataTypes: Record<string, string>;
}

export class ResultsDisplay {
  private paginationHandler: PaginationHandler | null;

  constructor(paginationHandler: PaginationHandler | null = null) {
    this.paginationHandler = paginationHandler;
  }

  displayResults(result: QueryResult): void {
    const resultsContent = DOMUtils.getElementById('results');
    if (!resultsContent) {
      ErrorHandler.handleError(new Error('Results container not found'), 'Results Display');
      return;
    }

    try {
      resultsContent.className = 'w-full h-full overflow-auto';

      if (result.rowCount === 0) {
        this.displayNoResults(resultsContent);
        return;
      }

      if (this.paginationHandler) {
        this.paginationHandler.initializePagination(result);
      }

      const displayRows = this.paginationHandler
        ? this.paginationHandler.getCurrentPageData()
        : result.data;

      const tableHTML = this.createTableHTML(result.columns, displayRows);
      DOMUtils.updateContent(resultsContent, tableHTML, true);

      this.updateResultStats(result);
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Results Display');
      this.displayError(resultsContent, (error as Error).message);
    }
  }

  displayNoResults(container: HTMLElement): void {
    const noResultsHTML = `
      <div class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 gap-2">
        <div class="text-2xl opacity-50">📄</div>
        <div>Nenhum resultado encontrado</div>
      </div>
    `;

    DOMUtils.updateContent(container, noResultsHTML, true);

    if (this.paginationHandler) {
      this.paginationHandler.hidePagination();
    }
  }

  displayError(container: HTMLElement, errorMessage: string): void {
    const errorHTML = `
      <div class="flex flex-col items-center justify-center h-full text-red-500 dark:text-red-400 gap-2">
        <div class="text-2xl opacity-50">❌</div>
        <div>Erro ao exibir resultados</div>
        <div class="text-sm opacity-75">${errorMessage}</div>
      </div>
    `;

    DOMUtils.updateContent(container, errorHTML, true);
  }

  createTableHTML(columns: string[], rows: Record<string, unknown>[]): string {
    let tableHTML = '<div class="p-4"><table class="border-collapse text-xs" style="width: auto; min-width: max-content;">';

    tableHTML += '<thead><tr>';
    columns.forEach(col => {
      tableHTML += `
        <th class="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 p-2 border-b border-r border-gray-300 dark:border-gray-700 font-medium text-left sticky top-0 z-10 whitespace-nowrap" style="min-width: 150px;">
          ${this.escapeHtml(col)}
        </th>
      `;
    });
    tableHTML += '</tr></thead>';

    tableHTML += '<tbody>';
    rows.forEach((row) => {
      tableHTML += '<tr class="hover:bg-gray-100 dark:hover:bg-gray-900">';
      columns.forEach(col => {
        const value = row[col];
        const displayValue = this.formatCellValue(value);
        tableHTML += `
          <td class="p-1.5 border-b border-r border-gray-300 dark:border-gray-700 whitespace-nowrap" style="min-width: 150px;">
            ${displayValue}
          </td>
        `;
      });
      tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table></div>';

    return tableHTML;
  }

  formatCellValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '<span class="text-gray-500 dark:text-gray-400 italic">NULL</span>';
    }

    if (typeof value === 'number') {
      return value.toLocaleString();
    }

    const stringValue = String(value);

    if (stringValue.length > 100) {
      return `<span title="${this.escapeHtml(stringValue)}">${this.escapeHtml(stringValue.substring(0, 97))}...</span>`;
    }

    return this.escapeHtml(stringValue);
  }

  updateResultStats(result: QueryResult): void {
    const resultStats = DOMUtils.getElementById('result-stats');
    const executionStats = DOMUtils.getElementById('execution-stats');

    if (resultStats) {
      DOMUtils.updateContent(resultStats, `${result.rowCount} linhas`, false);
    }

    if (executionStats) {
      const timeText = result.executionTime
        ? `Consulta executada em ${result.executionTime.toFixed(2)}ms`
        : 'Consulta executada';
      DOMUtils.updateContent(executionStats, timeText, false);
    }
  }

  clearResults(): void {
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

    DOMUtils.updateContent('execution-stats', 'despesas', false);
    DOMUtils.updateContent('result-stats', '', false);

    if (this.paginationHandler) {
      this.paginationHandler.reset();
    }
  }

  displaySchema(schema: SchemaColumn[]): void {
    const schemaTree = DOMUtils.getElementById('schema-tree');
    if (!schemaTree) return;

    try {
      if (schema.length > 0) {
        const schemaHTML = `
          <div class="py-2 border-b border-gray-300 dark:border-gray-700">
            <div id="connection-status" class="text-xs text-red-500 dark:text-red-400">
              ❌ Desconectado
            </div>
          </div>
          ${schema.map(col =>
            `<div class="py-1 flex items-center gap-1.5 text-xs">
              <span class="w-3 h-3 opacity-60">${this.getDataTypeIcon(String(col.column_type))}</span>
              <span>${this.escapeHtml(String(col.column_name))}</span>
              <span class="text-gray-500 dark:text-gray-400 text-xs ml-auto">${this.escapeHtml(String(col.column_type))}</span>
            </div>`
          ).join('')}`;

        DOMUtils.updateContent(schemaTree, schemaHTML, true);
      } else {
        DOMUtils.updateContent(schemaTree, '<div class="text-red-500 dark:text-red-400">Falha ao carregar esquema</div>', true);
      }
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Schema Display');
      DOMUtils.updateContent(schemaTree, '<div class="text-red-500 dark:text-red-400">Erro ao carregar esquema</div>', true);
    }
  }

  getDataTypeIcon(columnType: string): string {
    const type = columnType.toUpperCase();

    if (type.includes('VARCHAR') || type.includes('TEXT') || type.includes('CHAR') || type.includes('STRING')) {
      return DATA_TYPE_ICONS['STRING'];
    }
    if (type.includes('BIGINT') || type.includes('INTEGER') || type.includes('INT') || type.includes('TINYINT') || type.includes('SMALLINT')) {
      return DATA_TYPE_ICONS['INTEGER'];
    }
    if (type.includes('DOUBLE') || type.includes('FLOAT') || type.includes('REAL') || type.includes('DECIMAL') || type.includes('NUMERIC')) {
      return DATA_TYPE_ICONS['DECIMAL'];
    }
    if (type.includes('TIMESTAMP') || type.includes('DATETIME') || type.includes('DATE') || type.includes('TIME')) {
      return DATA_TYPE_ICONS['DATETIME'];
    }
    if (type.includes('BOOLEAN') || type.includes('BOOL') || type.includes('BIT')) {
      return DATA_TYPE_ICONS['BOOLEAN'];
    }
    if (type.includes('JSON') || type.includes('OBJECT')) {
      return DATA_TYPE_ICONS['JSON'];
    }
    if (type.includes('ARRAY') || type.includes('LIST')) {
      return DATA_TYPE_ICONS['ARRAY'];
    }
    if (type.includes('UUID')) {
      return DATA_TYPE_ICONS['UUID'];
    }
    if (type.includes('BLOB') || type.includes('BINARY') || type.includes('VARBINARY')) {
      return DATA_TYPE_ICONS['BINARY'];
    }

    return DATA_TYPE_ICONS['DEFAULT'];
  }

  updateConnectionStatus(message: string, isError = false): void {
    const statusEl = DOMUtils.getElementById('connection-status');
    if (statusEl) {
      const icon = isError ? '❌' : '✅';
      const className = isError
        ? 'text-xs text-red-500 dark:text-red-400'
        : 'text-xs text-duckdb-500';

      DOMUtils.updateContent(statusEl, `${icon} ${message}`, true);
      statusEl.className = className;
    }
  }

  setDisconnectedStatus(): void {
    this.updateConnectionStatus('Desconectado', true);
  }

  escapeHtml(unsafe: string): string {
    if (typeof unsafe !== 'string') return String(unsafe);

    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  createResultSummary(result: QueryResult | null): ResultSummary | null {
    if (!result || !result.data) return null;

    const summary: ResultSummary = {
      totalRows: result.rowCount,
      columns: result.columns.length,
      executionTime: result.executionTime,
      dataTypes: {},
    };

    if (result.data.length > 0) {
      const sampleSize = Math.min(100, result.data.length);
      result.columns.forEach(col => {
        const sampleValues = result.data.slice(0, sampleSize).map(row => row[col]);
        summary.dataTypes[col] = this.analyzeColumnType(sampleValues);
      });
    }

    return summary;
  }

  analyzeColumnType(values: unknown[]): string {
    const nonNullValues = values.filter(v => v !== null && v !== undefined);
    if (nonNullValues.length === 0) return 'unknown';

    const firstValue = nonNullValues[0];

    if (typeof firstValue === 'number') {
      return Number.isInteger(firstValue) ? 'integer' : 'decimal';
    }
    if (typeof firstValue === 'boolean') return 'boolean';
    if (firstValue instanceof Date) return 'datetime';

    if (typeof firstValue === 'string') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/;
      if (dateRegex.test(firstValue)) return 'datetime';
    }

    return 'string';
  }
}
