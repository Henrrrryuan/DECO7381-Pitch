import {
  formatDate,
  formatShortId,
} from "../../utils/historyUtils.js";

export function ReportRows({ items, status, emptyMessage, onOpenReport }) {
  if (status.loading) {
    return <p className="history-empty">Loading analysis history...</p>;
  }

  if (status.error) {
    return <p className="history-empty">{status.error}</p>;
  }

  if (!items.length) {
    return <p className="history-empty">{emptyMessage}</p>;
  }

  return items.map((item) => (
    <article className="history-row" key={item.run_id}>
      <span className="history-cell history-id" title={item.run_id}>
        {formatShortId(item.run_id, "R-")}
      </span>
      <span className="history-cell title" title={item.source_name}>
        {item.source_name}
      </span>
      <span className="history-cell">{formatDate(item.created_at)}</span>
      <span className="history-cell score">{item.overall_score}</span>
      <span className="history-cell action">
        <div className="history-actions">
          <button
            className="history-open-btn"
            type="button"
            data-run-id={item.run_id}
            data-action="open"
            onClick={() => onOpenReport(item.run_id, "open")}
          >
            View
          </button>
          <button
            className="history-print-btn"
            type="button"
            data-run-id={item.run_id}
            data-action="print"
            title="Open this record and print it"
            onClick={() => onOpenReport(item.run_id, "print")}
          >
            <span aria-hidden="true">Print</span>
          </button>
        </div>
      </span>
    </article>
  ));
}
