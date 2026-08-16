import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import { installModuleVersionRecovery } from './app/runtime/moduleRecovery';
import { registerServiceWorker } from './infrastructure/pwa/registerServiceWorker';
import './core/themes/themes.css';
import './styles/global.css';
import './styles/premium-finish.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

installModuleVersionRecovery();
registerServiceWorker();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppProviders />
  </React.StrictMode>,
);
