const rawData = [];
let processedData = { nodes: [], links: [] };
const networkFilters = {
    densityMode: false, // Toggleable, uses 20% when enabled
    topExpensesMode: false
};

// Initialize DuckDB and load data
async function loadData() {
    try {
        const progressEl = document.getElementById('loadingProgress');
        
        progressEl.textContent = 'Inicializando DuckDB...';
        await window.duckdbAPI.initDuckDB();
        
        progressEl.textContent = 'Carregando arquivo parquet...';
        const totalRecords = await window.duckdbAPI.loadParquetData();
        
        progressEl.textContent = 'Configurando filtros...';
        await populateFilters();
        
        progressEl.textContent = 'Processando dados...';
        await updateVisualization();
        
        setupEventListeners();
        startConnectionMonitoring();
        
        // Handle URL search parameter after data is loaded
        const urlParams = new URLSearchParams(window.location.search);
        const searchTerm = urlParams.get('busca');
        if (searchTerm) {
            // Set the search box value immediately
            const searchBox = document.getElementById('searchBox');
            if (searchBox) {
                searchBox.value = decodeURIComponent(searchTerm);
                // Show clear button since we have a value
                const clearSearch = document.getElementById('clearSearch');
                if (clearSearch) {
                    clearSearch.classList.remove('hidden');
                }
            }
            // Check for single search result after a short delay
            setTimeout(() => {
                checkForSingleSearchResult(decodeURIComponent(searchTerm));
            }, 500);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
        window.updateConnectionStatus('error', 'Erro de inicialização');
        document.getElementById('loading').innerHTML = `
            <div class="text-red-400">
                <div class="text-lg mb-2">❌ Erro de Conexão</div>
                <div class="text-sm">${error.message}</div>
                <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                    🔄 Tentar Novamente
                </button>
            </div>
        `;
    }
}

// Periodic connection health check
let healthCheckInterval;

function startConnectionMonitoring() {
    // Check connection health every 30 seconds
    healthCheckInterval = setInterval(async () => {
        if (window.getConnectionStatus() === 'connected') {
            const isHealthy = await window.duckdbAPI.checkConnectionHealth();
            if (!isHealthy) {
                console.warn('🔴 Connection lost during health check');
                window.updateConnectionStatus('error', 'Conexão perdida');
            }
        }
    }, 30000);
}

function stopConnectionMonitoring() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
    }
}

window.stopConnectionMonitoring = stopConnectionMonitoring;

async function populateFilters() {
    const { parties, categories } = await window.duckdbAPI.getFilterOptions();
    
    const partySelect = document.getElementById('partyFilter');
    parties.forEach(party => {
        const option = document.createElement('option');
        option.value = party;
        option.textContent = party;
        if (party === 'PT') {
            option.selected = true;
        }
        partySelect.appendChild(option);
    });
    
    const categorySelect = document.getElementById('categoryFilter');
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category.length > 50 ? `${category.substring(0, 47)}...` : category;
        categorySelect.appendChild(option);
    });
}

async function processData() {
    const minValue = parseFloat(document.getElementById('minValue').value) || 0;
    const partyFilter = document.getElementById('partyFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    const searchFilter = document.getElementById('searchBox').value.trim();
    
    console.log(`🔍 Filters - minValue: ${minValue}, party: ${partyFilter}, category: ${categoryFilter}, search: ${searchFilter}`);
    
    // Get the individual transaction value range (not aggregated sums)
    const valueRange = await window.duckdbAPI.getValueRange(partyFilter, categoryFilter, searchFilter);
    const minVal = valueRange.min;
    const maxVal = valueRange.max;
    
    // Update min/max range based on individual transaction values
    if (minVal !== null && maxVal !== null && maxVal > minVal) {
        
        // Update slider range to reflect actual data range
        const slider = document.getElementById('minValue');
        const currentValue = parseInt(slider.value);
        
        // Set slider bounds to actual data range
        // Ensure we have a reasonable range even if min and max are very close
        const rangeMin = Math.max(0, Math.floor(minVal)) || 0;
        const rangeMax = Math.max(Math.ceil(maxVal), rangeMin + 1000); // Ensure at least 1000 range
        
        slider.min = rangeMin;
        slider.max = rangeMax;
        console.log(`🎚️ Slider updated: min=${rangeMin}, max=${rangeMax}`);
        
        // If current slider value is outside the new range, adjust it
        if (currentValue < rangeMin || currentValue > rangeMax) {
            slider.value = rangeMin;
        }
        
        // Update range display to show the actual range of available data
        const formatCurrency = (value) => `R$ ${value.toLocaleString('pt-BR')}`;
        document.getElementById('minRange').textContent = `Min: ${formatCurrency(minVal)}`;
        document.getElementById('maxRange').textContent = `Max: ${formatCurrency(maxVal)}`;
        
        // Update the current value display with the corrected slider value
        const actualMinValue = parseFloat(slider.value) || 0;
        const minValueDisplay = document.getElementById('minValueValue');
        const formatValue = (val) => {
            if (val >= 1000000) return `${(val/1000000).toFixed(1)}M`;
            if (val >= 1000) return `${(val/1000).toFixed(0)}K`;
            return val.toLocaleString('pt-BR');
        };
        minValueDisplay.textContent = formatValue(actualMinValue);
        
        console.log(`📊 Range updated: min=${rangeMin}, max=${rangeMax}, current=${actualMinValue}`);
    } else {
        // No data available - reset to defaults
        const slider = document.getElementById('minValue');
        slider.min = 0;
        slider.max = 100000;
        slider.value = 0;
        document.getElementById('minRange').textContent = 'Min: R$ 0';
        document.getElementById('maxRange').textContent = 'Max: R$ 100.000';
        document.getElementById('minValueValue').textContent = '0';
    }
    
    // Query DuckDB with all filters including the current minimum value
    const actualMinValue = parseFloat(document.getElementById('minValue').value) || 0;
    let aggregatedData = await window.duckdbAPI.queryAggregatedData(actualMinValue, partyFilter, categoryFilter, searchFilter);
    
    // If search filter exists, filter to show only relations of the searched entity
    if (searchFilter) {
        const searchLower = searchFilter.toLowerCase();
        const matchingEntities = new Set();
        
        // Find all entities that match the search term
        aggregatedData.forEach(record => {
            const deputado = `${record.nome_parlamentar} (${record.sigla_partido})`;
            const {fornecedor} = record;
            
            if (deputado.toLowerCase().includes(searchLower)) {
                matchingEntities.add(deputado);
            }
            if (fornecedor.toLowerCase().includes(searchLower)) {
                matchingEntities.add(fornecedor);
            }
        });
        
        // If we found matching entities, filter to show only their relations
        if (matchingEntities.size > 0) {
            aggregatedData = aggregatedData.filter(record => {
                const deputado = `${record.nome_parlamentar} (${record.sigla_partido})`;
                const {fornecedor} = record;
                
                // Show this record if either the deputado or fornecedor is in our matching entities
                return matchingEntities.has(deputado) || matchingEntities.has(fornecedor);
            });
        }
    }
    
    // Create nodes and links with totals
    const nodeMap = new Map();
    const nodeTotals = new Map();
    const nodes = [];
    const links = [];
    
    let nodeId = 0;
    
    // First pass: collect totals for each node
    aggregatedData.forEach(record => {
        const deputado = `${record.nome_parlamentar} (${record.sigla_partido})`;
        const {fornecedor} = record;
        
        // Track deputado totals
        if (!nodeTotals.has(deputado)) {
            nodeTotals.set(deputado, { 
                total: 0, 
                transactions: 0, 
                connections: 0,
                type: 'deputado',
                party: record.sigla_partido 
            });
        }
        const deputadoTotals = nodeTotals.get(deputado);
        deputadoTotals.total += Number(record.valor_total);
        deputadoTotals.transactions += Number(record.num_transacoes);
        deputadoTotals.connections += 1;
        
        // Track fornecedor totals
        if (!nodeTotals.has(fornecedor)) {
            nodeTotals.set(fornecedor, { 
                total: 0, 
                transactions: 0, 
                connections: 0,
                type: 'fornecedor' 
            });
        }
        const fornecedorTotals = nodeTotals.get(fornecedor);
        fornecedorTotals.total += Number(record.valor_total);
        fornecedorTotals.transactions += Number(record.num_transacoes);
        fornecedorTotals.connections += 1;
    });
    
    // Second pass: create nodes and links
    aggregatedData.forEach(record => {
        const deputado = `${record.nome_parlamentar} (${record.sigla_partido})`;
        const {fornecedor} = record;
        
        // Add deputado node
        if (!nodeMap.has(deputado)) {
            const totals = nodeTotals.get(deputado);
            nodeMap.set(deputado, nodeId);
            nodes.push({
                id: nodeId.toString(),
                label: deputado,
                type: 'deputado',
                party: record.sigla_partido,
                totalValue: totals.total,
                totalTransactions: totals.transactions,
                totalConnections: totals.connections,
                size: Math.log(totals.total) * 2
            });
            nodeId++;
        }
        
        // Add fornecedor node
        if (!nodeMap.has(fornecedor)) {
            const totals = nodeTotals.get(fornecedor);
            nodeMap.set(fornecedor, nodeId);
            nodes.push({
                id: nodeId.toString(),
                label: fornecedor,
                type: 'fornecedor',
                totalValue: totals.total,
                totalTransactions: totals.transactions,
                totalConnections: totals.connections,
                size: Math.log(totals.total) * 1.5
            });
            nodeId++;
        }
        
        // Add link
        links.push({
            source: nodeMap.get(deputado).toString(),
            target: nodeMap.get(fornecedor).toString(),
            value: Number(record.valor_total),
            count: Number(record.num_transacoes),
            width: Math.max(1, Math.log(Number(record.valor_total)) * 0.5)
        });
    });
    
    processedData = { nodes, links };
    
    // Update stats
    const deputados = new Set(aggregatedData.map(r => `${r.nome_parlamentar} (${r.sigla_partido})`));
    const fornecedores = new Set(aggregatedData.map(r => r.fornecedor));
    const totalValue = aggregatedData.reduce((sum, r) => sum + Number(r.valor_total), 0);
    const totalTransactions = aggregatedData.reduce((sum, r) => sum + Number(r.num_transacoes), 0);
    
    document.getElementById('totalDeputados').textContent = deputados.size;
    document.getElementById('totalFornecedores').textContent = fornecedores.size;
    document.getElementById('totalValue').textContent = `${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    document.getElementById('totalTransactions').textContent = totalTransactions.toLocaleString();
    
    // Update category pie chart
    createCategoryPieChart(aggregatedData);
    
    // Store aggregatedData for network filtering stats
    window.currentAggregatedData = aggregatedData;
    
    console.log(`Processados ${nodes.length} nós e ${links.length} links`);
}

function calculateNodeDensity(data) {
    const densityScores = new Map();
    
    // Simple connection count method
    data.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source.toString();
        const targetId = typeof link.target === 'object' ? link.target.id : link.target.toString();
        densityScores.set(sourceId, (densityScores.get(sourceId) || 0) + 1);
        densityScores.set(targetId, (densityScores.get(targetId) || 0) + 1);
    });
    
    return densityScores;
}

function filterNodesByDensity(densityScores) {
    // Filter nodes with at least 2 connections
    const filteredScores = [...densityScores.entries()]
        .filter(([nodeId, score]) => score >= 2);
    
    // Sort by density score and take top 20%
    const sortedNodes = filteredScores
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.max(5, Math.floor(filteredScores.length * 0.2))); // Fixed 20%
    
    return new Set(sortedNodes.map(([nodeId]) => nodeId));
}

function updateDensityStats() {
    // Simplified: just log density info for debugging
    if (window.densityInfo) {
        const percentage = ((window.densityInfo.filteredNodes / window.densityInfo.totalNodes) * 100).toFixed(1);
        console.log(`Densidade: ${window.densityInfo.filteredNodes} de ${window.densityInfo.totalNodes} nós (${percentage}%)`);
    }
}

function applyNetworkFilters() {
    if (!processedData.nodes || !processedData.links) return processedData;
    
    let filteredNodes = [...processedData.nodes];
    let filteredLinks = [...processedData.links];
    
    // Apply network density filter (20% when enabled)
    if (networkFilters.densityMode) {
        const densityScores = calculateNodeDensity(processedData);
        const filteredNodeIds = filterNodesByDensity(densityScores);
        
        // Store density info for debugging
        window.densityInfo = {
            totalNodes: processedData.nodes.length,
            filteredNodes: filteredNodeIds.size
        };
        
        filteredNodes = processedData.nodes.filter(node => filteredNodeIds.has(node.id));
        filteredLinks = processedData.links.filter(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source.toString();
            const targetId = typeof link.target === 'object' ? link.target.id : link.target.toString();
            return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId);
        });
        
        console.log(`Densidade 20%: ${filteredNodes.length} nós de ${processedData.nodes.length} (${((filteredNodes.length/processedData.nodes.length)*100).toFixed(1)}%)`);
    }
    
    // Apply top expenses filter
    if (networkFilters.topExpensesMode) {
        // Sort links by value and take top 15
        const topLinks = [...filteredLinks]
            .sort((a, b) => b.value - a.value)
            .slice(0, 15);
        
        // Get nodes involved in top links
        const topNodeIds = new Set();
        topLinks.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source.toString();
            const targetId = typeof link.target === 'object' ? link.target.id : link.target.toString();
            topNodeIds.add(sourceId);
            topNodeIds.add(targetId);
        });
        
        filteredNodes = filteredNodes.filter(node => topNodeIds.has(node.id));
        filteredLinks = topLinks;
    }
    
    return { nodes: filteredNodes, links: filteredLinks };
}

function updateStatisticsForFilteredData(filteredData) {
    if (!window.currentAggregatedData || !filteredData) {
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
    const filteredAggregatedData = window.currentAggregatedData.filter(record => {
        const deputadoLabel = `${record.nome_parlamentar} (${record.sigla_partido})`;
        const fornecedorLabel = record.fornecedor;
        return filteredDeputados.has(deputadoLabel) && filteredFornecedores.has(fornecedorLabel);
    });
    
    console.log('Filtered aggregated data records:', filteredAggregatedData.length);
    
    // Calculate filtered statistics
    const deputados = new Set(filteredAggregatedData.map(r => `${r.nome_parlamentar} (${r.sigla_partido})`));
    const fornecedores = new Set(filteredAggregatedData.map(r => r.fornecedor));
    const totalValue = filteredAggregatedData.reduce((sum, r) => sum + Number(r.valor_total), 0);
    const totalTransactions = filteredAggregatedData.reduce((sum, r) => sum + Number(r.num_transacoes), 0);
    
    // Update statistics display
    document.getElementById('totalDeputados').textContent = deputados.size;
    document.getElementById('totalFornecedores').textContent = fornecedores.size;
    document.getElementById('totalValue').textContent = `${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    document.getElementById('totalTransactions').textContent = totalTransactions.toLocaleString();
    
    console.log('Updated stats - Deputados:', deputados.size, 'Fornecedores:', fornecedores.size, 'Value:', totalValue);
    
    // Update category pie chart with filtered data
    createCategoryPieChart(filteredAggregatedData);
}

function createCategoryPieChart(data) {
    const canvas = document.getElementById('categoryPieChart');
    const legend = document.getElementById('categoryLegend');
    
    if (!canvas || !data || data.length === 0) {
        legend.innerHTML = '<div class="text-gray-500 text-center">Nenhum dado disponível</div>';
        return;
    }
    
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
        .slice(0, 8); // Show top 8 categories
    
    const total = categoryData.reduce((sum, [, value]) => sum + value, 0);
    if (total === 0) {
        legend.innerHTML = '<div class="text-gray-500 text-center">Nenhum dado disponível</div>';
        return;
    }
    
    // Colors for categories (same as badges)
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
    const formatCurrency = (value) => `R$ ${value.toLocaleString('pt-BR')}`;
    legend.innerHTML = categoryData.map(([category, value], index) => {
        const percentage = ((value / total) * 100).toFixed(1);
        const color = colors[index % colors.length];
        const shortCategory = category;
        
        return `
            <div class="flex items-center gap-2 py-1" title="${category}">
                <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${color}"></div>
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium truncate">${shortCategory}</div>
                    <div class="text-xs text-gray-500">${formatCurrency(value)} (${percentage}%)</div>
                </div>
            </div>
        `;
    }).join('');
}

// Global variables for chart interactivity
let chartData = null;
let chartTooltip = null;

function createTimeSeriesChart(detailsData) {
    const canvas = document.getElementById('timeSeriesChart');
    if (!canvas || !detailsData || detailsData.length === 0) {
        showChartEmptyState(canvas);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const {width} = canvas;
    const {height} = canvas;
    const padding = 30;
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, width, height);
    
    // Sort all transactions by date and filter out negative values
    const sortedData = detailsData
        .filter(item => item.data_emissao && Number(item.valor_liquido) > 0)
        .sort((a, b) => new Date(a.data_emissao) - new Date(b.data_emissao));
    
    if (sortedData.length === 0) {
        showChartEmptyState(canvas);
        return;
    }
    
    // Get date range and value range
    const firstDate = new Date(sortedData[0].data_emissao);
    const lastDate = new Date(sortedData[sortedData.length - 1].data_emissao);
    const dateRange = lastDate - firstDate || 86400000; // 1 day minimum
    
    const values = sortedData.map(item => Number(item.valor_liquido));
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const valueRange = maxValue - minValue || 1;
    
    // Draw grid lines
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
    
    // Draw axes
    ctx.strokeStyle = '#6B7280';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Y axis
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    // X axis
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Calculate bar width based on number of transactions and available space
    const availableWidth = width - 2 * padding;
    const barWidth = Math.max(1, Math.min(4, availableWidth / sortedData.length));
    
    // Store bar positions for tooltip interaction
    const barPositions = [];
    
    // Draw transaction bars with gradient and improved visuals
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
        
        // Create gradient for bars based on expense category
        const categoryColor = getCategoryColor(item.categoria_despesa);
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, categoryColor);
        gradient.addColorStop(1, adjustColorBrightness(categoryColor, -20));
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x - barWidth/2, y, barWidth, barHeight);
        
        // Add subtle shadow for depth
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetY = 1;
        ctx.fillRect(x - barWidth/2, y, barWidth, barHeight);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
    });
    
    // Store bar positions globally for interactivity
    chartData = { sortedData, canvas, ctx, width, height, padding, barPositions };
    
    // Draw labels
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    
    // X-axis labels (first, middle, last dates)
    const formatDate = (date) => {
        return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
    };
    
    ctx.fillText(formatDate(firstDate), padding, height - 10);
    if (dateRange > 86400000) { // More than 1 day
        const middleDate = new Date(firstDate.getTime() + dateRange / 2);
        ctx.fillText(formatDate(middleDate), width / 2, height - 10);
        ctx.fillText(formatDate(lastDate), width - padding, height - 10);
    }
    
    // Enhanced Y-axis labels
    ctx.textAlign = 'right';
    const formatCurrency = (value) => {
        if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
        return `R$ ${value.toFixed(0)}`;
    };
    
    // Multiple Y-axis labels along grid lines
    const labelSteps = 4;
    for (let i = 0; i <= labelSteps; i++) {
        const value = minValue + (maxValue - minValue) * (1 - i / labelSteps);
        const y = padding + (i / labelSteps) * (height - 2 * padding);
        ctx.fillText(formatCurrency(value), padding - 8, y + 3);
    }
    
    // Display summary statistics
    displaySummaryStats(sortedData);
    
    // Setup interactivity
    setupChartInteractivity(canvas);
}

function setupChartInteractivity(canvas) {
    canvas.onmousemove = handleChartHover;
    canvas.onmouseout = hideTooltip;
}

function handleChartHover(event) {
    if (!chartData || !chartData.barPositions) return;
    
    const rect = chartData.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (chartData.canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (chartData.canvas.height / rect.height);
    
    const hoveredBar = chartData.barPositions.find(bar => 
        x >= bar.x && x <= bar.x + bar.width && 
        y >= bar.y && y <= bar.y + bar.height
    );
    
    if (hoveredBar) {
        chartData.canvas.style.cursor = 'pointer';
        showTooltip(event, hoveredBar.data);
    } else {
        chartData.canvas.style.cursor = 'default';
        hideTooltip();
    }
}

function showTooltip(event, data) {
    hideTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
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
    `;
    
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
    const formatDate = (dateStr) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateStr));
    
    const transaction = data.transactions[0];
    tooltip.innerHTML = `
        <div class="font-medium text-blue-300 mb-1">${formatDate(data.date)}</div>
        <div>Valor: <span class="font-bold">${formatCurrency(data.totalValue)}</span></div>
        ${transaction.categoria_despesa ? `<div class="text-xs text-gray-300 mt-1">📋 ${transaction.categoria_despesa}</div>` : ''}
        ${transaction.fornecedor ? `<div class="text-xs text-gray-300 mt-1">→ ${transaction.fornecedor}</div>` : ''}
        ${transaction.nome_parlamentar ? `<div class="text-xs text-gray-300 mt-1">← ${transaction.nome_parlamentar}</div>` : ''}
    `;
    
    document.body.appendChild(tooltip);
    chartTooltip = tooltip;
    
    const rect = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.min(event.clientX + 10, window.innerWidth - rect.width - 10)}px`;
    tooltip.style.top = `${Math.max(event.clientY - rect.height - 10, 10)}px`;
}

function hideTooltip() {
    if (chartTooltip) {
        chartTooltip.remove();
        chartTooltip = null;
    }
}

function getCategoryColor(categoria) {
    if (!categoria) return '#6B7280'; // Default gray
    
    // Hash function to generate consistent colors for categories (same as getCategoryBadge)
    const hashCode = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    };
    
    // Color palette matching the category badges (hex equivalents for dark theme)
    const colors = [
        '#3B82F6', // blue
        '#10B981', // green  
        '#8B5CF6', // purple
        '#F59E0B', // yellow
        '#EC4899', // pink
        '#6366F1', // indigo
        '#EF4444', // red
        '#F97316', // orange
        '#14B8A6', // teal
        '#06B6D4'  // cyan
    ];
    
    const colorIndex = Math.abs(hashCode(categoria)) % colors.length;
    return colors[colorIndex];
}

function adjustColorBrightness(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return `#${(0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)}`;
}

function showChartEmptyState(canvas) {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const {width} = canvas;
    const {height} = canvas;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw empty state with icon
    ctx.fillStyle = '#6B7280';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📊', width / 2, height / 2 - 20);
    
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText('Nenhum dado temporal disponível', width / 2, height / 2 + 10);
    ctx.fillText('Transações sem data válida', width / 2, height / 2 + 25);
}

function displaySummaryStats(transactionData) {
    const totalValue = transactionData.reduce((sum, item) => sum + Number(item.valor_liquido), 0);
    const avgValue = totalValue / transactionData.length;
    const maxTransaction = Math.max(...transactionData.map(item => Number(item.valor_liquido)));
    
    // Find the chart container and add stats
    const chartContainer = document.querySelector('#timeSeriesChart').parentElement;
    let statsDiv = chartContainer.querySelector('.chart-stats');
    
    if (!statsDiv) {
        statsDiv = document.createElement('div');
        statsDiv.className = 'chart-stats text-xs text-gray-400 mb-2 flex justify-between';
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
    
    statsDiv.innerHTML = `
        <div>Total: <span class="text-white font-medium">${formatCurrency(totalValue)}</span></div>
        <div>Média: <span class="text-white font-medium">${formatCurrency(avgValue)}</span></div>
        <div>Maior: <span class="text-white font-medium">${formatCurrency(maxTransaction)}</span></div>
    `;
}

function initializeVisualization() {
    // Clear loading message
    const loadingEl = document.querySelector('#loading');
    if (loadingEl) loadingEl.style.display = 'none';
    
    // Apply network filters and get filtered data
    const filteredData = applyNetworkFilters();
    
    // Update statistics based on filtered data
    if (networkFilters.densityMode || networkFilters.topExpensesMode) {
        updateStatisticsForFilteredData(filteredData);
    } else if (window.currentAggregatedData) {
        // Restore original statistics when no network filters are active
        const deputados = new Set(window.currentAggregatedData.map(r => `${r.nome_parlamentar} (${r.sigla_partido})`));
        const fornecedores = new Set(window.currentAggregatedData.map(r => r.fornecedor));
        const totalValue = window.currentAggregatedData.reduce((sum, r) => sum + Number(r.valor_total), 0);
        const totalTransactions = window.currentAggregatedData.reduce((sum, r) => sum + Number(r.num_transacoes), 0);
        
        document.getElementById('totalDeputados').textContent = deputados.size;
        document.getElementById('totalFornecedores').textContent = fornecedores.size;
        document.getElementById('totalValue').textContent = `${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        document.getElementById('totalTransactions').textContent = totalTransactions.toLocaleString();
        
        createCategoryPieChart(window.currentAggregatedData);
    }
    
    // Check if we have data to visualize
    if (!filteredData.nodes || filteredData.nodes.length === 0) {
        console.log('Nenhum dado para visualizar');
        if (loadingEl) {
            loadingEl.style.display = 'flex';
            loadingEl.innerHTML = 'Nenhum dado encontrado com os filtros aplicados';
        }
        return;
    }
    
    console.log('🎨 Criando visualização D3.js...');
    
    const svg = d3.select("#network-svg");
    const container = svg.node().parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    svg.attr("width", width).attr("height", height);
    svg.selectAll("*").remove(); // Clear previous content
    
    // Add zoom behavior with mouse wheel
    const zoom = d3.zoom()
        .scaleExtent([0.1, 10])
        .wheelDelta((event) => -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002))
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    
    svg.call(zoom)
        .on("dblclick.zoom", null) // Disable double-click zoom
        .on("click", (event) => {
            // Only hide panel if clicking on the background (not on nodes)
            if (event.target === event.currentTarget) {
                hideNodeInfo();
            }
        });
    
    // Create main group for zooming/panning
    const g = svg.append("g");
    
    // Prepare data for D3
    const nodes = filteredData.nodes.map(d => ({
        ...d,
        id: d.id,
        x: Math.random() * width,
        y: Math.random() * height
    }));
    
    const links = filteredData.links.map(d => ({
        ...d,
        source: d.source,
        target: d.target
    }));
    
    console.log(`Creating D3 visualization: ${nodes.length} nodes, ${links.length} links`);
    
    // Function to calculate node radius
    const getNodeRadius = (d) => {
        return d.type === 'deputado' ? 8 : 6;
    };
    
    // Create force simulation with default D3 collision detection
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(50))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(d => getNodeRadius(d) + 2));
    
    // Store simulation globally for force control
    window.currentSimulation = simulation;
    
    // Add links
    const colors = getThemeColors();
    const link = g.append("g")
        .selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("stroke", colors.linkStroke)
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 0.5);

    // Add nodes
    const searchFilter = document.getElementById('searchBox').value.trim().toLowerCase();
    const node = g.append("g")
        .selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("r", getNodeRadius)
        .attr("fill", d => {
            // Use same colors for search results and regular nodes
            return d.type === 'deputado' ? '#3b82f6' : 'rgb(196, 82, 17)';
        })
        .attr("stroke", d => {
            // Special stroke for search matches
            if (searchFilter && d.label.toLowerCase().includes(searchFilter)) {
                return "#fff";
            }
            return "#fff";
        })
        .attr("stroke-width", d => {
            // Thicker stroke for search matches
            if (searchFilter && d.label.toLowerCase().includes(searchFilter)) {
                return 3;
            }
            return 1.5;
        })
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            event.stopPropagation();
            showNodeInfo(d);
        })
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));
    
    // Check toggle states before creating labels
    const showCompanyNamesToggle = document.getElementById('showCompanyNames');
    const shouldShowCompanyNames = showCompanyNamesToggle?.checked || false;
    
    // Add labels for nodes
    const label = g.append("g")
        .selectAll("text")
        .data(nodes)
        .enter().append("text")
        .text(d => {
            if (d.type === 'deputado') {
                // Show full name including party
                return d.label;
            } else {
                // Show company names based on toggle state
                return shouldShowCompanyNames ? (d.label.length > 25 ? `${d.label.substring(0, 25)}...` : d.label) : '';
            }
        })
        .attr("font-size", d => d.type === 'deputado' ? "10px" : "8px")
        .attr("fill", d => d.type === 'deputado' ? colors.deputadoLabelColor : "rgb(196, 82, 17)")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("class", "node-label")
        .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.8)");
    
    // Add edge labels for spending amounts
    const formatCurrency = (value) => {
        if (value >= 1000000) return `R$ ${(value/1000000).toFixed(1)}M`;
        if (value >= 1000) return `R$ ${(value/1000).toFixed(0)}K`;
        return `R$ ${value.toFixed(0)}`;
    };
    
    // Check toggle state for edge amounts
    const showEdgeAmountsToggle = document.getElementById('showEdgeAmounts');
    const shouldShowEdgeAmounts = showEdgeAmountsToggle?.checked || false;
    
    // Create edge labels with initial state based on toggle
    const edgeLabels = g.append("g")
        .selectAll("text")
        .data(links)
        .enter().append("text")
        .attr("class", "edge-label")
        .text(d => formatCurrency(d.value))
        .attr("font-size", "6px")
        .attr("fill", "yellow")
        .attr("text-anchor", "middle")
        .attr("dy", 3)
        .style("pointer-events", "none")
        .style("opacity", shouldShowEdgeAmounts ? 0.8 : 0)
        .style("display", shouldShowEdgeAmounts ? "block" : "none")
        .style("font-weight", "bold");

    // Update positions on tick
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        
        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
        
        // Position node labels simply below nodes
        label
            .attr("x", d => d.x)
            .attr("y", d => d.y + 15);
        
        // Position edge labels at link centers
        edgeLabels
            .attr("x", d => (d.source.x + d.target.x) / 2)
            .attr("y", d => (d.source.y + d.target.y) / 2);
    });
    
    // Drag functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
    
    // Zoom button controls
    const fitToView = () => {
        try {
            const bounds = g.node().getBBox();
            const fullWidth = bounds.width;
            const fullHeight = bounds.height;
            const centerX = bounds.x + fullWidth / 2;
            const centerY = bounds.y + fullHeight / 2;
            
            // Check for invalid values
            if (!isFinite(fullWidth) || !isFinite(fullHeight) || fullWidth <= 0 || fullHeight <= 0) {
                console.warn('Invalid bounds for fit to view, skipping');
                return;
            }
            
            const scale = Math.min(width / fullWidth, height / fullHeight) * 0.8;
            const translate = [width / 2 - scale * centerX, height / 2 - scale * centerY];
            
            // Check for NaN values in transform
            if (!isFinite(translate[0]) || !isFinite(translate[1]) || !isFinite(scale)) {
                console.warn('Invalid transform values, skipping fit to view');
                return;
            }
            
            svg.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
        } catch (error) {
            console.warn('Error in fitToView:', error);
        }
    };
    
    // Zoom controls
    d3.select("#zoom-in").on("click", () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1.5);
    });
    
    d3.select("#zoom-out").on("click", () => {
        svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.5);
    });
    
    d3.select("#zoom-reset").on("click", fitToView);
    
    // Initial zoom out to show full network
    setTimeout(fitToView, 2000);
    
    console.log('✅ D3.js visualization created successfully!');
    
    // Apply initial theme colors
    updateD3Colors();
    
    // Store references for updating labels
    window.currentVisualization = { label, nodes, edgeLabels };
}

function updateCompanyLabels(showNames) {
    if (window.currentVisualization && window.currentVisualization.label) {
        const colors = getThemeColors();
        window.currentVisualization.label.text(d => {
            if (d.type === 'deputado') {
                // Show full name including party
                return d.label;
            } else {
                return showNames ? (d.label.length > 25 ? `${d.label.substring(0, 25)}...` : d.label) : '';
            }
        })
        .attr("font-size", d => d.type === 'deputado' ? "10px" : "8px")
        .attr("fill", d => d.type === 'deputado' ? colors.deputadoLabelColor : "rgb(196, 82, 17)");
    }
}

function updateEdgeAmounts(showAmounts) {
    if (window.currentVisualization && window.currentVisualization.edgeLabels) {
        if (showAmounts) {
            // Show edge labels with fade-in effect
            window.currentVisualization.edgeLabels
                .style("display", "block")
                .transition()
                .duration(300)
                .style("opacity", 0.8);
        } else {
            // Hide edge labels with fade-out effect
            window.currentVisualization.edgeLabels
                .transition()
                .duration(300)
                .style("opacity", 0)
                .on("end", function() {
                    d3.select(this).style("display", "none");
                });
        }
    }
}

async function showNodeInfo(nodeData) {
    const content = document.getElementById('node-info-content');
    const closeBtn = document.getElementById('close-panel');
    const rightPanel = document.getElementById('right-panel');
    
    // Reset all nodes to normal appearance first
    const svg = d3.select('#network-svg');
    const searchFilter = document.getElementById('searchBox').value.trim().toLowerCase();
    svg.selectAll('circle')
        .attr("stroke-width", d => {
            // Keep search highlights if they exist
            return (searchFilter && d.label.toLowerCase().includes(searchFilter)) ? 3 : 1.5;
        })
        .attr("stroke", d => {
            // Reset to normal stroke colors
            if (searchFilter && d.label.toLowerCase().includes(searchFilter)) {
                return "#fff"; // Keep white stroke for search matches
            }
            return "#fff"; // Normal white stroke
        })
        .attr("r", d => d.type === 'deputado' ? 8 : 6); // Reset to normal radius
    
    // Highlight the selected node
    svg.selectAll('circle')
        .filter(d => d.id === nodeData.id)
        .attr("stroke-width", 4)
        .attr("stroke", "#FFD700") // Gold highlight for selection
        .attr("r", d => (d.type === 'deputado' ? 8 : 6) + 2); // Slightly larger
    
    // Slide in the right panel
    rightPanel.classList.remove('translate-x-full');
    
    // Show loading state
    content.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="loading-spinner"></div>Carregando detalhes...</div>';
    content.style.display = 'block';
    content.className = 'p-4 flex flex-col flex-1 min-h-0';
    closeBtn.classList.remove('hidden');
    
    try {
        // Query detailed transactions for this entity
        const detailsData = await getEntityDetails(nodeData);
        
        // Create details content
        const formatCurrency = (value) => {
            const result = `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            return result;
        };
        const formatNumber = (value) => {
            const result = Number(value).toLocaleString('pt-BR');
            return result;
        };
        const formatDate = (dateStr) => {
            if (!dateStr) return 'N/A';
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('pt-BR');
            } catch {
                return dateStr;
            }
        };
        
        const getCategoryBadge = (categoria) => {
            if (!categoria) return '';
            
            // Hash function to generate consistent colors for categories
            const hashCode = (str) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash; // Convert to 32-bit integer
                }
                return hash;
            };
            
            const colors = [
                { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' },
                { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
                { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200' },
                { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' },
                { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-800 dark:text-pink-200' },
                { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-800 dark:text-indigo-200' },
                { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200' },
                { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200' },
                { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-800 dark:text-teal-200' },
                { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-800 dark:text-cyan-200' }
            ];
            
            const colorIndex = Math.abs(hashCode(categoria)) % colors.length;
            const color = colors[colorIndex];
            
            return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-light ${color.bg} ${color.text}" style="font-size: 8px;" title="${categoria}"><span class="w-1 h-1 rounded-full bg-current"></span>${categoria}</span>`;
        };
        
        let contentHTML = '';
        
        if (nodeData.type === 'deputado') {
            const totalTransactions = detailsData.length;
            const totalValue = detailsData.reduce((sum, item) => sum + Number(item.valor_liquido), 0);
            console.log(`📊 Deputado details - Transactions: ${totalTransactions}, Value: ${totalValue}`);
            
            contentHTML = `
                <div class="pb-3 border-b border-gray-600 mb-3">
                    <h4 class="text-base font-bold text-deputy mb-1">${nodeData.label}</h4>
                    <div class="flex justify-between items-center text-xs text-gray-400 mb-1">
                        <span>Gastou ${formatCurrency(totalValue)} em ${formatNumber(totalTransactions)} Transações</span>
                    </div>                            
                    <div class="text-xs text-gray-400"></div>
                </div>
                <div class="flex-1 flex flex-col min-h-0">
                    <!-- Time Series Chart -->
                    <div class="mb-3">
                        <div class="bg-gray-800 rounded p-3">
                            <canvas id="timeSeriesChart" width="280" height="120" class="w-full"></canvas>
                        </div>
                    </div>
                    
                    <div class="node-info-scroll-container">
                        ${detailsData.slice(0, 200).map(item => `
                            <div class="transaction-card bg-gray-800/50 backdrop-blur-sm border border-gray-600/30 rounded-lg p-3 hover:bg-gray-700/70 hover:border-gray-500/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md border-l-4 border-l-supplier" onclick="highlightNodeInVisualization('${item.fornecedor.replace(/'/g, "\\'")}', 'fornecedor')">
                                <!-- Line 1: Name -->
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="font-semibold text-supplier text-sm truncate flex-1" title="${item.fornecedor}">→ ${item.fornecedor}</div>
                                </div>
                                
                                <!-- Line 2: Value + Date -->
                                <div class="flex justify-between items-center mb-2">
                                    <div class="font-bold text-xs">${formatCurrency(item.valor_liquido)}</div>
                                    <div class="flex items-center gap-1 text-xs text-gray-400">
                                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
                                        </svg>
                                        ${formatDate(item.data_emissao)}
                                    </div>
                                </div>
                                
                                <!-- Line 3: Category Badge -->
                                <div class="flex gap-1 truncate">
                                    ${getCategoryBadge(item.categoria_despesa)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            const totalTransactions = detailsData.length;
            const totalValue = detailsData.reduce((sum, item) => sum + Number(item.valor_liquido), 0);
            console.log(`📊 Fornecedor details - Transactions: ${totalTransactions}, Value: ${totalValue}`);
            
            contentHTML = `
                <div class="pb-3 border-b border-gray-600 mb-3">
                    <h4 class="text-base font-bold text-supplier mb-1">${nodeData.label}</h4>
                    <div class="flex justify-between items-center text-xs text-gray-400 mb-1">
                        <span>Recebeu ${formatCurrency(totalValue)} em ${formatNumber(totalTransactions)} Transações</span>
                    </div>                            
                    <div class="text-xs text-gray-400"></div>
                </div>
                <div class="flex-1 flex flex-col min-h-0">
                    <!-- Time Series Chart -->
                    <div class="mb-3">
                        <div class="bg-gray-800 rounded p-3">
                            <canvas id="timeSeriesChart" width="280" height="120" class="w-full"></canvas>
                        </div>
                    </div>
                    
                    <div class="node-info-scroll-container">
                        ${detailsData.slice(0, 200).map(item => `
                            <div class="transaction-card bg-gray-800/50 backdrop-blur-sm border border-gray-600/30 rounded-lg p-3 hover:bg-gray-700/70 hover:border-gray-500/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md border-l-4 border-l-deputy" onclick="highlightNodeInVisualization('${item.nome_parlamentar.replace(/'/g, "\\'")}', 'deputado')">
                                <!-- Line 1: Name + Party -->
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="font-semibold text-deputy text-sm truncate flex-1">← ${item.nome_parlamentar} ${item.sigla_partido}</div>
                                </div>
                                
                                <!-- Line 2: Value + Date -->
                                <div class="flex justify-between items-center mb-2">
                                    <div class="font-bold text-sm">${formatCurrency(item.valor_liquido)}</div>
                                    <div class="flex items-center gap-1 text-xs text-gray-400">
                                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
                                        </svg>
                                        ${formatDate(item.data_emissao)}
                                    </div>
                                </div>
                                
                                <!-- Line 3: Category Badge -->
                                <div class="flex gap-1 truncate">
                                    ${getCategoryBadge(item.categoria_despesa)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        content.innerHTML = contentHTML;
        
        // Create time series chart after content is set
        setTimeout(() => {
            createTimeSeriesChart(detailsData);
        }, 50);
        
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        content.innerHTML = `<div class="text-red-400 text-sm">Erro ao carregar detalhes: ${error.message}</div>`;
    }
}

async function getEntityDetails(nodeData) {
    // Query to get detailed transactions for the selected entity
    let query = '';
    let entityName = '';
    
    if (nodeData.type === 'deputado') {
        entityName = nodeData.label.replace(/\([^)]*\)/, '').trim(); // Remove party from label
        query = `
            SELECT 
                fornecedor,
                data_emissao,
                valor_liquido,
                categoria_despesa,
                subcategoria_despesa
            FROM despesas 
            WHERE nome_parlamentar = '${entityName}'
            ORDER BY data_emissao DESC, valor_liquido DESC
        `;
    } else {
        entityName = nodeData.label;
        query = `
            SELECT 
                nome_parlamentar,
                sigla_partido,
                data_emissao,
                valor_liquido,
                categoria_despesa,
                subcategoria_despesa
            FROM despesas 
            WHERE fornecedor = '${entityName}'
            ORDER BY data_emissao DESC, valor_liquido DESC
        `;
    }
    
    console.log('🔍 Executing entity details query:', query);
    const result = await window.duckdbAPI.query(query);
    return result.toArray();
}

function highlightNodeInVisualization(entityName, entityType) {
    if (!window.currentVisualization) return;
    
    // Find the target node
    const targetNode = window.currentVisualization.nodes.find(node => {
        if (entityType === 'fornecedor') {
            return node.type === 'fornecedor' && node.label === entityName;
        } else {
            // For deputado, match name with or without party
            return node.type === 'deputado' && (
                node.label.includes(entityName) || 
                entityName.includes(node.label.split('(')[0].trim())
            );
        }
    });
    
    if (!targetNode) return;
    
    // Get the current D3 selection for nodes
    const svg = d3.select("#network-svg");
    const nodes = svg.selectAll("circle");
    
    // Reset all nodes to normal appearance
    nodes
        .attr("stroke-width", d => {
            const searchFilter = document.getElementById('searchBox').value.trim().toLowerCase();
            return (searchFilter && d.label.toLowerCase().includes(searchFilter)) ? 3 : 1.5;
        })
        .attr("stroke", "#fff") // Reset stroke color to default white
        .attr("r", d => d.type === 'deputado' ? 8 : 6);
    
    // Highlight the target node
    nodes
        .filter(d => d.id === targetNode.id)
        .attr("stroke-width", 4)
        .attr("stroke", "#FFD700") // Gold highlight
        .attr("r", d => (d.type === 'deputado' ? 8 : 6) + 2);
    
    // Smooth pan to the node
    const transform = d3.zoomTransform(svg.node());
    const {x} = targetNode;
    const {y} = targetNode;
    
    // Check for valid coordinates
    if (!isFinite(x) || !isFinite(y)) {
        console.warn('Node has invalid coordinates, skipping pan');
        return;
    }
    
    const scale = Math.max(transform.k, 1.5); // Ensure minimum zoom level
    
    const containerRect = svg.node().getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    
    const translateX = centerX - scale * x;
    const translateY = centerY - scale * y;
    
    // Check for valid transform values
    if (!isFinite(translateX) || !isFinite(translateY) || !isFinite(scale)) {
        console.warn('Invalid transform values in highlight, skipping pan');
        return;
    }
    
    const newTransform = d3.zoomIdentity
        .translate(translateX, translateY)
        .scale(scale);
    
    svg.transition()
        .duration(800)
        .call(d3.zoom().transform, newTransform);
}

function hideNodeInfo() {
    const rightPanel = document.getElementById('right-panel');
    const content = document.getElementById('node-info-content');
    const closeBtn = document.getElementById('close-panel');
    
    // Reset all nodes to normal appearance when hiding panel
    const svg = d3.select('#network-svg');
    const searchFilter = document.getElementById('searchBox').value.trim().toLowerCase();
    svg.selectAll('circle')
        .attr("stroke-width", d => {
            // Keep search highlights if they exist
            return (searchFilter && d.label.toLowerCase().includes(searchFilter)) ? 3 : 1.5;
        })
        .attr("stroke", d => {
            // Reset to normal stroke colors
            if (searchFilter && d.label.toLowerCase().includes(searchFilter)) {
                return "#fff"; // Keep white stroke for search matches
            }
            return "#fff"; // Normal white stroke
        })
        .attr("r", d => d.type === 'deputado' ? 8 : 6); // Reset to normal radius
    
    // Slide out the right panel
    rightPanel.classList.add('translate-x-full');
    
    // Reset content after animation completes
    setTimeout(() => {
        content.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-400">Clique em um nó para ver detalhes</p>';
        content.className = 'p-4 flex flex-col flex-1 min-h-0';
        closeBtn.classList.add('hidden');
    }, 300);
}

async function updateVisualization() {
    await processData();
    initializeVisualization();
    updateDensityStats(); // Update density stats after visualization
}

function setupEventListeners() {
    // Update slider display
    const minValueSlider = document.getElementById('minValue');
    const minValueDisplay = document.getElementById('minValueValue');
    const partyFilter = document.getElementById('partyFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const showCompanyNames = document.getElementById('showCompanyNames');
    const searchBox = document.getElementById('searchBox');
    const clearSearch = document.getElementById('clearSearch');
    
    function updateSliderDisplay() {
        const value = parseInt(minValueSlider.value);
        const formatValue = (val) => {
            if (val >= 1000000) return `${(val/1000000).toFixed(1)}M`;
            if (val >= 1000) return `${(val/1000).toFixed(0)}K`;
            return val.toLocaleString('pt-BR');
        };
        minValueDisplay.textContent = formatValue(value);
    }
    
    // Auto-update with debounce for slider
    let sliderTimeout;
    minValueSlider.addEventListener('input', () => {
        updateSliderDisplay();
        clearTimeout(sliderTimeout);
        sliderTimeout = setTimeout(() => {
            updateVisualization();
        }, 500); // 500ms debounce
    });
    
    // Force strength slider control
    const forceSlider = document.getElementById('forceStrength');
    
    if (forceSlider) {
        forceSlider.addEventListener('input', (e) => {
            const forceValue = parseInt(e.target.value);
            
            // Update force simulation strength if it exists
            if (window.currentSimulation) {
                // Convert slider value (1-15) to appropriate force strength (-50 to -750)
                const strength = -forceValue * 50;
                window.currentSimulation.force("charge", d3.forceManyBody().strength(strength));
                // Restart the simulation to apply changes
                window.currentSimulation.alphaTarget(0.3).restart();
                setTimeout(() => window.currentSimulation.alphaTarget(0), 1000);
            }
        });
    }
    
    // Function to reset min/max slider
    function resetSliderRange() {
        const slider = document.getElementById('minValue');
        slider.value = 0;
        slider.min = 0;
        slider.max = 100000;
        document.getElementById('minRange').textContent = 'Min: R$ 0';
        document.getElementById('maxRange').textContent = 'Max: R$ 100.000';
        updateSliderDisplay();
    }

    // Auto-update immediately for select boxes with slider reset
    partyFilter.addEventListener('change', () => {
        resetSliderRange();
        updateVisualization();
    });
    categoryFilter.addEventListener('change', () => {
        resetSliderRange();
        updateVisualization();
    });
    
    // Search functionality with real-time filtering
    let searchTimeout;
    searchBox.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        
        // Show/hide clear button
        if (value) {
            clearSearch.classList.remove('hidden');
        } else {
            clearSearch.classList.add('hidden');
        }
        
        // Update visualization with debounce for real-time filtering
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            updateVisualization();
        }, 300); // 300ms debounce for search
    });
    
    // Search on Enter key (immediate search without debounce)
    searchBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout); // Cancel any pending debounced search
            updateVisualization();
        } else if (e.key === 'Escape') {
            searchBox.value = '';
            clearSearch.classList.add('hidden');
            clearTimeout(searchTimeout);
            updateVisualization();
        }
    });
    
    // Clear search button
    clearSearch.addEventListener('click', () => {
        searchBox.value = '';
        clearSearch.classList.add('hidden');
        updateVisualization();
    });
    
    // Handle company names checkbox
    showCompanyNames.addEventListener('change', (e) => {
        updateCompanyLabels(e.target.checked);
    });
    
    // Handle edge amounts checkbox
    const showEdgeAmounts = document.getElementById('showEdgeAmounts');
    showEdgeAmounts.addEventListener('change', (e) => {
        updateEdgeAmounts(e.target.checked);
    });

    updateSliderDisplay();
    
    // Network analysis toggle switches
    const networkDensityToggle = document.getElementById('networkDensityToggle');
    const topExpensesToggle = document.getElementById('topExpensesToggle');
    
    networkDensityToggle.addEventListener('change', () => {
        networkFilters.densityMode = networkDensityToggle.checked;
        initializeVisualization();
    });
    
    topExpensesToggle.addEventListener('change', () => {
        networkFilters.topExpensesMode = topExpensesToggle.checked;
        initializeVisualization();
    });
    
    // Close panel
    document.getElementById('close-panel').addEventListener('click', () => {
        hideNodeInfo();
    });
}

// Helper functions for theme-aware colors
function getThemeColors() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        linkStroke: isDark ? '#999' : '#4b5563', // Dark grey for light mode
        backgroundColor: isDark ? '#0f1419' : '#f3f4f6',
        deputadoLabelColor: isDark ? 'white' : 'black',
        selectionStroke: '#FFD700'
    };
}

function updateD3Colors() {
    const colors = getThemeColors();
    
    // Update D3.js container background color
    const visualization = document.getElementById('visualization');
    if (visualization) {
        visualization.style.backgroundColor = colors.backgroundColor;
    }
    
    // Update link colors
    const svg = d3.select("#network-svg");
    svg.selectAll("line")
        .attr("stroke", colors.linkStroke);
    
    // Update deputado label colors (excluding edge labels)
    svg.selectAll("text:not(.edge-label)")
        .attr("fill", d => {
            if (d && d.type === 'deputado') {
                return colors.deputadoLabelColor;
            }
            // Keep other labels unchanged
            return d && d.type === 'deputado' ? colors.deputadoLabelColor : "rgb(196, 82, 17)";
        });
}

// Add dark mode toggle functionality
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (html.classList.contains('dark')) {
                html.classList.remove('dark');
                themeToggle.textContent = '🌞';
                document.body.className = 'font-sans bg-white text-gray-900 h-screen overflow-hidden';
            } else {
                html.classList.add('dark');
                themeToggle.textContent = '🌙';
                document.body.className = 'font-sans bg-white dark:bg-gray-950 text-gray-900 dark:text-white h-screen overflow-hidden';
            }
            
            // Update D3.js colors after theme change
            updateD3Colors();
            
            // Force slider theme update
            updateSliderTheme();
        });
    }
}

// Function to manually update slider styling for theme changes
function updateSliderTheme() {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    const slider = document.getElementById('minValue');
    
    if (slider) {
        // Force a re-render by temporarily changing the display
        slider.style.display = 'none';
        slider.offsetHeight; // Trigger reflow
        slider.style.display = 'block';
        
        // Additional approach: update via CSS custom properties
        if (isDark) {
            slider.style.setProperty('--track-bg', '#374151');
            slider.style.setProperty('--thumb-border', '#1f2937');
        } else {
            slider.style.setProperty('--track-bg', '#d1d5db');
            slider.style.setProperty('--thumb-border', '#ffffff');
        }
    }
}

// Check for URL search parameter and handle auto-search (handled in loadData now)

// Check if search returns exactly one result and auto-click it
function checkForSingleSearchResult(searchTerm) {
    if (!processedData.nodes || !searchTerm) return;
    
    const searchLower = searchTerm.toLowerCase();
    const matchingNodes = processedData.nodes.filter(node => 
        node.label.toLowerCase().includes(searchLower)
    );
    
    if (matchingNodes.length === 1) {
        // Auto-click the single matching node
        setTimeout(() => {
            showNodeInfo(matchingNodes[0]);
        }, 500);
    }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Setup theme toggle first
    setupThemeToggle();
    
    // Initialize slider theme
    updateSliderTheme();
    
    // Then load data (URL parameters are handled there)
    loadData().catch(error => {
        console.error('Failed to load data:', error);
        window.updateConnectionStatus('error', 'Falha na inicialização');
    });
});

export { loadData, setupEventListeners, initializeVisualization };