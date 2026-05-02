import {
  friendlyLocationLabel,
  issueAffectedUserTags,
  issueDoneWhenText,
  issueFailingElementCount,
  issueGoalText,
  locationMetaText,
  recommendedFixSteps,
} from "../../utils/dashboard/issueGuidance.js";

function GuidanceEvidence({ issue }) {
  // Numbered affected-element evidence list.
  //
  // This mirrors the updated legacy 8001 guidance layout: concrete page areas
  // appear first so designers can connect the recommendation to the preview.
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  const affectedElementCount = issueFailingElementCount(issue);

  if (!locations.length) {
    return (
      <div className="guidance-location-list">
        <div className="guidance-location-card">
          <span className="guidance-location-index">1.</span>
          <div>
            <strong>{issue?.rule_id || "Detected rule"}</strong>
            <p>{issue?.title || "This rule was triggered by the current analysis."}</p>
          </div>
        </div>
      </div>
    );
  }

  const shownLocations = locations.slice(0, 12);
  const hiddenCount = Math.max(0, locations.length - shownLocations.length);

  return (
    <>
      <div className="guidance-evidence-note">
        <strong>{`${affectedElementCount} affected element${affectedElementCount === 1 ? "" : "s"} found`}</strong>
        <span>
          Each row shows the element type and its approximate page or code location. The numbers match the{" "}
          <strong>Element 1</strong>, <strong>Element 2</strong> labels in the page highlight.
        </span>
      </div>
      <div className="guidance-location-list">
        {shownLocations.map((location, locationIndex) => {
          const label = friendlyLocationLabel(location);
          const metaText = locationMetaText(location).replace(/^Location: /, "");
          const showMeta = metaText && metaText !== label;
          return (
            <div className="guidance-location-card" key={`${label}-${locationIndex}`}>
              <span className="guidance-location-index">{`${locationIndex + 1}.`}</span>
              <div>
                <strong>{label}</strong>
                {showMeta ? <p>{metaText}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
      {hiddenCount ? (
        <p className="guidance-hidden-count">
          {`${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"} not shown.`}
        </p>
      ) : null}
    </>
  );
}

function GuidanceFixSteps({ issue, dimensionName }) {
  const visibleSteps = recommendedFixSteps(issue, dimensionName).slice(0, 2);
  const stepLabels = ["First change", "Supporting change"];

  return (
    <ol className="guidance-step-list">
      {visibleSteps.map((step, stepIndex) => (
        <li key={`${stepLabels[stepIndex]}-${step.text}`}>
          <strong>{stepLabels[stepIndex] || `Step ${stepIndex + 1}`}</strong>
          <p>{step.text || ""}</p>
        </li>
      ))}
    </ol>
  );
}

export function IssueDetailPanel({ issueRecord }) {
  // Main guidance panel shown when a user chooses "Open guidance".
  //
  // This now follows the updated 8001 layout: a concise numbered report with
  // affected elements, why it matters, and the first redesign move.
  if (!issueRecord) {
    return null;
  }

  const { dimensionResult, issue } = issueRecord;
  const dimensionName = dimensionResult.dimension;
  const affectedUsers = issueAffectedUserTags(issue.rule_id || "");
  const primaryUser = affectedUsers[0] || "affected users";
  const successCheckText = issueDoneWhenText(issue, dimensionName).replace(/^Done when\s*/i, "");

  return (
    <section className="issue-guidance-panel" aria-label="Selected issue guidance">
      <div className="guidance-expanded-report">
        <section className="guidance-numbered-section">
          <h4><span>1.</span> Affected elements and locations</h4>
          <GuidanceEvidence issue={issue} />
        </section>

        <section className="guidance-numbered-section">
          <h4><span>2.</span> Why this matters</h4>
          <div className="guidance-text-card">
            <p>{issue.description || "This pattern can increase mental effort and make the page harder to use."}</p>
          </div>
        </section>

        <section className="guidance-numbered-section">
          <h4><span>3.</span> First redesign move</h4>
          <div className="guidance-text-card">
            <p className="guidance-redesign-goal">{issueGoalText(issue, dimensionName)}</p>
            <GuidanceFixSteps issue={issue} dimensionName={dimensionName} />
            <p className="guidance-success-check">
              <strong>{`Success check for ${primaryUser}:`}</strong>
              {` ${successCheckText}`}
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
