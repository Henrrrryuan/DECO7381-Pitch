export function ReportLinkPanel({
  relatedReportId,
  sourceName,
  onRelatedReportIdChange,
  onSourceNameChange,
}) {
  // Step 1 in the workflow. EyeTrackingPage.jsx owns the values and passes the
  // update callbacks here. This component does not validate the Report ID; the
  // backend validates it when the session is saved.
  return (
    <section className="eye-step-panel" aria-labelledby="reportLinkTitle">
      <div className="eye-step-label">Step 1</div>
      <h2 id="reportLinkTitle">Link Evidence to Report</h2>
      <p>
        Use a Report ID when this gaze session supports a specific analysis.
        Leave it blank for standalone exploration.
      </p>

      <label className="eye-field">
        <span>Report ID</span>
        <input
          type="text"
          value={relatedReportId}
          placeholder="Optional report ID"
          autoComplete="off"
          onChange={(event) => onRelatedReportIdChange(event.target.value)}
        />
      </label>

      <label className="eye-field">
        <span>Evidence label</span>
        <input
          type="text"
          value={sourceName}
          placeholder="Optional page or task name"
          autoComplete="off"
          onChange={(event) => onSourceNameChange(event.target.value)}
        />
      </label>
    </section>
  );
}
