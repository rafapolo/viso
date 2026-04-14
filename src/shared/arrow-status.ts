// Ensure Apache Arrow is immediately available
window.arrowReady = typeof window.Arrow !== 'undefined';
if (!window.arrowReady) {
  console.warn('Apache Arrow failed to load');
}
