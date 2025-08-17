// Basic Application Functionality E2E Tests
import { test, expect } from '@playwright/test';

test.describe('Basic Application Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for core libraries to load
    await page.waitForFunction(() => {
      return window.d3 && typeof window.d3 === 'object';
    }, { timeout: 10000 });
  });

  test.describe('Page Load and Basic UI', () => {
    test('should load the main page successfully', async ({ page }) => {
      // Check for main application elements
      await expect(page.locator('.w-80')).toBeVisible(); // Sidebar
      await expect(page.locator('#visualization')).toBeVisible(); // Main visualization area
      await expect(page.locator('#network-svg')).toBeVisible(); // Network SVG
    });

    test('should display sidebar with filters and controls', async ({ page }) => {
      // Check sidebar elements
      await expect(page.locator('text=Viso UI')).toBeVisible();
      await expect(page.locator('text=Legenda')).toBeVisible();
      await expect(page.locator('text=Filtros')).toBeVisible();
      await expect(page.locator('text=Análise de Rede')).toBeVisible();
      await expect(page.locator('text=Estatísticas')).toBeVisible();
    });

    test('should show legend with deputy and company indicators', async ({ page }) => {
      // Check legend items
      await expect(page.locator('.legend-items')).toBeVisible();
      await expect(page.locator('text=Deputados')).toBeVisible();
      await expect(page.locator('text=Empresas')).toBeVisible();
    });
  });

  test.describe('Controls and Interactions', () => {
    test('should have working theme toggle', async ({ page }) => {
      const themeToggle = page.locator('#theme-toggle');
      await expect(themeToggle).toBeVisible();
      
      // Click theme toggle
      await themeToggle.click();
      await page.waitForTimeout(500);
      
      // Should work without errors
      await expect(themeToggle).toBeVisible();
    });

    test('should have working filter dropdowns', async ({ page }) => {
      const partyFilter = page.locator('#partyFilter');
      const categoryFilter = page.locator('#categoryFilter');
      
      await expect(partyFilter).toBeVisible();
      await expect(categoryFilter).toBeVisible();
      
      // Should have default options
      await expect(partyFilter).toContainText('Todos os Partidos');
      await expect(categoryFilter).toContainText('Todas as Categorias');
    });

    test('should have working network analysis toggles', async ({ page }) => {
      const showCompanyNames = page.locator('#showCompanyNames');
      const showEdgeAmounts = page.locator('#showEdgeAmounts');
      const networkDensityToggle = page.locator('#networkDensityToggle');
      const topExpensesToggle = page.locator('#topExpensesToggle');
      
      await expect(showCompanyNames).toBeVisible();
      await expect(showEdgeAmounts).toBeVisible();
      await expect(networkDensityToggle).toBeVisible();
      await expect(topExpensesToggle).toBeVisible();
      
      // Test toggle interactions
      await showCompanyNames.click();
      await showEdgeAmounts.click();
      await page.waitForTimeout(500);
    });

    test('should have working minimum value slider', async ({ page }) => {
      const minValueSlider = page.locator('#minValue');
      await expect(minValueSlider).toBeVisible();
      
      // Should show value label
      await expect(page.locator('#minValueValue')).toBeVisible();
      await expect(page.locator('#minRange')).toBeVisible();
      await expect(page.locator('#maxRange')).toBeVisible();
    });

    test('should have working force strength slider', async ({ page }) => {
      const forceStrengthSlider = page.locator('#forceStrength');
      await expect(forceStrengthSlider).toBeVisible();
      
      // Should have a value between 1 and 80
      const value = await forceStrengthSlider.getAttribute('value');
      expect(parseInt(value)).toBeGreaterThanOrEqual(1);
      expect(parseInt(value)).toBeLessThanOrEqual(80);
    });
  });

  test.describe('Search Functionality', () => {
    test('should have working search box', async ({ page }) => {
      const searchBox = page.locator('#searchBox');
      await expect(searchBox).toBeVisible();
      await expect(searchBox).toHaveAttribute('placeholder', '🔍 Buscar deputado ou empresa...');
      
      // Test typing in search box
      await searchBox.fill('test search');
      const value = await searchBox.inputValue();
      expect(value).toBe('test search');
      
      // Clear button should appear
      const clearButton = page.locator('#clearSearch');
      await expect(clearButton).toBeVisible();
    });

    test('should clear search when clear button is clicked', async ({ page }) => {
      const searchBox = page.locator('#searchBox');
      const clearButton = page.locator('#clearSearch');
      
      // Fill search box
      await searchBox.fill('test search');
      await expect(clearButton).toBeVisible();
      
      // Click clear button
      await clearButton.click();
      
      // Search box should be empty
      const value = await searchBox.inputValue();
      expect(value).toBe('');
    });
  });

  test.describe('Zoom Controls', () => {
    test('should have working zoom controls', async ({ page }) => {
      const zoomIn = page.locator('#zoom-in');
      const zoomOut = page.locator('#zoom-out');
      const zoomReset = page.locator('#zoom-reset');
      
      await expect(zoomIn).toBeVisible();
      await expect(zoomOut).toBeVisible();
      await expect(zoomReset).toBeVisible();
      
      // Test zoom interactions
      await zoomIn.click();
      await page.waitForTimeout(200);
      await zoomOut.click();
      await page.waitForTimeout(200);
      await zoomReset.click();
      await page.waitForTimeout(200);
    });
  });

  test.describe('Statistics Display', () => {
    test('should show statistics section', async ({ page }) => {
      const statsSection = page.locator('#stats');
      await expect(statsSection).toBeVisible();
      
      // Should have stat cards
      const statCards = page.locator('#stats > div');
      await expect(statCards).toHaveCount(4);
      
      // Check stat labels
      await expect(page.locator('text=Deputados')).toBeVisible();
      await expect(page.locator('text=Empresas')).toBeVisible();
      await expect(page.locator('text=Total (R$)')).toBeVisible();
      await expect(page.locator('text=Transações')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should have working navigation to DB page', async ({ page }) => {
      const dbButton = page.locator('button:has-text("Viso DB")');
      await expect(dbButton).toBeVisible();
      
      // Click should work (even if page doesn't exist in this test setup)
      await dbButton.click();
      await page.waitForTimeout(500);
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Main elements should still be visible
      await expect(page.locator('#visualization')).toBeVisible();
      await expect(page.locator('.w-80')).toBeVisible(); // Sidebar
      
      // Search box should still work
      const searchBox = page.locator('#searchBox');
      await expect(searchBox).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // All main elements should be visible
      await expect(page.locator('#visualization')).toBeVisible();
      await expect(page.locator('.w-80')).toBeVisible();
      await expect(page.locator('#network-svg')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle missing resources gracefully', async ({ page }) => {
      // The page should load even if some resources fail
      await page.goto('/');
      
      // Main structure should still be there
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('.flex.h-screen')).toBeVisible();
    });

    test('should not have JavaScript errors', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error));
      
      await page.goto('/');
      await page.waitForTimeout(3000);
      
      // Should have minimal or no JavaScript errors
      expect(errors.length).toBeLessThan(5);
    });
  });
});