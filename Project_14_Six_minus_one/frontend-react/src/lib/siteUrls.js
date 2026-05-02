import { API_BASE } from "./common.js";

/** Eye UI is served from the API host (Vite dev: proxied at same origin as the React app). */
export const eyeTrackingHref = `${API_BASE.replace(/\/$/, "")}/eye/`;

/**
 * React Router paths — use from JSX and from static pages (e.g. `eye/index.html`) so
 * Guide / History / Home stay inside the SPA when opened from `/eye/` on the same origin.
 */
export const spaHomeHref = "/";
/** Matches native `docs.html` from History / Loading (no analysis context). */
export const spaGuideDefaultHref = "/docs";
/** Matches native index upload page `docs.html?source=landing`. */
export const spaGuideLandingHref = "/docs?source=landing";
/** Matches native dashboard `docs.html?source=analysis`. */
export const spaGuideAnalysisHref = "/docs?source=analysis";
export const spaHistoryHref = "/history";
