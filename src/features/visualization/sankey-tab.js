import { createEmbeddedSankeyTab } from '../../dataviz/sankey-visualization.js';
import { getGlobalDatabaseService } from '../../services/database-service.js';

// ===== SANKEY TAB WRAPPER =====
// Maintains backward compatibility while using the new unified service
export class SankeyTab {
    constructor() {
        this.sankeyViz = createEmbeddedSankeyTab();
        this.resizeHandler = null;
    }

    /**
     * Render the Sankey tab in a container
     * @param {HTMLElement} container - Container element
     * @param {Object} databaseService - Database service instance
     */
    async render(container, databaseService = null) {
        // Create a database service adapter if using global API
        const dbService = databaseService || this.createDatabaseServiceAdapter();

        await this.sankeyViz.initialize(container, dbService);
        const success = await this.sankeyViz.render();

        // Store resize handler for backward compatibility
        this.resizeHandler = this.sankeyViz.resizeHandler;

        return success;
    }

    /**
     * Create a database service adapter for backward compatibility
     */
    createDatabaseServiceAdapter() {
        // Use the unified database service instead of global API
        const databaseService = getGlobalDatabaseService();

        // Ensure service is initialized
        if (!databaseService.db || !databaseService.conn) {
            // Return wrapper that initializes on first use
            return {
                async ensureConnection() {
                    await databaseService.initialize();
                    await databaseService.loadData();
                    return true;
                },
                async query(sql) {
                    await this.ensureConnection();
                    return await databaseService.query(sql);
                }
            };
        }

        return databaseService;
    }

    /**
     * Setup resize handler (backward compatibility)
     */
    setupResizeHandler() {
        // This is now handled automatically by the visualization service
        this.resizeHandler = this.sankeyViz.resizeHandler;
    }

    /**
     * Cleanup method
     */
    cleanup() {
        if (this.sankeyViz) {
            this.sankeyViz.cleanup();
        }
    }

    /**
     * Trigger resize (backward compatibility)
     */
    resize() {
        if (this.sankeyViz) {
            this.sankeyViz.resize();
        }
    }
}
