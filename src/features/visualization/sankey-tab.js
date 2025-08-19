import { TooltipManager } from '../../shared/ui-utils.js';

// ===== SANKEY DIAGRAM =====
export class SankeyTab {
    constructor() {
        this.width = 1000;
        this.height = 600;
        this.margin = {top: 10, right: 10, bottom: 10, left: 10};
        this.tooltipManager = new TooltipManager();
        this.flowDataCache = new Map();
        this.hoveredElement = null;
    }

    // Helper method to safely convert BigInt to Number
    safeNumber(value) {
        return typeof value === 'bigint' ? Number(value) : (value || 0);
    }

    async render(container) {
        // Calculate available space for proper sizing
        const containerRect = container.getBoundingClientRect();
        this.width = Math.max(800, containerRect.width - 40); // Leave some margin
        this.height = Math.max(400, containerRect.height - 200); // Account for panels

        container.innerHTML = `
            <div class="sankey-tab flex flex-col h-full">
                
                <div class="flex-1 flex bg-gray-900 overflow-hidden">
                    <div id="sankey-loading" class="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                        <div class="text-center">
                            <div class="loading-spinner mb-4 w-8 h-8 border-4"></div>
                            <div class="text-gray-400">Carregando dados Sankey...</div>
                        </div>
                    </div>
                    <svg id="sankey-svg" width="100%" height="100%" style="display: none;"></svg>
                </div>
                
                <!-- Info Panel - Below D3.js visualization -->
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
            </div>
        `;

        // Setup CSS for stats grid
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

        await this.loadSankeyData();
        
        // Add resize handler
        this.setupResizeHandler();
    }

    setupResizeHandler() {
        // Debounce resize to avoid excessive re-renders
        let resizeTimeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.currentFlowData && document.getElementById('sankey-svg').style.display !== 'none') {
                    this.renderSankey(this.currentFlowData);
                }
            }, 300);
        };

        window.addEventListener('resize', handleResize);
        
        // Store reference for cleanup if needed
        this.resizeHandler = handleResize;
    }

    async loadSankeyData() {
        try {
            const loadingEl = document.getElementById('sankey-loading');
            loadingEl.innerHTML = '<div class="loading-spinner mb-4 w-8 h-8 border-4"></div><div class="text-gray-400">Processando fornecedores...</div>';

            // Import APIUtils dynamically since it may not be available in consolidated structure
            const { APIUtils } = await import('../../shared/api-utils.js');

            const topSuppliersQuery = `
                SELECT fornecedor, SUM(CAST(valor_liquido AS DOUBLE)) as total_received
                FROM despesas 
                WHERE fornecedor IS NOT NULL 
                AND valor_liquido IS NOT NULL
                GROUP BY fornecedor
                ORDER BY total_received DESC
                LIMIT 25
            `;

            loadingEl.innerHTML = '<div class="loading-spinner mb-4 w-8 h-8 border-4"></div><div class="text-gray-400">Executando consulta Sankey...</div>';
            
            const topSuppliersResult = await APIUtils.executeDuckDBQuery(topSuppliersQuery);
            const topSuppliers = topSuppliersResult.data.map(row => row.fornecedor);

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

            const flowResult = await APIUtils.executeDuckDBQuery(flowQuery);
            const flowData = flowResult.data;

            // Cache flow data for tooltips
            this.flowDataCache.clear();
            flowData.forEach(d => {
                const linkKey = `${d.source_party}->${d.category}->${d.supplier}`;
                this.flowDataCache.set(linkKey, d);
            });

            loadingEl.innerHTML = '<div class="loading-spinner mb-4 w-8 h-8 border-4"></div><div class="text-gray-400">Renderizando diagrama...</div>';

            // Store data for resize handling
            this.currentFlowData = flowData;
            
            await this.renderSankey(flowData);

            document.getElementById('sankey-loading').style.display = 'none';
            document.getElementById('sankey-svg').style.display = 'block';

        } catch (error) {
            console.error('Error loading Sankey data:', error);
            document.getElementById('sankey-loading').innerHTML = `
                <div class="text-red-400 text-center">
                    <div class="text-lg mb-2">❌ Erro ao carregar dados Sankey</div>
                    <div class="text-sm">${error.message}</div>
                </div>
            `;
        }
    }

    async renderSankey(flowData) {
        if (!window.d3) {
            throw new Error('D3 library not loaded');
        }

        if (!window.d3.sankey) {
            throw new Error('D3 Sankey extension not loaded');
        }

        const svg = window.d3.select("#sankey-svg");
        svg.selectAll("*").remove();

        // Get actual container dimensions
        const container = document.querySelector('.sankey-tab .flex-1');
        if (container) {
            const rect = container.getBoundingClientRect();
            this.width = rect.width - 20; // Small margin
            this.height = rect.height - 20; // Small margin
        }

        const nodes = new Map();
        const links = [];
        const nodeStats = new Map();

        const partyColors = window.d3.scaleOrdinal(window.d3.schemeCategory10);
        const categoryColors = window.d3.scaleOrdinal(window.d3.schemeSet3);
        const supplierColors = window.d3.scaleOrdinal(window.d3.schemeDark2);

        // Build nodes and collect statistics
        flowData.forEach(d => {
            const partyId = `party_${d.source_party}`;
            const categoryId = `category_${d.category}`;
            const supplierId = `supplier_${d.supplier}`;

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

            // Update statistics - convert BigInt to Number
            const value = this.safeNumber(d.total_value);
            const count = this.safeNumber(d.transaction_count);
            
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

        const sankeyData = {
            nodes: Array.from(nodes.values()),
            links: Array.from(linkMap.values())
        };

        const sankey = window.d3.sankey()
            .nodeId(d => d.id)
            .nodeWidth(20)
            .nodePadding(15)
            .nodeSort((a, b) => a.sortOrder - b.sortOrder)
            .extent([[this.margin.left, this.margin.top], 
                    [this.width - this.margin.right, this.height - this.margin.bottom]]);

        const sankeyGraph = sankey(sankeyData);

        // Create links with enhanced hover
        const linkGroup = svg.append("g")
            .selectAll(".link")
            .data(sankeyGraph.links)
            .enter().append("path")
            .attr("class", "link")
            .attr("d", window.d3.sankeyLinkHorizontal())
            .attr("stroke", d => d.source.color)
            .attr("stroke-width", d => Math.max(1, d.width))
            .attr("stroke-opacity", 0.5)
            .attr("fill", "none")
            .style("cursor", "pointer")
            .on("mouseover", (event, d) => this.handleLinkHover(event, d))
            .on("mouseout", (event, d) => this.handleLinkOut(event, d))
            .on("mousemove", (event, d) => this.handleLinkMove(event, d));

        // Create nodes with enhanced hover
        const nodeGroup = svg.append("g")
            .selectAll(".node")
            .data(sankeyGraph.nodes)
            .enter().append("g")
            .attr("class", "node")
            .style("cursor", "pointer")
            .on("mouseover", (event, d) => this.handleNodeHover(event, d, nodeStats.get(d.id)))
            .on("mouseout", (event, d) => this.handleNodeOut(event, d))
            .on("mousemove", (event, d) => this.handleNodeMove(event, d, nodeStats.get(d.id)));

        nodeGroup.append("rect")
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0)
            .attr("width", sankey.nodeWidth())
            .attr("fill", d => d.color)
            .attr("stroke", "#000")
            .attr("stroke-width", 1);

        nodeGroup.append("text")
            .attr("x", d => d.x0 < this.width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < this.width / 2 ? "start" : "end")
            .attr("font-size", "12px")
            .attr("fill", "white")
            .text(d => d.name.length > 30 ? `${d.name.substring(0, 30)}...` : d.name);

        // Store references for highlighting
        this.sankeyElements = { svg, linkGroup, nodeGroup };
    }

    handleLinkHover(event, linkData) {
        if (this.hoveredElement === linkData) return;
        this.hoveredElement = linkData;

        // Get consolidated data for panel
        const data = linkData.consolidatedData || [linkData.originalData];
        const totalValue = data.reduce((sum, d) => sum + this.safeNumber(d.total_value), 0);
        const totalTransactions = data.reduce((sum, d) => sum + this.safeNumber(d.transaction_count), 0);

        const sourceNode = linkData.source;
        const targetNode = linkData.target;

        this.updateCompactPanel({
            name: `${sourceNode.name} → ${targetNode.name}`,
            type: 'Fluxo',
            value: this.tooltipManager.formatCurrency(totalValue),
            transactions: this.tooltipManager.formatNumber(totalTransactions),
            extra: this.tooltipManager.formatCurrency(totalValue / totalTransactions),
            extraLabel: 'Média'
        });

        this.highlightElement(linkData, 'link');
    }

    handleLinkOut() {
        this.hoveredElement = null;
        this.hideHoverPanel();
        this.removeHighlight();
    }

    handleLinkMove(event, linkData) {
        // Keep the highlighting active during mouse movement
        if (this.hoveredElement === linkData) {
            this.highlightElement(linkData, 'link');
        }
    }

    handleNodeHover(event, nodeData, stats) {
        if (this.hoveredElement === nodeData) return;
        this.hoveredElement = nodeData;

        const typeLabels = {
            'party': 'Partido',
            'category': 'Categoria',
            'supplier': 'Fornecedor'
        };

        this.updateCompactPanel({
            name: nodeData.name,
            type: typeLabels[nodeData.type],
            value: this.tooltipManager.formatCurrency(stats.totalValue),
            transactions: this.tooltipManager.formatNumber(stats.transactionCount),
            extra: stats.connections.size,
            extraLabel: 'Conexões'
        });

        this.highlightElement(nodeData, 'node');
    }

    handleNodeOut() {
        this.hoveredElement = null;
        this.hideHoverPanel();
        this.removeHighlight();
    }

    handleNodeMove(event, nodeData) {
        // Keep the highlighting active during mouse movement
        if (this.hoveredElement === nodeData) {
            this.highlightElement(nodeData, 'node');
        }
    }

    updateCompactPanel(data) {
        const panel = document.getElementById('sankey-hover-panel');
        const nameEl = document.getElementById('hover-element-name');
        const typeEl = document.getElementById('hover-element-type');
        const valueEl = document.getElementById('hover-element-value');
        const transactionsEl = document.getElementById('hover-element-transactions');
        const extraEl = document.getElementById('hover-element-extra');
        const extraLabelEl = document.getElementById('hover-element-extra-label');
        
        if (panel && nameEl && typeEl && valueEl && transactionsEl && extraEl && extraLabelEl) {
            nameEl.textContent = data.name;
            typeEl.textContent = data.type;
            valueEl.textContent = data.value;
            transactionsEl.textContent = data.transactions;
            extraEl.textContent = data.extra;
            extraLabelEl.textContent = data.extraLabel;
            
            // Panel is always visible now, so no need to show/hide
        }
    }

    hideHoverPanel() {
        // Panel is always visible, just reset to default values
        document.getElementById('hover-element-name').textContent = 'Passe o mouse sobre elementos';
        document.getElementById('hover-element-type').textContent = 'Tipo';
        document.getElementById('hover-element-value').textContent = '-';
        document.getElementById('hover-element-transactions').textContent = '-';
        document.getElementById('hover-element-extra').textContent = '-';
        document.getElementById('hover-element-extra-label').textContent = 'Info';
    }

    highlightElement(elementData, type) {
        if (!this.sankeyElements) return;
        
        const { svg, linkGroup, nodeGroup } = this.sankeyElements;
        
        // Remove existing highlights
        this.removeHighlight();
        
        if (type === 'link') {
            // Highlight the specific link
            linkGroup.selectAll('path')
                .filter(d => d === elementData)
                .classed('highlighted', true);
        } else if (type === 'node') {
            // Highlight the specific node
            nodeGroup.selectAll('rect')
                .filter(d => d === elementData)
                .classed('highlighted', true);
        }
        
        // Add highlighting class to container for fade effect
        svg.classed('highlighting', true);
    }

    removeHighlight() {
        if (!this.sankeyElements) return;
        
        const { svg, linkGroup, nodeGroup } = this.sankeyElements;
        
        // Remove all highlights
        linkGroup.selectAll('path').classed('highlighted', false);
        nodeGroup.selectAll('rect').classed('highlighted', false);
        svg.classed('highlighting', false);
    }

    // Cleanup method to remove event listeners
    cleanup() {
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
    }
}