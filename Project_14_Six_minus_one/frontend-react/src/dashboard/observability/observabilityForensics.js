import { emitDashboardForensicEvent, forensicBusEnabled } from "./forensicBus.js";
import { summarizeRuntimeLineage } from "./eventLineage.js";
import { summarizeDashboardTraceContext } from "./traceContext.js";
import { summarizeDashboardRuntimeSnapshot } from "./runtimeSnapshots.js";

function observabilityForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_OBSERVABILITY_FORENSIC === "1");
}

function logDashboardTrace(event) {
  if (!observabilityForensicEnabled()) {
    return;
  }
  console.log("[Dashboard trace]", event);
}

function logDashboardLineage(event) {
  if (!observabilityForensicEnabled()) {
    return;
  }
  console.log("[Dashboard lineage]", event);
}

function logDashboardSnapshot(event) {
  if (!observabilityForensicEnabled()) {
    return;
  }
  console.log("[Dashboard snapshot]", event);
}

function emitTraceEvent(traceContext, { kind = "", detail = "" } = {}) {
  const payload = {
    kind: String(kind || "trace"),
    trace: summarizeDashboardTraceContext(traceContext),
    detail: String(detail || ""),
  };
  if (forensicBusEnabled()) {
    emitDashboardForensicEvent({ type: "trace", payload });
  }
  logDashboardTrace(payload);
}

function emitLineageEvent(lineage, { kind = "", detail = "" } = {}) {
  const payload = {
    kind: String(kind || "lineage"),
    lineage: summarizeRuntimeLineage(lineage),
    detail: String(detail || ""),
  };
  if (forensicBusEnabled()) {
    emitDashboardForensicEvent({ type: "lineage", payload });
  }
  logDashboardLineage(payload);
}

function emitSnapshotEvent(snapshot, { kind = "", detail = "" } = {}) {
  const payload = {
    kind: String(kind || "snapshot"),
    snapshot: summarizeDashboardRuntimeSnapshot(snapshot),
    detail: String(detail || ""),
  };
  if (forensicBusEnabled()) {
    emitDashboardForensicEvent({ type: "snapshot", payload });
  }
  logDashboardSnapshot(payload);
}

export {
  emitLineageEvent,
  emitSnapshotEvent,
  emitTraceEvent,
  observabilityForensicEnabled,
};

