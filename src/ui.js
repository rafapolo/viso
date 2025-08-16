// Import state management from new location
import { StateManager, URLStateManager, LocalStorage } from './shared/state-manager.js';
import { UIComponents, ChartUtils } from './shared/ui-utils.js';

// Re-export for backward compatibility
export { StateManager, URLStateManager, LocalStorage };

// Export UI components and chart utilities
export { UIComponents, ChartUtils };

// Global instances for backward compatibility
export const globalStateManager = new StateManager();
export const globalURLStateManager = new URLStateManager();
export const globalLocalStorage = new LocalStorage();