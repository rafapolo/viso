## Project Overview

**Viso** is a standalone web-based visualization component for the POLIS project that creates interactive network visualizations of Brazilian parliamentary expenses. It shows connections between deputies (deputados) and companies (fornecedores) based on expense data, enabling exploration of business-political relationships through an intuitive graph interface.

## Architecture

The visualization is built as a self-contained web application that runs entirely in the browser:

- **Frontend**: Pure HTML/CSS/JavaScript with Tailwind CSS for styling
- **Data Processing**: DuckDB WASM for in-browser SQL queries on parquet data
- **Visualization**: D3.js force-directed network graph with zoom/pan capabilities
- **Deployment**: Static hosting compatible (GitHub Pages, Netlify, etc.)

## Key Components

### Main Files
- `index.html` - Complete web application with embedded JavaScript, CSS, and HTML
- `public/despesas.parquet` - Main expense dataset in Parquet format
- `.nojekyll` - GitHub Pages configuration file

### Data Structure
The application expects expense data with these key columns:
- `nome_parlamentar` - Deputy name
- `sigla_partido` - Political party abbreviation  
- `fornecedor` - Company/supplier name
- `categoria_despesa` - Expense category
- `valor_liquido` - Net expense value
- `ano` - Year of expense

## Development Workflows

### Local Development
```bash
# Serve the application locally
python -m http.server 8000

# Access at http://localhost:8000
```

### GitHub Pages Deployment
```bash
# 1. Push to GitHub repository
git add .
git commit -m "Deploy viso visualization"
git push origin main

# 2. Enable GitHub Pages in repository settings
# - Go to repository Settings → Pages
# - Select "Deploy from a branch"
# - Choose "main" branch and "/ (root)" folder
# - Wait for deployment (usually 1-2 minutes)

# 3. Access at https://yourusername.github.io/repository-name/
```

### Static Hosting (Netlify, Vercel, etc.)
1. Create new site from Git repository
2. Set build command: (none needed)
3. Set publish directory: `/` or leave empty
4. Deploy automatically on each push

## Key Features

### Network Visualization
- **Nodes**: Deputies (red circles) and companies (teal circles)
- **Edges**: Financial relationships with thickness based on transaction value
- **Edge Labels**: Optional display of spending amounts with smart currency formatting
- **Layout**: Force-directed graph with collision detection
- **Interactivity**: Click nodes for detailed information, drag to reposition

### Interactive Controls
- **Party Filter**: Filter by political party (sigla_partido)
- **Category Filter**: Filter by expense category (categoria_despesa)
- **Minimum Value Slider**: Set threshold for transaction amounts
- **Company Names Toggle**: Show/hide company labels
- **Edge Amounts Toggle**: Show/hide spending amounts (R$) on connection lines
- **Zoom Controls**: Zoom in/out and reset view

### Real-time Data Processing
- In-browser SQL queries using DuckDB WASM
- Aggregates transactions by deputy-company pairs
- Calculates totals, counts, and connection statistics
- Updates visualization automatically when filters change

## Technical Implementation

### Browser Requirements
- **WASM Support**: Required for DuckDB (all modern browsers)
- **JavaScript**: ES6+ features used throughout
- **Performance**: Best with hardware acceleration enabled
- **Memory**: Handles datasets up to several hundred MB efficiently

### Data Loading
```javascript
// Automatically detects environment and loads data
const response = await fetch('./public/despesas.parquet');
const arrayBuffer = await response.arrayBuffer();
await db.registerFileBuffer('despesas.parquet', new Uint8Array(arrayBuffer));
```

### Optimization Features
- Limits results to 10,000 aggregated records for performance
- Edge labels with smart currency formatting (R$ 1.5M, R$ 500K, R$ 250)
- Smooth fade-in/fade-out transitions for edge label visibility
- Debounced slider updates (500ms delay)
- Efficient D3.js rendering with proper data binding

## File Structure
```
viso/
├── index.html          # Main application
├── public/
│   └── despesas.parquet # Data file
├── .nojekyll           # GitHub Pages config
└── CLAUDE.md           # This documentation
```

## Common Development Tasks

### Adding New Filters
1. Add UI control to the sidebar section in `index.html`
2. Update `getFilterOptions()` to fetch distinct values from data
3. Modify `queryAggregatedData()` to include new WHERE clause
4. Add event listener in `setupEventListeners()`

### Managing Edge Labels
- **Toggle Display**: Use "Mostrar gasto" checkbox to show/hide spending amounts
- **Currency Format**: Automatic formatting for readability (M for millions, K for thousands)
- **Performance**: Labels are rendered for all edges but hidden by default
- **Styling**: Yellow color (#ffd93d) for visibility against dark background

### Customizing Appearance
- **Node colors**: Modify `fill` attribute in D3 node creation (lines 630-631)
- **Force simulation**: Adjust parameters in `d3.forceSimulation()` (lines 609-613)
- **Styling**: Edit Tailwind classes or custom CSS in `<style>` section
- **Layout**: Change sidebar width by updating CSS variables (line 184)

### Performance Tuning
- **Query limits**: Adjust `LIMIT` clause in SQL queries (line 97)
- **Force parameters**: Modify strength values for better graph layout
- **Debounce timing**: Change timeout duration for filter responsiveness (line 867)
- **Edge labels**: Modify currency formatting or transition duration in `updateEdgeAmounts()`

## Data Requirements

### Parquet File Format
- Must be accessible at `./public/despesas.parquet`
- Should contain parliamentary expense records
- Compatible with DuckDB SQL queries
- Recommended size: < 500MB for optimal browser performance

### Expected Schema
```sql
CREATE TABLE despesas (
    nome_parlamentar VARCHAR,
    sigla_partido VARCHAR,
    fornecedor VARCHAR,
    categoria_despesa VARCHAR,
    valor_liquido DECIMAL,
    ano INTEGER,
    -- additional columns as needed
);
```

## Troubleshooting

### GitHub Pages Issues
- **404 Error**: Ensure repository is public and Pages is enabled
- **Loading Issues**: Check browser console for CORS errors
- **Data Not Loading**: Verify parquet file is in correct location
- **WASM Errors**: Ensure browser supports WebAssembly

### Performance Issues
- **Slow Loading**: Consider compressing or splitting large parquet files
- **Browser Freeze**: Reduce query limits or add pagination
- **Memory Issues**: Check browser memory usage in dev tools

### Development Issues
- **Local Server**: Some browsers require HTTPS for WASM modules
- **File Paths**: Use relative paths (`./`) not absolute paths (`/`)
- **CORS**: Serve files from HTTP server, don't open directly in browser

## Browser Compatibility

| Browser | Version | Support | Notes |
|---------|---------|---------|-------|
| Chrome | 57+ | ✅ Full | Best performance |
| Firefox | 52+ | ✅ Full | Good performance |  
| Safari | 11+ | ✅ Full | Requires recent version |
| Edge | 16+ | ✅ Full | Works well |
| Mobile | iOS 11+, Android 8+ | ✅ Limited | May be slower |

## External Dependencies (CDN)
- **Tailwind CSS**: `https://cdn.tailwindcss.com`
- **D3.js**: `https://d3js.org/d3.v7.min.js`
- **DuckDB WASM**: `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/+esm`

All dependencies are loaded via CDN, making the application completely self-contained for static hosting.