import { issueCardStandardsSummary } from "../../utils/dashboard/issueGuidance.js";

function splitStandardItems(summaryText, fallbackText) {
  const source = String(summaryText || "").trim();
  const parts = source
    .split(/[;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length ? parts : [fallbackText];
}

function WcagStandardPills({ summaryText }) {
  const items = splitStandardItems(summaryText, "SC 2.4.6 Headings and Labels")
    .map((item) => item.replace(/^WCAG\s*2\.2\s*/i, "").replace(/^WCAG\s*/i, "").trim())
    .filter(Boolean)
    .map((item) => (/^SC\s+/i.test(item) ? item : `SC ${item}`));

  return (
    <div className="issue-standards-list">
      {(items.length ? items : ["SC 2.4.6 Headings and Labels"]).map((item) => (
        <span className="issue-standard-pill" key={item}>{item}</span>
      ))}
    </div>
  );
}

function StandardPills({ summaryText, fallbackText }) {
  return (
    <div className="issue-standards-list">
      {splitStandardItems(summaryText, fallbackText).map((item) => (
        <span className="issue-standard-pill" key={item}>{item}</span>
      ))}
    </div>
  );
}

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
  const { wcag: wcagSummary, iso: isoSummary } = issueCardStandardsSummary(issue.rule_id || "");

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
      <div className="issue-summary-row issue-summary-row-standards">
        <span className="issue-highlight-label issue-highlight-label--wcag-guidance">
          WCAG Cognitive Accessibility Guidance
        </span>
        <WcagStandardPills summaryText={wcagSummary} />
      </div>
      <div className="issue-summary-row issue-summary-row-standards">
        <span className="issue-highlight-label">ISO 9241-11</span>
        <StandardPills summaryText={isoSummary} fallbackText="Effectiveness, efficiency, satisfaction." />
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
