import { EyeRows } from "./EyeRows.jsx";
import { Pagination } from "./Pagination.jsx";

export function EyeHistoryPanel({
  eyeSessionItems,
  totalEyeSessions,
  currentPage,
  pageSize,
  status,
  searchQuery,
  onPageChange,
}) {
  // Eye-tracking evidence is shown as supporting context beside the main report
  // history, but it keeps its own pagination because the datasets can differ.
  const emptyMessage = searchQuery
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
        <EyeRows
          eyeSessionItems={eyeSessionItems}
          status={status}
          emptyMessage={emptyMessage}
        />
      </div>

      <Pagination
        containerId="eyeHistoryPagination"
        ariaLabel="Eye-tracking evidence pagination"
        currentPage={currentPage}
        totalItems={totalEyeSessions}
        pageSize={pageSize}
        itemLabelText="sessions"
        onPageChange={onPageChange}
      />
    </section>
  );
}
