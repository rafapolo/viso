// Category toggle functionality for database interface

function toggleCategory(categoryId: string): void {
    const categorySection = document.querySelector<HTMLElement>(`.category-section[data-category="${categoryId}"]`);
    if (!categorySection) return;

    const content = categorySection.querySelector<HTMLElement>('.category-content');
    const chevron = categorySection.querySelector<HTMLElement>('.category-chevron');

    if (content && chevron) {
        const isHidden = content.style.display === 'none';

        // Close all other categories first (accordion behavior)
        const allCategories = document.querySelectorAll<HTMLElement>('.category-section');
        allCategories.forEach(section => {
            if (section !== categorySection) {
                const otherContent = section.querySelector<HTMLElement>('.category-content');
                const otherChevron = section.querySelector<HTMLElement>('.category-chevron');
                if (otherContent) otherContent.style.display = 'none';
                if (otherChevron) otherChevron.style.transform = 'rotate(-90deg)';
            }
        });

        // Toggle the clicked category
        if (isHidden) {
            content.style.display = 'block';
            chevron.style.transform = 'rotate(0deg)';
        } else {
            content.style.display = 'none';
            chevron.style.transform = 'rotate(-90deg)';
        }
    }
}

function shareCurrentQuery(): void {
    // Get the current query from Monaco Editor
    if (window.monacoEditor) {
        const query = window.monacoEditor.getValue();
        if (query.trim()) {
            const encodedQuery = encodeURIComponent(query);
            const shareUrl = `${window.location.origin}${window.location.pathname}?query=${encodedQuery}`;

            // Copy to clipboard
            navigator.clipboard.writeText(shareUrl).then(() => {
                // Show success feedback
                const btn = document.getElementById('share-btn') as HTMLButtonElement | null;
                if (!btn) return;
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
(window as unknown as Record<string, unknown>)['toggleCategory'] = toggleCategory;
(window as unknown as Record<string, unknown>)['shareCurrentQuery'] = shareCurrentQuery;

// Set up event listeners for better practice
document.addEventListener('DOMContentLoaded', () => {
    // Set up category toggles with proper event listeners
    const categoryHeaders = document.querySelectorAll<HTMLElement>('.category-header[data-category]');
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
    const shareBtn = document.querySelector<HTMLElement>('[data-action="share"]');
    if (shareBtn) {
        shareBtn.addEventListener('click', (e) => {
            e.preventDefault();
            shareCurrentQuery();
        });
    }
});

export { toggleCategory, shareCurrentQuery };
