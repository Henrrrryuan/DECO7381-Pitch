export function HistoryHero() {
  // Static page heading for the History route.
  //
  // HistoryPage.jsx renders this before the search and table sections. It does
  // not receive data or call other files; its only job is to explain the page
  // purpose visually.
  return (
    <section className="history-hero">
      <h1>Previous Analyses</h1>
    </section>
  );
}
