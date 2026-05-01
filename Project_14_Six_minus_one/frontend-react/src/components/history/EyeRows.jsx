import {
  formatDate,
  formatDuration,
  formatShortId,
} from "../../utils/historyUtils.js";

export function EyeRows({ eyeSessionItems, status, emptyMessage }) {
  // Row renderer for EyeHistoryPanel.jsx.
  //
  // Interaction with other files:
  // - EyeHistoryPanel.jsx passes the eyeSessionItems loaded by HistoryPage.jsx.
  // - historyUtils.js formats dates, durations, Evidence IDs, and Report IDs.
  // - This component does not trigger navigation; it only presents saved eye
  //   evidence as supporting context beside report history.
  // It converts raw backend fields into compact display values that are easier
  // to scan in the table.
  if (status.loading) {
    return <p className="history-empty">Loading eye-tracking evidence...</p>;
  }

  if (status.error) {
    return <p className="history-empty">{status.error}</p>;
  }

  if (!eyeSessionItems.length) {
    return <p className="history-empty">{emptyMessage}</p>;
  }

  return eyeSessionItems.map((eyeSession) => {
    const coveragePercentText = Number(eyeSession.coverage_percent ?? 0).toFixed(1);
    const sessionMetadata = `${formatDate(eyeSession.created_at)} / ${eyeSession.sample_count} samples / ${formatDuration(eyeSession.duration_ms)}`;

    return (
      <article className="history-eye-row" key={eyeSession.session_id}>
        <span className="history-cell history-id" title={eyeSession.session_id}>
          {formatShortId(eyeSession.session_id, "E-")}
        </span>
        <span className="history-cell history-eye-target">
          <strong title={eyeSession.source_name}>{eyeSession.source_name}</strong>
          {eyeSession.target_url ? (
            <small title={eyeSession.target_url}>{eyeSession.target_url}</small>
          ) : (
            <small>No target URL saved</small>
          )}
          <small>{sessionMetadata}</small>
        </span>
        <span className="history-cell score">{coveragePercentText}%</span>
      </article>
    );
  });
}
