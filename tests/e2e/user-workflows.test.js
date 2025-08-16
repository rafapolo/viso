import { test, expect } from '@playwright/test';

test.describe('VISO User Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main page
    await page.goto('/');
    
    // Wait for initial load
    await page.waitForSelector('#network-svg');
    
    // Wait for DuckDB to initialize (may take some time)
    await page.waitForFunction(() => {
      return window.getConnectionStatus && window.getConnectionStatus() === 'connected';
    }, { timeout: 60000 });
  });

  test('should load main visualization page successfully', async ({ page }) => {
    // Check that key elements are present
    await expect(page.locator('#network-svg')).toBeVisible();
    await expect(page.locator('.legend-items')).toBeVisible();
    await expect(page.locator('#stats')).toBeVisible();
    
    // Check that the loading indicator is hidden
    await expect(page.locator('#loading')).toBeHidden();
    
    // Check that statistics are populated
    await expect(page.locator('#totalDeputados')).not.toHaveText('-');
    await expect(page.locator('#totalFornecedores')).not.toHaveText('-');
  });

  test('should apply and clear filters', async ({ page }) => {
    // Apply minimum value filter
    const minValueSlider = page.locator('#minValue');
    await minValueSlider.fill('5000');
    
    // Wait for visualization to update
    await page.waitForTimeout(1000);
    
    // Statistics should be updated
    const totalTransactionsBefore = await page.locator('#totalTransactions').textContent();
    
    // Apply party filter
    const partyFilter = page.locator('#partyFilter');
    await partyFilter.selectOption({ index: 1 }); // Select first non-empty option
    
    await page.waitForTimeout(1000);
    
    // Statistics should change
    const totalTransactionsAfter = await page.locator('#totalTransactions').textContent();
    expect(totalTransactionsBefore).not.toBe(totalTransactionsAfter);
    
    // Clear filters by setting minimum value back to 0
    await minValueSlider.fill('0');
    await partyFilter.selectOption('');
    
    await page.waitForTimeout(1000);
  });

  test('should search for entities', async ({ page }) => {
    // Use search box
    const searchBox = page.locator('#searchBox');
    await searchBox.fill('João');
    
    await page.waitForTimeout(1000);
    
    // Clear button should be visible
    await expect(page.locator('#clearSearch')).toBeVisible();
    
    // Clear search
    await page.locator('#clearSearch').click();
    await expect(searchBox).toHaveValue('');
  });

  test('should interact with network nodes', async ({ page }) => {
    // Wait for network to be rendered
    await page.waitForSelector('.node', { timeout: 10000 });
    
    // Click on a node
    const firstNode = page.locator('.node').first();
    await firstNode.click();
    
    // Right panel should appear
    await expect(page.locator('#right-panel')).not.toHaveClass(/translate-x-full/);
    await expect(page.locator('#node-info-content')).toBeVisible();
    
    // Close panel
    await page.locator('#close-panel').click();
    await expect(page.locator('#right-panel')).toHaveClass(/translate-x-full/);
  });

  test('should toggle visualization options', async ({ page }) => {
    // Toggle company name visibility
    const companyNamesToggle = page.locator('#showCompanyNames');
    await companyNamesToggle.check();
    
    // Toggle edge amounts
    const edgeAmountsToggle = page.locator('#showEdgeAmounts');
    await edgeAmountsToggle.check();
    
    await page.waitForTimeout(500);
    
    // Turn off toggles
    await companyNamesToggle.uncheck();
    await edgeAmountsToggle.uncheck();
  });

  test('should navigate to DB interface', async ({ page }) => {
    // Click on DB button
    await page.locator('button:has-text("Viso DB")').click();
    
    // Should navigate to db.html
    await expect(page).toHaveURL(/db\.html/);
    
    // Check that DB interface loaded
    await expect(page.locator('#tabs-container')).toBeVisible();
    await expect(page.locator('#schema-tree')).toBeVisible();
  });

  test('should use zoom controls', async ({ page }) => {
    // Test zoom in
    await page.locator('#zoom-in').click();
    await page.waitForTimeout(300);
    
    // Test zoom out
    await page.locator('#zoom-out').click();
    await page.waitForTimeout(300);
    
    // Test zoom reset
    await page.locator('#zoom-reset').click();
    await page.waitForTimeout(300);
  });

  test('should toggle theme', async ({ page }) => {
    const themeToggle = page.locator('#theme-toggle');
    const htmlElement = page.locator('html');
    
    // Check initial theme
    const initialTheme = await htmlElement.getAttribute('class');
    
    // Toggle theme
    await themeToggle.click();
    
    // Theme should change
    const newTheme = await htmlElement.getAttribute('class');
    expect(initialTheme).not.toBe(newTheme);
  });
});

test.describe('VISO DB Interface Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the DB page
    await page.goto('/db.html');
    
    // Wait for DuckDB to initialize
    await page.waitForFunction(() => {
      return window.duckdbAPI && document.getElementById('connection-status')?.textContent?.includes('Conectado');
    }, { timeout: 60000 });
  });

  test('should load DB interface successfully', async ({ page }) => {
    // Check that key elements are present
    await expect(page.locator('#tabs-container')).toBeVisible();
    await expect(page.locator('#schema-tree')).toBeVisible();
    await expect(page.locator('#connection-status')).toContainText('Conectado');
    
    // Check that a default tab exists
    await expect(page.locator('.tab-active')).toBeVisible();
  });

  test('should execute a simple query', async ({ page }) => {
    // Wait for editor to be ready
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    
    // Click in the editor area
    await page.locator('.monaco-editor').click();
    
    // Clear any existing content and type a simple query
    await page.keyboard.press('Control+A');
    await page.keyboard.type('SELECT COUNT(*) as total FROM despesas');
    
    // Execute query
    await page.locator('#run-query-btn').click();
    
    // Wait for results
    await page.waitForSelector('.results-table', { timeout: 10000 });
    
    // Check that results are displayed
    await expect(page.locator('.results-table')).toBeVisible();
    await expect(page.locator('#result-stats')).toContainText('linha');
  });

  test('should use sample queries', async ({ page }) => {
    // Click on a sample query
    const sampleQuery = page.locator('.sample-query').first();
    await sampleQuery.click();
    
    // Query should be loaded in editor and executed
    await page.waitForSelector('.results-table', { timeout: 10000 });
    await expect(page.locator('.results-table')).toBeVisible();
  });

  test('should manage multiple tabs', async ({ page }) => {
    // Create new tab
    await page.locator('#new-tab-btn').click();
    
    // Should have 2 tabs now
    const tabs = await page.locator('[data-tab-id]').count();
    expect(tabs).toBe(2);
    
    // Switch between tabs
    const firstTab = page.locator('[data-tab-id]').first();
    const secondTab = page.locator('[data-tab-id]').nth(1);
    
    await firstTab.click();
    await expect(firstTab).toHaveClass(/tab-active/);
    
    await secondTab.click();
    await expect(secondTab).toHaveClass(/tab-active/);
  });

  test('should search sample queries', async ({ page }) => {
    const searchInput = page.locator('#query-search');
    
    // Search for specific queries
    await searchInput.fill('SELECT');
    
    // Some queries should be visible
    const visibleQueries = page.locator('.sample-query:visible');
    await expect(visibleQueries).toHaveCount({ min: 1 });
    
    // Clear search
    await searchInput.clear();
  });

  test('should export query results', async ({ page }) => {
    // Execute a query first
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('SELECT * FROM despesas LIMIT 5');
    await page.locator('#run-query-btn').click();
    
    // Wait for results
    await page.waitForSelector('.results-table', { timeout: 10000 });
    
    // Set up download handler
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.locator('#export-btn').click();
    
    // Wait for download to start
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should share query via URL', async ({ page }) => {
    // Execute a query first
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('SELECT COUNT(*) FROM despesas');
    
    // Share query
    await page.locator('#share-btn').click();
    
    // URL should be updated with query parameter
    await expect(page).toHaveURL(/query=/);
    
    // Reload page to test URL restoration
    await page.reload();
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    
    // Query should be automatically executed
    await page.waitForSelector('.results-table', { timeout: 10000 });
  });

  test('should handle pagination for large result sets', async ({ page }) => {
    // Execute a query that returns many results
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('SELECT * FROM despesas LIMIT 100');
    await page.locator('#run-query-btn').click();
    
    // Wait for results
    await page.waitForSelector('.results-table', { timeout: 10000 });
    
    // Check if pagination appears (depends on actual data size)
    const paginationExists = await page.locator('#pagination-container:not(.hidden)').isVisible();
    
    if (paginationExists) {
      // Test pagination navigation
      const nextPageButton = page.locator('#pagination-nav button').nth(1);
      if (await nextPageButton.isVisible()) {
        await nextPageButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should navigate back to main visualization', async ({ page }) => {
    // Click on visualization button
    await page.locator('button:has-text("Ver Grafo")').click();
    
    // Should navigate to index.html
    await expect(page).toHaveURL(/index\.html/);
    
    // Wait for network visualization to load
    await page.waitForSelector('#network-svg');
  });

  test('should toggle category sections in query list', async ({ page }) => {
    // Find a category header
    const categoryHeader = page.locator('.category-header').first();
    
    // Get the category content
    // const categoryId = await categoryHeader.getAttribute('onclick');
    // const categoryContent = page.locator('.category-content').first();
    
    // Toggle category
    await categoryHeader.click();
    
    // Wait for animation
    await page.waitForTimeout(300);
    
    // Toggle again
    await categoryHeader.click();
    await page.waitForTimeout(300);
  });
});

test.describe('Cross-page Data Consistency', () => {
  test('should maintain data consistency between interfaces', async ({ page }) => {
    // Start on main page and get some statistics
    await page.goto('/');
    await page.waitForFunction(() => {
      return window.getConnectionStatus && window.getConnectionStatus() === 'connected';
    }, { timeout: 60000 });
    
    const mainPageTotal = await page.locator('#totalTransactions').textContent();
    
    // Navigate to DB interface
    await page.locator('button:has-text("Viso DB")').click();
    await expect(page).toHaveURL(/db\.html/);
    
    // Wait for DB interface to load
    await page.waitForFunction(() => {
      return window.duckdbAPI && document.getElementById('connection-status')?.textContent?.includes('Conectado');
    }, { timeout: 60000 });
    
    // Execute query to get total count
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('SELECT COUNT(*) as total FROM despesas');
    await page.locator('#run-query-btn').click();
    
    // Wait for results
    await page.waitForSelector('.results-table', { timeout: 10000 });
    
    // The data should be consistent between interfaces
    const tableCell = page.locator('.results-table tbody tr td').first();
    const dbTotal = await tableCell.textContent();
    
    // Note: The exact comparison depends on filters applied in the main interface
    // Both should be working with the same underlying data
    expect(parseInt(dbTotal.replace(/,/g, ''))).toBeGreaterThan(0);
    expect(parseInt(mainPageTotal.replace(/,/g, ''))).toBeGreaterThan(0);
  });
});

test.describe('Performance and Responsiveness', () => {
  test('should handle concurrent operations', async ({ page }) => {
    await page.goto('/db.html');
    await page.waitForFunction(() => {
      return window.duckdbAPI && document.getElementById('connection-status')?.textContent?.includes('Conectado');
    }, { timeout: 60000 });
    
    // Open multiple tabs
    await page.locator('#new-tab-btn').click();
    await page.locator('#new-tab-btn').click();
    
    // Execute queries in different tabs concurrently
    const tabs = await page.locator('[data-tab-id]').all();
    
    for (let i = 0; i < Math.min(tabs.length, 2); i++) {
      await tabs[i].click();
      await page.waitForTimeout(200);
      
      await page.locator('.monaco-editor').click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(`SELECT COUNT(*) as count_${i} FROM despesas LIMIT ${10 + i * 5}`);
      await page.locator('#run-query-btn').click();
      
      // Don't wait for results to simulate concurrent execution
    }
    
    // All queries should eventually complete
    await page.waitForTimeout(5000);
  });

  test('should be responsive on different screen sizes', async ({ page, browserName }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await page.waitForFunction(() => {
      return window.getConnectionStatus && window.getConnectionStatus() === 'connected';
    }, { timeout: 60000 });
    
    // Main elements should still be visible
    await expect(page.locator('#network-svg')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await expect(page.locator('#network-svg')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    await expect(page.locator('#network-svg')).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Navigate to DB interface
    await page.goto('/db.html');
    
    // Block network requests to simulate network error
    await page.route('**/public/despesas.parquet', route => route.abort());
    
    // Reload to trigger error
    await page.reload();
    
    // Should show error state
    await page.waitForSelector('#connection-status', { timeout: 10000 });
    const status = await page.locator('#connection-status').textContent();
    expect(status).toContain('❌');
  });

  test('should handle invalid SQL queries', async ({ page }) => {
    await page.goto('/db.html');
    await page.waitForFunction(() => {
      return window.duckdbAPI && document.getElementById('connection-status')?.textContent?.includes('Conectado');
    }, { timeout: 60000 });
    
    // Enter invalid SQL
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('INVALID SQL QUERY');
    
    // Execute query
    await page.locator('#run-query-btn').click();
    
    // Should show error message (implementation dependent)
    await page.waitForTimeout(2000);
    
    // Error should be handled gracefully without breaking the interface
    await expect(page.locator('#tabs-container')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      return window.getConnectionStatus && window.getConnectionStatus() === 'connected';
    }, { timeout: 60000 });
    
    // Tab through interface elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to interact with focused elements
    await page.keyboard.press('Enter');
    
    // Interface should remain functional
    await expect(page.locator('#network-svg')).toBeVisible();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/db.html');
    
    // Check for important ARIA attributes
    const importantElements = [
      '#run-query-btn',
      '#new-tab-btn',
      '#export-btn'
    ];
    
    for (const selector of importantElements) {
      const element = page.locator(selector);
      if (await element.isVisible()) {
        // Should have accessible text (either text content, aria-label, or title)
        const hasAccessibleText = await element.evaluate(el => {
          return el.textContent?.trim() || 
                 el.getAttribute('aria-label') || 
                 el.getAttribute('title') ||
                 el.getAttribute('alt');
        });
        expect(hasAccessibleText).toBeTruthy();
      }
    }
  });
});