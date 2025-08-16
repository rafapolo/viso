// Network Visualization Management
import { COLORS, APP_CONSTANTS } from '../shared/constants.js';
import { DOMUtils } from '../shared/dom-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';

export class NetworkVisualization {
  constructor() {
    this.simulation = null;
    this.svg = null;
    this.currentData = { nodes: [], links: [] };
    this.selectedNode = null;
    this.searchMatches = [];
  }

  /**
   * Initialize D3 network visualization
   * @param {Object} data - Network data with nodes and links
   */
  initializeVisualization(data) {
    try {
      if (!data || !data.nodes || !data.links) {
        throw new Error('Invalid network data provided');
      }

      this.currentData = data;
      this.setupSVG();
      this.createSimulation();
      this.renderNetwork();

      console.log(`🎨 Network visualization initialized with ${data.nodes.length} nodes and ${data.links.length} links`);
    } catch (error) {
      ErrorHandler.handleError(error, 'Network Visualization Initialization');
      this.showErrorState('Failed to initialize network visualization');
    }
  }

  /**
   * Setup SVG container and dimensions
   */
  setupSVG() {
    const container = DOMUtils.getElementById('network-svg');
    if (!container) {
      throw new Error('Network SVG container not found');
    }

    // Clear existing content
    container.innerHTML = '';

    const containerRect = container.getBoundingClientRect();
    const width = containerRect.width || APP_CONSTANTS.UI.NETWORK_WIDTH;
    const height = containerRect.height || APP_CONSTANTS.UI.NETWORK_HEIGHT;

    this.svg = window.d3.select(container)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    // Add zoom behavior
    const zoom = window.d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        this.svg.selectAll('g.network-content')
          .attr('transform', event.transform);
      });

    this.svg.call(zoom);

    // Create main group for network content
    this.svg.append('g')
      .attr('class', 'network-content');
  }

  /**
   * Create D3 force simulation
   */
  createSimulation() {
    const width = +this.svg.attr('width');
    const height = +this.svg.attr('height');

    this.simulation = window.d3.forceSimulation(this.currentData.nodes)
      .force('link', window.d3.forceLink(this.currentData.links)
        .id(d => d.id)
        .distance(150)
        .strength(0.1))
      .force('charge', window.d3.forceManyBody()
        .strength(-300))
      .force('center', window.d3.forceCenter(width / 2, height / 2))
      .force('collision', window.d3.forceCollide()
        .radius(d => Math.max(8, Math.sqrt(d.total_value) * 0.1 + 5)));
  }

  /**
   * Render network elements (links and nodes)
   */
  renderNetwork() {
    const networkGroup = this.svg.select('g.network-content');

    // Render links
    this.renderLinks(networkGroup);

    // Render nodes
    this.renderNodes(networkGroup);

    // Start simulation
    this.simulation.on('tick', () => this.updatePositions());
  }

  /**
   * Render network links
   * @param {Object} container - D3 selection container
   */
  renderLinks(container) {
    const isDark = document.documentElement.classList.contains('dark');
    const linkColor = isDark ? COLORS.THEME.DARK.BORDER : COLORS.THEME.LIGHT.BORDER;

    const links = container.selectAll('.link')
      .data(this.currentData.links)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', linkColor)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.max(1, Math.sqrt(d.value) * 0.5));

    this.links = links;
  }

  /**
   * Render network nodes
   * @param {Object} container - D3 selection container
   */
  renderNodes(container) {
    const nodes = container.selectAll('.node')
      .data(this.currentData.nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(this.dragBehavior());

    // Add circles
    nodes.append('circle')
      .attr('r', d => Math.max(8, Math.sqrt(d.total_value) * 0.2 + 5))
      .attr('fill', d => this.getNodeColor(d))
      .attr('stroke', COLORS.SEMANTIC.WHITE)
      .attr('stroke-width', 2);

    // Add labels (conditionally visible)
    nodes.append('text')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', COLORS.SEMANTIC.WHITE)
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none')
      .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
      .text(d => this.getNodeLabel(d))
      .style('display', d => this.shouldShowLabel(d) ? 'block' : 'none');

    // Setup interactions
    nodes.on('click', (event, d) => this.handleNodeClick(event, d))
         .on('mouseover', (event, d) => this.handleNodeHover(event, d))
         .on('mouseout', () => this.handleNodeUnhover());

    this.nodes = nodes;
  }

  /**
   * Get node color based on type
   * @param {Object} node - Node data
   * @returns {string} Color value
   */
  getNodeColor(node) {
    switch (node.type) {
      case 'deputado':
        return COLORS.ENTITIES.DEPUTY;
      case 'fornecedor':
        return COLORS.ENTITIES.SUPPLIER;
      case 'partido':
        return COLORS.ENTITIES.PARTY;
      case 'categoria':
        return COLORS.ENTITIES.CATEGORY;
      default:
        return COLORS.SEMANTIC.DEFAULT_GRAY;
    }
  }

  /**
   * Get node label text
   * @param {Object} node - Node data
   * @returns {string} Label text
   */
  getNodeLabel(node) {
    if (node.type === 'deputado') {
      return node.nome?.substring(0, 15) || node.id;
    } else if (node.type === 'fornecedor') {
      return node.nome?.substring(0, 20) || node.id;
    }
    return node.nome || node.id;
  }

  /**
   * Check if node label should be visible
   * @param {Object} node - Node data
   * @returns {boolean} Whether to show label
   */
  shouldShowLabel(node) {
    // Show labels for large nodes or when specifically enabled
    return node.total_value > 100000 || this.isCompanyLabelsEnabled();
  }

  /**
   * Check if company labels are enabled
   * @returns {boolean} Whether company labels are enabled
   */
  isCompanyLabelsEnabled() {
    const checkbox = DOMUtils.getElementById('showCompanyNames');
    return checkbox ? checkbox.checked : false;
  }

  /**
   * Create drag behavior for nodes
   * @returns {Function} D3 drag behavior
   */
  dragBehavior() {
    return window.d3.drag()
      .on('start', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  }

  /**
   * Update positions during simulation tick
   */
  updatePositions() {
    if (this.links) {
      this.links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
    }

    if (this.nodes) {
      this.nodes.attr('transform', d => `translate(${d.x},${d.y})`);
    }
  }

  /**
   * Handle node click events
   * @param {Event} event - Click event
   * @param {Object} nodeData - Node data
   */
  handleNodeClick(event, nodeData) {
    try {
      // Highlight selected node
      this.selectNode(nodeData);

      // Dispatch event for other components to handle
      document.dispatchEvent(new CustomEvent('nodeSelected', {
        detail: { node: nodeData, event }
      }));

    } catch (error) {
      ErrorHandler.handleError(error, 'Node Click Handler');
    }
  }

  /**
   * Handle node hover events
   * @param {Event} event - Hover event
   * @param {Object} nodeData - Node data
   */
  handleNodeHover(event, nodeData) {
    // Highlight node
    this.highlightNode(nodeData, true);

    // Show tooltip
    this.showTooltip(event, nodeData);
  }

  /**
   * Handle node unhover events
   */
  handleNodeUnhover() {
    // Remove highlight
    this.highlightNode(null, false);

    // Hide tooltip
    this.hideTooltip();
  }

  /**
   * Select a node
   * @param {Object} nodeData - Node data to select
   */
  selectNode(nodeData) {
    this.selectedNode = nodeData;

    // Remove previous selection styling
    this.nodes.selectAll('circle')
      .attr('stroke', COLORS.SEMANTIC.WHITE)
      .attr('stroke-width', 2);

    // Apply selection styling
    this.nodes.selectAll('circle')
      .filter(d => d.id === nodeData.id)
      .attr('stroke', COLORS.SEMANTIC.SELECTION_GOLD)
      .attr('stroke-width', 4);
  }

  /**
   * Highlight a node
   * @param {Object} nodeData - Node to highlight (null to clear)
   * @param {boolean} highlight - Whether to highlight or unhighlight
   */
  highlightNode(nodeData, highlight) {
    if (highlight && nodeData) {
      // Dim other nodes
      this.nodes.style('opacity', d => d.id === nodeData.id ? 1 : 0.3);
      this.links.style('opacity', d => 
        d.source.id === nodeData.id || d.target.id === nodeData.id ? 1 : 0.1);
    } else {
      // Reset opacity
      this.nodes.style('opacity', 1);
      this.links.style('opacity', 0.6);
    }
  }

  /**
   * Show tooltip for node
   * @param {Event} event - Mouse event
   * @param {Object} nodeData - Node data
   */
  showTooltip(event, nodeData) {
    const tooltip = this.getOrCreateTooltip();
    
    const tooltipContent = `
      <div class="font-medium text-white">${nodeData.nome || nodeData.id}</div>
      <div class="text-xs text-gray-300">Tipo: ${nodeData.type}</div>
      <div class="text-xs text-gray-300">Valor: R$ ${(nodeData.total_value || 0).toLocaleString()}</div>
      <div class="text-xs text-gray-300">Conexões: ${nodeData.connections || 0}</div>
    `;

    DOMUtils.updateContent(tooltip, tooltipContent, true);
    
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY - 10}px`;
    tooltip.style.display = 'block';
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    const tooltip = DOMUtils.getElementById('network-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  /**
   * Get or create tooltip element
   * @returns {Element} Tooltip element
   */
  getOrCreateTooltip() {
    let tooltip = DOMUtils.getElementById('network-tooltip');
    
    if (!tooltip) {
      tooltip = DOMUtils.createElement('div', {
        id: 'network-tooltip',
        className: 'absolute z-50 p-2 bg-gray-900 text-white text-sm rounded shadow-lg pointer-events-none',
        style: { display: 'none' }
      }, document.body);
    }
    
    return tooltip;
  }

  /**
   * Update company name labels visibility
   * @param {boolean} showNames - Whether to show company names
   */
  updateCompanyLabels(showNames) {
    if (this.nodes) {
      this.nodes.selectAll('text')
        .style('display', d => {
          if (d.type === 'fornecedor') {
            return showNames ? 'block' : 'none';
          }
          return this.shouldShowLabel(d) ? 'block' : 'none';
        });
    }
  }

  /**
   * Update edge amounts visibility
   * @param {boolean} showAmounts - Whether to show edge amounts
   */
  updateEdgeAmounts(showAmounts) {
    // Remove existing edge labels
    this.svg.selectAll('.edge-label').remove();

    if (showAmounts && this.currentData.links) {
      const edgeLabels = this.svg.select('g.network-content')
        .selectAll('.edge-label')
        .data(this.currentData.links)
        .join('text')
        .attr('class', 'edge-label')
        .attr('font-size', '8px')
        .attr('fill', COLORS.SEMANTIC.LIGHT_GRAY)
        .attr('text-anchor', 'middle')
        .style('pointer-events', 'none')
        .text(d => `R$ ${(d.value || 0).toLocaleString()}`);

      // Update positions on each tick
      this.simulation.on('tick.edge-labels', () => {
        edgeLabels
          .attr('x', d => (d.source.x + d.target.x) / 2)
          .attr('y', d => (d.source.y + d.target.y) / 2);
      });
    }
  }

  /**
   * Search for nodes by name
   * @param {string} searchTerm - Search term
   * @returns {Array} Matching nodes
   */
  searchNodes(searchTerm) {
    if (!searchTerm || !this.currentData.nodes) return [];

    const term = searchTerm.toLowerCase();
    const matches = this.currentData.nodes.filter(node => {
      const name = (node.nome || node.id || '').toLowerCase();
      return name.includes(term);
    });

    this.highlightSearchMatches(matches);
    return matches;
  }

  /**
   * Highlight search matches
   * @param {Array} matches - Array of matching nodes
   */
  highlightSearchMatches(matches) {
    this.searchMatches = matches;

    if (this.nodes) {
      this.nodes.selectAll('circle')
        .attr('stroke', d => {
          const isMatch = matches.some(match => match.id === d.id);
          return isMatch ? COLORS.SEMANTIC.SELECTION_GOLD : COLORS.SEMANTIC.WHITE;
        })
        .attr('stroke-width', d => {
          const isMatch = matches.some(match => match.id === d.id);
          return isMatch ? 4 : 2;
        });

      // Fade non-matching nodes
      this.nodes.style('opacity', d => {
        if (matches.length === 0) return 1;
        const isMatch = matches.some(match => match.id === d.id);
        return isMatch ? 1 : 0.3;
      });
    }
  }

  /**
   * Clear search highlights
   */
  clearSearchHighlights() {
    this.searchMatches = [];
    
    if (this.nodes) {
      this.nodes.selectAll('circle')
        .attr('stroke', COLORS.SEMANTIC.WHITE)
        .attr('stroke-width', 2);
      
      this.nodes.style('opacity', 1);
    }
    
    if (this.links) {
      this.links.style('opacity', 0.6);
    }
  }

  /**
   * Update force strength
   * @param {number} strength - Force strength value
   */
  updateForceStrength(strength) {
    if (this.simulation) {
      this.simulation
        .force('charge', window.d3.forceManyBody().strength(-strength * 10))
        .alpha(0.3)
        .restart();
    }
  }

  /**
   * Reset zoom to fit all nodes
   */
  resetZoom() {
    if (!this.svg || !this.currentData.nodes.length) return;

    const bounds = this.calculateNodeBounds();
    const width = +this.svg.attr('width');
    const height = +this.svg.attr('height');

    const scale = Math.min(
      width / (bounds.maxX - bounds.minX + 100),
      height / (bounds.maxY - bounds.minY + 100)
    );

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const transform = window.d3.zoomIdentity
      .translate(width / 2 - scale * centerX, height / 2 - scale * centerY)
      .scale(Math.min(scale, 1));

    this.svg.transition()
      .duration(750)
      .call(this.svg.call(window.d3.zoom().transform, transform));
  }

  /**
   * Calculate bounds of all nodes
   * @returns {Object} Bounds object with min/max x/y
   */
  calculateNodeBounds() {
    const {nodes} = this.currentData;
    
    return {
      minX: Math.min(...nodes.map(d => d.x || 0)),
      maxX: Math.max(...nodes.map(d => d.x || 0)),
      minY: Math.min(...nodes.map(d => d.y || 0)),
      maxY: Math.max(...nodes.map(d => d.y || 0))
    };
  }

  /**
   * Show error state in visualization
   * @param {string} message - Error message
   */
  showErrorState(message) {
    const container = DOMUtils.getElementById('network-svg');
    if (container) {
      const errorHTML = `
        <div class="flex flex-col items-center justify-center h-full text-red-500 dark:text-red-400">
          <div class="text-4xl mb-4">⚠️</div>
          <div class="text-lg font-medium">Visualization Error</div>
          <div class="text-sm opacity-75">${message}</div>
        </div>
      `;
      
      // Replace SVG with error message
      container.innerHTML = errorHTML;
    }
  }

  /**
   * Update theme colors
   */
  updateTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    
    if (this.links) {
      const linkColor = isDark ? COLORS.THEME.DARK.BORDER : COLORS.THEME.LIGHT.BORDER;
      this.links.attr('stroke', linkColor);
    }
  }

  /**
   * Dispose of the visualization
   */
  dispose() {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    
    if (this.svg) {
      this.svg.selectAll('*').remove();
      this.svg = null;
    }
    
    this.currentData = { nodes: [], links: [] };
    this.selectedNode = null;
    this.searchMatches = [];
  }

  /**
   * Get current visualization statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      nodes: this.currentData.nodes.length,
      links: this.currentData.links.length,
      selectedNode: this.selectedNode?.id || null,
      searchMatches: this.searchMatches.length
    };
  }
}