import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initMonitoring } from './lib/monitoring.ts'
import './index.css' // ¡Esta línea es crucial!

// Antes de montar, para que también capture lo que falle durante el render
// inicial. Sin VITE_SENTRY_DSN no hace absolutamente nada.
initMonitoring();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// El Service Worker solo en producción. En `vite dev` intercepta los módulos
// que sirve Vite y los devuelve desde la caché, así que se seguían viendo
// cambios viejos en localhost por más que el dev server mande no-store. Este
// bloque además desregistra el que haya quedado instalado de antes y limpia
// sus cachés, para no tener que ir a "borrar datos del sitio" a mano.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', async () => {
      const reg = await navigator.serviceWorker.register('/sw.js');
      // Al volver a la pestaña se busca si hay una versión nueva del SW; sin
      // esto el navegador solo chequea al navegar o cada 24 h.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update();
      });
    });
  } else {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    if ('caches' in window) caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
}
