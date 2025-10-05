import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App';
import '@rainbow-me/rainbowkit/styles.css';
import './styles/globals.css';
import { loadConfig } from './utils/config';

Sentry.init({
  dsn: "https://be3ee3824118e9b48006469cf7743103@o4508149225422848.ingest.us.sentry.io/4510123204673537",
  sendDefaultPii: true
});

// Load configuration before rendering the app
loadConfig().then(() => {
  // Remove the initial loading overlay
  const initialLoading = document.getElementById('initial-loading');
  if (initialLoading) {
    initialLoading.remove();
  }

  // StrictMode disabled to prevent double initialization of physics/3D systems
  // StrictMode causes components to mount twice in development, which breaks
  // singleton systems like Rapier physics that don't support multiple instances
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <App />
  );
});
