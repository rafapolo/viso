const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔄 Loading db.html...');
    await page.goto(`file://${path.resolve(__dirname, '../../db.html')}`, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    console.log('✅ Page loaded successfully');

    // Wait for DuckDB to initialize
    console.log('🔄 Waiting for DuckDB initialization...');
    await page.waitForFunction(() => window.duckdbAPI && window.duckdbAPI.getConnectionStatus, { timeout: 10000 });
    
    // Check if main containers are visible
    const mainContainer = await page.$('#main-container');
    const queryContainer = await page.$('#query-container');
    const resultsContainer = await page.$('#results-container');
    const schemaPanel = await page.$('#schema-panel');
    
    console.log('🔍 Checking layout elements:');
    console.log('- Main container:', mainContainer ? '✅' : '❌');
    console.log('- Query container:', queryContainer ? '✅' : '❌');
    console.log('- Results container:', resultsContainer ? '✅' : '❌');
    console.log('- Schema panel:', schemaPanel ? '✅' : '❌');

    // Check if análise buttons exist and are clickable
    const analiseButtons = await page.$$('button[onclick*="analise"], .analise-btn, [data-query*="analise"]');
    console.log(`🔍 Found ${analiseButtons.length} análise buttons`);

    // Test sample query buttons
    const sampleQueryButtons = await page.$$('.query-basic');
    console.log(`🔍 Found ${sampleQueryButtons.length} sample query buttons`);

    if (sampleQueryButtons.length > 0) {
      console.log('🔄 Testing first sample query button...');
      await sampleQueryButtons[0].click();
      await page.waitForTimeout(2000);
      console.log('✅ Sample query button clicked successfully');
    }

    // Check if Monaco editor loaded
    const editorExists = await page.evaluate(() => window.monaco !== undefined);
    console.log('- Monaco Editor:', editorExists ? '✅' : '❌');

    // Check if DuckDB API is available
    const duckdbAPIExists = await page.evaluate(() => window.duckdbAPI !== undefined);
    console.log('- DuckDB API:', duckdbAPIExists ? '✅' : '❌');

    console.log('✅ Layout verification completed successfully');

  } catch (error) {
    console.error('❌ Error during layout test:', error.message);
  }

  await page.waitForTimeout(5000); // Keep browser open for 5 seconds to inspect
  await browser.close();
})();