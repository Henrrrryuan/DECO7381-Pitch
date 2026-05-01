export function EvidenceSummary({
  statusMessage,
  coordinatesText,
  sampleCount,
  coveragePercent,
  durationText,
  lastSavedSessionId,
  coverageCanvasRef,
}) {
  // Step 4 in the workflow. EyeTrackingPage.jsx updates these metrics while the
  // tracker runs. The coverage canvas is drawn by page-level canvas logic and
  // displayed here as a compact visited-map summary.
  return (
    <section className="eye-step-panel eye-summary-panel" aria-labelledby="summaryTitle">
      <div className="eye-step-label">Step 4</div>
      <h2 id="summaryTitle">Evidence Summary</h2>

      <div className="eye-status-message" aria-live="polite">
        {statusMessage}
      </div>

      <dl className="eye-metrics">
        <div>
          <dt>Gaze</dt>
          <dd>{coordinatesText}</dd>
        </div>
        <div>
          <dt>Samples</dt>
          <dd>{sampleCount}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>{coveragePercent.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{durationText}</dd>
        </div>
      </dl>

      <div className="eye-coverage-map">
        <span>Visited Map</span>
        <canvas ref={coverageCanvasRef} width="300" height="180" />
      </div>

      <p className="eye-saved-session">
        {lastSavedSessionId
          ? `Saved evidence session: ${lastSavedSessionId.slice(0, 8).toUpperCase()}`
          : "No evidence session saved in this recording yet."}
      </p>
    </section>
  );
}
