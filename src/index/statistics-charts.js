// Statistics and Charts Management
import { APP_CONSTANTS } from '../shared/constants.js';
import { DOMUtils } from '../shared/dom-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';

export class StatisticsCharts {
  constructor() {
    this.chartData = null;
    this.chartTooltip = null;
  }

  /**
   * Update statistics display
   * @param {Array} aggregatedData - Aggregated transaction data
   */
  updateStatistics(aggregatedData) {
    if (!aggregatedData || aggregatedData.length === 0) {
      this.clearStatistics();
      return;
    }

    const deputados = new Set(aggregatedData.map(r => `${r.nome_parlamentar} (${r.sigla_partido})`));
    const fornecedores = new Set(aggregatedData.map(r => r.fornecedor));
    const totalValue = aggregatedData.reduce((sum, r) => sum + Number(r.valor_total), 0);
    const totalTransactions = aggregatedData.reduce((sum, r) => sum + Number(r.num_transacoes), 0);

    DOMUtils.updateContent('totalDeputados', deputados.size.toString(), false);
    DOMUtils.updateContent('totalFornecedores', fornecedores.size.toString(), false);
    DOMUtils.updateContent('totalValue', totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), false);
    DOMUtils.updateContent('totalTransactions', totalTransactions.toLocaleString(), false);

    console.log(`📊 Statistics updated - Deputados: ${deputados.size}, Fornecedores: ${fornecedores.size}, Value: ${totalValue}`);
  }

  /**
   * Update statistics for filtered network data
   * @param {Object} filteredData - Filtered network data
   * @param {Array} originalAggregatedData - Original aggregated data
   */
  updateStatisticsForFilteredData(filteredData, originalAggregatedData) {
    if (!originalAggregatedData || !filteredData) {
      console.log('Missing data for statistics update');
      return;
    }

    console.log('Updating statistics for filtered data - nodes:', filteredData.nodes.length, 'links:', filteredData.links.length);

    // Get the labels of filtered nodes for easier matching
    const filteredDeputados = new Set(
      filteredData.nodes
        .filter(n => n.type === 'deputado')
        .map(n => n.label)
    );
    const filteredFornecedores = new Set(
      filteredData.nodes
        .filter(n => n.type === 'fornecedor')
        .map(n => n.label)
    );

    // Filter aggregated data to only include records where BOTH deputado and fornecedor are in filtered nodes
    const filteredAggregatedData = originalAggregatedData.filter(record => {
      const deputadoLabel = `${record.nome_parlamentar} (${record.sigla_partido})`;
      const fornecedorLabel = record.fornecedor;
      return filteredDeputados.has(deputadoLabel) && filteredFornecedores.has(fornecedorLabel);
    });

    console.log('Filtered aggregated data records:', filteredAggregatedData.length);

    // Update statistics with filtered data
    this.updateStatistics(filteredAggregatedData);

    // Update category pie chart with filtered data
    this.createCategoryPieChart(filteredAggregatedData);
  }

  /**
   * Clear statistics display
   */
  clearStatistics() {
    DOMUtils.updateContent('totalDeputados', '0', false);
    DOMUtils.updateContent('totalFornecedores', '0', false);
    DOMUtils.updateContent('totalValue', 'R$ 0,00', false);
    DOMUtils.updateContent('totalTransactions', '0', false);
  }

  /**
   * Create category pie chart
   * @param {Array} data - Transaction data
   */
  createCategoryPieChart(data) {
    const canvas = DOMUtils.getElementById('categoryPieChart');
    const legend = DOMUtils.getElementById('categoryLegend');

    if (!canvas || !data || data.length === 0) {
      if (legend) {
        DOMUtils.updateContent(legend, '<div class="text-gray-500 text-center">Nenhum dado disponível</div>', true);
      }
      return;
    }

    try {
      const ctx = canvas.getContext('2d');
      const size = 180;
      canvas.width = size;
      canvas.height = size;

      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size / 2 - 10;

      // Calculate category totals
      const categoryTotals = new Map();
      data.forEach(record => {
        const category = record.categoria_despesa || 'Outros';
        const value = Number(record.valor_total) || 0;
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + value);
      });

      // Convert to array and sort by value
      const categoryData = Array.from(categoryTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, APP_CONSTANTS.CHARTS.MAX_PIE_SLICES || 8);

      const total = categoryData.reduce((sum, [, value]) => sum + value, 0);
      if (total === 0) {
        if (legend) {
          DOMUtils.updateContent(legend, '<div class="text-gray-500 text-center">Nenhum dado disponível</div>', true);
        }
        return;
      }

      // Colors for categories
      const colors = [
        '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899',
        '#6366F1', '#EF4444', '#F97316', '#14B8A6', '#06B6D4'
      ];

      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // Draw pie slices
      let currentAngle = -Math.PI / 2; // Start from top
      categoryData.forEach(([category, value], index) => {
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

      // Create legend
      this.createPieChartLegend(categoryData, total, colors, legend);

    } catch (error) {
      ErrorHandler.handleError(error, 'Category Pie Chart Creation');
      if (legend) {
        DOMUtils.updateContent(legend, '<div class="text-red-500 text-center">Erro ao criar gráfico</div>', true);
      }
    }
  }

  /**
   * Create pie chart legend
   * @param {Array} categoryData - Category data array
   * @param {number} total - Total value
   * @param {Array} colors - Color array
   * @param {Element} legend - Legend container element
   */
  createPieChartLegend(categoryData, total, colors, legend) {
    if (!legend) return;

    const formatCurrency = (value) => `R$ ${value.toLocaleString('pt-BR')}`;
    
    const legendHTML = categoryData.map(([category, value], index) => {
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
    }).join('');

    DOMUtils.updateContent(legend, legendHTML, true);
  }

  /**
   * Create time series chart
   * @param {Array} detailsData - Transaction details data
   */
  createTimeSeriesChart(detailsData) {
    const canvas = DOMUtils.getElementById('timeSeriesChart');
    if (!canvas || !detailsData || detailsData.length === 0) {
      this.showChartEmptyState(canvas);
      return;
    }

    try {
      const ctx = canvas.getContext('2d');
      const {width} = canvas;
      const {height} = canvas;
      const padding = 30;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Sort and filter data
      const sortedData = detailsData
        .filter(item => item.data_emissao && Number(item.valor_liquido) > 0)
        .sort((a, b) => new Date(a.data_emissao) - new Date(b.data_emissao));

      if (sortedData.length === 0) {
        this.showChartEmptyState(canvas);
        return;
      }

      // Calculate data ranges
      const firstDate = new Date(sortedData[0].data_emissao);
      const lastDate = new Date(sortedData[sortedData.length - 1].data_emissao);
      const dateRange = lastDate - firstDate || 86400000; // 1 day minimum

      const values = sortedData.map(item => Number(item.valor_liquido));
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const valueRange = maxValue - minValue || 1;

      // Draw chart elements
      this.drawChartGrid(ctx, width, height, padding);
      this.drawChartAxes(ctx, width, height, padding);
      
      const barPositions = this.drawChartBars(ctx, sortedData, width, height, padding, firstDate, lastDate, dateRange, minValue, valueRange);
      this.drawChartLabels(ctx, width, height, padding, firstDate, lastDate, dateRange, minValue, maxValue);

      // Store chart data for interactivity
      this.chartData = { sortedData, canvas, ctx, width, height, padding, barPositions };

      // Display summary statistics
      this.displaySummaryStats(sortedData);

      // Setup interactivity
      this.setupChartInteractivity(canvas);

    } catch (error) {
      ErrorHandler.handleError(error, 'Time Series Chart Creation');
      this.showChartEmptyState(canvas);
    }
  }

  /**
   * Draw chart grid lines
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @param {number} padding - Chart padding
   */
  drawChartGrid(ctx, width, height, padding) {
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);

    // Horizontal grid lines
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

  /**
   * Draw chart axes
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @param {number} padding - Chart padding
   */
  drawChartAxes(ctx, width, height, padding) {
    ctx.strokeStyle = '#6B7280';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Y axis
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    // X axis
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
  }

  /**
   * Draw chart bars
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Array} sortedData - Sorted transaction data
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @param {number} padding - Chart padding
   * @param {Date} firstDate - First date in data
   * @param {Date} lastDate - Last date in data
   * @param {number} dateRange - Date range in milliseconds
   * @param {number} minValue - Minimum value
   * @param {number} valueRange - Value range
   * @returns {Array} Bar positions for interactivity
   */
  drawChartBars(ctx, sortedData, width, height, padding, firstDate, lastDate, dateRange, minValue, valueRange) {
    const availableWidth = width - 2 * padding;
    const barWidth = Math.max(1, Math.min(4, availableWidth / sortedData.length));
    const barPositions = [];

    sortedData.forEach((item, index) => {
      const date = new Date(item.data_emissao);
      const value = Number(item.valor_liquido);

      // Calculate positions
      const x = padding + ((date - firstDate) / dateRange) * (width - 2 * padding);
      const barHeight = ((value - minValue) / valueRange) * (height - 2 * padding);
      const y = height - padding - barHeight;

      // Store position for tooltip
      barPositions.push({
        x: x - barWidth/2,
        y,
        width: barWidth,
        height: barHeight,
        data: {
          date: item.data_emissao,
          totalValue: value,
          count: 1,
          transactions: [item]
        }
      });

      // Create gradient for bars
      const categoryColor = this.getCategoryColor(item.categoria_despesa);
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, categoryColor);
      gradient.addColorStop(1, this.adjustColorBrightness(categoryColor, -20));

      ctx.fillStyle = gradient;
      ctx.fillRect(x - barWidth/2, y, barWidth, barHeight);

      // Add shadow for depth
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 1;
      ctx.fillRect(x - barWidth/2, y, barWidth, barHeight);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    });

    return barPositions;
  }

  /**
   * Draw chart labels
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @param {number} padding - Chart padding
   * @param {Date} firstDate - First date
   * @param {Date} lastDate - Last date
   * @param {number} dateRange - Date range
   * @param {number} minValue - Minimum value
   * @param {number} maxValue - Maximum value
   */
  drawChartLabels(ctx, width, height, padding, firstDate, lastDate, dateRange, minValue, maxValue) {
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    // X-axis labels
    const formatDate = (date) => {
      return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
    };

    ctx.fillText(formatDate(firstDate), padding, height - 10);
    if (dateRange > 86400000) { // More than 1 day
      const middleDate = new Date(firstDate.getTime() + dateRange / 2);
      ctx.fillText(formatDate(middleDate), width / 2, height - 10);
      ctx.fillText(formatDate(lastDate), width - padding, height - 10);
    }

    // Y-axis labels
    ctx.textAlign = 'right';
    const formatCurrency = (value) => {
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

  /**
   * Setup chart interactivity
   * @param {HTMLCanvasElement} canvas - Canvas element
   */
  setupChartInteractivity(canvas) {
    canvas.onmousemove = (event) => this.handleChartHover(event);
    canvas.onmouseout = () => this.hideTooltip();
  }

  /**
   * Handle chart hover events
   * @param {MouseEvent} event - Mouse event
   */
  handleChartHover(event) {
    if (!this.chartData || !this.chartData.barPositions) return;

    const rect = this.chartData.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (this.chartData.canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (this.chartData.canvas.height / rect.height);

    const hoveredBar = this.chartData.barPositions.find(bar => 
      x >= bar.x && x <= bar.x + bar.width && 
      y >= bar.y && y <= bar.y + bar.height
    );

    if (hoveredBar) {
      this.chartData.canvas.style.cursor = 'pointer';
      this.showTooltip(event, hoveredBar.data);
    } else {
      this.chartData.canvas.style.cursor = 'default';
      this.hideTooltip();
    }
  }

  /**
   * Show chart tooltip
   * @param {MouseEvent} event - Mouse event
   * @param {Object} data - Tooltip data
   */
  showTooltip(event, data) {
    this.hideTooltip();

    const tooltip = DOMUtils.createElement('div', {
      style: `
        position: fixed;
        background: rgba(17, 24, 39, 0.95);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 11px;
        pointer-events: none;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(75, 85, 99, 0.3);
        max-width: 200px;
      `
    });

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL', 
      minimumFractionDigits: 2 
    }).format(value);
    
    const formatDate = (dateStr) => new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    }).format(new Date(dateStr));

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

  /**
   * Hide chart tooltip
   */
  hideTooltip() {
    if (this.chartTooltip) {
      this.chartTooltip.remove();
      this.chartTooltip = null;
    }
  }

  /**
   * Get category color
   * @param {string} categoria - Category name
   * @returns {string} Color hex value
   */
  getCategoryColor(categoria) {
    if (!categoria) return '#6B7280';

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
      '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899',
      '#6366F1', '#EF4444', '#F97316', '#14B8A6', '#06B6D4'
    ];

    const colorIndex = Math.abs(hashCode(categoria)) % colors.length;
    return colors[colorIndex];
  }

  /**
   * Adjust color brightness
   * @param {string} color - Hex color
   * @param {number} percent - Brightness adjustment percentage
   * @returns {string} Adjusted color
   */
  adjustColorBrightness(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return `#${(0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)}`;
  }

  /**
   * Show empty state for chart
   * @param {HTMLCanvasElement} canvas - Canvas element
   */
  showChartEmptyState(canvas) {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const {width} = canvas;
    const {height} = canvas;

    ctx.clearRect(0, 0, width, height);

    // Draw empty state
    ctx.fillStyle = '#6B7280';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📊', width / 2, height / 2 - 20);

    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText('Nenhum dado temporal disponível', width / 2, height / 2 + 10);
    ctx.fillText('Transações sem data válida', width / 2, height / 2 + 25);
  }

  /**
   * Display summary statistics for chart
   * @param {Array} transactionData - Transaction data
   */
  displaySummaryStats(transactionData) {
    const totalValue = transactionData.reduce((sum, item) => sum + Number(item.valor_liquido), 0);
    const avgValue = totalValue / transactionData.length;
    const maxTransaction = Math.max(...transactionData.map(item => Number(item.valor_liquido)));

    const chartContainer = DOMUtils.getElementById('timeSeriesChart')?.parentElement;
    if (!chartContainer) return;

    let statsDiv = chartContainer.querySelector('.chart-stats');

    if (!statsDiv) {
      statsDiv = DOMUtils.createElement('div', {
        className: 'chart-stats text-xs text-gray-400 mb-2 flex justify-between'
      });
      chartContainer.insertBefore(statsDiv, chartContainer.firstChild);
    }

    const formatCurrency = (value) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    };

    const statsHTML = `
      <div>Total: <span class="text-white font-medium">${formatCurrency(totalValue)}</span></div>
      <div>Média: <span class="text-white font-medium">${formatCurrency(avgValue)}</span></div>
      <div>Maior: <span class="text-white font-medium">${formatCurrency(maxTransaction)}</span></div>
    `;

    DOMUtils.updateContent(statsDiv, statsHTML, true);
  }

  /**
   * Dispose of charts and cleanup
   */
  dispose() {
    this.hideTooltip();
    this.chartData = null;
  }
}