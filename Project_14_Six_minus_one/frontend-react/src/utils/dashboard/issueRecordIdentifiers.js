import { displayDimensionName } from "./dashboardLabels.js";

// Stable Issue ID builder.
//
// The Dashboard keeps the selected card, guidance panel, and preview highlight
// connected through this identifier.
export function buildIssueIdentifier(dimensionName, ruleIdentifier, issueIndex = 0) {
  return `${displayDimensionName(dimensionName)}::${ruleIdentifier || `issue-${issueIndex + 1}`}`;
}
