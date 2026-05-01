import {
  getPageOffset,
  getTotalPages,
} from "../../utils/historyUtils.js";

export function Pagination({
  containerId,
  ariaLabel,
  currentPage,
  totalItems,
  pageSize,
  itemLabelText,
  onPageChange,
}) {
  // Shared pagination control used by both ReportHistoryPanel.jsx and
  // EyeHistoryPanel.jsx.
  //
  // This component only calculates display values such as "Page 2 of 4" and
  // "26-50 of 61 reports". It does not own the report or eye-session data.
  // When the user clicks Previous or Next, it calls onPageChange. The parent
  // panel passes that callback from HistoryPage.jsx, where the actual page
  // state is updated and the API request is re-run.
  // The visible page is clamped so state cannot move outside the available
  // page range.
  const totalPages = getTotalPages(totalItems, pageSize);
  const visiblePageNumber = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
  const firstVisibleItemNumber = totalItems ? getPageOffset(visiblePageNumber, pageSize) + 1 : 0;
  const lastVisibleItemNumber = Math.min(
    getPageOffset(visiblePageNumber, pageSize) + pageSize,
    totalItems,
  );

  return (
    <div id={containerId} className="history-pagination" aria-label={ariaLabel}>
      <div className="history-pagination-summary">
        <strong>{`Page ${visiblePageNumber} of ${totalPages}`}</strong>
        <span>{`${firstVisibleItemNumber}-${lastVisibleItemNumber} of ${totalItems} ${itemLabelText}`}</span>
      </div>

      <div className="history-pagination-controls">
        <button
          className="history-page-btn"
          type="button"
          disabled={visiblePageNumber <= 1}
          onClick={() => onPageChange(Math.max(1, visiblePageNumber - 1))}
        >
          Previous
        </button>

        <span className="history-pagination-page-indicator">
          {`${visiblePageNumber} / ${totalPages}`}
        </span>

        <button
          className="history-page-btn"
          type="button"
          disabled={visiblePageNumber >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, visiblePageNumber + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
