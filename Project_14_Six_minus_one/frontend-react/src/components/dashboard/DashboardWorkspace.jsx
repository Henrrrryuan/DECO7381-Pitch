import { DashboardEmptyState } from "./DashboardEmptyState.jsx";
import { IssueDetailPanel } from "./IssueDetailPanel.jsx";
import { WebsitePreviewPanel } from "./WebsitePreviewPanel.jsx";
import {
  displayDimensionName,
  displayIssueCategoryName,
  formatReportTimestamp,
  getAllIssueRecords,
} from "../../utils/dashboardUtils.js";

export function DashboardWorkspace({
  dashboardSession,
  analysisResult,
  activeProfileLabel,
  activeProfileDimensionEntries,
  selectedIssueRecord,
  selectedDimensionName,
  workspaceMode,
  loadingError,
  loadingIsActive,
  showBackToHistoryButton,
  onPrintReport,
  onRenderedPreviewAvailable,
}) {
  // Main dashboard workspace.
  //
  // DashboardPage.jsx decides whether the user is viewing the summary, a
  // selected issue detail panel, or the website preview. This component keeps
  // the old dashboard.html classes so the visual design remains unchanged.
  const currentAnalysisPayload = dashboardSession?.current?.payload || null;
  const reportTimestampLabel = formatReportTimestamp(currentAnalysisPayload?.run?.created_at || "");
  const orderedDimensionResults = (activeProfileDimensionEntries || [])
    .map((dimensionEntry) => dimensionEntry.dimensionResult)
    .filter(Boolean);
  const issueRecords = getAllIssueRecords(analysisResult, activeProfileLabel);
  const currentDashboardItem = dashboardSession?.current || null;
  const previewCanBeShown = workspaceMode === "preview" && currentDashboardItem && !loadingIsActive;
  const explanationViewIsActive = !previewCanBeShown;

  return (
    <div className="tool-workspace-shell">
      <section className="tool-workspace">
        <section className="workspace-panels">
          <article className="workspace-pane explanation-pane">
            <div className="pane-header pane-header-actions-right">
              <h2 className="visually-hidden">Issue workspace actions</h2>
              <div className="report-id-chip" aria-label="Report ID">
                <span>Report ID</span>
                <strong id="reportIdValue" title={currentAnalysisPayload?.run?.run_id || ""}>
                  {reportTimestampLabel}
                </strong>
              </div>
              <div className="pane-header-actions">
                {showBackToHistoryButton ? (
                  <button
                    id="backToHistoryButton"
                    className="context-print-button back-to-history-button"
                    type="button"
                    onClick={() => {
                      window.location.href = "/history";
                    }}
                  >
                    <span aria-hidden="true">Back to History</span>
                  </button>
                ) : null}
                <button
                  id="printReportBtn"
                  className="context-print-button"
                  type="button"
                  title="Print current report"
                  onClick={onPrintReport}
                >
                  <span aria-hidden="true">Print</span>
                </button>
              </div>
            </div>
            <div
              id="explanationView"
              className={`workspace-view${explanationViewIsActive ? " is-active" : ""}`}
              hidden={!explanationViewIsActive}
            >
              <section className="sidebar-section comparison-section comparison-section-inline">
                <div
                  id="comparisonList"
                  className={
                    selectedIssueRecord
                      ? "comparison-list issue-guidance-workspace"
                      : analysisResult
                        ? "comparison-list issue-workspace-summary"
                        : "comparison-list empty"
                  }
                >
                  {loadingIsActive ? (
                    <section className="empty-analysis-panel" aria-live="polite">
                      <p className="empty-analysis-panel__eyebrow">Loading report</p>
                      <h2>Opening the saved dashboard report.</h2>
                      <p>The React dashboard is loading the selected Report ID from History.</p>
                    </section>
                  ) : selectedIssueRecord ? (
                    <IssueDetailPanel issueRecord={selectedIssueRecord} />
                  ) : analysisResult ? (
                    <>
                      {orderedDimensionResults.map((dimensionResult) => {
                        const dimensionIssueCount = issueRecords.filter((issueRecord) => (
                          displayDimensionName(issueRecord.dimensionResult.dimension)
                            === displayDimensionName(dimensionResult.dimension)
                        )).length;
                        return (
                          <section className="explanation-block" key={dimensionResult.dimension}>
                            <h3>
                              {dimensionResult.issue_category_label
                                || dimensionResult.label
                                || displayIssueCategoryName(dimensionResult.dimension)}
                            </h3>
                            <p>{`${dimensionIssueCount} issues detected in this category.`}</p>
                          </section>
                        );
                      })}
                    </>
                  ) : (
                    <DashboardEmptyState loadingError={loadingError} />
                  )}
                </div>
              </section>
            </div>

            {previewCanBeShown ? (
              <WebsitePreviewPanel
                currentDashboardItem={currentDashboardItem}
                selectedIssueRecord={selectedIssueRecord}
                selectedDimensionName={selectedDimensionName}
                onRenderedPreviewAvailable={onRenderedPreviewAvailable}
              />
            ) : null}
          </article>
        </section>
      </section>
    </div>
  );
}
