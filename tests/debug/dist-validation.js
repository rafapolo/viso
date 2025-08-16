const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Simple static file server for testing dist
function createStaticServer(distDir, port = 3001) {
    const server = http.createServer((req, res) => {
        let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url);
        
        // Handle routing
        if (req.url === '/db' || req.url === '/db.html') {
            filePath = path.join(distDir, 'db.html');
        }
        
        const extname = path.extname(filePath);
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ttf': 'font/ttf',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.parquet': 'application/octet-stream'
        };

        const contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('File not found');
                } else {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end(`Server Error: ${error.code}`);
                }
            } else {
                res.writeHead(200, { 
                    'Content-Type': contentType,
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                });
                res.end(content);
            }
        });
    });

    return new Promise((resolve, reject) => {
        server.listen(port, (err) => {
            if (err) {
                reject(err);
            } else {
                console.log(`📁 Static server running on http://localhost:${port}`);
                resolve(server);
            }
        });
    });
}

async function testDistBuild() {
    const distDir = path.resolve(__dirname, '../../dist');
    console.log(`🔍 Testing dist build in: ${distDir}`);

    // Check if dist directory exists
    if (!fs.existsSync(distDir)) {
        console.error('❌ Dist directory not found. Please run `npm run build` first.');
        return false;
    }

    // Start static server
    let server;
    try {
        server = await createStaticServer(distDir, 3001);
    } catch (error) {
        console.error('❌ Failed to start static server:', error.message);
        return false;
    }

    // Launch browser for testing
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Listen for console logs and errors
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error') {
            console.log(`🔴 [BROWSER ERROR]: ${text}`);
        } else if (type === 'warn') {
            console.log(`🟡 [BROWSER WARN]: ${text}`);
        } else if (type === 'info') {
            console.log(`ℹ️  [BROWSER INFO]: ${text}`);
        }
    });

    page.on('pageerror', error => {
        console.error('❌ [PAGE ERROR]:', error.message);
    });

    const testResults = {
        indexPage: false,
        dbPage: false,
        assetsLoaded: false,
        jsExecution: false
    };

    try {
        console.log('🔄 Testing index.html...');
        
        // Test index page
        await page.goto('http://localhost:3001/', { 
            waitUntil: 'domcontentloaded',
            timeout: 15000 
        });

        // Wait for page to load
        await page.waitForTimeout(3000);

        // Check if main elements exist
        const indexElements = await page.evaluate(() => {
            return {
                hasNetworkSvg: document.querySelector('#network-svg') !== null,
                hasStats: document.querySelector('#stats') !== null,
                hasFilters: document.querySelector('.filters') !== null,
                hasLegend: document.querySelector('.legend') !== null,
                documentTitle: document.title,
                scriptsLoaded: window.d3 !== undefined || window.duckdbAPI !== undefined
            };
        });

        if (indexElements.hasNetworkSvg && indexElements.hasStats) {
            testResults.indexPage = true;
            console.log('✅ Index page loaded successfully');
            console.log(`   - Title: ${indexElements.documentTitle}`);
            console.log(`   - Network SVG: ${indexElements.hasNetworkSvg ? '✅' : '❌'}`);
            console.log(`   - Stats section: ${indexElements.hasStats ? '✅' : '❌'}`);
            console.log(`   - Filters: ${indexElements.hasFilters ? '✅' : '❌'}`);
            console.log(`   - Legend: ${indexElements.hasLegend ? '✅' : '❌'}`);
        }

        console.log('🔄 Testing db.html...');
        
        // Test DB page
        await page.goto('http://localhost:3001/db.html', { 
            waitUntil: 'domcontentloaded',
            timeout: 15000 
        });

        // Wait for page to load
        await page.waitForTimeout(5000);

        // Check if DB elements exist
        const dbElements = await page.evaluate(() => {
            return {
                hasQueryContainer: document.querySelector('#query-container') !== null,
                hasResultsContainer: document.querySelector('#results-container') !== null,
                hasSqlEditor: document.querySelector('#sql-editor') !== null,
                hasRunButton: document.querySelector('#run-btn') !== null,
                hasFormatButton: document.querySelector('#format-btn') !== null,
                hasAnalysisButtons: document.querySelectorAll('.query-basic').length,
                documentTitle: document.title,
                monacoLoaded: window.monaco !== undefined,
                duckdbLoaded: window.duckdbAPI !== undefined
            };
        });

        if (dbElements.hasQueryContainer && dbElements.hasResultsContainer) {
            testResults.dbPage = true;
            console.log('✅ DB page loaded successfully');
            console.log(`   - Title: ${dbElements.documentTitle}`);
            console.log(`   - Query container: ${dbElements.hasQueryContainer ? '✅' : '❌'}`);
            console.log(`   - Results container: ${dbElements.hasResultsContainer ? '✅' : '❌'}`);
            console.log(`   - SQL Editor: ${dbElements.hasSqlEditor ? '✅' : '❌'}`);
            console.log(`   - Run button: ${dbElements.hasRunButton ? '✅' : '❌'}`);
            console.log(`   - Format button: ${dbElements.hasFormatButton ? '✅' : '❌'}`);
            console.log(`   - Analysis buttons: ${dbElements.hasAnalysisButtons}`);
            console.log(`   - Monaco Editor: ${dbElements.monacoLoaded ? '✅' : '❌'}`);
            console.log(`   - DuckDB API: ${dbElements.duckdbLoaded ? '✅' : '❌'}`);
        }

        // Test JavaScript execution
        if (indexElements.scriptsLoaded || dbElements.monacoLoaded || dbElements.duckdbLoaded) {
            testResults.jsExecution = true;
            console.log('✅ JavaScript execution working');
        }

        // Test assets loading
        const response = await page.goto('http://localhost:3001/assets/main-D-7RWwrf.js');
        if (response && response.status() === 200) {
            testResults.assetsLoaded = true;
            console.log('✅ Assets loading correctly');
        }

    } catch (error) {
        console.error('❌ Error during testing:', error.message);
    }

    // Clean up
    await page.waitForTimeout(3000); // Keep browser open for a moment
    await browser.close();
    server.close();

    // Summary
    console.log('\n📊 Test Results Summary:');
    console.log(`   - Index page: ${testResults.indexPage ? '✅' : '❌'}`);
    console.log(`   - DB page: ${testResults.dbPage ? '✅' : '❌'}`);
    console.log(`   - Assets loading: ${testResults.assetsLoaded ? '✅' : '❌'}`);
    console.log(`   - JavaScript execution: ${testResults.jsExecution ? '✅' : '❌'}`);

    const allPassed = Object.values(testResults).every(result => result === true);
    
    if (allPassed) {
        console.log('\n🎉 All dist tests passed! The build is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Check the output above for details.');
    }

    return allPassed;
}

// Run the test
if (require.main === module) {
    testDistBuild()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Fatal error during dist testing:', error);
            process.exit(1);
        });
}

module.exports = { testDistBuild };