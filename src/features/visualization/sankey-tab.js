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
        container.innerHTML = `
            <div class="sankey-tab flex flex-col h-full">
                <div class="p-4 border-b border-gray-700">
                    <p class="text-sm text-gray-400">Visualização dos fornecedores com mais de 100 registros</p>
                </div>                
                
                <div class="flex-1 flex flex-col bg-gray-900">
                    <div class="flex-1 flex items-center justify-center">
                        <div id="sankey-loading" class="text-center">
                            <div class="loading-spinner mb-4 w-8 h-8 border-4"></div>
                            <div class="text-gray-400">Carregando dados Sankey...</div>
                        </div>
                        <svg id="sankey-svg" width="${this.width}" height="${this.height}" style="display: none;"></svg>
                    </div>
                    
                    <!-- Hover Info Panel -->
                    <div id="sankey-hover-panel" class="hidden border-t border-gray-700 bg-gray-800 p-4">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-sm font-semibold text-gray-200">Informações do Elemento</h3>
                            <button id="close-hover-panel" class="text-gray-400 hover:text-gray-200 text-xs">✕</button>
                        </div>
                        <div id="hover-panel-content" class="text-sm text-gray-300">
                            <div class="text-gray-500">Passe o mouse sobre um elemento no diagrama para ver os detalhes</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Setup close button
        const closeBtn = document.getElementById('close-hover-panel');
        const hoverPanel = document.getElementById('sankey-hover-panel');
        if (closeBtn && hoverPanel) {
            closeBtn.addEventListener('click', () => {
                hoverPanel.classList.add('hidden');
            });
        }

        await this.loadSankeyData();
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

        if (!window.d3Sankey) {
            throw new Error('D3 Sankey library not loaded');
        }

        const svg = d3.select("#sankey-svg");
        svg.selectAll("*").remove();

        const nodes = new Map();
        const links = [];
        const nodeStats = new Map();

        const partyColors = d3.scaleOrdinal(d3.schemeCategory10);
        const categoryColors = d3.scaleOrdinal(d3.schemeSet3);
        const supplierColors = d3.scaleOrdinal(d3.schemeDark2);

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

        const sankey = window.d3Sankey()
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
            .attr("d", window.d3SankeyLinkHorizontal())
            .attr("stroke", "#999")
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

        const panelContent = `
            <div class="mb-3">
                <div class="font-semibold text-duckdb-500 mb-1">Fluxo: ${sourceNode.name} → ${targetNode.name}</div>
                <div class="text-xs text-gray-400">Conexão entre elementos</div>
            </div>
            <div class="grid grid-cols-1 gap-2">
                <div class="flex justify-between items-center py-1 border-b border-gray-700">
                    <span class="text-gray-400">Valor Total:</span>
                    <span class="font-mono text-green-400">${this.tooltipManager.formatCurrency(totalValue)}</span>
                </div>
                <div class="flex justify-between items-center py-1 border-b border-gray-700">
                    <span class="text-gray-400">Transações:</span>
                    <span class="font-mono text-blue-400">${this.tooltipManager.formatNumber(totalTransactions)}</span>
                </div>
                <div class="flex justify-between items-center py-1">
                    <span class="text-gray-400">Valor Médio:</span>
                    <span class="font-mono text-yellow-400">${this.tooltipManager.formatCurrency(totalValue / totalTransactions)}</span>
                </div>
            </div>
        `;

        this.showHoverPanel(panelContent);
        this.highlightElement(linkData, 'link');
    }

    handleLinkOut() {
        this.hoveredElement = null;
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

        const typeColors = {
            'party': 'text-purple-400',
            'category': 'text-blue-400',
            'supplier': 'text-orange-400'
        };

        const panelContent = `
            <div class="mb-3">
                <div class="font-semibold ${typeColors[nodeData.type]} mb-1">${typeLabels[nodeData.type]}: ${nodeData.name}</div>
                <div class="text-xs text-gray-400">Elemento do diagrama</div>
            </div>
            <div class="grid grid-cols-1 gap-2">
                <div class="flex justify-between items-center py-1 border-b border-gray-700">
                    <span class="text-gray-400">Valor Total:</span>
                    <span class="font-mono text-green-400">${this.tooltipManager.formatCurrency(stats.totalValue)}</span>
                </div>
                <div class="flex justify-between items-center py-1 border-b border-gray-700">
                    <span class="text-gray-400">Transações:</span>
                    <span class="font-mono text-blue-400">${this.tooltipManager.formatNumber(stats.transactionCount)}</span>
                </div>
                <div class="flex justify-between items-center py-1">
                    <span class="text-gray-400">Conexões:</span>
                    <span class="font-mono text-yellow-400">${stats.connections.size}</span>
                </div>
            </div>
        `;

        this.showHoverPanel(panelContent);
        this.highlightElement(nodeData, 'node');
    }

    handleNodeOut() {
        this.hoveredElement = null;
        this.removeHighlight();
    }

    handleNodeMove(event, nodeData) {
        // Keep the highlighting active during mouse movement
        if (this.hoveredElement === nodeData) {
            this.highlightElement(nodeData, 'node');
        }
    }

    showHoverPanel(content) {
        const panel = document.getElementById('sankey-hover-panel');
        const panelContent = document.getElementById('hover-panel-content');
        
        if (panel && panelContent) {
            panelContent.innerHTML = content;
            panel.classList.remove('hidden');
        }
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
}