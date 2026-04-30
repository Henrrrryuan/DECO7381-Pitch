import { EyeRows } from "./EyeRows.jsx";
import { Pagination } from "./Pagination.jsx";

export function EyeHistoryPanel({
  items,
  total,
  page,
  pageSize,
  status,
  query,
  onPageChange,
}) {
  const emptyMessage = query
    ? "No eye-tracking evidence sessions match the current search."
    : "No eye-tracking evidence sessions have been saved yet.";

  return (
    <section className="history-list-shell eye-history-shell">
      <div className="history-section-header">
        <div>
          <p className="upload-kicker">Supporting Evidence</p>
          <h2>Eye-Tracking Evidence Sessions</h2>
        </div>
        <p className="history-section-copy">
          Review saved gaze sessions as supporting evidence for attention patterns,
          information overload, and related analysis runs.
        </p>
      </div>

      <div className="history-eye-table-head">
        <span>Evidence ID</span>
        <span>Page</span>
        <span>Coverage</span>
        <span>Report ID</span>
      </div>

      <div id="eyeHistoryList" className="history-table-body">
        <EyeRows items={items} status={status} emptyMessage={emptyMessage} />
      </div>

      <Pagination
        id="eyeHistoryPagination"
        ariaLabel="Eye-tracking evidence pagination"
        page={page}
        total={total}
        pageSize={pageSize}
        itemLabel="sessions"
        onPageChange={onPageChange}
      />
    </section>
  );
}
