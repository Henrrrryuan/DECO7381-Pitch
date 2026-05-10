import { logLineageTimeline } from "../observability/lineageTimeline.js";

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

function arbitrationForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_RUNTIME_FORENSIC === "1");
}

function shouldRejectIncomingAuthoritative(existing, incoming) {
  if (!existing || !incoming) {
    return { reject: false, reason: "" };
  }
  const existingRun = String(existing.run_id || "");
  const incomingRun = String(incoming.run_id || "");
  if (!existingRun || !incomingRun || existingRun === incomingRun) {
    return { reject: false, reason: "" };
  }

  const existingPriority = sourceTypePriority(existing.source_type);
  const incomingPriority = sourceTypePriority(incoming.source_type);
  const existingCreated = typeof existing.created_at_ms === "number" ? existing.created_at_ms : null;
  const incomingCreated = typeof incoming.created_at_ms === "number" ? incoming.created_at_ms : null;

  // Hardening: never allow a lower-priority storage marker to defeat an existing fresh_analysis marker.
  if (existing.source_type === DASHBOARD_SOURCE_TYPES.fresh_analysis && incoming.source_type === DASHBOARD_SOURCE_TYPES.storage) {
    return { reject: true, reason: "stale_storage_rejected" };
  }

  // Prefer newer run created_at when both present.
  if (existingCreated !== null && incomingCreated !== null && existingCreated !== incomingCreated) {
    if (incomingCreated < existingCreated) {
      return { reject: true, reason: "stale_storage_rejected" };
    }
    return { reject: false, reason: "" };
  }

  // Fall back to source priority.
  if (incomingPriority < existingPriority) {
    return { reject: true, reason: "stale_storage_rejected" };
  }
  return { reject: false, reason: "" };
}

function setDashboardAuthoritativeSource(state, sourceType, payload) {
  const createdAtMs = payloadRunCreatedAt(payload);
  let previous = null;
  try {
    previous = state?.dashboardSource ? { ...state.dashboardSource } : null;
  } catch (_) {
    previous = null;
  }

  const incoming = {
    source_type: sourceType,
    run_id: getRunIdFromPayload(payload),
    source_name: getSourceNameFromPayload(payload),
    created_at_ms: createdAtMs,
    set_at_ms: Date.now(),
  };

  const existingStored = readDashboardAuthoritativeSourceFromStorage();
  const rejection = shouldRejectIncomingAuthoritative(existingStored, incoming);
  if (rejection.reject) {
    if (arbitrationForensicEnabled()) {
      console.log("[Dashboard arbitration result]", {
        winning_run_id: String(existingStored?.run_id || ""),
        winning_source: String(existingStored?.source_type || ""),
        rejected_candidates: [
          {
            source_type: incoming.source_type,
            run_id: incoming.run_id,
            source_name: incoming.source_name,
            created_at_ms: incoming.created_at_ms,
            storage_origin: "runtime.setDashboardAuthoritativeSource",
            accepted: false,
            reason: rejection.reason,
          },
        ],
        arbitration_reason: rejection.reason,
      });
    }
    logLineageTimeline("authoritative.set", {
      owner: "dashboard/authority.setDashboardAuthoritativeSource",
      source_type: sourceType,
      previous_run_id: String(existingStored?.run_id || ""),
      next_run_id: String(existingStored?.run_id || ""),
      overwrite_detected: true,
      overwrite_reason: rejection.reason,
    });
    // Keep state.dashboardSource unchanged to preserve winner.
    return { accepted: false, reason: rejection.reason, winner: existingStored };
  }

  state.dashboardSource = incoming;
  // Keep previous behavior: always log on set.
  console.log("[Dashboard authoritative source]", state.dashboardSource);
  writeDashboardAuthoritativeSourceToStorage(state.dashboardSource);
  const prevRun = String(previous?.run_id || "");
  const nextRun = String(state.dashboardSource?.run_id || "");
  logLineageTimeline("authoritative.set", {
    owner: "dashboard/authority.setDashboardAuthoritativeSource",
    source_type: sourceType,
    previous_run_id: prevRun,
    next_run_id: nextRun,
    overwrite_detected: Boolean(prevRun && nextRun && prevRun !== nextRun),
    overwrite_reason: prevRun && nextRun && prevRun !== nextRun ? `authoritative source replacement (${previous?.source_type || ""} → ${sourceType})` : "",
  });
  if (arbitrationForensicEnabled()) {
    console.log("[Dashboard arbitration result]", {
      winning_run_id: nextRun,
      winning_source: state.dashboardSource?.source_type || "",
      rejected_candidates: [],
      arbitration_reason: nextRun ? "fresh_analysis_promoted" : "",
    });
  }
  return { accepted: true, reason: "", winner: state.dashboardSource };
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

