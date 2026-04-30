const DASHBOARD_STORAGE_KEY = "cognilens-dashboard-session";

export function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value || "";
  }
  return parsed.toLocaleString();
}

export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function formatShortId(id, prefix = "") {
  const value = String(id || "").trim();
  if (!value) {
    return "-";
  }
  return `${prefix}${value.slice(0, 6).toUpperCase()}`;
}

export function getTotalPages(total, pageSize) {
  return Math.max(1, Math.ceil((Number(total) || 0) / pageSize));
}

export function getPageOffset(page, pageSize) {
  return (Math.max(1, Number(page) || 1) - 1) * pageSize;
}

export function buildCurrentSession(detail) {
  const sourceName = detail.run?.source_name || "history-item";
  const sourceUrl = /^https?:\/\//i.test(sourceName) ? sourceName : "";
  return {
    current: {
      payload: {
        ...detail.analysis,
        run: detail.run,
      },
      html: detail.html_content || "",
      sourceName,
      sourceUrl,
      savedAt: detail.run?.created_at || new Date().toISOString(),
    },
    previous: null,
    sourceUrl,
  };
}

export function saveDashboardSession(payload) {
  sessionStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(payload));
}
