import { Pagination } from "./Pagination.jsx";
import { ReportRows } from "./ReportRows.jsx";

export function ReportHistoryPanel({
  reportItems,
  totalReports,
  currentPage,
  pageSize,
  status,
  searchQuery,
  onPageChange,
  onOpenReport,
}) {
  // This panel owns only the report history table layout. Fetching and search
  // state stay in HistoryPage so this component remains easy to test and reuse.
  const emptyMessage = searchQuery
    ? "No reports match the current file name or ID search."
    : "No analysis history has been saved yet.";

  return (
    <section className="history-list-shell">
      <div className="history-table-head">
        <span>Report ID</span>
        <span>File</span>
        <span>Date</span>
        <span>Overall</span>
        <span>Actions</span>
      </div>

      <div id="historyList" className="history-table-body">
        <ReportRows
          reportItems={reportItems}
          status={status}
          emptyMessage={emptyMessage}
          onOpenReport={onOpenReport}
        />
      </div>

      <Pagination
        containerId="historyPagination"
        ariaLabel="Report history pagination"
        currentPage={currentPage}
        totalItems={totalReports}
        pageSize={pageSize}
        itemLabelText="reports"
        onPageChange={onPageChange}
      />
    </section>
  );
}
