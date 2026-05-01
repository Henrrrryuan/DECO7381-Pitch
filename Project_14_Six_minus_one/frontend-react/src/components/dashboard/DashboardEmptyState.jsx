export function DashboardEmptyState({ loadingError }) {
  // Empty/error state copied from old app.js renderMissingAnalysisState().
  //
  // DashboardWorkspace.jsx renders this when there is no loaded report yet, or
  // when the first report loading step fails.
  return (
    <section className="empty-analysis-panel" aria-live="polite">
      <p className="empty-analysis-panel__eyebrow">
        {loadingError ? "Report could not load" : "No analysis loaded"}
      </p>
      <h2>Open a saved report from History or start a new analysis.</h2>
      <p>
        {loadingError || "This page needs an analysis result before issue cards and guidance can be shown."}
      </p>
      <div className="empty-analysis-panel__actions">
        <a className="secondary-pill-button" href="/history">Back to History</a>
        <a className="primary-pill-button" href="/">New Analysis</a>
      </div>
    </section>
  );
}
