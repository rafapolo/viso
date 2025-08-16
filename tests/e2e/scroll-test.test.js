import { test, expect } from '@playwright/test';

test.describe('Node Info Scroll Container', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main page
    await page.goto('/');
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Debug: check current URL and page content
    console.log('Current URL:', page.url());
    
    // Wait for the network visualization container to be ready
    await page.waitForSelector('svg', { timeout: 30000 });
    
    // Wait a bit more for data to load and nodes to render
    await page.waitForTimeout(5000);
    
    // Check if we have nodes, if not, try to trigger data load
    const nodeCount = await page.locator('.node').count();
    console.log(`Found ${nodeCount} nodes on page`);
    
    if (nodeCount === 0) {
      // Try clicking a sample query or running default data load
      const hasQueries = await page.locator('.sample-query').count();
      if (hasQueries > 0) {
        await page.locator('.sample-query').first().click();
        await page.waitForTimeout(3000);
      }
    }
  });

  test('should scroll in node-info-scroll-container', async ({ page }) => {
    // Click on a node to open the right panel
    const firstNode = page.locator('.node').first();
    await firstNode.click();
    
    // Wait for right panel to appear
    await expect(page.locator('#right-panel')).not.toHaveClass(/translate-x-full/);
    await expect(page.locator('#node-info-content')).toBeVisible();
    
    // Wait for the scroll container to be populated
    await page.waitForSelector('.node-info-scroll-container', { timeout: 5000 });
    
    // Check if scroll container exists and is visible
    const scrollContainer = page.locator('.node-info-scroll-container');
    await expect(scrollContainer).toBeVisible();
    
    // Check if container has transaction cards
    const transactionCards = scrollContainer.locator('.transaction-card');
    const cardCount = await transactionCards.count();
    
    console.log(`Found ${cardCount} transaction cards`);
    
    // If we have cards, check scrolling properties
    if (cardCount > 0) {
      // Get scroll container element properties
      const containerInfo = await scrollContainer.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          offsetHeight: element.offsetHeight,
          scrollTop: element.scrollTop,
          overflowY: window.getComputedStyle(element).overflowY,
          maxHeight: window.getComputedStyle(element).maxHeight,
          height: rect.height,
          hasVerticalScrollbar: element.scrollHeight > element.clientHeight
        };
      });
      
      console.log('Container info:', containerInfo);
      
      // Check if the container is scrollable
      expect(containerInfo.overflowY).toBe('auto');
      
      // If content exceeds container height, there should be a scrollbar
      if (containerInfo.hasVerticalScrollbar) {
        // Try to scroll
        await scrollContainer.evaluate((element) => {
          element.scrollTop = 50;
        });
        
        // Check if scroll actually happened
        const newScrollTop = await scrollContainer.evaluate((element) => element.scrollTop);
        expect(newScrollTop).toBeGreaterThan(0);
        
        console.log(`Successfully scrolled to position: ${newScrollTop}`);
      } else {
        console.log('Container doesn\'t need scrolling - content fits within height');
      }
    } else {
      console.log('No transaction cards found - need to check data loading');
    }
  });

  test('should have proper container dimensions', async ({ page }) => {
    // Click on a node to open the right panel
    const firstNode = page.locator('.node').first();
    await firstNode.click();
    
    // Wait for right panel to appear
    await expect(page.locator('#right-panel')).not.toHaveClass(/translate-x-full/);
    
    // Wait for the scroll container
    await page.waitForSelector('.node-info-scroll-container', { timeout: 5000 });
    
    const scrollContainer = page.locator('.node-info-scroll-container');
    
    // Check CSS properties
    const styles = await scrollContainer.evaluate((element) => {
      const computed = window.getComputedStyle(element);
      return {
        maxHeight: computed.maxHeight,
        overflowY: computed.overflowY,
        flex: computed.flex,
        minHeight: computed.minHeight
      };
    });
    
    console.log('Container styles:', styles);
    
    // Verify the CSS properties we set
    expect(styles.maxHeight).toBe('400px');
    expect(styles.overflowY).toBe('auto');
    expect(styles.flex).toBe('1 1 0%');
    expect(styles.minHeight).toBe('0px');
  });
});