import { API_BASE } from "./common.js";

/** Eye UI is served from the API host (Vite dev: proxied at same origin as the React app). */
export const eyeTrackingHref = `${API_BASE.replace(/\/$/, "")}/eye/`;

/**
 * React Router paths — use from JSX and from static pages (e.g. `eye/index.html`) so
 * History / Home stay inside the SPA when opened from `/eye/` on the same origin.
 */
export const spaHomeHref = "/";
/** Landing-mode history; distinct from analysis-mode report history. */
export const spaLandingHistoryHref = "/history?source=landing";
export const spaHistoryHref = "/history";
