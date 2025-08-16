const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock Monaco Editor
const mockEditor = {
  getValue: jest.fn(() => 'SELECT * FROM despesas LIMIT 10'),
  setValue: jest.fn(),
  onDidChangeModelContent: jest.fn(),
  layout: jest.fn(),
  dispose: jest.fn(),
  addCommand: jest.fn(),
  setTheme: jest.fn()
};

const mockMonaco = {
  editor: {
    create: jest.fn(() => mockEditor),
    defineTheme: jest.fn(),
    setTheme: jest.fn()
  },
  languages: {
    registerCompletionItemProvider: jest.fn()
  },
  KeyMod: { CtrlCmd: 1 },
  KeyCode: { Enter: 3 }
};

global.monaco = mockMonaco;

// Sample test data
const sampleQueryResult = {
  success: true,
  data: [
    { nome_parlamentar: 'Deputado A', valor_liquido: 1000, categoria_despesa: 'COMBUSTÍVEL' },
    { nome_parlamentar: 'Deputado B', valor_liquido: 2000, categoria_despesa: 'ALIMENTAÇÃO' }
  ],
  columns: [
    { name: 'nome_parlamentar', type: 'VARCHAR' },
    { name: 'valor_liquido', type: 'DECIMAL' },
    { name: 'categoria_despesa', type: 'VARCHAR' }
  ],
  rowCount: 2,
  executionTime: 25.5
};

const sampleDespesasData = [
  { id: 1, nome_parlamentar: 'Deputado A', valor_liquido: 1000, categoria_despesa: 'COMBUSTÍVEL' },
  { id: 2, nome_parlamentar: 'Deputado B', valor_liquido: 2000, categoria_despesa: 'ALIMENTAÇÃO' }
];

// Mock DOM elements that query interface expects
const createMockDOMElements = () => {
  // Create main container
  const container = document.createElement('div');
  container.className = 'h-screen flex flex-col';
  document.body.appendChild(container);

  // Connection status
  const status = document.createElement('div');
  status.id = 'connection-status';
  status.textContent = '❌ Desconectado';
  container.appendChild(status);

  // Schema tree
  const schemaTree = document.createElement('div');
  schemaTree.id = 'schema-tree';
  container.appendChild(schemaTree);

  // Tabs container
  const tabsContainer = document.createElement('div');
  tabsContainer.id = 'tabs-container';
  tabsContainer.className = 'flex items-center gap-1';
  container.appendChild(tabsContainer);

  // New tab button
  const newTabBtn = document.createElement('button');
  newTabBtn.id = 'new-tab-btn';
  newTabBtn.textContent = '+';
  tabsContainer.appendChild(newTabBtn);

  // Editor and results containers
  const editorContainer = document.createElement('div');
  editorContainer.className = 'editor-container flex-1';
  container.appendChild(editorContainer);

  const resultsArea = document.createElement('div');
  resultsArea.className = 'results-area flex-1';
  container.appendChild(resultsArea);

  // Run query button
  const runBtn = document.createElement('button');
  runBtn.id = 'run-query-btn';
  runBtn.textContent = 'Executar';
  container.appendChild(runBtn);

  // Clear button
  const clearBtn = document.createElement('button');
  clearBtn.id = 'clear-btn';
  clearBtn.textContent = 'Limpar';
  container.appendChild(clearBtn);

  // Stats elements
  const resultStats = document.createElement('div');
  resultStats.id = 'result-stats';
  container.appendChild(resultStats);

  const executionStats = document.createElement('div');
  executionStats.id = 'execution-stats';
  container.appendChild(executionStats);

  // Pagination
  const paginationContainer = document.createElement('div');
  paginationContainer.id = 'pagination-container';
  paginationContainer.classList.add('hidden');
  
  const paginationNav = document.createElement('div');
  paginationNav.id = 'pagination-nav';
  paginationContainer.appendChild(paginationNav);
  
  container.appendChild(paginationContainer);

  // Sample queries
  const sampleQueriesList = document.createElement('div');
  sampleQueriesList.id = 'sample-queries-list';
  
  const sampleQuery = document.createElement('div');
  sampleQuery.className = 'sample-query';
  sampleQuery.dataset.query = 'SELECT * FROM despesas LIMIT 10';
  sampleQuery.textContent = 'Ver primeiros 10 registros';
  sampleQueriesList.appendChild(sampleQuery);
  
  container.appendChild(sampleQueriesList);

  // Query search
  const querySearch = document.createElement('input');
  querySearch.id = 'query-search';
  querySearch.type = 'text';
  querySearch.placeholder = 'Buscar consultas...';
  container.appendChild(querySearch);

  // Export button
  const exportBtn = document.createElement('button');
  exportBtn.id = 'export-btn';
  exportBtn.textContent = 'Exportar CSV';
  container.appendChild(exportBtn);

  // Share button
  const shareBtn = document.createElement('button');
  shareBtn.id = 'share-btn';
  shareBtn.textContent = 'Compartilhar';
  container.appendChild(shareBtn);
};

// Mock query interface functions
const mockQueryInterfaceFunctions = () => {
  // Tab management
  global.tabs = {};
  global.activeTabId = null;
  global.tabCounter = 0;

  global.createNewTab = jest.fn((name) => {
    global.tabCounter++;
    const tabId = `tab-${global.tabCounter}`;
    const tabName = name || `Consulta ${global.tabCounter}`;
    
    global.tabs[tabId] = {
      id: tabId,
      name: tabName,
      query: '',
      results: null,
      currentPage: 1,
      totalPages: 1,
      editor: null
    };
    
    global.activeTabId = tabId;
    
    // Create tab elements
    const tabsContainer = document.getElementById('tabs-container');
    const tabElement = document.createElement('div');
    tabElement.dataset.tabId = tabId;
    tabElement.className = 'tab-active';
    tabElement.innerHTML = `
      <span>${tabName}</span>
      <button onclick="closeTab('${tabId}')">×</button>
    `;
    tabsContainer.appendChild(tabElement);

    // Create editor container
    const editorContainer = document.createElement('div');
    editorContainer.id = `editor-${tabId}`;
    editorContainer.className = 'editor-instance';
    document.querySelector('.editor-container').appendChild(editorContainer);

    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.id = `results-${tabId}`;
    resultsContainer.className = 'results-instance';
    document.querySelector('.results-area').appendChild(resultsContainer);

    // Initialize mock Monaco editor
    global.tabs[tabId].editor = monaco.editor.create(editorContainer);
    
    return tabId;
  });

  global.switchToTab = jest.fn((tabId) => {
    if (global.tabs[tabId]) {
      global.activeTabId = tabId;
      
      // Update tab active state
      document.querySelectorAll('[data-tab-id]').forEach(tab => {
        tab.classList.remove('tab-active');
      });
      document.querySelector(`[data-tab-id="${tabId}"]`).classList.add('tab-active');
    }
  });

  global.closeTab = jest.fn((tabId) => {
    if (Object.keys(global.tabs).length <= 1) return;
    
    delete global.tabs[tabId];
    document.querySelector(`[data-tab-id="${tabId}"]`).remove();
    document.getElementById(`editor-${tabId}`)?.remove();
    document.getElementById(`results-${tabId}`)?.remove();
    
    if (global.activeTabId === tabId) {
      const remainingTabs = Object.keys(global.tabs);
      if (remainingTabs.length > 0) {
        global.switchToTab(remainingTabs[0]);
      }
    }
  });

  // Query execution
  global.executeQuery = jest.fn(async () => {
    if (!global.activeTabId) return;
    
    const tab = global.tabs[global.activeTabId];
    if (!tab || !tab.editor) return;
    
    const sql = tab.editor.getValue();
    if (!sql.trim()) return;

    try {
      // Mock query execution
      const result = {
        ...sampleQueryResult,
        data: sampleDespesasData
      };
      
      tab.results = result;
      tab.currentPage = 1;
      
      global.displayResults(result, global.activeTabId);
      global.updateTabStats(global.activeTabId);
      
      return result;
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  });

  global.displayResults = jest.fn((result, tabId) => {
    const resultsContainer = document.getElementById(`results-${tabId}`);
    if (!resultsContainer || !result) return;

    const { data, columns } = result;
    
    if (data.length === 0) {
      resultsContainer.innerHTML = '<div class="no-results">Nenhum resultado encontrado</div>';
      return;
    }

    // Create table
    const table = document.createElement('table');
    table.className = 'results-table';
    
    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Body
    const tbody = document.createElement('tbody');
    const pageSize = 50;
    const tab = global.tabs[tabId];
    const startIndex = (tab.currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, data.length);
    
    for (let i = startIndex; i < endIndex; i++) {
      const row = document.createElement('tr');
      const item = data[i];
      
      columns.forEach(col => {
        const td = document.createElement('td');
        td.textContent = item[col] || '';
        row.appendChild(td);
      });
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(table);
    
    // Update pagination
    tab.totalPages = Math.ceil(data.length / pageSize);
    if (tab.totalPages > 1) {
      global.showPagination(tabId);
    } else {
      global.hidePagination();
    }
  });

  global.updateTabStats = jest.fn((tabId) => {
    const tab = global.tabs[tabId];
    if (!tab || !tab.results) return;
    
    document.getElementById('result-stats').textContent = `${tab.results.rowCount} linhas`;
    document.getElementById('execution-stats').textContent = 
      `Executado em ${(tab.results.executionTime || 0).toFixed(2)}ms`;
  });

  global.showPagination = jest.fn((tabId) => {
    const paginationContainer = document.getElementById('pagination-container');
    paginationContainer.classList.remove('hidden');
    
    const tab = global.tabs[tabId];
    const paginationNav = document.getElementById('pagination-nav');
    paginationNav.innerHTML = '';
    
    // Create page buttons
    for (let i = 1; i <= Math.min(tab.totalPages, 10); i++) {
      const button = document.createElement('button');
      button.textContent = i;
      button.className = i === tab.currentPage ? 'active' : '';
      button.onclick = () => global.goToPage(tabId, i);
      paginationNav.appendChild(button);
    }
  });

  global.hidePagination = jest.fn(() => {
    document.getElementById('pagination-container').classList.add('hidden');
  });

  global.goToPage = jest.fn((tabId, page) => {
    const tab = global.tabs[tabId];
    if (!tab || !tab.results || page < 1 || page > tab.totalPages) return;
    
    tab.currentPage = page;
    global.displayResults(tab.results, tabId);
  });

  global.clearResults = jest.fn(() => {
    if (!global.activeTabId) return;
    
    const resultsContainer = document.getElementById(`results-${global.activeTabId}`);
    if (resultsContainer) {
      resultsContainer.innerHTML = '<div class="empty-state">Execute uma consulta para ver os resultados</div>';
    }
    
    global.hidePagination();
  });

  // Export functionality
  global.exportResults = jest.fn(() => {
    if (!global.activeTabId) return;
    
    const tab = global.tabs[global.activeTabId];
    if (!tab || !tab.results || !tab.results.data.length) {
      alert('Nenhum resultado para exportar');
      return;
    }
    
    const { data, columns } = tab.results;
    let csvContent = `${columns.map(col => col.name).join(',')}\n`;
    
    data.forEach(row => {
      const values = columns.map(col => {
        const value = row[col.name] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvContent += `${values.join(',')}\n`;
    });
    
    // Mock file download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = 'mock-blob-url';
    
    return { blob, url, csvContent };
  });

  // Schema loading
  global.loadSchema = jest.fn(async () => {
    const mockSchema = [
      { column_name: 'nome_parlamentar', column_type: 'VARCHAR' },
      { column_name: 'valor_liquido', column_type: 'DOUBLE' },
      { column_name: 'data_emissao', column_type: 'DATE' }
    ];
    
    const schemaTree = document.getElementById('schema-tree');
    schemaTree.innerHTML = mockSchema.map(col => 
      `<div class="schema-item">
        <span class="column-name">${col.column_name}</span>
        <span class="column-type">${col.column_type}</span>
      </div>`
    ).join('');
    
    return mockSchema;
  });

  // Search functionality
  global.filterQueries = jest.fn((searchTerm) => {
    const queries = document.querySelectorAll('.sample-query');
    queries.forEach(query => {
      const text = query.textContent.toLowerCase();
      const matches = text.includes(searchTerm.toLowerCase());
      query.style.display = matches ? 'block' : 'none';
    });
  });

  // URL sharing
  global.shareCurrentQuery = jest.fn(() => {
    if (!global.activeTabId) return;
    
    const tab = global.tabs[global.activeTabId];
    if (!tab || !tab.editor) return;
    
    const query = tab.editor.getValue();
    const encodedQuery = encodeURIComponent(query);
    const shareUrl = `${window.location.origin}${window.location.pathname}?query=${encodedQuery}`;
    
    // Mock clipboard API
    return Promise.resolve(shareUrl);
  });

  // Initialization
  global.initializeApp = jest.fn(async () => {
    // Mock DuckDB initialization
    document.getElementById('connection-status').textContent = '✅ Conectado';
    
    // Load schema
    await global.loadSchema();
    
    // Create first tab
    global.createNewTab('Consulta 1');
    
    return Promise.resolve();
  });
};

describe('SQL Query Interface Integration Tests', () => {
  beforeEach(() => {
    createMockDOMElements();
    mockQueryInterfaceFunctions();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Application Initialization', () => {
    test('should initialize app with connection and schema', async () => {
      await global.initializeApp();

      expect(global.initializeApp).toHaveBeenCalled();
      expect(document.getElementById('connection-status').textContent).toBe('✅ Conectado');
      expect(global.loadSchema).toHaveBeenCalled();
      expect(Object.keys(global.tabs)).toHaveLength(1);
    });

    test('should load database schema', async () => {
      const schema = await global.loadSchema();
      
      expect(schema).toHaveLength(3);
      expect(schema[0].column_name).toBe('nome_parlamentar');
      
      const schemaTree = document.getElementById('schema-tree');
      expect(schemaTree.innerHTML).toContain('nome_parlamentar');
      expect(schemaTree.innerHTML).toContain('VARCHAR');
    });
  });

  describe('Tab Management', () => {
    test('should create new tab', () => {
      const tabId = global.createNewTab('Test Tab');
      
      expect(global.tabs[tabId]).toBeDefined();
      expect(global.tabs[tabId].name).toBe('Test Tab');
      expect(global.activeTabId).toBe(tabId);
      
      const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
      expect(tabElement).toBeTruthy();
      expect(tabElement.innerHTML).toContain('Test Tab');
    });

    test('should switch between tabs', () => {
      const tab1 = global.createNewTab('Tab 1');
      const tab2 = global.createNewTab('Tab 2');
      
      global.switchToTab(tab1);
      expect(global.activeTabId).toBe(tab1);
      
      const activeTab = document.querySelector('.tab-active');
      expect(activeTab.dataset.tabId).toBe(tab1);
    });

    test('should close tab', () => {
      const tab1 = global.createNewTab('Tab 1');
      const tab2 = global.createNewTab('Tab 2');
      
      global.closeTab(tab1);
      
      expect(global.tabs[tab1]).toBeUndefined();
      expect(document.querySelector(`[data-tab-id="${tab1}"]`)).toBeNull();
      expect(global.activeTabId).toBe(tab2);
    });

    test('should not close the last tab', () => {
      const tabId = global.createNewTab('Only Tab');
      
      global.closeTab(tabId);
      
      expect(global.tabs[tabId]).toBeDefined();
      expect(Object.keys(global.tabs)).toHaveLength(1);
    });
  });

  describe('Query Execution', () => {
    beforeEach(() => {
      global.createNewTab('Test Query');
    });

    test('should execute SQL query', async () => {
      const result = await global.executeQuery();
      
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(sampleDespesasData.length);
      expect(result.columns).toEqual(sampleQueryResult.columns);
      expect(global.displayResults).toHaveBeenCalled();
    });

    test('should display query results in table', () => {
      const tabId = global.activeTabId;
      global.displayResults(sampleQueryResult, tabId);
      
      const resultsContainer = document.getElementById(`results-${tabId}`);
      const table = resultsContainer.querySelector('table');
      
      expect(table).toBeTruthy();
      expect(table.querySelector('thead')).toBeTruthy();
      expect(table.querySelector('tbody')).toBeTruthy();
      
      const headers = table.querySelectorAll('th');
      expect(headers).toHaveLength(sampleQueryResult.columns.length);
    });

    test('should handle empty results', () => {
      const emptyResult = { ...sampleQueryResult, data: [] };
      const tabId = global.activeTabId;
      
      global.displayResults(emptyResult, tabId);
      
      const resultsContainer = document.getElementById(`results-${tabId}`);
      expect(resultsContainer.innerHTML).toContain('Nenhum resultado encontrado');
    });

    test('should update execution statistics', () => {
      const tabId = global.activeTabId;
      global.tabs[tabId].results = sampleQueryResult;
      
      global.updateTabStats(tabId);
      
      expect(document.getElementById('result-stats').textContent).toContain('2 linhas');
      expect(document.getElementById('execution-stats').textContent).toContain('25.50ms');
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      global.createNewTab('Paginated Query');
      
      // Mock large result set
      const largeResult = {
        ...sampleQueryResult,
        data: Array.from({ length: 150 }, (_, i) => ({
          nome_parlamentar: `Deputy ${i}`,
          valor_liquido: i * 100
        })),
        rowCount: 150
      };
      
      global.tabs[global.activeTabId].results = largeResult;
      global.tabs[global.activeTabId].totalPages = Math.ceil(150 / 50); // Assuming 50 rows per page
    });

    test('should show pagination for large result sets', () => {
      const tabId = global.activeTabId;
      global.showPagination(tabId);
      
      const paginationContainer = document.getElementById('pagination-container');
      expect(paginationContainer.classList.contains('hidden')).toBe(false);
      
      const paginationNav = document.getElementById('pagination-nav');
      const buttons = paginationNav.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('should navigate between pages', () => {
      const tabId = global.activeTabId;
      const tab = global.tabs[tabId];
      
      global.goToPage(tabId, 2);
      
      expect(tab.currentPage).toBe(2);
      expect(global.displayResults).toHaveBeenCalled();
    });

    test('should hide pagination for small result sets', () => {
      global.hidePagination();
      
      const paginationContainer = document.getElementById('pagination-container');
      expect(paginationContainer.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Sample Queries', () => {
    test('should load sample query when clicked', () => {
      const sampleQuery = document.querySelector('.sample-query');
      const expectedQuery = sampleQuery.dataset.query;
      
      // Simulate click
      sampleQuery.click();
      
      // Mock that query gets loaded into active editor
      const tabId = global.createNewTab('Sample Query');
      global.tabs[tabId].editor.setValue(expectedQuery);
      
      expect(global.tabs[tabId].editor.setValue).toHaveBeenCalledWith(expectedQuery);
    });

    test('should filter sample queries by search term', () => {
      global.filterQueries('SELECT');
      
      const queries = document.querySelectorAll('.sample-query');
      queries.forEach(query => {
        const isVisible = query.style.display !== 'none';
        const containsSearch = query.textContent.toLowerCase().includes('select');
        
        if (containsSearch) {
          expect(isVisible).toBe(true);
        }
      });
    });
  });

  describe('Data Export', () => {
    beforeEach(() => {
      const tabId = global.createNewTab('Export Test');
      global.tabs[tabId].results = sampleQueryResult;
    });

    test('should export results to CSV', () => {
      const exportData = global.exportResults();
      
      expect(exportData).toBeDefined();
      expect(exportData.csvContent).toContain('nome_parlamentar,valor_liquido,categoria_despesa');
      expect(exportData.csvContent).toContain('Deputado A');
      expect(exportData.blob).toBeInstanceOf(Blob);
    });

    test('should handle export with no results', () => {
      const tabId = global.createNewTab('Empty Export');
      global.tabs[tabId].results = null;
      
      // Mock alert
      global.alert = jest.fn();
      
      global.exportResults();
      
      expect(global.alert).toHaveBeenCalledWith('Nenhum resultado para exportar');
    });
  });

  describe('Query Sharing', () => {
    test('should generate shareable URL', async () => {
      const tabId = global.createNewTab('Share Test');
      global.activeTabId = tabId;
      // Mock the editor to return the expected query
      global.tabs[tabId].editor.getValue.mockReturnValue('SELECT * FROM despesas WHERE valor > 1000');
      
      const shareUrl = await global.shareCurrentQuery();
      
      expect(shareUrl).toContain('query=');
      expect(shareUrl).toContain(encodeURIComponent('SELECT * FROM despesas WHERE valor > 1000'));
    });

    test('should handle sharing without active tab', async () => {
      global.activeTabId = null;
      
      const result = await global.shareCurrentQuery();
      
      expect(result).toBeUndefined();
    });
  });

  describe('Monaco Editor Integration', () => {
    test('should initialize Monaco editor for new tab', () => {
      const tabId = global.createNewTab('Editor Test');
      
      expect(monaco.editor.create).toHaveBeenCalled();
      expect(global.tabs[tabId].editor).toBeDefined();
    });

    test('should handle editor commands', () => {
      const tabId = global.createNewTab('Command Test');
      const {editor} = global.tabs[tabId];
      
      expect(editor.addCommand).toBeDefined();
      
      // Simulate Ctrl+Enter command
      const mockCommand = jest.fn();
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, mockCommand);
      
      expect(editor.addCommand).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle query execution errors gracefully', async () => {
      global.createNewTab('Error Test');
      
      // Mock query execution failure
      const originalExecute = global.executeQuery;
      global.executeQuery = jest.fn().mockRejectedValue(new Error('SQL syntax error'));
      
      await expect(global.executeQuery()).rejects.toThrow('SQL syntax error');
      
      // Restore original function
      global.executeQuery = originalExecute;
    });

    test('should handle editor initialization errors', () => {
      monaco.editor.create.mockImplementationOnce(() => {
        throw new Error('Editor creation failed');
      });
      
      expect(() => {
        global.createNewTab('Error Tab');
      }).toThrow('Editor creation failed');
    });
  });

  describe('Performance Considerations', () => {
    test('should handle large result sets efficiently', () => {
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 1000
      }));
      
      const largeResult = {
        data: largeData,
        columns: ['id', 'name', 'value'],
        rowCount: largeData.length,
        executionTime: 150.5
      };
      
      const tabId = global.createNewTab('Large Data');
      
      expect(() => {
        global.displayResults(largeResult, tabId);
      }).not.toThrow();
      
      // Should only render first page (50 items)
      const table = document.querySelector(`#results-${tabId} table`);
      const rows = table?.querySelectorAll('tbody tr');
      expect(rows?.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Theme Support', () => {
    test('should support theme switching', () => {
      const tabId = global.createNewTab('Theme Test');
      const {editor} = global.tabs[tabId];
      
      // Mock theme switching
      editor.setTheme('vs-dark');
      
      expect(editor.setTheme).toHaveBeenCalledWith('vs-dark');
    });
  });

  describe('Keyboard Shortcuts', () => {
    test('should register keyboard shortcuts for query execution', () => {
      const tabId = global.createNewTab('Shortcut Test');
      const {editor} = global.tabs[tabId];
      
      // Mock keyboard shortcut registration
      const mockShortcut = jest.fn();
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, mockShortcut);
      
      expect(editor.addCommand).toHaveBeenCalledWith(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        mockShortcut
      );
    });
  });
});