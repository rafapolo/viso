// Test for DB Search Functionality
import { jest } from '@jest/globals';

// Mock DOM utilities
const mockDOMUtils = {
  getElementById: jest.fn(),
  addEventListener: jest.fn()
};

// Mock database app
class MockDatabaseApp {
  constructor() {
    this.isInitialized = true;
  }

  setupSearchFunctionality() {
    const searchInput = mockDOMUtils.getElementById('query-search');
    if (!searchInput) return;

    // Add input event listener for real-time filtering
    mockDOMUtils.addEventListener(searchInput, 'input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      this.filterAnalysisButtons(searchTerm);
    });

    // Add clear functionality on Escape key
    mockDOMUtils.addEventListener(searchInput, 'keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        this.filterAnalysisButtons('');
      }
    });
  }

  filterAnalysisButtons(searchTerm) {
    // Mock the filtering logic
    const mockButtons = [
      { textContent: '📊 Top fornecedores por valor', getAttribute: () => 'top-fornecedores', style: {} },
      { textContent: '📈 Top categorias', getAttribute: () => 'top-categorias', style: {} },
      { textContent: '👥 Top deputados', getAttribute: () => 'top-deputados', style: {} },
      { textContent: '🔄 Padrões de Restituição', getAttribute: () => 'padroes-restituicao', style: {} },
      { textContent: '💰 Top transações mais caras', getAttribute: () => 'top-transacoes', style: {} }
    ];

    const mockCategories = [
      { style: {}, querySelectorAll: () => mockButtons.slice(0, 3) },
      { style: {}, querySelectorAll: () => mockButtons.slice(3, 5) }
    ];

    // Override DOM query methods for testing
    global.document = {
      querySelectorAll: (selector) => {
        if (selector === '.sample-query') return mockButtons;
        if (selector === '.category-section') return mockCategories;
        return [];
      }
    };

    if (!searchTerm.trim()) {
      // Show all buttons and categories when search is empty
      mockButtons.forEach(button => {
        button.style.display = 'block';
      });
      mockCategories.forEach(category => {
        category.style.display = 'block';
      });
      return { hiddenButtons: 0, hiddenCategories: 0 };
    }

    let hiddenButtons = 0;
    let hiddenCategories = 0;

    // Filter buttons by search term (convert to lowercase for case insensitive search)
    const lowerSearchTerm = searchTerm.toLowerCase();
    mockButtons.forEach(button => {
      const buttonText = button.textContent.toLowerCase();
      const buttonId = (button.getAttribute('data-id') || '').toLowerCase();
      
      // Check if button text or ID matches search term
      const matches = buttonText.includes(lowerSearchTerm) || 
                     buttonId.includes(lowerSearchTerm);
      
      if (matches) {
        button.style.display = 'block';
      } else {
        button.style.display = 'none';
        hiddenButtons++;
      }
    });

    // Hide categories that have no visible buttons
    mockCategories.forEach(category => {
      const categoryButtons = category.querySelectorAll();
      const hasVisibleButtons = categoryButtons.some(button => 
        !button.style.display || button.style.display === 'block'
      );
      
      if (hasVisibleButtons) {
        category.style.display = 'block';
      } else {
        category.style.display = 'none';
        hiddenCategories++;
      }
    });

    return { hiddenButtons, hiddenCategories };
  }
}

describe('Database Search Functionality', () => {
  let dbApp;
  let mockSearchInput;

  beforeEach(() => {
    dbApp = new MockDatabaseApp();
    mockSearchInput = {
      value: '',
      addEventListener: jest.fn(),
      style: {}
    };
    
    mockDOMUtils.getElementById.mockReturnValue(mockSearchInput);
    mockDOMUtils.addEventListener.mockImplementation((element, event, callback) => {
      element.addEventListener(event, callback);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should setup search functionality correctly', () => {
    dbApp.setupSearchFunctionality();
    
    expect(mockDOMUtils.getElementById).toHaveBeenCalledWith('query-search');
    expect(mockDOMUtils.addEventListener).toHaveBeenCalledTimes(2);
  });

  test('should show all buttons when search is empty', () => {
    const result = dbApp.filterAnalysisButtons('');
    
    expect(result.hiddenButtons).toBe(0);
    expect(result.hiddenCategories).toBe(0);
  });

  test('should filter buttons by text content', () => {
    const result = dbApp.filterAnalysisButtons('top');
    
    // Should match "Top fornecedores", "Top categorias", "Top deputados", "Top transações"
    expect(result.hiddenButtons).toBe(1); // Only "Padrões de Restituição" should be hidden
  });

  test('should filter buttons by specific terms', () => {
    const result = dbApp.filterAnalysisButtons('deputados');
    
    // Should match only "Top deputados"
    expect(result.hiddenButtons).toBe(4);
  });

  test('should filter buttons by emoji symbols', () => {
    const result = dbApp.filterAnalysisButtons('📊');
    
    // Should match "📊 Top fornecedores por valor"
    expect(result.hiddenButtons).toBe(4);
  });

  test('should be case insensitive', () => {
    // Test that searching for "TOP" should match the same as "top"
    const result1 = dbApp.filterAnalysisButtons('TOP');
    const result2 = dbApp.filterAnalysisButtons('top');
    
    expect(result1.hiddenButtons).toBe(result2.hiddenButtons);
    // Should match "Top fornecedores", "Top categorias", "Top deputados", "Top transações"
    expect(result1.hiddenButtons).toBe(1); // Only "Padrões de Restituição" should be hidden
  });

  test('should handle partial matches', () => {
    const result = dbApp.filterAnalysisButtons('transaç');
    
    // Should match "Top transações mais caras"
    expect(result.hiddenButtons).toBe(4);
  });

  test('should hide categories with no matching buttons', () => {
    const result = dbApp.filterAnalysisButtons('restituição');
    
    // Should match only "Padrões de Restituição"
    expect(result.hiddenButtons).toBe(4);
    expect(result.hiddenCategories).toBe(1); // First category should be hidden
  });

  test('should handle special characters and accents', () => {
    const result = dbApp.filterAnalysisButtons('padrões');
    
    // Should match "Padrões de Restituição"
    expect(result.hiddenButtons).toBe(4);
  });

  test('should clear search on Escape key', () => {
    mockSearchInput.value = 'test search';
    
    const mockEvent = { key: 'Escape' };
    dbApp.setupSearchFunctionality();
    
    // Simulate Escape key press
    const keydownCallback = mockDOMUtils.addEventListener.mock.calls
      .find(call => call[1] === 'keydown')[2];
    
    keydownCallback(mockEvent);
    
    expect(mockSearchInput.value).toBe('');
  });
});

export { MockDatabaseApp };