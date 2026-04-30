import {
  formatDate,
  formatShortId,
} from "../../utils/historyUtils.js";

export function ReportRows({ reportItems, status, emptyMessage, onOpenReport }) {
  // These early returns keep the table state readable: loading, error, empty,
  // and data rows are handled as separate visual outcomes.
  if (status.loading) {
    return <p className="history-empty">Loading analysis history...</p>;
  }

  if (status.error) {
    return <p className="history-empty">{status.error}</p>;
  }

  if (!reportItems.length) {
    return <p className="history-empty">{emptyMessage}</p>;
  }

  return reportItems.map((reportItem) => (
    <article className="history-row" key={reportItem.run_id}>
      <span className="history-cell history-id" title={reportItem.run_id}>
        {formatShortId(reportItem.run_id, "R-")}
      </span>
      <span className="history-cell title" title={reportItem.source_name}>
        {reportItem.source_name}
      </span>
      <span className="history-cell">{formatDate(reportItem.created_at)}</span>
      <span className="history-cell score">{reportItem.overall_score}</span>
      <span className="history-cell action">
        <div className="history-actions">
          <button
            className="history-open-btn"
            type="button"
            data-run-id={reportItem.run_id}
            data-action="open"
            onClick={() => onOpenReport(reportItem.run_id, "open")}
          >
            View
          </button>
          <button
            className="history-print-btn"
            type="button"
            data-run-id={reportItem.run_id}
            data-action="print"
            title="Open this record and print it"
            onClick={() => onOpenReport(reportItem.run_id, "print")}
          >
            <span aria-hidden="true">Print</span>
          </button>
        </div>
      </span>
    </article>
  ));
}
