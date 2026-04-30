const DASHBOARD_STORAGE_KEY = "cognilens-dashboard-session";

// Convert backend ISO timestamps into the user's local date/time format.
export function formatDate(value) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value || "";
  }
  return parsedDate.toLocaleString();
}

// Format saved eye-tracking session duration in a compact readable form.
export function formatDuration(durationMilliseconds) {
  const totalSeconds = Math.max(0, Math.round((Number(durationMilliseconds) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

// Show the same short ID format used by the original frontend: prefix plus the
// first six uppercase characters, while full IDs stay available in title text.
export function formatShortId(fullIdentifier, prefix = "") {
  const identifierText = String(fullIdentifier || "").trim();
  if (!identifierText) {
    return "-";
  }
  return `${prefix}${identifierText.slice(0, 6).toUpperCase()}`;
}

// Shared pagination helpers used by both report history and eye evidence.
export function getTotalPages(total, pageSize) {
  return Math.max(1, Math.ceil((Number(total) || 0) / pageSize));
}

export function getPageOffset(pageNumber, pageSize) {
  return (Math.max(1, Number(pageNumber) || 1) - 1) * pageSize;
}

// Convert a full report detail response into the sessionStorage shape expected
// by the existing vanilla Dashboard page.
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
  sessionStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(dashboardSessionPayload));
}
