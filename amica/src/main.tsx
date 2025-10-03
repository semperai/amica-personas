import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App';
import '@rainbow-me/rainbowkit/styles.css';
import './styles/globals.css';
import '@charcoal-ui/icons';
import { loadConfig } from './utils/config';

Sentry.init({
  dsn: "https://be3ee3824118e9b48006469cf7743103@o4508149225422848.ingest.us.sentry.io/4510123204673537",
  sendDefaultPii: true
});

// Load configuration before rendering the app
loadConfig().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
