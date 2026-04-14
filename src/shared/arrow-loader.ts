// Apache Arrow loading utility
function waitForArrow(callback: () => void, maxAttempts = 500): void {
  let attempts = 0;
  const checkArrow = (): void => {
    attempts++;
    if (typeof window.Arrow !== 'undefined') {
      callback();
    } else if (attempts >= maxAttempts) {
      console.error('Apache Arrow failed to load after', maxAttempts, 'attempts');
      callback(); // Continue anyway to avoid blocking
    } else {
      setTimeout(checkArrow, 10);
    }
  };
  checkArrow();
}

// Ensure Apache Arrow is loaded before modules
function initializeArrow(): Promise<void> {
  return new Promise((resolve) => {
    waitForArrow(() => {
      // Apache Arrow is ready, proceed with module loading
      document.body.setAttribute('data-arrow-loaded', 'true');
      window.arrowReady = true;
      resolve();
    });
  });
}

// Start initialization immediately, not waiting for DOMContentLoaded
initializeArrow();

export { waitForArrow, initializeArrow };
