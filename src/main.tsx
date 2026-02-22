import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import './index.css';

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