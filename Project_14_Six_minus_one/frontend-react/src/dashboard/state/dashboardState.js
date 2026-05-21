function createDashboardState() {
  return {
    currentHtml: "",
    currentResult: null,
    currentPayload: null,
    sourceName: "",
    sourceUrl: "",
    dashboardSource: {
      source_type: "", // "fresh_analysis" | "history" | "storage"
      run_id: "",
      source_name: "",
    },
    workspaceMode: "explanation",
    rightPanelMode: "summary",
    activeHighlightDimension: "",
    activeHighlightIssueId: "",
    selectedIssueId: "",
    selectedElementNumber: 0,
    expandedIssueElementKeys: {},
    issueElementDisclosureOpenKeys: {},
    activeGuidancePopoverKey: "",
    sidebarCollapsed: false,
    previousResult: null,
    previousSourceName: "",
    activeProfile: "Alison",
  };
}

const dashboardState = createDashboardState();

export { createDashboardState, dashboardState };
