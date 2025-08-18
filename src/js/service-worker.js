// Service Worker Registration and PWA Install
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('SW registered: ', registration);
            
            // Handle install prompt
            let deferredPrompt;
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                showInstallButton();
            });
            
            function showInstallButton() {
                const installBtn = document.createElement('button');
                installBtn.innerHTML = '📱 Instalar App';
                installBtn.className = 'fixed top-4 left-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 z-50';
                installBtn.onclick = async () => {
                    if (deferredPrompt) {
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        console.log(`User ${outcome} the install prompt`);
                        deferredPrompt = null;
                        installBtn.remove();
                    }
                };
                document.body.appendChild(installBtn);
                
                // Auto-hide after 10 seconds
                setTimeout(() => {
                    if (installBtn.parentNode) {
                        installBtn.remove();
                    }
                }, 10000);
            }
        } catch (error) {
            console.log('SW registration failed: ', error);
        }
    });
}