// Navigation utilities
import { getBasePath } from './app-config.js';

window.navigateToDb = () => {
    const basePath = getBasePath();
    window.location.href = `${basePath}db.html?analise=sankey-fluxos`;
};

window.navigateToIndex = () => {
    const basePath = getBasePath();
    window.location.href = basePath ? `${basePath}index.html` : './index.html';
};

window.navigateToNetwork = () => {
    const basePath = getBasePath();
    window.location.href = `${basePath}index.html`;
};

// Add event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const navToDbBtn = document.getElementById('nav-to-db');
    if (navToDbBtn) {
        navToDbBtn.addEventListener('click', window.navigateToDb);
    }
    
    const navToIndexBtn = document.getElementById('nav-to-index');
    if (navToIndexBtn) {
        navToIndexBtn.addEventListener('click', window.navigateToIndex);
    }
});