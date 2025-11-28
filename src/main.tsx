import React from 'react'
import { createRoot } from 'react-dom/client'
import { HandheldScannerProvider } from './contexts/HandheldScannerContext'
import { initGlobalErrorLogger } from './utils/globalErrorLogger'
import App from './App.tsx'
import './index.css'

// Initialize global error logging
initGlobalErrorLogger();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HandheldScannerProvider>
      <App />
    </HandheldScannerProvider>
  </React.StrictMode>
);
