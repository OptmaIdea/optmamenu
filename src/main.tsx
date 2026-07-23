import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import './index.css';

const CHUNK_RELOAD_KEY = 'optmamenu.chunk-reload-attempted';

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();

  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.location.reload();
});

window.addEventListener('error', (event) => {
  const message = String(event.message ?? '');
  const isDynamicImportFailure =
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Expected a JavaScript-or-Wasm module script');

  if (!isDynamicImportFailure) return;

  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.location.reload();
});

window.addEventListener('load', () => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
});

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
