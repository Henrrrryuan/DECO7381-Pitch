import { logDashboardRenderRuntime } from "./dashboardLifecycleForensics.js";
import { buildRuntimeLineage } from "../observability/eventLineage.js";
import { captureDashboardRuntimeSnapshot } from "../observability/runtimeSnapshots.js";
import { emitLineageEvent, emitSnapshotEvent, emitTraceEvent } from "../observability/observabilityForensics.js";
import { createDashboardTraceContext } from "../observability/traceContext.js";
import { attachTraceToRender } from "../observability/runtimeTrace.js";

function renderDashboardRuntime({
  currentResult,
  currentHtml,
  previousResult,
  previousSourceName,
  ctx,
} = {}) {
  const baseTrace = createDashboardTraceContext({ runtime_phase: "render", action_type: "" });
  const lineage = buildRuntimeLineage(baseTrace);
  const trace = attachTraceToRender(baseTrace, "render.runtime", lineage);
  emitTraceEvent(trace, { kind: "render.begin" });
  emitSnapshotEvent(captureDashboardRuntimeSnapshot({ state: ctx.state, traceContext: trace, runtime_phase: "render" }), { kind: "render.before" });
  logDashboardRenderRuntime({ stage: "render.begin" });
  ctx.renderResult(currentResult, currentHtml);
  ctx.initHistoryContextPanel();
  ctx.renderComparison(currentResult, previousResult, previousSourceName || "");
  logDashboardRenderRuntime({ stage: "render.end" });
  emitSnapshotEvent(captureDashboardRuntimeSnapshot({ state: ctx.state, traceContext: trace, runtime_phase: "render" }), { kind: "render.after" });
  emitLineageEvent(lineage, { kind: "render.chain" });
}

export { renderDashboardRuntime };

