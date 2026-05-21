import { logDashboardStateTransition } from "./dashboardStateForensics.js";

function transition(state, name, fn) {
  const prev = state;
  fn();
  logDashboardStateTransition(name, prev, state);
}

function setActivePatientProfile(state, profileName) {
  transition(state, "setActivePatientProfile", () => {
    state.activeProfile = profileName;
  });
}

function setPreviousComparison(state, previousResult, previousSourceName) {
  transition(state, "setPreviousComparison", () => {
    state.previousResult = previousResult || null;
    state.previousSourceName = previousSourceName || "";
  });
}

function setRightPanelMode(state, mode) {
  transition(state, "setRightPanelMode", () => {
    state.rightPanelMode = mode;
  });
}

function setSelectedIssueId(state, issueId) {
  transition(state, "setSelectedIssueId", () => {
    state.selectedIssueId = issueId;
  });
}

function setSelectedElementNumber(state, elementNumber) {
  transition(state, "setSelectedElementNumber", () => {
    state.selectedElementNumber = elementNumber;
  });
}

function setActiveGuidancePopoverKey(state, key) {
  transition(state, "setActiveGuidancePopoverKey", () => {
    state.activeGuidancePopoverKey = key;
  });
}

function setActiveHighlightDimension(state, dimensionName) {
  transition(state, "setActiveHighlightDimension", () => {
    state.activeHighlightDimension = dimensionName;
  });
}

function setActiveHighlightIssueId(state, issueId) {
  transition(state, "setActiveHighlightIssueId", () => {
    state.activeHighlightIssueId = issueId;
  });
}

function setWorkspaceMode(state, mode) {
  transition(state, "setWorkspaceMode", () => {
    state.workspaceMode = mode;
  });
}

function setCurrentResultAndHtml(state, result, html) {
  transition(state, "setCurrentResultAndHtml", () => {
    state.currentResult = result;
    state.currentHtml = html || "";
    state.expandedIssueElementKeys = {};
    state.issueElementDisclosureOpenKeys = {};
  });
}

function setCurrentPayloadAndSource(state, payload, sourceName, sourceUrl) {
  transition(state, "setCurrentPayloadAndSource", () => {
    state.currentPayload = payload;
    state.sourceName = sourceName || "";
    state.sourceUrl = sourceUrl || "";
  });
}

function setSidebarCollapsed(state, collapsed) {
  transition(state, "setSidebarCollapsed", () => {
    state.sidebarCollapsed = Boolean(collapsed);
  });
}

function toggleSidebarCollapsed(state) {
  transition(state, "toggleSidebarCollapsed", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
  });
}

function resetSelectionToSummary(state) {
  transition(state, "resetSelectionToSummary", () => {
    state.selectedIssueId = "";
    state.activeHighlightDimension = "";
    state.activeHighlightIssueId = "";
    state.selectedElementNumber = 0;
    state.activeGuidancePopoverKey = "";
    state.rightPanelMode = "summary";
  });
}

function clearActiveHighlight(state) {
  transition(state, "clearActiveHighlight", () => {
    state.activeHighlightIssueId = "";
    state.activeHighlightDimension = "";
  });
}

export {
  clearActiveHighlight,
  resetSelectionToSummary,
  setActiveGuidancePopoverKey,
  setActiveHighlightDimension,
  setActiveHighlightIssueId,
  setActivePatientProfile,
  setCurrentPayloadAndSource,
  setCurrentResultAndHtml,
  setPreviousComparison,
  setRightPanelMode,
  setSelectedElementNumber,
  setSelectedIssueId,
  setSidebarCollapsed,
  setWorkspaceMode,
  toggleSidebarCollapsed,
};
