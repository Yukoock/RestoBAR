import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./lib/tema";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { ConfigProvider } from "./lib/config";
import { AvisosProvider } from "./components/ui";
import { ErrorBoundary } from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ConfigProvider>
        <AuthProvider>
          <AvisosProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </AvisosProvider>
        </AuthProvider>
      </ConfigProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Service worker (B9): solo en la versión publicada, para que la app abra sin internet
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => { /* el navegador no lo permite */ }); });
}
