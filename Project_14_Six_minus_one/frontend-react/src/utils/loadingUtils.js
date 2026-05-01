import {
  DASHBOARD_SESSION_STORAGE_KEY,
  PENDING_ANALYSIS_STORAGE_KEY,
} from "./uploadUtils.js";

export const MINIMUM_LOADING_TIME_MS = 2600;
export const DASHBOARD_PAGE_ROUTE = "/dashboard";
export const DASHBOARD_HISTORY_CONTEXT_KEY = "cognilens.dashboard.history-context";
export const DASHBOARD_HISTORY_ONCE_KEY = "cognilens.dashboard.history-once";

// Utility functions shared by LoadingPage.jsx.
//
// HomePage.jsx creates the pending-analysis payload. LoadingPage.jsx reads it,
// calls backend analysis APIs, saves a local Vite copy for future baseline
// selection, then opens the migrated React Dashboard by Report ID.

export function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function createAnalysisCancelledError() {
  const error = new Error("Analysis cancelled by user.");
  error.name = "AnalysisCancelledError";
  return error;
}

export function loadPendingAnalysisPayload() {
  const serializedPendingAnalysis = sessionStorage.getItem(PENDING_ANALYSIS_STORAGE_KEY);
  if (!serializedPendingAnalysis) {
    throw new Error("No pending analysis was found. Start a new analysis first.");
  }

  try {
    return JSON.parse(serializedPendingAnalysis);
  } catch (_) {
    sessionStorage.removeItem(PENDING_ANALYSIS_STORAGE_KEY);
    throw new Error("The pending analysis could not be read. Start a new analysis again.");
  }
}

export async function createFileFromDataAddress(dataAddress, fileName, fileType) {
  const response = await fetch(dataAddress);
  const fileBlob = await response.blob();
  return new File([fileBlob], fileName, {
    type: fileType || fileBlob.type || "application/octet-stream",
  });
}

export function loadViteDashboardSession() {
  const serializedDashboardSession = sessionStorage.getItem(DASHBOARD_SESSION_STORAGE_KEY);
  if (!serializedDashboardSession) {
    return null;
  }

  try {
    return JSON.parse(serializedDashboardSession);
  } catch (_) {
    sessionStorage.removeItem(DASHBOARD_SESSION_STORAGE_KEY);
    return null;
  }
}

export function saveViteDashboardSession(analysisResult) {
  const previousDashboardSession = loadViteDashboardSession();
  const savedAt = new Date().toISOString();
  const dashboardSessionPayload = {
    current: {
      payload: analysisResult.payload,
      html: analysisResult.htmlContent,
      sourceName: analysisResult.sourceName,
      sourceType: analysisResult.sourceType,
      sourceUrl: analysisResult.sourceUrl,
      savedAt,
    },
    previous: previousDashboardSession?.current || null,
    html: analysisResult.htmlContent,
    sourceName: analysisResult.sourceName,
    sourceUrl: analysisResult.sourceUrl,
    savedAt,
  };
  const serializedDashboardSession = JSON.stringify(dashboardSessionPayload);
  sessionStorage.setItem(DASHBOARD_SESSION_STORAGE_KEY, serializedDashboardSession);
  try {
    localStorage.setItem(DASHBOARD_SESSION_STORAGE_KEY, serializedDashboardSession);
  } catch (_) {
    // localStorage may be blocked; sessionStorage is enough for this Vite page.
  }
}

export function clearPendingAnalysisPayload() {
  sessionStorage.removeItem(PENDING_ANALYSIS_STORAGE_KEY);
}

export function openDashboardForRun(runIdentifier) {
  const encodedRunIdentifier = encodeURIComponent(runIdentifier || "");
  try {
    sessionStorage.setItem(DASHBOARD_HISTORY_CONTEXT_KEY, runIdentifier || "");
    sessionStorage.setItem(DASHBOARD_HISTORY_ONCE_KEY, "1");
  } catch (_) {
    // The URL run parameter is enough for the Dashboard history fallback.
  }
  window.location.href = `${DASHBOARD_PAGE_ROUTE}?from=history&run=${encodedRunIdentifier}`;
}
