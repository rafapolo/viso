import { test, expect } from '@playwright/test';

test.describe('Scroll Debug Test', () => {
  test('should debug why scrolling is not working', async ({ page }) => {
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
          </div>
          <div class="flex-1 flex flex-col min-h-0">
            <div class="node-info-scroll-container">
              ${Array.from({length: 20}, (_, i) => `
                <div class="transaction-card bg-gray-800/50 backdrop-blur-sm border border-gray-600/30 rounded-lg p-3 mb-2">
                  <div class="text-sm font-medium text-white">Transaction ${i + 1}</div>
                  <div class="text-xs text-gray-400">R$ ${(Math.random() * 10000).toFixed(2)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    });
    
    // Wait for content
    await page.waitForTimeout(1000);
    
    // Debug the scroll container and all its parents
    const scrollContainer = page.locator('.node-info-scroll-container');
    
    const debugInfo = await scrollContainer.evaluate((element) => {
      const info = {
        element: {},
        parents: []
      };
      
      // Get current element info
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      info.element = {
        tagName: element.tagName,
        className: element.className,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        offsetHeight: element.offsetHeight,
        scrollTop: element.scrollTop,
        rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
        styles: {
          position: style.position,
          overflow: style.overflow,
          overflowY: style.overflowY,
          overflowX: style.overflowX,
          maxHeight: style.maxHeight,
          height: style.height,
          flex: style.flex,
          minHeight: style.minHeight,
          display: style.display,
          flexDirection: style.flexDirection
        }
      };
      
      // Check all parent elements for potential interference
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const parentStyle = window.getComputedStyle(parent);
        const parentRect = parent.getBoundingClientRect();
        
        info.parents.push({
          tagName: parent.tagName,
          className: parent.className,
          id: parent.id,
          rect: { width: parentRect.width, height: parentRect.height },
          styles: {
            position: parentStyle.position,
            overflow: parentStyle.overflow,
            overflowY: parentStyle.overflowY,
            maxHeight: parentStyle.maxHeight,
            height: parentStyle.height,
            flex: parentStyle.flex,
            display: parentStyle.display,
            flexDirection: parentStyle.flexDirection
          }
        });
        
        parent = parent.parentElement;
      }
      
      return info;
    });
    
    console.log('SCROLL DEBUG INFO:');
    console.log('Element:', JSON.stringify(debugInfo.element, null, 2));
    console.log('Parents:', JSON.stringify(debugInfo.parents, null, 2));
    
    // Try different approaches to scroll
    const scrollTests = await scrollContainer.evaluate((element) => {
      const results = {};
      
      // Test 1: Direct scrollTop
      element.scrollTop = 50;
      results.directScrollTop = element.scrollTop;
      
      // Test 2: scrollTo method
      element.scrollTo(0, 100);
      results.scrollToMethod = element.scrollTop;
      
      // Test 3: Check if element can scroll at all
      const originalScrollTop = element.scrollTop;
      element.scrollTop = 999999; // Try to scroll to bottom
      const maxScrollTop = element.scrollTop;
      element.scrollTop = originalScrollTop; // Reset
      results.maxPossibleScroll = maxScrollTop;
      
      // Test 4: Check if there are event listeners preventing scroll
      results.hasScrollEventListeners = element.onscroll !== null;
      
      return results;
    });
    
    console.log('SCROLL TESTS:', scrollTests);
    
    // This test is for debugging only
    expect(true).toBe(true);
  });
});