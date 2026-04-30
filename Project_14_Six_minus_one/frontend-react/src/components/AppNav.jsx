export function AppNav() {
  return (
    <header className="app-nav">
      <div className="app-nav-inner">
        <a className="app-brand" href="http://127.0.0.1:8001/index.html">
          <span className="app-brand-mark">C</span>
          <span className="app-brand-name">CogniLens</span>
        </a>

        <nav className="app-nav-links" aria-label="Primary">
          <a href="http://127.0.0.1:8001/eye/">Eye Tracking</a>
          <a className="active-link" href="/history">History</a>
          <a href="http://127.0.0.1:8001/docs.html">Docs</a>
          <a className="nav-cta" href="http://127.0.0.1:8001/index.html">New Analysis</a>
        </nav>
      </div>
    </header>
  );
}
