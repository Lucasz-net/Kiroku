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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
