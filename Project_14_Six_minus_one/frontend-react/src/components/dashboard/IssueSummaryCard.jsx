import { conciseText } from "../../utils/dashboardUtils.js";

export function IssueSummaryCard({
  issueRecord,
  selectedIssueIdentifier,
  workspaceMode,
  onIssueGuidanceOpen,
  onIssuePreviewOpen,
}) {
  // Sidebar card for one triggered issue.
  //
  // DashboardSidebar.jsx renders these cards inside each dimension accordion.
  // The card does not change dashboard state directly; it calls the handlers
  // owned by DashboardPage.jsx so the workspace and preview stay synchronized.
  const { dimensionResult, issue, issueNumber, issueIdentifier } = issueRecord;
  const selectedIsActive = issueIdentifier === selectedIssueIdentifier;
  const previewIsActive = selectedIsActive && workspaceMode === "preview";
  const detailIsActive = selectedIsActive && workspaceMode === "detail";
  const selectedClassName = selectedIsActive ? " is-selected is-active" : "";
  const firstFixText = conciseText(
    issue.suggestion,
    "Review this issue and simplify the interaction.",
    135,
  );

  return (
    <article
      className={`issue-highlight-button issue-summary-card${selectedClassName}`}
      data-highlight-issue={issue.rule_id || ""}
      data-highlight-dimension={dimensionResult.dimension}
    >
      <div className="issue-summary-topline">
        <span className="issue-highlight-rule">{`Issue ${issueNumber}`}</span>
      </div>
      <strong className="issue-summary-title">{issue.title || "Review this issue"}</strong>
      <div className="issue-summary-row">
        <span className="issue-highlight-label">First fix</span>
        <span className="issue-highlight-copy">{firstFixText}</span>
      </div>
      <div className="issue-summary-actions">
        <button
          className={`view-on-page-button${previewIsActive ? " is-active" : ""}`}
          type="button"
          aria-label="Show highlighted location for this issue on the analysed page"
          aria-pressed={previewIsActive}
          onClick={() => onIssuePreviewOpen(issueIdentifier)}
        >
          Show highlighted location
        </button>
        <button
          className={`view-details-button${detailIsActive ? " is-active" : ""}`}
          type="button"
          aria-label="Open this issue guidance in summary"
          aria-pressed={detailIsActive}
          onClick={() => onIssueGuidanceOpen(issueIdentifier)}
        >
          Open guidance
        </button>
      </div>
    </article>
  );
}
