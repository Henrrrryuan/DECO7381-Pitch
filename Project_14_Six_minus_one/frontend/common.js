const STORAGE_KEY = "cognilens-dashboard-session";
const isHttpPage = window.location.protocol === "http:" || window.location.protocol === "https:";
const host = window.location.hostname || "127.0.0.1";
const API_BASE = isHttpPage
  ? `${window.location.protocol}//${host}:8001`
  : "http://127.0.0.1:8001";
const FALLBACK_API_BASE = "http://127.0.0.1:8001";

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

async function analyzeVisualComplexityHtml(html) {
  return fetchJson(`${API_BASE}/visual-complexity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
  });
}

async function analyzeVisualComplexityUrl(url) {
  return fetchJson(`${API_BASE}/visual-complexity-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
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
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadDashboardSession() {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function clearDashboardSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function buildAnalysisView(payload) {
  return {
    overall_score: payload.overall_score,
    weighted_average: payload.weighted_average,
    min_dimension_score: payload.min_dimension_score,
    dimensions: payload.dimensions || [],
    profile_scores: payload.profile_scores || [],
    visual_complexity: payload.visual_complexity || null,
  };
}

function findDimension(result, name) {
  const aliases = {
    "Information Overload": ["Information Overload", "Visual Complexity"],
    "Visual Complexity": ["Visual Complexity", "Information Overload"],
  };
  const validNames = aliases[name] || [name];
  return result?.dimensions?.find((dimension) => validNames.includes(dimension.dimension));
}

export {
  API_BASE,
  STORAGE_KEY,
  analyzeHtmlText,
  analyzeUrl,
  analyzeVisualComplexityHtml,
  analyzeVisualComplexityUrl,
  analyzeUploadFile,
  buildAnalysisView,
  chatWithAssistant,
  clearDashboardSession,
  escapeHtml,
  fetchJson,
  findDimension,
  formatDate,
  isHtmlFile,
  isZipFile,
  loadDashboardSession,
  saveDashboardSession,
};
