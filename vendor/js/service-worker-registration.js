// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        // Only register service worker in production
        const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
        
        if (!isProduction) {
            console.log('SW registration skipped in development mode');
            
            // Unregister any existing service workers in development
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                    console.log('SW unregistered in development:', registration);
                }
            } catch (error) {
                console.log('SW unregistration failed:', error);
            }
            
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