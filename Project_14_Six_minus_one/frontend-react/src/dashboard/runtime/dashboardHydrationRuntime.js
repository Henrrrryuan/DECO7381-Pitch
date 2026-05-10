import { logDashboardHydration } from "./dashboardLifecycleForensics.js";
import { buildRuntimeLineage } from "../observability/eventLineage.js";
import { captureDashboardRuntimeSnapshot } from "../observability/runtimeSnapshots.js";
import { emitLineageEvent, emitSnapshotEvent, emitTraceEvent } from "../observability/observabilityForensics.js";
import { createDashboardTraceContext } from "../observability/traceContext.js";
import { attachTraceToHydration } from "../observability/runtimeTrace.js";

async function loadDashboardSessionWithHistoryFallbackRuntime(ctx) {
  const baseTrace = createDashboardTraceContext({ runtime_phase: "hydration", action_type: "" });
  const lineage = buildRuntimeLineage(baseTrace);
  const trace = attachTraceToHydration(baseTrace, "hydration.session_load", lineage);
  emitTraceEvent(trace, { kind: "hydration.begin" });
  emitSnapshotEvent(captureDashboardRuntimeSnapshot({ state: ctx.state, traceContext: trace, runtime_phase: "hydration" }), { kind: "hydration.before" });
  logDashboardHydration({ stage: "session.load.begin" });
  const session = await ctx.loadDashboardSessionWithHistoryFallback();
  logDashboardHydration({
    stage: "session.load.end",
    has_current_payload: Boolean(session?.current?.payload),
    has_previous_payload: Boolean(session?.previous?.payload),
  });
  emitSnapshotEvent(captureDashboardRuntimeSnapshot({ state: ctx.state, traceContext: trace, runtime_phase: "hydration" }), { kind: "hydration.after" });
  emitLineageEvent(lineage, { kind: "hydration.chain" });
  return session;
}

export { loadDashboardSessionWithHistoryFallbackRuntime };

