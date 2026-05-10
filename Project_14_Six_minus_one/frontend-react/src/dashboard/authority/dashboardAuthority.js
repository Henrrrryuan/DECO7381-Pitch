const DASHBOARD_AUTHORITATIVE_SOURCE_KEY = "cognilens.dashboard.authoritative-source";

const DASHBOARD_SOURCE_TYPES = {
  fresh_analysis: "fresh_analysis",
  history: "history",
  storage: "storage",
};

function sourceTypePriority(sourceType) {
  if (sourceType === DASHBOARD_SOURCE_TYPES.history) {
    return 3;
  }
  if (sourceType === DASHBOARD_SOURCE_TYPES.fresh_analysis) {
    return 2;
  }
  if (sourceType === DASHBOARD_SOURCE_TYPES.storage) {
    return 1;
  }
  return 0;
}

function payloadRunCreatedAt(payload) {
  const run = payload?.run || null;
  const raw = run?.created_at || run?.createdAt || payload?.created_at || payload?.createdAt || "";
  const parsed = raw ? Date.parse(String(raw)) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function readDashboardAuthoritativeSourceFromStorage() {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_AUTHORITATIVE_SOURCE_KEY) || "";
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function writeDashboardAuthoritativeSourceToStorage(source) {
  try {
    sessionStorage.setItem(DASHBOARD_AUTHORITATIVE_SOURCE_KEY, JSON.stringify(source));
  } catch (_) {
    // ignore
  }
}

function getRunIdFromPayload(payload) {
  const run = payload?.run || null;
  return String(run?.run_id || run?.id || payload?.run_id || "");
}

function getSourceNameFromPayload(payload) {
  return String(payload?.run?.source_name || payload?.source_name || "");
}

function setDashboardAuthoritativeSource(state, sourceType, payload) {
  const createdAtMs = payloadRunCreatedAt(payload);
  state.dashboardSource = {
    source_type: sourceType,
    run_id: getRunIdFromPayload(payload),
    source_name: getSourceNameFromPayload(payload),
    created_at_ms: createdAtMs,
    set_at_ms: Date.now(),
  };
  // Keep previous behavior: always log on set.
  console.log("[Dashboard authoritative source]", state.dashboardSource);
  writeDashboardAuthoritativeSourceToStorage(state.dashboardSource);
}

function isIncomingRunNewer(currentPayload, incomingPayload, currentSourceType = "", incomingSourceType = "") {
  const incomingCreated = payloadRunCreatedAt(incomingPayload);
  const currentCreated = payloadRunCreatedAt(currentPayload);
  if (incomingCreated !== null && currentCreated !== null && incomingCreated !== currentCreated) {
    return incomingCreated > currentCreated;
  }
  if (incomingCreated !== null && currentCreated === null) {
    return true;
  }
  if (incomingCreated === null && currentCreated !== null) {
    return false;
  }
  const incomingRunId = getRunIdFromPayload(incomingPayload);
  const currentRunId = getRunIdFromPayload(currentPayload);
  if (incomingRunId && !currentRunId) {
    return true;
  }
  if (!incomingRunId && currentRunId) {
    return false;
  }
  return sourceTypePriority(incomingSourceType) >= sourceTypePriority(currentSourceType);
}

export {
  DASHBOARD_AUTHORITATIVE_SOURCE_KEY,
  DASHBOARD_SOURCE_TYPES,
  getRunIdFromPayload,
  getSourceNameFromPayload,
  isIncomingRunNewer,
  payloadRunCreatedAt,
  readDashboardAuthoritativeSourceFromStorage,
  setDashboardAuthoritativeSource,
  sourceTypePriority,
  writeDashboardAuthoritativeSourceToStorage,
};

// Compatibility shim: some legacy runtime paths may reference this as a global.
// This does not change dashboard behavior; it only prevents ReferenceError crashes.
try {
  if (typeof globalThis !== "undefined" && !globalThis.getRunIdFromPayload) {
    globalThis.getRunIdFromPayload = getRunIdFromPayload;
  }
} catch (_) {
  // ignore
}

