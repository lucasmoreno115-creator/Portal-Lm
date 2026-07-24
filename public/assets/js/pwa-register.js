if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A indisponibilidade do Service Worker não deve alterar o Portal.
    });
  });
}
