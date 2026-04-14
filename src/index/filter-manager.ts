// Filter Management for Index Application
import { DOMUtils } from '../shared/dom-utils.js';
import { ErrorHandler } from '../shared/error-handler.js';

interface CurrentFilters {
  minValue: number;
  partyFilter: string;
  categoryFilter: string;
  searchFilter: string;
}

interface NetworkFilters {
  densityMode: boolean;
  topExpensesMode: boolean;
}

export class FilterManager {
  private searchTimeout: ReturnType<typeof setTimeout> | null;
  private sliderTimeout: ReturnType<typeof setTimeout> | null;
  private currentFilters: CurrentFilters;

  constructor() {
    this.searchTimeout = null;
    this.sliderTimeout = null;
    this.currentFilters = {
      minValue: 0,
      partyFilter: '',
      categoryFilter: '',
      searchFilter: '',
    };
  }

  async populateFilters(): Promise<void> {
    try {
      const { parties, categories } = await window.duckdbAPI.getFilterOptions();

      this.populatePartyFilter(parties);
      this.populateCategoryFilter(categories);
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Filter Population');
    }
  }

  populatePartyFilter(parties: string[]): void {
    const partySelect = DOMUtils.getElementById('partyFilter') as HTMLSelectElement | null;
    if (!partySelect) return;

    while (partySelect.children.length > 1) {
      partySelect.removeChild(partySelect.lastChild!);
    }

    parties.forEach(party => {
      const option = DOMUtils.createElement('option', {
        attributes: { value: party },
        textContent: party,
      });

      if (party === 'PT') {
        (option as HTMLOptionElement).selected = true;
      }

      partySelect.appendChild(option);
    });
  }

  populateCategoryFilter(categories: string[]): void {
    const categorySelect = DOMUtils.getElementById('categoryFilter') as HTMLSelectElement | null;
    if (!categorySelect) return;

    while (categorySelect.children.length > 1) {
      categorySelect.removeChild(categorySelect.lastChild!);
    }

    categories.forEach(category => {
      const option = DOMUtils.createElement('option', {
        attributes: { value: category },
        textContent: category.length > 50 ? `${category.substring(0, 47)}...` : category,
      });

      categorySelect.appendChild(option);
    });
  }

  getCurrentFilters(): CurrentFilters {
    return {
      minValue: parseFloat(DOMUtils.getValue('minValue') ?? '0') || 0,
      partyFilter: DOMUtils.getValue('partyFilter') || '',
      categoryFilter: DOMUtils.getValue('categoryFilter') || '',
      searchFilter: DOMUtils.getValue('searchBox')?.trim() || '',
    };
  }

  async updateValueRange(filters: Partial<CurrentFilters> = {}): Promise<void> {
    try {
      const {
        partyFilter = '',
        categoryFilter = '',
        searchFilter = '',
      } = filters;

      const valueRange = await window.duckdbAPI.getValueRange(partyFilter, categoryFilter, searchFilter);
      const minVal = valueRange.min;
      const maxVal = valueRange.max;

      if (minVal !== null && maxVal !== null && maxVal > minVal) {
        this.updateSliderRange(minVal, maxVal);
      } else {
        this.resetSliderRange();
      }
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Value Range Update');
      this.resetSliderRange();
    }
  }

  updateSliderRange(minVal: number, maxVal: number): void {
    const slider = DOMUtils.getElementById('minValue') as HTMLInputElement | null;
    if (!slider) return;

    const currentValue = parseInt(slider.value);

    const rangeMin = Math.max(0, Math.floor(minVal)) || 0;
    const rangeMax = Math.max(Math.ceil(maxVal), rangeMin + 1000);

    slider.min = String(rangeMin);
    slider.max = String(rangeMax);

    if (currentValue < rangeMin || currentValue > rangeMax) {
      slider.value = String(rangeMin);
    }

    const formatCurrency = (value: number) => `R$ ${value.toLocaleString('pt-BR')}`;
    DOMUtils.updateContent('minRange', `Min: ${formatCurrency(minVal)}`, false);
    DOMUtils.updateContent('maxRange', `Max: ${formatCurrency(maxVal)}`, false);

    this.updateSliderDisplay();
  }

  resetSliderRange(): void {
    const slider = DOMUtils.getElementById('minValue') as HTMLInputElement | null;
    if (!slider) return;

    slider.min = '0';
    slider.max = '100000';
    slider.value = '0';

    DOMUtils.updateContent('minRange', 'Min: R$ 0', false);
    DOMUtils.updateContent('maxRange', 'Max: R$ 100.000', false);

    this.updateSliderDisplay();
  }

  updateSliderDisplay(): void {
    const slider = DOMUtils.getElementById('minValue') as HTMLInputElement | null;
    const display = DOMUtils.getElementById('minValueValue');

    if (!slider || !display) return;

    const value = parseInt(slider.value);

    const formatValue = (val: number): string => {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
      return val.toLocaleString('pt-BR');
    };

    DOMUtils.updateContent(display, formatValue(value), false);
  }

  setupEventListeners(updateCallback: () => void): void {
    this.setupSliderListeners(updateCallback);
    this.setupSelectListeners(updateCallback);
    this.setupSearchListeners(updateCallback);
    this.setupToggleListeners(updateCallback);
  }

  setupSliderListeners(updateCallback: () => void): void {
    const minValueSlider = DOMUtils.getElementById('minValue');

    if (minValueSlider) {
      DOMUtils.addEventListener(minValueSlider, 'input', () => {
        this.updateSliderDisplay();

        clearTimeout(this.sliderTimeout!);
        this.sliderTimeout = setTimeout(() => {
          updateCallback();
        }, 500);
      });
    }

    const forceSlider = DOMUtils.getElementById('forceStrength') as HTMLInputElement | null;

    if (forceSlider) {
      DOMUtils.addEventListener(forceSlider, 'input', (e) => {
        const target = (e as InputEvent).target as HTMLInputElement;
        const forceValue = parseInt(target.value);

        const win = window as unknown as Record<string, unknown>;
        if (win['currentSimulation']) {
          type D3Any = Record<string, (...args: unknown[]) => D3Any>;
          const sim = win['currentSimulation'] as D3Any;
          const strength = -forceValue * 50;
          const d3 = window.d3 as unknown as D3Any;
          sim['force']('charge', d3['forceManyBody']()['strength'](strength));
          sim['alphaTarget'](0.3)['restart']();
          setTimeout(() => sim['alphaTarget'](0), 1000);
        }
      });
    }
  }

  setupSelectListeners(updateCallback: () => void): void {
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

  setupSearchListeners(updateCallback: () => void): void {
    const searchBox = DOMUtils.getElementById('searchBox') as HTMLInputElement | null;
    const clearSearch = DOMUtils.getElementById('clearSearch');

    if (searchBox) {
      DOMUtils.addEventListener(searchBox, 'input', (e) => {
        const target = (e as InputEvent).target as HTMLInputElement;
        const value = target.value.trim();

        if (clearSearch) {
          if (value) {
            DOMUtils.removeClass(clearSearch, 'hidden');
          } else {
            DOMUtils.addClass(clearSearch, 'hidden');
          }
        }

        clearTimeout(this.searchTimeout!);
        this.searchTimeout = setTimeout(() => {
          updateCallback();
        }, 300);
      });

      DOMUtils.addEventListener(searchBox, 'keydown', (e) => {
        const ke = e as KeyboardEvent;
        if (ke.key === 'Enter') {
          clearTimeout(this.searchTimeout!);
          updateCallback();
        } else if (ke.key === 'Escape') {
          searchBox.value = '';
          if (clearSearch) {
            DOMUtils.addClass(clearSearch, 'hidden');
          }
          clearTimeout(this.searchTimeout!);
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

  setupToggleListeners(updateCallback: () => void): void {
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

    this.setupDisplayToggles();
  }

  setupDisplayToggles(): void {
    const showCompanyNames = DOMUtils.getElementById('showCompanyNames');
    const showEdgeAmounts = DOMUtils.getElementById('showEdgeAmounts');

    if (showCompanyNames) {
      DOMUtils.addEventListener(showCompanyNames, 'change', (e) => {
        const target = (e as Event).target as HTMLInputElement;
        document.dispatchEvent(
          new CustomEvent('companyLabelsToggled', {
            detail: { showNames: target.checked },
          })
        );
      });
    }

    if (showEdgeAmounts) {
      DOMUtils.addEventListener(showEdgeAmounts, 'change', (e) => {
        const target = (e as Event).target as HTMLInputElement;
        document.dispatchEvent(
          new CustomEvent('edgeAmountsToggled', {
            detail: { showAmounts: target.checked },
          })
        );
      });
    }
  }

  getNetworkFilters(): NetworkFilters {
    const densityToggle = DOMUtils.getElementById('networkDensityToggle') as HTMLInputElement | null;
    const topExpensesToggle = DOMUtils.getElementById('topExpensesToggle') as HTMLInputElement | null;

    return {
      densityMode: densityToggle ? densityToggle.checked : false,
      topExpensesMode: topExpensesToggle ? topExpensesToggle.checked : false,
    };
  }

  async initialize(updateCallback: () => void): Promise<void> {
    try {
      await this.populateFilters();
      this.setupEventListeners(updateCallback);
      this.updateSliderDisplay();
    } catch (error) {
      ErrorHandler.handleError(error as Error, 'Filter Manager Initialization');
    }
  }

  dispose(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    if (this.sliderTimeout) clearTimeout(this.sliderTimeout);
    this.searchTimeout = null;
    this.sliderTimeout = null;
  }
}
