import { useEffect, useState } from "react";

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
  // Clamp the active page so browser state, API totals, and typed jump values
  // cannot move the table outside the available page range.
  const totalPages = getTotalPages(totalItems, pageSize);
  const visiblePageNumber = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
  const firstVisibleItemNumber = totalItems ? getPageOffset(visiblePageNumber, pageSize) + 1 : 0;
  const lastVisibleItemNumber = Math.min(
    getPageOffset(visiblePageNumber, pageSize) + pageSize,
    totalItems,
  );
  const [typedPageNumber, setTypedPageNumber] = useState(String(visiblePageNumber));

  useEffect(() => {
    setTypedPageNumber(String(visiblePageNumber));
  }, [visiblePageNumber, totalPages]);

  const goToTypedPage = () => {
    const requestedPageNumber = Number(typedPageNumber) || visiblePageNumber;
    const nextPageNumber = Math.min(Math.max(1, requestedPageNumber), totalPages);
    onPageChange(nextPageNumber);
  };

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

        <label className="history-page-jump">
          <span>Go to</span>
          <input
            className="history-page-input"
            type="number"
            min="1"
            max={String(totalPages)}
            value={typedPageNumber}
            inputMode="numeric"
            onChange={(event) => setTypedPageNumber(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                goToTypedPage();
              }
            }}
          />
        </label>

        <button className="history-page-btn" type="button" onClick={goToTypedPage}>
          Go
        </button>

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
