// Unified Sankey Visualization Service
import { TooltipManager } from '../shared/ui-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';
import { FormatUtils } from '../shared/formatters.js';
import { getGlobalLibraryFacade } from './library-facade.js';

/**
 * Unified Sankey Visualization Service
 * Supports both standalone and embedded modes
 */
export class SankeyVisualization {
    constructor(options = {}) {
        // Configuration
        this.options = {
            width: 1200,
            height: 600,
            margin: { top: 10, right: 10, bottom: 10, left: 10 },
            maxSuppliers: 25,
            enableHoverPanel: true,
            enableTooltips: true,
            enableStatistics: true,
            mode: 'embedded', // 'standalone' or 'embedded'
            ...options
        };

        // State
        this.container = null;
        this.currentFlowData = null;
        this.flowDataCache = new Map();
        this.hoveredElement = null;
        this.sankeyElements = null;
        this.resizeHandler = null;

        // Services
        this.tooltipManager = this.options.enableTooltips ? new TooltipManager() : null;
        this.libraryFacade = getGlobalLibraryFacade();
        
        // Database connection (injected)
        this.databaseService = options.databaseService || null;
    }

    /**
     * Initialize the visualization in a container
     * @param {HTMLElement|string} container - Container element or selector
     * @param {Object} databaseService - Database service instance
     */
    async initialize(container, databaseService = null) {
        try {
            // Set container
            this.container = typeof container === 'string' 
                ? document.querySelector(container) 
                : container;
                
            if (!this.container) {
                throw new Error('Container not found');
            }

            // Set database service
            if (databaseService) {
                this.databaseService = databaseService;
            }

            if (!this.databaseService) {
                throw new Error('Database service is required');
            }

            // Setup container HTML
            this.setupContainer();
            
            // Setup resize handling
            this.setupResizeHandler();
            
            return true;
            
        } catch (error) {
            ErrorHandler.handleError(error, 'Sankey Visualization Initialization');
            return false;
        }
    }

    /**
     * Setup the container HTML structure
     */
    setupContainer() {
        const { enableHoverPanel, enableStatistics, mode } = this.options;
        
        let containerHTML = `<div class="sankey-visualization flex flex-col h-full">`;
        
        // Statistics panel (for standalone mode)
        if (enableStatistics && mode === 'standalone') {
            containerHTML += `
                <div class="statistics-panel bg-gray-800 p-4 border-b border-gray-700">
                    <div class="grid grid-cols-4 gap-4 text-center">
                        <div class="bg-gray-700 rounded p-3">
                            <div class="text-2xl font-bold text-blue-400" id="totalPartidos">-</div>
                            <div class="text-xs text-gray-400">Partidos</div>
                        </div>
                        <div class="bg-gray-700 rounded p-3">
                            <div class="text-2xl font-bold text-green-400" id="totalCategorias">-</div>
                            <div class="text-xs text-gray-400">Categorias</div>
                        </div>
                        <div class="bg-gray-700 rounded p-3">
                            <div class="text-2xl font-bold text-yellow-400" id="totalFornecedores">-</div>
                            <div class="text-xs text-gray-400">Fornecedores</div>
                        </div>
                        <div class="bg-gray-700 rounded p-3">
                            <div class="text-2xl font-bold text-purple-400" id="totalRegistros">-</div>
                            <div class="text-xs text-gray-400">Valor Total</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Main visualization area
        containerHTML += `
            <div class="flex-1 flex bg-gray-900 overflow-hidden relative">
                <div id="sankey-loading" class="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div class="text-center">
                        <div class="loading-spinner mb-4 w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <div class="text-gray-400" id="loading-message">Carregando dados...</div>
                    </div>
                </div>
                <svg id="sankey-svg" width="100%" height="100%" style="display: none;"></svg>
            </div>
        `;

        // Hover panel (for embedded mode)
        if (enableHoverPanel && mode === 'embedded') {
            containerHTML += `
                <div id="sankey-hover-panel" class="border-t border-gray-700 bg-gray-800 p-3">
                    <div class="stats-grid text-sm" id="hover-panel-content">
                        <div class="bg-gray-200 dark:bg-gray-700 rounded p-2 border-l-2 border-blue-500">
                            <div class="text-xs font-semibold text-blue-400" id="hover-element-name">Passe o mouse sobre elementos</div>
                            <div class="text-gray-400 text-2xs" id="hover-element-type">Tipo</div>
                        </div>
                        <div class="bg-gray-200 dark:bg-gray-700 rounded p-2 border-l-2 border-green-500">
                            <div class="text-xs font-semibold text-green-400" id="hover-element-value">-</div>
                            <div class="text-gray-400 text-2xs">Valor</div>
                        </div>
                        <div class="bg-gray-200 dark:bg-gray-700 rounded p-2 border-l-2 border-yellow-500">
                            <div class="text-xs font-semibold text-yellow-400" id="hover-element-transactions">-</div>
                            <div class="text-gray-400 text-2xs">Transações</div>
                        </div>
                        <div class="bg-gray-200 dark:bg-gray-700 rounded p-2 border-l-2 border-purple-500">
                            <div class="text-xs font-semibold text-purple-400" id="hover-element-extra">-</div>
                            <div class="text-gray-400 text-2xs" id="hover-element-extra-label">Info</div>
                        </div>
                    </div>
                </div>
            `;
        }

        containerHTML += `</div>`;
        
        this.container.innerHTML = containerHTML;

        // Add CSS for grid layout
        if (enableHoverPanel && mode === 'embedded') {
            const style = document.createElement('style');
            style.textContent = `
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                }
                .text-2xs {
                    font-size: 0.65rem;
                    line-height: 0.75rem;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Load and render Sankey data
     */
    async render() {
        try {
            await this.loadSankeyData();
            return true;
        } catch (error) {
            this.showError(error.message);
            return false;
        }
    }

    /**
     * Load Sankey data from database
     */
    async loadSankeyData() {
        const loadingEl = this.container.querySelector('#sankey-loading');
        const loadingMessage = this.container.querySelector('#loading-message');
        
        try {
            // Ensure database connection
            await this.databaseService.ensureConnection();
            
            loadingMessage.textContent = 'Processando fornecedores...';

            // Get top suppliers
            const topSuppliersQuery = `
                SELECT fornecedor, SUM(CAST(valor_liquido AS DOUBLE)) as total_received
                FROM despesas 
                WHERE fornecedor IS NOT NULL 
                AND valor_liquido IS NOT NULL
                GROUP BY fornecedor
                ORDER BY total_received DESC
                LIMIT ${this.options.maxSuppliers}
            `;

            const topSuppliersResult = await this.databaseService.query(topSuppliersQuery);
            const topSuppliers = topSuppliersResult.toArray().map(row => row.fornecedor);

            if (topSuppliers.length === 0) {
                throw new Error('No suppliers found in data');
            }

            loadingMessage.textContent = 'Executando consulta Sankey...';
            
            // Get flow data for top suppliers
            const flowQuery = `
                SELECT 
                    sigla_partido as source_party,
                    categoria_despesa as category,
                    fornecedor as supplier,
                    SUM(CAST(valor_liquido AS DOUBLE)) as total_value,
                    COUNT(*) as transaction_count
                FROM despesas 
                WHERE fornecedor IN (${topSuppliers.map(s => `'${s.replace(/'/g, "''")}'`).join(', ')})
                AND sigla_partido IS NOT NULL 
                AND categoria_despesa IS NOT NULL
                AND valor_liquido IS NOT NULL
                GROUP BY sigla_partido, categoria_despesa, fornecedor
                ORDER BY total_value DESC
            `;

            const flowResult = await this.databaseService.query(flowQuery);
            const flowData = flowResult.toArray();

            // Cache flow data for tooltips
            this.flowDataCache.clear();
            flowData.forEach(d => {
                const linkKey = `${d.source_party}->${d.category}->${d.supplier}`;
                this.flowDataCache.set(linkKey, d);
            });

            loadingMessage.textContent = 'Renderizando diagrama...';
            
            // Store data for resize handling
            this.currentFlowData = flowData;
            
            await this.renderSankey(flowData);

            // Hide loading, show visualization
            loadingEl.style.display = 'none';
            this.container.querySelector('#sankey-svg').style.display = 'block';

        } catch (error) {
            throw new Error(`Failed to load Sankey data: ${error.message}`);
        }
    }

    /**
     * Render the Sankey diagram
     */
    async renderSankey(flowData) {
        // Check if d3 is available globally first (loaded via script tag)
        let loadedD3 = window.d3;
        
        if (!loadedD3 || !loadedD3.sankey) {
            // Fallback to library facade with retries
            let retries = 5;
            
            while (retries > 0) {
                try {
                    const libraryD3 = await this.libraryFacade.getD3();
                    if (libraryD3 && libraryD3.sankey) {
                        // Use global assignment
                        window.d3 = libraryD3;
                        loadedD3 = libraryD3;
                        break; // Successfully loaded
                    }
                } catch (error) {
                    console.warn('D3 loading attempt failed:', error);
                }
                
                retries--;
                if (retries > 0) {
                    // Wait and retry
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }

        // Final check - also check if d3-sankey might be loaded but not attached yet
        if (!loadedD3 || !loadedD3.sankey) {
            // Wait a bit more for d3-sankey to attach to the global d3
            await new Promise(resolve => setTimeout(resolve, 1000));
            ({ d3: loadedD3 } = { d3: window.d3 });
        }

        if (!loadedD3 || !loadedD3.sankey) {
            throw new Error('D3 Sankey extension not loaded after multiple attempts');
        }

        const svg = loadedD3.select(this.container.querySelector('#sankey-svg'));
        svg.selectAll("*").remove();

        // Calculate dimensions
        const containerRect = this.container.getBoundingClientRect();
        const width = Math.max(800, containerRect.width - 40);
        const height = Math.max(400, containerRect.height - (this.options.enableHoverPanel ? 200 : 100));

        // Build nodes and links with statistics
        const { sankeyData, statistics } = this.buildSankeyData(flowData);

        // Update statistics if in standalone mode
        if (this.options.enableStatistics && this.options.mode === 'standalone') {
            this.updateStatistics(statistics);
        }

        // Create Sankey layout
        const sankey = loadedD3.sankey()
            .nodeId(d => d.id)
            .nodeWidth(20)
            .nodePadding(15)
            .nodeSort((a, b) => a.sortOrder - b.sortOrder)
            .extent([[this.options.margin.left, this.options.margin.top], 
                    [width - this.options.margin.right, height - this.options.margin.bottom]]);

        const sankeyGraph = sankey(sankeyData);

        // Create links
        const linkGroup = svg.append("g")
            .selectAll(".link")
            .data(sankeyGraph.links)
            .enter().append("path")
            .attr("class", "link")
            .attr("d", loadedD3.sankeyLinkHorizontal())
            .attr("stroke", d => d.source.color)
            .attr("stroke-width", d => Math.max(1, d.width))
            .attr("stroke-opacity", 0.5)
            .attr("fill", "none")
            .style("cursor", "pointer");

        // Create nodes
        const nodeGroup = svg.append("g")
            .selectAll(".node")
            .data(sankeyGraph.nodes)
            .enter().append("g")
            .attr("class", "node")
            .style("cursor", "pointer");

        nodeGroup.append("rect")
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0)
            .attr("width", sankey.nodeWidth())
            .attr("fill", d => d.color)
            .attr("stroke", "#000")
            .attr("stroke-width", 1);

        nodeGroup.append("text")
            .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
            .attr("font-size", "12px")
            .attr("fill", "white")
            .text(d => d.name.length > 30 ? `${d.name.substring(0, 30)}...` : d.name);

        // Add interactivity
        this.addInteractivity(linkGroup, nodeGroup, sankeyGraph);

        // Store references
        this.sankeyElements = { svg, linkGroup, nodeGroup };
    }

    /**
     * Build Sankey data structure with statistics
     */
    buildSankeyData(flowData) {
        const loadedD3 = window.d3;
        const nodes = new Map();
        const links = [];
        const nodeStats = new Map();

        // Color schemes
        const partyColors = loadedD3.scaleOrdinal(loadedD3.schemeCategory10);
        const categoryColors = loadedD3.scaleOrdinal(loadedD3.schemeSet3);
        const supplierColors = loadedD3.scaleOrdinal(loadedD3.schemeDark2);

        // Statistics
        const parties = new Set();
        const categories = new Set();
        const suppliers = new Set();
        let totalValue = 0;

        // Build nodes and collect statistics
        flowData.forEach(d => {
            const partyId = `party_${d.source_party}`;
            const categoryId = `category_${d.category}`;
            const supplierId = `supplier_${d.supplier}`;

            parties.add(d.source_party);
            categories.add(d.category);
            suppliers.add(d.supplier);

            const value = this.safeNumber(d.total_value);
            const count = this.safeNumber(d.transaction_count);
            totalValue += value;

            // Initialize nodes
            if (!nodes.has(partyId)) {
                nodes.set(partyId, {
                    id: partyId,
                    name: d.source_party,
                    type: 'party',
                    color: partyColors(d.source_party),
                    sortOrder: 0
                });
                nodeStats.set(partyId, { totalValue: 0, transactionCount: 0, connections: new Set() });
            }

            if (!nodes.has(categoryId)) {
                nodes.set(categoryId, {
                    id: categoryId,
                    name: d.category,
                    type: 'category',
                    color: categoryColors(d.category),
                    sortOrder: 1
                });
                nodeStats.set(categoryId, { totalValue: 0, transactionCount: 0, connections: new Set() });
            }

            if (!nodes.has(supplierId)) {
                nodes.set(supplierId, {
                    id: supplierId,
                    name: d.supplier,
                    type: 'supplier',
                    color: supplierColors(d.supplier),
                    sortOrder: 2
                });
                nodeStats.set(supplierId, { totalValue: 0, transactionCount: 0, connections: new Set() });
            }

            // Update statistics
            nodeStats.get(partyId).totalValue += value;
            nodeStats.get(partyId).transactionCount += count;
            nodeStats.get(partyId).connections.add(supplierId);
            
            nodeStats.get(categoryId).totalValue += value;
            nodeStats.get(categoryId).transactionCount += count;
            nodeStats.get(categoryId).connections.add(partyId).add(supplierId);
            
            nodeStats.get(supplierId).totalValue += value;
            nodeStats.get(supplierId).transactionCount += count;
            nodeStats.get(supplierId).connections.add(partyId);

            // Create links
            const linkValue = value / 2;
            links.push(
                {
                    source: partyId,
                    target: categoryId,
                    value: linkValue,
                    originalData: d,
                    linkId: `${partyId}->${categoryId}`
                },
                {
                    source: categoryId,
                    target: supplierId,
                    value: linkValue,
                    originalData: d,
                    linkId: `${categoryId}->${supplierId}`
                }
            );
        });

        // Consolidate duplicate links
        const linkMap = new Map();
        links.forEach(link => {
            const key = link.linkId;
            if (linkMap.has(key)) {
                const existing = linkMap.get(key);
                existing.value += link.value;
                existing.consolidatedData = existing.consolidatedData || [];
                existing.consolidatedData.push(link.originalData);
            } else {
                linkMap.set(key, { 
                    ...link,
                    consolidatedData: [link.originalData]
                });
            }
        });

        return {
            sankeyData: {
                nodes: Array.from(nodes.values()),
                links: Array.from(linkMap.values())
            },
            statistics: {
                parties: parties.size,
                categories: categories.size,
                suppliers: suppliers.size,
                totalValue
            },
            nodeStats
        };
    }

    /**
     * Add interactivity to the visualization
     */
    addInteractivity(linkGroup, nodeGroup, _sankeyGraph) {
        if (this.options.enableHoverPanel || this.tooltipManager) {
            // Link interactions
            linkGroup
                .on("mouseover", (event, d) => this.handleLinkHover(event, d))
                .on("mouseout", (event, d) => this.handleLinkOut(event, d))
                .on("mousemove", (event, d) => this.handleLinkMove(event, d));

            // Node interactions  
            nodeGroup
                .on("mouseover", (event, d) => this.handleNodeHover(event, d))
                .on("mouseout", (event, d) => this.handleNodeOut(event, d))
                .on("mousemove", (event, d) => this.handleNodeMove(event, d));
        }
    }

    /**
     * Handle link hover events
     */
    handleLinkHover(event, linkData) {
        if (this.hoveredElement === linkData) return;
        this.hoveredElement = linkData;

        const data = linkData.consolidatedData || [linkData.originalData];
        const totalValue = data.reduce((sum, d) => sum + this.safeNumber(d.total_value), 0);
        const totalTransactions = data.reduce((sum, d) => sum + this.safeNumber(d.transaction_count), 0);

        const sourceNode = linkData.source;
        const targetNode = linkData.target;

        if (this.options.enableHoverPanel) {
            this.updateCompactPanel({
                name: `${sourceNode.name} → ${targetNode.name}`,
                type: 'Fluxo',
                value: FormatUtils.formatCurrency(totalValue),
                transactions: FormatUtils.formatNumber(totalTransactions),
                extra: FormatUtils.formatCurrency(totalValue / totalTransactions),
                extraLabel: 'Média'
            });
        }

        if (this.tooltipManager) {
            const content = `
                <strong>${sourceNode.name} → ${targetNode.name}</strong><br>
                <strong>Valor:</strong> ${FormatUtils.formatCurrency(totalValue)}<br>
                <strong>Transações:</strong> ${FormatUtils.formatNumber(totalTransactions)}
            `;
            this.tooltipManager.show(content, event.pageX, event.pageY);
        }

        this.highlightElement(linkData, 'link');
    }

    /**
     * Handle node hover events
     */
    handleNodeHover(event, nodeData) {
        if (this.hoveredElement === nodeData) return;
        this.hoveredElement = nodeData;

        // Get node statistics from the stored data
        const stats = this.getNodeStats(nodeData);

        const typeLabels = {
            'party': 'Partido',
            'category': 'Categoria', 
            'supplier': 'Fornecedor'
        };

        if (this.options.enableHoverPanel) {
            this.updateCompactPanel({
                name: nodeData.name,
                type: typeLabels[nodeData.type],
                value: FormatUtils.formatCurrency(stats.totalValue),
                transactions: FormatUtils.formatNumber(stats.transactionCount),
                extra: stats.connections,
                extraLabel: 'Conexões'
            });
        }

        if (this.tooltipManager) {
            const content = `
                <strong>${nodeData.name}</strong><br>
                <strong>Tipo:</strong> ${typeLabels[nodeData.type]}<br>
                <strong>Valor:</strong> ${FormatUtils.formatCurrency(stats.totalValue)}<br>
                <strong>Conexões:</strong> ${stats.connections}
            `;
            this.tooltipManager.show(content, event.pageX, event.pageY);
        }

        this.highlightElement(nodeData, 'node');
    }

    /**
     * Handle element out events
     */
    handleLinkOut() {
        this.hoveredElement = null;
        this.hideHoverPanel();
        if (this.tooltipManager) this.tooltipManager.hide();
        this.removeHighlight();
    }

    handleNodeOut() {
        this.hoveredElement = null;
        this.hideHoverPanel();
        if (this.tooltipManager) this.tooltipManager.hide();
        this.removeHighlight();
    }

    handleLinkMove(event, linkData) {
        if (this.hoveredElement === linkData && this.tooltipManager) {
            this.tooltipManager.show(this.tooltipManager.tooltip.innerHTML, event.pageX, event.pageY);
        }
    }

    handleNodeMove(event, nodeData) {
        if (this.hoveredElement === nodeData && this.tooltipManager) {
            this.tooltipManager.show(this.tooltipManager.tooltip.innerHTML, event.pageX, event.pageY);
        }
    }

    /**
     * Update compact panel with data
     */
    updateCompactPanel(data) {
        if (!this.options.enableHoverPanel) return;
        
        const nameEl = this.container.querySelector('#hover-element-name');
        const typeEl = this.container.querySelector('#hover-element-type');
        const valueEl = this.container.querySelector('#hover-element-value');
        const transactionsEl = this.container.querySelector('#hover-element-transactions');
        const extraEl = this.container.querySelector('#hover-element-extra');
        const extraLabelEl = this.container.querySelector('#hover-element-extra-label');
        
        if (nameEl && typeEl && valueEl && transactionsEl && extraEl && extraLabelEl) {
            nameEl.textContent = data.name;
            typeEl.textContent = data.type;
            valueEl.textContent = data.value;
            transactionsEl.textContent = data.transactions;
            extraEl.textContent = data.extra;
            extraLabelEl.textContent = data.extraLabel;
        }
    }

    /**
     * Hide hover panel
     */
    hideHoverPanel() {
        if (!this.options.enableHoverPanel) return;
        
        const nameEl = this.container.querySelector('#hover-element-name');
        const typeEl = this.container.querySelector('#hover-element-type');
        const valueEl = this.container.querySelector('#hover-element-value');
        const transactionsEl = this.container.querySelector('#hover-element-transactions');
        const extraEl = this.container.querySelector('#hover-element-extra');
        const extraLabelEl = this.container.querySelector('#hover-element-extra-label');
        
        if (nameEl) nameEl.textContent = 'Passe o mouse sobre elementos';
        if (typeEl) typeEl.textContent = 'Tipo';
        if (valueEl) valueEl.textContent = '-';
        if (transactionsEl) transactionsEl.textContent = '-';
        if (extraEl) extraEl.textContent = '-';
        if (extraLabelEl) extraLabelEl.textContent = 'Info';
    }

    /**
     * Update statistics display
     */
    updateStatistics(stats) {
        const partiesEl = this.container.querySelector('#totalPartidos');
        const categoriesEl = this.container.querySelector('#totalCategorias');
        const suppliersEl = this.container.querySelector('#totalFornecedores');
        const totalEl = this.container.querySelector('#totalRegistros');

        if (partiesEl) partiesEl.textContent = stats.parties;
        if (categoriesEl) categoriesEl.textContent = stats.categories;
        if (suppliersEl) suppliersEl.textContent = stats.suppliers;
        if (totalEl) totalEl.textContent = FormatUtils.formatCurrency(stats.totalValue);
    }

    /**
     * Get node statistics
     */
    getNodeStats(nodeData) {
        // Calculate stats from current flow data
        if (!this.currentFlowData) return { totalValue: 0, transactionCount: 0, connections: 0 };

        let totalValue = 0;
        let transactionCount = 0;
        const connections = new Set();

        this.currentFlowData.forEach(d => {
            const matchesParty = nodeData.type === 'party' && nodeData.name === d.source_party;
            const matchesCategory = nodeData.type === 'category' && nodeData.name === d.category;
            const matchesSupplier = nodeData.type === 'supplier' && nodeData.name === d.supplier;

            if (matchesParty || matchesCategory || matchesSupplier) {
                totalValue += this.safeNumber(d.total_value);
                transactionCount += this.safeNumber(d.transaction_count);
                
                if (matchesParty) {
                    connections.add(d.supplier);
                } else if (matchesSupplier) {
                    connections.add(d.source_party);
                } else {
                    connections.add(d.source_party).add(d.supplier);
                }
            }
        });

        return { totalValue, transactionCount, connections: connections.size };
    }

    /**
     * Highlight element
     */
    highlightElement(elementData, type) {
        if (!this.sankeyElements) return;
        
        const { linkGroup, nodeGroup } = this.sankeyElements;
        
        // Remove existing highlights
        this.removeHighlight();
        
        if (type === 'link') {
            linkGroup.selectAll('path')
                .filter(d => d === elementData)
                .attr('stroke-opacity', 0.8);
        } else if (type === 'node') {
            nodeGroup.selectAll('rect')
                .filter(d => d === elementData)
                .attr('stroke-width', 3)
                .attr('stroke', '#fff');
        }
    }

    /**
     * Remove highlights
     */
    removeHighlight() {
        if (!this.sankeyElements) return;
        
        const { linkGroup, nodeGroup } = this.sankeyElements;
        
        linkGroup.selectAll('path').attr('stroke-opacity', 0.5);
        nodeGroup.selectAll('rect')
            .attr('stroke-width', 1)
            .attr('stroke', '#000');
    }

    /**
     * Setup resize handler
     */
    setupResizeHandler() {
        let resizeTimeout;
        this.resizeHandler = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.currentFlowData && this.container.querySelector('#sankey-svg').style.display !== 'none') {
                    this.renderSankey(this.currentFlowData);
                }
            }, 300);
        };

        window.addEventListener('resize', this.resizeHandler);
    }

    /**
     * Show error message
     */
    showError(message) {
        const loadingEl = this.container.querySelector('#sankey-loading');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="text-red-400 text-center">
                    <div class="text-lg mb-2">❌ Erro ao carregar Sankey</div>
                    <div class="text-sm">${message}</div>
                </div>
            `;
        }
    }

    /**
     * Safe number conversion
     */
    safeNumber(value) {
        return typeof value === 'bigint' ? Number(value) : (value || 0);
    }

    /**
     * Cleanup method
     */
    cleanup() {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
        
        if (this.tooltipManager) {
            this.tooltipManager.hide();
        }
        
        this.flowDataCache.clear();
        this.currentFlowData = null;
        this.sankeyElements = null;
    }

    /**
     * Trigger manual resize
     */
    resize() {
        if (this.resizeHandler) {
            this.resizeHandler();
        }
    }
}

// Factory functions for different modes
export const createStandaloneSankeyApp = (options = {}) => {
    return new SankeyVisualization({
        mode: 'standalone',
        enableStatistics: true,
        enableHoverPanel: false,
        enableTooltips: true,
        ...options
    });
};

export const createEmbeddedSankeyTab = (options = {}) => {
    return new SankeyVisualization({
        mode: 'embedded',
        enableStatistics: false,
        enableHoverPanel: true,
        enableTooltips: false,
        ...options
    });
};