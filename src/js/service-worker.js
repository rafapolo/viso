// Service Worker Registration and PWA Install

// Handle install prompt
let deferredPrompt;

function showInstallButton() {
  const installBtn = document.createElement('button');
  installBtn.innerHTML = '📱 Instalar App';
  installBtn.className = 'fixed top-4 left-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 z-50';
  installBtn.onclick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      // Service workers need console logging for debugging
      // eslint-disable-next-line no-console
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      // Service workers need console logging for debugging
      // eslint-disable-next-line no-console
      console.log('SW registered: ', registration);
      
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
      });
    } catch (error) {
      // Service workers need console logging for debugging
      // eslint-disable-next-line no-console
      console.log('SW registration failed: ', error);
    }
  });
}