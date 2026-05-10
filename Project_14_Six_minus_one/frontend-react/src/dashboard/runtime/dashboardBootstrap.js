import { logDashboardBootstrap } from "./dashboardLifecycleForensics.js";
import { loadDashboardSessionWithHistoryFallbackRuntime } from "./dashboardHydrationRuntime.js";
import { ensureHistoryContextRuntime } from "./dashboardHistoryRuntime.js";
import { renderDashboardRuntime } from "./dashboardRenderRuntime.js";
import { buildRuntimeLineage } from "../observability/eventLineage.js";
import { captureDashboardRuntimeSnapshot } from "../observability/runtimeSnapshots.js";
import { emitLineageEvent, emitSnapshotEvent, emitTraceEvent } from "../observability/observabilityForensics.js";
import { createDashboardTraceContext } from "../observability/traceContext.js";
import { dtLocationsFromPayload, logLineageTimeline, summarizeRun } from "../observability/lineageTimeline.js";
import { logDtLineage } from "../observability/dtLocationLineage.js";

function arbitrationForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_RUNTIME_FORENSIC === "1");
}

function inferFreshnessFromSession({ currentSession, authoritative, isHistoryView }) {
  if (isHistoryView) {
    return { inferredSourceType: "history", reason: "" };
  }
  const src = String(currentSession?.sourceType || "");
  if (src) {
    return { inferredSourceType: src, reason: "" };
  }
  const runId = String(currentSession?.payload?.run?.run_id || currentSession?.payload?.run_id || "");
  if (authoritative?.source_type === "fresh_analysis" && String(authoritative.run_id || "") === runId) {
    return { inferredSourceType: "inferred_fresh_analysis", reason: "missing_sourceType_inferred" };
  }
  return { inferredSourceType: "", reason: "" };
}

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
  logLineageTimeline("dashboard.init.begin", {
    owner: "dashboard/runtime.initializeDashboardRuntime",
    current: summarizeRun(ctx.state.currentPayload || null),
    current_dt_locations: dtLocationsFromPayload(ctx.state.currentPayload || null),
  });

  const session = await loadDashboardSessionWithHistoryFallbackRuntime(ctx);
  if (lifecycleSnapshot !== ctx.getDashboardLifecycleSnapshot()) {
    logDashboardBootstrap({ stage: "aborted.lifecycle_changed" });
    return;
  }
  logLineageTimeline("hydration.complete", {
    owner: "dashboard/runtime.initializeDashboardRuntime",
    hydrated: summarizeRun(session?.current?.payload || null),
    hydrated_dt_locations: dtLocationsFromPayload(session?.current?.payload || null),
  });

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
  logLineageTimeline("authoritative.selection", {
    owner: "dashboard/runtime.initializeDashboardRuntime",
    selected: summarizeRun(ctx.state.currentPayload || null),
    selected_dt_locations: dtLocationsFromPayload(ctx.state.currentPayload || null),
    selected_sourceName: ctx.state.sourceName || "",
  });
  logDtLineage("dashboard.authoritative.selection", ctx.state.currentPayload || null, {
    owner: "dashboard/runtime.initializeDashboardRuntime",
    sourceName: ctx.state.sourceName || "",
  });

  const authoritativeStored = ctx.readDashboardAuthoritativeSourceFromStorage?.() || null;
  const inferred = inferFreshnessFromSession({
    currentSession,
    authoritative: authoritativeStored,
    isHistoryView: ctx.isHistoryReportView(),
  });
  const explicitSourceType = String(currentSession.sourceType || "");
  const isFreshSignal = ["url", "html", "zip"].includes(String(explicitSourceType)) || inferred.inferredSourceType === "inferred_fresh_analysis";
  const sourceType = ctx.isHistoryReportView()
    ? ctx.DASHBOARD_SOURCE_TYPES.history
    : (isFreshSignal ? ctx.DASHBOARD_SOURCE_TYPES.fresh_analysis : ctx.DASHBOARD_SOURCE_TYPES.storage);

  if (arbitrationForensicEnabled() && inferred.reason) {
    console.log("[Dashboard arbitration result]", {
      winning_run_id: String(ctx.state.currentPayload?.run?.run_id || ctx.state.currentPayload?.run_id || ""),
      winning_source: sourceType,
      rejected_candidates: [],
      arbitration_reason: inferred.reason,
    });
  }
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
  logLineageTimeline("render.before", {
    owner: "dashboard/runtime.initializeDashboardRuntime",
    render: summarizeRun(ctx.state.currentPayload || null),
    render_dt_locations: dtLocationsFromPayload(ctx.state.currentPayload || null),
    source_type: ctx.state.dashboardSource?.source_type || "",
  });
  logDtLineage("dashboard.render.input", ctx.state.currentPayload || null, {
    owner: "dashboard/runtime.initializeDashboardRuntime",
    source_type: ctx.state.dashboardSource?.source_type || "",
  });

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

