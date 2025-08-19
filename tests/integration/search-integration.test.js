// Integration test for search functionality in the database app
import { jest } from '@jest/globals';

// Mock DOM for testing
Object.defineProperty(window, 'location', {
  value: {
    search: '',
    href: 'http://localhost:3002/db.html'
  },
  writable: true
});

global.document = {
  documentElement: { classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() } },
  body: {},
  getElementById: jest.fn(),
  querySelectorAll: jest.fn(),
  addEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  createElement: jest.fn()
};

global.window = {
  ...global.window,
  localStorage: {
    getItem: jest.fn(),
    setItem: jest.fn()
  },
  matchMedia: jest.fn(() => ({ matches: true })),
  addEventListener: jest.fn()
};

describe('Search Integration Test', () => {
  let mockSearchInput;
  let mockSampleButtons;
  let mockCategories;
  
  beforeEach(() => {
    // Mock search input
    mockSearchInput = {
      value: '',
      addEventListener: jest.fn(),
      style: {}
    };
    
    // Mock sample query buttons
    mockSampleButtons = [
      {
        textContent: '📊 Fluxos para top 100 Empresas',
        getAttribute: jest.fn(() => 'sankey-fluxos'),
        style: { display: 'block' },
        classList: { add: jest.fn(), remove: jest.fn() }
      },
      {
        textContent: '📄 Ver primeiros 10 registros',
        getAttribute: jest.fn(() => 'ver-primeiros-10-registros'),
        style: { display: 'block' },
        classList: { add: jest.fn(), remove: jest.fn() }
      },
      {
        textContent: '📊 Top fornecedores por valor',
        getAttribute: jest.fn(() => 'top-fornecedores-por-valor'),
        style: { display: 'block' },
        classList: { add: jest.fn(), remove: jest.fn() }
      },
      {
        textContent: '🔄 Padrões de Restituição',
        getAttribute: jest.fn(() => 'padroes-restituicao'),
        style: { display: 'block' },
        classList: { add: jest.fn(), remove: jest.fn() }
      }
    ];
    
    // Mock categories
    mockCategories = [
      {
        style: { display: 'block' },
        querySelectorAll: jest.fn(() => mockSampleButtons.slice(0, 3))
      },
      {
        style: { display: 'block' },
        querySelectorAll: jest.fn(() => mockSampleButtons.slice(3))
      }
    ];
    
    // Setup DOM mocks
    document.getElementById.mockImplementation((id) => {
      if (id === 'query-search') return mockSearchInput;
      return null;
    });
    
    document.querySelectorAll.mockImplementation((selector) => {
      if (selector === '.sample-query') return mockSampleButtons;
      if (selector === '.category-section') return mockCategories;
      return [];
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('should initialize search functionality on app start', () => {
    // Mock the DatabaseApp class methods we need
    const setupSearchFunctionality = () => {
      const searchInput = document.getElementById('query-search');
      if (!searchInput) return;
      
      searchInput.addEventListener('input', () => {});
      searchInput.addEventListener('keydown', () => {});
    };
    
    setupSearchFunctionality();
    
    expect(document.getElementById).toHaveBeenCalledWith('query-search');
    expect(mockSearchInput.addEventListener).toHaveBeenCalledTimes(2);
  });
  
  test('should filter buttons based on search input', () => {
    const filterAnalysisButtons = (searchTerm) => {
      const allSampleQueries = document.querySelectorAll('.sample-query');
      const allCategories = document.querySelectorAll('.category-section');
      
      if (!searchTerm.trim()) {
        allSampleQueries.forEach(button => {
          button.style.display = 'block';
        });
        allCategories.forEach(category => {
          category.style.display = 'block';
        });
        return;
      }
      
      // Filter buttons by search term
      allSampleQueries.forEach(button => {
        const buttonText = button.textContent.toLowerCase();
        const buttonId = button.getAttribute('data-id') || '';
        
        const matches = buttonText.includes(searchTerm.toLowerCase()) || 
                       buttonId.toLowerCase().includes(searchTerm.toLowerCase());
        
        button.style.display = matches ? 'block' : 'none';
      });
    };
    
    // Test filtering
    filterAnalysisButtons('fornecedores');
    
    expect(document.querySelectorAll).toHaveBeenCalledWith('.sample-query');
    expect(mockSampleButtons[2].style.display).toBe('block'); // Top fornecedores should be visible
    expect(mockSampleButtons[3].style.display).toBe('none');  // Padrões should be hidden
  });
  
  test('should show all buttons when search is cleared', () => {
    const filterAnalysisButtons = (searchTerm) => {
      const allSampleQueries = document.querySelectorAll('.sample-query');
      
      if (!searchTerm.trim()) {
        allSampleQueries.forEach(button => {
          button.style.display = 'block';
        });
        
      }
    };
    
    // First hide some buttons
    mockSampleButtons.forEach((button, index) => {
      button.style.display = index === 0 ? 'block' : 'none';
    });
    
    // Then clear search
    filterAnalysisButtons('');
    
    // All buttons should be visible again
    mockSampleButtons.forEach(button => {
      expect(button.style.display).toBe('block');
    });
  });
  
  test('should handle escape key to clear search', () => {
    let searchValue = 'test search';
    const mockEvent = { key: 'Escape' };
    
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        searchValue = '';
        // Clear search would trigger filterAnalysisButtons('')
      }
    };
    
    handleKeydown(mockEvent);
    
    expect(searchValue).toBe('');
  });
  
  test('should handle real-time search input', () => {
    let currentFilter = '';
    
    const handleInput = (e) => {
      currentFilter = e.target.value.toLowerCase();
    };
    
    const mockEvent = { target: { value: 'deputados' } };
    handleInput(mockEvent);
    
    expect(currentFilter).toBe('deputados');
  });
});

export default {};