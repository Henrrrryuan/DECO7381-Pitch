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
  // Layout container for the Eye-Tracking Evidence section.
  //
  // Interaction with other files:
  // - HistoryPage.jsx fetches eyeSessionItems from api/historyApi.js and passes
  //   them into this component.
  // - EyeRows.jsx receives eyeSessionItems and renders each saved gaze session.
  // - Pagination.jsx receives currentPage and totalEyeSessions, then calls
  //   onPageChange when the user moves through evidence pages.
  // This section supports the report history, but it keeps independent
  // pagination because eye sessions and report runs can have different counts.
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
