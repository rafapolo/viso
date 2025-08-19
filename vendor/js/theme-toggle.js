// Theme Toggle Functionality
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        // Get initial theme
        const savedTheme = localStorage.getItem('theme') || 
            (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        
        // Apply initial theme
        const html = document.documentElement;
        if (savedTheme === 'dark') {
            html.classList.add('dark');
            themeToggle.textContent = '☀️';
        } else {
            html.classList.remove('dark');
            themeToggle.textContent = '🌙';
        }
        
        // Add click handler
        themeToggle.addEventListener('click', () => {
            const isDark = html.classList.contains('dark');
            
            if (isDark) {
                html.classList.remove('dark');
                themeToggle.textContent = '🌙';
                localStorage.setItem('theme', 'light');
            } else {
                html.classList.add('dark');
                themeToggle.textContent = '☀️';
                localStorage.setItem('theme', 'dark');
            }
        });
    }
});