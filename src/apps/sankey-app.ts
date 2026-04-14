// Standalone Sankey Application
import { createStandaloneSankeyApp, SankeyVisualization } from '../dataviz/sankey-visualization.js';
import { createStandaloneDatabaseService, DatabaseService } from '../services/database-service.js';

class SankeyApp {
  private sankeyViz: SankeyVisualization;
  private databaseService: DatabaseService;
  private container: HTMLElement | null;

  constructor() {
    this.sankeyViz = createStandaloneSankeyApp();
    this.databaseService = createStandaloneDatabaseService();
    this.container = null;
  }

  async initialize(): Promise<void> {
    this.container = document.body;

    await this.databaseService.initialize?.();
    await this.databaseService.loadData?.();

    await this.sankeyViz.initialize(
      this.container,
      this.databaseService as unknown as Parameters<typeof this.sankeyViz.initialize>[1]
    );
  }

  async render(): Promise<boolean> {
    return await this.sankeyViz.render();
  }

  async init(): Promise<void> {
    try {
      await this.initialize();
      await this.render();
    } catch (error) {
      console.error('Error initializing Sankey app:', error);

      const loadingEl = document.getElementById('loading');
      if (loadingEl) {
        loadingEl.innerHTML = `
          <div class="text-red-400 text-center">
            <div class="text-lg mb-2">❌ Erro ao carregar aplicação</div>
            <div class="text-sm">${(error as Error).message}</div>
          </div>
        `;
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new SankeyApp();
  app.init();
});

export { SankeyApp };
