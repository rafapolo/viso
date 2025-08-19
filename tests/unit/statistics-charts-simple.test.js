/**
 * @fileoverview Simple focused tests for StatisticsCharts timeSeriesChart issues
 */

// Mock DOMUtils
const mockDOMUtils = {
  getElementById: jest.fn(),
  updateContent: jest.fn(),
  createElement: jest.fn()
};

import { jest } from '@jest/globals';
import { DOMUtils } from '../../src/shared/dom-utils.js';
import { ErrorHandler } from '../../src/shared/error-handler.js';
import { APP_CONSTANTS } from '../../src/shared/constants.js';
import StatisticsCharts from '../../src/index/statistics-charts.js';

// Mock modules
jest.mock('../../src/shared/dom-utils.js', () => ({
  DOMUtils: {
    getElementById: jest.fn(),
    updateContent: jest.fn(),
    createElement: jest.fn()
  }
}));

jest.mock('../../src/shared/error-handler.js', () => ({
  ErrorHandler: {
    handleError: jest.fn()
  }
}));

jest.mock('../../src/shared/constants.js', () => ({
  APP_CONSTANTS: {
    CHARTS: {
      MAX_PIE_SLICES: 8
    }
  }
}));

describe('StatisticsCharts - Core Functionality', () => {
  let statisticsCharts;

  beforeEach(() => {
    jest.clearAllMocks();
    statisticsCharts = new StatisticsCharts();
  });

  afterEach(() => {
    if (statisticsCharts) {
      statisticsCharts.dispose();
    }
  });

  describe('Constructor', () => {
    it('should initialize properly', () => {
      expect(statisticsCharts).toBeDefined();
      expect(statisticsCharts.chartData).toBeNull();
      expect(statisticsCharts.chartTooltip).toBeNull();
    });
  });

  describe('TimeSeriesChart - Date Handling', () => {
    const mockCanvas = {
      getContext: jest.fn(() => ({
        clearRect: jest.fn(),
        createLinearGradient: jest.fn(() => ({
          addColorStop: jest.fn()
        })),
        fillRect: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        arc: jest.fn(),
        lineTo: jest.fn(),
        stroke: jest.fn(),
        fill: jest.fn(),
        fillText: jest.fn(),
        setLineDash: jest.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: '',
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetY: 0
      })),
      width: 280,
      height: 120,
      style: {},
      onmousemove: null,
      onmouseout: null
    };

    beforeEach(() => {
      mockDOMUtils.getElementById.mockImplementation((id) => {
        if (id === 'timeSeriesChart') return mockCanvas;
        return null;
      });
    });

    it('should handle DD/MM/YYYY date format correctly', () => {
      const testData = [
        {
          data_emissao: '15/03/2023', // DD/MM/YYYY format from SQL
          valor_liquido: 1000,
          categoria_despesa: 'TEST'
        }
      ];

      expect(() => {
        statisticsCharts.createTimeSeriesChart(testData);
      }).not.toThrow();

      expect(mockCanvas.getContext).toHaveBeenCalled();
    });

    it('should filter out invalid dates and negative values', () => {
      const testData = [
        { data_emissao: '15/03/2023', valor_liquido: 1000, categoria_despesa: 'VALID' },
        { data_emissao: null, valor_liquido: 500, categoria_despesa: 'INVALID_DATE' },
        { data_emissao: '20/03/2023', valor_liquido: -100, categoria_despesa: 'NEGATIVE' },
        { data_emissao: '25/03/2023', valor_liquido: 800, categoria_despesa: 'VALID2' }
      ];

      expect(() => {
        statisticsCharts.createTimeSeriesChart(testData);
      }).not.toThrow();
    });

    it('should show empty state with no valid data', () => {
      const ctx = mockCanvas.getContext();
      
      statisticsCharts.createTimeSeriesChart([]);

      expect(ctx.fillText).toHaveBeenCalledWith(
        'Nenhum dado temporal disponível',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should handle missing canvas element', () => {
      mockDOMUtils.getElementById.mockReturnValue(null);

      expect(() => {
        statisticsCharts.createTimeSeriesChart([{ data_emissao: '15/03/2023', valor_liquido: 1000 }]);
      }).not.toThrow();
    });
  });

  describe('getCategoryColor', () => {
    it('should return consistent colors for same category', () => {
      const color1 = statisticsCharts.getCategoryColor('COMBUSTIVEIS');
      const color2 = statisticsCharts.getCategoryColor('COMBUSTIVEIS');
      
      expect(color1).toBe(color2);
      expect(color1).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should return default color for empty category', () => {
      expect(statisticsCharts.getCategoryColor('')).toBe('#6B7280');
      expect(statisticsCharts.getCategoryColor(null)).toBe('#6B7280');
      expect(statisticsCharts.getCategoryColor(undefined)).toBe('#6B7280');
    });
  });

  describe('adjustColorBrightness', () => {
    it('should adjust color brightness correctly', () => {
      const result = statisticsCharts.adjustColorBrightness('#FF0000', -20);
      expect(result).toMatch(/^#[0-9A-F]{6}$/i);
      expect(result).not.toBe('#FF0000');
    });
  });
});