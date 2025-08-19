// Category toggle functionality for database interface

function toggleCategory(categoryId) {
    const categorySection = document.querySelector(`.category-section[data-category="${categoryId}"]`);
    if (!categorySection) return;
    
    const content = categorySection.querySelector('.category-content');
    const chevron = categorySection.querySelector('.category-chevron');
    
    if (content && chevron) {
        const isHidden = content.style.display === 'none';
        
        if (isHidden) {
            content.style.display = 'block';
            chevron.style.transform = 'rotate(0deg)';
        } else {
            content.style.display = 'none';
            chevron.style.transform = 'rotate(-90deg)';
        }
    }
}

function shareCurrentQuery() {
    // Get the current query from Monaco Editor
    if (window.monacoEditor) {
        const query = window.monacoEditor.getValue();
        if (query.trim()) {
            const encodedQuery = encodeURIComponent(query);
            const shareUrl = `${window.location.origin}${window.location.pathname}?query=${encodedQuery}`;
            
            // Copy to clipboard
            navigator.clipboard.writeText(shareUrl).then(() => {
                // Show success feedback
                const btn = document.getElementById('share-btn');
                const originalText = btn.innerHTML;
                btn.innerHTML = '📋 Copied!';
                btn.classList.add('bg-green-200', 'dark:bg-green-800');
                btn.classList.remove('bg-blue-200', 'dark:bg-blue-800');
                
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.remove('bg-green-200', 'dark:bg-green-800');
                    btn.classList.add('bg-blue-200', 'dark:bg-blue-800');
                }, 2000);
            }).catch(() => {
                console.error(`Failed to copy to clipboard. Please select and copy manually:\n\n${shareUrl}`);
            });
        } else {
            console.warn('Please write a query first!');
        }
    }
}

// Export functions to global scope for compatibility
window.toggleCategory = toggleCategory;
window.shareCurrentQuery = shareCurrentQuery;

// Set up event listeners for better practice
document.addEventListener('DOMContentLoaded', () => {
    // Set up category toggles with proper event listeners
    const categoryHeaders = document.querySelectorAll('.category-header[data-category]');
    categoryHeaders.forEach(header => {
        const categoryId = header.getAttribute('data-category');
        if (categoryId) {
            header.addEventListener('click', (e) => {
                e.preventDefault();
                toggleCategory(categoryId);
            });
        }
    });
    
    // Set up share button with proper event listener
    const shareBtn = document.querySelector('[data-action="share"]');
    if (shareBtn) {
        shareBtn.addEventListener('click', (e) => {
            e.preventDefault();
            shareCurrentQuery();
        });
    }
});

export { toggleCategory, shareCurrentQuery };