import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@rainbow-me/rainbowkit/styles.css';
import './styles/globals.css';
import '@charcoal-ui/icons';
import { loadConfig } from './utils/config';

// Load configuration before rendering the app
loadConfig().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
