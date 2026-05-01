import {
  displayIssueCategoryName,
  getOrderedDimensionResults,
  riskMetaFromScore,
} from "../../utils/dashboardUtils.js";

export function DimensionBars({
  analysisResult,
  selectedDimensionName,
  workspaceMode,
  onDimensionPreviewOpen,
}) {
  // Sidebar risk category list.
  //
  // DashboardSidebar.jsx passes the click handler from DashboardPage.jsx. When
  // a user clicks a dimension, the workspace switches to website preview and
  // WebsitePreviewPanel.jsx highlights related page regions.
  const orderedDimensionResults = getOrderedDimensionResults(analysisResult);

  return (
    <div id="dimensionBars" className="dimension-bars">
      {orderedDimensionResults.map((dimensionResult) => {
        const riskMeta = riskMetaFromScore(dimensionResult.score);
        const issueCategoryName = displayIssueCategoryName(dimensionResult.dimension);
        const dimensionIsActive = workspaceMode === "preview" && selectedDimensionName === dimensionResult.dimension;
        return (
          <button
            key={dimensionResult.dimension}
            className={`dimension-row dimension-highlight-trigger${dimensionIsActive ? " is-active" : ""}`}
            type="button"
            data-highlight-dimension={dimensionResult.dimension}
            data-risk-level={riskMeta.level}
            aria-label={`${issueCategoryName}: ${riskMeta.level}. Show related locations in the page preview.`}
            aria-pressed={dimensionIsActive}
            onClick={() => onDimensionPreviewOpen(dimensionResult.dimension)}
          >
            <span className="dimension-label-with-info">
              <span>{issueCategoryName}</span>
              <span className="dimension-info-icon" aria-hidden="true">i</span>
            </span>
            <span className={`risk-badge ${riskMeta.className}`}>{riskMeta.level}</span>
          </button>
        );
      })}
    </div>
  );
}
