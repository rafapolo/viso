// Force dark mode only - no theme toggle functionality
document.addEventListener('DOMContentLoaded', () => {
    const html = document.documentElement;
    html.classList.add('dark');
    localStorage.setItem('theme', 'dark');
});