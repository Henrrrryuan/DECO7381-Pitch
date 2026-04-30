export function HistorySearch({ queryInput, onQueryInputChange, onSearch }) {
  // Search input component for the History page.
  //
  // Data flow:
  // - HistoryPage.jsx passes queryInput so this input can display the current
  //   typed text.
  // - When the user types, onQueryInputChange updates queryInput in
  //   HistoryPage.jsx.
  // - When the user submits the form, onSearch calls runSearch in
  //   HistoryPage.jsx. That page then reloads both the report history and the
  //   eye-tracking evidence tables through api/historyApi.js.
  return (
    <section className="history-toolbar" aria-label="History search">
      <label className="history-search-label" htmlFor="historySearchInput">
        Search by file name, report ID, or evidence session ID
      </label>
      <form className="history-search-row" onSubmit={onSearch}>
        <input
          id="historySearchInput"
          className="history-search-input"
          type="search"
          placeholder="Enter a file name, report ID, or evidence session ID"
          autoComplete="off"
          value={queryInput}
          onChange={(event) => onQueryInputChange(event.target.value)}
        />
        <button
          id="historySearchButton"
          className="history-search-button"
          type="submit"
          aria-label="Search reports"
        >
          <span aria-hidden="true">Search</span>
        </button>
      </form>
    </section>
  );
}
