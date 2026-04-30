export function HistoryHero() {
  // Static page heading for the History route.
  //
  // HistoryPage.jsx renders this before the search and table sections. It does
  // not receive data or call other files; its only job is to explain the page
  // purpose visually.
  return (
    <section className="history-hero">
      <p className="upload-kicker">History</p>
      <h1>Previous Analyses</h1>
      <p className="history-description">
        Review recent submissions and reopen a previous analysis in the dashboard.
      </p>
    </section>
  );
}
