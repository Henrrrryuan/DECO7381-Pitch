const DASHBOARD_STORAGE_KEY = "cognilens-dashboard-session";
export const DASHBOARD_HISTORY_CONTEXT_KEY = "cognilens.dashboard.history-context";
export const DASHBOARD_HISTORY_ONCE_KEY = "cognilens.dashboard.history-once";

// Convert backend ISO timestamps into the user's local date/time format.
// Used by ReportRows.jsx and EyeRows.jsx before dates are displayed in rows.
export function formatDate(value) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value || "";
  }
  return parsedDate.toLocaleString();
}

// Format saved eye-tracking session duration in a compact readable form.
// Used by EyeRows.jsx to show metadata such as "2m 14s" beside each session.
export function formatDuration(durationMilliseconds) {
  const totalSeconds = Math.max(0, Math.round((Number(durationMilliseconds) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

// Show the same short ID format used by the original frontend: prefix plus the
// first six uppercase characters, while full IDs stay available in title text.
// Used by ReportRows.jsx and EyeRows.jsx so long backend IDs stay scannable.
export function formatShortId(fullIdentifier, prefix = "") {
  const identifierText = String(fullIdentifier || "").trim();
  if (!identifierText) {
    return "-";
  }
  return `${prefix}${identifierText.slice(0, 6).toUpperCase()}`;
}

// Display the timestamp-based report label now used by the dashboard and the
// old progressive History page. The full backend run_id remains available in
// title text where needed, but the visible label is easier to compare by time.
export function formatReportTimestamp(value) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const hour = String(parsedDate.getHours()).padStart(2, "0");
  const minute = String(parsedDate.getMinutes()).padStart(2, "0");
  const second = String(parsedDate.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}${second}`;
}

// Shared pagination helpers used by HistoryPage.jsx and Pagination.jsx.
// HistoryPage.jsx uses getTotalPages to keep page state inside valid bounds,
// while Pagination.jsx uses it to display "Page X of Y".
export function getTotalPages(totalItems, pageSize) {
  return Math.max(1, Math.ceil((Number(totalItems) || 0) / pageSize));
}

export function getPageOffset(pageNumber, pageSize) {
  return (Math.max(1, Number(pageNumber) || 1) - 1) * pageSize;
}

// Convert a full report detail response into the sessionStorage shape expected
// by the existing vanilla Dashboard page. HistoryPage.jsx calls this after
// fetchReportDetail returns data from api/historyApi.js.
export function buildCurrentSession(reportDetail) {
  const sourceName = reportDetail.run?.source_name || "history-item";
  const sourceUrl = /^https?:\/\//i.test(sourceName) ? sourceName : "";
  return {
    current: {
      payload: {
        ...reportDetail.analysis,
        run: reportDetail.run,
      },
      html: reportDetail.html_content || "",
      sourceName,
      sourceUrl,
      savedAt: reportDetail.run?.created_at || new Date().toISOString(),
    },
    previous: null,
    sourceUrl,
  };
}

export function saveDashboardSession(dashboardSessionPayload) {
  // Store the converted report so the React Dashboard can reopen the selected run.
  sessionStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(dashboardSessionPayload));
}
