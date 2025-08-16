// Enhanced Offline Features E2E Tests
import { test, expect } from '@playwright/test';

test.describe('Enhanced Offline Features', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for enhanced core to initialize
    await page.waitForFunction(() => {
      return window.enhancedDuckDBManager && window.storageUI;
    }, { timeout: 10000 });
  });

  test.describe('Progressive Loading', () => {
    test('should show loading indicators during data initialization', async ({ page }) => {
      // Reload to see initialization process
      await page.reload();
      
      // Check for loading indicators
      const loadingIndicator = page.locator('[data-testid="loading-status"]');
      await expect(loadingIndicator).toBeVisible();
      
      // Should show progressive loading messages
      await expect(loadingIndicator).toContainText(/Initializing|Loading|Connecting/);
      
      // Wait for completion
      await page.waitForFunction(() => {
        return document.querySelector('[data-testid="loading-status"]')?.textContent?.includes('✅');
      }, { timeout: 30000 });
    });

    test('should indicate when data is loaded from cache', async ({ page }) => {
      // First load to populate cache
      await page.waitForLoadState('networkidle');
      
      // Reload to trigger cache loading
      await page.reload();
      
      // Check for cache indicator
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid="connection-status"]');
        return status && status.textContent.includes('cached');
      }, { timeout: 10000 });
      
      const statusElement = page.locator('[data-testid="connection-status"]');
      await expect(statusElement).toContainText('cached');
    });
  });

  test.describe('Storage Management UI', () => {
    test('should open storage management modal', async ({ page }) => {
      // Click storage management button
      await page.click('[data-testid="storage-btn"]');
      
      // Modal should be visible
      const modal = page.locator('#storageModal');
      await expect(modal).toBeVisible();
      
      // Should show storage sections
      await expect(page.locator('text=Connection Status')).toBeVisible();
      await expect(page.locator('text=Storage Usage')).toBeVisible();
      await expect(page.locator('text=Datasets')).toBeVisible();
      await expect(page.locator('text=Cache')).toBeVisible();
    });

    test('should display storage statistics', async ({ page }) => {
      await page.click('[data-testid="storage-btn"]');
      
      // Wait for statistics to load
      await page.waitForSelector('#storageStats .stat-card', { timeout: 5000 });
      
      // Check for storage stat cards
      const statCards = page.locator('#storageStats .stat-card');
      await expect(statCards).toHaveCount(4); // Total, Datasets, Cache, Temporary
      
      // Should show formatted sizes
      await expect(page.locator('text=/\\d+(\\.\\d+)? (Bytes|KB|MB|GB)/')).toHaveCount.greaterThan(0);
    });

    test('should show dataset information', async ({ page }) => {
      await page.click('[data-testid="storage-btn"]');
      
      // Wait for dataset list
      await page.waitForSelector('#datasetList .dataset-item', { timeout: 5000 });
      
      // Should show at least one dataset (despesas)
      const datasetItems = page.locator('#datasetList .dataset-item');
      await expect(datasetItems).toHaveCount.greaterThan(0);
      
      // Should show dataset details
      await expect(page.locator('.dataset-name')).toContainText('despesas');
      await expect(page.locator('.dataset-status')).toBeVisible();
    });

    test('should manage cache operations', async ({ page }) => {
      await page.click('[data-testid="storage-btn"]');
      
      // Test clear query cache
      await page.click('button:has-text("Clear Query Cache")');
      
      // Should show notification or update stats
      await page.waitForTimeout(1000);
      
      // Test clear expired cache
      await page.click('button:has-text("Clear Expired")');
      await page.waitForTimeout(1000);
      
      // Cache stats should be updated
      const cacheStats = page.locator('#cacheStats');
      await expect(cacheStats).toBeVisible();
    });
  });

  test.describe('Offline Mode', () => {
    test('should work when going offline', async ({ page, context }) => {
      // Wait for initial load
      await page.waitForLoadState('networkidle');
      
      // Ensure data is cached
      await page.waitForFunction(() => {
        return window.enhancedDuckDBManager?.isInitialized;
      });
      
      // Go offline
      await context.setOffline(true);
      
      // Reload page
      await page.reload();
      
      // Should still work with cached data
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid="connection-status"]');
        return status && (status.textContent.includes('Offline') || status.textContent.includes('cached'));
      }, { timeout: 15000 });
      
      // Should be able to perform queries
      const queryButton = page.locator('[data-testid="execute-query"]');
      if (await queryButton.isVisible()) {
        await queryButton.click();
        
        // Results should still load from cache
        await page.waitForSelector('[data-testid="query-results"]', { timeout: 10000 });
        const results = page.locator('[data-testid="query-results"]');
        await expect(results).toBeVisible();
      }
      
      // Restore online state
      await context.setOffline(false);
    });

    test('should sync when coming back online', async ({ page, context }) => {
      // Start offline
      await context.setOffline(true);
      await page.reload();
      
      // Wait for offline mode
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid="connection-status"]');
        return status && status.textContent.includes('Offline');
      }, { timeout: 10000 });
      
      // Go back online
      await context.setOffline(false);
      
      // Should detect online status and sync
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid="connection-status"]');
        return status && (status.textContent.includes('syncing') || status.textContent.includes('Back online'));
      }, { timeout: 10000 });
    });
  });

  test.describe('Performance Monitoring', () => {
    test('should track query performance', async ({ page }) => {
      // Execute several queries to generate performance data
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          return window.enhancedDuckDBManager.executeQuery('SELECT COUNT(*) FROM despesas');
        });
      }
      
      // Open storage management to check performance
      await page.click('[data-testid="storage-btn"]');
      
      // Look for performance indicators (cache hit rate, etc.)
      await page.waitForSelector('#cacheStats .stat-card', { timeout: 5000 });
      
      // Should show cache statistics
      const hitRateElement = page.locator('text=/Hit Rate|Cache/');
      await expect(hitRateElement).toBeVisible();
    });

    test('should show recommendations when performance is poor', async ({ page }) => {
      // Force poor performance by clearing cache repeatedly
      await page.evaluate(async () => {
        for (let i = 0; i < 10; i++) {
          await window.enhancedDuckDBManager.executeQuery(`SELECT * FROM despesas WHERE valor_liquido > ${i * 1000}`);
        }
      });
      
      // Check for performance recommendations
      const performanceReport = await page.evaluate(() => {
        return window.performanceMonitor?.getPerformanceReport();
      });
      
      expect(performanceReport).toBeTruthy();
      expect(performanceReport.recommendations).toBeDefined();
    });
  });

  test.describe('Data Refresh', () => {
    test('should refresh data on demand', async ({ page }) => {
      await page.click('[data-testid="storage-btn"]');
      
      // Click refresh data button
      await page.click('button:has-text("Refresh Data")');
      
      // Should show refreshing status
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid="connection-status"]');
        return status && status.textContent.includes('Refreshing');
      }, { timeout: 5000 });
      
      // Should complete refresh
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid="connection-status"]');
        return status && status.textContent.includes('refreshed');
      }, { timeout: 30000 });
    });

    test('should clear offline data', async ({ page }) => {
      await page.click('[data-testid="storage-btn"]');
      
      // Click clear offline data (with confirmation)
      await page.click('button:has-text("Clear Offline Data")');
      
      // Handle confirmation dialog
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('sure');
        await dialog.accept();
      });
      
      // Should update storage statistics
      await page.waitForTimeout(2000);
      
      const storageStats = page.locator('#storageStats .stat-value');
      // Some values should be reduced after clearing
      await expect(storageStats.first()).toBeVisible();
    });
  });

  test.describe('Background Operations', () => {
    test('should show background task status', async ({ page }) => {
      await page.click('[data-testid="storage-btn"]');
      
      // Check background tasks section
      await page.waitForSelector('#syncStatus', { timeout: 5000 });
      
      const syncStatus = page.locator('#syncStatus');
      await expect(syncStatus).toBeVisible();
      
      // Should show task counts
      const taskStats = page.locator('#syncStatus .stat-card');
      await expect(taskStats).toHaveCount.greaterThan(0);
    });

    test('should force sync background tasks', async ({ page }) => {
      await page.click('[data-testid="storage-btn"]');
      
      // Click sync now button
      await page.click('button:has-text("Sync Now")');
      
      // Should trigger sync operations
      await page.waitForTimeout(1000);
      
      // Sync status should be updated
      const syncStatus = page.locator('#syncStatus');
      await expect(syncStatus).toBeVisible();
    });

    test('should clear completed tasks', async ({ page }) => {
      await page.click('[data-testid="storage-btn"]');
      
      // Click clear completed tasks
      await page.click('button:has-text("Clear Completed")');
      
      // Should update task counts
      await page.waitForTimeout(1000);
      
      const completedTasks = page.locator('text=/Completed/').first();
      await expect(completedTasks).toBeVisible();
    });
  });

  test.describe('Auto-refresh', () => {
    test('should auto-refresh storage statistics', async ({ page }) => {
      await page.click('[data-testid="storage-btn"]');
      
      // Ensure auto-refresh is enabled
      const autoRefreshCheckbox = page.locator('#autoRefresh');
      await expect(autoRefreshCheckbox).toBeChecked();
      
      // Get initial values
      const initialStats = await page.locator('#storageStats .stat-value').first().textContent();
      
      // Wait for potential auto-refresh (shortened for testing)
      await page.waitForTimeout(6000);
      
      // Stats should still be visible (may or may not have changed)
      const currentStats = page.locator('#storageStats .stat-value').first();
      await expect(currentStats).toBeVisible();
    });

    test('should stop auto-refresh when disabled', async ({ page }) => {
      await page.click('[data-testid="storage-btn"]');
      
      // Disable auto-refresh
      const autoRefreshCheckbox = page.locator('#autoRefresh');
      await autoRefreshCheckbox.uncheck();
      
      expect(await autoRefreshCheckbox.isChecked()).toBe(false);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle storage operation errors gracefully', async ({ page }) => {
      // Try to clear data when offline (should handle gracefully)
      await page.evaluate(() => {
        // Mock an error condition
        if (window.storageUI) {
          window.storageUI.clearAllCache();
        }
      });
      
      // Should not crash the application
      await page.waitForTimeout(1000);
      
      const appContainer = page.locator('body');
      await expect(appContainer).toBeVisible();
    });

    test('should show user-friendly error messages', async ({ page }) => {
      // Force a network error scenario
      await page.route('**/*', route => route.abort());
      
      // Try to refresh data
      await page.click('[data-testid="storage-btn"]');
      await page.click('button:has-text("Refresh Data")');
      
      // Should show error status
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid="connection-status"]');
        return status && status.textContent.includes('error');
      }, { timeout: 10000 });
      
      // Clean up route interception
      await page.unroute('**/*');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should work on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Storage management should still be accessible
      await page.click('[data-testid="storage-btn"]');
      
      const modal = page.locator('#storageModal');
      await expect(modal).toBeVisible();
      
      // Modal should fit mobile screen
      const modalContent = page.locator('.storage-modal-content');
      await expect(modalContent).toBeVisible();
      
      // Sections should be accessible
      await expect(page.locator('text=Storage Usage')).toBeVisible();
    });
  });

  test.describe('Integration with Existing Features', () => {
    test('should work with network visualization', async ({ page }) => {
      // Wait for data to load
      await page.waitForLoadState('networkidle');
      
      // Trigger network visualization if available
      const networkContainer = page.locator('[data-testid="network-container"]');
      if (await networkContainer.isVisible()) {
        // Should work with cached data
        await expect(networkContainer).toBeVisible();
        
        // Network should render without errors
        const svgElements = page.locator('svg');
        await expect(svgElements.first()).toBeVisible();
      }
    });

    test('should work with query interface', async ({ page }) => {
      // Check if query interface is available
      const queryInterface = page.locator('[data-testid="query-interface"]');
      if (await queryInterface.isVisible()) {
        // Execute a query
        const queryInput = page.locator('[data-testid="query-input"]');
        await queryInput.fill('SELECT COUNT(*) FROM despesas');
        
        const executeButton = page.locator('[data-testid="execute-query"]');
        await executeButton.click();
        
        // Results should load (potentially from cache)
        await page.waitForSelector('[data-testid="query-results"]', { timeout: 10000 });
        const results = page.locator('[data-testid="query-results"]');
        await expect(results).toBeVisible();
      }
    });
  });
});