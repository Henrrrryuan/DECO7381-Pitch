import {
  displayIssueCategoryName,
} from "../../utils/dashboard/dashboardLabels.js";
import {
  riskMetaFromScore,
} from "../../utils/dashboard/profileScoring.js";

export function DimensionBars({
  activeProfileDimensionEntries,
  selectedDimensionName,
  workspaceMode,
  onDimensionPreviewOpen,
}) {
  // Sidebar risk category list.
  //
  // DashboardPage.jsx calculates activeProfileDimensionEntries through
  // utils/dashboard/profileScoring.js. This component only renders the current
  // risk badges and sends preview clicks back to DashboardPage.jsx.
  const dimensionEntries = activeProfileDimensionEntries || [];

  return (
    <div id="dimensionBars" className="dimension-bars">
      {dimensionEntries.map((dimensionEntry) => {
        const riskMeta = riskMetaFromScore(dimensionEntry.score);
        const issueCategoryName = displayIssueCategoryName(dimensionEntry.name);
        const dimensionIsActive = workspaceMode === "preview" && selectedDimensionName === dimensionEntry.name;
        return (
          <button
            key={dimensionEntry.name}
            className={`dimension-row dimension-highlight-trigger${dimensionIsActive ? " is-active" : ""}`}
            type="button"
            data-highlight-dimension={dimensionEntry.name}
            data-risk-level={riskMeta.level}
            aria-label={`${issueCategoryName}: ${riskMeta.level}. Show related locations in the page preview.`}
            aria-pressed={dimensionIsActive}
            onClick={() => onDimensionPreviewOpen(dimensionEntry.name)}
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
