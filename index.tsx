
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'driver.js/dist/driver.css';
import { initSentry } from './services/sentryService';

// Fire-and-forget Sentry init. Returns a Promise but we don't await — render
// shouldn't block on it. If Sentry isn't installed or no DSN, init silently
// no-ops and the app continues normally.
initSentry();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
