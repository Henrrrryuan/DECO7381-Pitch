const STORAGE_KEY = "cognilens-dashboard-session";
const API_BASE = "http://127.0.0.1:8001";

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
  const response = await fetch(url, options);
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

async function analyzeHtmlText(html, sourceName = "uploaded.html") {
  return fetchJson(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      source_name: sourceName,
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
  };
}

function findDimension(result, name) {
  return result?.dimensions?.find((dimension) => dimension.dimension === name);
}

export {
  API_BASE,
  STORAGE_KEY,
  analyzeHtmlText,
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
