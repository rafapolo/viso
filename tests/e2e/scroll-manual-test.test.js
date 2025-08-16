import { test, expect } from '@playwright/test';

test.describe('Manual Scroll Container Test', () => {
  test('should test scroll container with mock data', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Manually inject test content to test scrolling
    await page.evaluate(() => {
      // Make sure right panel is visible
      const rightPanel = document.querySelector('#right-panel');
      if (rightPanel) {
        rightPanel.classList.remove('translate-x-full');
      }
      
      // Find or create the node info content area
      let nodeInfoContent = document.querySelector('#node-info-content');
      if (!nodeInfoContent) {
        const nodeInfoSection = document.querySelector('#node-info-section');
        if (nodeInfoSection) {
          nodeInfoContent = document.createElement('div');
          nodeInfoContent.id = 'node-info-content';
          nodeInfoContent.className = 'p-4 flex flex-col flex-1 min-h-0';
          nodeInfoSection.appendChild(nodeInfoContent);
        }
      }
      
      if (nodeInfoContent) {
        // Create mock content with scrollable container
        nodeInfoContent.innerHTML = `
          <div class="pb-3 border-b border-gray-600 mb-3">
            <h4 class="text-base font-bold text-blue-500 mb-1">Test Node</h4>
            <div class="flex justify-between items-center text-xs text-gray-400 mb-1">
              <span>Test data for scrolling</span>
            </div>
          </div>
          <div class="flex-1 flex flex-col min-h-0">
            <div class="node-info-scroll-container">
              ${Array.from({length: 50}, (_, i) => `
                <div class="transaction-card bg-gray-800/50 backdrop-blur-sm border border-gray-600/30 rounded-lg p-3 hover:bg-gray-700/70 hover:border-gray-500/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md border-l-4 border-l-blue-500 mb-2">
                  <div class="text-sm font-medium text-white">Transaction ${i + 1}</div>
                  <div class="text-xs text-gray-400">R$ ${(Math.random() * 10000).toFixed(2)}</div>
                  <div class="text-xs text-gray-500">Category: Test</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    });
    
    // Wait for the content to be rendered
    await page.waitForTimeout(1000);
    
    // Check if scroll container exists and is visible
    const scrollContainer = page.locator('.node-info-scroll-container');
    await expect(scrollContainer).toBeVisible();
    
    // Check CSS properties
    const styles = await scrollContainer.evaluate((element) => {
      const computed = window.getComputedStyle(element);
      return {
        maxHeight: computed.maxHeight,
        overflowY: computed.overflowY,
        flex: computed.flex,
        minHeight: computed.minHeight,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        hasVerticalScrollbar: element.scrollHeight > element.clientHeight
      };
    });
    
    console.log('Container styles and dimensions:', styles);
    
    // Verify the CSS properties we set
    expect(styles.maxHeight).toBe('400px');
    expect(styles.overflowY).toBe('auto');
    
    // Check if container is scrollable (content exceeds container height)
    expect(styles.hasVerticalScrollbar).toBe(true);
    expect(styles.scrollHeight).toBeGreaterThan(styles.clientHeight);
    
    // Test actual scrolling functionality
    const initialScrollTop = await scrollContainer.evaluate((element) => element.scrollTop);
    expect(initialScrollTop).toBe(0);
    
    // Scroll down
    await scrollContainer.evaluate((element) => {
      element.scrollTop = 100;
    });
    
    // Check if scroll actually happened
    const newScrollTop = await scrollContainer.evaluate((element) => element.scrollTop);
    expect(newScrollTop).toBe(100);
    
    // Test scrolling via wheel event
    await scrollContainer.hover();
    await page.mouse.wheel(0, 200);
    
    // Check if wheel scroll worked
    const finalScrollTop = await scrollContainer.evaluate((element) => element.scrollTop);
    expect(finalScrollTop).toBeGreaterThan(100);
    
    console.log(`Scroll test passed: initial=${initialScrollTop}, programmatic=${newScrollTop}, wheel=${finalScrollTop}`);
  });
});