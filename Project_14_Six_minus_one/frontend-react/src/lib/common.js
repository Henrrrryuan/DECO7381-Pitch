import { dtLocationsFromPayload, logLineageTimeline, summarizeRun } from "../dashboard/observability/lineageTimeline.js";
import { summarizeDtLocations } from "../dashboard/observability/dtLocationLineage.js";

const STORAGE_KEY = "cognilens-dashboard-session";
const DASHBOARD_AUTHORITATIVE_SOURCE_KEY = "cognilens.dashboard.authoritative-source";
const FALLBACK_API_BASE = "http://127.0.0.1:8001";
const MAX_STORED_HTML_CHARS = 750000;
const isHttpPage = window.location.protocol === "http:" || window.location.protocol === "https:";
const host = window.location.hostname || "127.0.0.1";

/** Vite dev / preview: same-origin + vite proxy → backend. Production build on :8001: direct :8001. */
function resolveApiBase() {
  if (!isHttpPage) {
    return FALLBACK_API_BASE;
  }
  const dev =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV === true) ||
    window.location.port === "5173";
  if (dev) {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return `${window.location.protocol}//${host}:8001`;
}

const API_BASE = resolveApiBase();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

async function fetchJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    const canRetryWithLocalBackend = url.startsWith(API_BASE) && API_BASE !== FALLBACK_API_BASE;
    if (!canRetryWithLocalBackend) {
      throw error;
    }
    const fallbackUrl = `${FALLBACK_API_BASE}${url.slice(API_BASE.length)}`;
    response = await fetch(fallbackUrl, options);
  }
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.detail) {
        detail = payload.detail;
      }
    } catch (error) {
      // Ignore JSON parsing errors and keep the fallback status text.
    }
    throw new Error(detail);
  }
  return response.json();
}

function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value || "";
  }
  return parsed.toLocaleString();
}

function formatShortId(id, prefix = "") {
  const value = String(id || "").trim();
  if (!value) {
    return "—";
  }
  return `${prefix}${value.slice(0, 6).toUpperCase()}`;
}

function formatReportTimestamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  const second = String(parsed.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}${second}`;
}

async function analyzeHtmlText(html, sourceName = "uploaded.html", options = {}) {
  const { persistResult = true } = options;
  return fetchJson(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      source_name: sourceName,
      persist_result: persistResult,
    }),
  });
}

async function analyzeUrl(url, baselineRunId = null) {
  return fetchJson(`${API_BASE}/analyze-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      source_name: url,
      baseline_run_id: baselineRunId,
    }),
  });
}

async function analyzeVicramUrl(url, options = {}) {
  return fetchJson(`${API_BASE}/api/vicram/analyze-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      rows: options.rows ?? 20,
      columns: options.columns ?? 20,
      viewport_width: options.viewportWidth ?? 1366,
      viewport_height: options.viewportHeight ?? 768,
    }),
  });
}

async function analyzeVicramSource(source, options = {}) {
  return fetchJson(`${API_BASE}/api/vicram/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: source?.url || null,
      html: source?.html || null,
      rows: options.rows ?? 20,
      columns: options.columns ?? 20,
      viewport_width: options.viewportWidth ?? 1366,
      viewport_height: options.viewportHeight ?? 768,
    }),
  });
}

async function chatWithAssistant(payload) {
  return fetchJson(`${API_BASE}/assistant/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function isZipFile(file) {
  return Boolean(file?.name?.toLowerCase().endsWith(".zip"));
}

function isHtmlFile(file) {
  return Boolean(file?.name?.toLowerCase().match(/\.html?$/));
}

function withoutLargeInlineHtml(value) {
  if (Array.isArray(value)) {
    return value.map(withoutLargeInlineHtml);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const next = {};
  Object.entries(value).forEach(([key, entryValue]) => {
    if (key === "html_content") {
      return;
    }
    next[key] = withoutLargeInlineHtml(entryValue);
  });
  return next;
}

function trimDashboardSessionForStorage(payload, includeHtml) {
  const currentHtml = includeHtml ? payload?.current?.html || payload?.html || "" : "";
  const previous = payload?.previous
    ? {
        ...payload.previous,
        payload: withoutLargeInlineHtml(payload.previous.payload),
        html: "",
      }
    : null;

  return {
    ...payload,
    current: payload?.current
      ? {
          ...payload.current,
          payload: withoutLargeInlineHtml(payload.current.payload),
          html: currentHtml,
        }
      : payload?.current,
    previous,
    html: currentHtml,
  };
}

function trySetStorage(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    return false;
  }
}

function getRunIdFromPayload(payload) {
  const run = payload?.run || null;
  return String(run?.run_id || run?.id || payload?.run_id || "");
}

function getSourceNameFromPayload(payload) {
  return String(payload?.run?.source_name || payload?.source_name || "");
}

function getPayloadCreatedAtMs(payload) {
  const run = payload?.run || null;
  const raw = run?.created_at || run?.createdAt || payload?.created_at || payload?.createdAt || "";
  const parsed = raw ? Date.parse(String(raw)) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function saveFreshAnalysisAuthority(payload) {
  const currentPayload = payload?.current?.payload || payload?.payload || null;
  const runId = getRunIdFromPayload(currentPayload);
  if (!runId) {
    try {
      sessionStorage.removeItem(DASHBOARD_AUTHORITATIVE_SOURCE_KEY);
    } catch (error) {
      // Ignore storage cleanup failures.
    }
    return;
  }
  trySetStorage(
    sessionStorage,
    DASHBOARD_AUTHORITATIVE_SOURCE_KEY,
    JSON.stringify({
      source_type: "fresh_analysis",
      run_id: runId,
      source_name: getSourceNameFromPayload(currentPayload),
      created_at_ms: getPayloadCreatedAtMs(currentPayload),
      set_at_ms: Date.now(),
    }),
  );
}

async function analyzeUploadFile(file, baselineRunId = null) {
  if (isZipFile(file)) {
    const formData = new FormData();
    formData.append("file", file);
    if (baselineRunId) {
      formData.append("baseline_run_id", baselineRunId);
    }
    return fetchJson(`${API_BASE}/analyze-zip`, {
      method: "POST",
      body: formData,
    });
  }

  if (!isHtmlFile(file)) {
    throw new Error("Only HTML or ZIP files are supported.");
  }

  const html = await file.text();
  return analyzeHtmlText(html, file.name);
}

function saveDashboardSession(payload) {
  let previousSession = null;
  try {
    previousSession = loadDashboardSession();
  } catch (_) {
    previousSession = null;
  }
  const incoming = payload?.current?.payload || payload?.payload || null;
  const prevPayload = previousSession?.current?.payload || null;
  const prevRun = String(prevPayload?.run?.run_id || prevPayload?.run_id || "");
  const incomingRun = String(incoming?.run?.run_id || incoming?.run_id || "");
  const incomingDt = summarizeDtLocations(incoming);
  logLineageTimeline("session.write.begin", {
    owner: "lib/common.saveDashboardSession",
    incoming: summarizeRun(incoming),
    incoming_dt_locations: dtLocationsFromPayload(incoming),
    incoming_dt_location_ids: incomingDt.dt_location_ids,
    incoming_duplicate_selector_count: incomingDt.duplicate_selector_count,
    incoming_duplicate_text_count: incomingDt.duplicate_text_count,
    previous: summarizeRun(prevPayload),
    overwrite_detected: Boolean(prevRun && incomingRun && prevRun !== incomingRun),
    overwrite_reason: prevRun && incomingRun && prevRun !== incomingRun ? "incoming saveDashboardSession current.payload.run_id differs from stored current" : "",
  });
  const html = payload?.current?.html || payload?.html || "";
  const candidates = [
    trimDashboardSessionForStorage(payload, html.length <= MAX_STORED_HTML_CHARS),
    trimDashboardSessionForStorage(payload, false),
  ];

  for (const candidate of candidates) {
    const serialized = JSON.stringify(candidate);
    if (trySetStorage(sessionStorage, STORAGE_KEY, serialized)) {
      trySetStorage(localStorage, STORAGE_KEY, serialized);
      saveFreshAnalysisAuthority(payload);
      const after = loadDashboardSession();
      const afterPayload = after?.current?.payload || null;
      const afterRun = String(afterPayload?.run?.run_id || afterPayload?.run_id || "");
      const afterDt = summarizeDtLocations(afterPayload);
      logLineageTimeline("session.write.success", {
        owner: "lib/common.saveDashboardSession",
        stored: summarizeRun(afterPayload),
        stored_sourceType: after?.current?.sourceType || "",
        stored_sourceName: after?.current?.sourceName || "",
        stored_dt_location_ids: afterDt.dt_location_ids,
        stored_duplicate_selector_count: afterDt.duplicate_selector_count,
        stored_duplicate_text_count: afterDt.duplicate_text_count,
        overwrite_detected: Boolean(prevRun && afterRun && prevRun !== afterRun),
        overwrite_reason: prevRun && afterRun && prevRun !== afterRun ? "storage write replaced stored current run_id" : "",
      });
      return true;
    }
  }

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Ignore storage cleanup failures.
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Ignore storage cleanup failures.
  }
  return false;
}

function loadDashboardSession() {
  let raw = null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch (error) {
    raw = null;
  }
  if (!raw) {
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      raw = null;
    }
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    try {
      if (!sessionStorage.getItem(STORAGE_KEY)) {
        sessionStorage.setItem(STORAGE_KEY, raw);
      }
    } catch (storageError) {
      // The dashboard can continue without mirroring the session.
    }
    return parsed;
  } catch (error) {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (storageError) {
      // Ignore storage cleanup failures.
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (storageError) {
      // Ignore storage cleanup failures.
    }
    return null;
  }
}

function clearDashboardSession() {
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Ignore storage cleanup failures.
  }
}

function buildAnalysisView(payload) {
  return {
    dimensions: payload.dimensions || [],
  };
}

function findDimension(result, name) {
  return result?.dimensions?.find((dimension) => dimension.dimension === name);
}

export {
  API_BASE,
  STORAGE_KEY,
  analyzeHtmlText,
  analyzeVicramSource,
  analyzeUrl,
  analyzeVicramUrl,
  analyzeUploadFile,
  buildAnalysisView,
  chatWithAssistant,
  clearDashboardSession,
  escapeHtml,
  fetchJson,
  findDimension,
  formatDate,
  formatReportTimestamp,
  formatShortId,
  isHtmlFile,
  isZipFile,
  loadDashboardSession,
  saveDashboardSession,
};
