import {
  formatDate,
  formatShortId,
} from "../../utils/historyUtils.js";

export function ReportRows({ reportItems, status, emptyMessage, onOpenReport }) {
  // Row renderer for ReportHistoryPanel.jsx.
  //
  // Interaction with other files:
  // - ReportHistoryPanel.jsx passes reportItems and the current loading/error
  //   status into this component.
  // - historyUtils.js formats dates and short Report IDs for display.
  // - The View and Print buttons call onOpenReport, which is implemented in
  //   HistoryPage.jsx. That page fetches the full report detail and opens the
  //   older dashboard.html page.
  // These early returns keep loading, error, empty, and data states separate.
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
