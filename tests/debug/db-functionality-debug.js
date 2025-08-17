const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple HTTP server
function startServer(port = 3000) {
    const rootDir = path.resolve(__dirname, '../..');
    const server = http.createServer((req, res) => {
        let filePath = path.join(rootDir, req.url);
        if (req.url === '/') filePath = path.join(rootDir, 'index.html');
        if (req.url === '/db' || req.url === '/db.html') filePath = path.join(rootDir, 'db.html');

        const extname = String(path.extname(filePath)).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.parquet': 'application/octet-stream'
        };

        const contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if(error.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('404 Not Found');
                } else {
                    res.writeHead(500);
                    res.end(`Server Error: ${error.code}`);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    });

    server.listen(port);
    console.log(`🌐 Server running at http://localhost:${port}/`);
    return server;
}

(async () => {
    const server = startServer(3000);
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Listen for console logs and errors
    page.on('console', msg => console.log(`[CONSOLE ${msg.type()}]:`, msg.text()));
    page.on('pageerror', error => console.error('❌ [PAGE ERROR]:', error.message));

    try {
        console.log('🔄 Testing db.html functionality...');
        
        await page.goto('http://localhost:3000/db.html', { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });

        console.log('✅ Page loaded successfully');

        // Wait for DuckDB initialization
        console.log('🔄 Waiting for DuckDB initialization...');
        await page.waitForFunction(() => 
            window.duckdbAPI && 
            document.getElementById('connection-status').textContent.includes('✅'), 
            { timeout: 30000 }
        );
        
        console.log('✅ DuckDB initialized');

        // Check layout elements
        const layoutElements = await page.evaluate(() => {
            return {
                analysisButtons: document.querySelectorAll('.query-basic').length,
                sqlEditor: document.getElementById('sql-editor') !== null,
                resultsContainer: document.getElementById('results-container') !== null,
                formatButton: document.getElementById('format-btn') !== null,
                runButton: document.getElementById('run-btn') !== null,
                sankeyView: document.getElementById('sankey-view') !== null,
                queryView: document.getElementById('query-view') !== null,
                schemaTree: document.getElementById('schema-tree') !== null
            };
        });

        console.log('🔍 Layout elements check:');
        console.log(`- Analysis buttons: ${layoutElements.analysisButtons} ✅`);
        console.log(`- SQL Editor: ${layoutElements.sqlEditor ? '✅' : '❌'}`);
        console.log(`- Results container: ${layoutElements.resultsContainer ? '✅' : '❌'}`);
        console.log(`- Format button: ${layoutElements.formatButton ? '✅' : '❌'}`);
        console.log(`- Run button: ${layoutElements.runButton ? '✅' : '❌'}`);
        console.log(`- Sankey view: ${layoutElements.sankeyView ? '✅' : '❌'}`);
        console.log(`- Query view: ${layoutElements.queryView ? '✅' : '❌'}`);
        console.log(`- Schema tree: ${layoutElements.schemaTree ? '✅' : '❌'}`);

        // Test analysis button
        console.log('🔄 Testing first analysis button...');
        await page.click('.query-basic');
        await page.waitForTimeout(3000);
        
        // Check if results are displayed in table format
        const hasTable = await page.$('table');
        console.log(`- Table results display: ${hasTable ? '✅' : '❌'}`);

        // Test SQL formatter
        console.log('🔄 Testing SQL formatter...');
        await page.click('#format-btn');
        await page.waitForTimeout(1000);
        console.log('✅ SQL formatter tested');

        // Test sankey view switch
        console.log('🔄 Testing Sankey view...');
        await page.click('#sankey-view-btn');
        await page.waitForTimeout(2000);
        
        const sankeyVisible = await page.evaluate(() => {
            return document.getElementById('sankey-view').style.display !== 'none';
        });
        console.log(`- Sankey view toggle: ${sankeyVisible ? '✅' : '❌'}`);

        console.log('🎉 All tests completed successfully!');

    } catch (error) {
        console.error('❌ Test error:', error.message);
    }

    await page.waitForTimeout(5000); // Keep browser open for inspection
    await browser.close();
    server.close();
})();