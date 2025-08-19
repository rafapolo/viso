/**
 * @fileoverview Unit tests for StatisticsCharts class
 */

import StatisticsCharts from '../../src/index/statistics-charts.js';

import { jest } from '@jest/globals';
import { DOMUtils } from '../../src/shared/dom-utils.js';
import { ErrorHandler } from '../../src/shared/error-handler.js';
import { APP_CONSTANTS } from '../../src/shared/constants.js';

// Mock DOMUtils
jest.mock('../../src/shared/dom-utils.js', () => ({
  DOMUtils: {
    getElementById: jest.fn(),
    updateContent: jest.fn(),
    createElement: jest.fn()
  }
}));

// Mock ErrorHandler
jest.mock('../../src/shared/error-handler.js', () => ({
  ErrorHandler: {
    handleError: jest.fn()
  }
}));

// Mock APP_CONSTANTS
jest.mock('../../src/shared/constants.js', () => ({
  APP_CONSTANTS: {
    CHARTS: {
      MAX_PIE_SLICES: 8
    }
  }
}));

describe('StatisticsCharts', () => {
  let statisticsCharts;
  let mockCanvas;
  let mockContext;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock canvas and context
    mockContext = {
      clearRect: jest.fn(),
      getContext: jest.fn(),
      createLinearGradient: jest.fn(() => ({
        addColorStop: jest.fn()
      })),
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      arc: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      fillText: jest.fn(),
      setLineDash: jest.fn(),
      lineTo: jest.fn(),
      get fillStyle() { return this._fillStyle; },
      set fillStyle(value) { this._fillStyle = value; },
      get strokeStyle() { return this._strokeStyle; },
      set strokeStyle(value) { this._strokeStyle = value; },
      get lineWidth() { return this._lineWidth; },
      set lineWidth(value) { this._lineWidth = value; },
      get font() { return this._font; },
      set font(value) { this._font = value; },
      get textAlign() { return this._textAlign; },
      set textAlign(value) { this._textAlign = value; },
      get shadowColor() { return this._shadowColor; },
      set shadowColor(value) { this._shadowColor = value; },
      get shadowBlur() { return this._shadowBlur; },
      set shadowBlur(value) { this._shadowBlur = value; },
      get shadowOffsetY() { return this._shadowOffsetY; },
      set shadowOffsetY(value) { this._shadowOffsetY = value; }
    };

    mockCanvas = {
      getContext: jest.fn(() => mockContext),
      getBoundingClientRect: jest.fn(() => ({ left: 0, top: 0, width: 300, height: 120 })),
      width: 300,
      height: 120,
      style: {},
      onmousemove: null,
      onmouseout: null
    };

    statisticsCharts = new StatisticsCharts();

    // Mock document.body for tooltip tests
    global.document = {
      body: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
      },
      createElement: jest.fn(() => ({
        style: {},
        innerHTML: '',
        getBoundingClientRect: jest.fn(() => ({ width: 200, height: 100 })),
        remove: jest.fn()
      }))
    };

    // Mock window
    global.window = {
      innerWidth: 1024,
      innerHeight: 768
    };
  });

  afterEach(() => {
    statisticsCharts.dispose();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(statisticsCharts.chartData).toBeNull();
      expect(statisticsCharts.chartTooltip).toBeNull();
    });
  });

  describe('updateStatistics', () => {
    const mockAggregatedData = [
      {
        nome_parlamentar: 'DEPUTY A',
        sigla_partido: 'PT',
        fornecedor: 'COMPANY A',
        valor_total: 1000,
        num_transacoes: 5
      },
      {
        nome_parlamentar: 'DEPUTY B',
        sigla_partido: 'PSDB',
        fornecedor: 'COMPANY B',
        valor_total: 2000,
        num_transacoes: 3
      }
    ];

    it('should update statistics with valid data', () => {
      DOMUtils.updateContent.mockImplementation(() => {});

      statisticsCharts.updateStatistics(mockAggregatedData);

      // Verify DOMUtils.updateContent was called with correct values
      expect(DOMUtils.updateContent).toHaveBeenCalledWith('totalDeputados', '2', false);
      expect(DOMUtils.updateContent).toHaveBeenCalledWith('totalFornecedores', '2', false);
      expect(DOMUtils.updateContent).toHaveBeenCalledWith('totalValue', '3.000,00', false);
      expect(DOMUtils.updateContent).toHaveBeenCalledWith('totalTransactions', '8', false);
    });

    it('should clear statistics with empty data', () => {
      statisticsCharts.updateStatistics([]);

      expect(DOMUtils.updateContent).toHaveBeenCalledWith('totalDeputados', '0', false);
      expect(DOMUtils.updateContent).toHaveBeenCalledWith('totalFornecedores', '0', false);
      expect(DOMUtils.updateContent).toHaveBeenCalledWith('totalValue', 'R$ 0,00', false);
      expect(DOMUtils.updateContent).toHaveBeenCalledWith('totalTransactions', '0', false);
    });

    it('should handle null data gracefully', () => {
      statisticsCharts.updateStatistics(null);

      expect(DOMUtils.updateContent).toHaveBeenCalledWith('totalDeputados', '0', false);
    });
  });

  describe('createTimeSeriesChart', () => {
    const mockDetailsData = [
      {
        data_emissao: '2023-01-01',
        valor_liquido: 1000,
        categoria_despesa: 'COMBUSTIVEIS'
      },
      {
        data_emissao: '2023-01-02', 
        valor_liquido: 1500,
        categoria_despesa: 'ALIMENTACAO'
      },
      {
        data_emissao: '2023-01-03',
        valor_liquido: 800,
        categoria_despesa: 'TRANSPORTE'
      }
    ];

    beforeEach(() => {
      DOMUtils.getElementById.mockImplementation((id) => {
        if (id === 'timeSeriesChart') {
          return mockCanvas;
        }
        return null;
      });
    });

    it('should create chart with valid data', () => {
      statisticsCharts.createTimeSeriesChart(mockDetailsData);

      // Verify canvas context was obtained
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
      
      // Verify canvas was cleared
      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 300, 120);
      
      // Verify chart elements were drawn
      expect(mockContext.beginPath).toHaveBeenCalled();
      expect(mockContext.fillRect).toHaveBeenCalled();
      expect(mockContext.fillText).toHaveBeenCalled();
    });

    it('should show empty state with no data', () => {
      statisticsCharts.createTimeSeriesChart([]);

      // Should still clear canvas and draw empty state
      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 300, 120);
      expect(mockContext.fillText).toHaveBeenCalledWith('Nenhum dado temporal disponível', 150, 70);
    });

    it('should show empty state with null data', () => {
      statisticsCharts.createTimeSeriesChart(null);

      expect(mockContext.fillText).toHaveBeenCalledWith('Nenhum dado temporal disponível', 150, 70);
    });

    it('should handle missing canvas gracefully', () => {
      DOMUtils.getElementById.mockReturnValue(null);
      
      expect(() => {
        statisticsCharts.createTimeSeriesChart(mockDetailsData);
      }).not.toThrow();
    });

    it('should filter out invalid dates and negative values', () => {
      const mixedData = [
        { data_emissao: '2023-01-01', valor_liquido: 1000, categoria_despesa: 'TEST' },
        { data_emissao: null, valor_liquido: 500, categoria_despesa: 'TEST' }, // Invalid date
        { data_emissao: '2023-01-02', valor_liquido: -100, categoria_despesa: 'TEST' }, // Negative value
        { data_emissao: '2023-01-03', valor_liquido: 800, categoria_despesa: 'TEST' }
      ];

      statisticsCharts.createTimeSeriesChart(mixedData);

      // Should process only valid data (first and last items)
      expect(mockContext.fillRect).toHaveBeenCalled(); // Bars should be drawn
    });

    it('should set up interactivity', () => {
      statisticsCharts.createTimeSeriesChart(mockDetailsData);

      expect(mockCanvas.onmousemove).toEqual(expect.any(Function));
      expect(mockCanvas.onmouseout).toEqual(expect.any(Function));
    });
  });

  describe('getCategoryColor', () => {
    it('should return consistent colors for same category', () => {
      const color1 = statisticsCharts.getCategoryColor('COMBUSTIVEIS');
      const color2 = statisticsCharts.getCategoryColor('COMBUSTIVEIS');
      
      expect(color1).toBe(color2);
      expect(color1).toMatch(/^#[0-9A-F]{6}$/i); // Valid hex color
    });

    it('should return different colors for different categories', () => {
      const color1 = statisticsCharts.getCategoryColor('COMBUSTIVEIS');
      const color2 = statisticsCharts.getCategoryColor('ALIMENTACAO');
      
      expect(color1).not.toBe(color2);
    });

    it('should return default color for null/undefined category', () => {
      expect(statisticsCharts.getCategoryColor(null)).toBe('#6B7280');
      expect(statisticsCharts.getCategoryColor(undefined)).toBe('#6B7280');
      expect(statisticsCharts.getCategoryColor('')).toBe('#6B7280');
    });
  });

  describe('adjustColorBrightness', () => {
    it('should darken color with negative percentage', () => {
      const original = '#FF0000'; // Red
      const darkened = statisticsCharts.adjustColorBrightness(original, -20);
      
      expect(darkened).toMatch(/^#[0-9A-F]{6}$/i);
      expect(darkened).not.toBe(original);
    });

    it('should brighten color with positive percentage', () => {
      const original = '#800000'; // Dark red
      const brightened = statisticsCharts.adjustColorBrightness(original, 20);
      
      expect(brightened).toMatch(/^#[0-9A-F]{6}$/i);
      expect(brightened).not.toBe(original);
    });

    it('should handle edge cases', () => {
      expect(statisticsCharts.adjustColorBrightness('#000000', -50)).toMatch(/^#[0-9A-F]{6}$/i);
      expect(statisticsCharts.adjustColorBrightness('#FFFFFF', 50)).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  describe('handleChartHover', () => {
    beforeEach(() => {
      // Set up chart data
      statisticsCharts.chartData = {
        canvas: mockCanvas,
        barPositions: [
          {
            x: 50, y: 40, width: 4, height: 60,
            data: {
              date: '2023-01-01',
              totalValue: 1000,
              transactions: [{ categoria_despesa: 'TEST', fornecedor: 'Company A' }]
            }
          }
        ]
      };
    });

    it('should show tooltip on bar hover', () => {
      const event = {
        clientX: 52,
        clientY: 50
      };

      statisticsCharts.handleChartHover(event);

      expect(mockCanvas.style.cursor).toBe('pointer');
      expect(global.document.createElement).toHaveBeenCalledWith('div');
    });

    it('should hide tooltip when not hovering over bar', () => {
      const event = {
        clientX: 10, // Outside bar area
        clientY: 10
      };

      statisticsCharts.handleChartHover(event);

      expect(mockCanvas.style.cursor).toBe('default');
    });

    it('should handle missing chart data gracefully', () => {
      statisticsCharts.chartData = null;
      
      const event = { clientX: 50, clientY: 50 };
      
      expect(() => {
        statisticsCharts.handleChartHover(event);
      }).not.toThrow();
    });
  });

  describe('createCategoryPieChart', () => {
    const mockPieData = [
      { categoria_despesa: 'COMBUSTIVEIS', valor_total: 5000 },
      { categoria_despesa: 'ALIMENTACAO', valor_total: 3000 },
      { categoria_despesa: 'TRANSPORTE', valor_total: 2000 }
    ];

    beforeEach(() => {
      const mockLegend = { innerHTML: '' };
      DOMUtils.getElementById.mockImplementation((id) => {
        if (id === 'categoryPieChart') return mockCanvas;
        if (id === 'categoryLegend') return mockLegend;
        return null;
      });
    });

    it('should create pie chart with valid data', () => {
      statisticsCharts.createCategoryPieChart(mockPieData);

      expect(mockContext.arc).toHaveBeenCalled();
      expect(mockContext.fill).toHaveBeenCalled();
    });

    it('should handle empty data gracefully', () => {
      statisticsCharts.createCategoryPieChart([]);

      expect(DOMUtils.updateContent).toHaveBeenCalledWith(
        expect.anything(),
        '<div class="text-gray-500 text-center">Nenhum dado disponível</div>',
        true
      );
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      statisticsCharts.chartTooltip = { remove: jest.fn() };
      statisticsCharts.chartData = { some: 'data' };

      statisticsCharts.dispose();

      expect(statisticsCharts.chartTooltip.remove).toHaveBeenCalled();
      expect(statisticsCharts.chartData).toBeNull();
    });
  });
});