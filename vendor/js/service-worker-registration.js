// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        // Only register service worker in production
        const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
        
        if (!isProduction) {
            console.log('SW registration skipped in development mode');
            return;
        }
        
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('SW registered: ', registration);
            
        } catch (error) {
            console.log('SW registration failed: ', error);
        }
    });
}