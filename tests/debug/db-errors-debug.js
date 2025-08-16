const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Listen for console logs and errors
  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}]:`, msg.text());
  });

  page.on('pageerror', error => {
    console.error('❌ [PAGE ERROR]:', error.message);
  });

  try {
    console.log('🔄 Loading db.html...');
    await page.goto(`file://${path.resolve(__dirname, '../../db.html')}`, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });

    console.log('✅ Page loaded, waiting for JavaScript execution...');
    
    // Wait a bit for scripts to run
    await page.waitForTimeout(5000);
    
    // Check what's available in window
    const windowObjects = await page.evaluate(() => {
      return {
        hasMonaco: typeof window.monaco !== 'undefined',
        hasDuckdbAPI: typeof window.duckdbAPI !== 'undefined',
        hasRequire: typeof window.require !== 'undefined',
        loadingScreenVisible: document.getElementById('loading-screen') ? document.getElementById('loading-screen').style.display !== 'none' : false,
        mainContainerVisible: document.getElementById('main-container') ? document.getElementById('main-container').style.display !== 'none' : false,
        documentReady: document.readyState
      };
    });

    console.log('🔍 Window objects:', windowObjects);

    // Check if there are any specific error elements
    const errorElements = await page.$$('.error, [id*="error"]');
    console.log(`🔍 Error elements found: ${errorElements.length}`);

  } catch (error) {
    console.error('❌ Error during error test:', error.message);
  }

  await page.waitForTimeout(10000); // Keep browser open longer to inspect
  await browser.close();
})();