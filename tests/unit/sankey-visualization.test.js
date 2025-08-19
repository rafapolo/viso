// Tests for unified Sankey Visualization Service
import { SankeyVisualization, createStandaloneSankeyApp, createEmbeddedSankeyTab } from '../../src/services/sankey-visualization.js';

describe('SankeyVisualization', () => {
    let mockContainer;
    let mockDatabaseService;

    beforeEach(() => {
        // Mock D3
        const mockJest = {
            fn: (impl) => {
                const mockFn = impl || (() => {});
                mockFn.mockReturnThis = () => mockFn;
                mockFn.mockReturnValue = (val) => { mockFn._returnValue = val; return mockFn; };
                mockFn.mockResolvedValue = (val) => { mockFn._resolvedValue = val; return mockFn; };
                mockFn.mockRejectedValue = (val) => { mockFn._rejectedValue = val; return mockFn; };
                mockFn.mockImplementation = (impl) => { mockFn._implementation = impl; return mockFn; };
                return mockFn;
            }
        };
        
        global.d3 = {
            scaleOrdinal: mockJest.fn(() => mockJest.fn()),
            schemeCategory10: [],
            schemeSet3: [],
            schemeDark2: [],
            sankey: mockJest.fn(() => ({
                nodeId: mockJest.fn().mockReturnThis(),
                nodeWidth: mockJest.fn().mockReturnThis(),
                nodePadding: mockJest.fn().mockReturnThis(),
                nodeSort: mockJest.fn().mockReturnThis(),
                extent: mockJest.fn().mockReturnThis()
            })),
            sankeyLinkHorizontal: mockJest.fn(),
            select: mockJest.fn(() => ({
                selectAll: mockJest.fn().mockReturnThis(),
                remove: mockJest.fn().mockReturnThis(),
                append: mockJest.fn().mockReturnThis(),
                data: mockJest.fn().mockReturnThis(),
                enter: mockJest.fn().mockReturnThis(),
                attr: mockJest.fn().mockReturnThis(),
                style: mockJest.fn().mockReturnThis(),
                text: mockJest.fn().mockReturnThis(),
                on: mockJest.fn().mockReturnThis()
            }))
        };
        
        // Mock container
        mockContainer = document.createElement('div');
        mockContainer.setAttribute('data-test-container', 'true');
        document.body.appendChild(mockContainer);

        // Mock database service
        mockDatabaseService = {
            ensureConnection: mockJest.fn().mockResolvedValue(true),
            query: mockJest.fn().mockImplementation((sql) => {
                if (sql.includes('SELECT fornecedor')) {
                    return Promise.resolve({
                        toArray: () => [
                            { fornecedor: 'Company A', total_received: 1000 },
                            { fornecedor: 'Company B', total_received: 800 }
                        ]
                    });
                }
                if (sql.includes('SELECT \n                    sigla_partido')) {
                    return Promise.resolve({
                        toArray: () => [
                            {
                                source_party: 'PT',
                                category: 'ALIMENTAÇÃO',
                                supplier: 'Company A',
                                total_value: 500,
                                transaction_count: 10
                            }
                        ]
                    });
                }
                return Promise.resolve({ toArray: () => [] });
            })
        };
    });

    afterEach(() => {
        // Safe container cleanup
        const testContainers = document.querySelectorAll('[data-test-container="true"]');
        testContainers.forEach(container => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        });
    });

    describe('constructor', () => {
        test('should create instance with default options', () => {
            const viz = new SankeyVisualization();
            expect(viz.options.mode).toBe('embedded');
            expect(viz.options.width).toBe(1200);
            expect(viz.options.height).toBe(600);
        });

        test('should merge custom options', () => {
            const viz = new SankeyVisualization({
                width: 800,
                height: 400,
                mode: 'standalone'
            });
            expect(viz.options.width).toBe(800);
            expect(viz.options.height).toBe(400);
            expect(viz.options.mode).toBe('standalone');
        });
    });

    describe('initialize', () => {
        test('should initialize with container and database service', async () => {
            const viz = new SankeyVisualization();
            const result = await viz.initialize(mockContainer, mockDatabaseService);
            
            expect(result).toBe(true);
            expect(viz.container).toBe(mockContainer);
            expect(viz.databaseService).toBe(mockDatabaseService);
        });

        test('should initialize with container selector', async () => {
            mockContainer.id = 'test-container';
            const viz = new SankeyVisualization();
            const result = await viz.initialize('#test-container', mockDatabaseService);
            
            expect(result).toBe(true);
            expect(viz.container).toBe(mockContainer);
        });

        test('should fail with invalid container', async () => {
            const viz = new SankeyVisualization();
            const result = await viz.initialize('#non-existent', mockDatabaseService);
            
            expect(result).toBe(false);
        });

        test('should fail without database service', async () => {
            const viz = new SankeyVisualization();
            const result = await viz.initialize(mockContainer, null);
            
            expect(result).toBe(false);
        });
    });

    describe('setupContainer', () => {
        test('should setup embedded mode container', () => {
            const viz = new SankeyVisualization({ mode: 'embedded', enableHoverPanel: true });
            viz.container = mockContainer;
            viz.setupContainer();
            
            expect(mockContainer.innerHTML).toContain('sankey-visualization');
            expect(mockContainer.innerHTML).toContain('sankey-hover-panel');
            expect(mockContainer.innerHTML).not.toContain('statistics-panel');
        });

        test('should setup standalone mode container', () => {
            const viz = new SankeyVisualization({ 
                mode: 'standalone', 
                enableStatistics: true,
                enableHoverPanel: false 
            });
            viz.container = mockContainer;
            viz.setupContainer();
            
            expect(mockContainer.innerHTML).toContain('sankey-visualization');
            expect(mockContainer.innerHTML).toContain('statistics-panel');
            expect(mockContainer.innerHTML).not.toContain('sankey-hover-panel');
        });
    });

    describe('render', () => {
        test('should render successfully with data', async () => {
            const viz = new SankeyVisualization();
            await viz.initialize(mockContainer, mockDatabaseService);
            
            const result = await viz.render();
            
            expect(result).toBe(true);
            expect(mockDatabaseService.ensureConnection).toHaveBeenCalled();
            expect(mockDatabaseService.query).toHaveBeenCalled();
        });

        test('should handle render errors gracefully', async () => {
            const viz = new SankeyVisualization();
            await viz.initialize(mockContainer, {
                ensureConnection: jest.fn().mockRejectedValue(new Error('DB Error')),
                query: jest.fn()
            });
            
            const result = await viz.render();
            
            expect(result).toBe(false);
            // Check that error was shown in container
            expect(mockContainer.innerHTML).toContain('Erro ao carregar Sankey');
        });
    });

    describe('buildSankeyData', () => {
        test('should build proper data structure', () => {
            const viz = new SankeyVisualization();
            const flowData = [
                {
                    source_party: 'PT',
                    category: 'ALIMENTAÇÃO',
                    supplier: 'Company A',
                    total_value: 1000,
                    transaction_count: 5
                }
            ];

            const { sankeyData, statistics } = viz.buildSankeyData(flowData);

            expect(sankeyData.nodes).toHaveLength(3); // party + category + supplier
            expect(sankeyData.links).toHaveLength(2); // party->category, category->supplier
            expect(statistics.parties).toBe(1);
            expect(statistics.categories).toBe(1);
            expect(statistics.suppliers).toBe(1);
            expect(statistics.totalValue).toBe(1000);
        });
    });

    describe('safeNumber', () => {
        test('should convert BigInt to Number', () => {
            const viz = new SankeyVisualization();
            expect(viz.safeNumber(BigInt(123))).toBe(123);
            expect(viz.safeNumber(456)).toBe(456);
            expect(viz.safeNumber(null)).toBe(0);
            expect(viz.safeNumber(undefined)).toBe(0);
        });
    });

    describe('cleanup', () => {
        test('should cleanup resources', () => {
            const viz = new SankeyVisualization();
            const mockJest = { fn: () => ({ mockReturnThis: () => ({}) }) };
            viz.resizeHandler = mockJest.fn();
            window.removeEventListener = mockJest.fn();
            
            viz.cleanup();
            
            expect(viz.resizeHandler).toBeNull();
            expect(viz.currentFlowData).toBeNull();
            expect(viz.sankeyElements).toBeNull();
        });
    });
});

describe('Factory Functions', () => {
    test('createStandaloneSankeyApp should create standalone instance', () => {
        const app = createStandaloneSankeyApp();
        expect(app.options.mode).toBe('standalone');
        expect(app.options.enableStatistics).toBe(true);
        expect(app.options.enableHoverPanel).toBe(false);
        expect(app.options.enableTooltips).toBe(true);
    });

    test('createEmbeddedSankeyTab should create embedded instance', () => {
        const tab = createEmbeddedSankeyTab();
        expect(tab.options.mode).toBe('embedded');
        expect(tab.options.enableStatistics).toBe(false);
        expect(tab.options.enableHoverPanel).toBe(true);
        expect(tab.options.enableTooltips).toBe(false);
    });

    test('factory functions should accept custom options', () => {
        const app = createStandaloneSankeyApp({ width: 800 });
        expect(app.options.width).toBe(800);
        expect(app.options.mode).toBe('standalone'); // Should preserve mode

        const tab = createEmbeddedSankeyTab({ height: 400 });
        expect(tab.options.height).toBe(400);
        expect(tab.options.mode).toBe('embedded'); // Should preserve mode
    });
});