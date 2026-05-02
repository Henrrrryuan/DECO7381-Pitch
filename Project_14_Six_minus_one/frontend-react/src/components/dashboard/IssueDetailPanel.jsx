import {
  displayIssueCategorySingular,
} from "../../utils/dashboard/dashboardLabels.js";
import {
  frameworkMappingCopy,
  getKeyLocations,
  issueAffectedUserTags,
  issueCognitiveObjective,
  issueDoneWhenText,
  issueFailingElementCount,
  issueGoalText,
  issueIsoClauseTags,
  locationMetaText,
  recommendedFixSteps,
} from "../../utils/dashboard/issueGuidance.js";

function PageEvidence({ issue }) {
  // Evidence list for the selected issue detail panel.
  //
  // The backend may provide exact selectors or text snippets. This component
  // presents a short human-readable list, while WebsitePreviewPanel.jsx handles
  // the actual highlight behavior inside the iframe.
  const keyLocations = getKeyLocations(issue, 3);
  const affectedElementCount = issueFailingElementCount(issue);

  if (!keyLocations.length) {
    return (
      <div className="standards-failing-element">
        <span className="standards-location-index">1.</span>
        <div>
          <span className="standards-location-meta">{issue.rule_id || "Detected rule"}</span>
          <p>{issue.title || "This rule was triggered by the current analysis."}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="standards-evidence-intro">
        <p>{`${affectedElementCount} affected element${affectedElementCount === 1 ? "" : "s"} found. Key page areas:`}</p>
        <small>Use <strong>Show highlighted location</strong> on the issue card to inspect the exact locations.</small>
      </div>
      <ol className="standards-failing-list">
        {keyLocations.map(({ label }, locationIndex) => (
          <li className="standards-failing-element" key={`${label}-${locationIndex}`}>
            <span className="standards-location-index">{`${locationIndex + 1}.`}</span>
            <p>{label}</p>
          </li>
        ))}
      </ol>
    </>
  );
}

export function IssueDetailPanel({ issueRecord }) {
  // Main guidance panel shown when a user chooses "Open guidance".
  //
  // DashboardWorkspace.jsx passes in the selected issue record. The copy is
  // derived from utils/dashboard/issueGuidance.js so this component can stay
  // focused on rendering the original dashboard.html guidance structure.
  if (!issueRecord) {
    return null;
  }

  const { dimensionResult, issue } = issueRecord;
  const ruleIdentifier = issue.rule_id || "";
  const affectedElementCount = issueFailingElementCount(issue);
  const affectedUsers = issueAffectedUserTags(ruleIdentifier);
  const standards = frameworkMappingCopy(ruleIdentifier);
  const isoClauses = issueIsoClauseTags(ruleIdentifier);
  const fixSteps = recommendedFixSteps(issue, dimensionResult.dimension);
  const developerLocations = Array.isArray(issue.locations) ? issue.locations : [];

  return (
    <section className="issue-guidance-panel" aria-label="Selected issue guidance">
      <div className="issue-guidance-hero">
        <div className="issue-detail-heading">
          <span>{displayIssueCategorySingular(issue, dimensionResult.dimension)}</span>
        </div>
        <div className="issue-detail-problem">
          <span className="issue-detail-label">Selected issue</span>
          <h3>{issue.title || "Review this issue"}</h3>
          <p>Follow the priority steps below, then verify changes with <strong>Show highlighted location</strong>.</p>
        </div>
        <div className="issue-brief-strip" aria-label="Issue summary">
          <div className="issue-brief-item">
            <span>Affected elements</span>
            <strong>{affectedElementCount}</strong>
          </div>
          <div className="issue-brief-item">
            <span>Most affected users</span>
            <div className="user-group-chip-list">
              {affectedUsers.map((userLabel) => (
                <span className="user-group-chip" key={userLabel}>{userLabel}</span>
              ))}
            </div>
          </div>
          <div className="issue-brief-item">
            <span>Redesign goal</span>
            <strong>{issueGoalText(issue, dimensionResult.dimension)}</strong>
          </div>
        </div>
      </div>

      <div className="issue-guidance-grid">
        <section className="guidance-card guidance-card-primary">
          <span className="issue-detail-label">Recommended fix steps (priority order)</span>
          <ol className="guidance-step-list">
            {fixSteps.map((step) => (
              <li key={`${step.priority}-${step.text}`}>
                <p>
                  <span className={`guidance-step-priority ${String(step.priority).toLowerCase()}`}>
                    {step.priority}
                  </span>
                  {` ${step.text}`}
                </p>
              </li>
            ))}
          </ol>
        </section>
        <div className="issue-guidance-secondary">
          <section className="guidance-card">
            <span className="issue-detail-label">Why this matters</span>
            <p>{issue.description || "This pattern can increase mental effort and make the page harder to use."}</p>
          </section>
          <section className="guidance-card">
            <span className="issue-detail-label">Done when</span>
            <p>{issueDoneWhenText(issue, dimensionResult.dimension)}</p>
            <small>{`Expected impact: ${issueCognitiveObjective(ruleIdentifier)}`}</small>
          </section>
          <section className="guidance-card">
            <span className="issue-detail-label">Page evidence</span>
            <PageEvidence issue={issue} />
          </section>
        </div>
      </div>

      <details className="advanced-details">
        <summary>Advanced details</summary>
        <div className="advanced-details-grid">
          <section>
            <span className="issue-detail-label">Standards mapping</span>
            <ul className="priority-evidence">
              <li>{standards.wcag}</li>
              <li>{standards.coga}</li>
              {isoClauses.map((clause) => (
                <li key={clause}>{clause}</li>
              ))}
            </ul>
          </section>
          <section>
            <span className="issue-detail-label">Developer selectors</span>
            {developerLocations.length ? (
              <ul className="advanced-selector-list">
                {developerLocations.map((location, locationIndex) => (
                  <li key={`${locationMetaText(location)}-${locationIndex}`}>
                    <span aria-hidden="true">{locationIndex + 1}</span>
                    <code>{locationMetaText(location).replace(/^Location: /, "")}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="summary-muted">No exact selector was linked for this issue.</p>
            )}
          </section>
        </div>
      </details>
    </section>
  );
}
