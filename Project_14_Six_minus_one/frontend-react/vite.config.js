import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND = "http://127.0.0.1:8001";

/**
 * Dev / vite preview: browser only talks to :5173; API + /eye + sample-input are proxied to FastAPI.
 * /history is both SPA route and REST — HTML navigations get index.html; API calls go to backend.
 *
 * Vite proxy bypass (unlike http-proxy): return a string to rewrite req.url and skip the proxy;
 * return false sends HTTP 404. To forward to the target, return undefined (omit return).
 */
function historyBypass(req) {
  const url = req.url || "";
  const pathOnly = url.split("?")[0];
  const accept = req.headers.accept || "";
  if (pathOnly.startsWith("/history/")) {
    return;
  }
  if (pathOnly === "/history" && url.includes("limit=")) {
    return;
  }
  if (accept.includes("text/html")) {
    return "/index.html";
  }
  return;
}

const proxy = {
  "/analyze": { target: BACKEND, changeOrigin: true },
  "/analyze-url": { target: BACKEND, changeOrigin: true },
  "/analyze-zip": { target: BACKEND, changeOrigin: true },
  "/visual-complexity": { target: BACKEND, changeOrigin: true },
  "/visual-complexity-url": { target: BACKEND, changeOrigin: true },
  "/assistant": { target: BACKEND, changeOrigin: true },
  "/health": { target: BACKEND, changeOrigin: true },
  "/api": { target: BACKEND, changeOrigin: true },
  "/samples": { target: BACKEND, changeOrigin: true },
  "/sample-input": { target: BACKEND, changeOrigin: true },
  "/eye": { target: BACKEND, changeOrigin: true },
  "/history": { target: BACKEND, changeOrigin: true, bypass: historyBypass },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy,
  },
  preview: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy,
  },
});
