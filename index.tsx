
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadGoogleMaps } from './utils/googleMapsLoader';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Load Google Maps API with secure API key from environment variables
loadGoogleMaps().catch((error) => {
  console.error('[App] Failed to load Google Maps:', error);
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);