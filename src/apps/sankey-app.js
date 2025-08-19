// Sankey Application Module
import * as duckdb from '../../vendor/js/duckdb-module.js';

class SankeyApp {
    constructor() {
        this.db = null;
        this.conn = null;
        this.width = 1200;
        this.height = 800;
        this.margin = {top: 10, right: 10, bottom: 10, left: 10};
    }

    async initDuckDB() {
        // eslint-disable-next-line no-console
        console.log('🚀 Initializing DuckDB...');
        
        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
        const worker = await duckdb.createWorker(bundle.mainWorker);
        const logger = new duckdb.ConsoleLogger();
        this.db = new duckdb.AsyncDuckDB(logger, worker);
        await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        
        this.conn = await this.db.connect();
        // eslint-disable-next-line no-console
        console.log('✅ DuckDB initialized');
        
        return { db: this.db, conn: this.conn };
    }

    async loadParquetData() {
        try {
            // eslint-disable-next-line no-console
            console.log('📁 Loading parquet file into DuckDB...');
            
            const response = await fetch('./public/despesas.parquet');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            // eslint-disable-next-line no-console
            console.log(`📊 Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
            
            await this.db.registerFileBuffer('despesas.parquet', new Uint8Array(arrayBuffer));
            
            await this.conn.query(`
                CREATE VIEW despesas AS 
                SELECT * FROM read_parquet('despesas.parquet')
            `);
            
            const countResult = await this.conn.query("SELECT COUNT(*) as total FROM despesas");
            const totalRecords = countResult.toArray()[0].total;
            // eslint-disable-next-line no-console
            console.log(`✅ Loaded ${totalRecords.toLocaleString()} records from parquet`);
            
            return totalRecords;
            
        } catch (error) {
            console.error('❌ Error loading parquet:', error);
            throw error;
        }
    }

    async loadData() {
        try {
            document.getElementById('loading').innerHTML = 'Inicializando DuckDB...';
            await this.initDuckDB();
            
            document.getElementById('loading').innerHTML = 'Carregando dados...';
            await this.loadParquetData();
            
            document.getElementById('loading').innerHTML = 'Processando fornecedores...';
            
            // Get top 25 suppliers by total amount received
            const topSuppliersQuery = `
                SELECT fornecedor, SUM(CAST(valor_liquido AS DOUBLE)) as total_received
                FROM despesas 
                WHERE fornecedor IS NOT NULL 
                AND valor_liquido IS NOT NULL
                GROUP BY fornecedor
                ORDER BY total_received DESC
                LIMIT 25
            `;
            
            const topSuppliersResult = await this.conn.query(topSuppliersQuery);
            const topSuppliers = topSuppliersResult.toArray();
            
            // eslint-disable-next-line no-console
            console.log(`Found top 25 suppliers by amount received`);
            
            if (topSuppliers.length === 0) {
                throw new Error('No suppliers found in data');
            }
            
            document.getElementById('loading').innerHTML = 'Executando consulta Sankey...';
            
            // Now get flows only for these top suppliers
            const supplierList = topSuppliers.map(s => `'${s.fornecedor.replace(/'/g, "''")}'`).join(', ');
            
            const flowQuery = `
                SELECT 
                    sigla_partido as source_party,
                    categoria_despesa as category,
                    fornecedor as supplier,
                    SUM(CAST(valor_liquido AS DOUBLE)) as total_value,
                    COUNT(*) as transaction_count
                FROM despesas 
                WHERE fornecedor IN (${supplierList})
                AND sigla_partido IS NOT NULL 
                AND categoria_despesa IS NOT NULL
                AND valor_liquido IS NOT NULL
                GROUP BY sigla_partido, categoria_despesa, fornecedor
                ORDER BY total_value DESC
            `;
            
            const flowResult = await this.conn.query(flowQuery);
            const flowData = flowResult.toArray();
            
            // eslint-disable-next-line no-console
            console.log(`Found ${flowData.length} flow relationships`);
            
            document.getElementById('loading').innerHTML = 'Renderizando diagrama...';
            this.renderSankey(flowData);
            
            document.getElementById('loading').style.display = 'none';
            
        } catch (error) {
            console.error('Error loading data:', error);
            document.getElementById('loading').innerHTML = `Erro: ${error.message}`;
        }
    }

    renderSankey(flowData) {
        const svg = d3.select("#sankey");
        svg.selectAll("*").remove();

        // Build nodes and links
        const nodes = new Map();
        const links = [];

        // Color schemes
        const partyColors = d3.scaleOrdinal(d3.schemeCategory10);
        const categoryColors = d3.scaleOrdinal(d3.schemeSet3);
        const supplierColors = d3.scaleOrdinal(d3.schemeDark2);

        // Statistics for display
        const parties = new Set();
        const categories = new Set();
        const suppliers = new Set();
        let totalValue = 0;

        flowData.forEach(d => {
            const partyId = `party_${d.source_party}`;
            const categoryId = `category_${d.category}`;
            const supplierId = `supplier_${d.supplier}`;

            parties.add(d.source_party);
            categories.add(d.category);
            suppliers.add(d.supplier);
            totalValue += Number(d.total_value);

            // Initialize nodes with their types and colors
            if (!nodes.has(partyId)) {
                nodes.set(partyId, {
                    id: partyId,
                    name: d.source_party,
                    type: 'party',
                    color: partyColors(d.source_party),
                    sortOrder: 0
                });
            }

            if (!nodes.has(categoryId)) {
                nodes.set(categoryId, {
                    id: categoryId,
                    name: d.category,
                    type: 'category',
                    color: categoryColors(d.category),
                    sortOrder: 1
                });
            }

            if (!nodes.has(supplierId)) {
                nodes.set(supplierId, {
                    id: supplierId,
                    name: d.supplier,
                    type: 'supplier',
                    color: supplierColors(d.supplier),
                    sortOrder: 2
                });
            }

            // Create links by splitting the total value
            const linkValue = Number(d.total_value) / 2;
            links.push(
                {
                    source: partyId,
                    target: categoryId,
                    value: linkValue,
                    originalData: d
                },
                {
                    source: categoryId,
                    target: supplierId,
                    value: linkValue,
                    originalData: d
                }
            );
        });

        // Update statistics
        document.getElementById('totalPartidos').textContent = parties.size;
        document.getElementById('totalCategorias').textContent = categories.size;
        document.getElementById('totalFornecedores').textContent = suppliers.size;
        document.getElementById('totalRegistros').textContent = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(totalValue);

        const sankeyData = {
            nodes: Array.from(nodes.values()),
            links
        };

        const sankey = d3.sankey()
            .nodeId(d => d.id)
            .nodeWidth(20)
            .nodePadding(15)
            .nodeSort((a, b) => a.sortOrder - b.sortOrder)
            .extent([[this.margin.left, this.margin.top], [this.width - this.margin.right, this.height - this.margin.bottom]]);

        const sankeyGraph = sankey(sankeyData);

        // Create links
        svg.append("g")
            .selectAll(".link")
            .data(sankeyGraph.links)
            .enter().append("path")
            .attr("class", "link")
            .attr("d", d3.sankeyLinkHorizontal())
            .attr("stroke", d => d.source.color)
            .attr("stroke-width", d => Math.max(1, d.width))
            .attr("stroke-opacity", 0.5)
            .attr("fill", "none")
            .on("mouseover", function(_event, _d) {
                d3.select(this)
                    .attr("stroke-opacity", 0.8);
            })
            .on("mouseout", function(_event, _d) {
                d3.select(this)
                    .attr("stroke-opacity", 0.5);
            });

        // Create nodes
        const nodeGroup = svg.append("g")
            .selectAll(".node")
            .data(sankeyGraph.nodes)
            .enter().append("g")
            .attr("class", "node");

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

        // eslint-disable-next-line no-console
        console.log('✅ Sankey diagram rendered');
    }

    init() {
        this.loadData();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new SankeyApp();
    app.init();
});

export { SankeyApp };