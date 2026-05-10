const STORAGE_KEY = "cognilens-dashboard-session";
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
  const html = payload?.current?.html || payload?.html || "";
  const candidates = [
    trimDashboardSessionForStorage(payload, html.length <= MAX_STORED_HTML_CHARS),
    trimDashboardSessionForStorage(payload, false),
  ];

  for (const candidate of candidates) {
    const serialized = JSON.stringify(candidate);
    if (trySetStorage(sessionStorage, STORAGE_KEY, serialized)) {
      trySetStorage(localStorage, STORAGE_KEY, serialized);
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
    overall_score: payload.overall_score,
    weighted_average: payload.weighted_average,
    min_dimension_score: payload.min_dimension_score,
    dimensions: payload.dimensions || [],
    profile_scores: payload.profile_scores || [],
  };
}

function findDimension(result, name) {
  return result?.dimensions?.find((dimension) => dimension.dimension === name);
}

export {
  API_BASE,
  STORAGE_KEY,
  analyzeHtmlText,
  analyzeUrl,
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
