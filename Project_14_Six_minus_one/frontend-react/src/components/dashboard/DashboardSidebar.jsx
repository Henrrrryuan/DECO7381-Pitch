import { DimensionBars } from "./DimensionBars.jsx";
import { IssueSummaryCard } from "./IssueSummaryCard.jsx";
import { ProfileScores } from "./ProfileScores.jsx";
import {
  displayDimensionName,
  getCognitiveDimensionLabel,
} from "../../utils/dashboard/dashboardLabels.js";
import {
  getAllIssueRecords,
} from "../../utils/dashboard/issueRecords.js";
import {
  getTotalIssueCount,
} from "../../utils/dashboard/profileScoring.js";

export function DashboardSidebar({
  analysisResult,
  activeProfileIndex,
  activeProfileLabel,
  activeProfileDimensionEntries,
  selectedIssueIdentifier,
  selectedDimensionName,
  workspaceMode,
  sidebarIsCollapsed,
  onActiveProfileIndexChange,
  onDimensionPreviewOpen,
  onIssueGuidanceOpen,
  onIssuePreviewOpen,
  onSidebarToggle,
  onSidebarResizeStart,
}) {
  // Left dashboard column.
  //
  // DashboardPage.jsx owns state such as selected issue, active profile, and
  // collapsed width. Dashboard utility modules prepare the score and issue
  // records; this component renders them with the old dashboard CSS classes.
  const totalIssueCount = getTotalIssueCount(analysisResult);
  const profileScoreItems = analysisResult?.profile_scores || [];
  const issueRecords = getAllIssueRecords(analysisResult, activeProfileLabel);
  const orderedDimensionResults = (activeProfileDimensionEntries || [])
    .map((dimensionEntry) => dimensionEntry.dimensionResult)
    .filter(Boolean);

  return (
    <div className="tool-sidebar-shell">
      <button
        id="sidebarToggleButton"
        className="sidebar-collapse-toggle"
        type="button"
        aria-controls="toolSidebar"
        aria-expanded={!sidebarIsCollapsed}
        aria-label={sidebarIsCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={sidebarIsCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onSidebarToggle}
      >
        <span className="sidebar-collapse-toggle-icon" aria-hidden="true">
          {sidebarIsCollapsed ? ">" : "<"}
        </span>
      </button>
      <div
        id="sidebarResizeHandle"
        className="sidebar-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        title="Drag to resize sidebar"
        onPointerDown={onSidebarResizeStart}
      />

      <aside id="toolSidebar" className="tool-sidebar">
        <div className="tool-sidebar-inner">
          <section className="overall-panel">
            <div className="overall-copy">
              <div id="profileScores" className="profile-scores">
                <ProfileScores
                  profileScoreItems={profileScoreItems}
                  activeProfileIndex={activeProfileIndex}
                  onActiveProfileIndexChange={onActiveProfileIndexChange}
                />
              </div>
              <p className="risk-level-hint">Risk levels indicate which issue categories may need attention first.</p>
              <DimensionBars
                activeProfileDimensionEntries={activeProfileDimensionEntries}
                selectedDimensionName={selectedDimensionName}
                workspaceMode={workspaceMode}
                onDimensionPreviewOpen={onDimensionPreviewOpen}
              />
            </div>
          </section>

          <section className="sidebar-section sidebar-explanation-section">
            <div className="pane-header">
              <h2>Top Issue Cards</h2>
            </div>
            <div className="sidebar-explanation-content">
              <div id="dashboardSummaryText" className="overall-summary">
                {analysisResult ? (
                  <div className="summary-line summary-issues">
                    {`Total number of issues: ${issueRecords.length || totalIssueCount} issues detected`}
                  </div>
                ) : null}
              </div>
              <section id="printSummary" className="print-summary" aria-label="Printable summary">
                <div className="print-summary-top">
                  <div className="print-summary-score">
                    <span className="print-summary-score-label">Overall</span>
                    <strong id="printOverallScore">{analysisResult?.overall_score ?? "-"}</strong>
                  </div>
                  <div className="print-summary-copy">
                    <h3 id="printSourceName">Waiting for upload</h3>
                    <p id="printSummaryText">Run an analysis to populate the printable summary.</p>
                  </div>
                </div>
                <div id="printDimensionSummary" className="print-dimension-summary" />
              </section>
              <div id="explanationContent" className={`pane-scroll rich-text${analysisResult ? "" : " empty"}`}>
                {analysisResult
                  ? orderedDimensionResults.map((dimensionResult) => {
                    const dimensionIssueRecords = issueRecords.filter((issueRecord) => (
                      displayDimensionName(issueRecord.dimensionResult.dimension)
                        === displayDimensionName(dimensionResult.dimension)
                    ));
                    return (
                    <details
                      className="explanation-block explanation-accordion"
                      key={dimensionResult.dimension}
                      open={dimensionIssueRecords.some((issueRecord) => issueRecord.issueIdentifier === selectedIssueIdentifier)}
                    >
                      <summary className="explanation-accordion-summary">
                        <span className="explanation-accordion-title">
                          {dimensionResult.issue_category_label || dimensionResult.label || dimensionResult.dimension}
                        </span>
                        <span className="explanation-accordion-meta">
                          <span className="explanation-accordion-issue-count">
                            {dimensionIssueRecords.length}
                          </span>
                          <span className="explanation-accordion-chevron" aria-hidden="true">v</span>
                        </span>
                      </summary>
                      <div className="explanation-accordion-content">
                        <p className="category-helper">
                          {dimensionResult.cognitive_dimension || getCognitiveDimensionLabel(dimensionResult.dimension)}
                        </p>
                        {dimensionIssueRecords.length ? (
                          <div className="issue-highlight-list">
                            {dimensionIssueRecords.map((issueRecord) => (
                              <IssueSummaryCard
                                issueRecord={issueRecord}
                                key={issueRecord.issueIdentifier}
                                selectedIssueIdentifier={selectedIssueIdentifier}
                                workspaceMode={workspaceMode}
                                onIssueGuidanceOpen={onIssueGuidanceOpen}
                                onIssuePreviewOpen={onIssuePreviewOpen}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </details>
                    );
                  })
                  : "Analysis explanations will appear here after the current page is processed."}
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
