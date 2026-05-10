import { logDashboardBootstrap } from "./dashboardLifecycleForensics.js";
import { loadDashboardSessionWithHistoryFallbackRuntime } from "./dashboardHydrationRuntime.js";
import { ensureHistoryContextRuntime } from "./dashboardHistoryRuntime.js";
import { renderDashboardRuntime } from "./dashboardRenderRuntime.js";
import { buildRuntimeLineage } from "../observability/eventLineage.js";
import { captureDashboardRuntimeSnapshot } from "../observability/runtimeSnapshots.js";
import { emitLineageEvent, emitSnapshotEvent, emitTraceEvent } from "../observability/observabilityForensics.js";
import { createDashboardTraceContext } from "../observability/traceContext.js";

async function initializeDashboardRuntime(ctx, lifecycleSnapshot) {
  const trace = createDashboardTraceContext({ runtime_phase: "bootstrap" });
  const lineage = buildRuntimeLineage(trace);
  emitTraceEvent(trace, { kind: "bootstrap.begin" });
  emitSnapshotEvent(captureDashboardRuntimeSnapshot({ state: ctx.state, traceContext: trace, runtime_phase: "bootstrap" }), { kind: "bootstrap.before" });
  logDashboardBootstrap({ stage: "initSidebar.begin" });
  ctx.initSidebar();
  logDashboardBootstrap({ stage: "bindEvents.begin" });
  ctx.bindEvents();

  ctx.dashboardLifecycleLog("init.start", null, ctx.state.currentPayload, "", ctx.state.dashboardSource?.source_type || "", true, "init");
  ctx.dtFrontendStateLog("init.start", null, null, "");

  const session = await loadDashboardSessionWithHistoryFallbackRuntime(ctx);
  if (lifecycleSnapshot !== ctx.getDashboardLifecycleSnapshot()) {
    logDashboardBootstrap({ stage: "aborted.lifecycle_changed" });
    return;
  }

  const currentSession = session?.current;
  const previousSession = session?.previous;
  if (!currentSession?.payload) {
    ctx.renderMissingAnalysisState();
    return;
  }

  const currentResult = ctx.buildAnalysisView(currentSession.payload);
  const previousResult = previousSession?.payload ? ctx.buildAnalysisView(previousSession.payload) : null;
  const sourceNode = document.getElementById("dashboardSourceName");

  ensureHistoryContextRuntime(ctx);

  const nextSourceName = currentSession.sourceName || currentSession.payload?.run?.source_name || "Uploaded file";
  const nextSourceUrl = currentSession.sourceUrl || (ctx.isProbablyUrl(nextSourceName) ? nextSourceName : "");
  ctx.setCurrentPayloadAndSource(ctx.state, currentSession.payload, nextSourceName, nextSourceUrl);

  const sourceType = ctx.isHistoryReportView()
    ? ctx.DASHBOARD_SOURCE_TYPES.history
    : ((currentSession.sourceType && ["url", "html", "zip"].includes(String(currentSession.sourceType)))
      ? ctx.DASHBOARD_SOURCE_TYPES.fresh_analysis
      : ctx.DASHBOARD_SOURCE_TYPES.storage);
  ctx.setDashboardAuthoritativeSource(ctx.state, sourceType, ctx.state.currentPayload);

  ctx.dtFrontendStateLog("init.session_loaded", ctx.state.currentPayload, currentResult, ctx.state.sourceName);
  if (sourceNode) {
    sourceNode.textContent = ctx.state.sourceName;
  }

  ctx.syncEyeTrackingNavAndStorage();

  ctx.dashboardLifecycleLog(
    "render.begin",
    ctx.state.currentPayload,
    ctx.state.currentPayload,
    ctx.state.dashboardSource?.source_type || "",
    ctx.state.dashboardSource?.source_type || "",
    true,
    "rendering authoritative payload",
  );

  renderDashboardRuntime({
    currentResult,
    currentHtml: currentSession.html || currentSession.payload.html_content || "",
    previousResult,
    previousSourceName: previousSession?.sourceName || "",
    ctx,
  });

  ctx.setWorkspaceMode("website");
  ctx.loadPreviewOnSessionStart();

  if (sessionStorage.getItem(ctx.AUTO_PRINT_STORAGE_KEY) === "true") {
    sessionStorage.removeItem(ctx.AUTO_PRINT_STORAGE_KEY);
    window.setTimeout(() => {
      ctx.printDashboardReport();
    }, 150);
  }
  emitSnapshotEvent(captureDashboardRuntimeSnapshot({ state: ctx.state, traceContext: trace, runtime_phase: "bootstrap" }), { kind: "bootstrap.after" });
  emitLineageEvent(lineage, { kind: "bootstrap.chain" });
}

export { initializeDashboardRuntime };

