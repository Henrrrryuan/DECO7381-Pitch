import { summarizeDashboardTraceContext } from "./traceContext.js";

function captureDashboardRuntimeSnapshot({ state, traceContext, runtime_phase = "" } = {}) {
  const runId = String(state?.currentPayload?.run?.run_id || state?.currentPayload?.run_id || "");
  return {
    run_id: runId,
    selected_issue_id: String(state?.selectedIssueId || ""),
    selected_element_number: Number(state?.selectedElementNumber || 0),
    runtime_phase: String(runtime_phase || traceContext?.runtime_phase || ""),
    trace: summarizeDashboardTraceContext(traceContext),
  };
}

function summarizeDashboardRuntimeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return { run_id: "", selected_issue_id: "", selected_element_number: 0, runtime_phase: "", trace_id: "" };
  }
  return {
    run_id: String(snapshot.run_id || ""),
    selected_issue_id: String(snapshot.selected_issue_id || ""),
    selected_element_number: Number(snapshot.selected_element_number || 0),
    runtime_phase: String(snapshot.runtime_phase || ""),
    trace_id: String(snapshot.trace?.trace_id || ""),
  };
}

export { captureDashboardRuntimeSnapshot, summarizeDashboardRuntimeSnapshot };

