// Statistics and Charts Management
import { APP_CONSTANTS } from '../core/config.js';
import { DOMUtils } from '../shared/dom-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';

interface AggregatedRecord {
  nome_parlamentar?: string;
  sigla_partido?: string;
  fornecedor?: string;
  categoria_despesa?: string;
  valor_total?: number | string;
  num_transacoes?: number | string;
}

interface NetworkNode {
  type: 'deputado' | 'fornecedor';
  label: string;
}

interface FilteredData {
  nodes: NetworkNode[];
}

interface TransactionItem {
  data_emissao?: string;
  valor_liquido?: number | string;
  categoria_despesa?: string;
  fornecedor?: string;
  nome_parlamentar?: string;
}

interface TooltipData {
  date: string;
  totalValue: number;
  count: number;
  transactions: TransactionItem[];
}

interface BarPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  data: TooltipData;
}

interface ChartData {
  sortedData: TransactionItem[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  padding: number;
  barPositions: BarPosition[];
}

class StatisticsCharts {
  private chartData: ChartData | null;
  private chartTooltip: HTMLElement | null;

  constructor() {
    this.chartData = null;
    this.chartTooltip = null;
  }

  updateStatistics(aggregatedData: AggregatedRecord[]): void {
    if (!aggregatedData || aggregatedData.length === 0) {
      this.clearStatistics();
      return;
    }

    const deputados = new Set(
      aggregatedData.map(r => `${r.nome_parlamentar} (${r.sigla_partido})`)
    );
    const fornecedores = new Set(aggregatedData.map(r => r.fornecedor));
    const totalValue = aggregatedData.reduce((sum, r) => sum + Number(r.valor_total), 0);
    const totalTransactions = aggregatedData.reduce(
      (sum, r) => sum + Number(r.num_transacoes),
      0
    );

    DOMUtils.updateContent('totalDeputados', deputados.size.toString(), false);
    DOMUtils.updateContent('totalFornecedores', fornecedores.size.toString(), false);
    DOMUtils.updateContent(
      'totalValue',
      totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      false
    );
    DOMUtils.updateContent('totalTransactions', totalTransactions.toLocaleString(), false);
  }

  updateStatisticsForFilteredData(
    filteredData: FilteredData,
    originalAggregatedData: AggregatedRecord[]
  ): void {
    if (!originalAggregatedData || !filteredData) return;

    const filteredDeputados = new Set(
      filteredData.nodes.filter(n => n.type === 'deputado').map(n => n.label)
    );
    const filteredFornecedores = new Set(
      filteredData.nodes.filter(n => n.type === 'fornecedor').map(n => n.label)
    );

    const filteredAggregatedData = originalAggregatedData.filter(record => {
      const deputadoLabel = `${record.nome_parlamentar} (${record.sigla_partido})`;
      const fornecedorLabel = record.fornecedor ?? '';
      return filteredDeputados.has(deputadoLabel) && filteredFornecedores.has(fornecedorLabel);
    });

    this.updateStatistics(filteredAggregatedData);
    this.createCategoryPieChart(filteredAggregatedData);
  }

  clearStatistics(): void {
    DOMUtils.updateContent('totalDeputados', '0', false);
    DOMUtils.updateContent('totalFornecedores', '0', false);
    DOMUtils.updateContent('totalValue', 'R$ 0,00', false);
    DOMUtils.updateContent('totalTransactions', '0', false);
  }

  createCategoryPieChart(data: AggregatedRecord[]): void {
    const canvas = DOMUtils.getElementById('categoryPieChart') as HTMLCanvasElement | null;
    const legend = DOMUtils.getElementById('categoryLegend');

    if (!canvas) return;

    if (!data || data.length === 0) {
      if (legend) {
        DOMUtils.updateContent(
          legend,
          '<div class="text-gray-500 text-center">Nenhum dado disponível</div>',
          true
        );
      }
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    try {
      const ctx = canvas.getContext('2d')!;
      const size = 150;
      canvas.width = size;
      canvas.height = size;

      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size / 2 - 10;

      const categoryTotals = new Map<string, number>();

      data.forEach(record => {
        const category = record.categoria_despesa || 'Outros';
        const value = Number(record.valor_total) || 0;
        if (value > 0) {
          categoryTotals.set(category, (categoryTotals.get(category) || 0) + value);
        }
      });

      const categoryData = Array.from(categoryTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, APP_CONSTANTS.CHARTS?.MAX_PIE_SLICES || 8);

      const total = categoryData.reduce((sum, [, value]) => sum + value, 0);
      if (total === 0 || categoryData.length === 0) {
        if (legend) {
          DOMUtils.updateContent(
            legend,
            '<div class="text-gray-500 text-center">Nenhum dado disponível</div>',
            true
          );
        }
        ctx.clearRect(0, 0, size, size);
        return;
      }

      const colors = [
        '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899',
        '#6366F1', '#EF4444', '#F97316', '#14B8A6', '#06B6D4',
      ];

      ctx.clearRect(0, 0, size, size);

      let currentAngle = -Math.PI / 2;
      categoryData.forEach(([, value], index) => {
        const sliceAngle = (value / total) * 2 * Math.PI;
        const color = colors[index % colors.length];

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        currentAngle += sliceAngle;
      });

      this.createPieChartLegend(categoryData, total, colors, legend);
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Category Pie Chart Creation');
      if (legend) {
        DOMUtils.updateContent(
          legend,
          '<div class="text-red-500 text-center">Erro ao criar gráfico</div>',
          true
        );
      }
    }
  }

  createPieChartLegend(
    categoryData: [string, number][],
    total: number,
    colors: string[],
    legend: Element | null
  ): void {
    if (!legend) return;

    const formatCurrency = (value: number) => `R$ ${value.toLocaleString('pt-BR')}`;

    const legendHTML = categoryData
      .map(([category, value], index) => {
        const percentage = ((value / total) * 100).toFixed(1);
        const color = colors[index % colors.length];

        return `
          <div class="flex items-center gap-2 py-1" title="${category}">
            <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${color}"></div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-medium truncate">${category}</div>
              <div class="text-xs text-gray-500">${formatCurrency(value)} (${percentage}%)</div>
            </div>
          </div>
        `;
      })
      .join('');

    DOMUtils.updateContent(legend, legendHTML, true);
  }

  createTimeSeriesChart(detailsData: TransactionItem[]): void {
    const canvas = DOMUtils.getElementById('timeSeriesChart') as HTMLCanvasElement | null;
    if (!canvas || !detailsData || detailsData.length === 0) {
      this.showChartEmptyState(canvas);
      return;
    }

    try {
      const ctx = canvas.getContext('2d')!;
      const { width, height } = canvas;
      const padding = 30;

      ctx.clearRect(0, 0, width, height);

      const parseDate = (dateStr: string): Date => {
        if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/');
          return new Date(Number(year), Number(month) - 1, Number(day));
        }
        return new Date(dateStr);
      };

      const sortedData = detailsData
        .filter(item => item.data_emissao && Number(item.valor_liquido) > 0)
        .sort((a, b) => parseDate(a.data_emissao!).getTime() - parseDate(b.data_emissao!).getTime());

      if (sortedData.length === 0) {
        this.showChartEmptyState(canvas);
        return;
      }

      const firstDate = parseDate(sortedData[0].data_emissao!);
      const lastDate = parseDate(sortedData[sortedData.length - 1].data_emissao!);
      const dateRange = lastDate.getTime() - firstDate.getTime() || 86400000;

      const values = sortedData.map(item => Number(item.valor_liquido));
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const valueRange = maxValue - minValue || 1;

      this.drawChartGrid(ctx, width, height, padding);
      this.drawChartAxes(ctx, width, height, padding);

      const barPositions = this.drawChartBars(
        ctx, sortedData, width, height, padding,
        firstDate, lastDate, dateRange, minValue, valueRange
      );
      this.drawChartLabels(ctx, width, height, padding, firstDate, lastDate, dateRange, minValue, maxValue);

      this.chartData = { sortedData, canvas, ctx, width, height, padding, barPositions };

      this.displaySummaryStats(sortedData);
      this.setupChartInteractivity(canvas);
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Time Series Chart Creation');
      this.showChartEmptyState(canvas);
    }
  }

  drawChartGrid(ctx: CanvasRenderingContext2D, width: number, height: number, padding: number): void {
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);

    const gridSteps = 4;
    for (let i = 1; i <= gridSteps; i++) {
      const y = padding + (i / gridSteps) * (height - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  drawChartAxes(ctx: CanvasRenderingContext2D, width: number, height: number, padding: number): void {
    ctx.strokeStyle = '#6B7280';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
  }

  drawChartBars(
    ctx: CanvasRenderingContext2D,
    sortedData: TransactionItem[],
    width: number,
    height: number,
    padding: number,
    firstDate: Date,
    _lastDate: Date,
    dateRange: number,
    minValue: number,
    valueRange: number
  ): BarPosition[] {
    const availableWidth = width - 2 * padding;
    const barWidth = Math.max(1, Math.min(4, availableWidth / sortedData.length));
    const barPositions: BarPosition[] = [];

    sortedData.forEach(item => {
      let date: Date;
      if (item.data_emissao!.includes('/')) {
        const [day, month, year] = item.data_emissao!.split('/');
        date = new Date(Number(year), Number(month) - 1, Number(day));
      } else {
        date = new Date(item.data_emissao!);
      }
      const value = Number(item.valor_liquido);

      const x = padding + ((date.getTime() - firstDate.getTime()) / dateRange) * (width - 2 * padding);
      const barHeight = ((value - minValue) / valueRange) * (height - 2 * padding);
      const y = height - padding - barHeight;

      barPositions.push({
        x: x - barWidth / 2,
        y,
        width: barWidth,
        height: barHeight,
        data: {
          date: item.data_emissao!,
          totalValue: value,
          count: 1,
          transactions: [item],
        },
      });

      const categoryColor = this.getCategoryColor(item.categoria_despesa);
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, categoryColor);
      gradient.addColorStop(1, this.adjustColorBrightness(categoryColor, -20));

      ctx.fillStyle = gradient;
      ctx.fillRect(x - barWidth / 2, y, barWidth, barHeight);

      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
      ctx.fillRect(x - barWidth / 2, y, barWidth, barHeight);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    });

    return barPositions;
  }

  drawChartLabels(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    padding: number,
    firstDate: Date,
    lastDate: Date,
    dateRange: number,
    minValue: number,
    maxValue: number
  ): void {
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    const formatDate = (date: Date) =>
      `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;

    ctx.fillText(formatDate(firstDate), padding, height - 10);
    if (dateRange > 86400000) {
      const middleDate = new Date(firstDate.getTime() + dateRange / 2);
      ctx.fillText(formatDate(middleDate), width / 2, height - 10);
      ctx.fillText(formatDate(lastDate), width - padding, height - 10);
    }

    ctx.textAlign = 'right';
    const formatCurrency = (value: number) => {
      if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
      return `R$ ${value.toFixed(0)}`;
    };

    const labelSteps = 4;
    for (let i = 0; i <= labelSteps; i++) {
      const value = minValue + (maxValue - minValue) * (1 - i / labelSteps);
      const y = padding + (i / labelSteps) * (height - 2 * padding);
      ctx.fillText(formatCurrency(value), padding - 8, y + 3);
    }
  }

  setupChartInteractivity(canvas: HTMLCanvasElement): void {
    canvas.onmousemove = (event) => this.handleChartHover(event);
    canvas.onmouseout = () => this.hideTooltip();
  }

  handleChartHover(event: MouseEvent): void {
    if (!this.chartData?.barPositions) return;

    const rect = this.chartData.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (this.chartData.canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (this.chartData.canvas.height / rect.height);

    const hoveredBar = this.chartData.barPositions.find(
      bar => x >= bar.x && x <= bar.x + bar.width && y >= bar.y && y <= bar.y + bar.height
    );

    if (hoveredBar) {
      this.chartData.canvas.style.cursor = 'pointer';
      this.showTooltip(event, hoveredBar.data);
    } else {
      this.chartData.canvas.style.cursor = 'default';
      this.hideTooltip();
    }
  }

  showTooltip(event: MouseEvent, data: TooltipData): void {
    this.hideTooltip();

    const tooltip = DOMUtils.createElement('div', {
      style: {
        position: 'fixed',
        background: 'rgba(17, 24, 39, 0.95)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        pointerEvents: 'none',
        zIndex: '1000',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(75, 85, 99, 0.3)',
        maxWidth: '200px',
      },
    });

    const formatCurrency = (value: number) =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
      }).format(value);

    const formatDate = (dateStr: string): string => {
      try {
        let date: Date;
        if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/');
          date = new Date(Number(year), Number(month) - 1, Number(day));
        } else {
          date = new Date(dateStr);
        }
        return new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(date);
      } catch {
        return dateStr || 'N/A';
      }
    };

    const transaction = data.transactions[0];
    const tooltipHTML = `
      <div class="font-medium text-blue-300 mb-1">${formatDate(data.date)}</div>
      <div>Valor: <span class="font-bold">${formatCurrency(data.totalValue)}</span></div>
      ${transaction.categoria_despesa ? `<div class="text-xs text-gray-300 mt-1">📋 ${transaction.categoria_despesa}</div>` : ''}
      ${transaction.fornecedor ? `<div class="text-xs text-gray-300 mt-1">→ ${transaction.fornecedor}</div>` : ''}
      ${transaction.nome_parlamentar ? `<div class="text-xs text-gray-300 mt-1">← ${transaction.nome_parlamentar}</div>` : ''}
    `;

    DOMUtils.updateContent(tooltip, tooltipHTML, true);
    document.body.appendChild(tooltip);
    this.chartTooltip = tooltip;

    const rect = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX + 10, window.innerWidth - rect.width - 10)}px`;
    tooltip.style.top = `${Math.max(event.clientY - rect.height - 10, 10)}px`;
  }

  hideTooltip(): void {
    if (this.chartTooltip) {
      this.chartTooltip.remove();
      this.chartTooltip = null;
    }
  }

  getCategoryColor(categoria: string | undefined): string {
    if (!categoria) return '#6B7280';

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
      '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899',
      '#6366F1', '#EF4444', '#F97316', '#14B8A6', '#06B6D4',
    ];

    const colorIndex = Math.abs(hashCode(categoria)) % colors.length;
    return colors[colorIndex];
  }

  adjustColorBrightness(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return `#${(
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)}`;
  }

  showChartEmptyState(canvas: HTMLCanvasElement | null): void {
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#6B7280';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📊', width / 2, height / 2 - 20);

    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText('Nenhum dado temporal disponível', width / 2, height / 2 + 10);
    ctx.fillText('Transações sem data válida', width / 2, height / 2 + 25);
  }

  displaySummaryStats(transactionData: TransactionItem[]): void {
    const totalValue = transactionData.reduce((sum, item) => sum + Number(item.valor_liquido), 0);
    const avgValue = totalValue / transactionData.length;
    const maxTransaction = Math.max(...transactionData.map(item => Number(item.valor_liquido)));

    const chartContainer = (
      DOMUtils.getElementById('timeSeriesChart') as HTMLCanvasElement | null
    )?.parentElement;
    if (!chartContainer) return;

    let statsDiv = chartContainer.querySelector('.chart-stats') as HTMLElement | null;

    if (!statsDiv) {
      statsDiv = DOMUtils.createElement('div', {
        className: 'chart-stats text-xs text-gray-400 mb-2 flex justify-between',
      });
      chartContainer.insertBefore(statsDiv, chartContainer.firstChild);
    }

    const formatCurrency = (value: number) =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);

    const statsHTML = `
      <div>Total: <span class="text-white font-medium">${formatCurrency(totalValue)}</span></div>
      <div>Média: <span class="text-white font-medium">${formatCurrency(avgValue)}</span></div>
      <div>Maior: <span class="text-white font-medium">${formatCurrency(maxTransaction)}</span></div>
    `;

    DOMUtils.updateContent(statsDiv, statsHTML, true);
  }

  dispose(): void {
    this.hideTooltip();
    this.chartData = null;
  }
}

export default StatisticsCharts;
