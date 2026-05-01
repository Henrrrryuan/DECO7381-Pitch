export function TestPagePanel({
  targetUrlInput,
  currentTargetUrl,
  frameHint,
  onTargetUrlInputChange,
  onLoadTargetUrl,
}) {
  // Step 2 in the workflow. The target URL is loaded through the FastAPI proxy
  // by EyeTrackingPage.jsx, then displayed in TrackingViewport.jsx.
  return (
    <section className="eye-step-panel" aria-labelledby="testPageTitle">
      <div className="eye-step-label">Step 2</div>
      <h2 id="testPageTitle">Prepare Test Page</h2>
      <p>
        Load the page that the participant will inspect. Localhost and public
        HTTP/HTTPS URLs are supported.
      </p>

      <form className="eye-url-form" onSubmit={onLoadTargetUrl}>
        <label className="eye-field">
          <span>Target URL</span>
          <input
            type="url"
            inputMode="url"
            value={targetUrlInput}
            placeholder="http://localhost:5173"
            autoComplete="url"
            onChange={(event) => onTargetUrlInputChange(event.target.value)}
          />
        </label>
        <button className="eye-primary-button" type="submit">
          Load URL
        </button>
      </form>

      <div className="eye-target-summary">
        <span>Current target</span>
        <strong>{currentTargetUrl || "No page loaded"}</strong>
        <small>{frameHint}</small>
      </div>
    </section>
  );
}
