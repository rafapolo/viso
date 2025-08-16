// Filter Management for Index Application
import { APIUtils } from '../shared/api-utils.js';
import { DOMUtils } from '../shared/dom-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';


export class FilterManager {
  constructor() {
    this.searchTimeout = null;
    this.sliderTimeout = null;
    this.currentFilters = {
      minValue: 0,
      partyFilter: '',
      categoryFilter: '',
      searchFilter: ''
    };
  }

  /**
   * Initialize filter options from database
   */
  async populateFilters() {
    try {
      const { parties, categories } = await window.duckdbAPI.getFilterOptions();
      
      this.populatePartyFilter(parties);
      this.populateCategoryFilter(categories);
      
    } catch (error) {
      ErrorHandler.handleError(error, 'Filter Population');
    }
  }

  /**
   * Populate party filter dropdown
   * @param {Array} parties - Array of party names
   */
  populatePartyFilter(parties) {
    const partySelect = DOMUtils.getElementById('partyFilter');
    if (!partySelect) return;

    // Clear existing options except the first one
    while (partySelect.children.length > 1) {
      partySelect.removeChild(partySelect.lastChild);
    }

    parties.forEach(party => {
      const option = DOMUtils.createElement('option', {
        value: party,
        textContent: party
      });
      
      if (party === 'PT') {
        option.selected = true;
      }
      
      partySelect.appendChild(option);
    });
  }

  /**
   * Populate category filter dropdown
   * @param {Array} categories - Array of category names
   */
  populateCategoryFilter(categories) {
    const categorySelect = DOMUtils.getElementById('categoryFilter');
    if (!categorySelect) return;

    // Clear existing options except the first one
    while (categorySelect.children.length > 1) {
      categorySelect.removeChild(categorySelect.lastChild);
    }

    categories.forEach(category => {
      const option = DOMUtils.createElement('option', {
        value: category,
        textContent: category.length > 50 ? `${category.substring(0, 47)}...` : category
      });
      
      categorySelect.appendChild(option);
    });
  }

  /**
   * Get current filter values
   * @returns {Object} Current filter values
   */
  getCurrentFilters() {
    return {
      minValue: parseFloat(DOMUtils.getValue('minValue')) || 0,
      partyFilter: DOMUtils.getValue('partyFilter') || '',
      categoryFilter: DOMUtils.getValue('categoryFilter') || '',
      searchFilter: DOMUtils.getValue('searchBox')?.trim() || ''
    };
  }

  /**
   * Update value range slider based on current filters
   * @param {Object} filters - Current filter values
   */
  async updateValueRange(filters = {}) {
    try {
      const {
        partyFilter = '',
        categoryFilter = '',
        searchFilter = ''
      } = filters;

      // Get the individual transaction value range
      const valueRange = await window.duckdbAPI.getValueRange(partyFilter, categoryFilter, searchFilter);
      const minVal = valueRange.min;
      const maxVal = valueRange.max;

      if (minVal !== null && maxVal !== null && maxVal > minVal) {
        this.updateSliderRange(minVal, maxVal);
      } else {
        this.resetSliderRange();
      }

    } catch (error) {
      ErrorHandler.handleError(error, 'Value Range Update');
      this.resetSliderRange();
    }
  }

  /**
   * Update slider range with actual data values
   * @param {number} minVal - Minimum value from data
   * @param {number} maxVal - Maximum value from data
   */
  updateSliderRange(minVal, maxVal) {
    const slider = DOMUtils.getElementById('minValue');
    if (!slider) return;

    const currentValue = parseInt(slider.value);
    
    // Set slider bounds to actual data range
    const rangeMin = Math.max(0, Math.floor(minVal)) || 0;
    const rangeMax = Math.max(Math.ceil(maxVal), rangeMin + 1000);
    
    slider.min = rangeMin;
    slider.max = rangeMax;

    // If current slider value is outside the new range, adjust it
    if (currentValue < rangeMin || currentValue > rangeMax) {
      slider.value = rangeMin;
    }

    // Update range display
    const formatCurrency = (value) => `R$ ${value.toLocaleString('pt-BR')}`;
    DOMUtils.updateContent('minRange', `Min: ${formatCurrency(minVal)}`, false);
    DOMUtils.updateContent('maxRange', `Max: ${formatCurrency(maxVal)}`, false);

    // Update current value display
    this.updateSliderDisplay();

    console.log(`📊 Range updated: min=${rangeMin}, max=${rangeMax}, current=${slider.value}`);
  }

  /**
   * Reset slider to default range
   */
  resetSliderRange() {
    const slider = DOMUtils.getElementById('minValue');
    if (!slider) return;

    slider.min = 0;
    slider.max = 100000;
    slider.value = 0;

    DOMUtils.updateContent('minRange', 'Min: R$ 0', false);
    DOMUtils.updateContent('maxRange', 'Max: R$ 100.000', false);
    
    this.updateSliderDisplay();
  }

  /**
   * Update slider value display
   */
  updateSliderDisplay() {
    const slider = DOMUtils.getElementById('minValue');
    const display = DOMUtils.getElementById('minValueValue');
    
    if (!slider || !display) return;

    const value = parseInt(slider.value);
    
    const formatValue = (val) => {
      if (val >= 1000000) return `${(val/1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val/1000).toFixed(0)}K`;
      return val.toLocaleString('pt-BR');
    };
    
    DOMUtils.updateContent(display, formatValue(value), false);
  }

  /**
   * Setup all filter event listeners
   * @param {Function} updateCallback - Callback function to call when filters change
   */
  setupEventListeners(updateCallback) {
    this.setupSliderListeners(updateCallback);
    this.setupSelectListeners(updateCallback);
    this.setupSearchListeners(updateCallback);
    this.setupToggleListeners(updateCallback);
  }

  /**
   * Setup slider event listeners
   * @param {Function} updateCallback - Update callback function
   */
  setupSliderListeners(updateCallback) {
    const minValueSlider = DOMUtils.getElementById('minValue');
    
    if (minValueSlider) {
      DOMUtils.addEventListener(minValueSlider, 'input', () => {
        this.updateSliderDisplay();
        
        clearTimeout(this.sliderTimeout);
        this.sliderTimeout = setTimeout(() => {
          updateCallback();
        }, 500); // 500ms debounce
      });
    }

    // Force strength slider
    const forceSlider = DOMUtils.getElementById('forceStrength');
    
    if (forceSlider) {
      DOMUtils.addEventListener(forceSlider, 'input', (e) => {
        const forceValue = parseInt(e.target.value);
        
        if (window.currentSimulation) {
          const strength = -forceValue * 50;
          window.currentSimulation.force("charge", window.d3.forceManyBody().strength(strength));
          window.currentSimulation.alphaTarget(0.3).restart();
          setTimeout(() => window.currentSimulation.alphaTarget(0), 1000);
        }
      });
    }
  }

  /**
   * Setup select dropdown event listeners
   * @param {Function} updateCallback - Update callback function
   */
  setupSelectListeners(updateCallback) {
    const partyFilter = DOMUtils.getElementById('partyFilter');
    const categoryFilter = DOMUtils.getElementById('categoryFilter');

    if (partyFilter) {
      DOMUtils.addEventListener(partyFilter, 'change', () => {
        this.resetSliderRange();
        updateCallback();
      });
    }

    if (categoryFilter) {
      DOMUtils.addEventListener(categoryFilter, 'change', () => {
        this.resetSliderRange();
        updateCallback();
      });
    }
  }

  /**
   * Setup search functionality event listeners
   * @param {Function} updateCallback - Update callback function
   */
  setupSearchListeners(updateCallback) {
    const searchBox = DOMUtils.getElementById('searchBox');
    const clearSearch = DOMUtils.getElementById('clearSearch');

    if (searchBox) {
      DOMUtils.addEventListener(searchBox, 'input', (e) => {
        const value = e.target.value.trim();
        
        // Show/hide clear button
        if (clearSearch) {
          if (value) {
            DOMUtils.removeClass(clearSearch, 'hidden');
          } else {
            DOMUtils.addClass(clearSearch, 'hidden');
          }
        }
        
        // Update visualization with debounce
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          updateCallback();
        }, 300); // 300ms debounce for search
      });

      DOMUtils.addEventListener(searchBox, 'keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(this.searchTimeout);
          updateCallback();
        } else if (e.key === 'Escape') {
          searchBox.value = '';
          if (clearSearch) {
            DOMUtils.addClass(clearSearch, 'hidden');
          }
          clearTimeout(this.searchTimeout);
          updateCallback();
        }
      });
    }

    if (clearSearch) {
      DOMUtils.addEventListener(clearSearch, 'click', () => {
        if (searchBox) {
          searchBox.value = '';
        }
        DOMUtils.addClass(clearSearch, 'hidden');
        updateCallback();
      });
    }
  }

  /**
   * Setup toggle switch event listeners
   * @param {Function} updateCallback - Update callback function
   */
  setupToggleListeners(updateCallback) {
    // Network analysis toggles
    const networkDensityToggle = DOMUtils.getElementById('networkDensityToggle');
    const topExpensesToggle = DOMUtils.getElementById('topExpensesToggle');

    if (networkDensityToggle) {
      DOMUtils.addEventListener(networkDensityToggle, 'change', () => {
        updateCallback();
      });
    }

    if (topExpensesToggle) {
      DOMUtils.addEventListener(topExpensesToggle, 'change', () => {
        updateCallback();
      });
    }

    // Display toggles handled by visualization components
    this.setupDisplayToggles();
  }

  /**
   * Setup display toggle listeners (company names, edge amounts)
   */
  setupDisplayToggles() {
    const showCompanyNames = DOMUtils.getElementById('showCompanyNames');
    const showEdgeAmounts = DOMUtils.getElementById('showEdgeAmounts');

    if (showCompanyNames) {
      DOMUtils.addEventListener(showCompanyNames, 'change', (e) => {
        // Dispatch event for visualization to handle
        document.dispatchEvent(new CustomEvent('companyLabelsToggled', {
          detail: { showNames: e.target.checked }
        }));
      });
    }

    if (showEdgeAmounts) {
      DOMUtils.addEventListener(showEdgeAmounts, 'change', (e) => {
        // Dispatch event for visualization to handle
        document.dispatchEvent(new CustomEvent('edgeAmountsToggled', {
          detail: { showAmounts: e.target.checked }
        }));
      });
    }
  }

  /**
   * Get network filter states
   * @returns {Object} Network filter states
   */
  getNetworkFilters() {
    const densityToggle = DOMUtils.getElementById('networkDensityToggle');
    const topExpensesToggle = DOMUtils.getElementById('topExpensesToggle');

    return {
      densityMode: densityToggle ? densityToggle.checked : false,
      topExpensesMode: topExpensesToggle ? topExpensesToggle.checked : false
    };
  }

  /**
   * Initialize filter manager
   * @param {Function} updateCallback - Callback for filter changes
   */
  async initialize(updateCallback) {
    try {
      await this.populateFilters();
      this.setupEventListeners(updateCallback);
      this.updateSliderDisplay();
      
      console.log('✅ Filter manager initialized');
    } catch (error) {
      ErrorHandler.handleError(error, 'Filter Manager Initialization');
    }
  }

  /**
   * Cleanup timeouts and event listeners
   */
  dispose() {
    clearTimeout(this.searchTimeout);
    clearTimeout(this.sliderTimeout);
    this.searchTimeout = null;
    this.sliderTimeout = null;
  }
}