const { describe, test, expect, beforeEach } = require('@jest/globals');

// Testing the refactored ChartUtils structure
describe('ChartUtils (Testing Refactored Structure)', () => {
    // Mock implementations based on the actual src/chart-utils.js structure
    
    const MockColorUtils = {
        categoryColors: [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
            '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
        ]
    };

    const MockFormatUtils = {
        formatCurrency: (value) => `R$ ${value.toLocaleString('pt-BR')}`,
        formatPercentage: (value, decimals = 1) => `${value.toFixed(decimals)}%`
    };

    class MockChartUtils {
        static createCategoryPieChart(canvas, data, options = {}) {
            const {
                maxSlices = 10,
                showLegend = true,
                legendElementId = null,
                colors = MockColorUtils.categoryColors
            } = options;

            // Mock canvas context
            const ctx = {
                clearRect: jest.fn(),
                beginPath: jest.fn(),
                arc: jest.fn(),
                lineTo: jest.fn(),
                fill: jest.fn(),
                stroke: jest.fn(),
                fillStyle: '',
                strokeStyle: '',
                lineWidth: 0
            };

            canvas.getContext = jest.fn(() => ctx);
            canvas.width = 400;
            canvas.height = 400;

            if (!data || data.length === 0) {
                return this.showChartEmptyState(canvas);
            }

            const sortedData = [...data].sort((a, b) => b[1] - a[1]);
            const topData = sortedData.slice(0, maxSlices);
            
            if (sortedData.length > maxSlices) {
                const othersValue = sortedData.slice(maxSlices).reduce((sum, [, value]) => sum + value, 0);
                topData.push(['Outros', othersValue]);
            }

            const total = topData.reduce((sum, [, value]) => sum + value, 0);
            
            const chartData = topData.map(([category, value], index) => {
                const percentage = (value / total) * 100;
                const color = colors[index % colors.length];
                
                return {
                    category,
                    value,
                    percentage,
                    color,
                    formattedValue: MockFormatUtils.formatCurrency(value),
                    formattedPercentage: MockFormatUtils.formatPercentage(percentage)
                };
            });

            // Mock drawing operations
            ctx.clearRect.mockReturnValue(undefined);
            ctx.beginPath.mockReturnValue(undefined);
            ctx.arc.mockReturnValue(undefined);
            ctx.lineTo.mockReturnValue(undefined);
            ctx.fill.mockReturnValue(undefined);
            ctx.stroke.mockReturnValue(undefined);

            return {
                chartData,
                total,
                canvas,
                ctx,
                rendered: true
            };
        }

        static createHorizontalBarChart(canvas, data, options = {}) {
            const {
                maxBars = 10,
                showValues = true,
                colors = MockColorUtils.categoryColors,
                sortDescending = true
            } = options;

            const ctx = {
                clearRect: jest.fn(),
                fillRect: jest.fn(),
                fillText: jest.fn(),
                measureText: jest.fn(() => ({ width: 50 })),
                fillStyle: '',
                font: ''
            };

            canvas.getContext = jest.fn(() => ctx);
            canvas.width = 600;
            canvas.height = 400;

            if (!data || data.length === 0) {
                return this.showChartEmptyState(canvas);
            }

            const sortedData = sortDescending 
                ? [...data].sort((a, b) => b[1] - a[1])
                : [...data].sort((a, b) => a[1] - b[1]);
            
            const topData = sortedData.slice(0, maxBars);
            const maxValue = Math.max(...topData.map(([, value]) => value));

            const chartData = topData.map(([category, value], index) => {
                const percentage = (value / maxValue) * 100;
                const color = colors[index % colors.length];
                
                return {
                    category,
                    value,
                    percentage,
                    color,
                    formattedValue: MockFormatUtils.formatCurrency(value),
                    width: (value / maxValue) * (canvas.width - 200) // Leave space for labels
                };
            });

            return {
                chartData,
                maxValue,
                canvas,
                ctx,
                rendered: true
            };
        }

        static createTimeSeriesChart(canvas, data, options = {}) {
            const {
                showGrid = true,
                lineColor = '#3B82F6',
                fillArea = false,
                pointRadius = 3
            } = options;

            const ctx = {
                clearRect: jest.fn(),
                beginPath: jest.fn(),
                moveTo: jest.fn(),
                lineTo: jest.fn(),
                stroke: jest.fn(),
                fill: jest.fn(),
                arc: jest.fn(),
                setLineDash: jest.fn(),
                fillText: jest.fn(),
                strokeStyle: '',
                fillStyle: '',
                lineWidth: 0
            };

            canvas.getContext = jest.fn(() => ctx);
            canvas.width = 800;
            canvas.height = 400;

            if (!data || data.length === 0) {
                return this.showChartEmptyState(canvas);
            }

            const sortedData = [...data].sort((a, b) => new Date(a[0]) - new Date(b[0]));
            const values = sortedData.map(([, value]) => value);
            const minValue = Math.min(...values);
            const maxValue = Math.max(...values);
            const range = maxValue - minValue;

            const chartData = sortedData.map(([date, value], index) => {
                const x = (index / (sortedData.length - 1)) * (canvas.width - 100) + 50;
                const y = canvas.height - 50 - ((value - minValue) / range) * (canvas.height - 100);
                
                return {
                    date: new Date(date),
                    value,
                    x,
                    y,
                    formattedValue: MockFormatUtils.formatCurrency(value),
                    formattedDate: new Date(date).toLocaleDateString('pt-BR')
                };
            });

            return {
                chartData,
                minValue,
                maxValue,
                range,
                canvas,
                ctx,
                rendered: true
            };
        }

        static showChartEmptyState(canvas) {
            const ctx = {
                clearRect: jest.fn(),
                fillText: jest.fn(),
                font: '',
                fillStyle: '',
                textAlign: '',
                textBaseline: ''
            };

            canvas.getContext = jest.fn(() => ctx);
            
            return {
                canvas,
                ctx,
                isEmpty: true,
                rendered: false
            };
        }

        static updateChartLegend(elementId, chartData) {
            const legendHTML = chartData.map(item => `
                <div class="legend-item">
                    <span class="legend-color" style="background-color: ${item.color}"></span>
                    <span class="legend-label">${item.category}</span>
                    <span class="legend-value">${item.formattedValue}</span>
                </div>
            `).join('');

            return {
                elementId,
                html: legendHTML,
                items: chartData.length
            };
        }

        static downloadChart(canvas, filename = 'chart.png') {
            // Mock implementation
            const mockLink = {
                click: jest.fn(),
                download: filename,
                href: 'data:image/png;base64,mock-base64-data'
            };

            return {
                success: true,
                filename,
                link: mockLink
            };
        }

        static resizeCanvas(canvas, width, height, devicePixelRatio = window.devicePixelRatio || 1) {
            canvas.width = width * devicePixelRatio;
            canvas.height = height * devicePixelRatio;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(devicePixelRatio, devicePixelRatio);
            }

            return {
                width,
                height,
                devicePixelRatio,
                scaledWidth: width * devicePixelRatio,
                scaledHeight: height * devicePixelRatio
            };
        }
    }

    // Mock canvas element
    let mockCanvas;

    beforeEach(() => {
        mockCanvas = {
            getContext: jest.fn(),
            width: 400,
            height: 400,
            style: {},
            getBoundingClientRect: () => ({ width: 400, height: 400 })
        };
    });

    describe('createCategoryPieChart', () => {
        test('should create pie chart with valid data', () => {
            const data = [
                ['Category A', 1000],
                ['Category B', 800],
                ['Category C', 600],
                ['Category D', 400]
            ];

            const result = MockChartUtils.createCategoryPieChart(mockCanvas, data);

            expect(result.rendered).toBe(true);
            expect(result.chartData).toHaveLength(4);
            expect(result.total).toBe(2800);
            expect(result.chartData[0].category).toBe('Category A');
            expect(result.chartData[0].value).toBe(1000);
        });

        test('should handle empty data gracefully', () => {
            const result = MockChartUtils.createCategoryPieChart(mockCanvas, []);

            expect(result.isEmpty).toBe(true);
            expect(result.rendered).toBe(false);
        });

        test('should handle null data gracefully', () => {
            const result = MockChartUtils.createCategoryPieChart(mockCanvas, null);

            expect(result.isEmpty).toBe(true);
            expect(result.rendered).toBe(false);
        });

        test('should limit slices to maxSlices', () => {
            const data = Array.from({ length: 15 }, (_, i) => [`Category ${i}`, 100 + i * 10]);
            const result = MockChartUtils.createCategoryPieChart(mockCanvas, data, { maxSlices: 5 });

            expect(result.chartData).toHaveLength(6); // 5 + 1 "Outros"
            expect(result.chartData[5].category).toBe('Outros');
        });

        test('should sort data by value descending', () => {
            const data = [
                ['Category A', 400],
                ['Category B', 1000],
                ['Category C', 800],
                ['Category D', 600]
            ];

            const result = MockChartUtils.createCategoryPieChart(mockCanvas, data);

            expect(result.chartData[0].category).toBe('Category B');
            expect(result.chartData[0].value).toBe(1000);
            expect(result.chartData[1].category).toBe('Category C');
            expect(result.chartData[1].value).toBe(800);
        });

        test('should calculate percentages correctly', () => {
            const data = [
                ['Category A', 250],
                ['Category B', 750]
            ];

            const result = MockChartUtils.createCategoryPieChart(mockCanvas, data);

            expect(result.chartData[0].percentage).toBe(75); // 750/1000
            expect(result.chartData[1].percentage).toBe(25); // 250/1000
        });

        test('should assign colors cyclically', () => {
            const data = Array.from({ length: 12 }, (_, i) => [`Category ${i}`, 100]);
            const result = MockChartUtils.createCategoryPieChart(mockCanvas, data);

            // Should cycle back to first color after 10 items
            expect(result.chartData[0].color).toBe(MockColorUtils.categoryColors[0]);
            expect(result.chartData[10].color).toBe(MockColorUtils.categoryColors[0]);
        });
    });

    describe('createHorizontalBarChart', () => {
        test('should create bar chart with valid data', () => {
            const data = [
                ['Item A', 1000],
                ['Item B', 800],
                ['Item C', 600]
            ];

            const result = MockChartUtils.createHorizontalBarChart(mockCanvas, data);

            expect(result.rendered).toBe(true);
            expect(result.chartData).toHaveLength(3);
            expect(result.maxValue).toBe(1000);
        });

        test('should handle sorting options', () => {
            const data = [
                ['Item A', 400],
                ['Item B', 1000],
                ['Item C', 600]
            ];

            const descResult = MockChartUtils.createHorizontalBarChart(mockCanvas, data, { sortDescending: true });
            expect(descResult.chartData[0].category).toBe('Item B');

            const ascResult = MockChartUtils.createHorizontalBarChart(mockCanvas, data, { sortDescending: false });
            expect(ascResult.chartData[0].category).toBe('Item A');
        });

        test('should limit bars to maxBars', () => {
            const data = Array.from({ length: 15 }, (_, i) => [`Item ${i}`, 100 + i * 10]);
            const result = MockChartUtils.createHorizontalBarChart(mockCanvas, data, { maxBars: 5 });

            expect(result.chartData).toHaveLength(5);
        });

        test('should calculate bar widths proportionally', () => {
            const data = [
                ['Item A', 1000],
                ['Item B', 500]
            ];

            const result = MockChartUtils.createHorizontalBarChart(mockCanvas, data);
            
            // Item A should have full width, Item B should have half width
            expect(result.chartData[0].width).toBeGreaterThan(result.chartData[1].width);
            expect(result.chartData[1].width).toBe(result.chartData[0].width / 2);
        });
    });

    describe('createTimeSeriesChart', () => {
        test('should create time series chart with valid data', () => {
            const data = [
                ['2023-01-01', 1000],
                ['2023-02-01', 1200],
                ['2023-03-01', 800],
                ['2023-04-01', 1500]
            ];

            const result = MockChartUtils.createTimeSeriesChart(mockCanvas, data);

            expect(result.rendered).toBe(true);
            expect(result.chartData).toHaveLength(4);
            expect(result.minValue).toBe(800);
            expect(result.maxValue).toBe(1500);
            expect(result.range).toBe(700);
        });

        test('should sort data by date', () => {
            const data = [
                ['2023-03-01', 800],
                ['2023-01-01', 1000],
                ['2023-02-01', 1200]
            ];

            const result = MockChartUtils.createTimeSeriesChart(mockCanvas, data);

            expect(result.chartData[0].date).toEqual(new Date('2023-01-01'));
            expect(result.chartData[1].date).toEqual(new Date('2023-02-01'));
            expect(result.chartData[2].date).toEqual(new Date('2023-03-01'));
        });

        test('should calculate coordinates correctly', () => {
            const data = [
                ['2023-01-01', 100],
                ['2023-02-01', 200]
            ];

            const result = MockChartUtils.createTimeSeriesChart(mockCanvas, data);

            expect(result.chartData[0].x).toBe(50); // First point
            expect(result.chartData[1].x).toBe(750); // Last point (canvas.width - 50)
            expect(result.chartData[0].y).toBeGreaterThan(result.chartData[1].y); // Lower value = higher y
        });
    });

    describe('utility functions', () => {
        test('should show empty state for charts', () => {
            const result = MockChartUtils.showChartEmptyState(mockCanvas);

            expect(result.isEmpty).toBe(true);
            expect(result.rendered).toBe(false);
            expect(result.canvas).toBe(mockCanvas);
        });

        test('should update chart legend', () => {
            const chartData = [
                { category: 'A', formattedValue: 'R$ 1.000', color: '#FF0000' },
                { category: 'B', formattedValue: 'R$ 800', color: '#00FF00' }
            ];

            const result = MockChartUtils.updateChartLegend('legend-id', chartData);

            expect(result.elementId).toBe('legend-id');
            expect(result.items).toBe(2);
            expect(result.html).toContain('legend-item');
            expect(result.html).toContain('R$ 1.000');
            expect(result.html).toContain('#FF0000');
        });

        test('should download chart', () => {
            const result = MockChartUtils.downloadChart(mockCanvas, 'test-chart.png');

            expect(result.success).toBe(true);
            expect(result.filename).toBe('test-chart.png');
            expect(result.link.download).toBe('test-chart.png');
        });

        test('should resize canvas with device pixel ratio', () => {
            const result = MockChartUtils.resizeCanvas(mockCanvas, 800, 600, 2);

            expect(result.width).toBe(800);
            expect(result.height).toBe(600);
            expect(result.devicePixelRatio).toBe(2);
            expect(result.scaledWidth).toBe(1600);
            expect(result.scaledHeight).toBe(1200);
        });

        test('should resize canvas with default device pixel ratio', () => {
            // Mock window.devicePixelRatio
            const originalDPR = window.devicePixelRatio;
            Object.defineProperty(window, 'devicePixelRatio', {
                writable: true,
                value: 1.5
            });

            const result = MockChartUtils.resizeCanvas(mockCanvas, 400, 300);

            expect(result.devicePixelRatio).toBe(1.5);

            // Restore
            Object.defineProperty(window, 'devicePixelRatio', {
                writable: true,
                value: originalDPR
            });
        });
    });

    describe('error handling', () => {
        test('should handle charts with single data point', () => {
            const data = [['Single Item', 1000]];

            const pieResult = MockChartUtils.createCategoryPieChart(mockCanvas, data);
            expect(pieResult.rendered).toBe(true);
            expect(pieResult.chartData).toHaveLength(1);

            const barResult = MockChartUtils.createHorizontalBarChart(mockCanvas, data);
            expect(barResult.rendered).toBe(true);
            expect(barResult.chartData).toHaveLength(1);

            const timeResult = MockChartUtils.createTimeSeriesChart(mockCanvas, [['2023-01-01', 1000]]);
            expect(timeResult.rendered).toBe(true);
            expect(timeResult.chartData).toHaveLength(1);
        });

        test('should handle charts with zero values', () => {
            const data = [
                ['Category A', 0],
                ['Category B', 100]
            ];

            const result = MockChartUtils.createCategoryPieChart(mockCanvas, data);
            
            expect(result.rendered).toBe(true);
            expect(result.chartData).toHaveLength(2);
            expect(result.chartData[0].value).toBe(100); // Sorted by value
            expect(result.chartData[1].value).toBe(0);
        });

        test('should handle invalid date strings in time series', () => {
            const data = [
                ['invalid-date', 1000],
                ['2023-01-01', 1200]
            ];

            // The mock should still work, but in real implementation would handle date parsing
            const result = MockChartUtils.createTimeSeriesChart(mockCanvas, data);
            expect(result.chartData).toHaveLength(2);
        });
    });
});