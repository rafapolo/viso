// Standalone Sankey Application
import { createStandaloneSankeyApp } from '../services/sankey-visualization.js';
import { createStandaloneDatabaseService } from '../services/database-service.js';

class SankeyApp {
    constructor() {
        this.sankeyViz = createStandaloneSankeyApp();
        this.databaseService = createStandaloneDatabaseService();
        this.container = null;
    }

    async initialize() {
        // Get container
        this.container = document.body;
        
        // Initialize database
        await this.databaseService.initialize();
        await this.databaseService.loadData();
        
        // Initialize visualization
        await this.sankeyViz.initialize(this.container, this.databaseService);
    }

    async render() {
        return await this.sankeyViz.render();
    }

    async init() {
        try {
            await this.initialize();
            await this.render();
        } catch (error) {
            console.error('Error initializing Sankey app:', error);
            
            // Show error in the loading element if it exists
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div class="text-red-400 text-center">
                        <div class="text-lg mb-2">❌ Erro ao carregar aplicação</div>
                        <div class="text-sm">${error.message}</div>
                    </div>
                `;
            }
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new SankeyApp();
    app.init();
});

export { SankeyApp };