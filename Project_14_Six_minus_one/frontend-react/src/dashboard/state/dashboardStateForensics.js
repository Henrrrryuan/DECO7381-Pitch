function stateForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_STATE_FORENSIC === "1");
}

function summarizeState(state) {
  const runId = String(state?.currentPayload?.run?.run_id || state?.currentPayload?.run_id || "");
  const sourceName = String(state?.sourceName || state?.currentPayload?.run?.source_name || "");
  const dtIssues = state?.currentResult?.dimensions?.find((d) => d.dimension === "Dense Text Detection")?.issues || [];
  const dtLocs = dtIssues?.[0]?.locations?.length || 0;
  return {
    run_id: runId,
    source_name: sourceName,
    dashboard_source_type: state?.dashboardSource?.source_type || "",
    workspaceMode: state?.workspaceMode || "",
    rightPanelMode: state?.rightPanelMode || "",
    selectedIssueId: state?.selectedIssueId || "",
    selectedElementNumber: Number(state?.selectedElementNumber || 0),
    activeHighlightDimension: state?.activeHighlightDimension || "",
    activeHighlightIssueId: state?.activeHighlightIssueId || "",
    chatPending: Boolean(state?.chatPending),
    sidebarCollapsed: Boolean(state?.sidebarCollapsed),
    assistantFloatingOpen: Boolean(state?.assistantFloatingOpen),
    activeProfile: state?.activeProfile || "",
    dt_locations: Number(dtLocs || 0),
  };
}

function logDashboardStateTransition(transition, prevState, nextState) {
  if (!stateForensicEnabled()) {
    return;
  }
  console.log("[Dashboard state transition]", {
    transition,
    previous_state_summary: summarizeState(prevState),
    next_state_summary: summarizeState(nextState),
  });
}

export { logDashboardStateTransition, stateForensicEnabled, summarizeState };

