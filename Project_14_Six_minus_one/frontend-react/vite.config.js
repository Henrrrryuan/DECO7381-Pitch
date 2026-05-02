import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Forward API and bundled legacy static (Guide) to FastAPI while developing on :5173. */
const backendTarget = "http://127.0.0.1:8001";

/**
 * React uses client route /history; FastAPI also serves GET /history (JSON list).
 * Browser navigations send Accept: text/html — skip the proxy so Vite serves the SPA.
 * fetch() typically sends a non-HTML Accept header — still proxied to the API.
 */
function bypassHistoryProxyForSpa(req) {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    return false;
  }
  return undefined;
}

const backendProxy = {
  "/static-ui": { target: backendTarget, changeOrigin: true },
  "/analyze-url": { target: backendTarget, changeOrigin: true },
  "/analyze-zip": { target: backendTarget, changeOrigin: true },
  "/analyze": { target: backendTarget, changeOrigin: true },
  "/visual-complexity-url": { target: backendTarget, changeOrigin: true },
  "/visual-complexity": { target: backendTarget, changeOrigin: true },
  "/history": {
    target: backendTarget,
    changeOrigin: true,
    bypass: bypassHistoryProxyForSpa,
  },
  "/assistant": { target: backendTarget, changeOrigin: true },
  "/samples": { target: backendTarget, changeOrigin: true },
  "/api": { target: backendTarget, changeOrigin: true },
  "/health": { target: backendTarget, changeOrigin: true },
  "/eye/proxy": { target: backendTarget, changeOrigin: true },
  "/eye/sessions": { target: backendTarget, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: backendProxy,
  },
  preview: {
    host: "127.0.0.1",
    port: 5173,
    proxy: backendProxy,
  },
});
