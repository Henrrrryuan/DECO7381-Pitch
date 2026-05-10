import { getDashboardActionHandler } from "./dashboardActionRegistry.js";
import { logDashboardAction } from "./dashboardActionForensics.js";
import { buildRuntimeLineage } from "../observability/eventLineage.js";
import { captureDashboardRuntimeSnapshot } from "../observability/runtimeSnapshots.js";
import { emitLineageEvent, emitSnapshotEvent, emitTraceEvent } from "../observability/observabilityForensics.js";
import { createDashboardTraceContext } from "../observability/traceContext.js";
import { attachTraceToAction } from "../observability/runtimeTrace.js";

let _ctx = null;
let _activeTrace = null;
let _activeLineage = null;

function configureDashboardActionDispatcher(ctx) {
  _ctx = ctx || null;
  if (!_activeTrace) {
    _activeTrace = createDashboardTraceContext({ runtime_phase: "dispatcher" });
    _activeLineage = buildRuntimeLineage(_activeTrace);
    emitTraceEvent(_activeTrace, { kind: "dispatcher.configure" });
  }
}

function validateActionShape(action) {
  if (!action || typeof action !== "object") {
    return { ok: false, reason: "action is not an object" };
  }
  if (!action.type || typeof action.type !== "string") {
    return { ok: false, reason: "action.type missing or not a string" };
  }
  return { ok: true, reason: "" };
}

function dispatchDashboardAction(action) {
  const validation = validateActionShape(action);
  if (!validation.ok) {
    console.warn("[Dashboard action] invalid action:", validation.reason, action);
    return;
  }

  const handler = getDashboardActionHandler(action.type);
  if (!handler) {
    console.warn("[Dashboard action] no handler for action:", action.type);
    return;
  }
  if (!_ctx) {
    console.warn("[Dashboard action] dispatcher not configured for:", action.type);
    return;
  }

  // Observability only: do not mutate action payload/shape.
  const parentTrace = _activeTrace || createDashboardTraceContext({ runtime_phase: "dispatcher" });
  const lineage = _activeLineage || buildRuntimeLineage(parentTrace);
  const trace = attachTraceToAction(parentTrace, action.type, lineage);
  _activeTrace = trace;
  _activeLineage = lineage;
  emitTraceEvent(trace, { kind: "action.dispatch", detail: action.type });

  logDashboardAction({
    type: action.type,
    payload: action.payload,
    affected_systems: action.affected_systems || [],
  });

  handler({ type: action.type, payload: action.payload, ctx: _ctx });

  // Snapshot after handler (still synchronous): summaries only.
  const snapshot = captureDashboardRuntimeSnapshot({ state: _ctx.state, traceContext: trace, runtime_phase: "action" });
  emitSnapshotEvent(snapshot, { kind: "action.after", detail: action.type });
  emitLineageEvent(lineage, { kind: "action.chain", detail: action.type });
}

function getActiveDashboardTraceContext() {
  return _activeTrace;
}

function getActiveDashboardLineage() {
  return _activeLineage;
}

export {
  configureDashboardActionDispatcher,
  dispatchDashboardAction,
  getActiveDashboardLineage,
  getActiveDashboardTraceContext,
};

