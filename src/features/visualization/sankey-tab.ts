import { createEmbeddedSankeyTab, SankeyVisualization } from '../../dataviz/sankey-visualization.js';
import { getGlobalDatabaseService } from '../../services/database-service.js';

interface DatabaseServiceLike {
  db?: unknown;
  conn?: unknown;
  ensureConnection(): Promise<boolean | void>;
  query(sql: string): Promise<{ toArray(): Record<string, unknown>[] }>;
  initialize?(): Promise<void>;
  loadData?(): Promise<void>;
}

// ===== SANKEY TAB WRAPPER =====
// Maintains backward compatibility while using the new unified service
export class SankeyTab {
  private sankeyViz: SankeyVisualization;
  resizeHandler: (() => void) | null;

  constructor() {
    this.sankeyViz = createEmbeddedSankeyTab();
    this.resizeHandler = null;
  }

  async render(
    container: HTMLElement,
    databaseService: DatabaseServiceLike | null = null
  ): Promise<boolean> {
    const dbService = databaseService || this.createDatabaseServiceAdapter();

    await this.sankeyViz.initialize(container, dbService);
    const success = await this.sankeyViz.render();

    this.resizeHandler = this.sankeyViz.resizeHandler;

    return success;
  }

  createDatabaseServiceAdapter(): DatabaseServiceLike {
    const databaseService = getGlobalDatabaseService();

    if (!databaseService.db || !databaseService.conn) {
      return {
        async ensureConnection() {
          await databaseService.initialize?.();
          await databaseService.loadData?.();
          return true;
        },
        async query(sql: string) {
          return await databaseService.query(sql);
        },
      };
    }

    return databaseService as unknown as DatabaseServiceLike;
  }

  setupResizeHandler(): void {
    this.resizeHandler = this.sankeyViz.resizeHandler;
  }

  cleanup(): void {
    if (this.sankeyViz) {
      this.sankeyViz.cleanup();
    }
  }

  resize(): void {
    if (this.sankeyViz) {
      this.sankeyViz.resize();
    }
  }
}
