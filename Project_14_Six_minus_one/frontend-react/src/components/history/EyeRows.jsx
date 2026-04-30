import {
  formatDate,
  formatDuration,
  formatShortId,
} from "../../utils/historyUtils.js";

export function EyeRows({ items, status, emptyMessage }) {
  if (status.loading) {
    return <p className="history-empty">Loading eye-tracking evidence...</p>;
  }

  if (status.error) {
    return <p className="history-empty">{status.error}</p>;
  }

  if (!items.length) {
    return <p className="history-empty">{emptyMessage}</p>;
  }

  return items.map((item) => {
    const coverage = Number(item.coverage_percent ?? 0).toFixed(1);
    const relatedRun = item.run_id ? formatShortId(item.run_id, "R-") : "-";
    const sessionMeta = `${formatDate(item.created_at)} / ${item.sample_count} samples / ${formatDuration(item.duration_ms)}`;

    return (
      <article className="history-eye-row" key={item.session_id}>
        <span className="history-cell history-id" title={item.session_id}>
          {formatShortId(item.session_id, "E-")}
        </span>
        <span className="history-cell history-eye-target">
          <strong title={item.source_name}>{item.source_name}</strong>
          {item.target_url ? (
            <small title={item.target_url}>{item.target_url}</small>
          ) : (
            <small>No target URL saved</small>
          )}
          <small>{sessionMeta}</small>
        </span>
        <span className="history-cell score">{coverage}%</span>
        <span className="history-cell history-id" title={item.run_id || ""}>
          {relatedRun}
        </span>
      </article>
    );
  });
}
