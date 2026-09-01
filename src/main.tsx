import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import './index.css';
import './styles/operationalRefinements.css';

const CHUNK_RELOAD_KEY = 'optmamenu.chunk-reload-attempted-at';
const CHUNK_RELOAD_WINDOW_MS = 30_000;
const THEME_STORAGE_KEY = 'theme';
const VALID_THEME_PREFERENCES = new Set(['light', 'dark', 'system']);

type ThemePreference = 'light' | 'dark' | 'system';

function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);

    if (stored && VALID_THEME_PREFERENCES.has(stored)) {
      return stored as ThemePreference;
    }
  } catch {
    // localStorage pode falhar em contextos restritos.
  }

  return 'system';
}

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyStoredTheme() {
  const preference = getThemePreference();
  const shouldUseDark = preference === 'dark' || (preference === 'system' && systemPrefersDark());

  document.documentElement.classList.toggle('dark', shouldUseDark);
  document.documentElement.dataset.themePreference = preference;
}

applyStoredTheme();

try {
  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  mediaQuery?.addEventListener?.('change', applyStoredTheme);

  window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyStoredTheme();
    }
  });
} catch {
  // noop
}

let lastRoutePathname = '';

function syncRouteDataAttribute() {
  if (window.location.pathname === lastRoutePathname) return;
  lastRoutePathname = window.location.pathname;
  document.documentElement.dataset.route = lastRoutePathname;
}

syncRouteDataAttribute();
window.setInterval(syncRouteDataAttribute, 500);
window.addEventListener('popstate', syncRouteDataAttribute);

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
