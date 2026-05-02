export function AppNav({ activePage = "history" }) {
  // Shared navigation for the Vite React app. Guide is still the legacy HTML page,
  // proxied from the dev server as /static-ui/docs.html.
  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <a className="app-brand" href="/">
          <span className="app-brand-mark">C</span>
          <span className="app-brand-name">CogniLens</span>
        </a>

        <nav className="app-nav-links" aria-label="Primary">
          <a href="/static-ui/docs.html">Guide</a>
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
