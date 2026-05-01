export function AppNav({ activePage = "history" }) {
  // Shared navigation for migrated Vite pages.
  //
  // HomePage.jsx, HistoryPage.jsx, and EyeTrackingPage.jsx render this component
  // at the top of the page. Migrated routes stay inside Vite (/, /history, and
  // /eye), while pages that have not moved yet still point to the older static
  // frontend on port 8001. This keeps the migration incremental.
  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <a className="app-brand" href="/">
          <span className="app-brand-mark">C</span>
          <span className="app-brand-name">CogniLens</span>
        </a>

        <nav className="app-nav-links" aria-label="Primary">
          <a href="http://127.0.0.1:8001/docs.html">Guide</a>
          <a className={activePage === "eye" ? "active-link" : ""} href="/eye">
            Eye Tracking
          </a>
          <a className={activePage === "history" ? "active-link" : ""} href="/history">
            History
          </a>
          <a className={`nav-cta${activePage === "home" ? " active" : ""}`} href="/">New Analysis</a>
        </nav>
      </div>
    </header>
  );
}
