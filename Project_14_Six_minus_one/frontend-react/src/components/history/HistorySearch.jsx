export function HistorySearch({ queryInput, onQueryInputChange, onSearch }) {
  // The same search term is shared by report history and eye-tracking evidence
  // so users can look up a file name, Report ID, or Evidence ID from one place.
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
