// ===== TOOLTIP MANAGER =====
export class TooltipManager {
    constructor() {
        this.tooltip = null;
        this.isVisible = false;
        this.hideTimeout = null;
        this.createTooltip();
    }

    createTooltip() {
        if (document.getElementById('sankey-tooltip')) return;
        
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'sankey-tooltip';
        this.tooltip.className = 'sankey-tooltip';
        this.tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(10px);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            line-height: 1.4;
            max-width: 300px;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            font-family: 'Inter', sans-serif;
        `;
        document.body.appendChild(this.tooltip);
    }

    show(content, x, y) {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        this.tooltip.innerHTML = content;
        
        // Position tooltip
        const rect = this.tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Adjust horizontal position
        let adjustedX = x + 15;
        if (adjustedX + rect.width > viewportWidth - 10) {
            adjustedX = x - rect.width - 15;
        }
        
        // Adjust vertical position  
        let adjustedY = y - 10;
        if (adjustedY + rect.height > viewportHeight - 10) {
            adjustedY = y - rect.height - 10;
        }
        
        this.tooltip.style.left = `${Math.max(10, adjustedX)}px`;
        this.tooltip.style.top = `${Math.max(10, adjustedY)}px`;
        
        // Show with animation
        requestAnimationFrame(() => {
            this.tooltip.style.opacity = '1';
            this.tooltip.style.transform = 'translateY(0)';
            this.isVisible = true;
        });
    }

    hide() {
        if (!this.isVisible) return;
        
        this.tooltip.style.opacity = '0';
        this.tooltip.style.transform = 'translateY(10px)';
        this.isVisible = false;
        
        this.hideTimeout = setTimeout(() => {
            this.tooltip.style.left = '-9999px';
        }, 150);
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    formatNumber(value) {
        return new Intl.NumberFormat('pt-BR').format(value);
    }
}

// ===== UI COMPONENTS =====
export class UIComponents {
    static setupThemeToggle(toggleElementId = 'theme-toggle') {
        const themeToggle = document.getElementById(toggleElementId);
        const html = document.documentElement;
        
        if (!themeToggle) {
            console.warn(`Theme toggle element with id '${toggleElementId}' not found`);
            return;
        }

        const savedTheme = localStorage.getItem('theme') || 'dark';
        html.classList.toggle('dark', savedTheme === 'dark');
        
        themeToggle.addEventListener('click', () => {
            const isDark = html.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            
            themeToggle.dispatchEvent(new CustomEvent('themeChanged', {
                detail: { theme: isDark ? 'dark' : 'light' }
            }));
        });

        return {
            getCurrentTheme: () => html.classList.contains('dark') ? 'dark' : 'light',
            setTheme: (theme) => {
                html.classList.toggle('dark', theme === 'dark');
                localStorage.setItem('theme', theme);
            }
        };
    }

    static createPagination(containerId, options = {}) {
        const {
            currentPage = 1,
            totalPages = 1,
            maxVisiblePages = 10,
            onPageChange = () => {}
        } = options;

        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Pagination container with id '${containerId}' not found`);
            return;
        }

        const pagination = {
            currentPage,
            totalPages,
            maxVisiblePages,
            onPageChange,
            
            render() {
                if (this.totalPages <= 1) {
                    container.innerHTML = '';
                    container.style.display = 'none';
                    return;
                }

                container.style.display = 'flex';
                container.className = 'flex items-center justify-center gap-2 mt-4';

                const buttons = this.generateButtons();
                container.innerHTML = buttons.join('');

                container.querySelectorAll('button').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const page = parseInt(e.target.dataset.page);
                        if (page && page !== this.currentPage) {
                            this.goToPage(page);
                        }
                    });
                });
            },

            generateButtons() {
                const buttons = [];
                
                buttons.push(`
                    <button 
                        data-page="${this.currentPage - 1}"
                        class="px-3 py-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                        ${this.currentPage === 1 ? 'disabled' : ''}
                    >
                        ← Anterior
                    </button>
                `);

                const startPage = Math.max(1, this.currentPage - Math.floor(this.maxVisiblePages / 2));
                const endPage = Math.min(this.totalPages, startPage + this.maxVisiblePages - 1);

                if (startPage > 1) {
                    buttons.push(this.createPageButton(1));
                    if (startPage > 2) {
                        buttons.push('<span class="px-2 text-gray-400">...</span>');
                    }
                }

                for (let i = startPage; i <= endPage; i++) {
                    buttons.push(this.createPageButton(i, i === this.currentPage));
                }

                if (endPage < this.totalPages) {
                    if (endPage < this.totalPages - 1) {
                        buttons.push('<span class="px-2 text-gray-400">...</span>');
                    }
                    buttons.push(this.createPageButton(this.totalPages));
                }

                buttons.push(`
                    <button 
                        data-page="${this.currentPage + 1}"
                        class="px-3 py-2 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                        ${this.currentPage === this.totalPages ? 'disabled' : ''}
                    >
                        Próxima →
                    </button>
                `);

                return buttons;
            },

            createPageButton(page, isActive = false) {
                const activeClass = isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600';
                return `
                    <button 
                        data-page="${page}"
                        class="px-3 py-2 text-sm ${activeClass} rounded"
                    >
                        ${page}
                    </button>
                `;
            },

            goToPage(page) {
                if (page < 1 || page > this.totalPages || page === this.currentPage) return;
                
                this.currentPage = page;
                this.onPageChange(page);
                this.render();
            },

            updateTotalPages(total) {
                this.totalPages = total;
                if (this.currentPage > total) {
                    this.currentPage = Math.max(1, total);
                }
                this.render();
            }
        };

        pagination.render();
        return pagination;
    }

    static createSearch(inputId, options = {}) {
        const {
            placeholder = 'Pesquisar...',
            onSearch = () => {},
            debounceMs = 300,
            minChars = 1
        } = options;

        const input = document.getElementById(inputId);
        if (!input) {
            console.warn(`Search input with id '${inputId}' not found`);
            return;
        }

        input.placeholder = placeholder;
        
        let debounceTimer;
        
        const searchController = {
            onSearch,
            
            handleInput(value) {
                clearTimeout(debounceTimer);
                
                if (value.length < minChars && value.length > 0) return;
                
                debounceTimer = setTimeout(() => {
                    this.onSearch(value);
                }, debounceMs);
            },

            clear() {
                input.value = '';
                this.onSearch('');
            },

            setValue(value) {
                input.value = value;
            },

            getValue() {
                return input.value;
            }
        };

        input.addEventListener('input', (e) => searchController.handleInput(e.target.value));
        
        return searchController;
    }

    static createNotification(message, type = 'info', duration = 5000) {
        const typeStyles = {
            success: 'bg-green-600 border-green-500',
            error: 'bg-red-600 border-red-500',
            warning: 'bg-yellow-600 border-yellow-500',
            info: 'bg-blue-600 border-blue-500'
        };

        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white border ${typeStyles[type]} transform transition-transform duration-300 translate-x-full`;
        notification.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="flex-1">${message}</div>
                <button class="text-white hover:text-gray-200 notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 10);

        const remove = () => {
            notification.classList.add('translate-x-full');
            setTimeout(() => notification.remove(), 300);
        };

        notification.querySelector('.notification-close').addEventListener('click', remove);

        if (duration > 0) {
            setTimeout(remove, duration);
        }

        return { remove };
    }
}

// ===== CHART UTILITIES =====
export class ChartUtils {
    static createCategoryPieChart(canvas, data, options = {}) {
        const {
            maxSlices = 10,
            showLegend = true,
            legendElementId = null,
            colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280']
        } = options;

        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) / 2 - 20;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!data || !data.length) {
            this.showChartEmptyState(canvas);
            return;
        }

        const sortedData = [...data].sort((a, b) => b[1] - a[1]);
        const topData = sortedData.slice(0, maxSlices);
        
        if (sortedData.length > maxSlices) {
            const othersValue = sortedData.slice(maxSlices).reduce((sum, [, value]) => sum + value, 0);
            topData.push(['Outros', othersValue]);
        }

        const total = topData.reduce((sum, [, value]) => sum + value, 0);
        let currentAngle = -Math.PI / 2;

        const chartData = topData.map(([category, value], index) => {
            const sliceAngle = (value / total) * 2 * Math.PI;
            const color = colors[index % colors.length];
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.lineTo(centerX, centerY);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#1f2937';
            ctx.lineWidth = 2;
            ctx.stroke();

            const result = {
                category,
                value,
                percentage: (value / total) * 100,
                color,
                startAngle: currentAngle,
                endAngle: currentAngle + sliceAngle
            };

            currentAngle += sliceAngle;
            return result;
        });

        if (showLegend && legendElementId) {
            this.createChartLegend(legendElementId, chartData);
        }

        return chartData;
    }

    static showChartEmptyState(canvas) {
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#6B7280';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Nenhum dado disponível', centerX, centerY);
    }

    static createChartLegend(elementId, chartData) {
        const legendElement = document.getElementById(elementId);
        if (!legendElement) return;

        legendElement.innerHTML = chartData.map(item => `
            <div class="flex items-center gap-2 text-xs">
                <div class="w-3 h-3 rounded-full" style="background-color: ${item.color}"></div>
                <span class="flex-1 truncate text-gray-300">${item.category}</span>
                <span class="text-gray-400">${item.percentage.toFixed(1)}%</span>
            </div>
        `).join('');
    }

    static addChartInteractivity(canvas, chartData, onSliceClick = null, onSliceHover = null) {
        if (!chartData || !chartData.length) return;

        const rect = canvas.getBoundingClientRect();
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) / 2 - 20;

        const getSliceFromPoint = (x, y) => {
            const canvasX = (x - rect.left) * (canvas.width / rect.width);
            const canvasY = (y - rect.top) * (canvas.height / rect.height);
            
            const dx = canvasX - centerX;
            const dy = canvasY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > radius) return null;

            let angle = Math.atan2(dy, dx) + Math.PI / 2;
            if (angle < 0) angle += 2 * Math.PI;

            return chartData.find(slice => angle >= slice.startAngle && angle < slice.endAngle);
        };

        if (onSliceClick) {
            canvas.addEventListener('click', (event) => {
                const slice = getSliceFromPoint(event.clientX, event.clientY);
                if (slice) onSliceClick(slice);
            });
        }

        if (onSliceHover) {
            canvas.addEventListener('mousemove', (event) => {
                const slice = getSliceFromPoint(event.clientX, event.clientY);
                onSliceHover(slice);
                canvas.style.cursor = slice ? 'pointer' : 'default';
            });
        }
    }
}