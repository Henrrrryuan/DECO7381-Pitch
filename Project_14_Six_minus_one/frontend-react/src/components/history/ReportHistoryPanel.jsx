import { Pagination } from "./Pagination.jsx";
import { ReportRows } from "./ReportRows.jsx";

export function ReportHistoryPanel({
  items,
  total,
  page,
  pageSize,
  status,
  query,
  onPageChange,
  onOpenReport,
}) {
  const emptyMessage = query
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
          items={items}
          status={status}
          emptyMessage={emptyMessage}
          onOpenReport={onOpenReport}
        />
      </div>

      <Pagination
        id="historyPagination"
        ariaLabel="Report history pagination"
        page={page}
        total={total}
        pageSize={pageSize}
        itemLabel="reports"
        onPageChange={onPageChange}
      />
    </section>
  );
}
