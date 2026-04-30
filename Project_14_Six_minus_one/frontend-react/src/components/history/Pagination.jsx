import { useEffect, useState } from "react";

import {
  getPageOffset,
  getTotalPages,
} from "../../utils/historyUtils.js";

export function Pagination({
  id,
  ariaLabel,
  page,
  total,
  pageSize,
  itemLabel,
  onPageChange,
}) {
  const totalPages = getTotalPages(total, pageSize);
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startItem = total ? getPageOffset(safePage, pageSize) + 1 : 0;
  const endItem = Math.min(getPageOffset(safePage, pageSize) + pageSize, total);
  const [jumpPage, setJumpPage] = useState(String(safePage));

  useEffect(() => {
    setJumpPage(String(safePage));
  }, [safePage, totalPages]);

  const jumpToPage = () => {
    const nextPage = Math.min(Math.max(1, Number(jumpPage) || safePage), totalPages);
    onPageChange(nextPage);
  };

  return (
    <div id={id} className="history-pagination" aria-label={ariaLabel}>
      <div className="history-pagination-summary">
        <strong>{`Page ${safePage} of ${totalPages}`}</strong>
        <span>{`${startItem}-${endItem} of ${total} ${itemLabel}`}</span>
      </div>

      <div className="history-pagination-controls">
        <button
          className="history-page-btn"
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
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
            value={jumpPage}
            inputMode="numeric"
            onChange={(event) => setJumpPage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                jumpToPage();
              }
            }}
          />
        </label>

        <button className="history-page-btn" type="button" onClick={jumpToPage}>
          Go
        </button>

        <button
          className="history-page-btn"
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
