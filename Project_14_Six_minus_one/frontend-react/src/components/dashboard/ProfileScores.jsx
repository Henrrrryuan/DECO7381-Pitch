import { displayProfileName } from "../../utils/dashboard/dashboardLabels.js";

export function ProfileScores({
  profileScoreItems,
  activeProfileIndex,
  onActiveProfileIndexChange,
}) {
  // Score lens tab strip for the migrated Dashboard sidebar.
  //
  // DashboardSidebar.jsx passes profileScoreItems from the loaded report. This
  // component only renders the existing score-slider tab class names and tells
  // DashboardPage.jsx which lens is selected.
  if (!profileScoreItems.length) {
    return <p className="profile-scores-empty">Score lenses will appear after analysis.</p>;
  }

  return (
    <div className="score-slider-tabs" aria-label="Score lens navigation">
      {profileScoreItems.map((profileScoreItem, profileScoreIndex) => {
        const profileIsActive = profileScoreIndex === activeProfileIndex;
        return (
          <button
            key={profileScoreItem.name || profileScoreIndex}
            type="button"
            className={`score-slider-tab${profileIsActive ? " is-active" : ""}`}
            aria-label={`Select ${profileScoreItem.name || "score"} lens`}
            aria-pressed={profileIsActive}
            onClick={() => onActiveProfileIndexChange(profileScoreIndex)}
          >
            {displayProfileName(profileScoreItem.name || profileScoreItem.profile || profileScoreItem.label || "")}
          </button>
        );
      })}
    </div>
  );
}
