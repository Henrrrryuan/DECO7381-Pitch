import {
  formatDate,
  formatReportTimestamp,
} from "../../utils/historyUtils.js";

export function ReportRows({ reportItems, status, emptyMessage, onOpenReport }) {
  // Row renderer for ReportHistoryPanel.jsx.
  //
  // Interaction with other files:
  // - ReportHistoryPanel.jsx passes reportItems and the current loading/error
  //   status into this component.
  // - historyUtils.js formats dates and timestamp-style Report IDs for display.
  // - The View button calls onOpenReport, which is implemented in
  //   HistoryPage.jsx. That page opens dashboard.html in history context mode
  //   without overwriting the user's current dashboard session.
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
      <span className="history-cell history-id" title={reportItem.created_at || reportItem.run_id}>
        {formatReportTimestamp(reportItem.created_at)}
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
            onClick={() => onOpenReport(reportItem.run_id)}
          >
            View
          </button>
        </div>
      </span>
    </article>
  ));
}
