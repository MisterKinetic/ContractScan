import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import axios from 'axios'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://3e71d71ce572b60df30f8b81cc3b8fe7@o4511158785671168.ingest.us.sentry.io/4511158805987328",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

axios.defaults.withCredentials = true;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
