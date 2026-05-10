function buildIssueRenderContext({
  issue,
  dimensionName,
  issueNumber,
  issueId,
  selectedIssueId,
  selectedElementNumber,
  cogaSummary,
  isoSummary,
} = {}) {
  const safeIssue = issue || {};
  const safeDimensionName = String(dimensionName || "");
  const safeIssueId = String(issueId || "");
  const isSelected = safeIssueId && safeIssueId === String(selectedIssueId || "");
  const activeElementNumber = isSelected ? Number(selectedElementNumber || 0) : 0;
  return {
    context_type: "issue",
    issue: safeIssue,
    rule_id: String(safeIssue.rule_id || ""),
    dimensionName: safeDimensionName,
    issueNumber: Number(issueNumber || 0),
    issueId: safeIssueId,
    isSelected,
    selectedClass: isSelected ? " is-selected is-active" : "",
    activeElementNumber,
    cogaSummary: String(cogaSummary || ""),
    isoSummary: String(isoSummary || ""),
  };
}

export { buildIssueRenderContext };

