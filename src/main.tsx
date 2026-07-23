import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import './index.css';

const CHUNK_RELOAD_KEY = 'optmamenu.chunk-reload-attempted-at';
const CHUNK_RELOAD_WINDOW_MS = 30_000;

function reloadAfterChunkFailure() {
  const previousAttempt = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
  const now = Date.now();

  if (previousAttempt > 0 && now - previousAttempt < CHUNK_RELOAD_WINDOW_MS) {
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  window.location.reload();
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadAfterChunkFailure();
});

window.addEventListener('error', (event) => {
  const message = String(event.message ?? '');
  const isDynamicImportFailure =
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Expected a JavaScript-or-Wasm module script');

  if (isDynamicImportFailure) {
    reloadAfterChunkFailure();
  }
});

window.setTimeout(() => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
}, 10_000);

const rootElement = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hot Module Replacement (HMR) for better DX
if (import.meta.hot) {
  import.meta.hot.accept();
}
