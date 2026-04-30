const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8001";

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.detail) {
        detail = payload.detail;
      }
    } catch (error) {
      // Keep the fallback status message when the response body is not JSON.
    }
    throw new Error(detail);
  }
  return response.json();
}

export function buildPagedUrl(path, page, query, pageSize) {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String((Math.max(1, page) - 1) * pageSize),
  });

  if (query) {
    params.set("query", query);
  }

  return `${API_BASE}${path}?${params.toString()}`;
}

export function fetchReportHistory({ page, query, pageSize, signal }) {
  return fetchJson(buildPagedUrl("/history", page, query, pageSize), { signal });
}

export function fetchEyeHistory({ page, query, pageSize, signal }) {
  return fetchJson(buildPagedUrl("/eye/sessions", page, query, pageSize), { signal });
}

export function fetchReportDetail(runId) {
  return fetchJson(`${API_BASE}/history/${runId}`);
}
