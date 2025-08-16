// ===== TOOLTIP MANAGER =====
export class TooltipManager {
    constructor() {
        this.tooltip = null;
        this.isVisible = false;
        this.hideTimeout = null;
        this.createTooltip();
    }

    createTooltip() {
        if (document.getElementById('sankey-tooltip')) return;
        
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'sankey-tooltip';
        this.tooltip.className = 'sankey-tooltip';
        this.tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(10px);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            line-height: 1.4;
            max-width: 300px;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            font-family: 'Inter', sans-serif;
        `;
        document.body.appendChild(this.tooltip);
    }

    show(content, x, y) {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        this.tooltip.innerHTML = content;
        
        // Position tooltip
        const rect = this.tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Adjust horizontal position
        let adjustedX = x + 15;
        if (adjustedX + rect.width > viewportWidth - 10) {
            adjustedX = x - rect.width - 15;
        }
        
        // Adjust vertical position  
        let adjustedY = y - 10;
        if (adjustedY + rect.height > viewportHeight - 10) {
            adjustedY = y - rect.height - 10;
        }
        
        this.tooltip.style.left = `${Math.max(10, adjustedX)}px`;
        this.tooltip.style.top = `${Math.max(10, adjustedY)}px`;
        
        // Show with animation
        requestAnimationFrame(() => {
            this.tooltip.style.opacity = '1';
            this.tooltip.style.transform = 'translateY(0)';
            this.isVisible = true;
        });
    }

    hide() {
        if (!this.isVisible) return;
        
        this.tooltip.style.opacity = '0';
        this.tooltip.style.transform = 'translateY(10px)';
        this.isVisible = false;
        
        this.hideTimeout = setTimeout(() => {
            this.tooltip.style.left = '-9999px';
        }, 150);
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    formatNumber(value) {
        return new Intl.NumberFormat('pt-BR').format(value);
    }
}

// ===== QUERY BUILDER =====
export class QueryBuilder {
    constructor(tableName = 'despesas') {
        this.tableName = tableName;
        this.selectFields = ['*'];
        this.whereConditions = [];
        this.orderByFields = [];
        this.groupByFields = [];
        this.havingConditions = [];
        this.limitValue = null;
        this.offsetValue = null;
    }

    select(fields) {
        if (Array.isArray(fields)) {
            this.selectFields = fields;
        } else if (typeof fields === 'string') {
            this.selectFields = [fields];
        }
        return this;
    }

    where(condition, value = null) {
        if (value !== null) {
            this.whereConditions.push(`${condition} = '${this.escapeValue(value)}'`);
        } else {
            this.whereConditions.push(condition);
        }
        return this;
    }

    whereIn(field, values) {
        if (!values.length) return this;
        const escapedValues = values.map(v => `'${this.escapeValue(v)}'`).join(', ');
        this.whereConditions.push(`${field} IN (${escapedValues})`);
        return this;
    }

    whereNotNull(field) {
        this.whereConditions.push(`${field} IS NOT NULL`);
        return this;
    }

    whereGreaterThan(field, value) {
        this.whereConditions.push(`${field} > ${value}`);
        return this;
    }

    whereGreaterThanOrEqual(field, value) {
        this.whereConditions.push(`${field} >= ${value}`);
        return this;
    }

    whereLike(field, pattern) {
        this.whereConditions.push(`LOWER(${field}) LIKE LOWER('%${this.escapeValue(pattern)}%')`);
        return this;
    }

    orderBy(field, direction = 'ASC') {
        this.orderByFields.push(`${field} ${direction.toUpperCase()}`);
        return this;
    }

    groupBy(fields) {
        if (Array.isArray(fields)) {
            this.groupByFields = fields;
        } else {
            this.groupByFields = [fields];
        }
        return this;
    }

    having(condition) {
        this.havingConditions.push(condition);
        return this;
    }

    limit(count) {
        this.limitValue = count;
        return this;
    }

    offset(count) {
        this.offsetValue = count;
        return this;
    }

    escapeValue(value) {
        return String(value).replace(/'/g, "''");
    }

    build() {
        let query = `SELECT ${this.selectFields.join(', ')} FROM ${this.tableName}`;

        if (this.whereConditions.length) {
            query += ` WHERE ${this.whereConditions.join(' AND ')}`;
        }

        if (this.groupByFields.length) {
            query += ` GROUP BY ${this.groupByFields.join(', ')}`;
        }

        if (this.havingConditions.length) {
            query += ` HAVING ${this.havingConditions.join(' AND ')}`;
        }

        if (this.orderByFields.length) {
            query += ` ORDER BY ${this.orderByFields.join(', ')}`;
        }

        if (this.limitValue !== null) {
            query += ` LIMIT ${this.limitValue}`;
        }

        if (this.offsetValue !== null) {
            query += ` OFFSET ${this.offsetValue}`;
        }

        return query;
    }

    clone() {
        const newBuilder = new QueryBuilder(this.tableName);
        newBuilder.selectFields = [...this.selectFields];
        newBuilder.whereConditions = [...this.whereConditions];
        newBuilder.orderByFields = [...this.orderByFields];
        newBuilder.groupByFields = [...this.groupByFields];
        newBuilder.havingConditions = [...this.havingConditions];
        newBuilder.limitValue = this.limitValue;
        newBuilder.offsetValue = this.offsetValue;
        return newBuilder;
    }
}

// ===== QUERY UTILITIES =====
export class QueryUtils {
    static async queryAggregatedData(duckDBManager, filters = {}) {
        const {
            minValue = 0,
            partyFilter = '',
            categoryFilter = '',
            searchFilter = '',
            limit = 1000
        } = filters;

        const query = new QueryBuilder('despesas')
            .select([
                'nome_parlamentar',
                'fornecedor',
                'categoria_despesa',
                'SUM(valor_liquido) as total_value',
                'COUNT(*) as transaction_count',
                'MIN(data_emissao) as first_transaction',
                'MAX(data_emissao) as last_transaction'
            ])
            .whereGreaterThanOrEqual('valor_liquido', minValue);

        if (partyFilter) {
            query.whereLike('nome_parlamentar', partyFilter);
        }

        if (categoryFilter) {
            query.whereLike('categoria_despesa', categoryFilter);
        }

        if (searchFilter) {
            query.where(`(LOWER(nome_parlamentar) LIKE LOWER('%${query.escapeValue(searchFilter)}%') 
                         OR LOWER(fornecedor) LIKE LOWER('%${query.escapeValue(searchFilter)}%'))`);
        }

        query.groupBy(['nome_parlamentar', 'fornecedor', 'categoria_despesa'])
            .orderBy('total_value', 'DESC')
            .limit(limit);

        const result = await duckDBManager.query(query.build());
        const data = result.toArray();
        
        return data.map(item => {
            const converted = {};
            Object.keys(item).forEach(key => {
                converted[key] = typeof item[key] === 'bigint' ? Number(item[key]) : item[key];
            });
            return converted;
        });
    }

    static async getValueRange(duckDBManager, filters = {}) {
        const {
            partyFilter = '',
            categoryFilter = '',
            searchFilter = ''
        } = filters;

        const query = new QueryBuilder('despesas')
            .select(['MIN(valor_liquido) as min_val', 'MAX(valor_liquido) as max_val']);

        if (partyFilter) {
            query.whereLike('nome_parlamentar', partyFilter);
        }

        if (categoryFilter) {
            query.whereLike('categoria_despesa', categoryFilter);
        }

        if (searchFilter) {
            query.where(`(LOWER(nome_parlamentar) LIKE LOWER('%${query.escapeValue(searchFilter)}%') 
                         OR LOWER(fornecedor) LIKE LOWER('%${query.escapeValue(searchFilter)}%'))`);
        }

        const result = await duckDBManager.query(query.build());
        const data = result.toArray()[0];
        return {
            min: data?.min_val || 0,
            max: data?.max_val || 0
        };
    }

    static async getFilterOptions(duckDBManager) {
        const [partiesResult, categoriesResult] = await Promise.all([
            duckDBManager.query(`
                SELECT nome_parlamentar, COUNT(*) as count
                FROM despesas 
                WHERE nome_parlamentar IS NOT NULL 
                GROUP BY nome_parlamentar 
                ORDER BY count DESC 
                LIMIT 100
            `),
            duckDBManager.query(`
                SELECT categoria_despesa, COUNT(*) as count
                FROM despesas 
                WHERE categoria_despesa IS NOT NULL 
                GROUP BY categoria_despesa 
                ORDER BY count DESC 
                LIMIT 50
            `)
        ]);

        return {
            parties: partiesResult.toArray(),
            categories: categoriesResult.toArray()
        };
    }

    static async getEntityDetails(duckDBManager, entityName, entityType) {
        let query;
        
        if (entityType === 'deputy') {
            query = new QueryBuilder('despesas')
                .select([
                    'data_emissao',
                    'categoria_despesa',
                    'fornecedor',
                    'valor_liquido',
                    'subcategoria_despesa'
                ])
                .where('nome_parlamentar', entityName)
                .orderBy('data_emissao', 'DESC')
                .limit(100);
        } else {
            query = new QueryBuilder('despesas')
                .select([
                    'data_emissao',
                    'categoria_despesa',
                    'nome_parlamentar',
                    'valor_liquido',
                    'subcategoria_despesa'
                ])
                .where('fornecedor', entityName)
                .orderBy('data_emissao', 'DESC')
                .limit(100);
        }

        const result = await duckDBManager.query(query.build());
        const rawTransactions = result.toArray();
        
        const transactions = rawTransactions.map(item => {
            const converted = {};
            Object.keys(item).forEach(key => {
                converted[key] = typeof item[key] === 'bigint' ? Number(item[key]) : item[key];
            });
            return converted;
        });

        const totalValue = transactions.reduce((sum, t) => sum + t.valor_liquido, 0);
        const totalTransactions = transactions.length;

        return {
            transactions,
            totalValue,
            totalTransactions,
            entityName,
            entityType
        };
    }

    static async getTimeSeriesData(duckDBManager, entityName, entityType, dateRange = {}) {
        const { startDate, endDate } = dateRange;
        
        const query = new QueryBuilder('despesas')
            .select([
                'DATE_TRUNC(\'month\', data_emissao) as month',
                'SUM(valor_liquido) as total_value',
                'COUNT(*) as transaction_count'
            ]);

        if (entityType === 'deputy') {
            query.where('nome_parlamentar', entityName);
        } else {
            query.where('fornecedor', entityName);
        }

        if (startDate) {
            query.whereGreaterThanOrEqual('data_emissao', `'${startDate}'`);
        }

        if (endDate) {
            query.whereGreaterThanOrEqual('data_emissao', `'${endDate}'`);
        }

        query.groupBy(['DATE_TRUNC(\'month\', data_emissao)'])
            .orderBy('month', 'ASC');

        const result = await duckDBManager.query(query.build());
        return result.toArray();
    }

    static async getCategoryBreakdown(duckDBManager, entityName, entityType) {
        const query = new QueryBuilder('despesas')
            .select([
                'categoria_despesa',
                'SUM(valor_liquido) as total_value',
                'COUNT(*) as transaction_count'
            ]);

        if (entityType === 'deputy') {
            query.where('nome_parlamentar', entityName);
        } else {
            query.where('fornecedor', entityName);
        }

        query.whereNotNull('categoria_despesa')
            .groupBy(['categoria_despesa'])
            .orderBy('total_value', 'DESC');

        const result = await duckDBManager.query(query.build());
        return result.toArray();
    }

    static async executeCustomQuery(duckDBManager, sql, params = {}) {
        let processedSQL = sql;
        
        Object.entries(params).forEach(([key, value]) => {
            const placeholder = new RegExp(`:${key}`, 'g');
            processedSQL = processedSQL.replace(placeholder, `'${String(value).replace(/'/g, "''")}'`);
        });

        try {
            const result = await duckDBManager.query(processedSQL);
            return {
                success: true,
                data: result.toArray(),
                columns: result.schema.fields.map(f => ({
                    name: f.name,
                    type: f.type.toString()
                })),
                query: processedSQL
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                query: processedSQL
            };
        }
    }

    static async getTableSchema(duckDBManager, tableName = 'despesas') {
        try {
            const result = await duckDBManager.query(`DESCRIBE ${tableName}`);
            return result.toArray().map(col => ({
                column_name: col.column_name,
                column_type: col.column_type,
                null: col.null === 'YES'
            }));
        } catch (error) {
            console.error('Error getting table schema:', error);
            return [];
        }
    }

    static buildPaginatedQuery(baseQuery, page = 1, pageSize = 50) {
        const offset = (page - 1) * pageSize;
        return `${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`;
    }

    static buildCountQuery(baseQuery) {
        const fromMatch = baseQuery.match(/FROM\s+(\w+)/i);
        const whereMatch = baseQuery.match(/WHERE\s+(.+?)(?:\s+GROUP BY|\s+ORDER BY|\s+LIMIT|$)/i);
        
        if (!fromMatch) return null;
        
        let countQuery = `SELECT COUNT(*) as total FROM ${fromMatch[1]}`;
        if (whereMatch) {
            countQuery += ` WHERE ${whereMatch[1]}`;
        }
        
        return countQuery;
    }
}

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
            const { APIUtils } = await import('./shared/api-utils.js');

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

export default QueryUtils;