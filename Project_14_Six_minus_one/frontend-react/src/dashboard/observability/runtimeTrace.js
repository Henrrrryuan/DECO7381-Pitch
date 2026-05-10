import { appendRuntimeLineageStep } from "./eventLineage.js";
import { inheritDashboardTraceContext } from "./traceContext.js";

function attachTraceToAction(parentTrace, actionType, lineage) {
  const next = inheritDashboardTraceContext(parentTrace, { runtime_phase: "action", action_type: actionType });
  appendRuntimeLineageStep(lineage, { step: `action:${String(actionType || "")}` });
  return next;
}

function attachTraceToRender(parentTrace, phase, lineage) {
  const next = inheritDashboardTraceContext(parentTrace, { runtime_phase: phase || "render" });
  appendRuntimeLineageStep(lineage, { step: `render:${String(phase || "render")}` });
  return next;
}

function attachTraceToHighlight(parentTrace, phase, lineage) {
  const next = inheritDashboardTraceContext(parentTrace, { runtime_phase: phase || "highlight" });
  appendRuntimeLineageStep(lineage, { step: `highlight:${String(phase || "highlight")}` });
  return next;
}

function attachTraceToHydration(parentTrace, phase, lineage) {
  const next = inheritDashboardTraceContext(parentTrace, { runtime_phase: phase || "hydration" });
  appendRuntimeLineageStep(lineage, { step: `hydration:${String(phase || "hydration")}` });
  return next;
}

function attachTraceToIframeRuntime(parentTrace, phase, lineage) {
  const next = inheritDashboardTraceContext(parentTrace, { runtime_phase: phase || "iframe" });
  appendRuntimeLineageStep(lineage, { step: `iframe:${String(phase || "iframe")}` });
  return next;
}

export {
  attachTraceToAction,
  attachTraceToHydration,
  attachTraceToHighlight,
  attachTraceToIframeRuntime,
  attachTraceToRender,
};

