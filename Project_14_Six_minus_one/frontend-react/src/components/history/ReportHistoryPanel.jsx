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
  // Layout container for the Report History section.
  //
  // Interaction with other files:
  // - HistoryPage.jsx fetches reportItems from api/historyApi.js and passes them
  //   into this component.
  // - ReportRows.jsx receives reportItems and renders each individual row.
  // - Pagination.jsx receives currentPage and totalReports, then calls
  //   onPageChange when the user moves to another page.
  // This component does not fetch data itself; it only organizes the report
  // table header, row renderer, empty state, and pagination.
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
