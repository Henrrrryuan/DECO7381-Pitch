export function WebsiteAnalysisPanel({
  websiteAddressInputValue,
  analysisIsStarting,
  onWebsiteAddressInputChange,
  onWebsiteAnalysisSubmit,
}) {
  // Form for the primary website-address analysis path.
  //
  // This component does not normalize or save the address itself. It sends the
  // form submission to HomePage.jsx, where uploadApi.js prepares the pending
  // analysis payload that loading.js will later consume. The markup keeps the
  // old Home page classes so the React page can visually match index.html.
  return (
    <form className="workflow-panel primary-input-card is-active" onSubmit={onWebsiteAnalysisSubmit} noValidate>
      <div className="input-card-copy">
        <h3>Check a website</h3>
        <p>Use this when your website is running on localhost or a local network address.</p>
      </div>

      <div className="url-input-row">
        <input
          className="url-input"
          type="url"
          inputMode="url"
          value={websiteAddressInputValue}
          placeholder="http://localhost:5173"
          autoComplete="url"
          onChange={(event) => onWebsiteAddressInputChange(event.target.value)}
        />
      </div>

      <button
        className="upload-analyze-button"
        type="submit"
        disabled={analysisIsStarting || !websiteAddressInputValue.trim()}
      >
        {analysisIsStarting ? "Analyzing..." : "Analyze"}
      </button>
    </form>
  );
}
