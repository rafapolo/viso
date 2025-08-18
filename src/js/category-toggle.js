// Category toggle function for accordion behavior
function toggleCategory(categoryId) {
    const categorySection = document.querySelector(`[data-category="${categoryId}"]`);
    if (!categorySection) return;
    
    const content = categorySection.querySelector('.category-content');
    const chevron = categorySection.querySelector('.category-chevron');
    
    if (!content || !chevron) return;
    
    // Check if currently open
    const isCurrentlyOpen = content.style.display === 'block' || 
                            window.getComputedStyle(content).display === 'block';
    
    // Close all categories first
    document.querySelectorAll('.category-section').forEach(section => {
        const otherContent = section.querySelector('.category-content');
        const otherChevron = section.querySelector('.category-chevron');
        
        if (otherContent && otherChevron) {
            otherContent.style.display = 'none';
            otherChevron.style.transform = 'rotate(-90deg)';
        }
    });
    
    // If the clicked category was closed, open it
    if (!isCurrentlyOpen) {
        content.style.display = 'block';
        chevron.style.transform = 'rotate(0deg)';
    }
    // If it was already open, it stays closed (true accordion behavior)
}

// Make function globally available
window.toggleCategory = toggleCategory;